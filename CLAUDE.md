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
| Framework | Next.js 14 (App Router) + TypeScript (**strict**) |
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
- Prices stored in **minor units** with an explicit currency. India in INR;
  outside India in **credits**.
- Money/tax logic is **configurable and flagged for CA review** (GST India, VAT UK/EU).
- Every wallpaper is `is_ai_generated` and shows an "AI-generated" label on detail pages.
- Legal page text is **placeholder only** — clearly marked for lawyer/accountant review.
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

## Manual setup owner must do (grows as we go)

Tracked in the final Phase-1 checklist: API keys, Razorpay (with International
Payments enabled), Supabase project, R2 buckets, webhooks, DNS, Instagram/Pinterest
accounts, image API key. Do **not** add any paid third-party service not listed
in the spec without asking the owner first.
