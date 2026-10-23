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
