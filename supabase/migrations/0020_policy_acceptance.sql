-- =============================================================================
-- HirecWallp — policy acceptance records + retention (2026-11-03)
-- * policy_acceptances: which version of which policy a user accepted, when
--   (DPDP consent records; Terms/Privacy on first sign-in, Refund policy at checkout).
-- * housekeeping(): strips hashed IPs / user agents from download logs older
--   than 12 months, as the Privacy Policy states (watermark tracing kept).
-- =============================================================================

create table if not exists policy_acceptances (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  policy      text not null check (policy in ('terms', 'privacy', 'refunds', 'delivery', 'licence', 'creator')),
  version     text not null,
  context     text not null check (context in ('signup', 'checkout', 'creator_onboarding', 'update')),
  ip_hash     text,
  accepted_at timestamptz not null default now(),
  unique (user_id, policy, version)
);
create index if not exists policy_acceptances_user_idx on policy_acceptances (user_id, accepted_at desc);
alter table policy_acceptances enable row level security;
create policy "policy_acceptances: read own" on policy_acceptances for select using (user_id = (select auth.uid()));
create policy "policy_acceptances: admin read" on policy_acceptances for select using ((select public.is_admin()));

create index if not exists downloads_created_idx on downloads (created_at);

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
  -- Privacy policy: personal parts of download logs (hashed IP, browser) are
  -- kept 12 months. The row and its watermark reference stay so leaked files
  -- can still be traced to an order.
  update public.downloads set ip_hash = null, user_agent = null
  where created_at < now() - interval '12 months' and (ip_hash is not null or user_agent is not null);

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
