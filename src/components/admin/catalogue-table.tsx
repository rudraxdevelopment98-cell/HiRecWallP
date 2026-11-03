'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRefresh } from '@/lib/use-refresh';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WallpaperActions } from '@/components/admin/wallpaper-actions';

export interface CatalogueRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  is_free: boolean;
  orientation: string | null;
  devices: string[];
  creator: boolean;
  previewUrl: string | null;
  category: string | null;
}

/** Catalogue list with row selection and bulk actions. */
export function CatalogueTable({ rows, categories }: { rows: CatalogueRow[]; categories: { id: string; name: string }[] }) {
  const { refresh, refreshing } = useRefresh();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [category, setCategory] = useState('');
  const all = rows.length > 0 && selected.size === rows.length;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function bulk(body: Record<string, unknown>, label: string) {
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/admin/wallpapers/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, ids: [...selected] }),
    }).catch(() => null);
    const json = ((await res?.json().catch(() => null)) ?? {}) as { changed?: number; error?: string };
    setBusy(false);
    if (res?.ok) {
      setMsg({ ok: true, text: `${label}: ${json.changed ?? 0} changed` });
      setSelected(new Set());
      refresh();
    } else setMsg({ ok: false, text: json.error ?? 'Failed' });
  }

  return (
    <div className="space-y-3">
      <div className={`sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 text-sm ${selected.size ? '' : 'opacity-60'}`}>
        <label className="flex items-center gap-2 px-1">
          <input type="checkbox" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Select all on this page" />
          {selected.size ? `${selected.size} selected` : 'Select'}
        </label>
        <Button size="sm" disabled={busy || refreshing || !selected.size} onClick={() => bulk({ action: 'publish' }, 'Published')}>Publish</Button>
        <Button size="sm" variant="outline" disabled={busy || refreshing || !selected.size} onClick={() => bulk({ action: 'unpublish' }, 'Unpublished')}>Unpublish</Button>
        <Button size="sm" variant="outline" disabled={busy || refreshing || !selected.size} onClick={() => bulk({ action: 'archive' }, 'Archived')}>Archive</Button>
        <Button size="sm" variant="outline" disabled={busy || refreshing || !selected.size} onClick={() => bulk({ action: 'free', value: true }, 'Marked free')}>Make free</Button>
        <Button size="sm" variant="outline" disabled={busy || refreshing || !selected.size} onClick={() => bulk({ action: 'free', value: false }, 'Marked premium')}>Make premium</Button>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-xs" aria-label="Category for selected">
          <option value="">Move to category…</option>
          <option value="none">— No category —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" disabled={busy || refreshing || !selected.size || !category} onClick={() => bulk({ action: 'category', categoryId: category === 'none' ? null : category }, 'Moved')}>Apply</Button>
        {msg && <span className={msg.ok ? 'text-emerald-600' : 'text-rose-600'}>{msg.text}</span>}
      </div>

      <ul className="divide-y rounded-2xl border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={`Select ${row.title}`} />
            <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">
              {row.previewUrl && <Image src={row.previewUrl} alt="" fill sizes="64px" className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                <Link href={`/admin/catalogue/${row.id}`} className="hover:underline">{row.title}</Link>
              </p>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant={row.status === 'published' ? 'default' : 'secondary'}>{row.status.replace('_', ' ')}</Badge>
                {row.is_free && <Badge variant="free">FREE</Badge>}
                {row.creator && <span>creator upload</span>}
                {row.category && <span>· {row.category}</span>}
                {row.orientation && <span>· {row.orientation}</span>}
                {row.devices?.length > 0 && <span>· {row.devices.join(', ')}</span>}
              </p>
            </div>
            <WallpaperActions id={row.id} status={row.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
