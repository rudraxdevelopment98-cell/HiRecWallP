import Image from 'next/image';
import Link from 'next/link';
import type { WallpaperCard } from '@/types/catalogue';

/**
 * Auto-scrolling strip of wallpapers (pure CSS, pauses on hover, halts under
 * prefers-reduced-motion). Two rows can run in opposite directions.
 */
export function Marquee({
  items,
  reverse = false,
}: {
  items: WallpaperCard[];
  reverse?: boolean;
}) {
  if (items.length === 0) return null;
  const loop = [...items, ...items];
  return (
    <div className="marquee group">
      <div className={reverse ? 'marquee-track marquee-reverse' : 'marquee-track'}>
        {loop.map((w, i) => (
          <Link
            key={`${w.id}-${i}`}
            href={`/w/${w.slug}`}
            className="relative aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 sm:w-36"
            aria-hidden={i >= items.length}
            tabIndex={i >= items.length ? -1 : 0}
          >
            <Image
              src={w.previewUrl ?? '/demo/amoled-void.jpg'}
              alt={w.title}
              fill
              sizes="144px"
              className="object-cover"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
