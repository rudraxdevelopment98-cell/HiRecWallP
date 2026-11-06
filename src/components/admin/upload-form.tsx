'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** One-time (idempotent) R2 setup: browser-upload CORS + auto-cleanup rules. */
export function StorageRules() {
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
