-- =============================================================================
-- HirecWallp — production admin (analytics, scalable lists, audit log, refunds)
-- All functions are SECURITY DEFINER and callable by the service role only;
-- the admin pages call them server-side after an admin check.
-- =============================================================================

-- --- Searchable customer email on profiles (kept in sync with auth.users) -----
alter table profiles add column email text;
create index profiles_email_idx on profiles (lower(email));
create index profiles_created_idx on profiles (created_at desc);

update profiles p set email = u.email from auth.users u where u.id = p.id and p.email is distinct from u.email;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;

-- Email is visible to its owner via RLS but must not be client-editable.
-- (Client updates are already column-limited by migration 0007.)

-- --- Payment id (needed to refund from the admin panel) -----------------------
alter table orders add column provider_payment_id text;
create index orders_status_created_idx on orders (status, created_at desc);
create index orders_paid_at_idx on orders (paid_at desc) where status = 'paid';

-- --- Admin audit log ----------------------------------------------------------
create table admin_audit (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id) on delete set null,
  actor_email text,
  action      text not null,
  target_type text,
  target_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index admin_audit_created_idx on admin_audit (created_at desc);
create index admin_audit_target_idx on admin_audit (target_type, target_id);
alter table admin_audit enable row level security;
create policy "admin_audit: admin read" on admin_audit for select using (public.is_admin());

-- --- Analytics -----------------------------------------------------------------
-- Paid orders per day and currency since p_from.
create or replace function public.admin_sales_daily(p_from timestamptz)
returns table (day date, currency text, orders int, revenue_minor bigint)
language sql stable security definer set search_path = public
as $$
  select coalesce(paid_at, created_at)::date, currency, count(*)::int, sum(amount_minor)::bigint
  from public.orders
  where status = 'paid' and coalesce(paid_at, created_at) >= p_from
  group by 1, 2
  order by 1;
$$;

-- Best sellers since p_from (paid order lines).
create or replace function public.admin_top_sellers(p_from timestamptz, p_limit int default 10)
returns table (wallpaper_id uuid, title text, slug text, sales int)
language sql stable security definer set search_path = public
as $$
  select w.id, w.title, w.slug, count(*)::int
  from public.order_items i
  join public.orders o on o.id = i.order_id and o.status = 'paid' and coalesce(o.paid_at, o.created_at) >= p_from
  join public.wallpapers w on w.id = i.wallpaper_id
  group by w.id, w.title, w.slug
  order by 4 desc
  limit p_limit;
$$;

-- Most viewed since p_from (raw events + daily rollups).
create or replace function public.admin_top_viewed(p_from timestamptz, p_limit int default 10)
returns table (wallpaper_id uuid, title text, slug text, views bigint)
language sql stable security definer set search_path = public
as $$
  with v as (
    select wallpaper_id, count(*)::bigint as n from public.events
    where type = 'detail_view' and created_at >= p_from and wallpaper_id is not null group by 1
    union all
    select wallpaper_id, sum(count)::bigint from public.events_daily
    where type = 'detail_view' and day >= p_from::date and wallpaper_id is not null group by 1
  )
  select w.id, w.title, w.slug, sum(v.n)::bigint
  from v join public.wallpapers w on w.id = v.wallpaper_id
  group by w.id, w.title, w.slug
  order by 4 desc
  limit p_limit;
$$;

-- Funnel counts by event type since p_from.
create or replace function public.admin_funnel(p_from timestamptz)
returns table (type text, total bigint)
language sql stable security definer set search_path = public
as $$
  select t, sum(n)::bigint from (
    select type::text as t, count(*)::bigint as n from public.events where created_at >= p_from group by 1
    union all
    select type::text, sum(count)::bigint from public.events_daily where day >= p_from::date group by 1
  ) x group by t;
$$;

-- Paid orders by region tier (from currency / billing country) since p_from.
create or replace function public.admin_sales_by_country(p_from timestamptz)
returns table (country text, currency text, orders int, revenue_minor bigint)
language sql stable security definer set search_path = public
as $$
  select coalesce(billing_country, '—'), currency, count(*)::int, sum(amount_minor)::bigint
  from public.orders
  where status = 'paid' and coalesce(paid_at, created_at) >= p_from
  group by 1, 2
  order by 3 desc;
$$;

-- Paginated, searchable customer list with purchase counts.
create or replace function public.admin_customers(p_q text, p_limit int, p_offset int)
returns table (id uuid, email text, display_name text, role user_role, country_code text, gstin text,
               created_at timestamptz, paid_orders int, owned int, total_count bigint)
language sql stable security definer set search_path = public
as $$
  with base as (
    select p.* from public.profiles p
    where p_q is null or p_q = '' or p.email ilike '%' || p_q || '%' or p.display_name ilike '%' || p_q || '%'
  )
  select b.id, b.email, b.display_name, b.role, b.country_code, b.gstin, b.created_at,
         (select count(*)::int from public.orders o where o.user_id = b.id and o.status = 'paid'),
         (select count(*)::int from public.entitlements e where e.user_id = b.id),
         count(*) over ()
  from base b
  order by b.created_at desc
  limit p_limit offset p_offset;
$$;

revoke execute on function public.admin_sales_daily(timestamptz) from public, anon, authenticated;
revoke execute on function public.admin_top_sellers(timestamptz, int) from public, anon, authenticated;
revoke execute on function public.admin_top_viewed(timestamptz, int) from public, anon, authenticated;
revoke execute on function public.admin_funnel(timestamptz) from public, anon, authenticated;
revoke execute on function public.admin_sales_by_country(timestamptz) from public, anon, authenticated;
revoke execute on function public.admin_customers(text, int, int) from public, anon, authenticated;
grant execute on function public.admin_sales_daily(timestamptz) to service_role;
grant execute on function public.admin_top_sellers(timestamptz, int) to service_role;
grant execute on function public.admin_top_viewed(timestamptz, int) to service_role;
grant execute on function public.admin_funnel(timestamptz) to service_role;
grant execute on function public.admin_sales_by_country(timestamptz) to service_role;
grant execute on function public.admin_customers(text, int, int) to service_role;
