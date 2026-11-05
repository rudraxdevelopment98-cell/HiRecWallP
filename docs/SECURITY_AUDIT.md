# Security audit — 2026-11-05

Scope: the whole HirecWallp app (Next.js routes and pages, Supabase database and
RLS, storage, payments webhook, background jobs, dependencies, headers).
Method: route-by-route review of every API handler (auth, authorisation,
CSRF/origin, input validation, rate limits), database permission review on
production (RLS policies, table grants, `SECURITY DEFINER` function grants),
Supabase security advisor, `npm audit`, and code review of the riskier paths
(file uploads, HTML generation, payments, account deletion). Findings were fixed
in the same change unless marked otherwise. Severity uses OWASP-style ratings.

## Summary

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Stored XSS through JSON-LD on wallpaper pages | **High** | Fixed |
| 2 | No decoder size cap on uploaded images (decompression-bomb DoS) | Medium | Fixed |
| 3 | Payment webhook didn't compare paid amount with the order | Medium | Fixed |
| 4 | Clients could post `purchase` / `paid_download` analytics events | Medium | Fixed |
| 5 | Private settings (tax details, tier overrides) were publicly readable | Medium | Fixed |
| 6 | `TRUNCATE` / `TRIGGER` / `REFERENCES` granted to API roles | Low | Fixed |
| 7 | Newsletter unsubscribe ran on GET (mail scanners unsubscribe people) | Low | Fixed |
| 8 | Download failed for customers owning both licences of a wallpaper | Low (availability) | Fixed |
| 9 | CSP allows `'unsafe-inline'` scripts | Low (hardening) | Open — see below |
| 10 | `pg_trgm` extension in `public` schema | Info | Accepted |

No critical issues. Earlier audits already fixed the serious database ones
(self-granting credits via RPC, self-promotion to admin — migration 0007).

### 1. Stored XSS through JSON-LD (High)
`/w/[slug]` embedded `JSON.stringify(jsonLd)` in a `<script>` tag. A wallpaper
title or description containing `</script><script>…` (creators write these)
would end the tag and run script for every visitor; the CSP allows inline
scripts, so it would have executed. **Fix:** `jsonForScript()` escapes `<`, `>`,
`&`, U+2028/2029 (`src/lib/safe-json.ts`, unit-tested). No other
`dangerouslySetInnerHTML` takes user data (the root layout's inline script is static).

### 2. Image decompression bombs (Medium)
Uploads are decoded with sharp. sharp's default cap is ~268 MP; a small file
that expands to that size can exhaust a serverless function's memory. **Fix:**
every decode of untrusted bytes goes through `openImage()` with a 120 MP limit
(`src/lib/image-safety.ts`). File type and size were already checked; staged
upload keys are already confined to `incoming/<uid>/`.

### 3. Webhook amount check (Medium)
The Razorpay webhook verified the HMAC signature (timing-safe) and was
idempotent, but it didn't compare the captured amount and currency with the
order. Razorpay ties payments to our server-created order amount, so this is
defence in depth. **Fix:** on a mismatch the payment is refunded, the order is
marked `failed` and nothing is granted.

### 4. Forged analytics events (Medium)
`/api/events` accepted `purchase` and `paid_download` from the browser, so anyone
could inflate "best sellers" and the funnel in Admin → Analytics. **Fix:** those
types are now server-only (the webhook and download route write them).

### 5. Private settings readable by anyone (Medium)
`site_settings` had `using (true)` for SELECT, so the anon key could read the tax
settings (TAN, filing flags) and admin-only knobs. **Fix (migration 0024):** the
public policy excludes `tax`, `fx_meta`, `country_tiers` and
`creator_credit_value_inr`; the server reads settings with the service key.

### 6. Table privileges (Low)
API roles had `TRUNCATE`, `TRIGGER` and `REFERENCES` on app tables (Supabase
defaults). `TRUNCATE` ignores RLS. PostgREST doesn't expose it, but a leaked
key plus a future RPC could. **Fix (0024):** revoked on all public tables and
in default privileges.

### 7. Unsubscribe on GET (Low)
Email security scanners open links automatically; a GET that unsubscribes
silently drops subscribers. **Fix:** GET shows a confirm button; POST (also the
RFC 8058 one-click) unsubscribes. Tokens remain HMAC-signed per address.

### 8. Dual-licence download (Low)
`maybeSingle()` errored when a customer owned both the personal and commercial
licence of the same wallpaper, so the download said "no entitlement". **Fix:**
pick the entitlement with downloads left, commercial first.

### 9. CSP `'unsafe-inline'` (open)
Next.js inline bootstrap scripts need either `'unsafe-inline'` or per-request
nonces. Nonces force every page to render dynamically (no static caching), so
this is deferred. Mitigation: all HTML sinks escape user data (finding 1),
`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`,
`form-action 'self'`. **Recommendation:** move to nonce-based CSP with the
Next 16 upgrade.

### 10. `pg_trgm` in `public` (accepted)
Used by search indexes; moving it would rebuild them. It exposes only trigram
helper functions. Low value to change now.

## What was checked and is fine

- **AuthN:** Supabase email OTP / magic link / Google; no passwords stored.
  `/auth/callback` `next` is open-redirect-safe (`safeNextPath`).
- **AuthZ:** every `/api/admin/*` handler calls `adminGuard()` (server role
  check + same-origin for writes); middleware blocks `/admin` and `/api/admin` too.
  Jobs require `CRON_SECRET` (timing-safe compare) or an admin session.
- **CSRF:** every mutating route requires a same-origin `Origin` header
  (`isSameOrigin`); session cookies are SameSite=Lax.
- **IDOR:** customer reads go through RLS (own rows only); service-role writes
  filter by the signed-in user's id (orders, tickets, refunds, entitlements).
- **RLS:** enabled on every table. Only `is_admin()`, `is_creator()` and
  `my_credit_balance()` are callable by API roles, and they only answer about
  the caller. All money/credit RPCs are service-role only. Profiles: users can
  update only `display_name`, `country_code` and `gstin` (column grants).
- **Files:** originals live only in the private bucket; downloads use 60-second
  signed URLs after an atomic per-entitlement counter; per-user and per-IP
  limits (30/hour); free variants never include 4K+ originals; paid files carry
  a forensic watermark.
- **Payments:** HMAC-verified webhook, idempotent on event id, atomic
  `created → paid` claim, foreign-card-on-INR refund, amount check (new).
- **Abuse:** DB-backed rate limits on forms, gifts, tickets, refunds, exports,
  account changes; honeypots on public forms; self-serve refunds capped (2 per 90 days).
- **Headers:** CSP, HSTS (2 years, preload), `X-Frame-Options: DENY`,
  `nosniff`, strict referrer policy, restrictive `Permissions-Policy`.
- **Secrets:** only `NEXT_PUBLIC_*` reach the browser; no secrets in the repo.
- **Dependencies:** `npm audit --omit=dev` → 0 vulnerabilities.
- **Privacy:** account closure erases personal data, keeps tax records without
  identity; data export; download logs anonymised after 12 months.

## Owner actions (security)

1. **Supabase → Authentication:** keep email OTP expiry short (≤ 10 minutes) and
   rate limits on (defaults are fine). Turn on **CAPTCHA** (Turnstile, free)
   for sign-in before marketing pushes, to stop OTP-spam to other people's inboxes.
2. **Secrets:** set `CRON_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `DOWNLOAD_TOKEN_SECRET`
   to long random values in Vercel. Rotate any key that was ever pasted into a chat.
3. **Admin account:** use a mailbox with 2-factor sign-in (Gmail 2FA), since
   email is the admin login. Admin 2FA inside the site is planned (audit B6).
4. **Vercel:** turn on Firewall → Attack Challenge Mode if you ever see a traffic flood.
5. Re-run this audit after big features. Run Supabase advisors after migrations.
