'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { breachCount, MIN_PASSWORD, passwordProblem, passwordScore } from '@/lib/password-rules';
import { cn } from '@/lib/utils';

export interface PasswordCheck {
  problem: string | null;
  breached: number | null;
  ok: boolean;
  /** Final check before submitting (includes the breach lookup); returns a problem or null. */
  verify: () => Promise<string | null>;
}

/** Live rules + a debounced Have I Been Pwned lookup for a new password. */
export function usePasswordCheck(password: string, email: string, active = true): PasswordCheck {
  const [breached, setBreached] = useState<number | null>(null);
  const seq = useRef(0);
  const problem = active && password ? passwordProblem(password, email) : null;

  useEffect(() => {
    setBreached(null);
    if (!active || !password || passwordProblem(password, email)) return;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const c = await breachCount(password);
      if (n === seq.current) setBreached(c);
    }, 500);
    return () => clearTimeout(t);
  }, [password, email, active]);

  const breachMsg = (c: number | null) => (c && c > 0 ? 'This password has appeared in a data breach — please choose a different one.' : null);
  return {
    problem: problem ?? breachMsg(breached),
    breached,
    ok: Boolean(password) && !problem && !(breached && breached > 0),
    async verify() {
      const p = passwordProblem(password, email);
      if (p) return p;
      return breachMsg(await breachCount(password));
    },
  };
}

const LABEL = ['Too weak', 'Weak', 'OK', 'Good', 'Strong'];

export function PasswordField({
  id,
  value,
  onChange,
  check,
  autoComplete = 'new-password',
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  check: PasswordCheck;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const score = passwordScore(value);
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          minLength={MIN_PASSWORD}
          maxLength={72}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input pr-10"
          aria-describedby={`${id}-help`}
        />
        <button type="button" className="absolute inset-y-0 right-0 px-3 text-muted-foreground" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {value && (
        <div className="flex gap-1" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn('h-1 flex-1 rounded-full', i < score ? (score >= 3 ? 'bg-emerald-500' : score === 2 ? 'bg-amber-500' : 'bg-rose-500') : 'bg-secondary')} />
          ))}
        </div>
      )}
      <p id={`${id}-help`} className={cn('text-xs', check.problem ? 'text-rose-600' : 'text-muted-foreground')} aria-live="polite">
        {check.problem ?? (value ? `${LABEL[score]} · checked against known data breaches` : `At least ${MIN_PASSWORD} characters, with numbers or symbols. A short sentence works well.`)}
      </p>
    </div>
  );
}
