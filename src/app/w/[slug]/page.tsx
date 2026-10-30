import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Check, Download, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { FavouriteButton } from '@/components/favourite-button';
import { AddToCart } from '@/components/add-to-cart';
import { DownloadButton } from '@/components/download-button';
import { FREE_VARIANT_LABELS, downloadableVariants } from '@/lib/variants';
import { WallpaperCard } from '@/components/wallpaper-card';
import { Reveal } from '@/components/reveal';
import { TrackEvent } from '@/components/track-event';
import { getDisplayRegion, getWallpaperBySlug, listPublishedWallpapers } from '@/lib/catalogue';
import { formatRegionPrice } from '@/lib/format';
import { REGION_PRICING_UNIT } from '@/lib/geo';
import { publicEnv } from '@/lib/env';

const COMMERCIAL_MULTIPLIER = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const region = getDisplayRegion();
  const w = await getWallpaperBySlug(params.slug, region);
  if (!w) return { title: 'Wallpaper not found' };
  return {
    title: w.title,
    description: w.description ?? `${w.title} — ultra-HD AI wallpaper.`,
    openGraph: { title: w.title, description: w.description ?? undefined, images: w.previewUrl ? [{ url: w.previewUrl }] : undefined },
  };
}

const SIZE_INFO: Record<string, { label: string; dims: string }> = {
  phone: { label: 'Phone', dims: '1440 × 3120' },
  tablet: { label: 'Tablet', dims: '2048 × 2732' },
  desktop_4k: { label: 'Desktop 4K', dims: '3840 × 2160' },
  desktop_5k: { label: 'Desktop 5K', dims: '5120 × 2880' },
  ultrawide: { label: 'Ultrawide', dims: '5120 × 2160' },
};

export default async function WallpaperDetailPage({ params }: { params: { slug: string } }) {
  const region = getDisplayRegion();
  const w = await getWallpaperBySlug(params.slug, region);
  if (!w) notFound();

  const related = (await listPublishedWallpapers({ sort: 'newest' }, region, 8)).filter((r) => r.id !== w.id).slice(0, 4);
  const freeVariants =
    w.is_free && UUID.test(w.id)
      ? ((await downloadableVariants([w.id])).get(w.id) ?? ['free_phone', 'free_desktop']).filter((v) => v in FREE_VARIANT_LABELS)
      : [];
  const sizes = (w.devices ?? []).filter((d) => d in SIZE_INFO);
  const commercialPrice =
    !w.is_free && w.price != null
      ? REGION_PRICING_UNIT[region] === 'money'
        ? Math.round(w.price * COMMERCIAL_MULTIPLIER)
        : Math.ceil(w.price * COMMERCIAL_MULTIPLIER)
      : null;
  const cartBase = { id: w.id, slug: w.slug, title: w.title, image: w.previewUrl, resolution: w.resolution };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    name: w.title,
    description: w.description ?? undefined,
    contentUrl: w.previewUrl ?? undefined,
    creditText: publicEnv.NEXT_PUBLIC_BRAND_NAME,
  };

  return (
    <main className="container py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <TrackEvent type="detail_view" wallpaperId={w.id} />
      <p className="mb-5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        {' · '}
        <Link href="/explore" className="hover:text-foreground">Explore</Link>
        {w.categoryName && (
          <>
            {' · '}
            <Link href={`/explore?category=${encodeURIComponent(w.category_id?.replace('cat-', '') ?? '')}`} className="hover:text-foreground">
              {w.categoryName}
            </Link>
          </>
        )}
        {' · '}
        {w.title}
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Preview */}
        <div className={`relative overflow-hidden rounded-2xl border bg-muted ${w.orientation === 'portrait' ? 'mx-auto aspect-[9/16] w-full max-w-sm' : 'aspect-[4/3]'}`}>
          {w.previewUrl ? (
            <Image src={w.previewUrl} alt={w.alt_text ?? w.title} fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" priority />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">Watermarked preview</div>
          )}
          <div className="absolute left-3 top-3 flex gap-1.5">
            {w.resolution && <span className="rounded-md bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">{w.resolution}</span>}
            {w.is_free && <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">FREE</span>}
          </div>
          <p className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-0.5 text-[11px] text-white">
            Preview is watermarked · your download is full quality
          </p>
        </div>

        {/* Buy box */}
        <div className="space-y-5">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {w.is_ai_generated && <Badge variant="outline">AI-generated</Badge>}
              {w.categoryName && <span className="text-sm text-muted-foreground">{w.categoryName}</span>}
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{w.title}</h1>
          </div>

          <div className="flex items-end gap-3">
            <span className="text-3xl font-semibold">
              {w.is_free ? 'Free' : w.price != null ? formatRegionPrice(w.price, region) : '—'}
            </span>
            {!w.is_free && <span className="pb-1 text-sm text-muted-foreground">personal licence · all sizes below</span>}
          </div>

          {sizes.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Sizes included</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {sizes.map((d) => (
                  <div key={d} className="rounded-xl border p-3">
                    <span className="block text-sm font-medium">{SIZE_INFO[d]!.label}</span>
                    <span className="block text-xs text-muted-foreground">{SIZE_INFO[d]!.dims}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            {w.is_free ? (
              w.id.startsWith('demo-') || !UUID.test(w.id) ? (
                <a
                  href={w.previewUrl ?? '#'}
                  download={`${w.slug}.jpg`}
                  className={buttonVariants({ size: 'lg', className: 'flex-1' })}
                >
                  <Download className="mr-1 h-4 w-4" /> Download Free
                </a>
              ) : (
                <div className="flex flex-1 flex-wrap items-start gap-2">
                  {freeVariants.map((v) => (
                    <DownloadButton key={v} wallpaperId={w.id} variant={v as 'free_phone'} label={FREE_VARIANT_LABELS[v] ?? v} />
                  ))}
                </div>
              )
            ) : (
              <AddToCart
                item={{
                  ...cartBase,
                  price: w.price,
                  priceLabel: w.price != null ? formatRegionPrice(w.price, region) : '—',
                  licence: 'personal',
                }}
              />
            )}
            <FavouriteButton id={w.id} withLabel />
          </div>

          {!w.is_free && (
            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> Secure payment by Razorpay ·{' '}
              {REGION_PRICING_UNIT[region] === 'money' ? 'UPI · Cards · Netbanking' : 'Credits (bought by card)'}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 border-t pt-4 text-center text-xs text-muted-foreground">
            <Perk label="Instant download" />
            <Perk label="5 downloads per purchase" />
            <Perk label="Per-buyer watermark" />
          </div>

          {commercialPrice != null && (
            <div className="space-y-3 rounded-xl border p-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Commercial licence</p>
                  <p className="text-xs text-muted-foreground">
                    Use in products, ads &amp; client work. <Link href="/licence" className="underline">Licence terms</Link>
                  </p>
                </div>
                <span className="font-medium">{formatRegionPrice(commercialPrice, region)}</span>
              </div>
              <AddToCart
                variant="outline"
                label="Add commercial licence"
                item={{
                  ...cartBase,
                  price: commercialPrice,
                  priceLabel: formatRegionPrice(commercialPrice, region),
                  licence: 'commercial',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* About + details */}
      <section className="mt-12 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          <h2 className="mb-2 font-display text-xl font-semibold">About This Wallpaper</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {w.description ?? `${w.title} — an ultra-HD, AI-crafted wallpaper.`}
          </p>
          {w.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {w.tags.map((t) => (
                <Link key={t} href={`/explore?q=${encodeURIComponent(t)}`} className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
                  #{t}
                </Link>
              ))}
            </div>
          )}
        </div>
        <dl className="h-fit rounded-2xl border bg-card p-5 text-sm">
          <Row k="Category" v={w.categoryName ?? '—'} />
          <Row k="Orientation" v={w.orientation ? w.orientation[0]!.toUpperCase() + w.orientation.slice(1) : '—'} />
          <Row k="Largest size" v={w.max_long_edge ? `${w.max_long_edge}px (${w.resolution})` : '—'} />
          <Row k="File type" v="JPG (high quality)" />
          <Row k="Licence" v={w.is_free ? 'Free personal use' : 'Personal (commercial available)'} last />
        </dl>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 font-display text-xl font-semibold">Related Wallpapers</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((r, i) => (
              <Reveal key={r.id} delay={(i % 4) * 50}>
                <WallpaperCard wallpaper={r} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Perk({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Check className="h-4 w-4 text-emerald-500" />
      {label}
    </div>
  );
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${last ? '' : 'border-b'}`}>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
