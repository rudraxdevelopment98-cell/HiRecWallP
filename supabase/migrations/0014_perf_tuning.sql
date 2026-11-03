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
