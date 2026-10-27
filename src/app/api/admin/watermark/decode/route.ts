import { NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { decodeWatermark, isWatermarkConfigured } from '@/lib/watermark';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Admin forensic tool: decode a (leaked) file back to its order id via the
 * watermark worker, then resolve the owning user for a takedown/ban decision.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  if (!(await isAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!isWatermarkConfigured()) {
    return NextResponse.json({ error: 'Watermark worker not configured' }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  const decoded = await decodeWatermark(Buffer.from(await file.arrayBuffer()));
  if (!decoded) return NextResponse.json({ error: 'Decode failed' }, { status: 502 });

  // Best-effort: resolve the order → buyer for the takedown record.
  let order: { user_id: string } | null = null;
  if (decoded.orderId) {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('orders')
      .select('user_id')
      .eq('id', decoded.orderId)
      .maybeSingle();
    order = data ?? null;
  }

  return NextResponse.json({ ...decoded, userId: order?.user_id ?? null });
}
