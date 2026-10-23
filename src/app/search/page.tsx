import type { Metadata } from 'next';
import { WallpaperGrid } from '@/components/wallpaper-grid';
import { getDisplayRegion, listPublishedWallpapers } from '@/lib/catalogue';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search ultra-HD AI wallpapers.',
};

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = searchParams.q;
  const q = Array.isArray(raw) ? raw[0] : raw;
  const region = getDisplayRegion();
  const items = q ? await listPublishedWallpapers({ q, sort: 'newest' }, region) : [];

  return (
    <main className="container space-y-6 py-10">
      <h1 className="text-2xl font-semibold">Search</h1>
      <form action="/search" method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search wallpapers…"
          className="w-full max-w-md rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Search
        </button>
      </form>
      {q ? (
        <WallpaperGrid items={items} emptyMessage={`No results for “${q}”.`} />
      ) : (
        <p className="text-sm text-muted-foreground">Type a query to search the catalogue.</p>
      )}
    </main>
  );
}
