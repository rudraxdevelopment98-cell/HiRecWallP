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
