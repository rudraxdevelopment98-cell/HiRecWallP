import { createHandler } from '@/lib/admin-crud';
import { categorySchema } from '@/lib/admin-schemas';

export const runtime = 'nodejs';
export const POST = createHandler('categories', categorySchema);
