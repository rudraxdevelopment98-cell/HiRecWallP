'use client';

import { useEffect, useState } from 'react';
import { WallpaperCard } from '@/components/wallpaper-card';
import { demoWallpapers } from '@/lib/demo';
import { localFavouriteIds } from '@/lib/favourites-client';
import type { RegionCode } from '@/lib/geo';
import type { WallpaperCard as Card } from '@/types/catalogue';

/** Favourites saved in this browser for demo-catalogue items. */
export function LocalFavourites({ region }: { region: RegionCode }) {
  const [items, setItems] = useState<Card[]>([]);
  useEffect(() => {
    const ids = new Set(localFavouriteIds());
    setItems(demoWallpapers(region).filter((w) => ids.has(w.id)));
  }, [region]);
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {items.map((w) => (
        <WallpaperCard key={w.id} wallpaper={w} />
      ))}
    </div>
  );
}
