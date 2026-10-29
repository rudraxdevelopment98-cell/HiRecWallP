import { NextResponse } from 'next/server';
import { getUser, isAdminUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { ImageTooSmallError, generateVariants } from '@/lib/imaging';
import { readUpload } from '@/lib/uploads';
import { persistWallpaperAssets } from '@/lib/wallpaper-assets';
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
  const user = await getUser();
  if (!user || !(await isAdminUser())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const title = String(form.get('title') ?? '').trim();
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const slug = slugify(String(form.get('slug') ?? '') || title);
  const description = (form.get('description') as string | null) || null;
  const altText = (form.get('alt_text') as string | null) || null;
  const categoryId = (form.get('category_id') as string | null) || null;
  const isFree = ['1', 'true', 'on'].includes(String(form.get('is_free') ?? ''));
  const tags = String(form.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  let cleanup = async () => {};
  try {
    const upload = await readUpload(form, user.id);
    if (!upload) return NextResponse.json({ error: 'An image file is required' }, { status: 400 });
    cleanup = upload.cleanup;
    const brand = serverEnv().BRAND_NAME;
    const original = upload.buffer;
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

    await persistWallpaperAssets(supabase, wallpaper.id, original, variants);

    return NextResponse.json({ ok: true, wallpaperId: wallpaper.id, slug, variants: variants.map((v) => v.variant) });
  } catch (err) {
    if (err instanceof ImageTooSmallError) {
      return NextResponse.json({ error: `${err.message}. Use at least 3840px on the long edge.` }, { status: 422 });
    }
    return NextResponse.json({ error: 'Upload/processing failed (R2 configured?)' }, { status: 503 });
  } finally {
    await cleanup();
  }
}
