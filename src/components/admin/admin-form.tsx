'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'checkbox' | 'lines' | 'select';

export interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  /** For 'select'. */
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  /** Column span on wide screens (1–4). */
  span?: 1 | 2 | 3 | 4;
}

type Values = Record<string, unknown>;

/**
 * Generic admin editor: renders fields, converts them (money → minor units,
 * lines → string[]), and saves to `action` (POST to create, PATCH to edit).
 * Optional delete button. Refreshes the page on success.
 */
export function AdminForm({
  fields,
  initial = {},
  action,
  method = 'PATCH',
  deleteAction,
  deleteConfirm = 'Delete this permanently?',
  submitLabel = 'Save',
  resetOnSuccess = false,
  compact = false,
  extra,
  wrapAs,
}: {
  fields: FieldDef[];
  initial?: Values;
  action: string;
  method?: 'POST' | 'PATCH' | 'PUT';
  deleteAction?: string;
  deleteConfirm?: string;
  submitLabel?: string;
  resetOnSuccess?: boolean;
  compact?: boolean;
  /** Extra fixed values merged into the body (e.g. an id). */
  extra?: Values;
  /**
   * Send as a site setting: `{ key: wrapAs, value }`. A single field named
   * like the key sends its value directly; several fields send an object.
   */
  wrapAs?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  async function send(url: string, m: string, body?: Values) {
    setState('busy');
    setError('');
    const res = await fetch(url, {
      method: m,
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    if (res?.ok) {
      setState('saved');
      router.refresh();
      return true;
    }
    setState('error');
    setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Failed');
    return false;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const body: Values = {};
    for (const field of fields) {
      const raw = f.get(field.name);
      switch (field.type ?? 'text') {
        case 'checkbox':
          body[field.name] = raw === 'on';
          break;
        case 'number':
          body[field.name] = raw === '' || raw == null ? null : Number(raw);
          break;
        case 'money':
          body[field.name] = raw === '' || raw == null ? null : Math.round(Number(raw) * 100);
          break;
        case 'lines':
          body[field.name] = String(raw ?? '')
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);
          break;
        default:
          body[field.name] = String(raw ?? '');
      }
    }
    const payload: Values = wrapAs
      ? { key: wrapAs, value: fields.length === 1 && fields[0]!.name === wrapAs ? body[wrapAs] : body }
      : { ...body, ...extra };
    if ((await send(action, method, payload)) && resetOnSuccess) form.reset();
  }

  const display = (field: FieldDef): string => {
    const v = initial[field.name];
    if (v == null) return '';
    if (field.type === 'money') return (Number(v) / 100).toString();
    if (field.type === 'lines') return Array.isArray(v) ? v.join('\n') : String(v);
    return String(v);
  };

  return (
    <form onSubmit={onSubmit} className={compact ? 'space-y-3 text-sm' : 'space-y-4 text-sm'}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((field) => {
          const span = { 1: 'lg:col-span-1', 2: 'sm:col-span-2 lg:col-span-2', 3: 'sm:col-span-2 lg:col-span-3', 4: 'sm:col-span-2 lg:col-span-4' }[
            field.span ?? (field.type === 'textarea' || field.type === 'lines' ? 4 : 1)
          ];
          if (field.type === 'checkbox') {
            return (
              <label key={field.name} className={`flex items-center gap-2 self-end pb-2 ${span}`}>
                <input type="checkbox" name={field.name} defaultChecked={Boolean(initial[field.name])} /> {field.label}
              </label>
            );
          }
          return (
            <label key={field.name} className={`block space-y-1 ${span}`}>
              <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
              {field.type === 'textarea' || field.type === 'lines' ? (
                <textarea name={field.name} rows={field.type === 'lines' ? 3 : 2} defaultValue={display(field)} placeholder={field.placeholder} className="input" />
              ) : field.type === 'select' ? (
                <select name={field.name} defaultValue={display(field)} className="input">
                  {field.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={field.name}
                  type={field.type === 'number' || field.type === 'money' ? 'number' : 'text'}
                  step={field.type === 'money' ? '0.01' : field.type === 'number' ? 'any' : undefined}
                  defaultValue={display(field)}
                  placeholder={field.placeholder}
                  className="input"
                />
              )}
              {field.hint && <span className="block text-[11px] text-muted-foreground">{field.hint}</span>}
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={state === 'busy'}>
          {state === 'busy' ? 'Saving…' : submitLabel}
        </Button>
        {deleteAction && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={state === 'busy'}
            onClick={() => {
              if (confirm(deleteConfirm)) void send(deleteAction, 'DELETE');
            }}
          >
            Delete
          </Button>
        )}
        {state === 'saved' && <span className="text-emerald-600">Saved</span>}
        {state === 'error' && <span className="text-rose-600">{error}</span>}
      </div>
    </form>
  );
}

/** One on/off switch that saves immediately. */
export function SettingToggle({ settingKey, label, hint, value }: { settingKey: string; label: string; hint: string; value: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(value);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const next = !on;
          const res = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ key: settingKey, value: next }),
          }).catch(() => null);
          if (res?.ok) {
            setOn(next);
            router.refresh();
          }
          setBusy(false);
        }}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-neutral-300'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
