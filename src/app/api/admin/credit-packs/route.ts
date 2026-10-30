import { createHandler } from '@/lib/admin-crud';
import { packSchema } from '@/lib/admin-schemas';

export const runtime = 'nodejs';
export const POST = createHandler('credit_packs', packSchema);
