/**
 * JSON for an inline <script> (e.g. JSON-LD). JSON.stringify alone lets a title
 * like "</script><script>…" break out of the tag (stored XSS), so escape the
 * characters that can end or confuse a script element.
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
