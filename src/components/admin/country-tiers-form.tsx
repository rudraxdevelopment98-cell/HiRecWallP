'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/lib/use-refresh';

const LINE = /^([A-Za-z]{2})\s*[=:\s]\s*(IN|T[1-4])$/i;

/** Edit country → tier overrides as lines like "BR T4". */
export function CountryTiersForm({ initial }: { initial: Record<string, string> }) {
  const { refresh, refreshing } = useRefresh();
  const [text, setText] = useState(
    Object.entries(initial)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([c, t]) => `${c} ${t}`)
      .join('\n'),
  );
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  async function save() {
    const value: Record<string, string> = {};
    for (const raw of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const m = raw.match(LINE);
      if (!m) {
        setState('error');
        setError(`Can't read "${raw}" — use a country code and tier, e.g. BR T4`);
        return;
      }
      value[m[1]!.toUpperCase()] = m[2]!.toUpperCase();
    }
    setState('busy');
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'country_tiers', value }),
    }).catch(() => null);
    if (res?.ok) {
      setState('saved');
      refresh();
    } else {
      setState('error');
      setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not save');
    }
  }

  return (
    <div className="space-y-2 text-sm">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="input font-mono" placeholder={'BR T4\nTR T4'} />
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={state === 'busy' || refreshing}>
          {state === 'busy' || refreshing ? 'Saving…' : 'Save overrides'}
        </Button>
        {state === 'saved' && !refreshing && <span className="text-emerald-600">Saved</span>}
        {state === 'error' && <span className="text-rose-600">{error}</span>}
      </div>
    </div>
  );
}
