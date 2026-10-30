import { requireAdmin } from '@/lib/auth';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/service';
import { previewUrlFor } from '@/lib/catalogue';
import { Badge } from '@/components/ui/badge';
import { WallpaperActions } from '@/components/admin/wallpaper-actions';
import { WallpaperEditForm, type EditableWallpaper } from '@/components/admin/wallpaper-edit-form';

export const dynamic = 'force-dynamic';

export default async function AdminWallpaperEditPage(props: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const params = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const supabase = createServiceClient();
  const [{ data: w }, { data: categories }, { data: sets }, { count: sales }] = await Promise.all([
    supabase
      .from('wallpapers')
      .select('id, slug, title, description, alt_text, tags, category_id, set_id, is_free, status, orientation, max_long_edge, devices, wallpaper_assets(variant, storage_key)')
      .eq('id', params.id)
      .maybeSingle(),
    supabase.from('categories').select('id, name').order('sort_order'),
    supabase.from('wallpaper_sets').select('id, title').order('title'),
    supabase.from('entitlements').select('id', { count: 'exact', head: true }).eq('wallpaper_id', params.id),
  ]);
  if (!w) notFound();
  const preview = previewUrlFor(
    (w.wallpaper_assets as { variant: string; storage_key: string }[] | null)?.find((a) => a.variant === 'preview')?.storage_key,
  );

  return (
    <div className="space-y-6">
      <Link href="/admin/catalogue" className="text-sm underline">
        ← Catalogue
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">{w.title as string}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{(w.status as string).replace('_', ' ')}</Badge>
            {w.orientation as string} · largest {(w.max_long_edge as number | null) ?? '—'}px ·{' '}
            {((w.devices as string[]) ?? []).join(', ') || 'no paid sizes'} · {sales ?? 0} sale(s)
          </p>
        </div>
        <WallpaperActions id={w.id as string} status={w.status as string} />
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <WallpaperEditForm
          wallpaper={w as unknown as EditableWallpaper}
          categories={(categories ?? []) as { id: string; name: string }[]}
          sets={(sets ?? []) as { id: string; title: string }[]}
        />
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-muted">
          {preview && <Image src={preview} alt="" fill sizes="320px" className="object-cover" />}
        </div>
      </div>
    </div>
  );
}
