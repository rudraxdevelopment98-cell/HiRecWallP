import Image from 'next/image';
import Link from 'next/link';
import { Download, Gem, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

const FEATURES = [
  { icon: Gem, title: '4K & 8K Quality', sub: 'Crystal clear detail' },
  { icon: Download, title: 'Instant Download', sub: 'Get it right away' },
  { icon: MonitorSmartphone, title: 'All Devices', sub: 'Mobile to 8K displays' },
  { icon: ShieldCheck, title: 'Secure Payment', sub: '100% safe & encrypted' },
];

const HERO_IMG = '/demo/hero.jpg';

/**
 * Static hero matching the reference: bold headline + CTAs + feature row on the
 * left, a full-bleed scenic image on the right with laptop/tablet/phone mockups
 * composited on top and a handwritten accent.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden border-b">
      {/* Right-side bleed image */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[56%] lg:block">
        <Image src={HERO_IMG} alt="" fill priority sizes="60vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
      </div>

      <div className="container relative py-14 sm:py-20">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Premium wallpapers for every device
          </p>
          <h1 className="animate-fade-up mt-4 font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
            Stunning Wallpapers.
            <br /> Any Screen.
          </h1>
          <p className="animate-fade-up mt-5 max-w-md text-balance text-muted-foreground [animation-delay:80ms]">
            Discover 4K &amp; 8K high-resolution wallpapers for your mobile, tablet, laptop and
            desktop. Curated for those who love beautiful screens.
          </p>
          <div className="animate-fade-up mt-7 flex flex-wrap gap-3 [animation-delay:160ms]">
            <Link href="/explore" className={buttonVariants({ size: 'lg' })}>
              Explore Wallpapers →
            </Link>
            <Link href="/collections" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
              View Collections
            </Link>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-2 gap-5 sm:grid-cols-4">
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

        {/* Device mockups composited over the image (desktop only) */}
        <div className="pointer-events-none absolute bottom-6 right-[5%] hidden w-[42%] max-w-xl items-end justify-end gap-0 lg:flex">
          <span className="absolute -top-10 right-10 rotate-[-10deg] font-display text-sm text-foreground/70">
            Your world, in 4K &amp; 8K ↓
          </span>

          {/* Laptop */}
          <div className="relative z-10 w-[72%]">
            <div className="overflow-hidden rounded-xl border-4 border-neutral-800 bg-neutral-900 shadow-2xl">
              <div className="relative aspect-[16/10]">
                <Image src={HERO_IMG} alt="" fill sizes="440px" className="object-cover" />
              </div>
            </div>
            <div className="mx-auto h-2.5 w-[112%] -translate-x-[5%] rounded-b-xl bg-neutral-700 shadow-lg" />
          </div>

          {/* Tablet */}
          <div className="relative z-20 -ml-10 w-[34%] translate-y-2">
            <div className="overflow-hidden rounded-xl border-4 border-neutral-800 bg-neutral-900 shadow-2xl">
              <div className="relative aspect-[3/4]">
                <Image src={HERO_IMG} alt="" fill sizes="180px" className="object-cover" />
              </div>
            </div>
          </div>

          {/* Phone */}
          <div className="relative z-30 -ml-8 w-[22%] translate-y-6">
            <div className="overflow-hidden rounded-[1.5rem] border-[5px] border-neutral-900 bg-neutral-900 shadow-2xl">
              <div className="relative aspect-[9/19.5]">
                <Image src={HERO_IMG} alt="" fill sizes="120px" className="object-cover" />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile hero image (shown below text on small screens) */}
        <div className="relative mt-10 aspect-[16/10] overflow-hidden rounded-2xl border lg:hidden">
          <Image src={HERO_IMG} alt="" fill sizes="100vw" className="object-cover" />
        </div>
      </div>
    </section>
  );
}
