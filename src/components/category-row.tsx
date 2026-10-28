import Image from 'next/image';
import Link from 'next/link';
import type { Category } from '@/types/catalogue';

/** Horizontal row of rounded category tiles with name + count. */
export function CategoryRow({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;
  return (
    <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-8">
      {categories.map((c) => (
        <Link key={c.id} href={`/collections/${c.slug}`} className="group w-24 shrink-0 text-center sm:w-auto">
          <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-2xl border bg-muted">
            {c.thumbUrl ? (
              <Image src={c.thumbUrl} alt={c.name} fill sizes="120px" className="object-cover transition-transform duration-500 group-hover:scale-110" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-secondary to-muted" />
            )}
          </div>
          <p className="mt-2 truncate text-sm font-medium">{c.name}</p>
          {c.count != null && (
            <p className="text-xs text-muted-foreground">{c.count.toLocaleString()}+</p>
          )}
        </Link>
      ))}
    </div>
  );
}
