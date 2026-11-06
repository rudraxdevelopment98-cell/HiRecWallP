'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { PasswordField, usePasswordCheck } from '@/components/auth/password-field';
import { cn } from '@/lib/utils';

// The 6-digit code needs {{ .Token }} in the Supabase email templates, which
// requires custom SMTP. Turn on with NEXT_PUBLIC_AUTH_EMAIL_CODE=1 once set up.
const EMAIL_CODE_ENABLED = process.env.NEXT_PUBLIC_AUTH_EMAIL_CODE === '1';

type Mode = 'signin' | 'signup' | 'forgot' | 'link';

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email first — open the link we sent you.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Please wait a few minutes and try again.';
  if (/password should be|weak password/i.test(message)) return 'That password is too weak. Use a longer one with numbers or symbols.';
  return message;
}

/**
 * Sign in with email + password (with create account and password reset), an
 * email sign-in link (optionally a 6-digit code), or Google when enabled in
 * Admin → Settings. All of it is Supabase Auth (free plan).
 */
export function LoginForm({ next, google: showGoogle = true, initialMode = 'signin' }: { next: string; google?: boolean; initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<null | 'link' | 'confirm' | 'reset'>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = usePasswordCheck(password, email, mode === 'signup');

  const callback = (to = next) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(to)}`;
  const go = (m: Mode) => {
    setMode(m);
    setError(null);
    setSent(null);
  };

  async function signedIn() {
    // Welcome bonus / consent records (idempotent), then continue.
    await fetch('/api/account/welcome', { method: 'POST' }).catch(() => undefined);
    router.replace(next);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const auth = createClient().auth;
    try {
      if (mode === 'signin') {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw error;
        await signedIn();
        return;
      }
      if (mode === 'signup') {
        const problem = await check.verify();
        if (problem) throw new Error(problem);
        const { data, error } = await auth.signUp({ email, password, options: { emailRedirectTo: callback() } });
        if (error) throw error;
        if (data.session) {
          await signedIn();
          return;
        }
        // Supabase hides whether the email exists: an existing account comes back with no identities.
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          throw new Error('An account with this email already exists. Sign in, or reset your password.');
        }
        setSent('confirm');
      }
      if (mode === 'forgot') {
        const { error } = await auth.resetPasswordForEmail(email, { redirectTo: callback('/auth/reset') });
        if (error) throw error;
        setSent('reset');
      }
      if (mode === 'link') {
        const { error } = await auth.signInWithOtp({ email, options: { emailRedirectTo: callback() } });
        if (error) throw error;
        setSent('link');
      }
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError(friendly(error.message));
    else await signedIn();
  }

  async function google() {
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback() } });
    if (error) setError(friendly(error.message));
  }

  async function resendConfirm() {
    setBusy(true);
    const { error } = await createClient().auth.resend({ type: 'signup', email, options: { emailRedirectTo: callback() } });
    setBusy(false);
    setError(error ? friendly(error.message) : null);
  }

  if (sent) {
    const text = {
      link: <>We emailed a sign-in link to <strong>{email}</strong>. Open it on this device to come straight back, signed in.</>,
      confirm: <>We sent a confirmation link to <strong>{email}</strong>. Open it to activate your account — then you&rsquo;re signed in.</>,
      reset: <>If an account exists for <strong>{email}</strong>, we sent a link to set a new password. It works once and expires soon.</>,
    }[sent];
    return (
      <div className="w-full space-y-3 text-left">
        <div className="rounded-xl border bg-secondary p-4 text-sm">
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1 text-muted-foreground">{text} Nothing there? Check spam.</p>
        </div>
        {sent === 'link' && EMAIL_CODE_ENABLED && (
          <form onSubmit={verifyCode} className="space-y-2 text-sm">
            <label htmlFor="otp" className="text-muted-foreground">
              Got a 6-digit code instead?
            </label>
            <input id="otp" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} className="input tracking-widest" />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify & sign in'}
            </Button>
          </form>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {sent === 'confirm' && (
            <button type="button" className="underline" onClick={resendConfirm} disabled={busy}>
              Resend confirmation
            </button>
          )}
          <button type="button" className="underline" onClick={() => go('signin')}>
            Back to sign in
          </button>
        </div>
        {error && (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  const title = { signin: 'Sign in', signup: 'Create account', forgot: 'Reset password', link: 'Email link' }[mode];
  const needsPassword = mode === 'signin' || mode === 'signup';

  return (
    <div className="w-full space-y-4 text-left">
      {(mode === 'signin' || mode === 'signup') && (
        <div className="grid grid-cols-2 gap-1 rounded-lg border bg-secondary/50 p-1 text-sm" role="tablist">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => go(m)}
              className={cn('rounded-md py-1.5', mode === m ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground')}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
      )}
      {(mode === 'forgot' || mode === 'link') && <p className="font-medium">{title}</p>}

      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" htmlFor="email">
            Email address
          </label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input" />
        </div>

        {needsPassword && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium" htmlFor="password">
                Password
              </label>
              {mode === 'signin' && (
                <button type="button" className="text-xs underline" onClick={() => go('forgot')}>
                  Forgot password?
                </button>
              )}
            </div>
            {mode === 'signup' ? (
              <PasswordField id="password" value={password} onChange={setPassword} check={check} autoComplete="new-password" />
            ) : (
              <div className="relative">
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                />
                <button type="button" className="absolute inset-y-0 right-0 px-3 text-muted-foreground" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={busy || (mode === 'signup' && !check.ok)}>
          {mode === 'link' ? <Mail className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}{' '}
          {busy
            ? 'Please wait…'
            : { signin: 'Sign in', signup: 'Create account', forgot: 'Email me a reset link', link: 'Email me a sign-in link' }[mode]}
        </Button>
      </form>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {mode !== 'link' && (
          <button type="button" className="underline" onClick={() => go('link')}>
            Sign in with an email link instead
          </button>
        )}
        {(mode === 'link' || mode === 'forgot') && (
          <button type="button" className="underline" onClick={() => go('signin')}>
            Sign in with a password
          </button>
        )}
      </div>

      {showGoogle && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={google}>
            Continue with Google
          </Button>
        </>
      )}
      {error && (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
