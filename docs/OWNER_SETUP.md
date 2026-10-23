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
   psql "$DATABASE_URL" -f supabase/seed/seed.sql
   ```
4. Auth → enable **Email OTP** and **Google** providers; set the Site URL and
   redirect URLs to your domain.
5. ⚙️ **Make yourself admin** (after first login creates your profile):
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
5. Test in **test mode**: INR UPI and an international test card. Entitlements/
   credits should appear only after the webhook fires (not on redirect).

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

## 8. Phase 2 placeholders (not needed to launch Phase 1)

Leave empty for now: `IMAGE_PROVIDER(_API_KEY)`, `UPSCALE_PROVIDER(_API_KEY)`,
`ANTHROPIC_API_KEY`, `IG_BUSINESS_ACCOUNT_ID`, `IG_ACCESS_TOKEN`,
`PINTEREST_ACCESS_TOKEN`, `PINTEREST_BOARD_IDS`, `WATERMARK_WORKER_URL`,
`WATERMARK_WORKER_SECRET`.

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
