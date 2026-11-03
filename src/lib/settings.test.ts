import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, sellerDetails, socialLinks, type SiteSettings } from './settings';

const withBusiness = (b: Partial<SiteSettings['business']>): SiteSettings => ({
  ...DEFAULT_SETTINGS,
  business: { ...DEFAULT_SETTINGS.business, ...b },
});

afterEach(() => vi.unstubAllEnvs());

describe('sellerDetails', () => {
  it('falls back to env then brand when nothing is saved', () => {
    vi.stubEnv('BUSINESS_LEGAL_NAME', '');
    vi.stubEnv('GST_RATE_PERCENT', '12');
    const s = sellerDetails(DEFAULT_SETTINGS, 'HirecWallp');
    expect(s.name).toBe('HirecWallp');
    expect(s.gstin).toBe('');
    expect(s.rate).toBe(12);
  });

  it('prefers admin settings over env', () => {
    vi.stubEnv('BUSINESS_LEGAL_NAME', 'Env Name');
    const s = sellerDetails(withBusiness({ legal_name: 'Saved Name', gstin: '24ABCDE1234F1Z5', gst_rate: 5 }), 'Brand');
    expect(s.name).toBe('Saved Name');
    expect(s.rate).toBe(5);
  });

  it('keeps a saved 0% rate when a GSTIN is set', () => {
    expect(sellerDetails(withBusiness({ gstin: '24ABCDE1234F1Z5', gst_rate: 0 }), 'B').rate).toBe(0);
  });
});

describe('socialLinks', () => {
  it('uses saved links and env as fallback', () => {
    vi.stubEnv('NEXT_PUBLIC_SOCIAL_YOUTUBE', 'https://youtube.com/@env');
    const links = socialLinks({ ...DEFAULT_SETTINGS, social: { ...DEFAULT_SETTINGS.social, instagram: 'https://instagram.com/hw' } });
    expect(links.instagram).toBe('https://instagram.com/hw');
    expect(links.youtube).toBe('https://youtube.com/@env');
    expect(links.x).toBe('');
  });
});
