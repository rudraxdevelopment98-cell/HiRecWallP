import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getUser, isAdminUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { audit } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';
import { ImageTooSmallError, generateVariants } from '@/lib/imaging';
import { readUpload } from '@/lib/uploads';
import { persistWallpaperAssets } from '@/lib/wallpaper-assets';
import { deleteObject, getObject, objectExists, type R2Bucket } from '@/lib/storage';
import { dHash } from '@/lib/phash';
import { prepareOriginal, tooSmallMessage } from '@/lib/upscale';
import { deleteFitCache } from '@/lib/fit-server';
import { findDuplicate } from '@/lib/duplicates';
import { wallpaperPath } from '@/lib/wallpaper-url';
import { serverEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Replace a wallpaper's image (`mode=replace` + a staged upload) or rebuild all
 * sizes from the stored master (`mode=regenerate`). The wallpaper keeps its id,
 * URL, prices and buyers; old size files and cached watermarked copies are removed.
 */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user || !(await isAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }
  const mode = form.get('mode') === 'regenerate' ? 'regenerate' : 'replace';
  const force = form.get('force') === '1';

  const s = createServiceClient();
  const { data: w } = await s.from('wallpapers').select('id, slug, code').eq('id', id).maybeSingle();
  if (!w) return NextResponse.json({ error: 'Wallpaper not found' }, { status: 404 });

  let cleanup = async () => {};
  let keepStaged = false;
  try {
    let original: Buffer;
    if (mode === 'replace') {
      const upload = await readUpload(form, user.id);
      if (!upload) return NextResponse.json({ error: 'Choose the new image' }, { status: 400 });
      cleanup = upload.cleanup;
      original = upload.buffer;
    } else {
      const key = (await objectExists('private', `wallpapers/${id}/master.jpg`)) ? `wallpapers/${id}/master.jpg` : null;
      if (!key) return NextResponse.json({ error: 'No stored master for this wallpaper — use Replace image.' }, { status: 409 });
      original = await getObject('private', key);
    }

    const phash = await dHash(original);
    if (mode === 'replace' && !force) {
      const dup = await findDuplicate(phash, id);
      if (dup) {
        keepStaged = true;
        return NextResponse.json({ error: `This image looks like “${dup.title}”.`, code: 'duplicate', duplicate: { ...dup, href: `/admin/catalogue/${dup.id}` } }, { status: 409 });
      }
    }

    const prepared = await prepareOriginal(original);
    const variants = await generateVariants(prepared.buffer, serverEnv().BRAND_NAME);

    // Drop the old size rows/files, then store the new set (same key layout).
    const { data: old } = await s.from('wallpaper_assets').select('id, variant, storage_bucket, storage_key').eq('wallpaper_id', id);
    const keep = new Set(variants.map((v) => `wallpapers/${id}/${v.variant}.${v.ext}`));
    await s.from('wallpaper_assets').delete().eq('wallpaper_id', id);
    for (const a of old ?? []) {
      if (!keep.has(a.storage_key as string)) await deleteObject(a.storage_bucket as R2Bucket, a.storage_key as string).catch(() => undefined);
    }
    await persistWallpaperAssets(s, id, prepared.buffer, variants);
    await s.from('wallpapers').update({ phash, source_width: prepared.width || null, source_height: prepared.height || null, upscaled_from: prepared.upscaledFrom }).eq('id', id);

    // Buyers' cached watermarked copies were made from the old image.
    const { data: ents } = await s.from('entitlements').select('id').eq('wallpaper_id', id);
    for (const e of ents ?? []) {
      for (const v of old ?? []) await deleteObject('private', `wm/${e.id}/${v.variant}.jpg`).catch(() => undefined);
    }
    // Exact-fit crops (and their watermarked copies) are made on demand again from the new master.
    await deleteFitCache(s, id, (ents ?? []).map((e) => e.id as string));

    for (const p of ['/', '/explore', '/admin/catalogue', `/admin/catalogue/${id}`, wallpaperPath({ slug: w.slug as string, code: w.code as string | null })]) revalidatePath(p);
    await audit(mode === 'replace' ? 'wallpaper.replace_image' : 'wallpaper.regenerate', 'wallpaper', id, { variants: variants.map((v) => v.variant), forced: force });
    return NextResponse.json({ ok: true, variants: variants.map((v) => v.variant) });
  } catch (err) {
    if (err instanceof ImageTooSmallError) return NextResponse.json({ error: tooSmallMessage(err.message) }, { status: 422 });
    console.error('[media] failed', err);
    return NextResponse.json({ error: 'Processing failed — check storage in System health' }, { status: 503 });
  } finally {
    if (!keepStaged) await cleanup();
  }
}
