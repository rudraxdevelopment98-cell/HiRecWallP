import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { getDisplayRegion } from '@/lib/catalogue';
import { REGION_PRICING_UNIT } from '@/lib/geo';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What the checkout page can do right now. `payments` is true only when both
 * Razorpay and Supabase are configured; otherwise the client runs the demo flow.
 * Never returns secret values, only booleans.
 */
export async function GET() {
  const e = process.env;
  const supabase = Boolean(e.NEXT_PUBLIC_SUPABASE_URL && e.NEXT_PUBLIC_SUPABASE_ANON_KEY && e.SUPABASE_SERVICE_ROLE_KEY);
  const paymentsKeys = Boolean(e.RAZORPAY_KEY_ID && e.RAZORPAY_KEY_SECRET);
  const user = supabase ? await getUser() : null;
  // Live check that the service key actually works (catches a mis-pasted key).
  let db = false;
  if (supabase) {
    try {
      const { error } = await createServiceClient().from('regions').select('code', { head: true, count: 'exact' });
      db = !error;
    } catch {
      db = false;
    }
  }
  const region = getDisplayRegion();
  const payments = supabase && db && paymentsKeys;
  return NextResponse.json({
    payments,
    auth: supabase,
    db,
    signedIn: Boolean(user),
    email: user?.email ?? null,
    region,
    unit: REGION_PRICING_UNIT[region],
  });
}
