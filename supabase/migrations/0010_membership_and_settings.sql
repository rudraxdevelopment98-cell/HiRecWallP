-- =============================================================================
-- HirecWallp — admin control centre + membership passes
--
-- * site_settings: key/value switches the admin flips from /admin/settings
--   (public read so the storefront can honour them; writes via service role).
-- * Membership = a prepaid pass (e.g. 30 or 365 days), bought like any order.
--   No auto-renew (avoids RBI e-mandate rules for recurring card/UPI debits);
--   buying again extends the pass. Members add wallpapers to their library
--   up to the plan's limit per pass.
-- =============================================================================

create table site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table site_settings enable row level security;
create policy "site_settings: public read" on site_settings for select using (true);

create table membership_plans (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  description         text,
  duration_days       int  not null check (duration_days between 1 and 3660),
  -- Price per region in that region's currency MINOR units, e.g.
  -- {"IN": 29900, "T1": 799, "T2": 599, "T3": 399}. Missing region = not sold there.
  prices              jsonb not null default '{}'::jsonb,
  download_limit      int  not null default 50 check (download_limit > 0),
  includes_commercial boolean not null default false,
  perks               text[] not null default '{}',
  active              boolean not null default true,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now()
);
alter table membership_plans enable row level security;
create policy "membership_plans: public read active" on membership_plans for select using (active = true);
create policy "membership_plans: admin read" on membership_plans for select using (public.is_admin());

create type membership_status as enum ('active', 'revoked');
create table memberships (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  plan_id        uuid references membership_plans(id) on delete set null,
  order_id       uuid references orders(id) on delete set null,
  starts_at      timestamptz not null default now(),
  ends_at        timestamptz not null,
  download_limit int not null,
  downloads_used int not null default 0,
  includes_commercial boolean not null default false,
  status         membership_status not null default 'active',
  note           text,
  created_at     timestamptz not null default now()
);
create index memberships_user_idx on memberships (user_id, ends_at desc);
create unique index memberships_order_uniq on memberships (order_id) where order_id is not null;
alter table memberships enable row level security;
create policy "memberships: read own" on memberships for select using (user_id = auth.uid());
create policy "memberships: admin read" on memberships for select using (public.is_admin());

alter table order_items add column membership_plan_id uuid references membership_plans(id) on delete set null;

-- Grant a pass from a paid order (idempotent per order). A new pass starts
-- when the user's current pass ends, so renewing early never loses days.
create or replace function public.grant_membership(p_user uuid, p_plan uuid, p_order uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan  public.membership_plans%rowtype;
  v_start timestamptz;
  v_id    uuid;
begin
  select id into v_id from public.memberships where order_id = p_order;
  if v_id is not null then return v_id; end if;

  select * into v_plan from public.membership_plans where id = p_plan;
  if not found then raise exception 'unknown plan'; end if;

  select greatest(now(), coalesce(max(ends_at), now())) into v_start
  from public.memberships
  where user_id = p_user and status = 'active' and ends_at > now();

  insert into public.memberships (user_id, plan_id, order_id, starts_at, ends_at, download_limit, includes_commercial)
  values (p_user, p_plan, p_order, v_start, v_start + make_interval(days => v_plan.duration_days),
          v_plan.download_limit, v_plan.includes_commercial)
  returning id into v_id;
  return v_id;
end;
$$;

-- Add a wallpaper to a member's library using their active pass. Already
-- owned → returns the existing entitlement without using an allowance.
-- Returns NULL when there is no active pass or the allowance is used up.
create or replace function public.member_unlock(p_user uuid, p_wallpaper uuid, p_max_downloads int default 5)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m       public.memberships%rowtype;
  v_licence licence_type;
  v_id      uuid;
begin
  perform pg_advisory_xact_lock(hashtext('member:' || p_user::text));

  select * into v_m from public.memberships
  where user_id = p_user and status = 'active' and starts_at <= now() and ends_at > now()
    and downloads_used < download_limit
  order by ends_at asc
  limit 1;
  if not found then return null; end if;

  v_licence := case when v_m.includes_commercial then 'commercial'::licence_type else 'personal'::licence_type end;

  select id into v_id from public.entitlements
  where user_id = p_user and wallpaper_id = p_wallpaper and (licence = v_licence or licence = 'commercial');
  if v_id is not null then return v_id; end if;

  insert into public.entitlements (user_id, wallpaper_id, licence, max_downloads)
  values (p_user, p_wallpaper, v_licence, p_max_downloads)
  returning id into v_id;

  update public.memberships set downloads_used = downloads_used + 1 where id = v_m.id;
  return v_id;
end;
$$;

revoke execute on function public.grant_membership(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.member_unlock(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.grant_membership(uuid, uuid, uuid) to service_role;
grant execute on function public.member_unlock(uuid, uuid, int) to service_role;

-- Starter plans (inactive until the owner reviews prices and switches
-- membership on in /admin/settings).
insert into membership_plans (name, description, duration_days, prices, download_limit, includes_commercial, perks, active, sort_order) values
  ('Monthly Pass', '30 days of access', 30, '{"IN": 19900, "T1": 699, "T2": 499, "T3": 299}', 30, false,
   array['Add up to 30 wallpapers to your library', 'Every size of each wallpaper', 'Keep them forever'], false, 10),
  ('Yearly Pass', '365 days of access', 365, '{"IN": 149900, "T1": 4999, "T2": 3499, "T3": 1999}', 400, false,
   array['Add up to 400 wallpapers to your library', 'Every size of each wallpaper', 'Keep them forever', 'Best value'], false, 20);
