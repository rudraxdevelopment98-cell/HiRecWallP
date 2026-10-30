import { requireAdmin } from '@/lib/auth';
import Image from 'next/image';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { publicEnv } from '@/lib/env';
import { previewUrlFor } from '@/lib/catalogue';
import { Badge } from '@/components/ui/badge';
import { WallpaperActions } from '@/components/admin/wallpaper-actions';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Drafts' },
  { key: 'pending_review', label: 'Creator submissions' },
  { key: 'archived', label: 'Archived' },
];

interface Row {
  id: string;
  slug: string;
  title: string;
  status: string;
  is_free: boolean;
  orientation: string | null;
  devices: string[];
  created_at: string;
  creator_id: string | null;
  wallpaper_assets: { variant: string; storage_key: string }[] | null;
}

export default async function AdminCataloguePage(props: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireAdmin();
  const searchParams = await props.searchParams;
  const status = TABS.some((t) => t.key === searchParams.status) ? searchParams.status! : 'all';
  let rows: Row[] | null = null;
  if (publicEnv.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      let query = createServiceClient()
        .from('wallpapers')
        .select('id, slug, title, status, is_free, orientation, devices, created_at, creator_id, wallpaper_assets(variant, storage_key)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (status !== 'all') query = query.eq('status', status);
      if (searchParams.q) query = query.ilike('title', `%${searchParams.q.replace(/[%,]/g, ' ')}%`);
      const { data } = await query;
      rows = (data as Row[]) ?? [];
    } catch {
      rows = null;
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Catalogue</h1>
        <Link href="/admin/upload" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          + Upload
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === 'all' ? '/admin/catalogue' : `/admin/catalogue?status=${t.key}`}
            className={`rounded-full border px-3 py-1 ${status === t.key ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
          >
            {t.label}
          </Link>
        ))}
        <form className="ml-auto" action="/admin/catalogue">
          {status !== 'all' && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={searchParams.q ?? ''} placeholder="Search titles…" className="input h-8 w-48 py-1" />
        </form>
      </div>

      {rows == null ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Connect Supabase to manage the catalogue.</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {rows.map((row) => {
            const url = previewUrlFor(row.wallpaper_assets?.find((a) => a.variant === 'preview')?.storage_key);
            return (
              <li key={row.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {url && <Image src={url} alt="" fill sizes="64px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {row.status === 'published' ? (
                      <Link href={`/w/${row.slug}`} className="hover:underline">
                        {row.title}
                      </Link>
                    ) : (
                      row.title
                    )}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant={row.status === 'published' ? 'default' : 'secondary'}>{row.status.replace('_', ' ')}</Badge>
                    {row.is_free && <Badge variant="free">FREE</Badge>}
                    {row.creator_id && <span>creator upload</span>}
                    {row.orientation && <span>· {row.orientation}</span>}
                    {row.devices?.length > 0 && <span>· {row.devices.join(', ')}</span>}
                  </p>
                </div>
                <WallpaperActions id={row.id} status={row.status} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
