import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({}) }));
import { titleFromFilename } from './duplicates';

describe('titleFromFilename', () => {
  it('turns file names into readable titles', () => {
    expect(titleFromFilename('canyon_river-4K final.jpg')).toBe('Canyon River');
    expect(titleFromFilename('IMG_2041.PNG')).toBe('Untitled wallpaper');
    expect(titleFromFilename('neon.city.night.3840x2160.webp')).toBe('Neon City Night');
  });
});
