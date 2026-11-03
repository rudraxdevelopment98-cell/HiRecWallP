import { createHandler } from '@/lib/admin-crud';
import { planPriceSchema } from '@/lib/admin-schemas';

export const runtime = 'nodejs';
export const POST = createHandler('plan_prices', planPriceSchema);
