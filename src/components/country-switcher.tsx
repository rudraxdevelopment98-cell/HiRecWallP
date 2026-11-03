import Link from 'next/link';
import { countryName } from '@/lib/geo';

/**
 * Shows which country's prices apply. Not a picker: like Netflix and Spotify,
 * prices follow where you (and your account) are, so visitors can't choose a
 * cheaper country.
 */
export function CountrySwitcher({ current }: { current: string | null }) {
  return (
    <Link
      href="/faq#payments"
      title="Prices are set for your location and account"
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <span aria-hidden>🌐</span>
      <span className="max-w-[9rem] truncate">{current ? countryName(current) : 'Your region'}</span>
    </Link>
  );
}
