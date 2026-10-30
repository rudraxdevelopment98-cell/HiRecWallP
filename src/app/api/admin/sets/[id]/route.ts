import { deleteHandler, updateHandler } from '@/lib/admin-crud';
import { setSchema } from '@/lib/admin-schemas';

export const runtime = 'nodejs';
export const PATCH = updateHandler('wallpaper_sets', setSchema);
export const DELETE = deleteHandler('wallpaper_sets');
