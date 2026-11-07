# SEO, AEO & keyword plan — HirecWallp

What's built into the site, which keywords each page targets, and what the owner does each week.
Search volumes aren't guessed here. Check them in **Google Keyword Planner** (free with a Google Ads account,
no spend needed) and in **Search Console** once the site has traffic.

## 1. Built in (technical SEO)

| Area | What the site does |
|---|---|
| Titles & descriptions | Wallpaper pages: “{Title} 4K Desktop Wallpaper” / “… Phone Wallpaper – Free Download”, with a description that names the category, resolution and device (`src/lib/seo.ts`). Category, device, Explore, Free and FAQ pages have keyword titles. |
| Canonical URLs | Every listing has one canonical URL. Filtered, sorted, paged or searched views are `noindex, follow`, so filters don't create duplicate pages. Wallpapers use the permanent `/w/<slug>-<code>` URL. |
| Structured data (JSON-LD) | Home: `WebSite` with SearchAction (sitelinks search box) and `Organization` (with social links). Wallpaper: `ImageObject` with licence fields, which makes it eligible for the **“Licensable” badge in Google Images**, plus `BreadcrumbList`. Category: `BreadcrumbList` and `ItemList`. Device pages: breadcrumbs, `ItemList` and `FAQPage`. FAQ: `FAQPage`. |
| Sitemap | Static pages, guide chapters, categories, all device pages and every wallpaper, each with its **preview image** for Google Images (never the original). |
| robots.txt | Admin, account, checkout, sign-in, referral (`/r/`) and gift-code pages are blocked. Everything public is allowed, including AI crawlers. |
| Device landing pages | `/wallpapers-for/<device>` for 28 popular phones, tablets, laptops and monitors. Each lists only wallpapers that are sharp on that screen, shows the exact resolution, explains how to set a wallpaper on that device, and has FAQs. Wallpaper pages link to these from “Fits these screens”. |
| Category intros | Admin → Categories → “Intro”. Shown under the heading and used as the meta description. A sensible default appears until you write one. |
| AEO (AI answers) | `/llms.txt` gives a plain summary for ChatGPT, Perplexity and Google AI Overviews. FAQ schema covers the FAQ and device pages. Answers are written as short, quotable facts. |
| PWA | `manifest.webmanifest` plus icons, so people can “Install” the site or add it to their home screen like an app. This is our stand-in for ASO: a native app (Play Store / App Store) would be a separate project. |
| Speed | Pages are rendered in Mumbai (bom1) and images are cached. Watch Core Web Vitals in Search Console. |

## 2. Keyword map (which page targets what)

Priorities: **P1** = high intent, matches what we sell; **P2** = big but competitive; **P3** = long tail and seasonal.

| Cluster | Example searches (English / Hinglish) | Target page | Priority |
|---|---|---|---|
| Device-specific | iphone 16 pro wallpaper 4k, samsung s25 ultra wallpaper, ipad wallpaper hd, macbook air wallpaper, 4k monitor wallpaper, ultrawide wallpaper 3440x1440 | `/wallpapers-for/<device>` | P1 |
| Resolution | 4k wallpaper, 5k wallpaper, 4k wallpaper for pc, 4k phone wallpaper, hd wallpaper for mobile | `/explore`, home, `/collections/*` | P2 |
| AMOLED / dark | amoled wallpaper, black wallpaper 4k, dark wallpaper for phone, minimal wallpaper | `/collections/amoled-minimal` | P1 |
| Devotional (India) | radha krishna wallpaper hd, shiv ji wallpaper 4k, hanuman ji wallpaper, ganesh ji wallpaper, bhagwan wallpaper, mahadev wallpaper | `/collections/devotional` (write intros with these words) | P1 |
| Festival (seasonal) | diwali wallpaper, happy diwali hd wallpaper, holi wallpaper, ganesh chaturthi wallpaper, navratri wallpaper, janmashtami wallpaper | `/collections/festival` (+ a set per festival) | P3, timed |
| Nature / aesthetic | nature wallpaper 4k, mountain wallpaper, aesthetic wallpaper, sunset wallpaper | `/collections/nature`, `/collections/abstract` | P2 |
| Free | free 4k wallpaper download, free wallpaper for phone | `/free`, daily free wallpaper | P2 |
| Brand + trust | hirecwallp, hirecwallp review | home, `/about` | P1 (own it) |
| Creators | sell wallpapers online, sell digital art india, earn from ai art | `/creator` | P3 |

Rules for every wallpaper you upload (the AI fills these when `ANTHROPIC_API_KEY` is set; otherwise write them yourself):

- **Title:** what's in it, 2–4 words (“Radha Krishna Flute”, not “IMG_2031”).
- **Tags:** 5–10 searchable words, including Hindi names where people use them (krishna, kanha, murli).
- **Alt text:** one plain sentence describing the image.
- **Category:** always set. Uncategorised wallpapers miss their category page.

## 3. Festival calendar (seasonal traffic)

Seasonal searches start **3–4 weeks before** the festival. For each one:
1. Upload 10–20 themed wallpapers into Festival.
2. Make a set.
3. Pin the set on the home page.
4. Optionally add a festival offer (Admin → Credit packs → sale dates).

Main ones: Diwali, Navratri/Durga Puja, Ganesh Chaturthi, Janmashtami, Holi, Raksha Bandhan, Makar Sankranti, Independence Day / Republic Day, New Year and Christmas (global).

## 4. Off-site (where wallpaper traffic really comes from)

- **Pinterest is the biggest source for wallpapers.** Create a business account and a board per category. Pin every wallpaper with its page link, using the preview (watermarked) image. Admin → Social posts can schedule these once the Pinterest token is set.
- **Instagram Reels / YouTube Shorts:** use the promo videos in `marketing/promo` and post short device try-ons. Put the link in the bio and the description.
- **Reddit / communities** (r/wallpapers, r/Amoledbackgrounds, r/iphonewallpapers): share honestly and follow each subreddit's rules on self-promotion.
- **Backlinks:** creator profiles link back. Tech bloggers writing “best wallpaper sites” lists: offer them free credits to review.

## 5. Owner checklist

**Once, after the domain is live:**
- [ ] Google Search Console: add the domain property, verify by DNS, submit `https://hirecwallp.com/sitemap.xml`.
- [ ] Bing Webmaster Tools: import from Search Console (this also feeds ChatGPT search / Copilot).
- [ ] Test a wallpaper page in Google's **Rich Results Test** (should show ImageObject + Breadcrumbs).
- [ ] Write intros for every category (Admin → Categories), using words from the keyword map.
- [ ] Set your social profile links (Admin → Settings → Business). They feed the Organization schema.

**Weekly:**
- [ ] Upload new wallpapers with good titles, tags and categories. Freshness matters.
- [ ] Search Console → Performance: find queries with impressions but few clicks, then improve those pages' titles and intros.
- [ ] Pin new wallpapers on Pinterest.

**Monthly:**
- [ ] Search Console → Pages: fix anything “Not indexed” that should be indexed.
- [ ] Plan the next festival 4 weeks ahead.
