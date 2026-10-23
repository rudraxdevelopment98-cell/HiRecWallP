import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { WallpaperCard } from '@/components/wallpaper-card';
import { getDisplayRegion, listPublishedWallpapers } from '@/lib/catalogue';
import { publicEnv } from '@/lib/env';

export default async function HomePage() {
  const region = getDisplayRegion();
  const [trending, newest] = await Promise.all([
    listPublishedWallpapers({ sort: 'popular' }, region, 12),
    listPublishedWallpapers({ sort: 'newest' }, region, 12),
  ]);

  return (
    <main className="container space-y-16 py-12">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 py-12 text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          Ultra-HD wallpapers, made for your screen
        </h1>
        <p className="max-w-xl text-balance text-muted-foreground">
          {publicEnv.NEXT_PUBLIC_BRAND_NAME} — AI-generated wallpapers for phone, desktop and
          tablet. Free picks, cheap premium downloads, priced for your country.
        </p>
        <div className="flex gap-3">
          <Link href="/explore" className={buttonVariants({ size: 'lg' })}>
            Browse
          </Link>
          <Link href="/free" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
            Free picks
          </Link>
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
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Link href={href} className="text-sm text-muted-foreground hover:text-foreground">
          See all →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No wallpapers yet — publish some from the admin upload to see them here.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((w) => (
            <WallpaperCard key={w.id} wallpaper={w} />
          ))}
        </div>
      )}
    </section>
  );
}
