import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { WallpaperCard } from '@/components/wallpaper-card';
import { Reveal } from '@/components/reveal';
import { getDisplayRegion, listPublishedWallpapers } from '@/lib/catalogue';
import { publicEnv } from '@/lib/env';

export default async function HomePage() {
  const region = getDisplayRegion();
  const [trending, newest] = await Promise.all([
    listPublishedWallpapers({ sort: 'popular' }, region, 12),
    listPublishedWallpapers({ sort: 'newest' }, region, 12),
  ]);

  return (
    <main className="space-y-24 pb-24">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="aurora" aria-hidden />
        <div className="container relative flex flex-col items-center gap-6 py-28 text-center">
          <span className="animate-fade-up glass rounded-full px-4 py-1.5 text-xs tracking-wide text-muted-foreground">
            Ultra-HD · AI-crafted · priced for your country
          </span>
          <h1 className="animate-fade-up text-balance text-5xl font-semibold tracking-tight sm:text-7xl [animation-delay:80ms]">
            <span className="text-gradient">Wallpapers carved</span>
            <br className="hidden sm:block" /> for your screen
          </h1>
          <p className="animate-fade-up max-w-xl text-balance text-muted-foreground [animation-delay:160ms]">
            {publicEnv.NEXT_PUBLIC_BRAND_NAME} — a quiet, premium collection of ultra-HD
            wallpapers for phone, desktop and tablet. Free picks, cheap premium downloads.
          </p>
          <div className="animate-fade-up flex gap-3 [animation-delay:240ms]">
            <Link href="/explore" className={buttonVariants({ size: 'lg' })}>
              Browse the collection
            </Link>
            <Link href="/free" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
              Free picks
            </Link>
          </div>
        </div>
      </section>

      <Section title="Trending" href="/explore" items={trending} />
      <Section title="New today" href="/explore?sort=newest" items={newest} />
    </main>
  );
}

function Section({
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
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
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
