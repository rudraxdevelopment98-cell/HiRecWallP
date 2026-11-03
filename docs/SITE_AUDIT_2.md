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
- ⬜ Customer "Get help with this order" → ticket (refund request, download problem, wrong charge, quality/resolution issue, other)
- ⬜ Ticket numbers, status, threaded replies in Account → Support; emails on updates
- ⬜ SLA timers: 48 h acknowledgement, 30-day resolution; overdue alerts in admin
- ⬜ Self-serve instant refund for eligible orders (unused credit pack ≤14 days, unclaimed plan ≤7 days, unredeemed gift)
- ⬜ Admin Support queue: assign, reply, resolve with actions (refund, restore downloads, add credits, replace file)

## B3 — Accounts & credits
- ⬜ Delete my account (with clear consequences) + download my data (DPDP rights)
- ⬜ Change email; sign out of all devices
- ⬜ Email receipts after purchase; welcome email; bonus-credit expiry reminders
- ⬜ Credit history: filters, paging, which purchase each credit came from, expiring-soon view
- ⬜ Library: search, filter by device/licence, downloads-left, request extra downloads

## B4 — Uploading
- ⬜ Batch upload: many files at once, per-file progress, queue, retry failed
- ⬜ Pre-flight checks in the browser (type, size, dimensions) before uploading
- ⬜ Duplicate detection (pHash) for admin uploads too, with a link to the existing wallpaper
- ⬜ AI auto-fill: title, description, tags, alt text, category (vision adapter; mock by default)
- ⬜ Review grid: edit all drafts together, publish selected
- ⬜ Replace master / regenerate sizes for an existing wallpaper

## B5 — Resolution
- ⬜ Exact-fit downloads: choose your device (or auto-detect) → exact resolution crop from the master, cached
- ⬜ Device catalogue (popular phones, tablets, monitors) and per-wallpaper "fits" list
- ⬜ Quality badge from source resolution; AI upscale path for slightly-small uploads (adapter)

## B6 — Admin (functions)
- ⬜ Staff accounts with roles (owner, manager, support, content) and per-area permissions
- ⬜ Two-factor sign-in for admins (TOTP)
- ⬜ Customer timeline (orders, credits, tickets, logins) and email-the-customer
- ⬜ Settings change history with one-click revert

## B7 — Admin UI/UX (owner: "messy, not clean")
- ⬜ One layout system: page header (title, description, primary action), section cards, consistent spacing
- ⬜ Shared table, stat, empty-state, badge and form components used on every admin page
- ⬜ Settings split into clear sub-pages instead of one long page; navigation regrouped
- ⬜ Dashboard rebuilt as an overview (today, needs-attention list, shortcuts)
