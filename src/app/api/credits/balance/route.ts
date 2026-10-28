import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The signed-in user's credit balance. */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('my_credit_balance');
    if (error) throw error;
    return NextResponse.json({ balance: Number(data ?? 0) });
  } catch {
    return NextResponse.json({ error: 'Balance unavailable' }, { status: 503 });
  }
}
