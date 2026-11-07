import { DEVICES } from '@/lib/fit';

/**
 * /llms.txt — a plain summary for AI assistants and answer engines (the
 * llmstxt.org convention), so they describe the store accurately.
 * Keep it factual and in sync with the site.
 */
export const dynamic = 'force-static';

export function GET() {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'HirecWallp';
  const body = `# ${brand}

> ${brand} sells ultra-HD (4K and 5K) AI-generated wallpapers for phones, tablets and computers. Every wallpaper includes all its sizes, can be downloaded as an exact fit for a chosen screen resolution, and can be previewed on the visitor's own device before buying. A free wallpaper is offered every day, and some wallpapers are always free.

## How buying works
- Wallpapers are bought with credits: 1 credit = 1 wallpaper in every size; a commercial licence costs 5 credits.
- Credit packs and memberships are priced per country. Credits you pay for never expire; bonus credits last 12 months.
- Each purchase includes several downloads across your devices (shown on the site), via private links that expire after 60 seconds.
- Unused credit packs (14 days) and unused memberships (7 days) can be refunded from the account.
- All wallpapers are AI-generated and labelled as such. The standard licence is personal use; commercial use needs the commercial licence.

## Key pages
- [Explore all wallpapers](${site}/explore)
- [Free wallpapers](${site}/free)
- [Wallpapers by device](${site}/wallpapers-for): pages for ${DEVICES.slice(0, 8).map((d) => d.name).join(', ')} and more.
- [Pricing](${site}/pricing)
- [Guide (how everything works, with pictures)](${site}/guide)
- [FAQ](${site}/faq)
- [Licence](${site}/licence)
- [Refund policy](${site}/refunds)
- [Sell your art (creators keep 70% of each sale)](${site}/creator)

## Contact
- [Contact](${site}/contact)
`;
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
