import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser, isAdminUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { presignedPutUrl } from '@/lib/storage';
import { UPLOAD_TYPES, incomingKeyFor, maxUploadBytes } from '@/lib/uploads';

export const runtime = 'nodejs';

const schema = z.object({
  contentType: z.string().refine((t) => t in UPLOAD_TYPES, 'unsupported image type'),
  size: z.number().int().positive(),
});

/**
 * Presigned PUT URL so admins and onboarded creators can upload large
 * originals straight to the private bucket. The object lands under
 * incoming/<userId>/ and is processed by the upload route afterwards.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  const max = maxUploadBytes();
  if (!parsed.success || parsed.data.size > max) {
    return NextResponse.json(
      { error: `Unsupported file — JPEG, PNG, WebP, AVIF or TIFF up to ${Math.round(max / 1048576)} MB. (Tip: save very large PNGs as high-quality JPEG.)` },
      { status: 400 },
    );
  }

  let allowed = await isAdminUser();
  if (!allowed) {
    const { data: creator } = await createServiceClient()
      .from('creators')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    allowed = Boolean(creator);
  }
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const key = incomingKeyFor(user.id, parsed.data.contentType);
    const url = await presignedPutUrl(key, parsed.data.contentType, parsed.data.size);
    return NextResponse.json({ key, url });
  } catch {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
  }
}
