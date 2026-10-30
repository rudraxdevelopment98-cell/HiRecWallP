import Link from 'next/link';
import type { Metadata } from 'next';
import { WallpaperCard } from '@/components/wallpaper-card';
import { LocalFavourites } from '@/components/account/local-favourites';
import { createClient } from '@/lib/supabase/server';
import { getDisplayRegion, listWallpapersByIds } from '@/lib/catalogue';

export const metadata: Metadata = { title: 'Favourites' };

export default async function FavouritesPage() {
  const region = getDisplayRegion();
  const { data } = await createClient()
    .from('favourites')
    .select('wallpaper_id')
    .order('created_at', { ascending: false });
  const items = await listWallpapersByIds((data ?? []).map((r) => r.wallpaper_id as string), region);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Favourites</h1>
        <p className="text-sm text-muted-foreground">Tap the heart on any wallpaper to save it here.</p>
      </div>
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((w) => (
            <WallpaperCard key={w.id} wallpaper={w} />
          ))}
        </div>
      )}
      <LocalFavourites region={region} />
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing saved yet? <Link href="/explore" className="underline">Explore wallpapers</Link>.
        </p>
      )}
    </div>
  );
}
