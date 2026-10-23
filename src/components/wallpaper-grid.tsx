import { WallpaperCard } from '@/components/wallpaper-card';
import type { WallpaperCard as WallpaperCardData } from '@/types/catalogue';

export function WallpaperGrid({
  items,
  emptyMessage = 'Nothing here yet.',
}: {
  items: WallpaperCardData[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((w) => (
        <WallpaperCard key={w.id} wallpaper={w} />
      ))}
    </div>
  );
}
