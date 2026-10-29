# Storage & scaling strategy

How HirecWallp stores wallpapers and data so cost stays near zero while the
catalogue grows, and the exact points where a paid plan becomes necessary.
Numbers are **measured** with the real pipeline (`src/lib/imaging.ts`) on 8K
test images, October 2026. Detailed AI art can compress ~1.5× worse — the
ranges below include that.

## 1. What we store per wallpaper

| File | Bucket | Before | Now |
|---|---|---|---|
| Master (the irreplaceable original) | private | 8K PNG ≈ **61 MB** | JPEG uploads kept as-is; PNG/WebP/TIFF → visually lossless JPEG q95 4:4:4 ≈ **6 MB** |
| Paid sizes | private | all 5 crops for every image ≈ 9.4 MB | only sizes matching the artwork's orientation, never upscaled > 15% ≈ **2–7 MB** |
| Free size | private | 2 crops ≈ 0.75 MB | 1 (2 for square) ≈ **0.4 MB** |
| Watermarked preview + 600² crop | public (CDN) | ≈ 0.12 MB | ≈ **0.12 MB** |
| **Total** | | **≈ 71 MB** | **≈ 8 MB portrait / 13 MB landscape** (−80–89%) |

### Which sizes each artwork gets (`plannedSizes`)
- **Portrait** (w/h < 0.9): Phone 1440×3120, Tablet 2048×2732, free Phone 1080×2340
- **Landscape** (w/h > 1.1): Desktop 4K, Desktop 5K, Ultrawide 5120×2160 only if the source is ≥ 2:1; free Desktop 1920×1080
- **Square-ish**: Phone, Tablet, Desktop 4K + both free sizes
- A size is skipped if it would enlarge the source more than 15%. Below 3840 px
  on the long edge nothing paid fits and the upload is rejected (422).

This is also a **quality** fix: a portrait artwork is no longer cropped into a
21:9 desktop frame. Buyers see only the sizes that exist (`src/lib/variants.ts`).

## 2. Temporary files clean themselves up (R2 lifecycle rules)

Applied from **Admin → Upload → "Apply storage rules"** (`applyStorageRules`):

| Prefix | Deleted after | What it is |
|---|---|---|
| `incoming/` | 1 day | raw browser uploads (also deleted right after processing) |
| `wm/` | 7 days | per-buyer forensic-watermarked copies — rebuilt on demand if re-downloaded |
| `generation/` | 45 days | AI batch candidates (approved ones are copied into `wallpapers/`) |

Without the `wm/` rule every sale would keep a full-size copy forever.

## 3. Uploads go straight to storage

Vercel rejects request bodies over ~4.5 MB, but originals are 10–80 MB. The
browser now asks `/api/uploads/sign` for a presigned PUT (admin or onboarded
creator only, type + exact size pinned, ≤ 150 MB), uploads directly to the
private bucket, then the upload route processes it (~15–20 s for 8K, inside the
60 s function limit). The same rules (CORS) come from "Apply storage rules".

## 4. Images bypass Vercel's optimizer

Vercel Hobby allows 5,000 image transformations/month and then returns errors.
Previews are already resized/compressed at upload, so `next.config.mjs` sets
`images.unoptimized: true`, and public objects are uploaded with
`Cache-Control: public, max-age=31536000, immutable` for the CDN.

## 5. Database stays small

| Data | Size | Growth |
|---|---|---|
| Wallpaper + assets + prices rows | ≈ 5 KB / wallpaper | 10,000 wallpapers ≈ 50 MB |
| Orders, entitlements, downloads | ≈ 1 KB / sale | 50,000 sales ≈ 50 MB |
| Raw analytics events | ≈ 0.4 KB / event | **unbounded** → kept 30 days, then rolled into `events_daily` |

`housekeeping()` (migration 0008) runs daily at 04:00 UTC via `/api/jobs/housekeeping`.

## 6. Cost projection (Cloudflare R2, Standard class)

R2: $0.015 / GB-month after 10 GB free, **no egress fees**; Class A ops
$4.50/M, Class B $0.36/M (1M / 10M free per month).

| Catalogue | Before (71 MB each) | Now (8–16 MB each) |
|---|---|---|
| 1,000 wallpapers | 71 GB ≈ $0.90/mo | 8–16 GB ≈ **$0–0.10/mo** (free tier) |
| 10,000 | 710 GB ≈ $10.50/mo | 80–160 GB ≈ **$1–2.25/mo** |
| 100,000 | 7.1 TB ≈ $106/mo | 0.8–1.6 TB ≈ **$12–24/mo** |

Plus the `wm/` cache: ~3–5 MB per paid download for 7 days (1,000 downloads a
week ≈ 5 GB steady — a few cents). Infrequent Access ($0.01/GB) is **not** worth
it: retrieval fees and 30-day minimums outweigh the saving for downloadable files.

## 7. When to upgrade (owner decisions)

| Trigger | Action | Cost |
|---|---|---|
| **Before taking real payments** | Vercel **Pro** — Hobby is for non-commercial use only | $20/mo |
| **At launch** (or DB > ~350 MB) | Supabase **Pro** — free projects pause after 7 days without activity; 500 MB DB cap | $25/mo |
| Before launch | Put the public bucket behind `cdn.hirecwallp.com` (R2 custom domain); the `r2.dev` URL is rate-limited and for development only | free |
| ~1,000+ wallpapers | Monthly off-site copy of `wallpapers/*/master.*` (e.g. Backblaze B2 ≈ $6/TB-month) — protects against account loss/accidental deletion | ≈ $0.10–1/mo — **ask owner first** |
| Uploads > 60 s | Move processing to a background worker (or Vercel Pro's longer limit) | — |

## 8. Sources
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Vercel image optimization limits: https://vercel.com/docs/image-optimization/limits-and-pricing
- Vercel Hobby plan (non-commercial): https://vercel.com/docs/plans/hobby-plan
- Supabase pricing (free: 500 MB, pause after 1 week): https://supabase.com/pricing
