import { deleteHandler, referenced, updateHandler } from '@/lib/admin-crud';
import { planPriceSchema } from '@/lib/admin-schemas';

export const runtime = 'nodejs';
export const PATCH = updateHandler('plan_prices', planPriceSchema);
// Prices with subscriptions on them are switched off instead of deleted.
export const DELETE = deleteHandler('plan_prices', (id) => referenced('subscriptions', 'plan_price_id', id), { active: false });
