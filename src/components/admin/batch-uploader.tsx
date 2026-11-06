'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Copy, ImagePlus, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { stageUpload } from '@/lib/upload-client';
import { cn } from '@/lib/utils';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/tiff'];
const MIN_EDGE = 3840;
const FIVE_K = 5120;
const CONCURRENCY = 2;

type Status = 'checking' | 'ready' | 'uploading' | 'processing' | 'done' | 'duplicate' | 'error' | 'rejected' | 'skipped';

interface Item {
  id: string;
  file: File;
  thumb: string;
  status: Status;
  progress: number;
  width?: number;
  height?: number;
  note?: string;
  error?: string;
  incomingKey?: string;
  result?: { title: string; href: string; aiFilled: boolean };
  duplicate?: { title: string; href: string; publicHref: string; status: string };
}

/** Read width/height in the browser (null when the browser can't decode the type, e.g. TIFF). */
function readSize(url: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const mb = (b: number) => `${(b / 1048576).toFixed(b < 10 * 1048576 ? 1 : 0)} MB`;

export function BatchUploader({ categories, maxBytes, aiReal }: { categories: { id: string; name: string }[]; maxBytes: number; aiReal: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [auto, setAuto] = useState(true);
  const [dragging, setDragging] = useState(false);
  const running = useRef(0);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  const patch = useCallback((id: string, p: Partial<Item>) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }, []);

  // Pre-flight: type, size and resolution checked before anything is uploaded.
  const add = useCallback(
    async (files: FileList | File[]) => {
      const fresh: Item[] = [...files].map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        thumb: URL.createObjectURL(file),
        status: 'checking',
        progress: 0,
      }));
      setItems((list) => [...list, ...fresh]);
      for (const it of fresh) {
        if (!TYPES.includes(it.file.type)) {
          patch(it.id, { status: 'rejected', error: 'Not an image we accept (JPEG, PNG, WebP, AVIF or TIFF).' });
          continue;
        }
        if (it.file.size > maxBytes) {
          patch(it.id, { status: 'rejected', error: `Too large (${mb(it.file.size)}; limit ${mb(maxBytes)}). Save as high-quality JPEG.` });
          continue;
        }
        const size = await readSize(it.thumb);
        if (size) {
          const edge = Math.max(size.w, size.h);
          if (edge < MIN_EDGE) {
            patch(it.id, { status: 'rejected', width: size.w, height: size.h, error: `Too small: ${size.w}×${size.h}. Needs ${MIN_EDGE}px on the long edge.` });
            continue;
          }
          patch(it.id, { status: 'ready', width: size.w, height: size.h, note: edge < FIVE_K ? '4K sizes only (5K needs 5120px)' : undefined });
        } else {
          patch(it.id, { status: 'ready', note: 'Size checked on the server' });
        }
      }
    },
    [maxBytes, patch],
  );

  const send = useCallback(
    async (it: Item, force = false) => {
      running.current += 1;
      try {
        let key = it.incomingKey;
        if (!key) {
          patch(it.id, { status: 'uploading', progress: 0, error: undefined });
          key = await stageUpload(it.file, (pct) => patch(it.id, { progress: pct }));
          patch(it.id, { incomingKey: key });
        }
        patch(it.id, { status: 'processing', progress: 100, error: undefined });
        const body = new FormData();
        body.set('incomingKey', key);
        body.set('filename', it.file.name);
        if (auto) body.set('auto', '1');
        if (force) body.set('force', '1');
        if (categoryId) body.set('category_id', categoryId);
        if (isFree) body.set('is_free', '1');
        const res = await fetch('/api/admin/upload', { method: 'POST', body });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
          title?: string;
          href?: string;
          aiFilled?: boolean;
          duplicate?: Item['duplicate'];
        };
        if (res.ok && json.href) {
          patch(it.id, { status: 'done', incomingKey: undefined, result: { title: json.title ?? it.file.name, href: json.href, aiFilled: Boolean(json.aiFilled) } });
        } else if (res.status === 409 && json.duplicate) {
          patch(it.id, { status: 'duplicate', duplicate: json.duplicate, error: json.error });
        } else {
          // The staged copy is gone after a failed processing attempt: re-upload on retry.
          patch(it.id, { status: res.status === 422 ? 'rejected' : 'error', incomingKey: undefined, error: json.error ?? `Failed (${res.status})` });
        }
      } catch (err) {
        patch(it.id, { status: 'error', error: err instanceof Error ? err.message : 'Upload failed' });
      } finally {
        running.current -= 1;
      }
    },
    [auto, categoryId, isFree, patch],
  );

  // Queue: start ready items while fewer than CONCURRENCY are in flight.
  useEffect(() => {
    if (running.current >= CONCURRENCY) return;
    const next = items.filter((i) => i.status === 'ready').slice(0, CONCURRENCY - running.current);
    for (const it of next) {
      patch(it.id, { status: 'uploading' });
      void send(it);
    }
  }, [items, patch, send]);

  // Free the thumbnail object URLs when leaving the page.
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.thumb)), []);

  const counts = items.reduce<Record<string, number>>((m, i) => ({ ...m, [i.status]: (m[i.status] ?? 0) + 1 }), {});
  const busy = (counts.checking ?? 0) + (counts.ready ?? 0) + (counts.uploading ?? 0) + (counts.processing ?? 0);
  const leave = busy > 0;
  useEffect(() => {
    if (!leave) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [leave]);

  return (
    <div className="space-y-5">
      <div className="admin-card grid gap-4 p-5 sm:grid-cols-3">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Category for this batch</span>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{auto ? 'Let AI choose' : '— None —'}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-2.5 pt-6 text-sm">
          <input type="checkbox" className="mt-1" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          <span>
            <span className="font-medium">Auto-fill details</span>
            <span className="block text-xs text-muted-foreground">
              {aiReal ? 'Claude suggests title, description, tags, alt text and category.' : 'Title from the file name. Add ANTHROPIC_API_KEY for AI descriptions.'}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 pt-6 text-sm">
          <input type="checkbox" className="mt-1" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
          <span>
            <span className="font-medium">Free wallpapers</span>
            <span className="block text-xs text-muted-foreground">Mark everything in this batch as free.</span>
          </span>
        </label>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) void add(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragging ? 'border-foreground bg-secondary' : 'hover:bg-secondary/50',
        )}
      >
        <ImagePlus className="h-7 w-7 text-muted-foreground" />
        <span className="text-sm font-medium">Drop wallpapers here, or click to choose</span>
        <span className="text-xs text-muted-foreground">
          Many at once · JPEG, PNG, WebP, AVIF, TIFF · ≥ {MIN_EDGE}px long edge ({FIVE_K}px+ adds 5K) · up to {mb(maxBytes)} each
        </span>
        <input
          type="file"
          multiple
          accept={TYPES.join(',')}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) void add(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-muted-foreground">
            {counts.done ?? 0} done · {busy} in progress · {(counts.error ?? 0) + (counts.rejected ?? 0)} need attention · {counts.duplicate ?? 0} possible duplicates
          </span>
          {(counts.error ?? 0) > 0 && (
            <Button size="sm" variant="outline" onClick={() => items.filter((i) => i.status === 'error').forEach((i) => patch(i.id, { status: 'ready' }))}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Retry failed
            </Button>
          )}
          {(counts.done ?? 0) > 0 && (
            <Link href="/admin/drafts" className="admin-btn-primary ml-auto">
              Review {counts.done} draft{counts.done === 1 ? '' : 's'} →
            </Link>
          )}
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((it) => (
          <li key={it.id} className={cn('admin-card flex gap-3 p-3 text-sm', (it.status === 'error' || it.status === 'rejected') && 'border-rose-300', it.status === 'duplicate' && 'border-amber-300')}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img src={it.thumb} alt="" className="h-20 w-20 shrink-0 rounded-md bg-muted object-cover" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate font-medium" title={it.file.name}>
                {it.result?.title ?? it.file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {mb(it.file.size)}
                {it.width ? ` · ${it.width}×${it.height}` : ''}
                {it.note ? ` · ${it.note}` : ''}
              </p>
              <StatusLine it={it} />
              {it.status === 'duplicate' && it.duplicate && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link href={it.duplicate.href} target="_blank" className="text-xs underline">
                    See existing
                  </Link>
                  <button type="button" className="text-xs font-medium underline" onClick={() => void send(it, true)}>
                    Upload anyway
                  </button>
                  <button type="button" className="text-xs text-muted-foreground underline" onClick={() => patch(it.id, { status: 'skipped' })}>
                    Skip
                  </button>
                </div>
              )}
              {it.status === 'error' && (
                <button type="button" className="text-xs font-medium underline" onClick={() => patch(it.id, { status: 'ready' })}>
                  Retry
                </button>
              )}
            </div>
            {!['uploading', 'processing'].includes(it.status) && (
              <button
                type="button"
                aria-label="Remove from list"
                className="self-start rounded p-1 text-muted-foreground hover:bg-secondary"
                onClick={() => {
                  URL.revokeObjectURL(it.thumb);
                  setItems((l) => l.filter((x) => x.id !== it.id));
                }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusLine({ it }: { it: Item }) {
  switch (it.status) {
    case 'checking':
      return <p className="text-xs text-muted-foreground">Checking…</p>;
    case 'ready':
      return <p className="text-xs text-muted-foreground">Waiting in queue</p>;
    case 'uploading':
      return (
        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-foreground transition-[width]" style={{ width: `${it.progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Uploading {it.progress}%</p>
        </div>
      );
    case 'processing':
      return (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Making sizes, previews and watermarks…
        </p>
      );
    case 'done':
      return (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Draft created
          {it.result?.aiFilled && (
            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
              · <Sparkles className="h-3 w-3" /> AI details
            </span>
          )}
          {it.result && (
            <Link href={it.result.href} className="underline">
              Edit
            </Link>
          )}
        </p>
      );
    case 'duplicate':
      return (
        <p className="flex items-start gap-1.5 text-xs text-amber-700">
          <Copy className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {it.error}
        </p>
      );
    case 'skipped':
      return <p className="text-xs text-muted-foreground">Skipped</p>;
    default:
      return (
        <p className="flex items-start gap-1.5 text-xs text-rose-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {it.error}
        </p>
      );
  }
}
