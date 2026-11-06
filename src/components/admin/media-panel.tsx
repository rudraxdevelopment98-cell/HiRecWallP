'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { stageUpload } from '@/lib/upload-client';
import { useRefresh } from '@/lib/use-refresh';

/** Replace the image or regenerate sizes for one wallpaper. */
export function MediaPanel({ id, sold }: { id: string; sold: number }) {
  const { refresh, refreshing } = useRefresh();
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error' | 'duplicate'>('idle');
  const [msg, setMsg] = useState('');
  const [dupHref, setDupHref] = useState('');

  async function run(mode: 'replace' | 'regenerate', force = false) {
    setState('busy');
    setMsg(mode === 'replace' ? 'Uploading…' : 'Rebuilding sizes…');
    try {
      const body = new FormData();
      body.set('mode', mode);
      if (mode === 'replace') {
        if (!file) throw new Error('Choose the new image first');
        const k = key ?? (await stageUpload(file, (p) => setMsg(`Uploading ${p}%`)));
        setKey(k);
        body.set('incomingKey', k);
        if (force) body.set('force', '1');
        setMsg('Making sizes, previews and watermarks…');
      }
      const res = await fetch(`/api/admin/wallpapers/${id}/media`, { method: 'POST', body });
      const j = (await res.json().catch(() => ({}))) as { error?: string; variants?: string[]; duplicate?: { href: string } };
      if (res.status === 409 && j.duplicate) {
        setState('duplicate');
        setDupHref(j.duplicate.href);
        setMsg(j.error ?? 'Possible duplicate');
        return;
      }
      if (!res.ok) throw new Error(j.error ?? 'Failed');
      setState('done');
      setKey(null);
      setFile(null);
      setMsg(`Done — sizes: ${(j.variants ?? []).filter((v) => !v.startsWith('preview')).join(', ')}.`);
      refresh();
    } catch (err) {
      setState('error');
      setKey(null);
      setMsg(err instanceof Error ? err.message : 'Failed');
    }
  }

  const busy = state === 'busy' || refreshing;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Keeps the same page, link, price and buyers.{sold > 0 ? ` ${sold} buyer(s) will get the new file on their next download.` : ''}
      </p>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/tiff"
        className="block w-full text-xs"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setKey(null);
          setState('idle');
          setMsg('');
        }}
        aria-label="New image"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!file || busy} onClick={() => run('replace')}>
          Replace image
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run('regenerate')}>
          Regenerate sizes
        </Button>
      </div>
      {msg && (
        <p className={state === 'error' ? 'text-rose-700' : state === 'duplicate' ? 'text-amber-700' : state === 'done' ? 'text-emerald-700' : 'text-muted-foreground'}>
          {msg}{' '}
          {state === 'duplicate' && (
            <>
              <Link href={dupHref} target="_blank" className="underline">
                See it
              </Link>{' '}
              ·{' '}
              <button type="button" className="font-medium underline" onClick={() => run('replace', true)}>
                Replace anyway
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
