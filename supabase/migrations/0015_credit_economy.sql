-- =============================================================================
-- HirecWallp — credit economy (2026-11-03)
-- * Credits everywhere: India moves from per-item ₹ to credits like every other
--   country. Credit PACK prices differ by tier (5 tiers) and, optionally, by
--   country (local currency overrides, e.g. GBP/EUR/AUD/CAD).
-- * Packs carry bonus credits. Paid credits never expire; bonus credits are
--   separate "lots" that expire after 12 months and are spent first.
-- * Plans (telecom-style tabs): monthly, contract (3/6/12 months), category
--   passes, business (commercial licence). Allowance refreshes every 30 days
--   and does not roll over. Each plan has prepaid and/or autopay prices per
--   tier/country (plan_prices). Autopay = Razorpay Subscriptions.
-- ⚠️ Prices are owner-editable starting points; GST treatment of prepaid
--    credits and subscriptions must be confirmed by a CA.
-- =============================================================================

-- --- Regions: 5 tiers, all priced in credits -----------------------------------
alter table regions drop constraint regions_code_check;
alter table regions add constraint regions_code_check check (code ~ '^[A-Z0-9]{2,4}$');
alter table regions add column if not exists sort_order int not null default 0;
update regions set pricing_unit = 'credits';
insert into regions (code, name, currency, pricing_unit, country_codes, sort_order) values
  ('IN', 'India',                                                   'INR', 'credits', array['IN'], 10),
  ('T1', 'Tier 1 (US, UK, Western Europe, ANZ, Canada)',             'USD', 'credits', array[]::text[], 20),
  ('T2', 'Tier 2 (Gulf, East Asia, Southern Europe)',                'USD', 'credits', array[]::text[], 30),
  ('T3', 'Tier 3 (Eastern Europe, Latin America, SE Asia — default)', 'USD', 'credits', array[]::text[], 40),
  ('T4', 'Tier 4 (South Asia, Africa, emerging)',                    'USD', 'credits', array[]::text[], 50)
on conflict (code) do update
  set name = excluded.name, pricing_unit = excluded.pricing_unit, sort_order = excluded.sort_order;

-- Wallpapers cost the same number of credits everywhere (1 by default);
-- what a credit costs is what changes per country.
update price_rules set min_price = 1, max_price = 3, base_price = 1, snap_points = '{1,2,3}', launch_price = 1
where scope = 'global';
insert into price_rules (scope, scope_id, region_code, min_price, max_price, base_price, snap_points, max_step_pct, cooldown_hours, launch_price, launch_hours, frozen)
select 'global', null, 'T4', 1, 3, 1, '{1,2,3}', 50, 24, 1, 72, false
where not exists (select 1 from price_rules where scope = 'global' and region_code = 'T4');
update prices set current_price = least(greatest(round(current_price), 1), 3);

-- --- Credit packs ---------------------------------------------------------------
alter table credit_packs
  add column if not exists name text,
  add column if not exists bonus_credits int not null default 0 check (bonus_credits >= 0),
  add column if not exists badge text check (badge in ('recommended', 'best_value')),
  add column if not exists sort_order int not null default 0,
  -- Empty = the whole tier. Non-empty = this price only for these countries
  -- (beats the tier price), e.g. GBP for GB.
  add column if not exists country_codes text[] not null default '{}',
  add column if not exists created_at timestamptz not null default now();
create index if not exists credit_packs_region_idx on credit_packs (region_code) where active;

-- --- Credit ledger: paid vs bonus lots ------------------------------------------
alter type credit_reason add value if not exists 'bonus';
alter type credit_reason add value if not exists 'expire';
alter table credit_ledger
  add column if not exists bucket text not null default 'paid' check (bucket in ('paid', 'bonus')),
  add column if not exists expires_at timestamptz,
  -- Set on entries that consume a bonus lot (spend / expire / refund).
  add column if not exists lot_id uuid references credit_ledger(id) on delete cascade;
create index if not exists credit_ledger_user_bucket_idx on credit_ledger (user_id, bucket);
create index if not exists credit_ledger_lot_idx on credit_ledger (lot_id) where lot_id is not null;
create index if not exists credit_ledger_ref_idx on credit_ledger (ref_id) where ref_id is not null;

-- Remaining credits in each unexpired bonus lot.
create or replace function public.bonus_lots(p_user uuid)
returns table (lot_id uuid, remaining int, expires_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select l.id, (l.delta + coalesce((select sum(c.delta) from public.credit_ledger c where c.lot_id = l.id), 0))::int, l.expires_at
  from public.credit_ledger l
  where l.user_id = p_user and l.bucket = 'bonus' and l.lot_id is null and l.delta > 0
    and (l.expires_at is null or l.expires_at > now());
$$;

-- Balance = paid credits + what is left in unexpired bonus lots.
create or replace function public.credit_balance(p_user uuid)
returns int
language sql stable security definer set search_path = public
as $$
  select (
    coalesce((select sum(delta) from public.credit_ledger where user_id = p_user and bucket = 'paid'), 0)
    + coalesce((select sum(greatest(remaining, 0)) from public.bonus_lots(p_user)), 0)
  )::int;
$$;

create or replace function public.my_credit_balance()
returns int
language sql stable security definer set search_path = public
as $$
  select public.credit_balance(auth.uid());
$$;

-- Grant a pack's credits for a paid order (idempotent per order).
create or replace function public.add_pack_credits(p_user uuid, p_order uuid, p_credits int, p_bonus int, p_bonus_days int default 365)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_user::text));
  if exists (select 1 from public.credit_ledger where ref_id = p_order and reason = 'purchase') then
    return;
  end if;
  insert into public.credit_ledger (user_id, delta, reason, ref_id, bucket)
  values (p_user, p_credits, 'purchase', p_order, 'paid');
  if coalesce(p_bonus, 0) > 0 then
    insert into public.credit_ledger (user_id, delta, reason, ref_id, bucket, expires_at)
    values (p_user, p_bonus, 'bonus', p_order, 'bonus', now() + make_interval(days => p_bonus_days));
  end if;
end;
$$;

-- Spend credits to unlock a wallpaper. Bonus lots (soonest expiry first) are
-- used before paid credits — the customer-friendly order.
create or replace function public.spend_credits_and_entitle(
  p_user uuid, p_wallpaper uuid, p_cost int, p_licence licence_type default 'personal', p_max_downloads int default 5
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_existing uuid;
  v_id uuid;
  v_left int := p_cost;
  v_take int;
  r record;
begin
  if p_cost < 0 then raise exception 'cost must be non-negative'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user::text));

  select id into v_existing from public.entitlements
  where user_id = p_user and wallpaper_id = p_wallpaper and licence = p_licence;
  if v_existing is not null then return v_existing; end if;

  if public.credit_balance(p_user) < p_cost then return null; end if;

  insert into public.entitlements (user_id, wallpaper_id, licence, max_downloads)
  values (p_user, p_wallpaper, p_licence, p_max_downloads)
  returning id into v_id;

  for r in select * from public.bonus_lots(p_user) where remaining > 0 order by expires_at asc nulls last loop
    exit when v_left <= 0;
    v_take := least(v_left, r.remaining);
    insert into public.credit_ledger (user_id, delta, reason, ref_id, bucket, lot_id)
    values (p_user, -v_take, 'spend', v_id, 'bonus', r.lot_id);
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    insert into public.credit_ledger (user_id, delta, reason, ref_id, bucket)
    values (p_user, -v_left, 'spend', v_id, 'paid');
  end if;
  return v_id;
end;
$$;

-- Take back the credits an order granted (refunds). Paid credits are reversed
-- in full (balance may go negative if already spent); a bonus lot loses
-- whatever is left in it. Returns the total reversed.
create or replace function public.reverse_order_credits(p_order uuid, p_reason text default 'refund')
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_total int := 0;
  r record;
  v_left int;
begin
  for r in select * from public.credit_ledger where ref_id = p_order and reason in ('purchase', 'bonus') and delta > 0 loop
    perform pg_advisory_xact_lock(hashtext(r.user_id::text));
    if exists (select 1 from public.credit_ledger where ref_id = p_order and reason = 'refund' and (lot_id = r.id or (r.bucket = 'paid' and bucket = 'paid'))) then
      continue;
    end if;
    if r.bucket = 'paid' then
      insert into public.credit_ledger (user_id, delta, reason, ref_id, bucket) values (r.user_id, -r.delta, 'refund', p_order, 'paid');
      v_total := v_total + r.delta;
    else
      select (r.delta + coalesce(sum(delta), 0))::int into v_left from public.credit_ledger where lot_id = r.id;
      if v_left > 0 then
        insert into public.credit_ledger (user_id, delta, reason, ref_id, bucket, lot_id) values (r.user_id, -v_left, 'refund', p_order, 'bonus', r.id);
        v_total := v_total + v_left;
      end if;
    end if;
  end loop;
  return v_total;
end;
$$;

-- --- Plans: tabs, terms, monthly allowance, category passes ----------------------
alter table membership_plans
  add column if not exists kind text not null default 'monthly' check (kind in ('monthly', 'contract', 'category', 'business')),
  add column if not exists term_months int not null default 1 check (term_months between 1 and 36),
  add column if not exists category_id uuid references categories(id) on delete set null,
  add column if not exists badge text check (badge in ('recommended', 'best_value'));
alter table membership_plans drop column if exists prices;
comment on column membership_plans.download_limit is 'Wallpapers allowed per 30-day period (refreshes; unused allowance does not roll over).';
create index if not exists membership_plans_category_idx on membership_plans (category_id) where category_id is not null;

create table if not exists plan_prices (
  id               uuid primary key default gen_random_uuid(),
  plan_id          uuid not null references membership_plans(id) on delete cascade,
  -- prepaid: amount covers the whole term. autopay: amount is charged every month.
  billing          text not null check (billing in ('prepaid', 'autopay')),
  region_code      text not null references regions(code) on delete cascade,
  country_codes    text[] not null default '{}',
  currency         text not null,
  amount_minor     int  not null check (amount_minor > 0),
  provider_plan_id text,           -- Razorpay plan id, created on first autopay checkout
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists plan_prices_plan_idx on plan_prices (plan_id);
create index if not exists plan_prices_region_idx on plan_prices (region_code);
alter table plan_prices enable row level security;
create policy "plan_prices: public read active" on plan_prices for select using (active);
create policy "plan_prices: admin read" on plan_prices for select using ((select public.is_admin()));

-- --- Autopay subscriptions --------------------------------------------------------
create table if not exists subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references profiles(id) on delete cascade,
  plan_id                  uuid references membership_plans(id) on delete set null,
  plan_price_id            uuid references plan_prices(id) on delete set null,
  provider_subscription_id text unique,
  status                   text not null default 'created'
    check (status in ('created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired')),
  currency                 text not null,
  amount_minor             int not null,
  total_count              int not null,
  paid_count               int not null default 0,
  current_end              timestamptz,
  cancel_at_cycle_end      boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on subscriptions (user_id, created_at desc);
create index if not exists subscriptions_plan_idx on subscriptions (plan_id);
create index if not exists subscriptions_price_idx on subscriptions (plan_price_id);
alter table subscriptions enable row level security;
create policy "subscriptions: read own" on subscriptions for select using (user_id = (select auth.uid()));
create policy "subscriptions: admin read" on subscriptions for select using ((select public.is_admin()));

alter table orders add column if not exists subscription_id uuid references subscriptions(id) on delete set null;
create index if not exists orders_subscription_idx on orders (subscription_id) where subscription_id is not null;
alter table order_items add column if not exists plan_price_id uuid references plan_prices(id) on delete set null;
create index if not exists order_items_plan_price_idx on order_items (plan_price_id) where plan_price_id is not null;

-- --- Memberships: 30-day allowance periods, category scope, subscription link -----
alter table memberships
  add column if not exists period_days  int not null default 30 check (period_days between 1 and 366),
  add column if not exists period_start timestamptz,
  add column if not exists period_used  int not null default 0,
  add column if not exists category_id  uuid references categories(id) on delete set null,
  add column if not exists subscription_id uuid references subscriptions(id) on delete set null;
comment on column memberships.download_limit is 'Allowance per period (period_days).';
create index if not exists memberships_category_idx on memberships (category_id) where category_id is not null;
create index if not exists memberships_subscription_idx on memberships (subscription_id) where subscription_id is not null;

-- Grant a pass from a paid order (idempotent per order). Prepaid passes last
-- term_months × 30 days; autopay passes one month per charge (p_days = 30).
-- A new pass starts when the user's current pass OF THE SAME SCOPE (same
-- category, or general) ends, so renewing early never loses days.
drop function if exists public.grant_membership(uuid, uuid, uuid);
create or replace function public.grant_membership(
  p_user uuid, p_plan uuid, p_order uuid, p_days int default null, p_subscription uuid default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_plan  public.membership_plans%rowtype;
  v_start timestamptz;
  v_id    uuid;
  v_days  int;
begin
  select id into v_id from public.memberships where order_id = p_order;
  if v_id is not null then return v_id; end if;

  select * into v_plan from public.membership_plans where id = p_plan;
  if not found then raise exception 'unknown plan'; end if;
  v_days := coalesce(p_days, v_plan.term_months * 30);

  perform pg_advisory_xact_lock(hashtext('member:' || p_user::text));
  select greatest(now(), coalesce(max(ends_at), now())) into v_start
  from public.memberships
  where user_id = p_user and status = 'active' and ends_at > now()
    and category_id is not distinct from v_plan.category_id
    and includes_commercial = v_plan.includes_commercial;

  insert into public.memberships (user_id, plan_id, order_id, starts_at, ends_at, download_limit, includes_commercial,
                                  period_days, period_start, category_id, subscription_id)
  values (p_user, p_plan, p_order, v_start, v_start + make_interval(days => v_days), v_plan.download_limit,
          v_plan.includes_commercial, 30, v_start, v_plan.category_id, p_subscription)
  returning id into v_id;
  return v_id;
end;
$$;

-- Add a wallpaper to a member's library. Picks the narrowest pass that covers
-- the wallpaper (category pass before general) with allowance left in its
-- current 30-day period. Already owned → existing entitlement, no allowance used.
create or replace function public.member_unlock(p_user uuid, p_wallpaper uuid, p_max_downloads int default 5)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_cat     uuid;
  v_parent  uuid;
  m         record;
  v_pstart  timestamptz;
  v_used    int;
  v_licence licence_type;
  v_id      uuid;
begin
  perform pg_advisory_xact_lock(hashtext('member:' || p_user::text));

  select w.category_id, c.parent_id into v_cat, v_parent
  from public.wallpapers w left join public.categories c on c.id = w.category_id
  where w.id = p_wallpaper;

  for m in
    select * from public.memberships
    where user_id = p_user and status = 'active' and starts_at <= now() and ends_at > now()
      and (category_id is null or category_id = v_cat or category_id = v_parent)
    order by (category_id is null), includes_commercial, ends_at asc
  loop
    v_pstart := m.starts_at + make_interval(days => m.period_days * floor(extract(epoch from now() - m.starts_at) / (m.period_days * 86400))::int);
    v_used := case when m.period_start is not distinct from v_pstart then m.period_used else 0 end;
    if v_used >= m.download_limit then continue; end if;

    v_licence := case when m.includes_commercial then 'commercial'::licence_type else 'personal'::licence_type end;
    select id into v_id from public.entitlements
    where user_id = p_user and wallpaper_id = p_wallpaper and (licence = v_licence or licence = 'commercial');
    if v_id is not null then return v_id; end if;

    insert into public.entitlements (user_id, wallpaper_id, licence, max_downloads)
    values (p_user, p_wallpaper, v_licence, p_max_downloads)
    returning id into v_id;

    update public.memberships
    set period_start = v_pstart, period_used = v_used + 1, downloads_used = downloads_used + 1
    where id = m.id;
    return v_id;
  end loop;
  return null;
end;
$$;

-- --- Housekeeping: also expire bonus lots -----------------------------------------
create or replace function public.housekeeping(p_keep_days int default 90)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_cutoff timestamptz := date_trunc('day', now()) - make_interval(days => p_keep_days);
  v_deleted int;
begin
  insert into public.events_daily (day, type, wallpaper_id, region_code, count)
  select created_at::date, type, wallpaper_id, region_code, count(*)::int
  from public.events
  where created_at < v_cutoff
  group by 1, 2, 3, 4
  on conflict (day, type, coalesce(wallpaper_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(region_code, ''))
  do update set count = public.events_daily.count + excluded.count;

  delete from public.events where created_at < v_cutoff;
  get diagnostics v_deleted = row_count;

  delete from public.price_quotes where expires_at < now() - interval '1 day';
  delete from public.rate_hits where at < now() - interval '1 day';

  -- Write off what is left in expired bonus lots (keeps the ledger auditable;
  -- credit_balance already ignores expired lots).
  insert into public.credit_ledger (user_id, delta, reason, ref_id, bucket, lot_id)
  select l.user_id, -x.remaining, 'expire', l.ref_id, 'bonus', l.id
  from public.credit_ledger l
  cross join lateral (
    select (l.delta + coalesce((select sum(c.delta) from public.credit_ledger c where c.lot_id = l.id), 0))::int as remaining
  ) x
  where l.bucket = 'bonus' and l.lot_id is null and l.delta > 0 and l.expires_at <= now() and x.remaining > 0;

  return v_deleted;
end;
$$;

-- --- Permissions --------------------------------------------------------------------
revoke execute on function public.bonus_lots(uuid) from public, anon, authenticated;
revoke execute on function public.credit_balance(uuid) from public, anon, authenticated;
revoke execute on function public.add_pack_credits(uuid, uuid, int, int, int) from public, anon, authenticated;
revoke execute on function public.spend_credits_and_entitle(uuid, uuid, int, licence_type, int) from public, anon, authenticated;
revoke execute on function public.reverse_order_credits(uuid, text) from public, anon, authenticated;
revoke execute on function public.grant_membership(uuid, uuid, uuid, int, uuid) from public, anon, authenticated;
revoke execute on function public.member_unlock(uuid, uuid, int) from public, anon, authenticated;
revoke execute on function public.housekeeping(int) from public, anon, authenticated;
revoke execute on function public.my_credit_balance() from public, anon;
grant execute on function public.my_credit_balance() to authenticated;
grant execute on function public.bonus_lots(uuid) to service_role;
grant execute on function public.credit_balance(uuid) to service_role;
grant execute on function public.add_pack_credits(uuid, uuid, int, int, int) to service_role;
grant execute on function public.spend_credits_and_entitle(uuid, uuid, int, licence_type, int) to service_role;
grant execute on function public.reverse_order_credits(uuid, text) to service_role;
grant execute on function public.grant_membership(uuid, uuid, uuid, int, uuid) to service_role;
grant execute on function public.member_unlock(uuid, uuid, int) to service_role;
grant execute on function public.housekeeping(int) to service_role;

-- --- Starting prices (owner-editable in Admin) --------------------------------------
delete from credit_packs;
insert into credit_packs (name, credits, bonus_credits, badge, sort_order, region_code, country_codes, currency, amount_minor, active) values
  ('Starter', 10, 0, null, 10, 'IN', '{}', 'INR', 9900, true),
  ('Starter', 10, 0, null, 10, 'T1', '{}', 'USD', 399, true),
  ('Starter', 10, 0, null, 10, 'T1', '{GB}', 'GBP', 299, true),
  ('Starter', 10, 0, null, 10, 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 349, true),
  ('Starter', 10, 0, null, 10, 'T1', '{AU}', 'AUD', 599, true),
  ('Starter', 10, 0, null, 10, 'T1', '{CA}', 'CAD', 549, true),
  ('Starter', 10, 0, null, 10, 'T2', '{}', 'USD', 299, true),
  ('Starter', 10, 0, null, 10, 'T3', '{}', 'USD', 199, true),
  ('Starter', 10, 0, null, 10, 'T4', '{}', 'USD', 149, true),
  ('Popular', 30, 5, 'recommended', 20, 'IN', '{}', 'INR', 24900, true),
  ('Popular', 30, 5, 'recommended', 20, 'T1', '{}', 'USD', 999, true),
  ('Popular', 30, 5, 'recommended', 20, 'T1', '{GB}', 'GBP', 799, true),
  ('Popular', 30, 5, 'recommended', 20, 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 899, true),
  ('Popular', 30, 5, 'recommended', 20, 'T1', '{AU}', 'AUD', 1499, true),
  ('Popular', 30, 5, 'recommended', 20, 'T1', '{CA}', 'CAD', 1349, true),
  ('Popular', 30, 5, 'recommended', 20, 'T2', '{}', 'USD', 749, true),
  ('Popular', 30, 5, 'recommended', 20, 'T3', '{}', 'USD', 499, true),
  ('Popular', 30, 5, 'recommended', 20, 'T4', '{}', 'USD', 349, true),
  ('Mega', 100, 25, 'best_value', 30, 'IN', '{}', 'INR', 69900, true),
  ('Mega', 100, 25, 'best_value', 30, 'T1', '{}', 'USD', 2499, true),
  ('Mega', 100, 25, 'best_value', 30, 'T1', '{GB}', 'GBP', 1999, true),
  ('Mega', 100, 25, 'best_value', 30, 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 2299, true),
  ('Mega', 100, 25, 'best_value', 30, 'T1', '{AU}', 'AUD', 3799, true),
  ('Mega', 100, 25, 'best_value', 30, 'T1', '{CA}', 'CAD', 3399, true),
  ('Mega', 100, 25, 'best_value', 30, 'T2', '{}', 'USD', 1899, true),
  ('Mega', 100, 25, 'best_value', 30, 'T3', '{}', 'USD', 1299, true),
  ('Mega', 100, 25, 'best_value', 30, 'T4', '{}', 'USD', 899, true);

delete from membership_plans;
insert into membership_plans (name, description, kind, term_months, duration_days, download_limit, includes_commercial, badge, perks, active, sort_order) values
  ('Lite', 'For trying new looks every month', 'monthly', 1, 30, 20, false, null, array['20 wallpapers every month', 'Every size of each wallpaper', 'Keep what you add, forever'], true, 10),
  ('Plus', 'For people who change wallpapers often', 'monthly', 1, 30, 50, false, 'recommended', array['50 wallpapers every month', 'Every size of each wallpaper', 'Keep what you add, forever'], true, 20),
  ('Pro', 'For collectors and multi-device setups', 'monthly', 1, 30, 150, false, 'best_value', array['150 wallpapers every month', 'Every size of each wallpaper', 'Keep what you add, forever'], true, 30),
  ('Plus · 3 months', '50 wallpapers every month for 3 months', 'contract', 3, 90, 50, false, null, array['50 wallpapers every month', 'Pay once or monthly', 'Keep what you add, forever'], true, 40),
  ('Plus · 6 months', '50 wallpapers every month for 6 months', 'contract', 6, 180, 50, false, 'recommended', array['50 wallpapers every month', 'Pay once or monthly', 'Keep what you add, forever'], true, 50),
  ('Plus · 12 months', '50 wallpapers every month for a year', 'contract', 12, 360, 50, false, 'best_value', array['50 wallpapers every month', 'Pay once or monthly', 'Keep what you add, forever'], true, 60),
  ('Business', 'Commercial licence included — ads, products, client work', 'business', 1, 30, 20, true, 'recommended', array['20 commercial-licence wallpapers every month', 'Use in ads, products and client work', 'Every size of each wallpaper'], true, 70),
  ('Studio', 'For agencies and teams', 'business', 1, 30, 60, true, 'best_value', array['60 commercial-licence wallpapers every month', 'Use in ads, products and client work', 'Every size of each wallpaper'], true, 80);

-- Category passes (only where the category exists; fresh installs get them from seed.sql).
insert into membership_plans (name, description, kind, term_months, duration_days, download_limit, includes_commercial, category_id, perks, active, sort_order)
select v.name, 'Access to one category: 30 wallpapers a month', 'category', 1, 30, 30, false, c.id,
       array['30 wallpapers a month from ' || c.name, 'New drops in this category included', 'Keep what you add, forever'], true, 90
from (values ('devotional', 'Devotional Pass'), ('amoled-minimal', 'AMOLED & Minimal Pass'), ('nature', 'Nature Pass')) v(slug, name) join categories c on c.slug = v.slug;

-- plan_prices: (plan, billing, tier, countries, currency, amount). prepaid = whole term; autopay = per month.
insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor)
select p.id, v.billing, v.region, v.cc::text[], v.cur, v.amt from (values
  ('Lite', 'prepaid', 'IN', '{}', 'INR', 14900),
  ('Lite', 'prepaid', 'T1', '{}', 'USD', 499),
  ('Lite', 'prepaid', 'T1', '{GB}', 'GBP', 399),
  ('Lite', 'prepaid', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 449),
  ('Lite', 'prepaid', 'T1', '{AU}', 'AUD', 799),
  ('Lite', 'prepaid', 'T1', '{CA}', 'CAD', 699),
  ('Lite', 'prepaid', 'T2', '{}', 'USD', 399),
  ('Lite', 'prepaid', 'T3', '{}', 'USD', 299),
  ('Lite', 'prepaid', 'T4', '{}', 'USD', 199),
  ('Lite', 'autopay', 'IN', '{}', 'INR', 14900),
  ('Lite', 'autopay', 'T1', '{}', 'USD', 499),
  ('Lite', 'autopay', 'T1', '{GB}', 'GBP', 399),
  ('Lite', 'autopay', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 449),
  ('Lite', 'autopay', 'T1', '{AU}', 'AUD', 799),
  ('Lite', 'autopay', 'T1', '{CA}', 'CAD', 699),
  ('Lite', 'autopay', 'T2', '{}', 'USD', 399),
  ('Lite', 'autopay', 'T3', '{}', 'USD', 299),
  ('Lite', 'autopay', 'T4', '{}', 'USD', 199),
  ('Plus', 'prepaid', 'IN', '{}', 'INR', 29900),
  ('Plus', 'prepaid', 'T1', '{}', 'USD', 999),
  ('Plus', 'prepaid', 'T1', '{GB}', 'GBP', 799),
  ('Plus', 'prepaid', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 899),
  ('Plus', 'prepaid', 'T1', '{AU}', 'AUD', 1599),
  ('Plus', 'prepaid', 'T1', '{CA}', 'CAD', 1399),
  ('Plus', 'prepaid', 'T2', '{}', 'USD', 799),
  ('Plus', 'prepaid', 'T3', '{}', 'USD', 599),
  ('Plus', 'prepaid', 'T4', '{}', 'USD', 399),
  ('Plus', 'autopay', 'IN', '{}', 'INR', 29900),
  ('Plus', 'autopay', 'T1', '{}', 'USD', 999),
  ('Plus', 'autopay', 'T1', '{GB}', 'GBP', 799),
  ('Plus', 'autopay', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 899),
  ('Plus', 'autopay', 'T1', '{AU}', 'AUD', 1599),
  ('Plus', 'autopay', 'T1', '{CA}', 'CAD', 1399),
  ('Plus', 'autopay', 'T2', '{}', 'USD', 799),
  ('Plus', 'autopay', 'T3', '{}', 'USD', 599),
  ('Plus', 'autopay', 'T4', '{}', 'USD', 399),
  ('Pro', 'prepaid', 'IN', '{}', 'INR', 69900),
  ('Pro', 'prepaid', 'T1', '{}', 'USD', 1999),
  ('Pro', 'prepaid', 'T1', '{GB}', 'GBP', 1599),
  ('Pro', 'prepaid', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 1799),
  ('Pro', 'prepaid', 'T1', '{AU}', 'AUD', 2999),
  ('Pro', 'prepaid', 'T1', '{CA}', 'CAD', 2699),
  ('Pro', 'prepaid', 'T2', '{}', 'USD', 1599),
  ('Pro', 'prepaid', 'T3', '{}', 'USD', 1199),
  ('Pro', 'prepaid', 'T4', '{}', 'USD', 899),
  ('Pro', 'autopay', 'IN', '{}', 'INR', 69900),
  ('Pro', 'autopay', 'T1', '{}', 'USD', 1999),
  ('Pro', 'autopay', 'T1', '{GB}', 'GBP', 1599),
  ('Pro', 'autopay', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 1799),
  ('Pro', 'autopay', 'T1', '{AU}', 'AUD', 2999),
  ('Pro', 'autopay', 'T1', '{CA}', 'CAD', 2699),
  ('Pro', 'autopay', 'T2', '{}', 'USD', 1599),
  ('Pro', 'autopay', 'T3', '{}', 'USD', 1199),
  ('Pro', 'autopay', 'T4', '{}', 'USD', 899),
  ('Plus · 3 months', 'prepaid', 'IN', '{}', 'INR', 79900),
  ('Plus · 3 months', 'prepaid', 'T1', '{}', 'USD', 2699),
  ('Plus · 3 months', 'prepaid', 'T1', '{GB}', 'GBP', 2149),
  ('Plus · 3 months', 'prepaid', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 2449),
  ('Plus · 3 months', 'prepaid', 'T1', '{AU}', 'AUD', 4299),
  ('Plus · 3 months', 'prepaid', 'T1', '{CA}', 'CAD', 3799),
  ('Plus · 3 months', 'prepaid', 'T2', '{}', 'USD', 2149),
  ('Plus · 3 months', 'prepaid', 'T3', '{}', 'USD', 1599),
  ('Plus · 3 months', 'prepaid', 'T4', '{}', 'USD', 1079),
  ('Plus · 3 months', 'autopay', 'IN', '{}', 'INR', 27900),
  ('Plus · 3 months', 'autopay', 'T1', '{}', 'USD', 949),
  ('Plus · 3 months', 'autopay', 'T1', '{GB}', 'GBP', 759),
  ('Plus · 3 months', 'autopay', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 849),
  ('Plus · 3 months', 'autopay', 'T1', '{AU}', 'AUD', 1519),
  ('Plus · 3 months', 'autopay', 'T1', '{CA}', 'CAD', 1329),
  ('Plus · 3 months', 'autopay', 'T2', '{}', 'USD', 759),
  ('Plus · 3 months', 'autopay', 'T3', '{}', 'USD', 569),
  ('Plus · 3 months', 'autopay', 'T4', '{}', 'USD', 379),
  ('Plus · 6 months', 'prepaid', 'IN', '{}', 'INR', 144900),
  ('Plus · 6 months', 'prepaid', 'T1', '{}', 'USD', 4799),
  ('Plus · 6 months', 'prepaid', 'T1', '{GB}', 'GBP', 3849),
  ('Plus · 6 months', 'prepaid', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 4299),
  ('Plus · 6 months', 'prepaid', 'T1', '{AU}', 'AUD', 7699),
  ('Plus · 6 months', 'prepaid', 'T1', '{CA}', 'CAD', 6699),
  ('Plus · 6 months', 'prepaid', 'T2', '{}', 'USD', 3849),
  ('Plus · 6 months', 'prepaid', 'T3', '{}', 'USD', 2899),
  ('Plus · 6 months', 'prepaid', 'T4', '{}', 'USD', 1919),
  ('Plus · 6 months', 'autopay', 'IN', '{}', 'INR', 25900),
  ('Plus · 6 months', 'autopay', 'T1', '{}', 'USD', 899),
  ('Plus · 6 months', 'autopay', 'T1', '{GB}', 'GBP', 719),
  ('Plus · 6 months', 'autopay', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 799),
  ('Plus · 6 months', 'autopay', 'T1', '{AU}', 'AUD', 1439),
  ('Plus · 6 months', 'autopay', 'T1', '{CA}', 'CAD', 1259),
  ('Plus · 6 months', 'autopay', 'T2', '{}', 'USD', 719),
  ('Plus · 6 months', 'autopay', 'T3', '{}', 'USD', 539),
  ('Plus · 6 months', 'autopay', 'T4', '{}', 'USD', 359),
  ('Plus · 12 months', 'prepaid', 'IN', '{}', 'INR', 239900),
  ('Plus · 12 months', 'prepaid', 'T1', '{}', 'USD', 7999),
  ('Plus · 12 months', 'prepaid', 'T1', '{GB}', 'GBP', 6399),
  ('Plus · 12 months', 'prepaid', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 7199),
  ('Plus · 12 months', 'prepaid', 'T1', '{AU}', 'AUD', 12799),
  ('Plus · 12 months', 'prepaid', 'T1', '{CA}', 'CAD', 11199),
  ('Plus · 12 months', 'prepaid', 'T2', '{}', 'USD', 6399),
  ('Plus · 12 months', 'prepaid', 'T3', '{}', 'USD', 4799),
  ('Plus · 12 months', 'prepaid', 'T4', '{}', 'USD', 3199),
  ('Plus · 12 months', 'autopay', 'IN', '{}', 'INR', 23900),
  ('Plus · 12 months', 'autopay', 'T1', '{}', 'USD', 849),
  ('Plus · 12 months', 'autopay', 'T1', '{GB}', 'GBP', 679),
  ('Plus · 12 months', 'autopay', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 759),
  ('Plus · 12 months', 'autopay', 'T1', '{AU}', 'AUD', 1359),
  ('Plus · 12 months', 'autopay', 'T1', '{CA}', 'CAD', 1189),
  ('Plus · 12 months', 'autopay', 'T2', '{}', 'USD', 679),
  ('Plus · 12 months', 'autopay', 'T3', '{}', 'USD', 509),
  ('Plus · 12 months', 'autopay', 'T4', '{}', 'USD', 339),
  ('Business', 'prepaid', 'IN', '{}', 'INR', 79900),
  ('Business', 'prepaid', 'T1', '{}', 'USD', 1999),
  ('Business', 'prepaid', 'T1', '{GB}', 'GBP', 1599),
  ('Business', 'prepaid', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 1799),
  ('Business', 'prepaid', 'T1', '{AU}', 'AUD', 2999),
  ('Business', 'prepaid', 'T1', '{CA}', 'CAD', 2699),
  ('Business', 'prepaid', 'T2', '{}', 'USD', 1599),
  ('Business', 'prepaid', 'T3', '{}', 'USD', 1199),
  ('Business', 'prepaid', 'T4', '{}', 'USD', 999),
  ('Business', 'autopay', 'IN', '{}', 'INR', 79900),
  ('Business', 'autopay', 'T1', '{}', 'USD', 1999),
  ('Business', 'autopay', 'T1', '{GB}', 'GBP', 1599),
  ('Business', 'autopay', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 1799),
  ('Business', 'autopay', 'T1', '{AU}', 'AUD', 2999),
  ('Business', 'autopay', 'T1', '{CA}', 'CAD', 2699),
  ('Business', 'autopay', 'T2', '{}', 'USD', 1599),
  ('Business', 'autopay', 'T3', '{}', 'USD', 1199),
  ('Business', 'autopay', 'T4', '{}', 'USD', 999),
  ('Studio', 'prepaid', 'IN', '{}', 'INR', 199900),
  ('Studio', 'prepaid', 'T1', '{}', 'USD', 4999),
  ('Studio', 'prepaid', 'T1', '{GB}', 'GBP', 3999),
  ('Studio', 'prepaid', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 4499),
  ('Studio', 'prepaid', 'T1', '{AU}', 'AUD', 7499),
  ('Studio', 'prepaid', 'T1', '{CA}', 'CAD', 6799),
  ('Studio', 'prepaid', 'T2', '{}', 'USD', 3999),
  ('Studio', 'prepaid', 'T3', '{}', 'USD', 2999),
  ('Studio', 'prepaid', 'T4', '{}', 'USD', 2499),
  ('Studio', 'autopay', 'IN', '{}', 'INR', 199900),
  ('Studio', 'autopay', 'T1', '{}', 'USD', 4999),
  ('Studio', 'autopay', 'T1', '{GB}', 'GBP', 3999),
  ('Studio', 'autopay', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 4499),
  ('Studio', 'autopay', 'T1', '{AU}', 'AUD', 7499),
  ('Studio', 'autopay', 'T1', '{CA}', 'CAD', 6799),
  ('Studio', 'autopay', 'T2', '{}', 'USD', 3999),
  ('Studio', 'autopay', 'T3', '{}', 'USD', 2999),
  ('Studio', 'autopay', 'T4', '{}', 'USD', 2499),
  ('Devotional Pass', 'prepaid', 'IN', '{}', 'INR', 9900),
  ('Devotional Pass', 'prepaid', 'T1', '{}', 'USD', 299),
  ('Devotional Pass', 'prepaid', 'T1', '{GB}', 'GBP', 249),
  ('Devotional Pass', 'prepaid', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 279),
  ('Devotional Pass', 'prepaid', 'T1', '{AU}', 'AUD', 449),
  ('Devotional Pass', 'prepaid', 'T1', '{CA}', 'CAD', 399),
  ('Devotional Pass', 'prepaid', 'T2', '{}', 'USD', 249),
  ('Devotional Pass', 'prepaid', 'T3', '{}', 'USD', 199),
  ('Devotional Pass', 'prepaid', 'T4', '{}', 'USD', 149),
  ('Devotional Pass', 'autopay', 'IN', '{}', 'INR', 9900),
  ('Devotional Pass', 'autopay', 'T1', '{}', 'USD', 299),
  ('Devotional Pass', 'autopay', 'T1', '{GB}', 'GBP', 249),
  ('Devotional Pass', 'autopay', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 279),
  ('Devotional Pass', 'autopay', 'T1', '{AU}', 'AUD', 449),
  ('Devotional Pass', 'autopay', 'T1', '{CA}', 'CAD', 399),
  ('Devotional Pass', 'autopay', 'T2', '{}', 'USD', 249),
  ('Devotional Pass', 'autopay', 'T3', '{}', 'USD', 199),
  ('Devotional Pass', 'autopay', 'T4', '{}', 'USD', 149),
  ('AMOLED & Minimal Pass', 'prepaid', 'IN', '{}', 'INR', 9900),
  ('AMOLED & Minimal Pass', 'prepaid', 'T1', '{}', 'USD', 299),
  ('AMOLED & Minimal Pass', 'prepaid', 'T1', '{GB}', 'GBP', 249),
  ('AMOLED & Minimal Pass', 'prepaid', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 279),
  ('AMOLED & Minimal Pass', 'prepaid', 'T1', '{AU}', 'AUD', 449),
  ('AMOLED & Minimal Pass', 'prepaid', 'T1', '{CA}', 'CAD', 399),
  ('AMOLED & Minimal Pass', 'prepaid', 'T2', '{}', 'USD', 249),
  ('AMOLED & Minimal Pass', 'prepaid', 'T3', '{}', 'USD', 199),
  ('AMOLED & Minimal Pass', 'prepaid', 'T4', '{}', 'USD', 149),
  ('AMOLED & Minimal Pass', 'autopay', 'IN', '{}', 'INR', 9900),
  ('AMOLED & Minimal Pass', 'autopay', 'T1', '{}', 'USD', 299),
  ('AMOLED & Minimal Pass', 'autopay', 'T1', '{GB}', 'GBP', 249),
  ('AMOLED & Minimal Pass', 'autopay', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 279),
  ('AMOLED & Minimal Pass', 'autopay', 'T1', '{AU}', 'AUD', 449),
  ('AMOLED & Minimal Pass', 'autopay', 'T1', '{CA}', 'CAD', 399),
  ('AMOLED & Minimal Pass', 'autopay', 'T2', '{}', 'USD', 249),
  ('AMOLED & Minimal Pass', 'autopay', 'T3', '{}', 'USD', 199),
  ('AMOLED & Minimal Pass', 'autopay', 'T4', '{}', 'USD', 149),
  ('Nature Pass', 'prepaid', 'IN', '{}', 'INR', 9900),
  ('Nature Pass', 'prepaid', 'T1', '{}', 'USD', 299),
  ('Nature Pass', 'prepaid', 'T1', '{GB}', 'GBP', 249),
  ('Nature Pass', 'prepaid', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 279),
  ('Nature Pass', 'prepaid', 'T1', '{AU}', 'AUD', 449),
  ('Nature Pass', 'prepaid', 'T1', '{CA}', 'CAD', 399),
  ('Nature Pass', 'prepaid', 'T2', '{}', 'USD', 249),
  ('Nature Pass', 'prepaid', 'T3', '{}', 'USD', 199),
  ('Nature Pass', 'prepaid', 'T4', '{}', 'USD', 149),
  ('Nature Pass', 'autopay', 'IN', '{}', 'INR', 9900),
  ('Nature Pass', 'autopay', 'T1', '{}', 'USD', 299),
  ('Nature Pass', 'autopay', 'T1', '{GB}', 'GBP', 249),
  ('Nature Pass', 'autopay', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 279),
  ('Nature Pass', 'autopay', 'T1', '{AU}', 'AUD', 449),
  ('Nature Pass', 'autopay', 'T1', '{CA}', 'CAD', 399),
  ('Nature Pass', 'autopay', 'T2', '{}', 'USD', 249),
  ('Nature Pass', 'autopay', 'T3', '{}', 'USD', 199),
  ('Nature Pass', 'autopay', 'T4', '{}', 'USD', 149)
) v(name, billing, region, cc, cur, amt) join membership_plans p on p.name = v.name;
