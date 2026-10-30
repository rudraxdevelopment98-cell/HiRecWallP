import 'server-only';

import { createClient as createSupabase } from '@supabase/supabase-js';

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
}

export const DEFAULT_SETTINGS: SiteSettings = {
  store_open: true,
  membership_enabled: false,
  creator_signups: true,
  free_downloads: true,
  newsletter_enabled: true,
  downloads_per_purchase: 5,
  announcement: { enabled: false, text: '', href: '' },
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
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return cache?.value ?? DEFAULT_SETTINGS;
  }
}

export function clearSettingsCache(): void {
  cache = null;
}
