import Link from 'next/link';
import { Images } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { previewUrlFor } from '@/lib/catalogue';
import { EmptyState, FilterTabs, PageHeader } from '@/components/admin/ui';
import { DraftsGrid, type DraftRow } from '@/components/admin/drafts-grid';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Drafts' };

type Row = Omit<DraftRow, 'previewUrl'> & { wallpaper_assets: { variant: string; storage_key: string }[] | null };

export default async function AdminDraftsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab: raw } = await props.searchParams;
  const tab = raw === 'creators' ? 'creators' : 'drafts';
  const s = createServiceClient();
  const [{ data }, { data: cats }, { count: drafts }, { count: creators }] = await Promise.all([
    s
      .from('wallpapers')
      .select('id, title, description, alt_text, tags, category_id, is_free, ai_filled, orientation, max_long_edge, created_at, wallpaper_assets(variant, storage_key)')
      .eq('status', tab === 'creators' ? 'pending_review' : 'draft')
      .order('created_at', { ascending: false })
      .limit(120),
    s.from('categories').select('id, name').order('sort_order'),
    s.from('wallpapers').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    s.from('wallpapers').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
  ]);
  const rows: DraftRow[] = ((data ?? []) as unknown as Row[]).map(({ wallpaper_assets, ...r }) => ({
    ...r,
    previewUrl: previewUrlFor(wallpaper_assets?.find((a) => a.variant === 'preview')?.storage_key),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drafts"
        description="Check and fix the details of new uploads in one place, then publish the ones that are ready. AI-suggested details are marked until you save them."
        actions={
          <Link href="/admin/upload" className="admin-btn-primary">
            + Upload
          </Link>
        }
      />
      <FilterTabs
        items={[
          { href: '/admin/drafts', label: 'Your drafts', active: tab === 'drafts', count: drafts ?? 0 },
          { href: '/admin/drafts?tab=creators', label: 'Creator submissions', active: tab === 'creators', count: creators ?? 0 },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={Images}
          title={tab === 'creators' ? 'No creator submissions waiting' : 'No drafts'}
          description="Uploaded wallpapers appear here before they go live."
          action={
            <Link href="/admin/upload" className="admin-btn">
              Upload wallpapers
            </Link>
          }
        />
      ) : (
        <DraftsGrid rows={rows} categories={(cats ?? []) as { id: string; name: string }[]} />
      )}
    </div>
  );
}
