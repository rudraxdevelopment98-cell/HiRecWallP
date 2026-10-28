'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Download, Gem, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WallpaperCard } from '@/types/catalogue';

const FEATURES = [
  { icon: Gem, title: '4K & 8K Quality', sub: 'Crystal clear detail' },
  { icon: Download, title: 'Instant Download', sub: 'Get it right away' },
  { icon: MonitorSmartphone, title: 'All Devices', sub: 'Mobile to 8K displays' },
  { icon: ShieldCheck, title: 'Secure Payment', sub: '100% safe & encrypted' },
];

/**
 * Hero: bold headline + CTAs + feature row on the left; an interactive device
 * cluster (desktop + phone) that live-previews the hovered wallpaper on the
 * right, with a cursor-driven tilt.
 */
export function HeroShowcase({ items }: { items: WallpaperCard[] }) {
  const [active, setActive] = useState(0);
  const clusterRef = useRef<HTMLDivElement | null>(null);
  const current = items[active];
  const src = (w: WallpaperCard) => w.previewUrl ?? '/demo/amoled-void.jpg';

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

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
      {/* Copy */}
      <div className="animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Premium wallpapers for every device
        </p>
        <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
          Stunning Wallpapers.
          <br /> Any Screen.
        </h1>
        <p className="mt-5 max-w-md text-balance text-muted-foreground">
          Discover 4K &amp; 8K high-resolution wallpapers for your mobile, tablet, laptop and
          desktop. Curated for those who love beautiful screens.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/explore" className={buttonVariants({ size: 'lg' })}>
            Explore Wallpapers →
          </Link>
          <Link href="/collections/nature" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
            View Collections
          </Link>
        </div>
        <dl className="mt-9 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-2.5">
              <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
              <div>
                <dt className="text-sm font-semibold leading-tight">{f.title}</dt>
                <dd className="text-xs text-muted-foreground">{f.sub}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>

      {/* Device cluster */}
      {current && (
        <div className="relative flex flex-col items-center gap-5">
          <span className="absolute -top-4 right-2 hidden rotate-[-8deg] font-display text-sm text-muted-foreground sm:block">
            Your world, in 4K &amp; 8K ↓
          </span>
          <div className="device-stage w-full pt-6" onPointerMove={onMove} onPointerLeave={reset}>
            <div ref={clusterRef} className="device-cluster mx-auto">
              <div className="device-monitor">
                <div className="device-screen monitor-screen">
                  <Screen items={items} active={active} src={src} sizes="620px" />
                  <div className="device-gloss" />
                </div>
                <div className="monitor-neck" />
                <div className="monitor-base" />
              </div>
              <div className="device-phone-sm">
                <div className="device-notch" />
                <div className="device-screen">
                  <Screen items={items} active={active} src={src} sizes="180px" />
                  <div className="device-gloss" />
                </div>
              </div>
            </div>
          </div>

          <div className="no-scrollbar flex max-w-full gap-2 overflow-x-auto pb-1">
            {items.slice(0, 8).map((w, i) => (
              <button
                key={w.id}
                type="button"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                aria-label={`Preview ${w.title}`}
                className={cn(
                  'relative h-14 w-11 shrink-0 overflow-hidden rounded-lg border transition-all',
                  i === active ? 'border-foreground ring-2 ring-ring/40' : 'opacity-70 hover:opacity-100',
                )}
              >
                <Image src={src(w)} alt="" fill sizes="44px" className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
          className={cn('object-cover transition-opacity duration-500', i === active ? 'opacity-100' : 'opacity-0')}
        />
      ))}
    </>
  );
}
