import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { WallpaperCard } from '@/components/wallpaper-card';
import { AddSetToCart } from '@/components/add-set-to-cart';
import { Reveal } from '@/components/reveal';
import { getDisplayRegion, getSetBySlug, listSetWallpapers } from '@/lib/catalogue';
import { formatRegionPrice } from '@/lib/format';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const set = await getSetBySlug(params.slug);
  return { title: set ? set.title : 'Set', description: set?.description ?? undefined };
}

export default async function SetPage({ params }: { params: { slug: string } }) {
  const set = await getSetBySlug(params.slug);
  if (!set) notFound();
  const region = getDisplayRegion();
  const items = await listSetWallpapers(set.id, region);
  const paid = items.filter((w) => !w.is_free && w.price != null);
  const total = paid.reduce((s, w) => s + (w.price ?? 0), 0);

  return (
    <main className="container space-y-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Matching set · {items.length} wallpapers</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{set.title}</h1>
          {set.description && <p className="mt-1 max-w-xl text-sm text-muted-foreground">{set.description}</p>}
        </div>
        {paid.length > 0 && (
          <div className="text-right">
            <p className="mb-2 text-sm text-muted-foreground">Whole set: {formatRegionPrice(total, region)}</p>
            <AddSetToCart
              items={paid.map((w) => ({
                id: w.id,
                slug: w.slug,
                title: w.title,
                image: w.previewUrl,
                price: w.price,
                priceLabel: formatRegionPrice(w.price!, region),
                licence: 'personal',
                resolution: w.resolution,
              }))}
            />
          </div>
        )}
      </div>
      {items.length === 0 ? (
        <p className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Wallpapers in this set will appear here once published.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((w, i) => (
            <Reveal key={w.id} delay={(i % 4) * 50}>
              <WallpaperCard wallpaper={w} />
            </Reveal>
          ))}
        </div>
      )}
    </main>
  );
}
