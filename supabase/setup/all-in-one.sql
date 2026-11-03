-- HirecWallp: ONE-PASTE database setup for the Supabase SQL Editor.
-- Generated from supabase/migrations/0001..0016 + supabase/seed/seed.sql (in order).
-- Run ONCE on a NEW, empty project. Do not edit here; edit the source files.

-- ================================================================
-- >>> supabase/migrations/0001_phase1_init.sql
-- ================================================================
-- =============================================================================
-- HirecWallp — Phase 1 schema (extensions, enums, tables, indexes, functions)
-- RLS policies live in 0002_phase1_rls.sql.
--
-- Conventions:
--   * Prices are stored in MINOR units where money (INR paise); "credits" are
--     whole integers. Each row carries an explicit currency / region_code.
--   * Originals live only in the private R2 bucket; asset rows for the private
--     bucket are never exposed to public/auth roles via RLS (see 0002).
-- =============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";        -- fuzzy search on titles/tags

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type user_role        as enum ('buyer', 'creator', 'admin');
create type wallpaper_status as enum ('draft', 'pending_review', 'published', 'archived');
create type asset_variant    as enum (
  'phone', 'phone_depth', 'desktop_4k', 'desktop_5k', 'tablet', 'ultrawide',
  'free_phone', 'free_desktop', 'preview', 'preview_crop'
);
create type storage_bucket   as enum ('private', 'public');
create type pricing_unit     as enum ('money', 'credits');
create type rule_scope       as enum ('global', 'category', 'wallpaper');
create type credit_reason    as enum ('purchase', 'spend', 'refund', 'admin_adjust');
create type order_provider   as enum ('razorpay', 'razorpay_intl', 'paypal', 'credits');
create type order_status      as enum ('created', 'paid', 'failed', 'refunded');
create type licence_type      as enum ('personal', 'commercial');
create type price_actor       as enum ('job', 'admin');
create type takedown_status   as enum ('open', 'reviewing', 'actioned', 'rejected');
create type event_type        as enum (
  'view', 'detail_view', 'preview_zoom', 'free_download',
  'add_to_cart', 'checkout_start', 'purchase', 'paid_download'
);

-- -----------------------------------------------------------------------------
-- Identity
-- -----------------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role         user_role    not null default 'buyer',
  country_code text,                      -- ISO-3166-1 alpha-2, best-effort
  gstin        text,                      -- optional GST id for Indian buyers
  created_at   timestamptz  not null default now()
);

-- -----------------------------------------------------------------------------
-- Catalogue
-- -----------------------------------------------------------------------------
create table categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  parent_id  uuid references categories(id) on delete set null,
  sort_order int  not null default 0
);

create table wallpaper_sets (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  description text
);

create table wallpapers (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  description      text,
  alt_text         text,
  category_id      uuid references categories(id) on delete set null,
  tags             text[] not null default '{}',
  is_free          boolean not null default false,
  status           wallpaper_status not null default 'draft',
  creator_id       uuid references profiles(id) on delete set null,
  is_ai_generated  boolean not null default true,
  human_edited     boolean not null default false,
  set_id           uuid references wallpaper_sets(id) on delete set null,
  launch_at        timestamptz,
  created_at       timestamptz not null default now()
);
create index wallpapers_status_idx   on wallpapers (status);
create index wallpapers_category_idx on wallpapers (category_id);
create index wallpapers_set_idx      on wallpapers (set_id);
create index wallpapers_tags_idx     on wallpapers using gin (tags);
create index wallpapers_title_trgm   on wallpapers using gin (title gin_trgm_ops);

create table wallpaper_assets (
  id             uuid primary key default gen_random_uuid(),
  wallpaper_id   uuid not null references wallpapers(id) on delete cascade,
  variant        asset_variant not null,
  width          int,
  height         int,
  bytes          bigint,
  storage_bucket storage_bucket not null,
  storage_key    text not null,
  phash          text,
  created_at     timestamptz not null default now(),
  unique (wallpaper_id, variant)
);
create index wallpaper_assets_wallpaper_idx on wallpaper_assets (wallpaper_id);
create index wallpaper_assets_phash_idx      on wallpaper_assets (phash);

-- -----------------------------------------------------------------------------
-- Regions & pricing
-- -----------------------------------------------------------------------------
create table regions (
  code          text primary key check (code in ('IN', 'T1', 'T2', 'T3')),
  name          text not null,
  currency      text not null,            -- INR / GBP / USD / EUR ...
  pricing_unit  pricing_unit not null,    -- money (IN) | credits (T1..T3)
  country_codes text[] not null default '{}'
);

create table price_rules (
  id           uuid primary key default gen_random_uuid(),
  scope        rule_scope not null,
  scope_id     uuid,                       -- null for global; category/wallpaper id otherwise
  region_code  text not null references regions(code) on delete cascade,
  min_price    numeric not null,
  max_price    numeric not null,
  base_price   numeric not null,
  snap_points  numeric[] not null default '{}',
  max_step_pct numeric not null default 25,
  cooldown_hours int not null default 24,
  launch_price numeric,
  launch_hours int not null default 72,
  frozen       boolean not null default false,
  check (min_price <= max_price)
);
create index price_rules_lookup_idx on price_rules (region_code, scope, scope_id);

create table prices (
  wallpaper_id    uuid not null references wallpapers(id) on delete cascade,
  region_code     text not null references regions(code) on delete cascade,
  current_price   numeric not null,
  last_changed_at timestamptz not null default now(),
  primary key (wallpaper_id, region_code)
);

create table price_history (
  id          uuid primary key default gen_random_uuid(),
  wallpaper_id uuid not null references wallpapers(id) on delete cascade,
  region_code  text not null references regions(code) on delete cascade,
  old_price    numeric,
  new_price    numeric not null,
  reason       text,
  metrics      jsonb,
  changed_by   price_actor not null default 'job',
  created_at   timestamptz not null default now()
);
create index price_history_wallpaper_idx on price_history (wallpaper_id, region_code, created_at desc);

-- 15-minute price lock captured at the moment the user starts checkout.
create table price_quotes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  wallpaper_id uuid not null references wallpapers(id) on delete cascade,
  region_code  text not null references regions(code) on delete cascade,
  price        numeric not null,
  expires_at   timestamptz not null default (now() + interval '15 minutes'),
  created_at   timestamptz not null default now()
);
create index price_quotes_user_idx on price_quotes (user_id);

-- -----------------------------------------------------------------------------
-- Credits & orders
-- -----------------------------------------------------------------------------
create table credit_packs (
  id                uuid primary key default gen_random_uuid(),
  region_code       text not null references regions(code) on delete cascade,
  currency          text not null,
  amount_minor      int not null,          -- pack price in minor units
  credits           int not null,
  provider_plan_ref text,
  active            boolean not null default true
);

-- Credit balance = SUM(delta) for a user. Never updated in place; append-only.
create table credit_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  delta      int not null,
  reason     credit_reason not null,
  ref_id     uuid,                          -- order id / entitlement id etc.
  created_at timestamptz not null default now()
);
create index credit_ledger_user_idx on credit_ledger (user_id);

create table orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  provider          order_provider not null,
  provider_order_id text,
  status            order_status not null default 'created',
  currency          text not null,
  amount_minor      int not null,
  billing_country   text,
  created_at        timestamptz not null default now(),
  unique (provider, provider_order_id)
);
create index orders_user_idx on orders (user_id);

create table order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  wallpaper_id  uuid references wallpapers(id) on delete set null,
  set_id        uuid references wallpaper_sets(id) on delete set null,
  credit_pack_id uuid references credit_packs(id) on delete set null,
  unit_price    numeric,
  credits_spent int
);
create index order_items_order_idx on order_items (order_id);

-- A purchased right to download a wallpaper under a licence.
create table entitlements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  wallpaper_id   uuid not null references wallpapers(id) on delete cascade,
  order_id       uuid references orders(id) on delete set null,
  licence        licence_type not null default 'personal',
  max_downloads  int not null default 5,
  downloads_used int not null default 0,
  created_at     timestamptz not null default now(),
  unique (user_id, wallpaper_id, licence)
);
create index entitlements_user_idx on entitlements (user_id);

-- Audit log of every issued download (signed-URL grant).
create table downloads (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references profiles(id) on delete set null,
  wallpaper_id      uuid not null references wallpapers(id) on delete cascade,
  asset_id          uuid references wallpaper_assets(id) on delete set null,
  entitlement_id    uuid references entitlements(id) on delete set null,
  ip_hash           text,
  user_agent        text,
  watermark_payload text,
  created_at        timestamptz not null default now()
);
create index downloads_user_idx   on downloads (user_id, created_at desc);
create index downloads_iphash_idx on downloads (ip_hash, created_at desc);

-- -----------------------------------------------------------------------------
-- Analytics & ops
-- -----------------------------------------------------------------------------
create table events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references profiles(id) on delete set null,
  anon_id      text,
  type         event_type not null,
  wallpaper_id uuid references wallpapers(id) on delete set null,
  region_code  text references regions(code) on delete set null,
  country_code text,
  created_at   timestamptz not null default now()
);
create index events_type_idx      on events (type, created_at desc);
create index events_wallpaper_idx on events (wallpaper_id, created_at desc);

create table takedown_reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_email text,
  url            text,
  wallpaper_id   uuid references wallpapers(id) on delete set null,
  details        text,
  status         takedown_status not null default 'open',
  created_at     timestamptz not null default now()
);

-- Idempotency ledger for payment webhooks (dedupe on provider event id).
create table webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     order_provider not null,
  event_id     text not null,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)
);

-- -----------------------------------------------------------------------------
-- Functions & triggers
-- -----------------------------------------------------------------------------

-- True if the current auth user is an admin. Used by RLS policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Current credit balance for a user (sum of ledger deltas).
create or replace function public.credit_balance(p_user uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(delta), 0)::int
  from public.credit_ledger
  where user_id = p_user;
$$;

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Atomically claim one download against an entitlement. Returns the new
-- downloads_used, or NULL if the entitlement is missing or already at its limit.
-- Called server-side (service role) inside the secure download flow.
create or replace function public.claim_entitlement_download(p_entitlement uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_used int;
begin
  update public.entitlements
     set downloads_used = downloads_used + 1
   where id = p_entitlement
     and downloads_used < max_downloads
  returning downloads_used into new_used;

  return new_used;  -- NULL when no row updated (not found or over the limit)
end;
$$;

-- ================================================================
-- >>> supabase/migrations/0002_phase1_rls.sql
-- ================================================================
-- =============================================================================
-- HirecWallp — Phase 1 Row Level Security
--
-- Principle: deny by default. The `service_role` key bypasses RLS and is used
-- ONLY on the server for privileged flows (webhooks, credit spend, issuing
-- download URLs, admin writes). Public/auth roles get the minimum below.
--
--   * Originals (private bucket asset rows) are NEVER selectable by anon/auth.
--   * Entitlements / orders / ledger / downloads: each user sees only their own.
--   * Admin reads/writes gated by public.is_admin() (server-side role check).
-- =============================================================================

alter table profiles         enable row level security;
alter table categories       enable row level security;
alter table wallpaper_sets   enable row level security;
alter table wallpapers       enable row level security;
alter table wallpaper_assets enable row level security;
alter table regions          enable row level security;
alter table price_rules      enable row level security;
alter table prices           enable row level security;
alter table price_history    enable row level security;
alter table price_quotes     enable row level security;
alter table credit_packs     enable row level security;
alter table credit_ledger    enable row level security;
alter table orders           enable row level security;
alter table order_items      enable row level security;
alter table entitlements     enable row level security;
alter table downloads        enable row level security;
alter table events           enable row level security;
alter table takedown_reports enable row level security;
alter table webhook_events   enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy "profiles: read own" on profiles
  for select using (id = auth.uid());
create policy "profiles: admin read all" on profiles
  for select using (public.is_admin());
create policy "profiles: update own (not role)" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
-- NOTE: role escalation is prevented because only service_role / admin flows
-- change `role`; a client UPDATE that flips role will pass the row filter but
-- such writes are never issued from the client. Harden further with a column
-- trigger before launch if self-serve profile edits are added.

-- -----------------------------------------------------------------------------
-- Public catalogue (readable by everyone)
-- -----------------------------------------------------------------------------
create policy "categories: public read" on categories
  for select using (true);

create policy "wallpaper_sets: public read" on wallpaper_sets
  for select using (true);

create policy "wallpapers: public read published" on wallpapers
  for select using (status = 'published');
create policy "wallpapers: admin read all" on wallpapers
  for select using (public.is_admin());

-- Only PUBLIC-bucket assets of PUBLISHED wallpapers are ever readable by
-- anon/auth. Private-bucket (original) rows are reachable only via service_role.
create policy "wallpaper_assets: public previews only" on wallpaper_assets
  for select using (
    storage_bucket = 'public'
    and exists (
      select 1 from wallpapers w
      where w.id = wallpaper_assets.wallpaper_id
        and w.status = 'published'
    )
  );
create policy "wallpaper_assets: admin read all" on wallpaper_assets
  for select using (public.is_admin());

create policy "regions: public read" on regions
  for select using (true);

create policy "prices: public read" on prices
  for select using (true);

create policy "credit_packs: public read active" on credit_packs
  for select using (active = true);
create policy "credit_packs: admin read all" on credit_packs
  for select using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Pricing internals (admin only; jobs use service_role)
-- -----------------------------------------------------------------------------
create policy "price_rules: admin read" on price_rules
  for select using (public.is_admin());
create policy "price_history: admin read" on price_history
  for select using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Per-user data (own rows only)
-- -----------------------------------------------------------------------------
create policy "price_quotes: read own" on price_quotes
  for select using (user_id = auth.uid());

create policy "credit_ledger: read own" on credit_ledger
  for select using (user_id = auth.uid());

create policy "orders: read own" on orders
  for select using (user_id = auth.uid());
create policy "orders: admin read all" on orders
  for select using (public.is_admin());

create policy "order_items: read own via order" on order_items
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );
create policy "order_items: admin read all" on order_items
  for select using (public.is_admin());

create policy "entitlements: read own" on entitlements
  for select using (user_id = auth.uid());
create policy "entitlements: admin read all" on entitlements
  for select using (public.is_admin());

create policy "downloads: read own" on downloads
  for select using (user_id = auth.uid());
create policy "downloads: admin read all" on downloads
  for select using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Analytics & ops
-- -----------------------------------------------------------------------------
-- Events are written server-side (service_role) from /api/events; only admins
-- can read them. No public insert/select.
create policy "events: admin read" on events
  for select using (public.is_admin());

-- Anyone may file a takedown report (public contact form); admins manage them.
create policy "takedowns: public insert" on takedown_reports
  for insert with check (true);
create policy "takedowns: admin read" on takedown_reports
  for select using (public.is_admin());
create policy "takedowns: admin update" on takedown_reports
  for update using (public.is_admin()) with check (public.is_admin());

-- webhook_events: service_role only — no policies, RLS denies all other roles.

-- ================================================================
-- >>> supabase/migrations/0003_phase1_payments_fns.sql
-- ================================================================
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

-- ================================================================
-- >>> supabase/migrations/0004_phase2_automation.sql
-- ================================================================
-- =============================================================================
-- HirecWallp — Phase 2 (Automation) schema
--
-- Adds the generation/review/social/pricing-automation tables, the jobs log,
-- and commercial-licence pricing. All new tables are admin-read only; writes
-- happen via the service role from verified job routes.
-- =============================================================================

-- --- Enums ------------------------------------------------------------------
create type generation_status as enum (
  'queued', 'generating', 'filtering', 'upscaling',
  'awaiting_review', 'approved', 'rejected', 'failed'
);
create type social_platform as enum ('instagram', 'pinterest', 'youtube_shorts');
create type social_format   as enum ('image', 'carousel', 'reel', 'pin');
create type social_status   as enum ('scheduled', 'posted', 'failed', 'skipped');
create type job_status      as enum ('started', 'succeeded', 'failed');

-- --- Prompt library ----------------------------------------------------------
create table prompt_library (
  id             uuid primary key default gen_random_uuid(),
  niche          text not null,
  festival       text,
  prompt         text not null,
  negative_prompt text,
  aspect         text not null default 'phone',
  style_notes    text,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index prompt_library_active_idx on prompt_library (active, niche);

-- --- Generation jobs ---------------------------------------------------------
create table generation_jobs (
  id             uuid primary key default gen_random_uuid(),
  prompt_id      uuid references prompt_library(id) on delete set null,
  provider       text,
  status         generation_status not null default 'queued',
  candidates     jsonb not null default '[]'::jsonb,   -- [{key,width,height,phash,bucket}]
  quality_scores jsonb not null default '{}'::jsonb,   -- {key: {score, reasons}}
  metadata       jsonb,                                 -- Claude-suggested title/tags/etc.
  wallpaper_id   uuid references wallpapers(id) on delete set null, -- set on publish
  cost_minor     int not null default 0,
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index generation_jobs_status_idx on generation_jobs (status, created_at desc);

-- --- Social posts ------------------------------------------------------------
create table social_posts (
  id            uuid primary key default gen_random_uuid(),
  wallpaper_id  uuid references wallpapers(id) on delete cascade,
  platform      social_platform not null,
  format        social_format not null default 'image',
  caption       text,
  hashtags      text,
  media_url     text,
  scheduled_for timestamptz,
  status        social_status not null default 'scheduled',
  external_id   text,
  error         text,
  created_at    timestamptz not null default now()
);
create index social_posts_due_idx on social_posts (status, scheduled_for);

-- --- Jobs log ----------------------------------------------------------------
create table jobs_log (
  id          uuid primary key default gen_random_uuid(),
  job_name    text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      job_status not null default 'started',
  details     jsonb
);
create index jobs_log_name_idx on jobs_log (job_name, started_at desc);

-- --- Commercial licence pricing ---------------------------------------------
-- Commercial licence price = personal price × multiplier (per region).
-- Configurable; flagged for CA review on tax treatment.
alter table regions add column commercial_multiplier numeric not null default 5;

-- --- RLS: admin-read only; writes via service role --------------------------
alter table prompt_library  enable row level security;
alter table generation_jobs enable row level security;
alter table social_posts    enable row level security;
alter table jobs_log        enable row level security;

create policy "prompt_library: admin read"  on prompt_library  for select using (public.is_admin());
create policy "generation_jobs: admin read" on generation_jobs for select using (public.is_admin());
create policy "social_posts: admin read"    on social_posts    for select using (public.is_admin());
create policy "jobs_log: admin read"        on jobs_log        for select using (public.is_admin());

-- Keep generation_jobs.updated_at fresh.
create or replace function public.touch_generation_job()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger generation_jobs_touch
  before update on generation_jobs
  for each row execute function public.touch_generation_job();

-- ================================================================
-- >>> supabase/migrations/0005_phase2_commercial.sql
-- ================================================================
-- =============================================================================
-- HirecWallp — Phase 2 commercial-licence SKU
--
-- Records the licence chosen per purchased item so the verified webhook grants
-- the correct entitlement. Commercial price = personal price ×
-- regions.commercial_multiplier (added in 0004). Default stays 'personal'.
-- =============================================================================

alter table order_items
  add column licence licence_type not null default 'personal';

-- ================================================================
-- >>> supabase/migrations/0006_phase3_marketplace.sql
-- ================================================================
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

-- ================================================================
-- >>> supabase/migrations/0007_security_hardening.sql
-- ================================================================
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

-- ================================================================
-- >>> supabase/migrations/0008_housekeeping.sql
-- ================================================================
-- =============================================================================
-- HirecWallp — housekeeping (keeps the database small; see docs/STORAGE_STRATEGY.md)
--
-- Raw analytics events are the only unbounded table (~0.4 KB/row with indexes).
-- Older events are rolled up into daily counts and the raw rows deleted, so
-- history is kept at a tiny fraction of the size. Dynamic pricing and the
-- weekly report only read the last 7 days of raw events.
-- =============================================================================

create table events_daily (
  day          date not null,
  type         event_type not null,
  wallpaper_id uuid references wallpapers(id) on delete cascade,
  region_code  text,
  count        int not null default 0
);
create unique index events_daily_key
  on events_daily (day, type, coalesce(wallpaper_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(region_code, ''));
create index events_daily_wallpaper_idx on events_daily (wallpaper_id, day desc);

alter table events_daily enable row level security;
create policy "events_daily: admin read" on events_daily for select using (public.is_admin());

-- Roll up raw events older than p_keep_days into events_daily, delete them,
-- and drop expired price quotes. Returns the number of raw events removed.
create or replace function public.housekeeping(p_keep_days int default 90)
returns int
language plpgsql
security definer
set search_path = public
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

  return v_deleted;
end;
$$;

revoke execute on function public.housekeeping(int) from public, anon, authenticated;
grant execute on function public.housekeeping(int) to service_role;

-- ================================================================
-- >>> supabase/migrations/0009_site_completion.sql
-- ================================================================
-- =============================================================================
-- HirecWallp — site completion (docs/SITE_AUDIT.md)
--   * public size metadata on wallpapers (explore filters, "sizes included")
--   * favourites, newsletter sign-ups, contact messages
--   * sequential invoice numbers for paid orders (GST-ready receipts)
-- =============================================================================

-- --- Public size metadata (filled at upload from the generated variants) ------
alter table wallpapers
  add column orientation   text check (orientation in ('portrait', 'landscape', 'square')),
  add column max_long_edge int,
  add column devices       text[] not null default '{}';  -- e.g. {phone,tablet} / {desktop_4k,desktop_5k}
create index wallpapers_orientation_idx on wallpapers (orientation);
create index wallpapers_devices_idx on wallpapers using gin (devices);

-- --- Favourites ---------------------------------------------------------------
create table favourites (
  user_id      uuid not null references profiles(id) on delete cascade,
  wallpaper_id uuid not null references wallpapers(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, wallpaper_id)
);
alter table favourites enable row level security;
create policy "favourites: read own"   on favourites for select using (user_id = auth.uid());
create policy "favourites: add own"    on favourites for insert with check (user_id = auth.uid());
create policy "favourites: remove own" on favourites for delete using (user_id = auth.uid());
revoke update on table favourites from anon, authenticated;

-- --- Newsletter sign-ups (written by the server; admin reads/exports) --------
create table newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  source     text,
  created_at timestamptz not null default now()
);
alter table newsletter_subscribers enable row level security;
create policy "newsletter: admin read" on newsletter_subscribers for select using (public.is_admin());

-- --- Contact messages (separate from takedown reports) -----------------------
create type message_status as enum ('new', 'replied', 'closed');
create table contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  message    text not null,
  user_id    uuid references profiles(id) on delete set null,
  status     message_status not null default 'new',
  created_at timestamptz not null default now()
);
create index contact_messages_status_idx on contact_messages (status, created_at desc);
alter table contact_messages enable row level security;
create policy "contact_messages: admin read" on contact_messages for select using (public.is_admin());

-- --- Invoice numbers ----------------------------------------------------------
-- Sequential per financial record; assigned once when an order is paid.
create sequence invoice_seq;
alter table orders
  add column invoice_no  text unique,
  add column buyer_gstin text,
  add column paid_at     timestamptz;

create or replace function public.assign_invoice(p_order uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_no text;
begin
  update public.orders o
     set invoice_no  = coalesce(o.invoice_no, 'HW-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 6, '0')),
         paid_at     = coalesce(o.paid_at, now()),
         buyer_gstin = coalesce(o.buyer_gstin, (select p.gstin from public.profiles p where p.id = o.user_id))
   where o.id = p_order and o.status = 'paid'
  returning invoice_no into v_no;
  return v_no;
end;
$$;
revoke execute on function public.assign_invoice(uuid) from public, anon, authenticated;
grant execute on function public.assign_invoice(uuid) to service_role;

-- --- Global base prices are shown on the storefront, so they are public -------
create policy "price_rules: public read global" on price_rules
  for select using (scope = 'global');

-- ================================================================
-- >>> supabase/migrations/0010_membership_and_settings.sql
-- ================================================================
-- =============================================================================
-- HirecWallp — admin control centre + membership passes
--
-- * site_settings: key/value switches the admin flips from /admin/settings
--   (public read so the storefront can honour them; writes via service role).
-- * Membership = a prepaid pass (e.g. 30 or 365 days), bought like any order.
--   No auto-renew (avoids RBI e-mandate rules for recurring card/UPI debits);
--   buying again extends the pass. Members add wallpapers to their library
--   up to the plan's limit per pass.
-- =============================================================================

create table site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table site_settings enable row level security;
create policy "site_settings: public read" on site_settings for select using (true);

create table membership_plans (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  description         text,
  duration_days       int  not null check (duration_days between 1 and 3660),
  -- Price per region in that region's currency MINOR units, e.g.
  -- {"IN": 29900, "T1": 799, "T2": 599, "T3": 399}. Missing region = not sold there.
  prices              jsonb not null default '{}'::jsonb,
  download_limit      int  not null default 50 check (download_limit > 0),
  includes_commercial boolean not null default false,
  perks               text[] not null default '{}',
  active              boolean not null default true,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now()
);
alter table membership_plans enable row level security;
create policy "membership_plans: public read active" on membership_plans for select using (active = true);
create policy "membership_plans: admin read" on membership_plans for select using (public.is_admin());

create type membership_status as enum ('active', 'revoked');
create table memberships (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  plan_id        uuid references membership_plans(id) on delete set null,
  order_id       uuid references orders(id) on delete set null,
  starts_at      timestamptz not null default now(),
  ends_at        timestamptz not null,
  download_limit int not null,
  downloads_used int not null default 0,
  includes_commercial boolean not null default false,
  status         membership_status not null default 'active',
  note           text,
  created_at     timestamptz not null default now()
);
create index memberships_user_idx on memberships (user_id, ends_at desc);
create unique index memberships_order_uniq on memberships (order_id) where order_id is not null;
alter table memberships enable row level security;
create policy "memberships: read own" on memberships for select using (user_id = auth.uid());
create policy "memberships: admin read" on memberships for select using (public.is_admin());

alter table order_items add column membership_plan_id uuid references membership_plans(id) on delete set null;

-- Grant a pass from a paid order (idempotent per order). A new pass starts
-- when the user's current pass ends, so renewing early never loses days.
create or replace function public.grant_membership(p_user uuid, p_plan uuid, p_order uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan  public.membership_plans%rowtype;
  v_start timestamptz;
  v_id    uuid;
begin
  select id into v_id from public.memberships where order_id = p_order;
  if v_id is not null then return v_id; end if;

  select * into v_plan from public.membership_plans where id = p_plan;
  if not found then raise exception 'unknown plan'; end if;

  select greatest(now(), coalesce(max(ends_at), now())) into v_start
  from public.memberships
  where user_id = p_user and status = 'active' and ends_at > now();

  insert into public.memberships (user_id, plan_id, order_id, starts_at, ends_at, download_limit, includes_commercial)
  values (p_user, p_plan, p_order, v_start, v_start + make_interval(days => v_plan.duration_days),
          v_plan.download_limit, v_plan.includes_commercial)
  returning id into v_id;
  return v_id;
end;
$$;

-- Add a wallpaper to a member's library using their active pass. Already
-- owned → returns the existing entitlement without using an allowance.
-- Returns NULL when there is no active pass or the allowance is used up.
create or replace function public.member_unlock(p_user uuid, p_wallpaper uuid, p_max_downloads int default 5)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m       public.memberships%rowtype;
  v_licence licence_type;
  v_id      uuid;
begin
  perform pg_advisory_xact_lock(hashtext('member:' || p_user::text));

  select * into v_m from public.memberships
  where user_id = p_user and status = 'active' and starts_at <= now() and ends_at > now()
    and downloads_used < download_limit
  order by ends_at asc
  limit 1;
  if not found then return null; end if;

  v_licence := case when v_m.includes_commercial then 'commercial'::licence_type else 'personal'::licence_type end;

  select id into v_id from public.entitlements
  where user_id = p_user and wallpaper_id = p_wallpaper and (licence = v_licence or licence = 'commercial');
  if v_id is not null then return v_id; end if;

  insert into public.entitlements (user_id, wallpaper_id, licence, max_downloads)
  values (p_user, p_wallpaper, v_licence, p_max_downloads)
  returning id into v_id;

  update public.memberships set downloads_used = downloads_used + 1 where id = v_m.id;
  return v_id;
end;
$$;

revoke execute on function public.grant_membership(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.member_unlock(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.grant_membership(uuid, uuid, uuid) to service_role;
grant execute on function public.member_unlock(uuid, uuid, int) to service_role;

-- Starter plans (inactive until the owner reviews prices and switches
-- membership on in /admin/settings).
insert into membership_plans (name, description, duration_days, prices, download_limit, includes_commercial, perks, active, sort_order) values
  ('Monthly Pass', '30 days of access', 30, '{"IN": 19900, "T1": 699, "T2": 499, "T3": 299}', 30, false,
   array['Add up to 30 wallpapers to your library', 'Every size of each wallpaper', 'Keep them forever'], false, 10),
  ('Yearly Pass', '365 days of access', 365, '{"IN": 149900, "T1": 4999, "T2": 3499, "T3": 1999}', 400, false,
   array['Add up to 400 wallpapers to your library', 'Every size of each wallpaper', 'Keep them forever', 'Best value'], false, 20);

-- ================================================================
-- >>> supabase/migrations/0011_storage_buckets.sql
-- ================================================================
-- =============================================================================
-- HirecWallp — Supabase Storage buckets (zero-setup storage; see src/lib/storage)
--
-- wallpapers-private : originals, paid sizes, free sizes, per-buyer copies,
--                      raw uploads. NOT public; no RLS policies, so only the
--                      service role (server) can read/write; buyers get 60 s
--                      signed URLs.
-- wallpapers-public  : watermarked previews (≤720 px) + 600² crops only.
-- 50 MB per file = Supabase free-plan limit. Switch to R2 any time via env.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('wallpapers-private', 'wallpapers-private', false, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/tiff']),
  ('wallpapers-public', 'wallpapers-public', true, 5242880,
   array['image/jpeg', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ================================================================
-- >>> supabase/migrations/0012_admin_pro.sql
-- ================================================================
-- =============================================================================
-- HirecWallp — production admin (analytics, scalable lists, audit log, refunds)
-- All functions are SECURITY DEFINER and callable by the service role only;
-- the admin pages call them server-side after an admin check.
-- =============================================================================

-- --- Searchable customer email on profiles (kept in sync with auth.users) -----
alter table profiles add column email text;
create index profiles_email_idx on profiles (lower(email));
create index profiles_created_idx on profiles (created_at desc);

update profiles p set email = u.email from auth.users u where u.id = p.id and p.email is distinct from u.email;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;

-- Email is visible to its owner via RLS but must not be client-editable.
-- (Client updates are already column-limited by migration 0007.)

-- --- Payment id (needed to refund from the admin panel) -----------------------
alter table orders add column provider_payment_id text;
create index orders_status_created_idx on orders (status, created_at desc);
create index orders_paid_at_idx on orders (paid_at desc) where status = 'paid';

-- --- Admin audit log ----------------------------------------------------------
create table admin_audit (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id) on delete set null,
  actor_email text,
  action      text not null,
  target_type text,
  target_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index admin_audit_created_idx on admin_audit (created_at desc);
create index admin_audit_target_idx on admin_audit (target_type, target_id);
alter table admin_audit enable row level security;
create policy "admin_audit: admin read" on admin_audit for select using (public.is_admin());

-- --- Analytics -----------------------------------------------------------------
-- Paid orders per day and currency since p_from.
create or replace function public.admin_sales_daily(p_from timestamptz)
returns table (day date, currency text, orders int, revenue_minor bigint)
language sql stable security definer set search_path = public
as $$
  select coalesce(paid_at, created_at)::date, currency, count(*)::int, sum(amount_minor)::bigint
  from public.orders
  where status = 'paid' and coalesce(paid_at, created_at) >= p_from
  group by 1, 2
  order by 1;
$$;

-- Best sellers since p_from (paid order lines).
create or replace function public.admin_top_sellers(p_from timestamptz, p_limit int default 10)
returns table (wallpaper_id uuid, title text, slug text, sales int)
language sql stable security definer set search_path = public
as $$
  select w.id, w.title, w.slug, count(*)::int
  from public.order_items i
  join public.orders o on o.id = i.order_id and o.status = 'paid' and coalesce(o.paid_at, o.created_at) >= p_from
  join public.wallpapers w on w.id = i.wallpaper_id
  group by w.id, w.title, w.slug
  order by 4 desc
  limit p_limit;
$$;

-- Most viewed since p_from (raw events + daily rollups).
create or replace function public.admin_top_viewed(p_from timestamptz, p_limit int default 10)
returns table (wallpaper_id uuid, title text, slug text, views bigint)
language sql stable security definer set search_path = public
as $$
  with v as (
    select wallpaper_id, count(*)::bigint as n from public.events
    where type = 'detail_view' and created_at >= p_from and wallpaper_id is not null group by 1
    union all
    select wallpaper_id, sum(count)::bigint from public.events_daily
    where type = 'detail_view' and day >= p_from::date and wallpaper_id is not null group by 1
  )
  select w.id, w.title, w.slug, sum(v.n)::bigint
  from v join public.wallpapers w on w.id = v.wallpaper_id
  group by w.id, w.title, w.slug
  order by 4 desc
  limit p_limit;
$$;

-- Funnel counts by event type since p_from.
create or replace function public.admin_funnel(p_from timestamptz)
returns table (type text, total bigint)
language sql stable security definer set search_path = public
as $$
  select t, sum(n)::bigint from (
    select type::text as t, count(*)::bigint as n from public.events where created_at >= p_from group by 1
    union all
    select type::text, sum(count)::bigint from public.events_daily where day >= p_from::date group by 1
  ) x group by t;
$$;

-- Paid orders by region tier (from currency / billing country) since p_from.
create or replace function public.admin_sales_by_country(p_from timestamptz)
returns table (country text, currency text, orders int, revenue_minor bigint)
language sql stable security definer set search_path = public
as $$
  select coalesce(billing_country, '—'), currency, count(*)::int, sum(amount_minor)::bigint
  from public.orders
  where status = 'paid' and coalesce(paid_at, created_at) >= p_from
  group by 1, 2
  order by 3 desc;
$$;

-- Paginated, searchable customer list with purchase counts.
create or replace function public.admin_customers(p_q text, p_limit int, p_offset int)
returns table (id uuid, email text, display_name text, role user_role, country_code text, gstin text,
               created_at timestamptz, paid_orders int, owned int, total_count bigint)
language sql stable security definer set search_path = public
as $$
  with base as (
    select p.* from public.profiles p
    where p_q is null or p_q = '' or p.email ilike '%' || p_q || '%' or p.display_name ilike '%' || p_q || '%'
  )
  select b.id, b.email, b.display_name, b.role, b.country_code, b.gstin, b.created_at,
         (select count(*)::int from public.orders o where o.user_id = b.id and o.status = 'paid'),
         (select count(*)::int from public.entitlements e where e.user_id = b.id),
         count(*) over ()
  from base b
  order by b.created_at desc
  limit p_limit offset p_offset;
$$;

revoke execute on function public.admin_sales_daily(timestamptz) from public, anon, authenticated;
revoke execute on function public.admin_top_sellers(timestamptz, int) from public, anon, authenticated;
revoke execute on function public.admin_top_viewed(timestamptz, int) from public, anon, authenticated;
revoke execute on function public.admin_funnel(timestamptz) from public, anon, authenticated;
revoke execute on function public.admin_sales_by_country(timestamptz) from public, anon, authenticated;
revoke execute on function public.admin_customers(text, int, int) from public, anon, authenticated;
grant execute on function public.admin_sales_daily(timestamptz) to service_role;
grant execute on function public.admin_top_sellers(timestamptz, int) to service_role;
grant execute on function public.admin_top_viewed(timestamptz, int) to service_role;
grant execute on function public.admin_funnel(timestamptz) to service_role;
grant execute on function public.admin_sales_by_country(timestamptz) to service_role;
grant execute on function public.admin_customers(text, int, int) to service_role;

-- ================================================================
-- >>> supabase/migrations/0013_rate_limits.sql
-- ================================================================
-- =============================================================================
-- HirecWallp — shared rate limiting for public endpoints (contact, newsletter,
-- takedown, analytics). Works across all serverless instances.
-- =============================================================================

create table rate_hits (
  key text not null,
  at  timestamptz not null default now()
);
create index rate_hits_key_at_idx on rate_hits (key, at desc);
alter table rate_hits enable row level security; -- service role only

-- Record a hit for p_key and say whether it is within p_limit per p_window_s.
create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_s int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count from public.rate_hits
  where key = p_key and at > now() - make_interval(secs => p_window_s);
  if v_count >= p_limit then
    return false;
  end if;
  insert into public.rate_hits (key) values (p_key);
  return true;
end;
$$;
revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- Keep the table tiny: housekeeping also removes hits older than a day.
create or replace function public.housekeeping(p_keep_days int default 90)
returns int
language plpgsql
security definer
set search_path = public
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

  return v_deleted;
end;
$$;

-- ================================================================
-- >>> supabase/migrations/0014_perf_tuning.sql
-- ================================================================
-- =============================================================================
-- HirecWallp — performance tuning from the Supabase advisors (pre-launch).
-- * RLS: wrap auth.uid() in (select …) so Postgres evaluates it once per
--   query instead of once per row (same rules, same roles — only faster).
-- * Indexes on hot foreign keys (refunds, library, downloads, creator pages,
--   deletes that cascade/check references).
-- Security advisor notes reviewed and intentionally kept:
--   is_admin()/is_creator()/my_credit_balance() are callable because RLS and
--   the browser use them; they only ever answer about the caller.
--   rate_hits / webhook_events have RLS on with no policies = service role only.
-- =============================================================================

alter policy "creator_payouts: read own" on creator_payouts using (creator_id = (select auth.uid()));
alter policy "creators: read own"        on creators        using (user_id = (select auth.uid()));
alter policy "credit_ledger: read own"   on credit_ledger   using (user_id = (select auth.uid()));
alter policy "downloads: read own"       on downloads       using (user_id = (select auth.uid()));
alter policy "entitlements: read own"    on entitlements    using (user_id = (select auth.uid()));
alter policy "favourites: add own"       on favourites      with check (user_id = (select auth.uid()));
alter policy "favourites: read own"      on favourites      using (user_id = (select auth.uid()));
alter policy "favourites: remove own"    on favourites      using (user_id = (select auth.uid()));
alter policy "memberships: read own"     on memberships     using (user_id = (select auth.uid()));
alter policy "orders: read own"          on orders          using (user_id = (select auth.uid()));
alter policy "price_quotes: read own"    on price_quotes    using (user_id = (select auth.uid()));
alter policy "profiles: read own"        on profiles        using (id = (select auth.uid()));
alter policy "profiles: update own (not role)" on profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy "order_items: read own via order" on order_items using (
  exists (select 1 from orders o where o.id = order_items.order_id and o.user_id = (select auth.uid()))
);

create index if not exists entitlements_order_idx      on entitlements (order_id);
create index if not exists entitlements_wallpaper_idx  on entitlements (wallpaper_id);
create index if not exists downloads_entitlement_idx   on downloads (entitlement_id);
create index if not exists downloads_wallpaper_idx     on downloads (wallpaper_id);
create index if not exists order_items_wallpaper_idx   on order_items (wallpaper_id);
create index if not exists order_items_pack_idx        on order_items (credit_pack_id) where credit_pack_id is not null;
create index if not exists order_items_set_idx         on order_items (set_id) where set_id is not null;
create index if not exists order_items_plan_idx        on order_items (membership_plan_id) where membership_plan_id is not null;
create index if not exists wallpapers_creator_idx      on wallpapers (creator_id) where creator_id is not null;
create index if not exists favourites_wallpaper_idx    on favourites (wallpaper_id);
create index if not exists events_user_idx             on events (user_id) where user_id is not null;
create index if not exists memberships_plan_idx        on memberships (plan_id);
create index if not exists price_quotes_wallpaper_idx  on price_quotes (wallpaper_id);
create index if not exists takedown_wallpaper_idx      on takedown_reports (wallpaper_id) where wallpaper_id is not null;
create index if not exists social_posts_wallpaper_idx  on social_posts (wallpaper_id);
create index if not exists generation_jobs_wallpaper_idx on generation_jobs (wallpaper_id) where wallpaper_id is not null;

-- ================================================================
-- >>> supabase/migrations/0015_credit_economy.sql
-- ================================================================
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

-- ================================================================
-- >>> supabase/migrations/0016_entitlement_source.sql
-- ================================================================
-- =============================================================================
-- HirecWallp — where each library item came from (creator earnings valuation)
-- entitlements.source: 'order' (paid order / webhook), 'credits' (credit spend),
-- 'membership' (pass claim), 'gift' (admin). Creator payouts value credit spends
-- and membership claims at site setting `creator_credit_value_inr` per credit.
-- =============================================================================

alter table entitlements add column if not exists source text
  check (source in ('order', 'credits', 'membership', 'gift'));
update entitlements set source = case when order_id is not null then 'order' else 'gift' end where source is null;
create index if not exists entitlements_source_created_idx on entitlements (source, created_at);

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

  insert into public.entitlements (user_id, wallpaper_id, licence, max_downloads, source)
  values (p_user, p_wallpaper, p_licence, p_max_downloads, 'credits')
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

    insert into public.entitlements (user_id, wallpaper_id, licence, max_downloads, source)
    values (p_user, p_wallpaper, v_licence, p_max_downloads, 'membership')
    returning id into v_id;

    update public.memberships
    set period_start = v_pstart, period_used = v_used + 1, downloads_used = downloads_used + 1
    where id = m.id;
    return v_id;
  end loop;
  return null;
end;
$$;

-- ================================================================
-- >>> supabase/seed/seed.sql
-- ================================================================
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
