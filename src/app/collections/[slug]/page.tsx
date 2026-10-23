import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { WallpaperGrid } from '@/components/wallpaper-grid';
import {
  getCategoryBySlug,
  getDisplayRegion,
  listPublishedWallpapers,
} from '@/lib/catalogue';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const cat = await getCategoryBySlug(params.slug);
  return {
    title: cat ? cat.name : 'Collection',
    description: cat ? `${cat.name} wallpapers.` : undefined,
  };
}

export default async function CollectionPage({ params }: { params: { slug: string } }) {
  const cat = await getCategoryBySlug(params.slug);
  const region = getDisplayRegion();
  const items = await listPublishedWallpapers({ category: params.slug, sort: 'newest' }, region);

  // When the DB is configured and the category is unknown, 404; otherwise show
  // the slug as a title so the route is viewable pre-seed.
  if (!cat && items.length === 0 && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    notFound();
  }

  return (
    <main className="container space-y-6 py-10">
      <h1 className="text-2xl font-semibold">{cat?.name ?? params.slug}</h1>
      <WallpaperGrid items={items} emptyMessage="No wallpapers in this collection yet." />
    </main>
  );
}
