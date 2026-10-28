'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

/** Email one-time code (or magic link) + Google sign-in via Supabase Auth. */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setStage('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError(error.message);
    else {
      router.replace(next);
      router.refresh();
    }
  }

  async function google() {
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo() },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="w-full space-y-4 text-left">
      {stage === 'email' ? (
        <form onSubmit={sendCode} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input"
          />
          <Button type="submit" className="w-full" disabled={busy}>
            <Mail className="h-4 w-4" /> {busy ? 'Sending…' : 'Email me a sign-in code'}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            We sent a code to <span className="font-medium text-foreground">{email}</span>. Enter it
            below, or click the link in the email.
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className="input tracking-widest"
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Verifying…' : 'Verify & sign in'}
          </Button>
          <button type="button" className="text-xs underline" onClick={() => setStage('email')}>
            Use a different email
          </button>
        </form>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={google}>
        Continue with Google
      </Button>
      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
    </div>
  );
}
