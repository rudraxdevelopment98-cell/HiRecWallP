import { requireAdmin } from '@/lib/auth';
import { EmptyState, FilterTabs, PageHeader } from '@/components/admin/ui';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { previewUrlFor } from '@/lib/catalogue';
import { Pagination } from '@/components/pagination';
import { CatalogueTable, type CatalogueRow } from '@/components/admin/catalogue-table';

export const dynamic = 'force-dynamic';
const PER_PAGE = 50;

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Drafts' },
  { key: 'pending_review', label: 'Creator submissions' },
  { key: 'archived', label: 'Archived' },
];

interface DbRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  is_free: boolean;
  orientation: string | null;
  devices: string[];
  creator_id: string | null;
  categories: { name: string } | null;
  wallpaper_assets: { variant: string; storage_key: string }[] | null;
}

export default async function AdminCataloguePage(props: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await props.searchParams;
  const status = TABS.some((t) => t.key === sp.status) ? sp.status! : 'all';
  const q = (sp.q ?? '').trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  const supabase = createServiceClient();
  let query = supabase
    .from('wallpapers')
    .select('id, slug, title, status, is_free, orientation, devices, creator_id, categories(name), wallpaper_assets(variant, storage_key)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (status !== 'all') query = query.eq('status', status);
  if (q) query = query.ilike('title', `%${q.replace(/[%,]/g, ' ')}%`);
  const [{ data, count }, { data: categories }] = await Promise.all([
    query,
    supabase.from('categories').select('id, name').order('sort_order'),
  ]);
  const rows: CatalogueRow[] = ((data ?? []) as unknown as DbRow[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    is_free: r.is_free,
    orientation: r.orientation,
    devices: r.devices ?? [],
    creator: Boolean(r.creator_id),
    category: r.categories?.name ?? null,
    previewUrl: previewUrlFor(r.wallpaper_assets?.find((a) => a.variant === 'preview')?.storage_key),
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Wallpapers"
        description="Everything in the catalogue. Creator uploads arrive as “In review”; publish to put them live."
        actions={
          <Link href="/admin/upload" className="admin-btn-primary">
            + Upload
          </Link>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs items={TABS.map((t) => ({ href: t.key === 'all' ? '/admin/catalogue' : `/admin/catalogue?status=${t.key}`, label: t.label, active: status === t.key }))} />
        <form className="ml-auto" action="/admin/catalogue">
          {status !== 'all' && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder="Search titles…" className="input h-8 w-48 py-1" aria-label="Search wallpapers" />
        </form>
      </div>
      <p className="text-sm text-muted-foreground">{(count ?? 0).toLocaleString('en-IN')} wallpaper(s)</p>
      {rows.length === 0 ? (
        <EmptyState title="Nothing here yet" description={q ? 'No wallpapers match that search.' : 'Upload wallpapers to fill the catalogue.'} action={<Link href="/admin/upload" className="admin-btn">Upload wallpapers</Link>} />
      ) : (
        <CatalogueTable rows={rows} categories={(categories ?? []) as { id: string; name: string }[]} />
      )}
      <Pagination page={page} totalPages={Math.max(1, Math.ceil((count ?? 0) / PER_PAGE))} basePath="/admin/catalogue" query={{ status: status === 'all' ? undefined : status, q }} />
    </div>
  );
}
