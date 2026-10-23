import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { getDisplayRegion, getWallpaperBySlug } from '@/lib/catalogue';
import { formatRegionPrice } from '@/lib/format';
import { publicEnv } from '@/lib/env';
import { TrackEvent } from '@/components/track-event';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const region = getDisplayRegion();
  const w = await getWallpaperBySlug(params.slug, region);
  if (!w) return { title: 'Wallpaper not found' };
  return {
    title: w.title,
    description: w.description ?? `${w.title} — ultra-HD AI wallpaper.`,
    openGraph: {
      title: w.title,
      description: w.description ?? undefined,
      images: w.previewUrl ? [{ url: w.previewUrl }] : undefined,
    },
  };
}

export default async function WallpaperDetailPage({ params }: { params: { slug: string } }) {
  const region = getDisplayRegion();
  const w = await getWallpaperBySlug(params.slug, region);
  if (!w) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    name: w.title,
    description: w.description ?? undefined,
    contentUrl: w.previewUrl ?? undefined,
    creditText: publicEnv.NEXT_PUBLIC_BRAND_NAME,
    ...(w.price != null && !w.is_free
      ? {
          offers: {
            '@type': 'Offer',
            availability: 'https://schema.org/InStock',
          },
        }
      : {}),
  };

  return (
    <main className="container grid gap-8 py-10 md:grid-cols-2">
      <script
        type="application/ld+json"
        // JSON-LD is trusted, server-generated metadata.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TrackEvent type="detail_view" wallpaperId={w.id} />

      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-card">
        <div className="aurora opacity-60" aria-hidden />
        {w.previewUrl ? (
          <Image
            src={w.previewUrl}
            alt={w.alt_text ?? w.title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Watermarked preview
          </div>
        )}
      </div>

      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {w.is_ai_generated && <Badge variant="outline">AI-generated</Badge>}
          {w.human_edited && <Badge variant="outline">Human-edited</Badge>}
          {w.is_free && <Badge variant="free">FREE</Badge>}
        </div>

        <h1 className="text-3xl font-semibold tracking-tight">{w.title}</h1>
        {w.description && <p className="text-muted-foreground">{w.description}</p>}

        {w.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {w.tags.map((t) => (
              <span key={t} className="text-xs text-muted-foreground">
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className="glass rounded-2xl p-5">
          {w.is_free ? (
            <p className="text-lg font-medium">Free download available</p>
          ) : w.price != null ? (
            <p className="text-lg font-medium">{formatRegionPrice(w.price, region)}</p>
          ) : (
            <p className="text-muted-foreground">Price unavailable</p>
          )}
          <div className="mt-4 flex gap-3">
            {/* Secure download + checkout are wired after the payments gate. */}
            <Link href="/login" className={buttonVariants()}>
              {w.is_free ? 'Download free' : 'Buy now'}
            </Link>
            <Link href="/licence" className={buttonVariants({ variant: 'outline' })}>
              Licence
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Personal-use licence. Originals are delivered via a secure, expiring link after
            purchase.
          </p>
        </div>
      </div>
    </main>
  );
}
