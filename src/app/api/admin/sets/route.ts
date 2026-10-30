import { createHandler } from '@/lib/admin-crud';
import { setSchema } from '@/lib/admin-schemas';

export const runtime = 'nodejs';
export const POST = createHandler('wallpaper_sets', setSchema);
