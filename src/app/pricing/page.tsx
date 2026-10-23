import type { Metadata } from 'next';
import { REGION_PRICING_UNIT } from '@/lib/geo';
import { formatMoneyMinor } from '@/lib/format';
import { getDisplayRegion, listCreditPacks } from '@/lib/catalogue';

export const metadata: Metadata = {
  title: 'Pricing & credits',
  description: 'Credit packs for international buyers; per-item INR pricing in India.',
};

export default async function PricingPage() {
  const region = getDisplayRegion();
  const isMoney = REGION_PRICING_UNIT[region] === 'money';
  const packs = await listCreditPacks(region);

  return (
    <main className="container space-y-8 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Pricing</h1>
        <p className="text-sm text-muted-foreground">
          In India, pay per wallpaper in ₹ via UPI. Elsewhere, buy credits and spend them to
          unlock wallpapers.
        </p>
      </div>

      {isMoney ? (
        <div className="rounded-lg border p-6">
          <h2 className="text-lg font-medium">Per-wallpaper pricing (India)</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Each wallpaper is priced individually (₹9–₹99) and paid at checkout via Razorpay UPI.
            Festival packs are sold as fixed-price bundles.
          </p>
        </div>
      ) : packs.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {packs.map((pack) => (
            <div key={pack.id} className="rounded-lg border p-6 text-center">
              <p className="text-3xl font-semibold">{pack.credits}</p>
              <p className="text-sm text-muted-foreground">credits</p>
              <p className="mt-4 text-lg font-medium">
                {formatMoneyMinor(pack.amount_minor, pack.currency)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Credit packs appear here once the database is seeded.
        </p>
      )}
    </main>
  );
}
