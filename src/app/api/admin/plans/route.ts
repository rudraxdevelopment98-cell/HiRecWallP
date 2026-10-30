import { createHandler } from '@/lib/admin-crud';
import { planSchema } from '@/lib/admin-schemas';

export const runtime = 'nodejs';
export const POST = createHandler('membership_plans', planSchema);
