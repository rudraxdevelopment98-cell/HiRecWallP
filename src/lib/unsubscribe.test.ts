import { vi } from 'vitest';
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }));
vi.mock('@/lib/catalogue', () => ({ listWallpapersByIds: vi.fn() }));
vi.mock('@/lib/settings', () => ({ getSettings: vi.fn() }));
import { describe, expect, it } from 'vitest';
import { unsubscribeToken, verifyUnsubscribe } from './unsubscribe';
import { istToday } from './daily';

describe('unsubscribe tokens', () => {
  it('verifies only the right email and token', () => {
    const t = unsubscribeToken('a@b.co');
    expect(verifyUnsubscribe('A@B.co', t)).toBe(true);
    expect(verifyUnsubscribe('c@b.co', t)).toBe(false);
    expect(verifyUnsubscribe('a@b.co', t.slice(0, -1) + 'x')).toBe(false);
    expect(verifyUnsubscribe('a@b.co', '')).toBe(false);
  });
});

describe('istToday', () => {
  it('switches date at midnight India time', () => {
    expect(istToday(new Date('2026-11-03T18:29:00Z'))).toBe('2026-11-03');
    expect(istToday(new Date('2026-11-03T18:30:00Z'))).toBe('2026-11-04');
  });
});
