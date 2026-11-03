-- =============================================================================
-- HirecWallp — price lock + referrals / welcome bonus (2026-11-03)
--
-- Price lock (how Netflix/Spotify/Steam/Epic stop "pick a cheaper country"):
--   profiles.price_country is set from the first paid order and never moves
--   down on its own; later purchases are priced at the highest tier of
--   {locked country, IP country, browser time-zone country, billing country}.
--   Only an admin can change it (customer moved). Not client-writable.
--
-- Welcome bonus + referrals (growth):
--   * every new account gets N free BONUS credits (expire after D days);
--   * signing up with a friend's code adds extra bonus credits;
--   * the friend (referrer) earns credits only when the new person makes
--     their FIRST PAID purchase (fake accounts never pay), capped per month;
--   * at most 2 welcome bonuses per network (hashed IP) per 30 days.
--   Refunding that first purchase also takes the referrer's reward back
--   (reverse_order_credits handles lots keyed to the order).
-- =============================================================================

alter table profiles
  add column if not exists price_country    text check (price_country ~ '^[A-Z]{2}$'),
  add column if not exists price_locked_at  timestamptz,
  add column if not exists referral_code    text unique check (referral_code ~ '^[A-Z0-9]{6,12}$'),
  add column if not exists referred_by      uuid references profiles(id) on delete set null,
  add column if not exists welcome_bonus_at timestamptz,
  add column if not exists signup_ip_hash   text;
create index if not exists profiles_referred_by_idx on profiles (referred_by) where referred_by is not null;
create index if not exists profiles_signup_ip_idx on profiles (signup_ip_hash, welcome_bonus_at) where signup_ip_hash is not null;
-- (Client column grants from 0007 stay display_name, country_code, gstin only.)

alter type credit_reason add value if not exists 'welcome';
alter type credit_reason add value if not exists 'referral';

create table if not exists referral_rewards (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid not null references profiles(id) on delete cascade,
  referee_id   uuid not null unique references profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'rewarded', 'capped', 'void')),
  order_id     uuid references orders(id) on delete set null,
  credits      int,
  created_at   timestamptz not null default now(),
  rewarded_at  timestamptz
);
create index if not exists referral_rewards_referrer_idx on referral_rewards (referrer_id, rewarded_at desc);
create index if not exists referral_rewards_order_idx on referral_rewards (order_id) where order_id is not null;
alter table referral_rewards enable row level security;
create policy "referral_rewards: read own" on referral_rewards for select
  using (referrer_id = (select auth.uid()) or referee_id = (select auth.uid()));
create policy "referral_rewards: admin read" on referral_rewards for select using ((select public.is_admin()));

-- Unambiguous code alphabet (no 0/O/1/I).
create or replace function public.new_referral_code()
returns text
language plpgsql volatile set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v text;
begin
  loop
    v := '';
    for i in 1..7 loop
      v := v || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where referral_code = v);
  end loop;
  return v;
end;
$$;

-- The user's referral code (created on first ask).
create or replace function public.ensure_referral_code(p_user uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare v text;
begin
  select referral_code into v from public.profiles where id = p_user;
  if v is null then
    v := public.new_referral_code();
    update public.profiles set referral_code = v where id = p_user and referral_code is null;
    select referral_code into v from public.profiles where id = p_user;
  end if;
  return v;
end;
$$;

-- Welcome bonus, once per account. A referral code only attaches to accounts
-- younger than 7 days with no paid orders, and never to yourself or to
-- someone on the same network. Returns what happened.
create or replace function public.claim_welcome_bonus(
  p_user uuid, p_ref_code text, p_ip_hash text,
  p_bonus int, p_ref_bonus int, p_days int, p_per_ip int default 2
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles%rowtype;
  v_referrer uuid;
  v_total int;
  v_same_ip int;
begin
  perform pg_advisory_xact_lock(hashtext('welcome:' || p_user::text));
  select * into me from public.profiles where id = p_user;
  if not found then return jsonb_build_object('status', 'no_profile'); end if;
  if me.welcome_bonus_at is not null then return jsonb_build_object('status', 'already'); end if;

  if p_ip_hash is not null then
    select count(*) into v_same_ip from public.profiles
    where signup_ip_hash = p_ip_hash and welcome_bonus_at > now() - interval '30 days' and id <> p_user;
    if v_same_ip >= p_per_ip then
      update public.profiles set welcome_bonus_at = now(), signup_ip_hash = p_ip_hash where id = p_user;
      return jsonb_build_object('status', 'limited');
    end if;
  end if;

  if p_ref_code is not null and length(p_ref_code) between 6 and 12
     and me.created_at > now() - interval '7 days'
     and not exists (select 1 from public.orders where user_id = p_user and status = 'paid') then
    select id into v_referrer from public.profiles
    where referral_code = upper(p_ref_code) and id <> p_user
      and (p_ip_hash is null or signup_ip_hash is distinct from p_ip_hash);
  end if;

  v_total := greatest(coalesce(p_bonus, 0), 0) + case when v_referrer is not null then greatest(coalesce(p_ref_bonus, 0), 0) else 0 end;
  if v_total > 0 then
    insert into public.credit_ledger (user_id, delta, reason, bucket, expires_at)
    values (p_user, v_total, 'welcome', 'bonus', now() + make_interval(days => greatest(p_days, 1)));
  end if;

  update public.profiles
  set welcome_bonus_at = now(), signup_ip_hash = coalesce(p_ip_hash, signup_ip_hash), referred_by = coalesce(referred_by, v_referrer)
  where id = p_user;
  if v_referrer is not null then
    insert into public.referral_rewards (referrer_id, referee_id) values (v_referrer, p_user) on conflict (referee_id) do nothing;
  end if;
  return jsonb_build_object('status', 'granted', 'credits', v_total, 'referred', v_referrer is not null);
end;
$$;

-- After a verified paid order: lock the buyer's price country (first time
-- only) and pay any pending referral reward to whoever referred them.
create or replace function public.after_paid_order(
  p_order uuid, p_country text, p_reward int, p_monthly_cap int, p_days int
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  o public.orders%rowtype;
  r public.referral_rewards%rowtype;
  v_recent int;
begin
  select * into o from public.orders where id = p_order and status = 'paid';
  if not found then return jsonb_build_object('status', 'not_paid'); end if;

  if p_country ~ '^[A-Z]{2}$' then
    update public.profiles set price_country = p_country, price_locked_at = now()
    where id = o.user_id and price_country is null;
  end if;

  select * into r from public.referral_rewards where referee_id = o.user_id and status = 'pending' for update;
  if not found then return jsonb_build_object('status', 'ok'); end if;

  select count(*) into v_recent from public.referral_rewards
  where referrer_id = r.referrer_id and status = 'rewarded' and rewarded_at > now() - interval '30 days';
  if v_recent >= p_monthly_cap then
    update public.referral_rewards set status = 'capped', order_id = p_order where id = r.id;
    return jsonb_build_object('status', 'capped');
  end if;

  -- Keyed to the referee's order so refunding it also takes this back.
  insert into public.credit_ledger (user_id, delta, reason, ref_id, bucket, expires_at)
  values (r.referrer_id, p_reward, 'bonus', p_order, 'bonus', now() + make_interval(days => greatest(p_days, 1)));
  update public.referral_rewards set status = 'rewarded', order_id = p_order, credits = p_reward, rewarded_at = now() where id = r.id;
  return jsonb_build_object('status', 'rewarded', 'referrer', r.referrer_id);
end;
$$;

revoke execute on function public.new_referral_code() from public, anon, authenticated;
revoke execute on function public.ensure_referral_code(uuid) from public, anon, authenticated;
revoke execute on function public.claim_welcome_bonus(uuid, text, text, int, int, int, int) from public, anon, authenticated;
revoke execute on function public.after_paid_order(uuid, text, int, int, int) from public, anon, authenticated;
grant execute on function public.new_referral_code() to service_role;
grant execute on function public.ensure_referral_code(uuid) to service_role;
grant execute on function public.claim_welcome_bonus(uuid, text, text, int, int, int, int) to service_role;
grant execute on function public.after_paid_order(uuid, text, int, int, int) to service_role;
