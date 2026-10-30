import type { Metadata } from 'next';
import { WallpaperCard } from '@/components/wallpaper-card';
import { FilterSidebar } from '@/components/filter-sidebar';
import { Pagination } from '@/components/pagination';
import { Reveal } from '@/components/reveal';
import { getDisplayRegion, listCategories, searchWallpapers } from '@/lib/catalogue';
import { parseExploreParams, type SearchParams } from '@/lib/explore-params';

export const metadata: Metadata = {
  title: 'Explore wallpapers',
  description: 'Browse ultra-HD 4K & 5K wallpapers for phone, tablet and desktop.',
};

const SORT_LABEL = { newest: 'Newest', oldest: 'Oldest', title: 'Name' } as const;

export default async function ExplorePage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const region = (await getDisplayRegion());
  const { filters, page } = parseExploreParams(searchParams);

  const [result, categories] = await Promise.all([
    searchWallpapers(filters, region, page, 24),
    listCategories(),
  ]);
  const category = categories.find((c) => c.slug === filters.category);

  return (
    <main className="container py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Explore Wallpapers</h1>
        <p className="text-sm text-muted-foreground">
          {filters.q ? `Results for “${filters.q}”` : 'Ultra-HD wallpapers for phone, tablet and desktop.'}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[230px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <FilterSidebar categories={categories} filters={filters} />
        </aside>

        <div>
          <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} wallpaper{result.total === 1 ? '' : 's'}
              {category ? ` in ${category.name}` : ''}
            </span>
            <span>Sorted by {SORT_LABEL[filters.sort ?? 'newest']}</span>
          </div>

          {result.items.length === 0 ? (
            <p className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
              No wallpapers match these filters yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {result.items.map((w, i) => (
                <Reveal key={w.id} delay={(i % 4) * 50}>
                  <WallpaperCard wallpaper={w} />
                </Reveal>
              ))}
            </div>
          )}

          <Pagination page={result.page} totalPages={result.totalPages} basePath="/explore" query={searchParams} />
        </div>
      </div>
    </main>
  );
}
