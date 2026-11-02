import 'server-only';

import crypto from 'node:crypto';
import { deleteObject, getObject, storage } from '@/lib/storage';

/** Largest original the active storage accepts (R2 150 MB, Supabase free 50 MB). */
export const maxUploadBytes = () => storage().maxUploadBytes;

export const UPLOAD_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/tiff': 'tif',
};

export function incomingKeyFor(userId: string, contentType: string): string {
  return `incoming/${userId}/${crypto.randomUUID()}.${UPLOAD_TYPES[contentType] ?? 'bin'}`;
}

export interface StagedUpload {
  buffer: Buffer;
  contentType: string;
  /** Call after processing to remove the staged object (if any). */
  cleanup: () => Promise<void>;
}

/**
 * The uploaded original from a form: either a direct `file` (small files,
 * local dev) or an `incomingKey` the browser already PUT to R2 via a presigned
 * URL. Staged keys must belong to the caller.
 */
export async function readUpload(form: FormData, userId: string): Promise<StagedUpload | null> {
  const file = form.get('file');
  if (file instanceof File && file.size > 0) {
    return {
      buffer: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || 'image/jpeg',
      cleanup: async () => {},
    };
  }
  const key = String(form.get('incomingKey') ?? '');
  if (!key.startsWith(`incoming/${userId}/`) || key.includes('..')) return null;
  const buffer = await getObject('private', key);
  const ext = key.split('.').pop() ?? '';
  const contentType = Object.entries(UPLOAD_TYPES).find(([, e]) => e === ext)?.[0] ?? 'image/jpeg';
  return {
    buffer,
    contentType,
    cleanup: () => deleteObject('private', key).catch(() => {}),
  };
}
