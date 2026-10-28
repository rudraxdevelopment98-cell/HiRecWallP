-- =============================================================================
-- HirecWallp — Phase 3 (Creator Marketplace) schema
--
-- Creator onboarding + payouts. Creators submit wallpapers (status
-- pending_review, creator_id set) which admins approve via the existing publish
-- flow. Commission default 30%; monthly payouts via Razorpay Route (India) /
-- PayPal Payouts (international). Adapters are mock until keys are set.
--
-- Note: creator marketplace operators may have TDS/TCS obligations in India —
-- flagged for CA review. Keep commission/tax configurable.
-- =============================================================================

create type payout_provider as enum ('razorpay_route', 'paypal_payouts');
create type kyc_status      as enum ('none', 'pending', 'verified', 'rejected');
create type payout_status   as enum ('pending', 'processing', 'paid', 'failed');

create table creators (
  user_id              uuid primary key references profiles(id) on delete cascade,
  display_name         text,
  payout_provider      payout_provider,
  payout_account_id    text,
  kyc_status           kyc_status not null default 'none',
  commission_pct       numeric not null default 30,
  agreement_accepted_at timestamptz,
  created_at           timestamptz not null default now()
);

create table creator_payouts (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references creators(user_id) on delete cascade,
  period      text not null,                 -- 'YYYY-MM'
  gross       numeric not null default 0,
  commission  numeric not null default 0,
  net         numeric not null default 0,
  currency    text not null default 'INR',
  status      payout_status not null default 'pending',
  provider_ref text,
  created_at  timestamptz not null default now(),
  unique (creator_id, period)
);
create index creator_payouts_creator_idx on creator_payouts (creator_id, period desc);

-- --- RLS --------------------------------------------------------------------
alter table creators        enable row level security;
alter table creator_payouts enable row level security;

-- Creators read their own row; admins read all. Writes go through the service
-- role from verified server routes (onboarding, KYC callbacks, payout jobs).
create policy "creators: read own" on creators
  for select using (user_id = auth.uid());
create policy "creators: admin read" on creators
  for select using (public.is_admin());

create policy "creator_payouts: read own" on creator_payouts
  for select using (creator_id = auth.uid());
create policy "creator_payouts: admin read" on creator_payouts
  for select using (public.is_admin());

-- Helper: is the current user an approved (KYC-verified) creator?
create or replace function public.is_creator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.creators where user_id = auth.uid());
$$;
