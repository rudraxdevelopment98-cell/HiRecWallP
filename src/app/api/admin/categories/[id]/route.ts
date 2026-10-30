import { deleteHandler, updateHandler } from '@/lib/admin-crud';
import { categorySchema } from '@/lib/admin-schemas';

export const runtime = 'nodejs';
export const PATCH = updateHandler('categories', categorySchema);
// Wallpapers in a deleted category simply become uncategorised.
export const DELETE = deleteHandler('categories');
