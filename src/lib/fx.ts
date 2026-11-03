import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { clearSettingsCache } from '@/lib/settings';

const CURRENCIES = ['USD', 'GBP', 'EUR', 'AUD', 'CAD'] as const;
// Free, key-less ECB reference rates (European Central Bank via Frankfurter).
const SOURCES = ['https://api.frankfurter.dev/v1/latest', 'https://api.frankfurter.app/latest'];

/** ₹ per unit from an "INR base" response ({rates: {USD: 0.0119, ...}}). Rejects implausible values. */
export function parseRates(json: unknown): Record<string, number> | null {
  const rates = (json as { rates?: Record<string, unknown> } | null)?.rates;
  if (!rates) return null;
  const out: Record<string, number> = {};
  for (const c of CURRENCIES) {
    const per = Number(rates[c]);
    if (!Number.isFinite(per) || per <= 0) return null;
    const inr = Math.round((1 / per) * 100) / 100;
    if (inr < 10 || inr > 1000) return null; // sanity: every one of these is worth ₹10–₹1000
    out[c] = inr;
  }
  return out;
}

/** Fetch today's ECB rates and save them (keeps the old ones if every source fails). */
export async function refreshFxRates(): Promise<{ updated: boolean; rates?: Record<string, number>; source?: string; error?: string }> {
  for (const base of SOURCES) {
    try {
      const res = await fetch(`${base}?base=INR&symbols=${CURRENCIES.join(',')}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const json = (await res.json()) as { date?: string };
      const rates = parseRates(json);
      if (!rates) continue;
      const supabase = createServiceClient();
      const now = new Date().toISOString();
      await supabase.from('site_settings').upsert([
        { key: 'fx_to_inr', value: rates, updated_at: now },
        { key: 'fx_meta', value: { updated_at: now, source: `ECB reference rates ${json.date ?? ''}`.trim() }, updated_at: now },
      ]);
      clearSettingsCache();
      return { updated: true, rates, source: base };
    } catch {
      /* try the next source */
    }
  }
  return { updated: false, error: 'No rate source reachable — kept the previous rates.' };
}
