-- =============================================================================
-- HirecWallp — Phase 1 seed data
-- Regions, global price rules, credit packs and launch categories.
-- Idempotent: safe to re-run (ON CONFLICT DO NOTHING / upserts).
--
-- UNIT CONVENTION (flagged for owner confirmation):
--   * `regions.pricing_unit = 'money'` (IN): price_rules / prices store the
--     DISPLAY price in RUPEES (so snap points read 9/19/29...). Conversion to
--     minor units (paise ×100) happens at the payment boundary into
--     orders.amount_minor.
--   * `regions.pricing_unit = 'credits'` (T1..T3): values are whole credits.
-- Sample wallpapers (20) are loaded via the admin upload flow / seed script
-- once asset storage is wired, not here (they need real image assets).
-- =============================================================================

-- --- Regions ----------------------------------------------------------------
insert into regions (code, name, currency, pricing_unit, country_codes) values
  ('IN', 'India',              'INR', 'money',   array['IN']),
  ('T1', 'Tier 1 (UK/US/EU/CA/AU)', 'USD', 'credits', array['GB','US','EU','CA','AU','IE','FR','DE','ES','IT','NL']),
  ('T2', 'Tier 2 (Middle East / East Asia)', 'USD', 'credits', array['AE','SA','QA','KW','JP','KR','SG','HK']),
  ('T3', 'Tier 3 (Rest of world)', 'USD', 'credits', array[]::text[])
on conflict (code) do update
  set name = excluded.name,
      currency = excluded.currency,
      pricing_unit = excluded.pricing_unit,
      country_codes = excluded.country_codes;

-- --- Global price rules (scope = global, scope_id = null) --------------------
-- One rule per region. Most specific rule wins at pricing time:
-- wallpaper > category > global.
insert into price_rules
  (scope, scope_id, region_code, min_price, max_price, base_price, snap_points, max_step_pct, cooldown_hours, launch_price, launch_hours, frozen)
values
  ('global', null, 'IN', 9, 99, 19, array[9,19,29,49,79,99]::numeric[], 50, 24, 9, 72, false),
  ('global', null, 'T1', 1, 5,  2,  array[1,2,3,4,5]::numeric[],         50, 24, 1, 72, false),
  ('global', null, 'T2', 1, 4,  2,  array[1,2,3,4]::numeric[],           50, 24, 1, 72, false),
  ('global', null, 'T3', 1, 3,  1,  array[1,2,3]::numeric[],             50, 24, 1, 72, false)
on conflict do nothing;

-- --- Credit packs ------------------------------------------------------------
-- T1 offered in GBP/USD/EUR; T2/T3 default to USD. amount_minor is in the
-- currency's minor unit (pence/cents). Owner can edit in admin.
insert into credit_packs (region_code, currency, amount_minor, credits, active) values
  -- T1 — GBP
  ('T1', 'GBP',  299, 10, true),
  ('T1', 'GBP',  699, 30, true),
  ('T1', 'GBP', 1499, 80, true),
  -- T1 — USD
  ('T1', 'USD',  399, 10, true),
  ('T1', 'USD',  899, 30, true),
  ('T1', 'USD', 1899, 80, true),
  -- T1 — EUR
  ('T1', 'EUR',  349, 10, true),
  ('T1', 'EUR',  799, 30, true),
  ('T1', 'EUR', 1699, 80, true),
  -- T2 — USD
  ('T2', 'USD',  399, 10, true),
  ('T2', 'USD',  899, 30, true),
  ('T2', 'USD', 1899, 80, true),
  -- T3 — USD
  ('T3', 'USD',  399, 10, true),
  ('T3', 'USD',  899, 30, true),
  ('T3', 'USD', 1899, 80, true)
on conflict do nothing;

-- --- Launch categories -------------------------------------------------------
insert into categories (slug, name, sort_order) values
  ('devotional',   'Indian Devotional & Culture', 10),
  ('festival',     'Festival Packs',              20),
  ('amoled-minimal','Dark AMOLED & Minimal',      30),
  ('nature',       'Nature',                      40),
  ('abstract',     'Abstract',                    50)
on conflict (slug) do nothing;
