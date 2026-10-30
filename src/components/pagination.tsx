import Link from 'next/link';

/** Lightweight numbered pagination. Hidden when there's a single page. */
export function Pagination({
  page,
  totalPages,
  basePath,
  query,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  query?: Record<string, string | string[] | undefined>;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query ?? {})) {
      if (k === 'page' || v == null || v === '') continue;
      for (const one of Array.isArray(v) ? v : [v]) params.append(k, one);
    }
    params.set('page', String(p));
    return `${basePath}?${params.toString()}`;
  };
  // A window of up to 5 pages around the current one.
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => first + i);
  return (
    <nav className="flex items-center justify-center gap-1.5 pt-6 text-sm">
      {page > 1 && (
        <Link href={href(page - 1)} className="rounded-full border px-3 py-1.5 hover:bg-secondary">
          ← Prev
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={href(p)}
          className={`grid h-9 w-9 place-items-center rounded-full border ${
            p === page ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
          }`}
        >
          {p}
        </Link>
      ))}
      {page < totalPages && (
        <Link href={href(page + 1)} className="rounded-full border px-3 py-1.5 hover:bg-secondary">
          Next →
        </Link>
      )}
    </nav>
  );
}
