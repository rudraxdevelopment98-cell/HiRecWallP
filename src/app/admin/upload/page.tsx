'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formWithStagedFile } from '@/lib/upload-client';

type Status = 'idle' | 'uploading' | 'ok' | 'error';

export default function AdminUploadPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('uploading');
    setMessage('');
    try {
      const body = await formWithStagedFile(event.currentTarget, (pct) => setMessage(`Uploading… ${pct}%`));
      setMessage('Processing sizes, previews and watermarks…');
      const res = await fetch('/api/admin/upload', { method: 'POST', body });
      const json = (await res.json()) as { wallpaperId?: string; slug?: string; variants?: string[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      setStatus('ok');
      setMessage(`Created draft "${json.slug}" (${(json.variants ?? []).join(', ')}). Publish it from Catalogue.`);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Upload wallpaper</h1>
        <p className="text-sm text-muted-foreground">
          Drop a high-resolution original (≥ 3840px long edge; 5120px+ unlocks 5K). Device sizes
          matching the artwork&rsquo;s orientation, previews, watermarks and the free size are
          generated automatically. Up to 150 MB (JPEG, PNG, WebP, AVIF, TIFF).
        </p>
      </div>

      <StorageRules />

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Title" name="title" required />
        <Field label="Slug (optional)" name="slug" placeholder="auto from title" />
        <Field label="Category id (optional)" name="category_id" />
        <Field label="Tags (comma-separated)" name="tags" placeholder="mahadev, cosmic, 4k" />
        <div className="space-y-1">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_free" value="1" /> Free wallpaper
        </label>
        <div className="space-y-1">
          <label htmlFor="file" className="text-sm font-medium">
            Original image
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/tiff"
            required
            className="block w-full text-sm"
          />
        </div>

        {message && (
          <p className={`text-sm ${status === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
            {message}
          </p>
        )}
        <Button type="submit" disabled={status === 'uploading'}>
          {status === 'uploading' ? 'Processing…' : 'Upload'}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

/** One-time (idempotent) R2 setup: browser-upload CORS + auto-cleanup rules. */
function StorageRules() {
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'error'>('idle');
  const [note, setNote] = useState('');
  async function apply() {
    setState('busy');
    try {
      const res = await fetch('/api/admin/storage/setup', { method: 'POST' });
      const json = (await res.json()) as { error?: string; detail?: string };
      if (!res.ok) throw new Error([json.error, json.detail].filter(Boolean).join(': '));
      setState('ok');
      setNote('Storage rules applied: direct uploads enabled, temp files auto-clean.');
    } catch (err) {
      setState('error');
      setNote(err instanceof Error ? err.message : 'Failed');
    }
  }
  return (
    <div className="rounded-lg border p-4 text-sm">
      <p className="font-medium">Storage rules</p>
      <p className="mt-1 text-muted-foreground">
        Run once after connecting R2 (and again if the site URL changes).
      </p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={apply} disabled={state === 'busy'}>
        {state === 'busy' ? 'Applying…' : 'Apply storage rules'}
      </Button>
      {note && <p className={`mt-2 ${state === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>{note}</p>}
    </div>
  );
}
