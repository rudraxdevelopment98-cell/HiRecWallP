/**
 * Wallpaper URLs: /w/<slug>-<code>. The 8-character code is permanent and
 * unique (set by the database); the slug is only for people and search
 * engines, so renaming a wallpaper never breaks a link. Old slug-only links
 * still work and redirect to the canonical URL.
 */

/** No 0/o, 1/l/i — easy to read aloud; always contains a digit so words never look like codes. */
export const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const CODE_RE = /^(?=[a-z2-9]*[2-9])[a-hjkmnp-z2-9]{8}$/;

export interface WallpaperRef {
  slug: string;
  code?: string | null;
}

export function wallpaperPath(w: WallpaperRef): string {
  return w.code && CODE_RE.test(w.code) ? `/w/${w.slug}-${w.code}` : `/w/${w.slug}`;
}

/** Split a /w/[param] value into its code (when present) and slug. */
export function parseWallpaperParam(param: string): { code: string | null; slug: string } {
  const p = decodeURIComponent(param).toLowerCase();
  const i = p.lastIndexOf('-');
  if (i > 0) {
    const tail = p.slice(i + 1);
    if (CODE_RE.test(tail)) return { code: tail, slug: p.slice(0, i) };
  }
  if (CODE_RE.test(p)) return { code: p, slug: '' };
  return { code: null, slug: p };
}

/** Deterministic code for built-in demo wallpapers (FNV-1a hash of the slug). */
export function demoCode(slug: string): string {
  let h = 0x811c9dc5;
  for (const ch of slug) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    out += CODE_ALPHABET[h % CODE_ALPHABET.length];
  }
  // Guarantee a digit (last character from the digit part of the alphabet).
  return /[2-9]/.test(out) ? out : out.slice(0, 7) + '23456789'[h % 8];
}
