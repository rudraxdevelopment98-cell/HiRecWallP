import 'server-only';

import { r2Configured, r2Provider } from './r2';
import { supabaseProvider } from './supabase';
import type { Bucket, StorageProvider } from './types';

export type { Bucket, StorageProvider } from './types';
/** @deprecated alias kept for older imports */
export type R2Bucket = Bucket;

/**
 * The active storage provider: STORAGE_PROVIDER if set, else R2 when its env
 * vars are complete, else Supabase Storage (works with no extra setup).
 */
export function storage(): StorageProvider {
  const pick = process.env.STORAGE_PROVIDER;
  if (pick === 'r2') return r2Provider;
  if (pick === 'supabase') return supabaseProvider;
  return r2Configured() ? r2Provider : supabaseProvider;
}

export const publicObjectUrl = (key: string) => storage().publicUrl(key);

// Function-style API used across the app.
export const putObject = (bucket: Bucket, key: string, body: Buffer, contentType: string) =>
  storage().put(bucket, key, body, contentType);
export const getObject = (bucket: Bucket, key: string) => storage().get(bucket, key);
export const objectExists = (bucket: Bucket, key: string) => storage().exists(bucket, key);
export const deleteObject = (bucket: Bucket, key: string) => storage().remove(bucket, key);
/** Short-lived GET URL. `expiresIn` seconds (default 60, clamped 1–600). */
export const presignedGetUrl = (bucket: Bucket, key: string, expiresIn = 60) =>
  storage().signedGetUrl(bucket, key, Math.min(Math.max(expiresIn, 1), 600));
export const presignedPutUrl = (key: string, contentType: string, contentLength: number) =>
  storage().signedPutUrl(key, contentType, contentLength);
export const applyStorageRules = (allowedOrigins: string[]) => storage().applyRules(allowedOrigins);
