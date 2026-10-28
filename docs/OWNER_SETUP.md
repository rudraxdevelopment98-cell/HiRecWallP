# HirecWallp — Phase 1 owner setup checklist

Phase 1 (MVP) code is complete and committed. The app builds and all tests
pass, but it needs the services below wired up to run end-to-end. Nothing here
is in the repo as a secret — fill these into `.env.local` (dev) and your Vercel
project (prod). **Do not commit real secrets.**

Legend: 🔑 secret/env · 🌐 account · ⚙️ config step

---

## 1. Supabase (database + auth) 🌐🔑

1. Create a Supabase project. Note the Project URL and keys (Project Settings → API).
2. Set env:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose)
3. Apply the schema, RLS and seed (see `supabase/README.md`):
   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/0001_phase1_init.sql
   psql "$DATABASE_URL" -f supabase/migrations/0002_phase1_rls.sql
   psql "$DATABASE_URL" -f supabase/migrations/0003_phase1_payments_fns.sql
   psql "$DATABASE_URL" -f supabase/migrations/0004_phase2_automation.sql
   psql "$DATABASE_URL" -f supabase/migrations/0005_phase2_commercial.sql
   psql "$DATABASE_URL" -f supabase/migrations/0006_phase3_marketplace.sql
   psql "$DATABASE_URL" -f supabase/migrations/0007_security_hardening.sql   # REQUIRED
   psql "$DATABASE_URL" -f supabase/seed/seed.sql
   ```
   ⚠️ **0007 is mandatory before going live.** Without it any signed-in user
   could call the payment RPCs directly (grant themselves wallpapers/credits)
   or set their own `profiles.role` to `admin`.
4. Auth → **Providers**: enable **Email** (keep "Confirm email" on) and
   **Google** (needs a Google Cloud OAuth client; paste its client id/secret).
5. Auth → **URL Configuration**: Site URL = `https://<your-domain>`; add
   redirect URLs `https://<your-domain>/auth/callback` (and
   `http://localhost:3000/auth/callback` for dev, plus your
   `*.vercel.app` URL if you test there).
6. Auth → **Email Templates → Magic Link**: include `{{ .Token }}` so the
   email carries the 6-digit code the sign-in page asks for (the link works too).
7. ⚙️ **Make yourself admin** (after first login creates your profile):
   ```sql
   update profiles set role = 'admin' where id = '<your-auth-user-id>';
   ```

## 2. Cloudflare R2 (file storage) 🌐🔑

1. Create two buckets: a **private** one (originals/paid/free variants) and a
   **public** one (watermarked previews) exposed via a CDN domain.
2. Create an S3 API token (Account ID + Access Key + Secret).
3. Set env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
   `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BUCKET`, `R2_PUBLIC_BASE_URL`
   (e.g. `https://cdn.hirecwallp.com`).
4. ⚙️ Confirm the private bucket has **no public access**. The public base URL
   host is auto-added to `next/image` from the env var.

## 3. Razorpay (payments) 🌐🔑

1. Create a Razorpay account for the Indian entity; complete KYC.
2. ⚙️ Request/enable **International Payments** (extra KYC) for foreign cards.
3. Set env: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
4. ⚙️ Create a **webhook** pointing at `https://<your-domain>/api/webhooks/razorpay`
   for `payment.captured` and `order.paid`; copy the signing secret into
   `RAZORPAY_WEBHOOK_SECRET`.
5. Test in **test mode** (use `rzp_test_…` keys first):
   - Region India, billing country India → cart → pay with UPI/card →
     success page shows "Confirming…" then "Payment confirmed" once the
     webhook lands; the wallpaper appears in **My Library**.
   - Billing country e.g. United Kingdom → checkout switches to **credits** →
     "Not enough credits" shows Tier-1 packs → pay with an international test
     card → credits arrive via webhook → cart unlocks automatically.
   - An INR order paid with a foreign card is **auto-refunded** by the webhook
     and nothing is granted (stops VPN users buying at Indian prices).
6. Checkout switches from the demo flow to real Razorpay automatically as soon
   as `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` **and** the Supabase env are set
   (see `GET /api/checkout/status`).

## 4. Download signing 🔑

- `DOWNLOAD_TOKEN_SECRET` — a long random string (≥16 chars). Used to hash IPs
  and sign download tokens. Generate: `openssl rand -hex 32`.

## 5. Email (Resend) 🌐🔑

- `RESEND_API_KEY` — for receipts/download emails (wired further in Phase 2).

## 6. Hosting (Vercel) 🌐⚙️

1. Import the repo into Vercel. Add all env vars above (mark server-only ones
   not as `NEXT_PUBLIC_*`).
2. `BRAND_NAME=HirecWallp`, `NEXT_PUBLIC_SITE_URL=https://<your-domain>`.
3. `CRON_SECRET` — reserved for Phase 2 scheduled jobs.

## 7. DNS / domain 🌐⚙️

1. Register/confirm **hirecwallp.com** and point it at Vercel.
2. Add the R2 public CDN hostname (`R2_PUBLIC_BASE_URL`) as a CNAME.

## 8. Phase 2 — Automation (built; wiring is optional)

Phase 2 runs end-to-end on **mock** providers with no extra keys. To make it
real, set these (each is optional and degrades gracefully):

- **Image generation / upscaling** 🌐🔑 — pick a provider whose terms allow
  commercial resale, then set `IMAGE_PROVIDER` + `IMAGE_PROVIDER_API_KEY` and
  `UPSCALE_PROVIDER` + `UPSCALE_PROVIDER_API_KEY`. (Register the concrete
  adapter in `src/lib/ai/index.ts`.) Ask me before committing to a paid one.
- **Claude vision metadata/review** 🔑 — `ANTHROPIC_API_KEY`.
- **Social** 🌐🔑 — Instagram Professional (`IG_BUSINESS_ACCOUNT_ID`,
  `IG_ACCESS_TOKEN`) and Pinterest (`PINTEREST_ACCESS_TOKEN`,
  `PINTEREST_BOARD_IDS`). (Wire the real calls in `src/lib/social/index.ts`.)
- **Forensic watermark worker** 🌐🔑 — deploy `worker/` (see `worker/README.md`)
  and set `WATERMARK_WORKER_URL` + `WATERMARK_WORKER_SECRET`. Without it, paid
  downloads simply aren't watermarked.
- **Weekly report** 🔑 — `OWNER_EMAIL` (uses `RESEND_API_KEY` from Phase 1).
- **Cron** ⚙️ — `vercel.json` schedules dynamic pricing (02:00 UTC daily),
  social scheduler (daily 03:00 UTC — Vercel Hobby allows daily crons only) and the weekly report (Mon 08:00 UTC).
  Vercel injects `Authorization: Bearer $CRON_SECRET`; set `CRON_SECRET`.

## 9. Phase 3 — Creator Marketplace (built; wiring is optional)

Runs on mock KYC/payout/moderation with no extra keys. To go real:

- **KYC + payouts** 🌐🔑 — Razorpay Route (India) reuses `RAZORPAY_*`; PayPal
  Payouts (international) needs `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET`.
  Wire the real calls in `src/lib/payouts/index.ts`.
- **Moderation** 🔑 — the real NSFW/trademark/real-person screening uses the
  Claude vision provider (`ANTHROPIC_API_KEY`); wire it in `src/lib/ai`.
- **Cron** ⚙️ — `vercel.json` runs creator payouts on the 1st at 06:00 UTC.
- ⚖️ Creator agreement text is **placeholder** — lawyer review; marketplace
  **TDS/TCS** obligations (India) — CA sign-off.

Flow: a buyer becomes a creator at `/creator` (agreement + payout + KYC) →
uploads at `/creator/upload` (auto checks: ≥4K, pHash dup, moderation) →
submission lands in admin **Catalogue** as `pending_review` → admin publishes →
monthly `creator_payouts` job pays the creator (default 30% commission).

### Phase 2 acceptance — status
- ✅ One button (admin → Review queue → **Generate batch**) creates a batch that
  lands in the review queue with AI metadata.
- ✅ Approving a candidate publishes the wallpaper and auto-creates Instagram +
  Pinterest drafts in the social calendar.
- ✅ Pricing **dry-run** shows the diff; a live run writes `price_history` with
  reasons + metrics.
- ✅ A leaked test file decodes back to its `order_id` (worker `/decode`, or
  admin `/api/admin/watermark/decode`) — requires the worker deployed.

---

## Acceptance criteria — status

Verified in this build (lint, typecheck, 11 unit + 22 e2e tests pass):
- ✅ No original-resolution file is reachable without a 60-second signed URL —
  originals live only in the private bucket; only `/api/download` mints a
  60s presigned URL after auth + entitlement; RLS blocks private asset rows.
- ✅ Entitlements/credits are created **only** from the signature-verified,
  idempotent webhook — never from client redirects.
- ✅ A 6th download on a 5-max entitlement is refused (atomic DB claim).
- ✅ Region pricing: ₹ for India, credits/packs abroad; billing-country
  mismatch resolves to the higher-priced region (`resolveChargeRegion`).
- ✅ Security headers (CSP/HSTS/X-Frame-Options/Referrer-Policy) + same-origin
  CSRF checks on mutating routes.

Requires your live environment to confirm (cannot run in CI sandbox):
- ⏳ Razorpay **test-mode** INR UPI + international card → entitlement on webhook.
- ⏳ **Lighthouse ≥ 90** (mobile) on home and detail — depends on real CDN
  images and deployment; re-check after wiring R2 + domain.

## Must be reviewed by professionals before launch
- ⚖️ Legal pages are **placeholder** (licence/terms/privacy/refunds) — lawyer review.
- 🧾 GST (India) / VAT (UK/EU) handling and invoicing — chartered accountant.
- 📸 Image-model licence must permit commercial resale — keep a saved copy.
