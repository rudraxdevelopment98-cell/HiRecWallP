import Image from 'next/image';
import Link from 'next/link';
import { Bookmark, Heart, Star } from 'lucide-react';
import { formatRegionPrice } from '@/lib/format';
import type { WallpaperCard as WallpaperCardData } from '@/types/catalogue';

/** Marketplace product card: preview, resolution badge, title, price + rating. */
export function WallpaperCard({ wallpaper }: { wallpaper: WallpaperCardData }) {
  const { slug, title, previewUrl, is_free, price, region, alt_text } = wallpaper;
  const category = wallpaper.categoryName;
  return (
    <Link
      href={`/w/${slug}`}
      className="hover-lift group block overflow-hidden rounded-2xl border bg-card"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt={alt_text ?? title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="shimmer h-full w-full" />
        )}
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          {wallpaper.resolution && (
            <span className="rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
              {wallpaper.resolution}
            </span>
          )}
          {is_free && (
            <span className="rounded-md bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              FREE
            </span>
          )}
        </div>
        <span className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-white/85 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100">
          <Bookmark className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="space-y-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            {category && <p className="truncate text-xs text-muted-foreground">{category}</p>}
          </div>
          <Heart className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-rose-500" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            {is_free ? 'Free' : price != null ? formatRegionPrice(price, region) : '—'}
          </span>
          {wallpaper.rating != null && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="font-medium text-foreground">{wallpaper.rating.toFixed(1)}</span>
              {wallpaper.reviews != null && <span>({wallpaper.reviews})</span>}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
