-- =============================================================================
-- HirecWallp — seed data
-- Regions (pricing tiers), global price rules and launch categories.
-- Idempotent: safe to re-run (ON CONFLICT DO NOTHING / upserts).
--
-- UNIT CONVENTION: every region prices wallpapers in whole CREDITS (since
-- migration 0015 — India too). What a credit costs differs per tier/country
-- (credit_packs / plan_prices, seeded in 0015 and editable in Admin).
-- =============================================================================

-- --- Regions (pricing tiers; country → tier map lives in src/lib/geo.ts) -------
insert into regions (code, name, currency, pricing_unit, country_codes, sort_order) values
  ('IN', 'India',                                                  'INR', 'credits', array['IN'], 10),
  ('T1', 'Tier 1 (US, UK, Western Europe, ANZ, Canada)',            'USD', 'credits', array[]::text[], 20),
  ('T2', 'Tier 2 (Gulf, East Asia, Southern Europe)',               'USD', 'credits', array[]::text[], 30),
  ('T3', 'Tier 3 (Eastern Europe, Latin America, SE Asia — default)','USD', 'credits', array[]::text[], 40),
  ('T4', 'Tier 4 (South Asia, Africa, emerging)',                   'USD', 'credits', array[]::text[], 50)
on conflict (code) do update
  set name = excluded.name,
      currency = excluded.currency,
      pricing_unit = excluded.pricing_unit,
      sort_order = excluded.sort_order;

-- --- Global price rules: wallpapers cost 1–3 credits everywhere ----------------
insert into price_rules
  (scope, scope_id, region_code, min_price, max_price, base_price, snap_points, max_step_pct, cooldown_hours, launch_price, launch_hours, frozen)
select 'global', null, r, 1, 3, 1, array[1,2,3]::numeric[], 50, 24, 1, 72, false
from unnest(array['IN','T1','T2','T3','T4']) as r
where not exists (select 1 from price_rules pr where pr.scope = 'global' and pr.region_code = r);

-- Credit packs and plans are seeded by migration 0015 (and edited in Admin).

-- --- Launch categories -------------------------------------------------------
insert into categories (slug, name, sort_order) values
  ('devotional',   'Indian Devotional & Culture', 10),
  ('festival',     'Festival Packs',              20),
  ('amoled-minimal','Dark AMOLED & Minimal',      30),
  ('nature',       'Nature',                      40),
  ('abstract',     'Abstract',                    50)
on conflict (slug) do nothing;

-- --- Prompt library (Phase 2) -----------------------------------------------
-- Launch niches: Indian devotional/culture + dark AMOLED minimal. No
-- trademarked characters, brand logos, real people or NSFW (enforced in
-- generation + moderation).
insert into prompt_library (niche, festival, prompt, negative_prompt, aspect, style_notes, active) values
  ('devotional', 'diwali', 'Cinematic cosmic depiction of Lord Shiva''s trishul against a nebula, sacred geometry, volumetric light, ultra detailed, 8k', 'text, watermark, logo, brand, celebrity, nsfw, extra limbs', 'phone', 'Deep indigo + amber palette, reverent mood', true),
  ('devotional', null, 'Golden silhouette of Ganesha with intricate mandala background, divine glow, temple ambience, ultra detailed', 'text, watermark, logo, brand, celebrity, nsfw', 'phone', 'Gold + warm black, festival feel', true),
  ('amoled-minimal', null, 'Pure black AMOLED minimal wallpaper with a single thin neon arc, negative space, premium', 'noise, clutter, text, watermark, busy', 'phone', 'True black for AMOLED power saving', true),
  ('amoled-minimal', null, 'Dark stone textured minimal gradient, soft fog, muted warm highlight, premium abstract', 'text, watermark, logo, oversaturated', 'desktop', 'Warm greys, understated', true)
on conflict do nothing;

-- --- Category passes (one per launch category; needs categories above) -------
do $$ begin
  if not exists (select 1 from membership_plans where name = 'Devotional Pass') then
    insert into membership_plans (name, description, kind, term_months, duration_days, download_limit, includes_commercial, category_id, perks, active, sort_order) select 'Devotional Pass', 'Unlimited-style access to one category: 30 wallpapers a month', 'category', 1, 30, 30, false, id, array['30 wallpapers a month from ' || name, 'New drops in this category included', 'Keep what you add, forever'], true, 90 from categories where slug = 'devotional';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'IN', '{}', 'INR', 9900 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T1', '{}', 'USD', 299 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T1', '{GB}', 'GBP', 249 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 279 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T1', '{AU}', 'AUD', 449 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T1', '{CA}', 'CAD', 399 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T2', '{}', 'USD', 249 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T3', '{}', 'USD', 199 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T4', '{}', 'USD', 149 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'IN', '{}', 'INR', 9900 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T1', '{}', 'USD', 299 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T1', '{GB}', 'GBP', 249 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 279 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T1', '{AU}', 'AUD', 449 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T1', '{CA}', 'CAD', 399 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T2', '{}', 'USD', 249 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T3', '{}', 'USD', 199 from membership_plans where name = 'Devotional Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T4', '{}', 'USD', 149 from membership_plans where name = 'Devotional Pass';
  end if;
end $$;
do $$ begin
  if not exists (select 1 from membership_plans where name = 'AMOLED & Minimal Pass') then
    insert into membership_plans (name, description, kind, term_months, duration_days, download_limit, includes_commercial, category_id, perks, active, sort_order) select 'AMOLED & Minimal Pass', 'Unlimited-style access to one category: 30 wallpapers a month', 'category', 1, 30, 30, false, id, array['30 wallpapers a month from ' || name, 'New drops in this category included', 'Keep what you add, forever'], true, 90 from categories where slug = 'amoled-minimal';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'IN', '{}', 'INR', 9900 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T1', '{}', 'USD', 299 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T1', '{GB}', 'GBP', 249 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 279 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T1', '{AU}', 'AUD', 449 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T1', '{CA}', 'CAD', 399 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T2', '{}', 'USD', 249 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T3', '{}', 'USD', 199 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T4', '{}', 'USD', 149 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'IN', '{}', 'INR', 9900 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T1', '{}', 'USD', 299 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T1', '{GB}', 'GBP', 249 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 279 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T1', '{AU}', 'AUD', 449 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T1', '{CA}', 'CAD', 399 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T2', '{}', 'USD', 249 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T3', '{}', 'USD', 199 from membership_plans where name = 'AMOLED & Minimal Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T4', '{}', 'USD', 149 from membership_plans where name = 'AMOLED & Minimal Pass';
  end if;
end $$;
do $$ begin
  if not exists (select 1 from membership_plans where name = 'Nature Pass') then
    insert into membership_plans (name, description, kind, term_months, duration_days, download_limit, includes_commercial, category_id, perks, active, sort_order) select 'Nature Pass', 'Unlimited-style access to one category: 30 wallpapers a month', 'category', 1, 30, 30, false, id, array['30 wallpapers a month from ' || name, 'New drops in this category included', 'Keep what you add, forever'], true, 90 from categories where slug = 'nature';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'IN', '{}', 'INR', 9900 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T1', '{}', 'USD', 299 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T1', '{GB}', 'GBP', 249 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 279 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T1', '{AU}', 'AUD', 449 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T1', '{CA}', 'CAD', 399 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T2', '{}', 'USD', 249 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T3', '{}', 'USD', 199 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'prepaid', 'T4', '{}', 'USD', 149 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'IN', '{}', 'INR', 9900 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T1', '{}', 'USD', 299 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T1', '{GB}', 'GBP', 249 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T1', '{IE,FR,DE,NL,AT,BE,FI,LU}', 'EUR', 279 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T1', '{AU}', 'AUD', 449 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T1', '{CA}', 'CAD', 399 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T2', '{}', 'USD', 249 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T3', '{}', 'USD', 199 from membership_plans where name = 'Nature Pass';
    insert into plan_prices (plan_id, billing, region_code, country_codes, currency, amount_minor) select id, 'autopay', 'T4', '{}', 'USD', 149 from membership_plans where name = 'Nature Pass';
  end if;
end $$;
