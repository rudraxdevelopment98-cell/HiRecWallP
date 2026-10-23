import Link from 'next/link';
import type { Metadata } from 'next';
import { WallpaperGrid } from '@/components/wallpaper-grid';
import { getDisplayRegion, listCategories, listPublishedWallpapers } from '@/lib/catalogue';
import type { ExploreFilters } from '@/types/catalogue';

export const metadata: Metadata = {
  title: 'Explore wallpapers',
  description: 'Browse ultra-HD AI wallpapers by device, category, free or paid.',
};

type SearchParams = { [key: string]: string | string[] | undefined };

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const region = getDisplayRegion();
  const freeParam = str(searchParams.free);
  const filters: ExploreFilters = {
    category: str(searchParams.category),
    free: freeParam === '1' ? true : freeParam === '0' ? false : undefined,
    sort: (str(searchParams.sort) as ExploreFilters['sort']) ?? 'newest',
    q: str(searchParams.q),
  };

  const [items, categories] = await Promise.all([
    listPublishedWallpapers(filters, region),
    listCategories(),
  ]);

  return (
    <main className="container space-y-6 py-10">
      <h1 className="text-2xl font-semibold">Explore</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 text-sm">
        <FilterLink label="All" href="/explore" active={!filters.category && filters.free === undefined} />
        <FilterLink label="Free" href="/explore?free=1" active={filters.free === true} />
        <FilterLink label="Paid" href="/explore?free=0" active={filters.free === false} />
        {categories.map((c) => (
          <FilterLink
            key={c.id}
            label={c.name}
            href={`/explore?category=${c.slug}`}
            active={filters.category === c.slug}
          />
        ))}
      </div>

      <WallpaperGrid items={items} emptyMessage="No wallpapers match these filters yet." />
    </main>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 ${
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
      }`}
    >
      {label}
    </Link>
  );
}
