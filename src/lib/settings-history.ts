/** Settings change history (B6): readable summaries of what changed. Pure. */

export const SETTING_LABEL: Record<string, string> = {
  store_open: 'Store open',
  membership_enabled: 'Membership',
  creator_signups: 'Creator sign-ups',
  free_downloads: 'Free downloads',
  newsletter_enabled: 'Newsletter',
  downloads_per_purchase: 'Downloads per purchase',
  announcement: 'Announcement bar',
  business: 'Business details',
  legal: 'Grievance / legal',
  social: 'Social links',
  google_login: 'Google sign-in',
  growth: 'Growth settings',
  tax: 'Tax settings',
  country_tiers: 'Country tiers',
  creator_credit_value_inr: 'Creator credit value',
  fx_to_inr: 'Exchange rates',
  security: 'Security',
};

const short = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** One line per changed field, e.g. "text: Old → New". Values are shortened. */
export function settingDiff(oldValue: unknown, newValue: unknown): string[] {
  if (isObj(oldValue) && isObj(newValue)) {
    const keys = [...new Set([...Object.keys(oldValue), ...Object.keys(newValue)])].sort();
    return keys
      .filter((k) => JSON.stringify(oldValue[k]) !== JSON.stringify(newValue[k]))
      .map((k) => `${k}: ${short(oldValue[k])} → ${short(newValue[k])}`);
  }
  if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return [];
  return [`${short(oldValue)} → ${short(newValue)}`];
}
