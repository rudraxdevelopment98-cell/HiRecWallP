# Site audit #2 — 2026-11-03 (production readiness)

Owner feedback: accounts and credits feel basic; policies, refunds and
"resolution" need real work; admin and uploading have gaps. Reviewed every area
against how the site now works (credits economy, plans, gifts, growth) and
Indian rules for online sellers. Built in this order, one batch at a time.

Legend: ✅ done · ⏳ in progress · ⬜ to do

## B1 — Policies & legal (needed for Razorpay approval and consumer law)
Razorpay's website check lists Terms, Privacy, Refund & Cancellation, Shipping/Delivery,
Contact and Pricing pages. Consumer Protection (E-Commerce) Rules 2020: name a grievance
officer, acknowledge complaints in 48 h, resolve in 1 month. DPDP Rules 2025: main duties
from 14 May 2027 (notice, consent records, erasure, grievance).
- ✅ Terms of Service rewritten for credits, plans, autopay, gifts, regional pricing, accounts, creators
- ✅ Privacy policy (DPDP-ready): what we collect, why, retention, rights, processors, grievance contact
- ✅ Refund & Cancellation policy with concrete, automatable rules (unused packs, plans, gifts, faults, double charges)
- ✅ Shipping & Delivery policy (digital, instant; what happens if delivery fails)
- ✅ Licence page (personal vs commercial, AI-generated disclosure, prohibited uses)
- ✅ Grievance officer page (name/contact from Admin settings, SLA) + footer links
- ✅ Policy versioning: each policy has a version + date; acceptance recorded at sign-up/checkout

## B2 — Support, refunds & dispute resolution
- ✅ Customer "Get help" on every order → ticket (refund, download problem, wrong charge, quality/resolution, account, other)
- ✅ Ticket numbers (HW-T1001…), status, threaded replies in Account → Help & support; emails on create/reply/resolve (Resend)
- ✅ SLA timers: 48 h acknowledgement, 30-day resolution; overdue tab, sidebar badge, dashboard alert
- ✅ Self-serve instant refund (unused pack ≤14 d, unused pay-once pass ≤7 d, unredeemed gift ≤14 d; max 2 per 90 days, then reviewed)
- ✅ Admin Support queue: priority, assign, reply / internal note, resolve/close, refund (Razorpay or access-only), add credits, restore downloads
- ✅ Replace file (Admin → wallpaper → Image → Replace image)

## B3 — Accounts & credits
- ✅ Close my account (consequences shown first; personal data erased, orders kept 8 years without name) + download my data (JSON)
- ✅ Change email (confirmation link); sign out of all devices
- ✅ Email receipts after purchase (once per order); welcome email; bonus-credit expiry reminders (7 days before, daily job)
- ✅ Credit history: filters (added/spent/bonus), paging, links to receipt / unlocked wallpaper, expiring-soon list
- ✅ Library: search, licence filter, sort, downloads left, "need more?" → support request

## B4 — Uploading
- ✅ Batch upload: drag-drop many files, queue (2 at a time), per-file progress, retry failed, leave-page warning
- ✅ Pre-flight checks in the browser (type, size, ≥3840px long edge, 4K-only note) before anything uploads
- ✅ Duplicate detection (dHash of the clean original, `wallpapers.phash`) for admin, creator and AI uploads, with "see existing / upload anyway / skip"
- ✅ AI auto-fill: title, description, tags, alt text, category — Claude vision when `ANTHROPIC_API_KEY` is set, file-name title otherwise
- ✅ Drafts review grid (/admin/drafts): edit everything inline, save, publish selected; creator submissions tab
- ✅ Replace image / regenerate sizes on a wallpaper (same URL, price and buyers; stale files and watermark caches removed)

## B5 — Resolution
- ✅ Device preview on the wallpaper page: auto-detects your phone/tablet/computer, lock & home screen, full-screen try-on, sharpness hint (owner idea)
- ✅ Exact-fit downloads: this screen (auto-detected), a listed device or a custom size → crop from the master, cached under fit/, watermarked per buyer; free wallpapers up to 2560 px
- ✅ Device catalogue (`src/lib/fit.ts`) and a "Fits these screens" list on every wallpaper page
- ✅ Quality row (Ultra HD 4K/5K + original size); admin uploads ≥2560 px are upscaled 2× only with a real AI upscaler (never the mock) and the page says so

## B6 — Admin (functions)
- ✅ Staff roles (owner, manager, support, content) with per-area permissions enforced in middleware for every admin page and API (`src/lib/staff.ts`); Admin → Staff (owner)
- ✅ Two-factor sign-in (authenticator app, Supabase MFA): Admin → Security; owner can require it for all staff; owner can reset a lost one
- ✅ Customer timeline (orders, credits, tickets, downloads, sign-ins, staff actions, emails) + email the customer
- ✅ Settings change history (who/what/when) with one-click revert (`save_setting()`, migration 0027)

## B7 — Admin UI/UX (owner: "messy, not clean")
- ✅ App-style shell: own sidebar (grouped, badges for work waiting) + top bar (breadcrumb, view store, sign out, mobile drawer); store header/footer hidden on /admin
- ✅ One layout system: `PageHeader`, `Section`, `Stat`/`StatGrid`, `FilterTabs`, `EmptyState`, `DetailList` (`components/admin/ui.tsx`) + `.admin-card`, `.admin-table`, `.admin-btn(-primary)`
- ✅ Settings split into tabs: General · Business & legal · Growth · Prices & FX (`/admin/settings?tab=`)
- ✅ Dashboard rebuilt: needs-attention list (takedowns, failed jobs, messages, reviews, KYC, drafts), launch checklist, 30-day KPIs with trend, 14-day chart, recent orders, shortcuts
