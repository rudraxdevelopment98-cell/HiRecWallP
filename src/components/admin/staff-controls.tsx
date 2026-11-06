'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/lib/use-refresh';
import { ROLE_LABEL, STAFF_ROLES, type StaffRole } from '@/lib/staff';

async function post(body: unknown): Promise<string | null> {
  const res = await fetch('/api/admin/staff', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  if (res?.ok) return null;
  return ((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Request failed';
}

export function AddStaffForm() {
  const { refresh, refreshing } = useRefresh();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('support');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        const err = await post({ action: 'add', email, staffRole: role });
        setBusy(false);
        setMsg(err ? { ok: false, text: err } : { ok: true, text: `${email} added as ${ROLE_LABEL[role]}.` });
        if (!err) {
          setEmail('');
          refresh();
        }
      }}
    >
      <label className="min-w-64 flex-1 space-y-1 text-sm">
        <span className="font-medium">Email of their account</span>
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Role</span>
        <select className="input h-10 py-1" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={busy || refreshing}>
        {busy ? 'Adding…' : 'Add staff'}
      </Button>
      {msg && <p className={`w-full text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}
    </form>
  );
}

export function StaffRowActions({ userId, role, self, twoFactor }: { userId: string; role: StaffRole; self: boolean; twoFactor: boolean }) {
  const { refresh, refreshing } = useRefresh();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (self) return <span className="text-xs text-muted-foreground">You</span>;
  async function run(body: unknown) {
    setBusy(true);
    setErr(null);
    const e = await post(body);
    setBusy(false);
    if (e) setErr(e);
    else refresh();
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select className="input h-8 py-0.5 text-xs" value={role} disabled={busy || refreshing} onChange={(e) => run({ action: 'set_role', userId, staffRole: e.target.value })} aria-label="Staff role">
        {STAFF_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      {twoFactor && (
        <Button size="sm" variant="ghost" disabled={busy || refreshing} onClick={() => run({ action: 'reset_mfa', userId })} title="Lost phone? Removes their authenticator so they can set it up again.">
          Reset 2FA
        </Button>
      )}
      {confirm ? (
        <>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run({ action: 'remove', userId })}>
            Yes, remove
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" disabled={busy || refreshing} onClick={() => setConfirm(true)}>
          Remove
        </Button>
      )}
      {err && <span className="w-full text-right text-xs text-rose-700">{err}</span>}
    </div>
  );
}
