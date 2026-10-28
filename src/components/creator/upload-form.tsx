'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Status = 'idle' | 'uploading' | 'ok' | 'error';

/** Creator submission form → /api/creator/upload (moderation + review). */
export function CreatorUploadForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('uploading');
    setMessage('');
    try {
      const res = await fetch('/api/creator/upload', { method: 'POST', body: new FormData(event.currentTarget) });
      const json = (await res.json()) as { status?: string; error?: string; reasons?: string };
      if (!res.ok) throw new Error([json.error, json.reasons].filter(Boolean).join(' — ') || 'Upload failed');
      setStatus('ok');
      setMessage('Submitted for review. You’ll see it live once an admin approves it.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4">
      <Field label="Title" name="title" required />
      <Field label="Tags (comma-separated)" name="tags" placeholder="devotional, 4k" />
      <div className="space-y-1">
        <label htmlFor="description" className="text-sm font-medium">Description</label>
        <textarea id="description" name="description" rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </div>
      <div className="space-y-1">
        <label htmlFor="file" className="text-sm font-medium">Original (≥ 4K long edge)</label>
        <input id="file" name="file" type="file" accept="image/*" required className="block w-full text-sm" />
      </div>
      <p className="text-xs text-muted-foreground">
        Automated checks run on upload: resolution, duplicate detection, and screening for NSFW /
        trademarked / real-person content. Passing uploads go to manual review.
      </p>
      {message && <p className={`text-sm ${status === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>{message}</p>}
      <Button type="submit" disabled={status === 'uploading'}>
        {status === 'uploading' ? 'Checking & uploading…' : 'Submit for review'}
      </Button>
    </form>
  );
}

function Field({ label, name, required, placeholder }: { label: string; name: string; required?: boolean; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="text-sm font-medium">{label}</label>
      <input id={name} name={name} required={required} placeholder={placeholder} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
    </div>
  );
}
