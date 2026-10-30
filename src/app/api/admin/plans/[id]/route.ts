import { deleteHandler, referenced, updateHandler } from '@/lib/admin-crud';
import { planSchema } from '@/lib/admin-schemas';

export const runtime = 'nodejs';
export const PATCH = updateHandler('membership_plans', planSchema);
// Sold plans are switched off instead of deleted (members keep their passes).
export const DELETE = deleteHandler('membership_plans', (id) => referenced('memberships', 'plan_id', id), { active: false });
