'use client';

import { useRouter } from 'next/navigation';
import { REGION_CODES, type RegionCode } from '@/lib/geo';

const LABELS: Record<RegionCode, string> = {
  IN: '🇮🇳 India (₹)',
  T1: '🌍 Tier 1 (credits)',
  T2: '🌍 Tier 2 (credits)',
  T3: '🌍 Rest of world (credits)',
};

/** Lets a visitor override the IP-detected display region. */
export function RegionSwitcher({ current }: { current: RegionCode }) {
  const router = useRouter();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    // 30-day cookie, matching the middleware default.
    document.cookie = `region=${value}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    router.refresh();
  }

  return (
    <label className="sr-only-label">
      <span className="sr-only">Region</span>
      <select
        aria-label="Change region"
        defaultValue={current}
        onChange={onChange}
        className="rounded-md border bg-background px-2 py-1 text-sm"
      >
        {REGION_CODES.map((code) => (
          <option key={code} value={code}>
            {LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
