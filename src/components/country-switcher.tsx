'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { allCountries } from '@/lib/geo';

/**
 * Shows the auto-detected country and lets a visitor change it. Prices follow
 * the country; checkout still checks the billing country.
 */
export function CountrySwitcher({ current }: { current: string | null }) {
  const router = useRouter();
  const countries = useMemo(() => allCountries(), []);

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    const age = 60 * 60 * 24 * 30;
    document.cookie = `country=${value}; path=/; max-age=${age}; samesite=lax`;
    document.cookie = `region=; path=/; max-age=0`;
    router.refresh();
  }

  return (
    <label className="inline-flex items-center gap-1 text-sm">
      <span className="sr-only">Country</span>
      <span aria-hidden>🌐</span>
      <select
        aria-label="Change country"
        defaultValue={current ?? ''}
        onChange={onChange}
        className="max-w-[9.5rem] rounded-md border bg-background px-2 py-1 text-sm"
      >
        {!current && <option value="">Choose country</option>}
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
