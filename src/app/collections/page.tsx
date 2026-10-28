import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Reveal } from '@/components/reveal';
import { listCategories } from '@/lib/catalogue';

export const metadata: Metadata = { title: 'Collections', description: 'Curated wallpaper collections in 4K & 8K.' };

const CHIPS = ['All', 'Premium', 'Seasonal', 'Popular'];

export default async function CollectionsPage() {
  const categories = await listCategories();
  return (
    <main className="container py-10">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Collections</h1>
        <p className="text-sm text-muted-foreground">Curated sets, handpicked for every mood and screen.</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        {CHIPS.map((c, i) => (
          <span
            key={c}
            className={`rounded-full border px-4 py-1.5 ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}
          >
            {c}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c, i) => (
          <Reveal key={c.id} delay={(i % 4) * 50}>
            <Link href={`/collections/${c.slug}`} className="hover-lift group block overflow-hidden rounded-2xl border bg-card">
              <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                {c.thumbUrl && (
                  <Image src={c.thumbUrl} alt={c.name} fill sizes="300px" className="object-cover transition-transform duration-500 group-hover:scale-110" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <p className="font-semibold">{c.name}</p>
                  {c.count != null && <p className="text-xs text-white/80">{c.count.toLocaleString()}+ wallpapers</p>}
                </div>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </main>
  );
}
