-- =============================================================================
-- HirecWallp — security hardening (pre-launch, required before real payments)
--
-- 1. Payment/credit/download functions are SECURITY DEFINER and live in the
--    exposed `public` schema, so by default anon/authenticated can call them
--    through PostgREST (`supabase.rpc(...)`) with the public anon key. That
--    would let anyone mint entitlements or credits, bypassing the rule that
--    entitlements come ONLY from verified payment webhooks. Restrict them to
--    the service role (server-side code only).
-- 2. The "profiles: update own" policy filters rows but not columns, so a user
--    could PATCH their own `role` to 'admin'. Limit client updates to safe
--    columns via column-level privileges.
-- =============================================================================

-- --- 1. Lock down privileged functions --------------------------------------
revoke execute on function public.grant_entitlement(uuid, uuid, uuid, licence_type, integer) from public, anon, authenticated;
revoke execute on function public.add_credits(uuid, integer, uuid) from public, anon, authenticated;
revoke execute on function public.spend_credits_and_entitle(uuid, uuid, integer, licence_type, integer) from public, anon, authenticated;
revoke execute on function public.claim_entitlement_download(uuid) from public, anon, authenticated;
revoke execute on function public.downloads_last_hour_user(uuid) from public, anon, authenticated;
revoke execute on function public.downloads_last_hour_ip(text) from public, anon, authenticated;
revoke execute on function public.credit_balance(uuid) from public, anon, authenticated;

grant execute on function public.grant_entitlement(uuid, uuid, uuid, licence_type, integer) to service_role;
grant execute on function public.add_credits(uuid, integer, uuid) to service_role;
grant execute on function public.spend_credits_and_entitle(uuid, uuid, integer, licence_type, integer) to service_role;
grant execute on function public.claim_entitlement_download(uuid) to service_role;
grant execute on function public.downloads_last_hour_user(uuid) to service_role;
grant execute on function public.downloads_last_hour_ip(text) to service_role;
grant execute on function public.credit_balance(uuid) to service_role;

-- Safe self-service balance: only ever returns the caller's own balance.
create or replace function public.my_credit_balance()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(delta), 0)::int
  from public.credit_ledger
  where user_id = auth.uid();
$$;

revoke execute on function public.my_credit_balance() from public, anon;
grant execute on function public.my_credit_balance() to authenticated, service_role;

-- is_admin() / is_creator() stay executable: RLS policies evaluate them as the
-- querying role, and they only reveal the caller's own status (auth.uid()).

-- --- 2. Profiles: no self-service role changes -------------------------------
revoke insert, update, delete on table public.profiles from anon, authenticated;
grant update (display_name, country_code, gstin) on table public.profiles to authenticated;

-- Trigger-only function; never callable over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
