-- =============================================================================
-- HirecWallp — growth engine (2026-11-03)
-- 1. First-purchase bonus: extra bonus credits on an account's first paid order.
-- 2. Gift credits: buy a credit pack for someone; they redeem a code. Gifts can
--    only be redeemed in the same pricing tier or a cheaper one (like Steam),
--    so cheap-tier credits can't be gifted into an expensive tier.
-- 3. Festival drops: packs and plans can have a real sale window
--    (sale_starts_at / sale_ends_at). Real deadlines, no fake timers.
-- 4. Creator affiliate links: creators earn a commission on orders from
--    visitors they sent (last click, 30 days), paid with monthly payouts.
-- 5. Daily free wallpaper: one premium wallpaper free each day (IST) for
--    signed-in users; optional daily email for subscribers who opt in.
-- Everything is idempotent and refund-aware.
-- =============================================================================

-- --- 1. First-purchase bonus ----------------------------------------------------
alter table profiles add column if not exists first_bonus_at timestamptz;

create or replace function public.first_purchase_bonus(p_order uuid, p_credits int, p_days int)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  o public.orders%rowtype;
  v_marked timestamptz;
begin
  select * into o from public.orders where id = p_order and status = 'paid';
  if not found or coalesce(p_credits, 0) <= 0 then return 0; end if;
  perform pg_advisory_xact_lock(hashtext('firstbonus:' || o.user_id::text));
  select first_bonus_at into v_marked from public.profiles where id = o.user_id;
  if v_marked is not null then return 0; end if;
  update public.profiles set first_bonus_at = now() where id = o.user_id;
  -- Only the first paid order earns it.
  if exists (select 1 from public.orders where user_id = o.user_id and status in ('paid', 'refunded') and id <> o.id
             and coalesce(paid_at, created_at) < coalesce(o.paid_at, o.created_at)) then
    return 0;
  end if;
  -- Keyed to the order, so refunding it takes the bonus back.
  insert into public.credit_ledger (user_id, delta, reason, ref_id, bucket, expires_at)
  values (o.user_id, p_credits, 'bonus', o.id, 'bonus', now() + make_interval(days => greatest(p_days, 1)));
  return p_credits;
end;
$$;

-- --- 2. Gift credits ---------------------------------------------------------------
alter table orders
  add column if not exists gift_email   text check (gift_email is null or gift_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column if not exists gift_from    text check (char_length(gift_from) <= 60),
  add column if not exists gift_message text check (char_length(gift_message) <= 300);

create table if not exists gift_codes (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code ~ '^[A-Z0-9]{12}$'),
  order_id       uuid not null unique references orders(id) on delete cascade,
  purchaser_id   uuid not null references profiles(id) on delete cascade,
  recipient_email text,
  from_name      text,
  message        text,
  credits        int not null check (credits > 0),
  bonus_credits  int not null default 0 check (bonus_credits >= 0),
  region_code    text not null references regions(code),
  status         text not null default 'pending' check (status in ('pending', 'redeemed', 'void')),
  redeemed_by    uuid references profiles(id) on delete set null,
  redeemed_at    timestamptz,
  expires_at     timestamptz not null default now() + interval '365 days',
  created_at     timestamptz not null default now()
);
create index if not exists gift_codes_purchaser_idx on gift_codes (purchaser_id, created_at desc);
create index if not exists gift_codes_redeemer_idx on gift_codes (redeemed_by) where redeemed_by is not null;
alter table gift_codes enable row level security;
create policy "gift_codes: read own" on gift_codes for select
  using (purchaser_id = (select auth.uid()) or redeemed_by = (select auth.uid()));
create policy "gift_codes: admin read" on gift_codes for select using ((select public.is_admin()));

-- Create the code for a paid gift order (idempotent). Returns the code.
create or replace function public.create_gift(p_order uuid, p_region text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  o public.orders%rowtype;
  p public.credit_packs%rowtype;
  v_code text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  select code into v_code from public.gift_codes where order_id = p_order;
  if v_code is not null then return v_code; end if;
  select * into o from public.orders where id = p_order and status = 'paid';
  if not found then raise exception 'order not paid'; end if;
  select cp.* into p from public.order_items i join public.credit_packs cp on cp.id = i.credit_pack_id
  where i.order_id = p_order limit 1;
  if not found then raise exception 'gift order has no credit pack'; end if;
  loop
    v_code := '';
    for i in 1..12 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.gift_codes where code = v_code);
  end loop;
  insert into public.gift_codes (code, order_id, purchaser_id, recipient_email, from_name, message, credits, bonus_credits, region_code)
  values (v_code, o.id, o.user_id, o.gift_email, o.gift_from, o.gift_message, p.credits, p.bonus_credits, coalesce(p_region, p.region_code));
  return v_code;
end;
$$;

-- Redeem a gift (atomic). The caller checks the redeemer's pricing tier first.
-- Credits are keyed to the gift's order, so refunding it reverses them.
create or replace function public.redeem_gift(p_code text, p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare g public.gift_codes%rowtype;
begin
  select * into g from public.gift_codes where code = upper(p_code) for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if g.status = 'redeemed' then
    return jsonb_build_object('status', case when g.redeemed_by = p_user then 'already_yours' else 'used' end);
  end if;
  if g.status <> 'pending' then return jsonb_build_object('status', 'void'); end if;
  if g.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;

  insert into public.credit_ledger (user_id, delta, reason, ref_id, bucket)
  values (p_user, g.credits, 'purchase', g.order_id, 'paid');
  if g.bonus_credits > 0 then
    insert into public.credit_ledger (user_id, delta, reason, ref_id, bucket, expires_at)
    values (p_user, g.bonus_credits, 'bonus', g.order_id, 'bonus', now() + interval '365 days');
  end if;
  update public.gift_codes set status = 'redeemed', redeemed_by = p_user, redeemed_at = now() where id = g.id;
  return jsonb_build_object('status', 'redeemed', 'credits', g.credits + g.bonus_credits);
end;
$$;

-- --- 3. Festival sale windows --------------------------------------------------------
alter table credit_packs
  add column if not exists sale_starts_at timestamptz,
  add column if not exists sale_ends_at   timestamptz;
alter table membership_plans
  add column if not exists sale_starts_at timestamptz,
  add column if not exists sale_ends_at   timestamptz;

-- --- 4. Creator affiliate links ------------------------------------------------------
alter table orders add column if not exists affiliate_id uuid references profiles(id) on delete set null;
create index if not exists orders_affiliate_idx on orders (affiliate_id) where affiliate_id is not null;

create table if not exists affiliate_commissions (
  id                 uuid primary key default gen_random_uuid(),
  affiliate_id       uuid not null references profiles(id) on delete cascade,
  order_id           uuid not null unique references orders(id) on delete cascade,
  currency           text not null,
  order_amount_minor int  not null,
  pct                numeric not null,
  commission_minor   int  not null check (commission_minor >= 0),
  status             text not null default 'pending' check (status in ('pending', 'paid', 'void')),
  payout_period      text,
  created_at         timestamptz not null default now()
);
create index if not exists affiliate_commissions_affiliate_idx on affiliate_commissions (affiliate_id, created_at desc);
alter table affiliate_commissions enable row level security;
create policy "affiliate_commissions: read own" on affiliate_commissions for select using (affiliate_id = (select auth.uid()));
create policy "affiliate_commissions: admin read" on affiliate_commissions for select using ((select public.is_admin()));

-- Record the commission for a paid order with an affiliate (idempotent).
create or replace function public.record_affiliate_commission(p_order uuid, p_pct numeric)
returns int
language plpgsql security definer set search_path = public
as $$
declare o public.orders%rowtype; v int;
begin
  select * into o from public.orders where id = p_order and status = 'paid';
  if not found or o.affiliate_id is null or o.affiliate_id = o.user_id or coalesce(p_pct, 0) <= 0 then return 0; end if;
  if not exists (select 1 from public.creators where user_id = o.affiliate_id and kyc_status <> 'rejected') then return 0; end if;
  v := floor(o.amount_minor * least(p_pct, 50) / 100.0)::int;
  insert into public.affiliate_commissions (affiliate_id, order_id, currency, order_amount_minor, pct, commission_minor)
  values (o.affiliate_id, o.id, o.currency, o.amount_minor, least(p_pct, 50), v)
  on conflict (order_id) do nothing;
  return v;
end;
$$;

-- --- 5. Daily free wallpaper ---------------------------------------------------------
create table if not exists daily_picks (
  day          date primary key,
  wallpaper_id uuid not null references wallpapers(id) on delete cascade,
  emailed_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists daily_picks_wallpaper_idx on daily_picks (wallpaper_id);
alter table daily_picks enable row level security;
create policy "daily_picks: public read" on daily_picks for select using (true);

alter table newsletter_subscribers add column if not exists daily boolean not null default false;

alter table entitlements drop constraint if exists entitlements_source_check;
alter table entitlements add constraint entitlements_source_check
  check (source in ('order', 'credits', 'membership', 'gift', 'daily'));

-- Today's date in India (the pick changes at midnight IST).
create or replace function public.ist_today()
returns date language sql stable set search_path = public
as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- Choose the pick for a day (idempotent): a published premium wallpaper not
-- picked in the last 60 days, at random.
create or replace function public.pick_daily(p_day date default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_day date := coalesce(p_day, public.ist_today()); v uuid;
begin
  select wallpaper_id into v from public.daily_picks where day = v_day;
  if v is not null then return v; end if;
  select w.id into v from public.wallpapers w
  where w.status = 'published' and w.is_free = false
    and not exists (select 1 from public.daily_picks d where d.wallpaper_id = w.id and d.day > v_day - 60)
  order by random() limit 1;
  if v is null then
    select w.id into v from public.wallpapers w where w.status = 'published' and w.is_free = false order by random() limit 1;
  end if;
  if v is null then return null; end if;
  insert into public.daily_picks (day, wallpaper_id) values (v_day, v) on conflict (day) do nothing;
  select wallpaper_id into v from public.daily_picks where day = v_day;
  return v;
end;
$$;

-- Add today's pick to a signed-in user's library (once; already owned = no-op).
create or replace function public.claim_daily_pick(p_user uuid, p_max_downloads int default 5)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_w uuid; v_id uuid;
begin
  select wallpaper_id into v_w from public.daily_picks where day = public.ist_today();
  if v_w is null then return jsonb_build_object('status', 'none'); end if;
  perform pg_advisory_xact_lock(hashtext('daily:' || p_user::text));
  select id into v_id from public.entitlements where user_id = p_user and wallpaper_id = v_w;
  if v_id is not null then return jsonb_build_object('status', 'owned', 'wallpaper_id', v_w); end if;
  insert into public.entitlements (user_id, wallpaper_id, licence, max_downloads, source)
  values (p_user, v_w, 'personal', p_max_downloads, 'daily') returning id into v_id;
  return jsonb_build_object('status', 'claimed', 'wallpaper_id', v_w, 'entitlement_id', v_id);
end;
$$;

-- --- Permissions ---------------------------------------------------------------------
revoke execute on function public.first_purchase_bonus(uuid, int, int) from public, anon, authenticated;
revoke execute on function public.create_gift(uuid, text) from public, anon, authenticated;
revoke execute on function public.redeem_gift(text, uuid) from public, anon, authenticated;
revoke execute on function public.record_affiliate_commission(uuid, numeric) from public, anon, authenticated;
revoke execute on function public.pick_daily(date) from public, anon, authenticated;
revoke execute on function public.claim_daily_pick(uuid, int) from public, anon, authenticated;
grant execute on function public.first_purchase_bonus(uuid, int, int) to service_role;
grant execute on function public.create_gift(uuid, text) to service_role;
grant execute on function public.redeem_gift(text, uuid) to service_role;
grant execute on function public.record_affiliate_commission(uuid, numeric) to service_role;
grant execute on function public.pick_daily(date) to service_role;
grant execute on function public.claim_daily_pick(uuid, int) to service_role;
grant execute on function public.ist_today() to anon, authenticated, service_role;

-- --- Festival example (switched OFF; set dates/prices and turn on in Admin) -----------
insert into membership_plans (name, description, kind, term_months, duration_days, download_limit, includes_commercial, category_id, perks, active, sort_order, sale_starts_at, sale_ends_at)
select 'Diwali Festival Pass', 'Every Diwali & festival wallpaper this season: 40 a month', 'category', 1, 30, 40, false, c.id,
       array['40 festival wallpapers a month', 'New Diwali drops included', 'Keep what you add, forever'], false, 85,
       timestamptz '2026-10-25 00:00+05:30', timestamptz '2026-11-12 23:59+05:30'
from categories c
where c.slug = 'festival' and not exists (select 1 from membership_plans where name = 'Diwali Festival Pass');
insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor)
select p.id, 'prepaid', v.region, '{}', v.cur, v.amt
from membership_plans p
cross join (values ('IN', 'INR', 7900), ('T1', 'USD', 299), ('T2', 'USD', 249), ('T3', 'USD', 199), ('T4', 'USD', 149)) v(region, cur, amt)
where p.name = 'Diwali Festival Pass' and not exists (select 1 from plan_prices pp where pp.plan_id = p.id);
