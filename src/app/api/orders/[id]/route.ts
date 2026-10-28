import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Status of one of the signed-in user's orders (RLS limits it to their own). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
  }
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('orders')
      .select('id, status, currency, amount_minor, created_at')
      .eq('id', params.id)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
