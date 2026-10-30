'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export interface EditableWallpaper {
  id: string;
  title: string;
  description: string | null;
  alt_text: string | null;
  tags: string[];
  category_id: string | null;
  set_id: string | null;
  is_free: boolean;
}

export function WallpaperEditForm({
  wallpaper,
  categories,
  sets,
}: {
  wallpaper: EditableWallpaper;
  categories: { id: string; name: string }[];
  sets: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('saving');
    const f = new FormData(e.currentTarget);
    const res = await fetch(`/api/admin/wallpapers/${wallpaper.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: String(f.get('title') ?? ''),
        description: String(f.get('description') ?? '') || null,
        alt_text: String(f.get('alt_text') ?? '') || null,
        tags: String(f.get('tags') ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        category_id: String(f.get('category_id') ?? '') || null,
        set_id: String(f.get('set_id') ?? '') || null,
        is_free: f.get('is_free') === 'on',
      }),
    }).catch(() => null);
    if (res?.ok) {
      setState('saved');
      router.refresh();
    } else {
      setState('error');
      setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not save');
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4 text-sm">
      <Labeled label="Title">
        <input name="title" required defaultValue={wallpaper.title} className="input" />
      </Labeled>
      <Labeled label="Description">
        <textarea name="description" rows={3} defaultValue={wallpaper.description ?? ''} className="input" />
      </Labeled>
      <Labeled label="Alt text (accessibility & SEO)">
        <input name="alt_text" defaultValue={wallpaper.alt_text ?? ''} className="input" />
      </Labeled>
      <Labeled label="Tags (comma-separated)">
        <input name="tags" defaultValue={wallpaper.tags.join(', ')} className="input" />
      </Labeled>
      <Labeled label="Category">
        <select name="category_id" defaultValue={wallpaper.category_id ?? ''} className="input">
          <option value="">— None —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Labeled>
      <Labeled label="Matching set">
        <select name="set_id" defaultValue={wallpaper.set_id ?? ''} className="input">
          <option value="">— None —</option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </Labeled>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="is_free" defaultChecked={wallpaper.is_free} /> Free wallpaper
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={state === 'saving'}>
          {state === 'saving' ? 'Saving…' : 'Save'}
        </Button>
        {state === 'saved' && <span className="text-emerald-600">Saved</span>}
        {state === 'error' && <span className="text-rose-600">{error}</span>}
      </div>
    </form>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
