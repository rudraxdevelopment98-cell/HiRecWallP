import type { Metadata } from 'next';
import { WallpaperCard } from '@/components/wallpaper-card';
import { FilterSidebar } from '@/components/filter-sidebar';
import { Pagination } from '@/components/pagination';
import { Reveal } from '@/components/reveal';
import { getDisplayRegion, listCategories, listPublishedWallpapers } from '@/lib/catalogue';
import type { ExploreFilters } from '@/types/catalogue';

export const metadata: Metadata = {
  title: 'Explore wallpapers',
  description: 'Browse thousands of stunning 4K & 8K wallpapers for every device.',
};

type SearchParams = { [key: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ExplorePage({ searchParams }: { searchParams: SearchParams }) {
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
    <main className="container py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Explore Wallpapers</h1>
        <p className="text-sm text-muted-foreground">
          Discover thousands of stunning wallpapers for every device.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[230px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <FilterSidebar categories={categories} filters={filters} />
        </aside>

        <div>
          <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {items.length} wallpaper{items.length === 1 ? '' : 's'}
              {filters.category ? ` in ${filters.category}` : ''}
            </span>
            <span>Sorted by {filters.sort === 'newest' ? 'Newest' : 'Popular'}</span>
          </div>

          {items.length === 0 ? (
            <p className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
              No wallpapers match these filters yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {items.map((w, i) => (
                <Reveal key={w.id} delay={(i % 4) * 50}>
                  <WallpaperCard wallpaper={w} />
                </Reveal>
              ))}
            </div>
          )}

          <Pagination page={1} totalPages={1} basePath="/explore" />
        </div>
      </div>
    </main>
  );
}
