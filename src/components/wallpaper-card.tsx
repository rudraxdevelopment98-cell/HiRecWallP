import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatRegionPrice } from '@/lib/format';
import type { WallpaperCard as WallpaperCardData } from '@/types/catalogue';

/** Grid card showing the watermarked preview, title and price/FREE badge. */
export function WallpaperCard({ wallpaper }: { wallpaper: WallpaperCardData }) {
  const { slug, title, previewUrl, is_free, price, region, alt_text } = wallpaper;
  return (
    <Link href={`/w/${slug}`} className="group block overflow-hidden rounded-lg border">
      <div className="relative aspect-[3/4] bg-muted">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt={alt_text ?? title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Preview
          </div>
        )}
        <div className="absolute left-2 top-2">
          {is_free ? (
            <Badge variant="free">FREE</Badge>
          ) : price != null ? (
            <Badge variant="secondary">{formatRegionPrice(price, region)}</Badge>
          ) : null}
        </div>
      </div>
      <div className="p-2">
        <p className="truncate text-sm font-medium">{title}</p>
      </div>
    </Link>
  );
}
