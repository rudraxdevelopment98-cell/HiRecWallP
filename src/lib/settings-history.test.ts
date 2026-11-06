import { describe, expect, it } from 'vitest';
import { settingDiff } from './settings-history';

describe('settingDiff', () => {
  it('lists changed fields of an object setting', () => {
    expect(settingDiff({ enabled: true, text: 'Old', href: '' }, { enabled: false, text: 'Old', href: '/x' })).toEqual(['enabled: on → off', 'href: — → /x']);
  });
  it('handles plain values and new keys', () => {
    expect(settingDiff(5, 3)).toEqual(['5 → 3']);
    expect(settingDiff(null, true)).toEqual(['— → on']);
    expect(settingDiff(true, true)).toEqual([]);
  });
  it('shortens long values', () => {
    const [line] = settingDiff('a'.repeat(100), 'b');
    expect(line!.length).toBeLessThan(80);
  });
});
