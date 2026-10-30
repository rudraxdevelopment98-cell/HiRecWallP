import Image from 'next/image';
import Link from 'next/link';
import { FavouriteButton } from '@/components/favourite-button';
import { formatRegionPrice } from '@/lib/format';
import type { WallpaperCard as WallpaperCardData } from '@/types/catalogue';

/** Marketplace product card: preview, resolution badge, title, price, favourite. */
export function WallpaperCard({ wallpaper }: { wallpaper: WallpaperCardData }) {
  const { slug, title, previewUrl, is_free, price, region, alt_text } = wallpaper;
  const category = wallpaper.categoryName;
  return (
    <div className="hover-lift group relative overflow-hidden rounded-2xl border bg-card">
      <Link href={`/w/${slug}`} className="block">
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
        </div>
        <div className="space-y-1.5 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            {category && <p className="truncate text-xs text-muted-foreground">{category}</p>}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {is_free ? 'Free' : price != null ? formatRegionPrice(price, region) : '—'}
            </span>
            {wallpaper.orientation && (
              <span className="text-xs capitalize text-muted-foreground">
                {wallpaper.orientation}
              </span>
            )}
          </div>
        </div>
      </Link>
      <FavouriteButton id={wallpaper.id} className="absolute right-2.5 top-2.5" />
    </div>
  );
}
