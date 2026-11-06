'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/lib/use-refresh';
import { cn } from '@/lib/utils';

export interface DraftRow {
  id: string;
  title: string;
  description: string | null;
  alt_text: string | null;
  tags: string[];
  category_id: string | null;
  is_free: boolean;
  ai_filled: boolean;
  orientation: string | null;
  max_long_edge: number | null;
  created_at: string;
  previewUrl: string | null;
}

type Edit = Pick<DraftRow, 'title' | 'description' | 'tags' | 'category_id' | 'is_free'>;

const editOf = (r: DraftRow): Edit => ({ title: r.title, description: r.description, tags: r.tags, category_id: r.category_id, is_free: r.is_free });
const same = (a: Edit, b: Edit) => JSON.stringify(a) === JSON.stringify(b);

async function json(url: string, method: string, body: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  if (res?.ok) return null;
  return ((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Request failed';
}

/** Edit many drafts inline; save changes and publish the selected ones. */
export function DraftsGrid({ rows, categories }: { rows: DraftRow[]; categories: { id: string; name: string }[] }) {
  const { refresh, refreshing } = useRefresh();
  const [edits, setEdits] = useState<Record<string, Edit>>(() => Object.fromEntries(rows.map((r) => [r.id, editOf(r)])));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const editFor = (r: DraftRow) => edits[r.id] ?? editOf(r);
  const dirty = rows.filter((r) => !same(editFor(r), editOf(r)));
  const set = (id: string, p: Partial<Edit>) =>
    setEdits((e) => ({ ...e, [id]: { ...(e[id] ?? editOf(rows.find((r) => r.id === id)!)), ...p } }));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function saveAll(): Promise<boolean> {
    for (const r of dirty) {
      const e = editFor(r);
      if (!e.title.trim()) {
        setMsg({ ok: false, text: 'Every wallpaper needs a title.' });
        return false;
      }
      const err = await json(`/api/admin/wallpapers/${r.id}`, 'PATCH', {
        title: e.title.trim(),
        description: e.description?.trim() || null,
        tags: e.tags,
        category_id: e.category_id,
        is_free: e.is_free,
      });
      if (err) {
        setMsg({ ok: false, text: `“${e.title}”: ${err}` });
        return false;
      }
    }
    return true;
  }

  async function run(publish: boolean) {
    setBusy(true);
    setMsg(null);
    const ok = await saveAll();
    if (ok && publish && selected.size) {
      const err = await json('/api/admin/wallpapers/bulk', 'POST', { action: 'publish', ids: [...selected] });
      if (err) {
        setMsg({ ok: false, text: err });
        setBusy(false);
        return;
      }
      setMsg({ ok: true, text: `Published ${selected.size} wallpaper${selected.size === 1 ? '' : 's'}.` });
      setSelected(new Set());
    } else if (ok) {
      setMsg({ ok: true, text: dirty.length ? `Saved ${dirty.length} change${dirty.length === 1 ? '' : 's'}.` : 'Nothing to save.' });
    }
    setBusy(false);
    refresh();
  }

  const missing = (e: Edit) => !e.category_id || e.tags.length === 0;

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-20 -mx-1 flex flex-wrap items-center gap-3 rounded-xl border bg-background/95 px-3 py-2.5 backdrop-blur">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected.size === rows.length && rows.length > 0}
            onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
          />
          Select all
        </label>
        <span className="text-sm text-muted-foreground">
          {selected.size} selected · {dirty.length} unsaved change{dirty.length === 1 ? '' : 's'}
        </span>
        {msg && <span className={cn('text-sm', msg.ok ? 'text-emerald-700' : 'text-rose-700')}>{msg.text}</span>}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" disabled={busy || refreshing || dirty.length === 0} onClick={() => run(false)}>
            Save changes
          </Button>
          <Button size="sm" disabled={busy || refreshing || selected.size === 0} onClick={() => run(true)}>
            {busy ? 'Working…' : `Save & publish ${selected.size || ''}`.trim()}
          </Button>
        </div>
      </div>

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => {
          const e = editFor(r);
          const changed = !same(e, editOf(r));
          return (
            <li key={r.id} className={cn('admin-card overflow-hidden', selected.has(r.id) && 'ring-2 ring-foreground')}>
              <div className="relative aspect-[16/10] bg-muted">
                {r.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- watermarked public preview
                  <img src={r.previewUrl} alt="" className="h-full w-full object-cover" />
                )}
                <label className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${e.title}`} />
                  Publish
                </label>
                <span className="absolute right-2 top-2 flex gap-1">
                  {r.ai_filled && !changed && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-violet-600/90 px-1.5 py-0.5 text-[11px] font-medium text-white">
                      <Sparkles className="h-3 w-3" /> AI
                    </span>
                  )}
                  {r.max_long_edge && (
                    <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
                      {r.max_long_edge >= 5120 ? '5K' : '4K'} · {r.orientation}
                    </span>
                  )}
                </span>
              </div>
              <div className="space-y-2 p-3 text-sm">
                <input className="input h-9 font-medium" value={e.title} onChange={(ev) => set(r.id, { title: ev.target.value })} aria-label="Title" maxLength={120} />
                <textarea
                  className="input min-h-16 text-xs"
                  value={e.description ?? ''}
                  onChange={(ev) => set(r.id, { description: ev.target.value })}
                  placeholder="Description"
                  aria-label="Description"
                  maxLength={2000}
                />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <select className="input h-9 py-1" value={e.category_id ?? ''} onChange={(ev) => set(r.id, { category_id: ev.target.value || null })} aria-label="Category">
                    <option value="">No category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={e.is_free} onChange={(ev) => set(r.id, { is_free: ev.target.checked })} /> Free
                  </label>
                </div>
                <input
                  className="input h-9 text-xs"
                  defaultValue={e.tags.join(', ')}
                  onBlur={(ev) =>
                    set(r.id, {
                      tags: [...new Set(ev.target.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 30),
                    })
                  }
                  placeholder="tags, comma, separated"
                  aria-label="Tags"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className={cn(missing(e) ? 'text-amber-700' : 'text-muted-foreground')}>
                    {missing(e) ? 'Add a category and tags for search' : changed ? 'Unsaved' : 'Ready'}
                  </span>
                  <Link href={`/admin/catalogue/${r.id}`} className="underline">
                    More
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
