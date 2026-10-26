'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatRegionPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { WallpaperCard } from '@/types/catalogue';

/**
 * Signature hero: a phone mockup that live-previews whichever wallpaper the
 * visitor hovers in the rail, with a subtle cursor-driven 3D tilt. "See it on
 * your screen" before buying — the interaction generic galleries don't offer.
 */
export function HeroShowcase({ items }: { items: WallpaperCard[] }) {
  const [active, setActive] = useState(0);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const current = items[active];

  function onMove(e: React.PointerEvent) {
    const el = frameRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(-py * 10).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(px * 12).toFixed(2)}deg`);
  }
  function reset() {
    const el = frameRef.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }

  if (!current) return null;

  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      {/* Copy */}
      <div className="animate-fade-up space-y-6">
        <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs tracking-wide text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--glow))]" /> Live preview · see it on your screen
        </span>
        <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
          <span className="text-gradient">Wallpapers</span>
          <br /> carved for your screen
        </h1>
        <p className="max-w-md text-balance text-muted-foreground">
          An ultra-HD, AI-crafted collection — devotional, AMOLED and abstract. Hover any
          thumbnail to see it come alive on the phone.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/explore" className={buttonVariants({ size: 'lg' })}>
            Browse the collection
          </Link>
          <Link href="/free" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
            Free picks
          </Link>
        </div>
        <div className="flex gap-8 pt-2 text-sm text-muted-foreground">
          <Stat value="4K–5K" label="ultra-HD" />
          <Stat value="₹9+" label="from" />
          <Stat value="60s" label="secure links" />
        </div>
      </div>

      {/* Device + rail */}
      <div className="flex flex-col items-center gap-6">
        <div className="device-stage" onPointerMove={onMove} onPointerLeave={reset}>
          <div ref={frameRef} className="device-phone">
            <div className="device-notch" />
            <div className="device-screen">
              {items.map((w, i) => (
                <Image
                  key={w.id}
                  src={w.previewUrl ?? '/demo/amoled-void.jpg'}
                  alt={w.title}
                  fill
                  sizes="320px"
                  priority={i === 0}
                  className={cn(
                    'object-cover transition-opacity duration-500',
                    i === active ? 'opacity-100' : 'opacity-0',
                  )}
                />
              ))}
              <div className="device-gloss" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-white drop-shadow">{current.title}</p>
                  {current.is_free ? (
                    <Badge variant="free">FREE</Badge>
                  ) : current.price != null ? (
                    <Badge variant="secondary">{formatRegionPrice(current.price, current.region)}</Badge>
                  ) : null}
                </div>
                <Link
                  href={`/w/${current.slug}`}
                  className={buttonVariants({ size: 'sm' })}
                  aria-label={`View ${current.title}`}
                >
                  View
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Thumbnail rail */}
        <div className="flex max-w-full gap-2 overflow-x-auto pb-2">
          {items.slice(0, 8).map((w, i) => (
            <button
              key={w.id}
              type="button"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              aria-label={`Preview ${w.title}`}
              className={cn(
                'relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border transition-all',
                i === active
                  ? 'border-foreground/60 ring-2 ring-[hsl(var(--glow)/0.5)]'
                  : 'border-white/10 opacity-70 hover:opacity-100',
              )}
            >
              <Image src={w.previewUrl ?? '/demo/amoled-void.jpg'} alt="" fill sizes="48px" className="object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}
