import { NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { generateVariants } from '@/lib/imaging';
import { putObject } from '@/lib/r2';
import { isSameOrigin } from '@/lib/http';
import { serverEnv } from '@/lib/env';

export const runtime = 'nodejs';
// Image processing of large originals can take a while.
export const maxDuration = 60;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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

  const slug = slugify(String(form.get('slug') ?? '') || title);
  const description = (form.get('description') as string | null) || null;
  const altText = (form.get('alt_text') as string | null) || null;
  const categoryId = (form.get('category_id') as string | null) || null;
  const isFree = ['1', 'true', 'on'].includes(String(form.get('is_free') ?? ''));
  const tags = String(form.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  try {
    const brand = serverEnv().BRAND_NAME;
    const original = Buffer.from(await file.arrayBuffer());
    const variants = await generateVariants(original, brand);

    const supabase = createServiceClient();
    const { data: wallpaper, error: wErr } = await supabase
      .from('wallpapers')
      .insert({
        slug,
        title,
        description,
        alt_text: altText,
        category_id: categoryId,
        tags,
        is_free: isFree,
        status: 'draft',
        is_ai_generated: true,
      })
      .select('id')
      .single();
    if (wErr || !wallpaper) {
      return NextResponse.json({ error: 'Could not create wallpaper (slug taken?)' }, { status: 400 });
    }

    // Keep the untouched original in the private bucket for safekeeping.
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
      });
    }

    return NextResponse.json({ ok: true, wallpaperId: wallpaper.id, slug });
  } catch {
    return NextResponse.json({ error: 'Upload/processing failed (R2 configured?)' }, { status: 503 });
  }
}
