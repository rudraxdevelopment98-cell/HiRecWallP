import { WallpaperCard } from '@/components/wallpaper-card';
import { Reveal } from '@/components/reveal';
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
      <p className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((w, i) => (
        <Reveal key={w.id} delay={(i % 5) * 60}>
          <WallpaperCard wallpaper={w} />
        </Reveal>
      ))}
    </div>
  );
}
