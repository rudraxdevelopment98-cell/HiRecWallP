import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';
import { recordAcceptance } from '@/lib/consent';
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
  // Tax details for TDS on payouts (Income-tax Act 2025, s.393).
  taxResident: z.enum(['IN', 'foreign']).default('IN'),
  entityType: z.enum(['individual', 'huf', 'firm', 'company']).default('individual'),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .default('')
    .refine((v) => v === '' || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v), 'PAN looks like ABCDE1234F'),
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
    const issue = parsed.success ? null : parsed.error.issues.find((i) => i.path[0] === 'pan');
    return NextResponse.json({ error: issue?.message ?? 'Invalid input (agreement must be accepted)' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    if (!(await getSettings()).creator_signups) {
      const { data: existing } = await supabase.from('creators').select('user_id').eq('user_id', user.id).maybeSingle();
      if (!existing) return NextResponse.json({ error: 'Creator sign-ups are closed right now.' }, { status: 403 });
    }
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
        tax_resident: parsed.data.taxResident,
        entity_type: parsed.data.entityType,
        pan: parsed.data.taxResident === 'IN' && parsed.data.pan ? parsed.data.pan : null,
      },
      { onConflict: 'user_id' },
    );
    if (error) throw error;

    await supabase.from('profiles').update({ role: 'creator' }).eq('id', user.id);
    await recordAcceptance(user.id, ['creator'], 'creator_onboarding');

    return NextResponse.json({ ok: true, kycStatus: kyc.status, kycUrl: kyc.url ?? null });
  } catch {
    return NextResponse.json({ error: 'Onboarding unavailable' }, { status: 503 });
  }
}
