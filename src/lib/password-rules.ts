/**
 * Password rules shown and enforced in the browser (Supabase stores only a
 * bcrypt hash). Keep MIN_PASSWORD in step with Supabase → Authentication →
 * Providers → Email → "Minimum password length".
 */
export const MIN_PASSWORD = 10;

const COMMON = ['password', 'qwerty', '123456', 'hirecwallp', 'wallpaper', 'iloveyou', 'admin', 'welcome', 'letmein', 'abc123'];

/** First problem with a password, or null when it is acceptable. */
export function passwordProblem(pw: string, email = ''): string | null {
  if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (pw.length > 72) return 'Use at most 72 characters.';
  if (!/[a-zA-Z]/.test(pw) || !/[0-9\W_]/.test(pw)) return 'Mix letters with numbers or symbols.';
  if (/^(.)\1+$/.test(pw)) return 'Avoid repeating one character.';
  const lower = pw.toLowerCase();
  const local = email.toLowerCase().split('@')[0] ?? '';
  if (local.length >= 4 && lower.includes(local)) return 'Don’t use your email name in the password.';
  if (COMMON.some((c) => lower.includes(c))) return 'That contains a very common password — pick something less guessable.';
  return null;
}

/** 0–4 rough strength for the meter (length + character variety). */
export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= MIN_PASSWORD) s += 1;
  if (pw.length >= 14) s += 1;
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(pw)).length;
  if (kinds >= 3) s += 1;
  if (pw.length >= 18 || kinds === 4) s += 1;
  return Math.min(4, s);
}

/**
 * Has this password appeared in a known data breach? Uses the free Have I Been
 * Pwned range API (k-anonymity: only the first 5 characters of the SHA-1 hash
 * leave the browser). Returns null when the check can't run.
 */
export async function breachCount(pw: string): Promise<number | null> {
  try {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(pw));
    const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, { headers: { 'Add-Padding': 'true' } });
    if (!res.ok) return null;
    const suffix = hex.slice(5);
    for (const line of (await res.text()).split('\n')) {
      const [s, n] = line.trim().split(':');
      if (s === suffix) return Number(n) || 0;
    }
    return 0;
  } catch {
    return null;
  }
}
