import { NextResponse } from 'next/server';
import { getUser, isAdminUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { ImageTooSmallError, generateVariants } from '@/lib/imaging';
import { readUpload } from '@/lib/uploads';
import { persistWallpaperAssets } from '@/lib/wallpaper-assets';
import { isSameOrigin } from '@/lib/http';
import { serverEnv } from '@/lib/env';
import { dHash } from '@/lib/phash';
import { openImage } from '@/lib/image-safety';
import { findDuplicate, titleFromFilename, uniqueSlug } from '@/lib/duplicates';
import { getVisionProvider } from '@/lib/ai';
import { wallpaperPath } from '@/lib/wallpaper-url';
import { audit } from '@/lib/admin';
import { prepareOriginal, tooSmallMessage } from '@/lib/upscale';

export const runtime = 'nodejs';
// Image processing (and the optional AI description) of large originals takes a while.
export const maxDuration = 120;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 70);
}

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? '').trim().slice(0, max);

/**
 * Admin upload (one file per request; the batch uploader queues many).
 * 1. Near-duplicate check against the catalogue (409 with the match unless `force`).
 * 2. Sizes, previews and watermarks.
 * 3. Missing title/description/tags/alt text/category filled by the vision
 *    provider when `auto` is on (Claude when configured; file name otherwise).
 * Creates a draft; publishing happens from the drafts grid or catalogue.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user || !(await isAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const auto = ['1', 'true', 'on'].includes(String(form.get('auto') ?? ''));
  const force = ['1', 'true'].includes(String(form.get('force') ?? ''));
  const filename = text(form, 'filename', 200);
  let title = text(form, 'title', 120);
  if (!title && !auto && !filename) return NextResponse.json({ error: 'title is required' }, { status: 400 });
  let description = text(form, 'description', 1000) || null;
  let altText = text(form, 'alt_text', 300) || null;
  let categoryId = text(form, 'category_id', 64) || null;
  const isFree = ['1', 'true', 'on'].includes(String(form.get('is_free') ?? ''));
  let tags = text(form, 'tags', 500)
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  let cleanup = async () => {};
  let keepStaged = false;
  try {
    const upload = await readUpload(form, user.id);
    if (!upload) return NextResponse.json({ error: 'An image file is required' }, { status: 400 });
    cleanup = upload.cleanup;
    const original = upload.buffer;
    const meta = await openImage(original).metadata();

    // 1) Duplicate check on the clean original.
    const phash = await dHash(original);
    if (!force) {
      const dup = await findDuplicate(phash);
      if (dup) {
        keepStaged = true; // "Upload anyway" re-submits the same staged file.
        return NextResponse.json(
          {
            error: `Looks like “${dup.title}” (${dup.status}).`,
            code: 'duplicate',
            duplicate: { ...dup, href: `/admin/catalogue/${dup.id}`, publicHref: wallpaperPath(dup) },
          },
          { status: 409 },
        );
      }
    }

    // 2) Sizes, previews, watermarks (throws when too small). Slightly small art is
    //    upscaled first when a real AI upscaler is configured.
    const prepared = await prepareOriginal(original);
    const variants = await generateVariants(prepared.buffer, serverEnv().BRAND_NAME);

    // 3) Metadata: what the admin typed wins; AI (or the file name) fills the rest.
    const supabase = createServiceClient();
    let aiFilled = false;
    if (auto && (!title || !description || !tags.length || !altText || !categoryId)) {
      const { data: cats } = await supabase.from('categories').select('id, name').order('sort_order');
      const vision = getVisionProvider();
      try {
        const s = await vision.describe(original, {
          prompt: filename ? titleFromFilename(filename) : title,
          niche: 'wallpaper',
          categories: (cats ?? []).map((c) => ({ id: c.id as string, name: c.name as string })),
        });
        const real = vision.id !== 'mock';
        if (!title) title = real ? s.title : titleFromFilename(filename);
        if (!description && real) description = s.description;
        if (!altText) altText = real ? s.altText : title;
        if (!tags.length) tags = s.tags;
        if (!categoryId && s.categoryId) categoryId = s.categoryId;
        aiFilled = real;
      } catch (err) {
        console.error('[upload] AI describe failed; using the file name', err);
      }
    }
    if (!title) title = titleFromFilename(filename);

    const slug = await uniqueSlug(slugify(text(form, 'slug', 80) || title));
    const { data: wallpaper, error: wErr } = await supabase
      .from('wallpapers')
      .insert({
        slug,
        title,
        description,
        alt_text: altText || title,
        category_id: categoryId,
        tags,
        is_free: isFree,
        status: 'draft',
        is_ai_generated: true,
        phash,
        source_width: prepared.width || meta.width || null,
        source_height: prepared.height || meta.height || null,
        upscaled_from: prepared.upscaledFrom,
        ai_filled: aiFilled,
      })
      .select('id, code')
      .single();
    if (wErr || !wallpaper) {
      return NextResponse.json({ error: 'Could not create the wallpaper record' }, { status: 400 });
    }

    await persistWallpaperAssets(supabase, wallpaper.id, prepared.buffer, variants);
    await audit('wallpaper.upload', 'wallpaper', wallpaper.id, { title, forced: force, aiFilled, upscaledFrom: prepared.upscaledFrom });

    return NextResponse.json({
      ok: true,
      wallpaperId: wallpaper.id,
      slug,
      title,
      categoryId,
      tags,
      aiFilled,
      href: `/admin/catalogue/${wallpaper.id}`,
      variants: variants.map((v) => v.variant),
    });
  } catch (err) {
    if (err instanceof ImageTooSmallError) {
      return NextResponse.json({ error: tooSmallMessage(err.message), code: 'too_small' }, { status: 422 });
    }
    console.error('[upload] failed', err);
    return NextResponse.json({ error: 'Upload/processing failed — check storage in System health' }, { status: 503 });
  } finally {
    if (!keepStaged) await cleanup();
  }
}
