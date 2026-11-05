# CLAUDE.md — HirecWallp

Guidance for Claude Code (and humans) working in this repo. Keep this file
updated with commands, structure and decisions as the build progresses.

## What this is

**HirecWallp** — a premium platform selling ultra-HD AI-generated wallpapers
(phone, desktop, tablet). Free tier for traffic/SEO; cheap paid downloads with
country-based dynamic pricing; secure delivery; automated social marketing
(Phase 2); creator marketplace (Phase 3).

- Business entity: **India**. Domain: hirecwallp.com. Owner: Kuldeep (single admin at launch).
- Full business + technical context: [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md)
- Machine-readable spec (source of truth for scope): [`docs/project-spec.json`](docs/project-spec.json)

**Build one phase at a time. Do not start the next phase without explicit owner approval.**
Phases 1 (MVP) and 2 (Automation) are complete and on `main`. We are now building
**Phase 3 (Creator Marketplace)** — `phases[2]`: creator onboarding + KYC, creator
upload with automated moderation (resolution, pHash dup, NSFW/IP/brand via vision),
commission engine (default 30%) + monthly payouts, earnings dashboard, agreement.
Owner gave explicit go-ahead (the spec's sales-metrics gate). Payout/KYC/moderation
stay behind adapters with built-in **mock** implementations; real Razorpay Route /
PayPal Payouts / vision slot in via env.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15.5 (App Router) + React 19 + TypeScript (**strict**) |
| Styling | Tailwind CSS + shadcn/ui-style tokens · **"Obsidian Stone" dark theme** (warm stone neutrals) with CSS/IntersectionObserver motion (reduced-motion + no-JS safe) |
| DB / Auth | Supabase (Postgres, Auth: email OTP + Google, **RLS on every table**) |
| Originals | Cloudflare R2 **private** bucket (S3 API) — never public |
| Previews | Cloudflare R2 **public** bucket behind CDN |
| Image processing | `sharp` (resize, watermark, mockups, previews) — added when upload lands |
| Payments | **Razorpay** (INR UPI + International cards for credit packs), behind a `PaymentProvider` adapter |
| AI metadata/review | Claude API (vision) — Phase 2 |
| Email | Resend |
| Hosting | Vercel (web), Supabase (db), R2 (files) |
| Testing | Vitest (unit), Playwright (critical flows) |

Provider integrations (image/upscale/payments) stay behind **adapters** so they
can be swapped without touching business logic.

## Commands

```bash
npm run dev          # local dev server (http://localhost:3000)
npm run build        # production build
npm run start        # serve production build
npm run lint         # ESLint (next/core-web-vitals + typescript)
npm run typecheck    # tsc --noEmit (strict)
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright critical-flow tests
npm run format       # Prettier write
```

Run **lint + typecheck + unit tests** after each step; run e2e before
declaring a flow done.

## Folder structure

```
docs/                     # BLUEPRINT.md + project-spec.json (source of truth)
src/
  app/                    # Next.js App Router (routes, layouts, API routes)
  components/             # Reusable UI (ui/ = shadcn-style primitives)
  lib/                    # Non-UI logic: supabase clients, env, geo/region,
                          #   payments adapter, security, utils
  types/                  # Shared TypeScript types
supabase/
  migrations/             # SQL migrations (Phase 1 schema + RLS)
  seed/                   # Seed script: regions, price rules, packs, samples
tests/
  e2e/                    # Playwright specs (browse, free download, purchase, secure download)
seed/                     # Local sample wallpaper source assets (gitignored originals)
```

## Conventions

- **TypeScript strict** everywhere; no `any` without justification. Path alias `@/*` → `src/*`.
- **Secrets only via env vars** (see `.env.example`). Never commit `.env*`.
  Only `NEXT_PUBLIC_*` vars may reach the browser bundle; everything else is server-only.
- Money stored in **minor units** with an explicit currency. **Everything is bought with credits**
  (India too, since 2026-11-03); wallpapers are priced in credits, credit packs/plans in money.
- Money/tax logic is **configurable and flagged for CA review** (GST India, VAT UK/EU).
- Every wallpaper is `is_ai_generated` and shows an "AI-generated" label on detail pages.
- Legal pages (`/terms`, `/privacy`, `/refunds`, `/delivery`, `/licence`, `/grievance`) are full drafts matching real
  behaviour (shared `LegalDoc`, versions in `src/lib/policies.ts`; bump the version on material changes). Owner has no
  lawyer — keep them accurate to the code when features change.
- Small, focused commits. Conventional-commit style prefixes (`feat:`, `chore:`, `docs:`, `fix:`).

## Security requirements (mandatory acceptance criteria — `security_requirements` in spec)

- Original full-res files live **only** in the private bucket. No code path returns
  a permanent/public URL to them.
- Public previews: max 720px long edge, ~JPEG q70, tiled diagonal visible watermark,
  generated server-side at publish time. Detail crop: max 600×600 @ 1:1, watermarked.
- Download flow: `POST /api/download {wallpaperId, variant}` → auth → entitlement
  (or `is_free`) → atomically increment `downloads_used` → **60-second presigned R2 URL**
  → log in `downloads`.
- Max 5 downloads/entitlement (configurable); rate limit 30 downloads/hour per user and per IP hash.
- Free variants: no login, rate-limited per IP, never include 4K+ originals.
- Entitlements are created **only from verified payment webhooks** (HMAC signature check),
  never from client redirects. Webhook handlers idempotent on provider event id.
- RLS on all tables; users read only their own orders/entitlements/credit_ledger/downloads.
- Admin routes protected by **server-side role check** (middleware + RLS), not just hidden UI.
- Region pricing displayed by IP geo, but at checkout compare with billing/card country;
  on mismatch charge the **higher-priced** region.
- Security headers: CSP, HSTS, X-Frame-Options, Referrer-Policy; CSRF protection on mutating routes.

## Key decisions / log

- **2026-10-23** — Added `docs/BLUEPRINT.md` + `docs/project-spec.json`; began Phase 1.
- **2026-10-23** — Scaffolded Next.js 14.2.35 (App Router), TS strict, Tailwind,
  ESLint, Vitest, Playwright. Chose Next 14 (stable App Router) over 15/16 to
  keep the MVP on a well-supported line; revisit before launch.
- **Pinned** Next to the latest patched 14.2.x (14.2.35) for the Dec-2025 advisory.
  `npm audit` still flags transitive **dev-tooling** deps (vitest/vite/esbuild/postcss,
  build-time only, not shipped) and wants a major Next 16 bump — tracked, not actioned
  mid-scaffold. Re-evaluate before production deploy.

## Phase 1 build order (checklist)

1. [x] Project scaffold (Next + TS + Tailwind + test tooling)
2. [x] CLAUDE.md
3. [x] Supabase SQL migration (Phase 1 tables + RLS) + seed script — **confirm with owner**
4. [x] Core lib: env validation, Supabase clients, geo/region, payments adapter iface, security headers
5. [x] Public pages: home, explore, detail, collections, sets, free, search, legal + takedown form
6. [x] **PAUSE — folder structure + SQL migration confirmed; defaults accepted**
7. [x] Razorpay (INR per-item + sets; international credit packs); spend credits
8. [x] Secure download flow (presigned 60s URLs, counters, rate limits)
9. [x] Admin upload (sharp → variants/previews/crop/free) + catalogue
10. [x] My Library with download counters
11. [x] Event tracking, SEO basics (sitemap/robots/JSON-LD), Playwright critical-flow tests

## Phase 2 build order (checklist)

1. [x] Migration 0004 (prompt_library, generation_jobs, social_posts, jobs_log) + RLS + commercial multiplier
2. [x] AI adapters (image/upscale/vision) with built-in mock providers; pHash dedup
3. [x] Jobs: generate_batch, publish_approved, social_scheduler, dynamic_pricing, weekly_report
4. [x] Admin pages: review queue, prompts, pricing (dry-run + apply), social calendar
5. [x] Forensic watermark worker (worker/) + download integration + admin decode
6. [x] Commercial-licence SKU (migration 0005; checkout/unlock/webhook/detail)

Key Phase 2 decisions:
- Providers default to **mock** (offline/CI-safe); real IMAGE_PROVIDER / UPSCALE_PROVIDER /
  ANTHROPIC_API_KEY / IG / Pinterest slot in via env without code changes.
- Jobs run via `/api/jobs/*` (Vercel Cron GET + admin POST), authorized by CRON_SECRET
  or admin role; every run is logged to `jobs_log`.
- Watermarked paid downloads are cached at `wm/<entitlement>/<variant>.jpg`.

## Phase 3 build order (checklist)

1. [x] Migration 0006 (creators, creator_payouts) + RLS + is_creator()
2. [x] Adapters: payouts/KYC (Razorpay Route / PayPal Payouts) + vision moderation (mock-first)
3. [x] Creator onboarding (/api/creator/onboard) + upload with moderation (/api/creator/upload)
4. [x] Commission engine + monthly payouts job (/api/jobs/creator-payouts; vercel cron 1st)
5. [x] Creator pages: dashboard/onboard, upload, earnings, payouts (+ admin payouts trigger)

Key Phase 3 decisions:
- Creator uploads land as `pending_review` with `creator_id`; admins approve via the
  existing Catalogue publish flow (reused).
- Payouts computed from paid **INR (money)** sales; credit-based international sales
  valuation into payouts is a flagged follow-up.
- KYC/payout/moderation default to **mock**; real providers slot in via env.

## Real payments + auth (post-redesign)

- Checkout (`/checkout`) asks `GET /api/checkout/status`; when Razorpay + Supabase env
  are set it runs real Razorpay Standard Checkout, otherwise the **demo** flow.
- India/INR: `create-order {type:'cart'}` → Razorpay → success page polls
  `/api/orders/[id]` until the webhook marks it paid. Elsewhere: `/api/credits/unlock-cart`
  → 402 shows packs (`/api/credits/packs?billingCountry=`) → buy pack → poll
  `/api/credits/balance` → auto-unlock.
- Charged region = higher-priced of display vs billing country (`chargeRegionFor`);
  credits are spent at the highest tier the user bought them in (`resolveCreditRegion`).
- Webhook: claims `created → paid` atomically; INR orders paid with an international
  card are refunded + marked `refunded`, nothing granted; on processing error the
  idempotency key is released so Razorpay retries.
- Auth: `/login` (email OTP code or magic link + Google), `/auth/callback`
  (open-redirect-safe `next`), `POST /auth/signout`; middleware refreshes the session.
- **2026-10-28 security fixes (migration 0007):** SECURITY DEFINER payment/credit
  RPCs were executable by `authenticated` (self-grant entitlements/credits) and
  `profiles` allowed self-update of `role` (self-promote to admin). Both locked down;
  browser-safe `my_credit_balance()` added.

## Storage strategy (2026-10-29) — see docs/STORAGE_STRATEGY.md

- Variants are orientation-aware and never upscaled >15% (`plannedSizes`); masters stored
  as JPEG (PNG→q95 4:4:4) at `wallpapers/<id>/master.jpg`. ≈8–13 MB/wallpaper (was ≈71 MB).
- Large uploads: browser → presigned PUT (`/api/uploads/sign`, `incoming/<uid>/`) → upload
  route reads via `readUpload`. Bypasses Vercel's 4.5 MB body limit.
- R2 lifecycle (admin "Apply storage rules"): incoming/ 1d, wm/ 7d, generation/ 45d.
- `images.unoptimized` (Vercel Hobby 5K transforms/mo); public objects cached immutable.
- Migration 0008: `events_daily` + `housekeeping()` daily cron keeps 30 days of raw events.
- Owner decisions pending: Vercel Pro before taking payments (Hobby is non-commercial),
  Supabase Pro at launch (free pauses after 7 days idle), R2 custom domain for previews.

## Site audit (2026-10-30) — see docs/SITE_AUDIT.md

- Removed fake content (discounts, ratings, invented stats, 8K claims, membership plans, live chat).
- Customer account: /account (settings + GSTIN), /account/orders (+ printable receipt with
  sequential invoice no. via `assign_invoice`), /account/credits, /account/favourites.
- Catalogue: `searchWallpapers` with real device/orientation/resolution filters (public
  `wallpapers.orientation|max_long_edge|devices`, set at upload), sort, paging; display price
  falls back to the global rule like checkout does.
- Admin: per-currency revenue, catalogue edit/unpublish/archive/delete (delete blocked once
  sold), orders, customers, creators (KYC/commission), messages (contact + takedowns),
  newsletter CSV. Migration 0009.

## Admin control centre + membership (2026-10-30)

- `site_settings` (migration 0010) + `getSettings()` (30 s cache): store_open, membership_enabled,
  creator_signups, free_downloads, newsletter_enabled, downloads_per_purchase, announcement bar.
  Edited at /admin/settings; enforced in create-order, credit unlocks, download (free), creator
  onboard, newsletter API, and the UI.
- Membership = **prepaid pass** (no auto-renew; avoids RBI e-mandate rules). Plans in
  `membership_plans` (per-region prices in minor units). create-order `{type:'membership'}` →
  webhook `grant_membership` (stacks renewals) → members use `/api/membership/claim`
  (`member_unlock`, allowance per pass). Admin: /admin/membership (plans CRUD, comp passes,
  extend/allowance/revoke). Starter plans seeded **inactive**.
- Also editable now: default prices + commercial multiplier per region, credit packs,
  categories, sets (`src/lib/admin-crud.ts` + `src/lib/admin-schemas.ts`).

## Security upgrade (2026-10-30)

- Next 14.2.35 → **15.5.28** (patches every open Next advisory incl. critical image-optimizer RCEs),
  React 19, sharp 0.35.5 (libvips CVEs — matters: we process creator uploads), zod 4,
  @supabase/ssr 0.12; nested postcss pinned via `overrides`. `npm audit --omit=dev` = 0.
- Async request APIs: `createClient()` (server) and `getDisplayRegion()` are **async** — always
  `await`. Page/route `params`/`searchParams` are Promises.
- Layouts and pages render in parallel in Next 15, so every protected page calls
  `requireUser()` / `requireAdmin()` itself; middleware also gates `/admin` + `/api/admin`.
- Next 16 later: needs `next lint` → ESLint CLI and middleware → proxy migration.

## Storage provider (2026-11-02)

- `src/lib/storage` (`storage()` picks provider): **Supabase Storage default** (buckets from
  migration 0011, service-role key, 50 MB/file) or **R2** when all `R2_*` env vars are set /
  `STORAGE_PROVIDER=r2`. Import storage helpers from `@/lib/storage` (old `@/lib/r2` removed).
- Public preview URLs via `publicObjectUrl()`; `DOWNLOAD_TOKEN_SECRET` optional (derived
  from the service key if absent). Housekeeping cron cleans temp files on Supabase.

## Production admin (2026-11-02)

- Migration 0012: `profiles.email` (synced from auth by trigger), `orders.provider_payment_id`
  (webhook stores it), `admin_audit`, SQL functions `admin_sales_daily|admin_top_sellers|
  admin_top_viewed|admin_funnel|admin_sales_by_country|admin_customers` (service role only).
- Admin: /admin/analytics, paginated+searchable orders (CSV export, detail, **refund** via
  `refundOrder()` which revokes entitlements/credits/passes), customers (detail: credits ±,
  gift, block/unblock via auth ban, role), catalogue bulk actions (`/api/admin/wallpapers/bulk`,
  shared `publishWallpapers()`), /admin/activity (every admin mutation calls `audit()`),
  /admin/health. Grouped nav in `components/admin/admin-nav.tsx`.
- Use `emailsFor()` / `userIdByEmail()` (profiles) — never list all auth users.
- Funnel events: view, detail_view, add_to_cart, checkout_start (client `track()`), purchase (webhook).
- Migration 0013: `rate_limit_hit()` + `allowRequest()`; honeypot field `website` on public forms.

## Settings polish + DB tuning (2026-11-03)

- `site_settings` keys `business` (legal name, address, GSTIN, GST %, support email), `social`
  (instagram/pinterest/youtube/x/facebook) and `google_login` — edited at /admin/settings.
  Read via `sellerDetails()` / `socialLinks()` (settings first, `BUSINESS_*` / `NEXT_PUBLIC_SOCIAL_*`
  env as fallback). Google button hidden until `google_login` is on (enable the provider in Supabase first).
- FAQ shows membership answers only while membership is on; download count follows the setting.
- Migration 0014: RLS policies use `(select auth.uid())` (evaluated once per query) + hot FK indexes.
  Remaining advisor notes are intentional (see migration header); leaked-password check n/a (no passwords).

## Responsiveness (2026-11-03)

- Functions run in **bom1 (Mumbai)** via `vercel.json` `regions`, next to Supabase ap-south-1
  (was iad1 → every DB call crossed the globe).
- `getUser()` / `isAdminUser()` are React `cache()`d: layout + page share one auth round trip.
- `loading.tsx` for /admin and /account (instant skeleton on click); global `NavigationProgress`
  top bar (call `startNavigationProgress()` before a programmatic `router.push`).
- Admin client components use `useRefresh()` (`router.refresh()` in a transition) and stay
  "busy" until the refreshed data is on screen. Use it instead of bare `router.refresh()`.
- Admin sidebar is sticky with its own scroll; mobile section picker is sticky and uses client navigation.

## Credit economy (2026-11-03) — migrations 0015 + 0016

- **Credits everywhere.** 1 credit ≈ 1 wallpaper (all sizes); commercial ×5. India's per-item ₹
  checkout is gone (`create-order` rejects `cart`/`wallpaper` with `use_credits`).
- **5 tiers** in `src/lib/geo.ts` (IN, T1–T4; unknown → T3) + admin overrides (`site_settings.country_tiers`,
  /admin/countries). Middleware sets a `country` cookie from the geo header; `getDisplayCountry()` /
  `getDisplayRegion()` / `getPriceContext()` (catalogue.ts, React-cached). Country picker in header/footer.
- **Price points:** `credit_packs` and `plan_prices` rows have `region_code` + optional `country_codes`
  (local currency, e.g. GBP for GB). `pickPricePoints(rows, ctx, key)` → country row beats tier row.
  Charged context = `chargeContext(displayCountry, displayRegion, billingCountry)` (higher tier wins;
  IN cheapest, protected by the foreign-card refund). Seeded T4 USD prices are always > India's ₹.
- **Bonus credits:** packs have `bonus_credits`; `add_pack_credits()` writes a paid entry + a bonus *lot*
  (`credit_ledger.bucket='bonus'`, `expires_at` +365d). `credit_balance()` = paid + unexpired lot remainders;
  `spend_credits_and_entitle()` uses bonus lots first; `reverse_order_credits()` for refunds;
  `housekeeping()` writes `expire` entries. Paid credits never expire.
- **Plans** (`membership_plans.kind`: monthly | contract | category | business; `term_months`;
  `download_limit` = per 30-day period; `category_id` for category passes). `member_unlock()` picks the
  narrowest covering pass with allowance left this period (no rollover). Pricing page tabs: `/pricing?tab=`.
- **Autopay** = Razorpay Subscriptions (`src/lib/subscriptions.ts`, adapter `SubscriptionCapable`):
  plan created lazily per `plan_prices` row (`provider_plan_id`, cleared on price edit); webhook
  `subscription.charged` → order `subpay_<payment>` + `grant_membership(..., p_days 30, p_subscription)`.
  One-click cancel `/api/membership/autopay/cancel` (cancel at cycle end) — required by India's dark-pattern rules.
- **Creator payouts** value credit spends + membership claims (`entitlements.source`) at
  `creator_credit_value_inr` (default ₹5) per credit. ⚠️ CA review: GST on credits/subscriptions, credit value, TDS.
- No dark patterns: no countdowns, fake scarcity, struck-through prices, pre-ticked add-ons or hidden fees;
  savings badges are computed from real prices (e2e checks this on /pricing).

## Price lock + referrals (2026-11-03) — migration 0017

- **No country picking** (researched Netflix/Spotify/Steam/Epic: price follows account + payment
  method, never a user choice). `getPriceContext()` = `strictestContext([locked account country,
  IP header country, browser time-zone country])`; `getChargeContext(billing)` adds the declared
  billing country. Signals can only raise the tier. Header shows a non-interactive country label.
- `tz` cookie set by the inline script in the root layout; `src/lib/timezones.ts` (generated from
  tzdata zone.tab) maps zone → country. The `country` cookie is ignored on Vercel (dev/tests only).
- `profiles.price_country` is locked by `after_paid_order()` (webhook + subscription charges) on the
  first paid order; admins change it on the customer page (customer moved). Not client-writable.
- Razorpay only reports Indian vs foreign card (no foreign card country), so India is hard-protected
  (foreign card on INR → refund) and other tiers rely on the stacked signals above.
- **Welcome bonus + referrals** (`site_settings.growth`, Admin → Settings → Growth): `claim_welcome_bonus()`
  (auth callback + account layout; once per account; ≤2 per hashed IP per 30 days; referral code from the
  `ref` cookie set by `/r/[code]`, new accounts only, no same-network self-referral). Inviter rewarded by
  `after_paid_order()` only on the friend's first PAID order, capped monthly; refund reverses it.
  All are expiring bonus lots. `/account/referrals` shows the link, WhatsApp share and stats.

## Growth engine (2026-11-03) — migration 0018 (Admin → Growth + Settings → Growth)

- **First-purchase bonus:** `first_purchase_bonus()` from the webhook (once per account, `profiles.first_bonus_at`;
  keyed to the order so refunds reverse it).
- **Gift credits:** `create-order {type:'credit_pack', gift:{email,from,message}}` → webhook `create_gift()` (12-char code,
  12-month validity) + `sendGiftEmail()`; `/gift`, `/gift/[code]`, `/api/gifts/redeem` → `redeem_gift()` (atomic). Region rule
  `canRedeemIn()`: redeem only in the same or a cheaper tier (Steam-style). Refund voids unused codes / reverses redeemed credits.
- **Festival drops:** `sale_starts_at`/`sale_ends_at` on packs + plans (`isOnSale()` filters listings and checkout;
  pricing shows "Available until …"). Admin datetime fields are IST (`toIstInput`/`fromIstInput`). Seeded inactive
  "Diwali Festival Pass" (25 Oct – 12 Nov 2026).
- **Creator affiliates:** `?via=CODE` on any URL → httpOnly `aff` cookie (middleware, 30 days, last click) →
  `resolveAffiliate()` stamps `orders.affiliate_id` → webhook `record_affiliate_commission()` (pct, cap 50%, creators only,
  no self) → creator payouts add commissions in INR via `site_settings.fx_to_inr` (`toInr()`), tied by `payout_period`.
  Autopay subscription charges are not attributed (known limitation).
- **Daily free wallpaper:** `pick_daily()` (idempotent, avoids repeats for 60 days) via cron `/api/jobs/daily-pick`
  (18:35 UTC = 00:05 IST) or lazily on first visit; `claim_daily_pick()` → entitlement `source='daily'` (no creator payout).
  Opt-in email (never pre-ticked) to `newsletter_subscribers.daily`, capped per day, signed one-click unsubscribe
  (`/api/newsletter/unsubscribe`, RFC 8058 POST too).

## Tax & compliance (2026-11-03) — migration 0019, docs/TAX_COMPLIANCE.md

- Owner has no CA: rules are encoded and tracked; **Admin → Tax centre** (`/admin/tax`) shows FY turnover vs the
  ₹20 lakh GST limit (`gstThresholdStatus`), presumptive profit (s.58, 6%), upcoming deadlines (`upcomingDeadlines`),
  to-dos, editable `site_settings.tax`, and CSV registers (`/api/admin/tax/sales-register`, `/tds-register`).
- Receipts use `gstTreatment()` (unregistered receipt / CGST+SGST / IGST / export under LUT).
- Creator payouts deduct TDS via `computeTds()` (s.393 T8(v) 0.1%/5%, ₹5L individual exemption; T1(ii) 2%/20% above
  ₹20k with catch-up; non-residents flagged, not automated); payout rows store `affiliate`, `tds_*`, `financial_year`.
  Onboarding collects PAN, residency, entity type.
- FX: `refreshFxRates()` (ECB via Frankfurter, free, no key; sanity-checked) monthly cron `/api/jobs/fx-rates`
  (05:15 UTC on the 1st, before payouts) + Tax centre button; `fx_meta` records source/date.

## Policies & consent (2026-11-03) — migration 0020, docs/SITE_AUDIT_2.md

- Grievance officer details: `site_settings.legal` (Admin → Settings), shown via `getLegalContext()`.
- `recordAcceptance()` writes `policy_acceptances` (terms+privacy on sign-in, terms+refunds at checkout, creator at onboarding).
- `housekeeping()` strips hashed IP / user agent from download logs older than 12 months (watermark trace kept).

## Admin UI system (2026-11-03)

- `/admin` has its own shell (`AdminSidebar` + `AdminTopbar` in `components/admin/admin-nav.tsx`); the store
  header/footer/announcement skip rendering via `isAdminRoute()` (`x-hw-path` header set in middleware).
- Sidebar badges come from `getAdminCounts()` (`src/lib/admin-counts.ts`, cached per request).
- Build admin pages from `components/admin/ui.tsx` (`PageHeader`, `Section`, `Stat`/`StatGrid`, `FilterTabs`,
  `EmptyState`, `DetailList`) and the CSS classes `.admin-card`, `.admin-table`, `.admin-btn`, `.admin-btn-primary`.
- Settings tabs: `/admin/settings?tab=general|business|growth|prices` — deep-link to the right tab.

## Support & self-serve refunds (2026-11-03) — migration 0021

- `support_tickets` (number → `ticketRef()` HW-T1001, SLA `ack_due_at` +48 h / `resolve_due_at` +30 d, priority high for
  refund/wrong_charge) + `support_messages` (`internal` notes hidden by RLS). Writes only via API (service role).
- Customer: `/account/support`, `/new?order=&category=`, `/[id]`; "Get help" on each order. APIs `/api/support/tickets`, `/[id]/reply`.
- Admin: `/admin/support` (tabs needs reply / overdue / waiting / resolved) + `/admin/support/[id]` → `/api/admin/support/[id]`
  (reply, note, status, assign, priority, refund, credits, restore_downloads); every action audited + noted in the thread.
- Self-serve refund: `refund_facts()` SQL → pure `selfRefundDecision()` (`src/lib/refund-rules.ts`, mirrors /refunds) →
  `selfRefund()` → `refundOrder()` + a resolved ticket. Max 2 per 90 days. Keep rules and policy text in sync.
- `support_retention()` (housekeeping) deletes resolved tickets without an order after 3 years (Privacy Policy).

## Device preview (2026-11-05)

- `/w/[slug]` uses `DevicePreview` (`components/device-preview.tsx`): tabs "On your <device>" (auto, `detectDevice()` in
  `src/lib/device-detect.ts` from UA + screen × DPR; iPadOS detected by touch) / Phone / Tablet / Desktop / Original,
  lock- or home-screen overlay, full-screen try-on, `sharpnessOn()` hint vs `max_long_edge`. Uses only the public
  watermarked preview — never the original. Generic frames (no brand styling).

## Account rights + account emails (2026-11-05) — migration 0022

- Settings: change email (`/api/account/email`, Supabase confirmation), sign out everywhere (`/api/account/signout-all`),
  download my data (`/api/account/export` → `buildExport()`), close account (`/api/account/close`, type email to confirm).
- `closeAccount()` (src/lib/account.ts): cancel autopay → `close_account()` SQL (forfeit credits with `closure` ledger rows,
  revoke passes, delete library/favourites/order-less tickets/newsletter, anonymise downloads, blank profile, `deleted_at`)
  → auth email → `deleted-<id>@deleted.invalid` + ban. Orders stay (tax). Blocked for admins / pending creator payouts.
- Emails (`src/lib/account-emails.ts`, shared `mail-template.ts`): receipt once per paid order (`orders.receipt_sent_at`, from
  webhook + autopay), welcome once for new accounts, bonus-expiry reminder (housekeeping, `credit_ledger.reminded_at`).
  Claims are released when no email provider is configured, so they go out once Resend is set.

## Wallpaper URLs (2026-11-05) — migration 0023

- Canonical URL `/w/<slug>-<code>`: `wallpapers.code` is a permanent 8-char id (DB default `new_wallpaper_code()`,
  alphabet without 0/o/1/l/i, always has a digit). Build links with `wallpaperPath(w)` (src/lib/wallpaper-url.ts) — never
  `/w/${slug}`; select `code` with `slug`. `/w/[slug]` resolves by code (else slug) and 308-redirects to the canonical
  path, so old links and renamed titles keep working. Demo wallpapers use `demoCode(slug)`.

## Manual setup owner must do (grows as we go)

Tracked in the final Phase-1 checklist: API keys, Razorpay (with International
Payments enabled), Supabase project, R2 buckets, webhooks, DNS, Instagram/Pinterest
accounts, image API key. Do **not** add any paid third-party service not listed
in the spec without asking the owner first.
