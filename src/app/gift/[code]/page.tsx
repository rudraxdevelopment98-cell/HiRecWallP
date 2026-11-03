import type { Metadata } from 'next';
import { Gift } from 'lucide-react';
import { getUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { GIFT_CODE, normaliseGiftCode } from '@/lib/gift-rules';
import { RedeemForm } from '@/components/gift/redeem-form';

export const metadata: Metadata = { title: 'You’ve got a gift', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Gift summary for a code, or null (bad code, unknown code, or database unavailable). */
async function findGift(code: string) {
  if (!GIFT_CODE.test(code)) return null;
  try {
    const { data } = await createServiceClient()
      .from('gift_codes')
      .select('from_name, message, credits, bonus_credits, status, expires_at')
      .eq('code', code)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

export default async function GiftCodePage(props: { params: Promise<{ code: string }> }) {
  const code = normaliseGiftCode((await props.params).code);
  const [user, gift] = await Promise.all([
    getUser(),
    findGift(code),
  ]);
  const total = gift ? Number(gift.credits) + Number(gift.bonus_credits ?? 0) : 0;

  return (
    <main className="container flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <Gift className="h-10 w-10" />
      {gift ? (
        <>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {(gift.from_name as string | null) ?? 'A friend'} sent you {total} credits
          </h1>
          <p className="text-sm text-muted-foreground">That&rsquo;s {total} ultra-HD wallpapers, in every size.</p>
          {gift.message && <blockquote className="w-full rounded-xl border bg-card p-4 text-left text-sm italic">{gift.message as string}</blockquote>}
          {gift.status !== 'pending' ? (
            <p className="text-sm text-muted-foreground">This gift has already been {gift.status === 'void' ? 'cancelled' : 'redeemed'}.</p>
          ) : (
            <div className="w-full rounded-2xl border bg-card p-6 text-left">
              <RedeemForm initialCode={code} signedIn={Boolean(user)} />
            </div>
          )}
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Gift not found</h1>
          <p className="text-sm text-muted-foreground">Check the link or enter the code by hand.</p>
          <div className="w-full rounded-2xl border bg-card p-6 text-left">
            <RedeemForm signedIn={Boolean(user)} />
          </div>
        </>
      )}
    </main>
  );
}
