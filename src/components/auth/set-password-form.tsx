'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { PasswordField, usePasswordCheck } from '@/components/auth/password-field';

/** Set or change the password of the signed-in account (reset link or Settings). */
export function SetPasswordForm({ email, after, label = 'Save password' }: { email: string; after?: string; label?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const check = usePasswordCheck(password, email);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg(null);
        if (password !== confirm) return setMsg({ ok: false, text: 'The two passwords don’t match.' });
        setBusy(true);
        const problem = await check.verify();
        if (problem) {
          setBusy(false);
          return setMsg({ ok: false, text: problem });
        }
        const { error } = await createClient().auth.updateUser({ password });
        setBusy(false);
        if (error) {
          setMsg({ ok: false, text: /session|expired|jwt/i.test(error.message) ? 'This link has expired. Request a new reset link.' : /same/i.test(error.message) ? 'Choose a password you haven’t used here before.' : error.message });
          return;
        }
        setPassword('');
        setConfirm('');
        setMsg({ ok: true, text: 'Password saved. You can now sign in with your email and password.' });
        if (after) {
          router.replace(after);
          router.refresh();
        }
      }}
    >
      <label htmlFor="new-password" className="block text-sm font-medium">
        New password
      </label>
      <PasswordField id="new-password" value={password} onChange={setPassword} check={check} />
      <label htmlFor="confirm-password" className="block text-sm font-medium">
        Repeat new password
      </label>
      <input id="confirm-password" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" />
      <Button type="submit" disabled={busy || !check.ok || !confirm}>
        {busy ? 'Saving…' : label}
      </Button>
      {msg && (
        <p className={msg.ok ? 'text-sm text-emerald-700' : 'text-sm text-rose-600'} role="status">
          {msg.text}
        </p>
      )}
    </form>
  );
}
