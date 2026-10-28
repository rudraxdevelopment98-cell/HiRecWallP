import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { WallpaperCard } from '@/components/wallpaper-card';
import { FilterSidebar } from '@/components/filter-sidebar';
import { Pagination } from '@/components/pagination';
import { Reveal } from '@/components/reveal';
import { getCategoryBySlug, getDisplayRegion, listCategories, listPublishedWallpapers } from '@/lib/catalogue';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const cat = await getCategoryBySlug(params.slug);
  return { title: cat ? `${cat.name} Wallpapers` : 'Collection', description: cat ? `${cat.name} wallpapers in 4K & 8K.` : undefined };
}

export default async function CollectionPage({ params }: { params: { slug: string } }) {
  const region = getDisplayRegion();
  const [cat, items, categories] = await Promise.all([
    getCategoryBySlug(params.slug),
    listPublishedWallpapers({ category: params.slug, sort: 'popular' }, region),
    listCategories(),
  ]);

  if (!cat && items.length === 0 && process.env.NEXT_PUBLIC_SUPABASE_URL) notFound();
  const name = cat?.name ?? params.slug;
  const banner = cat?.thumbUrl ?? items[0]?.previewUrl ?? '/demo/ember-ridge.jpg';

  return (
    <main>
      {/* Hero banner */}
      <section className="relative h-56 overflow-hidden sm:h-72">
        <Image src={banner} alt={name} fill sizes="100vw" className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
        <div className="container relative flex h-full flex-col justify-end pb-8 text-white">
          <p className="text-sm text-white/80">Collections · {name}</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{name} Wallpapers</h1>
          <p className="mt-1 max-w-xl text-sm text-white/80">
            Explore the beauty of our {name.toLowerCase()} collection — curated in stunning 4K &amp; 8K.
          </p>
        </div>
      </section>

      <div className="container grid gap-8 py-10 lg:grid-cols-[230px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <FilterSidebar categories={categories} filters={{ category: params.slug }} />
        </aside>
        <div>
          <div className="mb-4 text-sm text-muted-foreground">{items.length} wallpapers</div>
          {items.length === 0 ? (
            <p className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
              No wallpapers in this collection yet.
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
          <Pagination page={1} totalPages={1} basePath={`/collections/${params.slug}`} />
        </div>
      </div>
    </main>
  );
}
