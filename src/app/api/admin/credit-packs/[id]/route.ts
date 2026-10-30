import { deleteHandler, referenced, updateHandler } from '@/lib/admin-crud';
import { packSchema } from '@/lib/admin-schemas';

export const runtime = 'nodejs';
export const PATCH = updateHandler('credit_packs', packSchema);
export const DELETE = deleteHandler('credit_packs', (id) => referenced('order_items', 'credit_pack_id', id), { active: false });
