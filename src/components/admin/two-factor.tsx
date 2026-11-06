'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

type Factor = { id: string; status: string; friendly_name?: string | null; created_at: string };

/**
 * Two-factor sign-in with an authenticator app (TOTP, Supabase Auth MFA — free).
 * mode 'verify': enter today's code to finish signing in. Otherwise: set it up
 * (scan the QR code, confirm a code) or turn it off.
 */
export function TwoFactorPanel({ mode, required }: { mode: 'ok' | 'verify' | 'setup'; required: boolean }) {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const auth = createClient().auth;

  async function load() {
    const { data } = await auth.mfa.listFactors();
    setFactors(((data?.totp ?? []) as Factor[]).filter((f) => f.status === 'verified'));
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify(factorId: string) {
    setBusy(true);
    setMsg(null);
    const { error } = await auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, '') });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: /invalid|expired/i.test(error.message) ? 'That code didn’t work — check the time on your phone and try the newest code.' : error.message });
    window.location.href = '/admin';
  }

  async function start() {
    setBusy(true);
    setMsg(null);
    // Clear half-finished attempts (an unverified factor blocks a new one with the same name).
    const { data: all } = await auth.mfa.listFactors();
    for (const f of (all?.all ?? []).filter((f) => f.status !== 'verified')) await auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` });
    setBusy(false);
    if (error || !data) return setMsg({ ok: false, text: error?.message ?? 'Could not start set-up' });
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function turnOff(id: string) {
    setBusy(true);
    const { error } = await auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: 'Two-factor turned off.' });
    await load();
  }

  const codeInput = (
    <input
      className="input w-40 text-center font-mono text-lg tracking-[0.3em]"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={7}
      placeholder="123456"
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
      aria-label="6-digit code"
    />
  );

  if (factors === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (mode === 'verify' && factors[0]) {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void verify(factors[0]!.id);
        }}
      >
        <p className="text-sm">Open your authenticator app and enter the 6-digit code for HirecWallp.</p>
        <div className="flex items-center gap-2">
          {codeInput}
          <Button type="submit" disabled={busy || code.replace(/\s/g, '').length !== 6}>
            {busy ? 'Checking…' : 'Verify'}
          </Button>
        </div>
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}
        <p className="text-xs text-muted-foreground">Lost your phone? Ask the owner to reset your two-factor on the Staff page.</p>
      </form>
    );
  }

  if (factors.length > 0 && !enroll) {
    return (
      <div className="space-y-3 text-sm">
        <p className="flex items-center gap-2 font-medium text-emerald-700">
          <ShieldCheck className="h-4 w-4" /> Two-factor sign-in is on
        </p>
        <p className="text-muted-foreground">You’ll be asked for a code from your authenticator app each time you sign in to the admin.</p>
        {!required && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => turnOff(factors[0]!.id)}>
            Turn off
          </Button>
        )}
        {msg && <p className={msg.ok ? 'text-emerald-700' : 'text-rose-700'}>{msg.text}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      {mode === 'setup' && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">The owner requires two-factor sign-in for staff. Set it up to continue.</p>}
      {!enroll ? (
        <>
          <p className="text-muted-foreground">
            Protect the admin with a code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password…), on top of your password.
          </p>
          <Button onClick={start} disabled={busy}>
            {busy ? 'Starting…' : 'Set up two-factor'}
          </Button>
        </>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void verify(enroll.id);
          }}
        >
          <p>1. Scan this with your authenticator app:</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR code is an inline SVG data URL from Supabase */}
          <img src={enroll.qr} alt="QR code for your authenticator app" className="h-44 w-44 rounded-lg border bg-white p-2" />
          <p className="text-xs text-muted-foreground">
            Can’t scan? Enter this key: <code className="break-all rounded bg-secondary px-1">{enroll.secret}</code>
          </p>
          <p>2. Enter the 6-digit code it shows:</p>
          <div className="flex items-center gap-2">
            {codeInput}
            <Button type="submit" disabled={busy || code.replace(/\s/g, '').length !== 6}>
              {busy ? 'Checking…' : 'Turn on'}
            </Button>
          </div>
        </form>
      )}
      {msg && <p className={msg.ok ? 'text-emerald-700' : 'text-rose-700'}>{msg.text}</p>}
    </div>
  );
}

/** Owner switch: require two-factor for all staff. */
export function RequireMfaSwitch({ on }: { on: boolean }) {
  const [value, setValue] = useState(on);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-2 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value}
          disabled={busy}
          onChange={async (e) => {
            const next = e.target.checked;
            setBusy(true);
            setErr(null);
            const res = await fetch('/api/admin/security', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ require_staff_mfa: next }) }).catch(() => null);
            setBusy(false);
            if (res?.ok) setValue(next);
            else setErr(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not save');
          }}
        />
        Require two-factor sign-in for all staff
      </label>
      {err && <p className="text-rose-700">{err}</p>}
    </div>
  );
}
