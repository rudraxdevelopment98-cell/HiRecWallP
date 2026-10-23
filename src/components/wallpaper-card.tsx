import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatRegionPrice } from '@/lib/format';
import type { WallpaperCard as WallpaperCardData } from '@/types/catalogue';

/** Grid card showing the watermarked preview, title and price/FREE badge. */
export function WallpaperCard({ wallpaper }: { wallpaper: WallpaperCardData }) {
  const { slug, title, previewUrl, is_free, price, region, alt_text } = wallpaper;
  return (
    <Link
      href={`/w/${slug}`}
      className="hover-lift group block overflow-hidden rounded-2xl border border-white/5 bg-card"
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt={alt_text ?? title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="shimmer flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Preview
          </div>
        )}
        {/* bottom gradient for legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute left-3 top-3">
          {is_free ? (
            <Badge variant="free">FREE</Badge>
          ) : price != null ? (
            <Badge variant="secondary">{formatRegionPrice(price, region)}</Badge>
          ) : null}
        </div>
        <p className="absolute inset-x-3 bottom-3 translate-y-1 truncate text-sm font-medium text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          {title}
        </p>
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-medium">{title}</p>
      </div>
    </Link>
  );
}
