import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { getPayoutProvider } from '@/lib/payouts';

export const runtime = 'nodejs';

const schema = z.object({
  displayName: z.string().min(2).max(80),
  payoutProvider: z.enum(['razorpay_route', 'paypal_payouts']),
  payoutAccountId: z.string().min(2).max(128),
  acceptAgreement: z.literal(true),
});

/**
 * Creator onboarding: record the creators row, accept the agreement, start KYC
 * via the payout provider, and promote the profile to the `creator` role.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input (agreement must be accepted)' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const kyc = await getPayoutProvider(parsed.data.payoutProvider).startKyc({
      creatorId: user.id,
      accountId: parsed.data.payoutAccountId,
    });

    const { error } = await supabase.from('creators').upsert(
      {
        user_id: user.id,
        display_name: parsed.data.displayName,
        payout_provider: parsed.data.payoutProvider,
        payout_account_id: parsed.data.payoutAccountId,
        kyc_status: kyc.status,
        agreement_accepted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) throw error;

    await supabase.from('profiles').update({ role: 'creator' }).eq('id', user.id);

    return NextResponse.json({ ok: true, kycStatus: kyc.status, kycUrl: kyc.url ?? null });
  } catch {
    return NextResponse.json({ error: 'Onboarding unavailable' }, { status: 503 });
  }
}
