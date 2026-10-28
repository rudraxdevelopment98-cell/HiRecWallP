import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { serverEnv } from '@/lib/env';
import { generateVariants } from '@/lib/imaging';
import { putObject } from '@/lib/r2';
import { dHash, isNearDuplicate } from '@/lib/phash';
import { getVisionProvider } from '@/lib/ai';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MIN_LONG_EDGE = 3840; // creator originals must be >= 4K on the long edge

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

/**
 * Creator upload with automated checks (resolution, pHash duplicate, vision
 * moderation for NSFW/trademark/real-people) + manual review: passing uploads
 * land as status=pending_review with creator_id set, for admin approval.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const supabase = createServiceClient();

  // Must be an onboarded creator.
  const { data: creator } = await supabase
    .from('creators')
    .select('user_id, kyc_status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!creator) return NextResponse.json({ error: 'Not a creator' }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }
  const file = form.get('file');
  const title = String(form.get('title') ?? '').trim();
  if (!(file instanceof File) || !title) {
    return NextResponse.json({ error: 'file and title are required' }, { status: 400 });
  }

  try {
    const original = Buffer.from(await file.arrayBuffer());

    // 1) Resolution check.
    const meta = await sharp(original).metadata();
    const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (longEdge < MIN_LONG_EDGE) {
      return NextResponse.json(
        { error: `Resolution too low: long edge ${longEdge}px, need >= ${MIN_LONG_EDGE}px` },
        { status: 422 },
      );
    }

    // 2) Content moderation (NSFW / trademark / real people).
    const moderation = await getVisionProvider().moderate(original, { title });
    if (!moderation.allowed) {
      return NextResponse.json({ error: 'Rejected by moderation', reasons: moderation.reasons }, { status: 422 });
    }

    // 3) Perceptual-hash duplicate check against existing assets.
    const phash = await dHash(original);
    const { data: existing } = await supabase
      .from('wallpaper_assets')
      .select('phash')
      .not('phash', 'is', null)
      .limit(2000);
    if ((existing ?? []).some((r) => r.phash && isNearDuplicate(r.phash as string, phash))) {
      return NextResponse.json({ error: 'Near-duplicate of an existing wallpaper' }, { status: 409 });
    }

    // Passed checks → derive variants and submit for manual review.
    const tags = String(form.get('tags') ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const slug = `${slugify(String(form.get('slug') ?? '') || title)}-${phash.slice(0, 6)}`;
    const brand = serverEnv().BRAND_NAME;
    const variants = await generateVariants(original, brand);

    const { data: wallpaper, error: wErr } = await supabase
      .from('wallpapers')
      .insert({
        slug,
        title,
        description: (form.get('description') as string | null) || null,
        alt_text: (form.get('alt_text') as string | null) || title,
        category_id: (form.get('category_id') as string | null) || null,
        tags,
        is_free: false,
        status: 'pending_review',
        creator_id: user.id,
        is_ai_generated: true,
        human_edited: true,
      })
      .select('id')
      .single();
    if (wErr || !wallpaper) {
      return NextResponse.json({ error: 'Could not create submission (slug taken?)' }, { status: 400 });
    }

    await putObject('private', `wallpapers/${wallpaper.id}/original`, original, file.type || 'image/jpeg');
    for (const v of variants) {
      const key = `wallpapers/${wallpaper.id}/${v.variant}.${v.ext}`;
      await putObject(v.bucket, key, v.buffer, v.contentType);
      await supabase.from('wallpaper_assets').insert({
        wallpaper_id: wallpaper.id,
        variant: v.variant,
        width: v.width,
        height: v.height,
        bytes: v.buffer.byteLength,
        storage_bucket: v.bucket,
        storage_key: key,
        phash: v.variant === 'preview' ? await dHash(v.buffer) : null,
      });
    }

    return NextResponse.json({ ok: true, wallpaperId: wallpaper.id, status: 'pending_review' });
  } catch {
    return NextResponse.json({ error: 'Upload failed (R2 configured?)' }, { status: 503 });
  }
}
