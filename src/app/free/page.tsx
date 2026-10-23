import type { Metadata } from 'next';
import { WallpaperGrid } from '@/components/wallpaper-grid';
import { getDisplayRegion, listPublishedWallpapers } from '@/lib/catalogue';

export const metadata: Metadata = {
  title: 'Free wallpapers',
  description: 'Free ultra-HD AI wallpapers — no login required for free variants.',
};

export default async function FreePage() {
  const region = getDisplayRegion();
  const items = await listPublishedWallpapers({ free: true, sort: 'newest' }, region);
  return (
    <main className="container space-y-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Free picks</h1>
        <p className="text-sm text-muted-foreground">
          Free variants are capped below 4K and never expose the original files.
        </p>
      </div>
      <WallpaperGrid items={items} emptyMessage="No free wallpapers published yet." />
    </main>
  );
}
