import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminGuard, audit } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';
import { publishWallpapers } from '@/lib/publish';

export const runtime = 'nodejs';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('publish'), ids: z.array(z.string().uuid()).min(1).max(500) }),
  z.object({ action: z.literal('unpublish'), ids: z.array(z.string().uuid()).min(1).max(500) }),
  z.object({ action: z.literal('archive'), ids: z.array(z.string().uuid()).min(1).max(500) }),
  z.object({ action: z.literal('free'), ids: z.array(z.string().uuid()).min(1).max(500), value: z.boolean() }),
  z.object({ action: z.literal('category'), ids: z.array(z.string().uuid()).min(1).max(500), categoryId: z.string().uuid().nullable() }),
]);

/** Admin: apply one action to many wallpapers. */
export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  const a = parsed.data;
  const supabase = createServiceClient();

  let changed = 0;
  if (a.action === 'publish') {
    changed = await publishWallpapers(a.ids);
  } else {
    const update =
      a.action === 'unpublish'
        ? { status: 'draft' }
        : a.action === 'archive'
          ? { status: 'archived' }
          : a.action === 'free'
            ? { is_free: a.value }
            : { category_id: a.categoryId };
    const { data, error } = await supabase.from('wallpapers').update(update).in('id', a.ids).select('id');
    if (error) return NextResponse.json({ error: 'Could not update' }, { status: 400 });
    changed = data?.length ?? 0;
    for (const p of ['/', '/explore', '/free']) revalidatePath(p);
  }
  await audit(`wallpapers.bulk.${a.action}`, 'wallpaper', null, { count: a.ids.length, ...('categoryId' in a ? { categoryId: a.categoryId } : {}), ...('value' in a ? { value: a.value } : {}) });
  return NextResponse.json({ ok: true, changed });
}
