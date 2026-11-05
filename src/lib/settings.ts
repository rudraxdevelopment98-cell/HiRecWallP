import 'server-only';

import { createClient as createSupabase } from '@supabase/supabase-js';
import type { RegionCode } from '@/lib/geo';
import { DEFAULT_TAX, type TaxSettings } from '@/lib/tax';

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
  /** Welcome bonus + referrals (all bonus credits; Admin → Settings → Growth). */
  growth: {
    welcome_credits: number;
    welcome_days: number;
    referral_enabled: boolean;
    referee_bonus: number;
    referrer_reward: number;
    referral_monthly_cap: number;
    reward_days: number;
    /** Extra bonus credits on an account's first paid order (0 = off). */
    first_purchase_bonus: number;
    gifts_enabled: boolean;
    affiliate_enabled: boolean;
    /** % of the order paid to the creator who sent the buyer. */
    affiliate_pct: number;
    daily_enabled: boolean;
    /** Max daily-wallpaper emails per day (Resend free plan: 100/day). */
    daily_email_cap: number;
  };
  /** Rupees per unit of other currencies (auto-updated monthly from ECB rates; editable). */
  fx_to_inr: Record<string, number>;
  /** When/where the rates came from. */
  fx_meta: { updated_at: string | null; source: string };
  /** Legal contacts shown on policy pages (Consumer Protection (E-Commerce) Rules 2020). */
  legal: { grievance_name: string; grievance_designation: string; grievance_email: string; grievance_phone: string; jurisdiction_city: string };
  /** GST / TDS / income-tax switches and rates (Admin → Tax centre). */
  tax: TaxSettings;
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
  growth: {
    welcome_credits: 10,
    welcome_days: 30,
    referral_enabled: true,
    referee_bonus: 10,
    referrer_reward: 20,
    referral_monthly_cap: 20,
    reward_days: 365,
    first_purchase_bonus: 5,
    gifts_enabled: true,
    affiliate_enabled: true,
    affiliate_pct: 10,
    daily_enabled: true,
    daily_email_cap: 90,
  },
  fx_to_inr: { USD: 84, GBP: 107, EUR: 91, AUD: 55, CAD: 61 },
  fx_meta: { updated_at: null, source: 'default' },
  tax: DEFAULT_TAX,
  legal: { grievance_name: '', grievance_designation: 'Grievance Officer', grievance_email: '', grievance_phone: '', jurisdiction_city: '' },
};

export type SettingKey = keyof SiteSettings;
export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

let cache: { at: number; value: SiteSettings } | null = null;

/**
 * Read settings, cached ~30 s per instance. Server-side it uses the service
 * key, because private keys (tax details, tier overrides) aren't publicly
 * readable (migration 0024); without it, the public subset is read.
 */
export async function getSettings(): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return DEFAULT_SETTINGS;
  try {
    const { data, error } = await createSupabase(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
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
    value.growth = { ...DEFAULT_SETTINGS.growth, ...(value.growth ?? {}) };
    value.fx_to_inr = { ...DEFAULT_SETTINGS.fx_to_inr, ...(value.fx_to_inr ?? {}) };
    value.fx_meta = { ...DEFAULT_SETTINGS.fx_meta, ...(value.fx_meta ?? {}) };
    value.tax = { ...DEFAULT_TAX, ...(value.tax ?? {}) };
    value.legal = { ...DEFAULT_SETTINGS.legal, ...(value.legal ?? {}) };
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
