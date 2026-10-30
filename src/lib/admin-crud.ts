import 'server-only';

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import type { ZodTypeAny } from 'zod';
import { adminGuard } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';

const UUID = /^[0-9a-f-]{36}$/i;

/** POST handler: validate + insert into `table`. */
export function createHandler(table: string, schema: ZodTypeAny) {
  return async (request: Request) => {
    const denied = await adminGuard(request);
    if (denied) return denied;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
    const { error } = await createServiceClient().from(table).insert(parsed.data as Record<string, unknown>);
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'That already exists (duplicate slug/name?)' : 'Could not create' }, { status: 400 });
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true });
  };
}

/** PATCH handler: validate + update `table` row by `idColumn`. */
export function updateHandler(table: string, schema: ZodTypeAny, idColumn = 'id') {
  return async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const params = await ctx.params;
    const denied = await adminGuard(request);
    if (denied) return denied;
    if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
    const { error } = await createServiceClient().from(table).update(parsed.data as Record<string, unknown>).eq(idColumn, params.id);
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'That slug/name is taken' : 'Could not save' }, { status: 400 });
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true });
  };
}

/**
 * DELETE handler. If `inUse` reports the row is referenced (e.g. already
 * sold), it's deactivated via `fallback` instead of deleted, when given.
 */
export function deleteHandler(
  table: string,
  inUse?: (id: string) => Promise<boolean>,
  fallback?: Record<string, unknown>,
) {
  return async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const params = await ctx.params;
    const denied = await adminGuard(request);
    if (denied) return denied;
    if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const supabase = createServiceClient();
    if (inUse && (await inUse(params.id))) {
      if (!fallback) return NextResponse.json({ error: 'In use — cannot delete' }, { status: 409 });
      await supabase.from(table).update(fallback).eq('id', params.id);
      revalidatePath('/', 'layout');
      return NextResponse.json({ ok: true, deactivated: true });
    }
    const { error } = await supabase.from(table).delete().eq('id', params.id);
    if (error) return NextResponse.json({ error: 'Could not delete' }, { status: 400 });
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true });
  };
}

export async function referenced(table: string, column: string, id: string): Promise<boolean> {
  const { count } = await createServiceClient().from(table).select(column, { count: 'exact', head: true }).eq(column, id);
  return (count ?? 0) > 0;
}
