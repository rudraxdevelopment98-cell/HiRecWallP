import { describe, expect, it } from 'vitest';
import { areaForPath, canAccessPath, effectiveRole, isMfaExempt } from './staff';

describe('areaForPath', () => {
  it('maps admin pages and APIs to areas', () => {
    expect(areaForPath('/admin')).toBe('overview');
    expect(areaForPath('/admin/analytics')).toBe('sales');
    expect(areaForPath('/admin/orders/123')).toBe('sales');
    expect(areaForPath('/api/admin/orders/123/refund')).toBe('sales');
    expect(areaForPath('/admin/catalogue')).toBe('catalogue');
    expect(areaForPath('/api/admin/wallpapers/bulk')).toBe('catalogue');
    expect(areaForPath('/admin/credit-packs')).toBe('pricing');
    expect(areaForPath('/api/admin/settings')).toBe('business');
    expect(areaForPath('/admin/staff')).toBe('staff');
    expect(areaForPath('/admin/something-new')).toBe('business');
  });
});

describe('canAccessPath', () => {
  it('owner (and legacy admins without a staff role) can open everything', () => {
    expect(effectiveRole(null)).toBe('owner');
    expect(canAccessPath(null, '/admin/staff')).toBe(true);
    expect(canAccessPath('owner', '/api/admin/settings')).toBe(true);
  });
  it('manager cannot manage staff', () => {
    expect(canAccessPath('manager', '/admin/staff')).toBe(false);
    expect(canAccessPath('manager', '/admin/tax')).toBe(true);
  });
  it('support sees sales only', () => {
    expect(canAccessPath('support', '/admin/orders')).toBe(true);
    expect(canAccessPath('support', '/api/admin/support/1')).toBe(true);
    expect(canAccessPath('support', '/admin/catalogue')).toBe(false);
    expect(canAccessPath('support', '/api/admin/settings')).toBe(false);
    expect(canAccessPath('support', '/admin/credit-packs')).toBe(false);
  });
  it('content sees the catalogue and marketing', () => {
    expect(canAccessPath('content', '/api/admin/upload')).toBe(true);
    expect(canAccessPath('content', '/admin/social')).toBe(true);
    expect(canAccessPath('content', '/admin/orders')).toBe(false);
    expect(canAccessPath('content', '/api/admin/orders/1/refund')).toBe(false);
  });
  it('everyone can open the dashboard, guide and their security page', () => {
    for (const r of ['support', 'content'] as const) {
      expect(canAccessPath(r, '/admin')).toBe(true);
      expect(canAccessPath(r, '/admin/guide/admin-dashboard')).toBe(true);
      expect(canAccessPath(r, '/admin/security')).toBe(true);
    }
  });
  it('lets staff reach the security page before finishing 2FA', () => {
    expect(isMfaExempt('/admin/security')).toBe(true);
    expect(isMfaExempt('/admin/orders')).toBe(false);
  });
});
