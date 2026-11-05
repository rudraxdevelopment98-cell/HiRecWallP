import { describe, expect, it } from 'vitest';
import { jsonForScript } from './safe-json';

describe('jsonForScript', () => {
  it('cannot be used to close the script tag', () => {
    const out = jsonForScript({ name: '</script><script>alert(1)</script>', d: 'a & b ' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<');
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>', d: 'a & b ' });
  });
});
