'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface ProfileValues {
  display_name: string | null;
  country_code: string | null;
  gstin: string | null;
}

/** Settings form → /api/account/profile. */
export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('saving');
    const f = new FormData(e.currentTarget);
    const res = await fetch('/api/account/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        display_name: f.get('display_name'),
        country_code: f.get('country_code'),
        gstin: f.get('gstin'),
      }),
    }).catch(() => null);
    if (res?.ok) setState('saved');
    else {
      setState('error');
      setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not save');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" onChange={() => state === 'saved' && setState('idle')}>
      <Field label="Display name" name="display_name" defaultValue={initial.display_name ?? ''} />
      <Field
        label="Country (2-letter code)"
        name="country_code"
        defaultValue={initial.country_code ?? ''}
        placeholder="IN"
        maxLength={2}
      />
      <Field
        label="GSTIN (optional, Indian businesses)"
        name="gstin"
        defaultValue={initial.gstin ?? ''}
        placeholder="22AAAAA0000A1Z5"
        hint="Printed on your receipts for orders placed after you save it."
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={state === 'saving'}>
          {state === 'saving' ? 'Saving…' : 'Save changes'}
        </Button>
        {state === 'saved' && <span className="text-sm text-emerald-600">Saved</span>}
        {state === 'error' && <span className="text-sm text-rose-600">{error}</span>}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  maxLength,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={maxLength}
        className="input"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
