import { describe, expect, it } from 'vitest';
import { creditEventTitle, mergeTimeline, signinTitle, staffActionTitle } from './timeline';

describe('timeline', () => {
  it('merges newest first, drops bad dates and caps the list', () => {
    const out = mergeTimeline(
      [
        [{ at: '2026-11-01T10:00:00Z', kind: 'order', title: 'a' }],
        [
          { at: '2026-11-03T10:00:00Z', kind: 'credit', title: 'b' },
          { at: 'nope', kind: 'credit', title: 'bad' },
        ],
        [{ at: '2026-11-02T10:00:00Z', kind: 'signin', title: 'c' }],
      ],
      2,
    );
    expect(out.map((e) => e.title)).toEqual(['b', 'c']);
  });
  it('describes credit changes and sign-ins', () => {
    expect(creditEventTitle(35, 'purchase')).toBe('+35 credits · bought');
    expect(creditEventTitle(-1, 'spend')).toBe('−1 credit · spent');
    expect(signinTitle('login')).toBe('Signed in');
    expect(signinTitle('other')).toBe('other');
    expect(staffActionTitle('staff.add')).toBe('Given staff access');
    expect(staffActionTitle('x.y')).toBe('Staff: x.y');
  });
});
