import type { Metadata } from 'next';
import { WallpaperCard } from '@/components/wallpaper-card';
import { Pagination } from '@/components/pagination';
import { Reveal } from '@/components/reveal';
import { getDisplayRegion, searchWallpapers } from '@/lib/catalogue';
import { parseExploreParams, type SearchParams } from '@/lib/explore-params';

export const metadata: Metadata = {
  title: 'Free wallpapers',
  description: 'Free HD AI wallpapers — no account needed.',
};

export default async function FreePage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const region = (await getDisplayRegion());
  const { page } = parseExploreParams(searchParams);
  const result = await searchWallpapers({ free: true, sort: 'newest' }, region, page, 24);
  return (
    <main className="container space-y-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Free wallpapers</h1>
        <p className="text-sm text-muted-foreground">
          Download in HD with no account. Want the 4K/5K version of anything? Paid sizes start small.
        </p>
      </div>
      {result.items.length === 0 ? (
        <p className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">No free wallpapers published yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {result.items.map((w, i) => (
            <Reveal key={w.id} delay={(i % 4) * 50}>
              <WallpaperCard wallpaper={w} />
            </Reveal>
          ))}
        </div>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} basePath="/free" />
    </main>
  );
}
