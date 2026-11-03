import 'server-only';

import { createClient as createSupabase } from '@supabase/supabase-js';
import type { RegionCode } from '@/lib/geo';

/**
 * Admin-controlled switches (table `site_settings`, edited at /admin/settings).
 * Every key has a safe default so the site works before anything is saved.
 */
export interface SiteSettings {
  /** Checkout + credit unlocks. Off = "store temporarily closed". */
  store_open: boolean;
  /** Membership passes on sale (existing members keep their benefits). */
  membership_enabled: boolean;
  /** New creator sign-ups. */
  creator_signups: boolean;
  /** Free-variant downloads. */
  free_downloads: boolean;
  /** Newsletter sign-up boxes. */
  newsletter_enabled: boolean;
  /** Downloads allowed per purchased wallpaper (new purchases). */
  downloads_per_purchase: number;
  /** Site-wide announcement bar. */
  announcement: { enabled: boolean; text: string; href: string };
  /** Show "Continue with Google" (turn on after enabling the Google provider in Supabase Auth). */
  google_login: boolean;
  /** Seller details printed on receipts / tax invoices (env vars are the fallback). */
  business: { legal_name: string; address: string; gstin: string; gst_rate: number; support_email: string };
  /** What one credit is worth (₹) when paying creators for credit spends / membership claims. */
  creator_credit_value_inr: number;
  /** Move a country to another pricing tier, e.g. { "BR": "T4" } (Admin → Pricing by country). */
  country_tiers: Record<string, RegionCode>;
  /** Footer social links (icons appear only when a URL is set). */
  social: { instagram: string; youtube: string; x: string; facebook: string; pinterest: string };
}

export const DEFAULT_SETTINGS: SiteSettings = {
  store_open: true,
  membership_enabled: false,
  creator_signups: true,
  free_downloads: true,
  newsletter_enabled: true,
  downloads_per_purchase: 5,
  announcement: { enabled: false, text: '', href: '' },
  google_login: false,
  business: { legal_name: '', address: '', gstin: '', gst_rate: 18, support_email: '' },
  social: { instagram: '', youtube: '', x: '', facebook: '', pinterest: '' },
  country_tiers: {},
  creator_credit_value_inr: 5,
};

export type SettingKey = keyof SiteSettings;
export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

let cache: { at: number; value: SiteSettings } | null = null;

/** Read settings (public-read table, anon key), cached ~30 s per instance. */
export async function getSettings(): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return DEFAULT_SETTINGS;
  try {
    const { data, error } = await createSupabase(url, anon, { auth: { persistSession: false } })
      .from('site_settings')
      .select('key, value');
    if (error) throw error;
    const value: SiteSettings = { ...DEFAULT_SETTINGS };
    for (const row of data ?? []) {
      if ((SETTING_KEYS as string[]).includes(row.key as string)) {
        (value as unknown as Record<string, unknown>)[row.key as string] = row.value;
      }
    }
    value.announcement = { ...DEFAULT_SETTINGS.announcement, ...(value.announcement ?? {}) };
    value.business = { ...DEFAULT_SETTINGS.business, ...(value.business ?? {}) };
    value.social = { ...DEFAULT_SETTINGS.social, ...(value.social ?? {}) };
    value.country_tiers = value.country_tiers && typeof value.country_tiers === 'object' ? value.country_tiers : {};
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return cache?.value ?? DEFAULT_SETTINGS;
  }
}

export function clearSettingsCache(): void {
  cache = null;
}

/** Seller details: admin settings first, then env (BUSINESS_*), then brand name. */
export function sellerDetails(s: SiteSettings, brand: string) {
  const b = s.business;
  // Rate saved with an admin-entered GSTIN wins; otherwise env, then 18%.
  const rate = b.gstin ? Number(b.gst_rate) : Number(process.env.GST_RATE_PERCENT ?? 18);
  return {
    name: b.legal_name || process.env.BUSINESS_LEGAL_NAME || brand,
    address: b.address || process.env.BUSINESS_ADDRESS || '',
    gstin: b.gstin || process.env.BUSINESS_GSTIN || '',
    rate: Number.isFinite(rate) ? rate : 18,
    supportEmail: b.support_email || '',
  };
}

/** Social links: admin settings first, then NEXT_PUBLIC_SOCIAL_* env. */
export function socialLinks(s: SiteSettings): Record<keyof SiteSettings['social'], string> {
  const x = s.social;
  return {
    instagram: x.instagram || process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || '',
    youtube: x.youtube || process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE || '',
    x: x.x || process.env.NEXT_PUBLIC_SOCIAL_X || '',
    facebook: x.facebook || process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK || '',
    pinterest: x.pinterest || process.env.NEXT_PUBLIC_SOCIAL_PINTEREST || '',
  };
}
