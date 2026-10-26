import Link from 'next/link';
import { Download, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { WallpaperCard } from '@/components/wallpaper-card';
import { Reveal } from '@/components/reveal';
import { HeroShowcase } from '@/components/hero-showcase';
import { Marquee } from '@/components/marquee';
import { Spotlight } from '@/components/spotlight';
import { getDisplayRegion, listCategories, listPublishedWallpapers } from '@/lib/catalogue';

export default async function HomePage() {
  const region = getDisplayRegion();
  const [featured, newest, categories] = await Promise.all([
    listPublishedWallpapers({ sort: 'popular' }, region, 12),
    listPublishedWallpapers({ sort: 'newest' }, region, 10),
    listCategories(),
  ]);

  const half = Math.ceil(featured.length / 2);

  return (
    <main className="grain space-y-24 pb-28">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="aurora" aria-hidden />
        <div className="container relative py-16 sm:py-24">
          <HeroShowcase items={featured} />
        </div>
      </section>

      {/* Marquee strip */}
      {featured.length > 0 && (
        <section className="space-y-3">
          <Marquee items={featured.slice(0, half)} />
          <Marquee items={featured.slice(half)} reverse />
        </section>
      )}

      {/* Category chips */}
      {categories.length > 0 && (
        <section className="container">
          <Reveal className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/collections/${c.slug}`}
                className="glass rounded-full px-4 py-2 text-sm transition-colors hover:text-foreground"
              >
                {c.name}
              </Link>
            ))}
          </Reveal>
        </section>
      )}

      {/* Bento: why */}
      <section className="container">
        <Reveal className="mb-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Built like a premium store</h2>
          <p className="text-sm text-muted-foreground">Not another free-for-all gallery.</p>
        </Reveal>
        <div className="grid gap-4 md:grid-cols-3">
          <Feature
            icon={<Sparkles className="h-5 w-5" />}
            title="Ultra-HD, curated"
            body="4K–5K originals, hand-approved. ~300 strong pieces beats 5,000 mediocre ones."
          />
          <Feature
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Secure delivery"
            body="Originals never public. Every download is a 60-second signed link, rate-limited and traceable."
          />
          <Feature
            icon={<Download className="h-5 w-5" />}
            title="Priced for you"
            body="₹ per item in India, credit packs abroad — fair, country-aware pricing."
          />
        </div>
      </section>

      {/* Featured grid */}
      <GridSection title="Trending" href="/explore" items={featured} />
      <GridSection title="New today" href="/explore?sort=newest" items={newest} />

      {/* CTA */}
      <section className="container">
        <Spotlight className="overflow-hidden p-10 text-center sm:p-16">
          <div className="aurora opacity-50" aria-hidden />
          <div className="relative space-y-4">
            <Wand2 className="mx-auto h-6 w-6 text-[hsl(var(--glow))]" />
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Find the one for your screen
            </h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Thousands of pixels, one perfect fit. Start with the free picks — upgrade when one
              earns a place on your home screen.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link href="/explore" className={buttonVariants({ size: 'lg' })}>
                Browse the collection
              </Link>
            </div>
          </div>
        </Spotlight>
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Reveal>
      <Spotlight className="h-full p-6">
        <div className="relative space-y-3">
          <div className="inline-flex rounded-xl bg-foreground/5 p-2.5 text-foreground">{icon}</div>
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{body}</p>
        </div>
      </Spotlight>
    </Reveal>
  );
}

function GridSection({
  title,
  href,
  items,
}: {
  title: string;
  href: string;
  items: Awaited<ReturnType<typeof listPublishedWallpapers>>;
}) {
  return (
    <section className="container space-y-6">
      <Reveal className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
        <Link href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          See all →
        </Link>
      </Reveal>
      {items.length === 0 ? (
        <Reveal className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
          No wallpapers yet — publish some from the admin upload to see them here.
        </Reveal>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((w, i) => (
            <Reveal key={w.id} delay={(i % 5) * 60}>
              <WallpaperCard wallpaper={w} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}
