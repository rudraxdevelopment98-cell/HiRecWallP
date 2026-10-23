'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Status = 'idle' | 'uploading' | 'ok' | 'error';

export default function AdminUploadPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('uploading');
    setMessage('');
    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: new FormData(event.currentTarget),
      });
      const json = (await res.json()) as { wallpaperId?: string; slug?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      setStatus('ok');
      setMessage(`Created draft "${json.slug}". Publish it from Catalogue.`);
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
          Drop a high-resolution original (≥ 5120px long edge recommended). Variants, previews,
          watermarks and free sizes are generated automatically.
        </p>
      </div>

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
            accept="image/*"
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
