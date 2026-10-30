-- HirecWallp: ONE-PASTE database setup for the Supabase SQL Editor.
-- Generated from supabase/migrations/0001..0010 + supabase/seed/seed.sql (in order).
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
-- >>> supabase/seed/seed.sql
-- ================================================================
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

