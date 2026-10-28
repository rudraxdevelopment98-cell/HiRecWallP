import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Check, Download, ShieldCheck, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { ResolutionSelector } from '@/components/resolution-selector';
import { AddToCart } from '@/components/add-to-cart';
import { WallpaperCard } from '@/components/wallpaper-card';
import { Reveal } from '@/components/reveal';
import { TrackEvent } from '@/components/track-event';
import { getDisplayRegion, getWallpaperBySlug, listPublishedWallpapers } from '@/lib/catalogue';
import { formatRegionPrice } from '@/lib/format';
import { publicEnv } from '@/lib/env';

const COMMERCIAL_MULTIPLIER = 5;

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

export default async function WallpaperDetailPage({ params }: { params: { slug: string } }) {
  const region = getDisplayRegion();
  const w = await getWallpaperBySlug(params.slug, region);
  if (!w) notFound();

  const related = (await listPublishedWallpapers({ sort: 'popular' }, region, 8)).filter((r) => r.id !== w.id).slice(0, 4);
  const wasPrice = !w.is_free && w.price != null ? w.price * 2 : null;

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

      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/explore" className="hover:text-foreground">Explore</Link>
        {w.categoryName && (
          <>
            {' · '}
            <Link href={`/collections/${w.category_id?.replace('cat-', '')}`} className="hover:text-foreground">
              {w.categoryName}
            </Link>
          </>
        )}
        {' · '}
        {w.title}
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Preview */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-muted">
          {w.previewUrl ? (
            <Image src={w.previewUrl} alt={w.alt_text ?? w.title} fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" priority />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">Watermarked preview</div>
          )}
          <div className="absolute left-3 top-3 flex gap-1.5">
            {w.resolution && <span className="rounded-md bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">{w.resolution}</span>}
            {w.is_free && <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">FREE</span>}
          </div>
        </div>

        {/* Buy box */}
        <div className="space-y-5">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {w.is_ai_generated && <Badge variant="outline">AI-generated</Badge>}
              {w.categoryName && <span className="text-sm text-muted-foreground">{w.categoryName}</span>}
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{w.title}</h1>
            {w.rating != null && (
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-medium text-foreground">{w.rating.toFixed(1)}</span> ({w.reviews} reviews)
              </p>
            )}
          </div>

          <div className="flex items-end gap-3">
            <span className="text-3xl font-semibold">
              {w.is_free ? 'Free' : w.price != null ? formatRegionPrice(w.price, region) : '—'}
            </span>
            {wasPrice != null && (
              <>
                <span className="text-lg text-muted-foreground line-through">{formatRegionPrice(wasPrice, region)}</span>
                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">50% OFF</span>
              </>
            )}
          </div>

          <ResolutionSelector />

          <div className="flex flex-col gap-2 sm:flex-row">
            {w.is_free ? (
              <Link href="/login" className={buttonVariants({ size: 'lg', className: 'flex-1' })}>
                <Download className="mr-1 h-4 w-4" /> Download Free
              </Link>
            ) : (
              <AddToCart
                item={{
                  id: w.id,
                  slug: w.slug,
                  title: w.title,
                  image: w.previewUrl,
                  price: w.price,
                  priceLabel: w.price != null ? formatRegionPrice(w.price, region) : 'Free',
                  licence: 'personal',
                  resolution: w.resolution,
                }}
              />
            )}
            <Link href="/licence" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
              Licence
            </Link>
          </div>

          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Secure &amp; Encrypted Payment · VISA · UPI · PayPal
          </p>

          <div className="grid grid-cols-3 gap-2 border-t pt-4 text-center text-xs text-muted-foreground">
            <Perk label="Instant Download" />
            <Perk label="Lifetime Access" />
            <Perk label="Per-buyer watermark" />
          </div>

          {!w.is_free && w.price != null && (
            <div className="flex items-center justify-between rounded-xl border p-3 text-sm">
              <div>
                <p className="font-medium">Commercial licence</p>
                <p className="text-xs text-muted-foreground">Use in products, ads &amp; client work.</p>
              </div>
              <span className="font-medium">{formatRegionPrice(w.price * COMMERCIAL_MULTIPLIER, region)}</span>
            </div>
          )}
        </div>
      </div>

      {/* About + details */}
      <section className="mt-12 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          <h2 className="mb-2 font-display text-xl font-semibold">About This Wallpaper</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {w.description ?? `${w.title} — an ultra-HD, AI-crafted wallpaper tuned for phone, desktop and tablet.`}
          </p>
          {w.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {w.tags.map((t) => (
                <span key={t} className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
        <dl className="h-fit rounded-2xl border bg-card p-5 text-sm">
          <Row k="Category" v={w.categoryName ?? '—'} />
          <Row k="File Type" v="JPG / 8K" />
          <Row k="Resolution" v={w.resolution ?? '4K'} />
          <Row k="Colour Depth" v="24-bit" />
          <Row k="Licence" v="Personal (commercial available)" last />
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
