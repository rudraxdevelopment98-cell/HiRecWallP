# Premium AI Wallpaper Platform — Business & Technical Blueprint

> Brand: **HirecWallp** (`BRAND_NAME` in config) · Business entity: **India** · Domain: hirecwallp.com was available on 23 Oct 2026 (.co / .app too) — register it soon
> Owner: Kuldeep · Version 1.0 · 23 Oct 2026
> Purpose: one document that explains the business, the product, and the build plan — written so it can be handed straight to Claude Code together with `project-spec.json`.

---

## 1. The idea in one paragraph

A website that sells ultra-high-resolution, AI-generated wallpapers (phone, desktop, tablet). Some wallpapers are free (traffic + SEO + trust), the rest are cheap paid downloads priced per country, with prices that move automatically inside limits the owner sets. Instagram, Pinterest and other socials get 2–3 posts a day, automated, to pull people to the site. Later, outside creators can upload their own wallpapers and earn, with the platform taking a commission. As much of the pipeline as possible — generation, upscaling, tagging, posting, pricing — is automated with Claude Code and scheduled jobs, with a human approval step for quality.

---

## 2. Research findings (what the market is telling us)

### 2.1 The biggest warning: MKBHD's Panels
- Panels (Marques Brownlee's paid wallpaper app) launched Sept 2024 and shut down 31 Dec 2025.
- Despite a creator with 20M+ subscribers and reaching #1 in the Photos category, it reached roughly **900K downloads but only ~$95K in consumer spending** (Appfigures via TechCrunch).
- Main criticism: a ~$50/year subscription for wallpapers felt overpriced, plus quality issues.
- Its code was open-sourced under Apache 2.0 — useful as a reference, not something we need to fork.

**Lessons applied to this plan:**
1. People will not pay *much* for wallpapers → micro-prices and small packs, not big subscriptions at launch.
2. Free must be genuinely generous → free tier drives traffic, ad revenue and SEO.
3. "Generic beautiful wallpaper" is not a moat — free alternatives are endless. **We need a niche** (see §3).
4. A web-first product (no App Store 15–30% cut) keeps margins on tiny prices.

### 2.2 Copyright on AI images is weak — plan around it
- **US:** the Copyright Office and courts (Thaler v. Perlmutter, Zarya of the Dawn) refuse copyright for purely AI-generated images; prompts alone don't count as human authorship. Human edits *can* be protected.
- **India:** the Copyright Office has rejected AI-authored registrations (RAGHAV/Suryast); a Thaler application is under a Delhi High Court-ordered review in 2026. **Unsettled.**
- **Implication:** we cannot rely on "copyright" alone. Protection = (a) technical controls, (b) a purchase **licence/Terms of Service** (contract law works even when copyright is shaky), (c) per-buyer forensic watermarks to trace leaks, and (d) **meaningful human editing** (compositing, retouching, colour grading) on premium pieces, which strengthens a copyright claim.
- Also check the **AI model's terms** allow selling outputs as standalone products. Only use models/APIs whose licence permits commercial resale.

### 2.3 Payment fees decide the pricing model
| Gateway | Fee | What happens on a tiny sale |
|---|---|---|
| Razorpay (India) | ~2% + 18% GST on fee, **no fixed fee**, UPI ≤ ₹2,000 has zero MDR | ₹10 sale → ~₹0.24 fee. **Per-item micro-pricing works in India.** New accounts: 0% platform fee for 90 days / first ₹5 lakh. |
| Razorpay International (foreign cards) | ~3% + GST, percentage-based | Works for small foreign sales; needs international payments enabled on the Razorpay account (extra KYC). |
| Stripe | **Invite-only for Indian businesses** since 2024; UK rate is 1.5% + 20p fixed | Not the default for an India entity. Even if available, 20p on a 50p sale ≈ 42% lost. |

**Decision (India entity):** one gateway — **Razorpay** — for everything.
- India buyers: per-wallpaper prices (₹9–₹99) via UPI.
- Foreign buyers: **credit packs** (e.g. $3.99 = 10 credits) via Razorpay International cards; PayPal as a second option later. Packs still make sense abroad: fewer card transactions, less fraud/chargeback exposure, one FX conversion.
- Dynamic pricing runs on rupees in India and **credit cost per wallpaper** (1–5 credits) outside India.
- Payment code stays behind an adapter so Stripe or a Merchant-of-Record can be plugged in later.

Tax note (India entity): domestic sales attract GST; foreign sales are generally treated as export of services (zero-rated under an LUT), but some countries (UK/EU) can charge VAT on digital services sold to their consumers. A Merchant-of-Record (Paddle, Dodo Payments etc.) can handle that at a higher fee. Also consider the entity type (sole proprietor vs LLP/Pvt Ltd), a current account, and FEMA/foreign-receipt paperwork that Razorpay supports. **Confirm all of this with a CA before launch** — especially since you'll be running it from the UK until the move.

### 2.4 Social automation is feasible
- Instagram's official Content Publishing API works for **Professional (Business/Creator) accounts**; the current documented limit is up to 100 API-published posts per rolling 24 h (older docs say 50). 2–3 posts/day is far below any limit.
- **Add Pinterest** — wallpapers are one of Pinterest's strongest categories and pins drive long-tail website traffic for years (Instagram doesn't link out well). Also YouTube Shorts / IG Reels with slow-zoom "reveal" videos.

---

## 3. Positioning — pick a niche (recommendation)

Generic "4K nature/abstract wallpapers" is a crowded free market. Strong options:

1. **Indian devotional & culture (recommended for launch):** Mahadev, Krishna, Ganesha, Hanuman, festival packs (Diwali, Navratri, Holi), Indian architecture, cinematic mythology scenes. Huge search demand in India, weak premium supply, natural festival calendar for campaigns.
2. **Matching sets:** same artwork sized for phone + lock screen + desktop + watch (a set is worth paying for).
3. **iOS depth-effect lock screens:** layered images where the subject overlaps the clock — clearly "premium".
4. **Luxury minimal / dark AMOLED** for a global audience.

Launch with **one primary niche (#1) + one global niche (#4)**, and sell everything as sets where possible. Festival packs are the launch campaigns (Diwali falls in early November — use it as a soft launch if the MVP is ready, otherwise Christmas/New Year).

---

## 4. Business model

| Stream | How | Phase |
|---|---|---|
| Free wallpapers | ~30–40% of catalogue, 1080p–1440p free, 4K paid | 1 |
| Per-wallpaper purchase | India, ₹9–₹99, UPI | 1 |
| Credit packs | Intl, £2.99/$3.99/€3.49 = 10 credits, bigger packs discounted | 1 |
| Bundles / festival packs | 10–20 wallpapers, fixed price | 1 |
| Display ads on free pages | AdSense or similar, free pages only | 2 |
| "Pro" pass | Monthly unlimited, only after proving demand | 4 |
| Creator marketplace | Creators sell; platform keeps 30% (configurable) | 3 |

### 4.1 Rough unit economics (sanity check, refine with real data)
- Generation: assume ~4 generations + 1 upscale per kept wallpaper → a few ₹ to ~₹15 per keeper depending on model.
- One ₹19 wallpaper sold 20 times = ₹380 gross, ~₹9 gateway fees.
- The business only works at **volume of sales per wallpaper**, so marketing reach matters more than catalogue size. Target: a catalogue of ~300 strong wallpapers beats 5,000 mediocre ones.

### 4.2 Success metrics & honest checkpoints
- Day 30: site live, 100+ wallpapers, posting daily, first paid sale.
- Day 60: ≥1–2% of visitors download something; ≥2% of downloaders pay at least once.
- Day 90: decide — double down on the niche that sells, or pivot niche. Don't build the creator marketplace until our own sales prove demand.

---

## 5. Dynamic pricing — specification

Owner sets, per region (or per wallpaper override):
`min_price`, `max_price`, `base_price`, `max_step_pct` (per adjustment), `cooldown_hours`, and price "snap" points.

**Region tiers (defaults, editable):**
| Tier | Examples | Currency | Unit | Default min–max |
|---|---|---|---|---|
| IN | India | INR | price | ₹9 – ₹99 (snap: 9, 19, 29, 49, 79, 99) |
| T1 | UK, US, EU, CA, AU | GBP/USD/EUR | credits | 1 – 5 credits |
| T2 | Middle East, East Asia | USD | credits | 1 – 4 credits |
| T3 | Rest of world | USD | credits | 1 – 3 credits |

**Algorithm (nightly job, per wallpaper per region):**
1. `demand = downloads_7d (paid + 0.3 × free_preview_saves) / median of same category`
2. `conversion = paid_downloads_7d / detail_page_views_7d`
3. If `demand > 1.5` AND `conversion` ≥ category median → raise one step (≤ `max_step_pct`).
4. If `demand < 0.5` OR `conversion` < 50% of median for 2 consecutive runs → lower one step.
5. Clamp to `[min, max]`, snap to nearest allowed price point, respect `cooldown_hours`.
6. Write every change to `price_history` (with reason) so the owner can audit/revert.
7. New wallpapers start at a "launch price" (bottom third of range) for 72 h.

**Rules:** a price shown to a user is locked for 15 minutes through checkout. Region is detected by IP for display but **verified by card/billing country at checkout**; on mismatch charge the higher tier (stops VPN arbitrage). Owner dashboard has a global "freeze pricing" switch.

---

## 6. Content protection — layered (and honest)

> No website can make a picture impossible to copy — anything shown on a screen can be screenshotted. The goal is: **the free preview is not worth stealing, the original is never exposed, and leaks are traceable.**

1. **Originals never public.** Full-res files live in a private bucket (Cloudflare R2 / S3). No public URL exists.
2. **Previews are deliberately limited:** max ~720 px on the long edge, compressed, with a tiled diagonal visible watermark (brand + "preview"). A screenshot of a preview is useless as a 4K wallpaper.
3. **Zoom view:** a small 1:1 crop of a detail area (also watermarked) to prove quality without giving the image away.
4. **Download = entitlement + signed URL:** login required, server checks purchase, issues a signed URL that expires in ~60 s, single-use token, max 5 downloads per purchase, rate limiting per user/IP.
5. **Per-buyer forensic watermark:** on first download, embed an invisible watermark (DCT/DWT-based) encoding the order ID, plus XMP metadata (licence, order ID, buyer hash). A leaked copy can be traced to an order → account ban + takedown.
6. **Leak monitoring (Phase 2+):** perceptual-hash (pHash) every asset; periodic reverse-image checks; DMCA/takedown templates in admin.
7. **Licence:** personal-use licence at checkout; commercial licence as a separate, pricier SKU (Phase 2).
8. Skip "disable right-click" tricks — they annoy users and stop no one.

---

## 7. Automation pipeline (Claude Code + scheduled jobs)

```
[Prompt library (JSON, per niche/festival)]
        │  nightly or on-demand
        ▼
[Generate N variants via image API] → [Auto-filter: resolution, artifacts, NSFW, near-duplicate pHash]
        ▼
[AI quality review (vision model scores composition, text glitches, hands/faces)]
        ▼
[Upscale to 4K+ and crop/compose variants: phone / desktop / tablet / ultrawide]
        ▼
[Auto metadata: title, tags, description, SEO slug, alt text, category, suggested free/paid]
        ▼
[ADMIN APPROVAL QUEUE  ← human approves/rejects/edits]   ← quality gate, keep this manual
        ▼
[Publish: originals → private bucket, previews → CDN, DB rows, sitemap update]
        ▼
[Social scheduler: phone-mockup image + 5-sec zoom reel + caption + hashtags + link]
        → Instagram (2–3/day) · Pinterest (5–10/day) · optional YT Shorts / X
        ▼
[Analytics events] → [Nightly dynamic-pricing job] → [Weekly report to owner]
```

Jobs are scheduled with Vercel Cron / GitHub Actions / Supabase pg_cron. Everything is idempotent and logged in a `jobs` table.

---

## 8. Technical architecture

| Layer | Choice (default) | Why |
|---|---|---|
| Frontend + API | Next.js (App Router, TypeScript), Tailwind | SEO-friendly, one codebase, deploys on Vercel |
| Database + Auth | Supabase (Postgres, Auth, Row Level Security) | Fast to build, RLS for entitlements |
| Originals storage | Cloudflare R2 (private) | Cheap, no egress fees |
| Previews | R2 public bucket + CDN, or Next/Image | Fast global delivery |
| Image processing | `sharp` (Node) for resize/watermark/mockups | Fast, reliable |
| Forensic watermark | Small Python worker (FastAPI + `invisible-watermark`) | Best library support; can run on Railway/Fly/Cloud Run |
| Payments | Razorpay (INR UPI + International cards for credit packs), behind a provider adapter | Indian entity; Stripe is invite-only in India |
| Image generation | API model with commercial-resale licence (e.g. Flux family via fal/Replicate, or similar) — configurable provider | Swap models without code changes |
| Upscaling | API upscaler (Real-ESRGAN class) — configurable | 4K/5K output |
| AI metadata/review | Claude API (vision) | Titles, tags, quality scoring |
| Social | Instagram Graph API (Professional account), Pinterest API | Official, stable |
| Analytics | PostHog or Plausible + own `events` table | Pricing job needs raw events |
| Email | Resend | Receipts, download links |

### 8.1 Core data model (summary — full spec in `project-spec.json`)
`users`, `profiles` (role: buyer/creator/admin), `categories`, `wallpapers`, `wallpaper_assets` (variant, width, height, storage_key, phash), `regions`, `price_rules`, `prices` (current per wallpaper×region), `price_history`, `credit_packs`, `credit_ledger`, `orders`, `order_items`, `entitlements`, `downloads` (audit), `events`, `generation_jobs`, `prompt_library`, `social_posts`, `takedown_reports`, *(phase 3)* `creators`, `creator_payouts`, `commission_rules`.

### 8.2 Asset variants
| Variant | Size | Free tier gets |
|---|---|---|
| Phone | 1440×3120 (9:19.5) | 1080×2340 |
| Phone depth (iOS) | 1290×2796 layered PNG | — |
| Desktop 4K | 3840×2160 | 1920×1080 |
| Desktop 5K | 5120×2880 | — |
| Tablet | 2048×2732 | — |
| Ultrawide | 5120×2160 | — |

---

## 9. Wireframes (low-fidelity)

### 9.1 Home
```
┌──────────────────────────────────────────────────────────────┐
│ LOGO   Explore  Collections  Festival Packs  Free   [🔍] [Login] [₹/£]│
├──────────────────────────────────────────────────────────────┤
│  HERO: rotating 3 featured wallpapers on phone + desktop mockups │
│  "Ultra-HD wallpapers, made for your screen"  [Browse] [Free picks]│
├──────────────────────────────────────────────────────────────┤
│ Device filter: [Phone] [Desktop] [Tablet] [Ultrawide] [Matching sets]│
├──────────────────────────────────────────────────────────────┤
│ Trending ───────────────────────────────── see all →          │
│ [▯][▯][▯][▯][▯][▯]   card: preview, title, price/FREE badge   │
│ Festival pack banner (Diwali / Christmas …)  [Get pack ₹99]   │
│ New today ─────────────────────────────── see all →           │
│ [▯][▯][▯][▯][▯][▯]                                            │
│ Collections grid: Devotional · AMOLED · Minimal · Nature …    │
├──────────────────────────────────────────────────────────────┤
│ Footer: Licence · Terms · Privacy · Refunds · Creators (soon) │
└──────────────────────────────────────────────────────────────┘
```

### 9.2 Wallpaper detail
```
┌──────────────────────────────┬───────────────────────────────┐
│  [ Phone mockup preview ]     │ Title                          │
│  (watermarked, ~720px)        │ Collection · tags              │
│  [Phone][Desktop][Tablet] tabs│ Variants: ☑Phone 1440×3120     │
│  [🔍 View detail crop]         │           ☑Desktop 3840×2160   │
│                               │ Price: ₹29  (or 2 credits)     │
│                               │ [Buy now] [Add to cart]        │
│                               │ Free 1080p available? [Download]│
│                               │ Licence: personal use ⓘ        │
├──────────────────────────────┴───────────────────────────────┤
│ Part of set: [▯][▯][▯]   ·   You may also like: [▯][▯][▯][▯]  │
└──────────────────────────────────────────────────────────────┘
```

### 9.3 Checkout / credits
```
India:   Cart → order summary (₹) → Razorpay UPI/card → success → "My Library"
Intl:    Not enough credits? → [10 credits £2.99] [30 credits £6.99] [80 credits £14.99]
         → Razorpay Checkout (international card) → credits added → item unlocked → "My Library"
Price lock timer: "Price held for 14:59"
```

### 9.4 My Library (buyer)
```
┌──────────────────────────────────────────────────────────────┐
│ My Library   Credits: 7   [Buy credits]                       │
│ [▯ Title · Phone/Desktop · [Download ▼] · 3/5 downloads left] │
│ Orders & receipts · Account settings                          │
└──────────────────────────────────────────────────────────────┘
```

### 9.5 Admin dashboard
```
Sidebar: Overview · Approval Queue · Catalogue · Prompts · Pricing · Social · Orders · Takedowns · Settings
Overview:   revenue today/7d/30d · top sellers · conversion · job health
Approval:   grid of generated candidates [✓ Approve][✗ Reject][✎ Edit meta][Free/Paid toggle]
Pricing:    per region: min | max | base | step% | cooldown  [Freeze all ⏸]
            per-wallpaper override · price history chart · "why changed" log
Social:     calendar of scheduled posts (IG / Pinterest) · preview caption · [Post now][Skip]
Prompts:    prompt library by niche/festival · run generation batch (N variants)
```

### 9.6 Creator dashboard (Phase 3)
```
Upload (originals ≥ 4K) → auto checks (resolution, NSFW, duplicate/stolen pHash, IP/brand check)
→ review queue → live. Earnings: gross · commission · net · payout status. Payout setup (KYC).
```

---

## 10. Creator marketplace (Phase 3 — only after own sales are proven)
- Payouts: Razorpay Route for Indian creators (KYC + split payments); international creators via PayPal Payouts or a similar service — decide when Phase 3 starts.
- Commission default 30%, configurable per creator.
- Mandatory moderation: no copyrighted characters, brand logos, celebrities, NSFW; perceptual-hash check against our catalogue and known leaks; "AI-generated" disclosure flag.
- Creator agreement: they warrant they have rights and grant a selling licence.
- India: marketplace operators may have TDS/TCS obligations — confirm with a CA.

---

## 11. Roadmap

| Phase | Time | Deliverables |
|---|---|---|
| **0. Setup** | Week 0–1 | Brand name + domain · niche decision · Supabase, R2, Vercel, Razorpay (with International Payments enabled) accounts · register hirecwallp.com · Instagram Professional + Pinterest Business accounts · image API key · first 50 hand-picked wallpapers |
| **1. MVP** | Weeks 1–3 | Public site (home, explore, detail, collections, search) · free downloads · INR per-item purchase + intl credit packs · secure delivery (private originals, signed URLs) · watermarked previews · admin upload + catalogue · legal pages · SEO (sitemap, OG images, schema) |
| **2. Automation** | Weeks 4–6 | Generation → review → upscale → approval pipeline · auto metadata · social scheduler (IG + Pinterest) · dynamic pricing job + admin controls · forensic watermark worker · analytics + weekly report email |
| **3. Marketplace** | Month 3+ (gated by metrics) | Creator accounts, uploads, moderation, commissions, payouts |
| **4. Expand** | Month 4+ | PWA/app, Pro pass, live/animated wallpapers, commercial licences, more languages |

---

## 12. Legal & compliance checklist
- [ ] Terms of Service + personal-use licence + commercial licence text
- [ ] Privacy Policy (UK GDPR + India DPDP Act), cookie consent
- [ ] Refund policy for digital goods
- [ ] AI-generated content disclosure on product pages
- [ ] Image-model licence permits resale — saved copy of terms
- [ ] GST (India) / VAT on digital services (UK/EU) — CA/accountant sign-off
- [ ] No trademarked characters/logos/celebrities in prompts or uploads
- [ ] Takedown/DMCA contact + process

---

## 13. Open decisions (defaults used until changed)
| Decision | Default |
|---|---|
| Brand name / domain | **HirecWallp** — hirecwallp.com (decided) |
| Launch niche | Indian devotional & culture + dark AMOLED minimal |
| Legal entity / country of sale | **India** (decided) — entity type + GST with a CA |
| Image model provider | Configurable; pick one with clear commercial terms |
| Creator commission | 30% |
| Launch campaign | Festival pack (whichever festival the MVP is ready for) |

---

## 14. How to hand this to Claude Code
1. Create an empty repo, put `BLUEPRINT.md` and `project-spec.json` in `/docs`.
2. Open Claude Code in the repo and paste the `kickoff_prompt` from `project-spec.json`.
3. Let it build **Phase 1 only**, review, deploy, then start Phase 2 in a new session using the same files.
