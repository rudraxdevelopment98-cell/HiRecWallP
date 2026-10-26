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
 * Signature hero: a desktop monitor + phone pairing that both live-preview the
 * wallpaper the visitor hovers in the rail, with a cursor-driven 3D tilt.
 * "See it on every screen" before buying — generic galleries don't offer this.
 */
export function HeroShowcase({ items }: { items: WallpaperCard[] }) {
  const [active, setActive] = useState(0);
  const clusterRef = useRef<HTMLDivElement | null>(null);
  const current = items[active];

  function onMove(e: React.PointerEvent) {
    const el = clusterRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(-py * 8).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(px * 10).toFixed(2)}deg`);
  }
  function reset() {
    const el = clusterRef.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }

  if (!current) return null;
  const src = (w: WallpaperCard) => w.previewUrl ?? '/demo/amoled-void.jpg';

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
      {/* Copy */}
      <div className="animate-fade-up space-y-6">
        <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs tracking-wide text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--glow))]" /> Live preview · phone &
          desktop
        </span>
        <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
          <span className="text-gradient">Wallpapers</span>
          <br /> for every screen
        </h1>
        <p className="max-w-md text-balance text-muted-foreground">
          An ultra-HD, AI-crafted collection — devotional, AMOLED and abstract. Hover any
          thumbnail to see it come alive on desktop <em>and</em> phone.
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
          <Stat value="Phone · Desktop" label="matching sets" />
          <Stat value="₹9+" label="from" />
        </div>
      </div>

      {/* Device cluster */}
      <div className="flex flex-col items-center gap-6">
        <div className="device-stage w-full" onPointerMove={onMove} onPointerLeave={reset}>
          <div ref={clusterRef} className="device-cluster mx-auto">
            {/* Desktop monitor */}
            <div className="device-monitor">
              <div className="device-screen monitor-screen">
                <Screen items={items} active={active} src={src} sizes="620px" />
                <div className="device-gloss" />
              </div>
              <div className="monitor-neck" />
              <div className="monitor-base" />
            </div>

            {/* Phone overlapping front-right */}
            <div className="device-phone-sm">
              <div className="device-notch" />
              <div className="device-screen">
                <Screen items={items} active={active} src={src} sizes="180px" />
                <div className="device-gloss" />
              </div>
            </div>

            {/* Caption chip */}
            <div className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap">
              <span className="glass rounded-full px-3 py-1 text-xs font-medium text-white">
                {current.title}
              </span>
              {current.is_free ? (
                <Badge variant="free">FREE</Badge>
              ) : current.price != null ? (
                <Badge variant="secondary">{formatRegionPrice(current.price, current.region)}</Badge>
              ) : null}
              <Link href={`/w/${current.slug}`} className={buttonVariants({ size: 'sm' })}>
                View
              </Link>
            </div>
          </div>
        </div>

        {/* Thumbnail rail */}
        <div className="flex max-w-full gap-2 overflow-x-auto px-1 pb-2 pt-4">
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
              <Image src={src(w)} alt="" fill sizes="48px" className="object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Stacked, cross-fading wallpaper layers shared by both device screens. */
function Screen({
  items,
  active,
  src,
  sizes,
}: {
  items: WallpaperCard[];
  active: number;
  src: (w: WallpaperCard) => string;
  sizes: string;
}) {
  return (
    <>
      {items.map((w, i) => (
        <Image
          key={w.id}
          src={src(w)}
          alt={w.title}
          fill
          sizes={sizes}
          priority={i === 0}
          className={cn(
            'object-cover transition-opacity duration-500',
            i === active ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-base font-semibold text-foreground">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}
