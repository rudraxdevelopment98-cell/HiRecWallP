-- =============================================================================
-- HirecWallp — Phase 1 payment/credit functions
--
-- All are security definer and intended to be called by the server with the
-- service role from VERIFIED webhook handlers / server actions. They are
-- idempotent / double-spend-safe so a replayed webhook or a double click can
-- never grant twice or charge twice.
-- =============================================================================

-- Grant a wallpaper entitlement (idempotent on user+wallpaper+licence).
-- Returns the entitlement id (existing or newly created).
create or replace function public.grant_entitlement(
  p_user       uuid,
  p_wallpaper  uuid,
  p_order      uuid,
  p_licence    licence_type default 'personal',
  p_max_downloads int default 5
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.entitlements (user_id, wallpaper_id, order_id, licence, max_downloads)
  values (p_user, p_wallpaper, p_order, p_licence, p_max_downloads)
  on conflict (user_id, wallpaper_id, licence) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.entitlements
    where user_id = p_user and wallpaper_id = p_wallpaper and licence = p_licence;
  end if;

  return v_id;
end;
$$;

-- Add purchased credits for an order (idempotent per order).
create or replace function public.add_credits(
  p_user    uuid,
  p_credits int,
  p_order   uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.credit_ledger (user_id, delta, reason, ref_id)
  select p_user, p_credits, 'purchase', p_order
  where not exists (
    select 1 from public.credit_ledger
    where ref_id = p_order and reason = 'purchase'
  );
end;
$$;

-- Spend credits to unlock a wallpaper, atomically. Serialized per-user via an
-- advisory lock so concurrent calls cannot overspend.
-- Returns the entitlement id, or NULL if the balance is insufficient.
-- If the user already owns the wallpaper, returns it WITHOUT charging again.
create or replace function public.spend_credits_and_entitle(
  p_user      uuid,
  p_wallpaper uuid,
  p_cost      int,
  p_licence   licence_type default 'personal',
  p_max_downloads int default 5
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_balance  int;
  v_id       uuid;
begin
  if p_cost < 0 then
    raise exception 'cost must be non-negative';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user::text));

  select id into v_existing
  from public.entitlements
  where user_id = p_user and wallpaper_id = p_wallpaper and licence = p_licence;
  if v_existing is not null then
    return v_existing;  -- already owned; do not charge
  end if;

  select coalesce(sum(delta), 0)::int into v_balance
  from public.credit_ledger
  where user_id = p_user;

  if v_balance < p_cost then
    return null;  -- insufficient credits
  end if;

  insert into public.entitlements (user_id, wallpaper_id, licence, max_downloads)
  values (p_user, p_wallpaper, p_licence, p_max_downloads)
  returning id into v_id;

  if p_cost > 0 then
    insert into public.credit_ledger (user_id, delta, reason, ref_id)
    values (p_user, -p_cost, 'spend', v_id);
  end if;

  return v_id;
end;
$$;

-- Count a user's downloads in the last hour (rate-limit helper).
create or replace function public.downloads_last_hour_user(p_user uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.downloads
  where user_id = p_user and created_at > now() - interval '1 hour';
$$;

-- Count downloads from an IP hash in the last hour (rate-limit helper).
create or replace function public.downloads_last_hour_ip(p_ip_hash text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.downloads
  where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
$$;
