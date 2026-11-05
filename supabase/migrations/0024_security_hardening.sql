-- =============================================================================
-- HirecWallp — security hardening from the 2026-11-05 audit (docs/SECURITY_AUDIT.md)
-- * API roles never need TRUNCATE / TRIGGER / REFERENCES on app tables.
--   TRUNCATE bypasses RLS, so remove it outright (defence in depth; PostgREST
--   doesn't expose it, but a future RPC or leaked key could).
-- * site_settings: the public can read only the keys the storefront needs;
--   tax details (TAN, filings) and admin-only knobs are server-side only.
-- =============================================================================

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;

alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;

drop policy if exists "site_settings: public read" on site_settings;
create policy "site_settings: public read" on site_settings for select
  using (key not in ('tax', 'fx_meta', 'country_tiers', 'creator_credit_value_inr'));
