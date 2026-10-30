import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminGuard } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';
import { deleteObject, type R2Bucket } from '@/lib/r2';

export const runtime = 'nodejs';

const patch = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullable(),
    alt_text: z.string().trim().max(300).nullable(),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(30),
    category_id: z.string().uuid().nullable(),
    set_id: z.string().uuid().nullable(),
    is_free: z.boolean(),
    // Publishing goes through /api/admin/publish (it also seeds prices).
    status: z.enum(['draft', 'archived']),
  })
  .partial();

function refresh(slug?: string) {
  for (const p of ['/', '/explore', '/free', '/admin/catalogue']) revalidatePath(p);
  if (slug) revalidatePath(`/w/${slug}`);
}

/** Edit wallpaper details or unpublish/archive. */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await adminGuard(request);
  if (denied) return denied;
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(params.id)) {
    return NextResponse.json({ error: parsed.success ? 'Invalid id' : parsed.error.issues[0]?.message }, { status: 400 });
  }
  const { data, error } = await createServiceClient()
    .from('wallpapers')
    .update(parsed.data)
    .eq('id', params.id)
    .select('slug')
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Could not save' }, { status: 400 });
  refresh(data.slug as string);
  return NextResponse.json({ ok: true });
}

/**
 * Delete a wallpaper and its files. Refused once anyone has bought it —
 * buyers keep access, so archive it instead.
 */
export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await adminGuard(request);
  if (denied) return denied;
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const supabase = createServiceClient();
  const { count } = await supabase
    .from('entitlements')
    .select('id', { count: 'exact', head: true })
    .eq('wallpaper_id', params.id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Someone has bought this wallpaper — archive it instead so they keep access.' },
      { status: 409 },
    );
  }

  const { data: assets } = await supabase
    .from('wallpaper_assets')
    .select('storage_bucket, storage_key')
    .eq('wallpaper_id', params.id);
  const keys: [R2Bucket, string][] = [
    ...(assets ?? []).map((a) => [a.storage_bucket as R2Bucket, a.storage_key as string] as [R2Bucket, string]),
    ['private', `wallpapers/${params.id}/master.jpg`],
    ['private', `wallpapers/${params.id}/original`],
  ];
  await Promise.all(keys.map(([b, k]) => deleteObject(b, k).catch(() => {})));

  const { error } = await supabase.from('wallpapers').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Could not delete' }, { status: 400 });
  refresh();
  return NextResponse.json({ ok: true });
}
