import Image from 'next/image';
import Link from 'next/link';
import { Crown, MonitorSmartphone } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { WallpaperCard } from '@/components/wallpaper-card';
import { Hero } from '@/components/hero';
import { CategoryRow } from '@/components/category-row';
import { NewsletterCard } from '@/components/newsletter-card';
import { Reveal } from '@/components/reveal';
import { getDisplayRegion, listCategories, listPublishedWallpapers, listSets } from '@/lib/catalogue';
import { REGION_PRICING_UNIT } from '@/lib/geo';

export default async function HomePage() {
  const region = getDisplayRegion();
  const [featured, categories, sets, freePicks] = await Promise.all([
    listPublishedWallpapers({ sort: 'newest' }, region, 8),
    listCategories(),
    listSets(),
    listPublishedWallpapers({ free: true, sort: 'newest' }, region, 5),
  ]);
  const money = REGION_PRICING_UNIT[region] === 'money';
  const set = sets[0];

  return (
    <main>
      {/* Hero */}
      <Hero />

      {/* Browse by category */}
      <section className="container py-8">
        <SectionHead title="Browse by Category" subtitle="Find the perfect vibe for your screen." href="/explore" />
        <Reveal>
          <CategoryRow categories={categories} />
        </Reveal>
      </section>

      {/* Featured + premium promo */}
      <section className="container py-8">
        <SectionHead title="Featured Wallpapers" subtitle="Handpicked just for you." href="/explore" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)]">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {featured.map((w, i) => (
              <Reveal key={w.id} delay={(i % 4) * 60}>
                <WallpaperCard wallpaper={w} />
              </Reveal>
            ))}
          </div>
          <Reveal>
            <PremiumPromo bg={featured[5]?.previewUrl ?? '/demo/hero.jpg'} />
          </Reveal>
        </div>
      </section>

      {/* Device finder · bundles · newsletter */}
      <section className="container grid gap-5 py-8 lg:grid-cols-3">
        <Reveal>
          <div className="flex h-full flex-col justify-between rounded-2xl border bg-gradient-to-br from-sky-50 to-blue-50 p-6">
            <div>
              <h3 className="text-lg font-semibold">Find the Perfect Wallpaper for Your Device</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick your device or enter your resolution and we’ll show the best matches.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <Link href="/explore" className={buttonVariants()}>
                Find My Wallpaper →
              </Link>
              <MonitorSmartphone className="h-10 w-10 text-sky-400" />
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="flex h-full flex-col rounded-2xl border bg-card p-6">
            {set ? (
              <>
                <SectionHead title="Matching Sets" subtitle="Wallpapers designed to go together." href={`/sets/${set.slug}`} compact />
                <div className="mt-auto">
                  <p className="font-semibold">{set.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {set.count} wallpaper{set.count === 1 ? '' : 's'} · all sizes included
                  </p>
                  <Link href={`/sets/${set.slug}`} className={buttonVariants({ size: 'sm', className: 'mt-3' })}>
                    View set →
                  </Link>
                </div>
              </>
            ) : (
              <>
                <SectionHead title="Free Picks" subtitle="Try us out — no account needed." href="/free" compact />
                <div className="mb-4 flex gap-2">
                  {freePicks.map((w) => (
                    <div key={w.id} className="relative h-12 w-12 overflow-hidden rounded-lg border">
                      {w.previewUrl && <Image src={w.previewUrl} alt="" fill sizes="48px" className="object-cover" />}
                    </div>
                  ))}
                </div>
                <div className="mt-auto">
                  <p className="font-semibold">Free wallpapers</p>
                  <p className="text-xs text-muted-foreground">Download in HD · {money ? 'paid sizes from ₹9' : 'paid sizes from 1 credit'}</p>
                  <Link href="/free" className={buttonVariants({ size: 'sm', variant: 'outline', className: 'mt-3' })}>
                    Browse free →
                  </Link>
                </div>
              </>
            )}
          </div>
        </Reveal>

        <Reveal>
          <NewsletterCard />
        </Reveal>
      </section>
    </main>
  );
}

function SectionHead({
  title,
  subtitle,
  href,
  compact,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-end justify-between ${compact ? 'mb-3' : 'mb-5'}`}>
      <div>
        <h2 className={`font-display font-semibold tracking-tight ${compact ? 'text-base' : 'text-2xl'}`}>{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="whitespace-nowrap text-sm text-muted-foreground hover:text-foreground">
          View All →
        </Link>
      )}
    </div>
  );
}

function PremiumPromo({ bg }: { bg: string }) {
  return (
    <div className="relative flex h-full min-h-[420px] flex-col justify-between overflow-hidden rounded-2xl p-7 text-white">
      <Image src={bg} alt="" fill sizes="400px" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/55 to-black/80" />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
          <Crown className="h-3.5 w-3.5 text-amber-300" /> Fair pricing
        </span>
        <h3 className="mt-4 font-display text-2xl font-semibold leading-tight">
          Pay once.
          <br /> Every size included.
        </h3>
        <p className="mt-2 max-w-xs text-sm text-white/80">
          One purchase covers every size we make for that wallpaper. Prices are set for your country.
        </p>
        <Link href="/pricing" className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90">
          See pricing →
        </Link>
      </div>
      <div className="relative mt-8 grid grid-cols-3 gap-3 border-t border-white/15 pt-5 text-center">
        <Stat value="5K" label="Up to" />
        <Stat value="5×" label="Downloads per buy" />
        <Stat value="1:1" label="Watermark per buyer" />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-xl font-semibold">{value}</p>
      <p className="text-[11px] text-white/70">{label}</p>
    </div>
  );
}
