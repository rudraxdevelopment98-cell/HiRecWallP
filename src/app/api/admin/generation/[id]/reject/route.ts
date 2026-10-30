import { NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  if (!(await isAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('generation_jobs')
      .update({ status: 'rejected' })
      .eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Reject failed' }, { status: 503 });
  }
}
