import { REGION_RANK, isRegionCode, type RegionCode } from '@/lib/geo';

/**
 * A gift can be redeemed in the tier it was bought in or a cheaper one —
 * never a more expensive one (like Steam gifts), so cheap-tier credits can't
 * be gifted into expensive countries.
 */
export function canRedeemIn(giftRegion: string, redeemerRegion: RegionCode): boolean {
  if (!isRegionCode(giftRegion)) return false;
  return REGION_RANK[redeemerRegion] <= REGION_RANK[giftRegion];
}

export const GIFT_CODE = /^[A-Z0-9]{12}$/;

/** Formats "ABCDEFGHJKLM" as "ABCD-EFGH-JKLM" and accepts either form back. */
export function formatGiftCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1-');
}
export function normaliseGiftCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Minimal HTML escaping for user-written text in emails. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
