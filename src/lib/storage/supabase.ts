import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import type { Bucket, StorageProvider } from './types';

/**
 * Supabase Storage — the zero-setup default (uses the service-role key that's
 * already configured). Free plan: 1 GB storage, 50 MB per file, ~5 GB/month
 * egress. Switch to R2 by setting the R2_* env vars; nothing else changes.
 */
export const SUPABASE_BUCKETS: Record<Bucket, string> = {
  private: process.env.STORAGE_PRIVATE_BUCKET ?? 'wallpapers-private',
  public: process.env.STORAGE_PUBLIC_BUCKET ?? 'wallpapers-public',
};

const storage = () => createServiceClient().storage;

/** Temp prefixes and how long to keep them (mirrors the R2 lifecycle rules). */
const TEMP_RULES: { bucket: Bucket; prefix: string; days: number }[] = [
  { bucket: 'private', prefix: 'incoming', days: 1 },
  { bucket: 'private', prefix: 'wm', days: 7 },
  { bucket: 'private', prefix: 'generation', days: 45 },
  { bucket: 'public', prefix: 'generation', days: 45 },
];

export const supabaseProvider: StorageProvider = {
  id: 'supabase',
  maxUploadBytes: 50 * 1024 * 1024,

  publicUrl(key) {
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
    return `${base}/storage/v1/object/public/${SUPABASE_BUCKETS.public}/${key}`;
  },

  async put(bucket, key, body, contentType) {
    const { error } = await storage()
      .from(SUPABASE_BUCKETS[bucket])
      .upload(key, body, {
        contentType,
        upsert: true,
        cacheControl: bucket === 'public' ? '31536000' : '0',
      });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
  },

  async get(bucket, key) {
    const { data, error } = await storage().from(SUPABASE_BUCKETS[bucket]).download(key);
    if (error || !data) throw new Error(`Storage download failed: ${error?.message ?? 'not found'}`);
    return Buffer.from(await data.arrayBuffer());
  },

  async exists(bucket, key) {
    const { data } = await storage().from(SUPABASE_BUCKETS[bucket]).exists(key);
    return Boolean(data);
  },

  async remove(bucket, key) {
    await storage().from(SUPABASE_BUCKETS[bucket]).remove([key]);
  },

  async signedGetUrl(bucket, key, expiresIn) {
    const { data, error } = await storage().from(SUPABASE_BUCKETS[bucket]).createSignedUrl(key, expiresIn);
    if (error || !data) throw new Error(`Could not sign URL: ${error?.message}`);
    return data.signedUrl;
  },

  async signedPutUrl(key) {
    // Valid for 2 hours; the token is bound to this exact path.
    const { data, error } = await storage().from(SUPABASE_BUCKETS.private).createSignedUploadUrl(key);
    if (error || !data) throw new Error(`Could not sign upload: ${error?.message}`);
    return data.signedUrl;
  },

  async applyRules() {
    // Buckets are created by migration 0011 (or here, if missing).
    const s = storage();
    const { data: buckets } = await s.listBuckets();
    const have = new Set((buckets ?? []).map((b) => b.name));
    for (const [kind, bucketName] of Object.entries(SUPABASE_BUCKETS) as [Bucket, string][]) {
      if (!have.has(bucketName)) {
        await s.createBucket(bucketName, { public: kind === 'public', fileSizeLimit: '50MB' });
      }
    }
    return 'Supabase buckets ready (temp files are cleaned by the daily housekeeping job)';
  },

  async cleanupTemporary() {
    let removed = 0;
    for (const rule of TEMP_RULES) {
      const bucket = storage().from(SUPABASE_BUCKETS[rule.bucket]);
      const cutoff = Date.now() - rule.days * 86_400_000;
      // Objects live one folder down (e.g. incoming/<user>/<file>, wm/<entitlement>/<variant>).
      const { data: folders } = await bucket.list(rule.prefix, { limit: 1000 });
      for (const folder of folders ?? []) {
        const dir = `${rule.prefix}/${folder.name}`;
        const { data: files } = await bucket.list(dir, { limit: 1000 });
        const old = (files ?? [])
          .filter((f) => f.id && f.created_at && new Date(f.created_at).getTime() < cutoff)
          .map((f) => `${dir}/${f.name}`);
        if (old.length) {
          await bucket.remove(old);
          removed += old.length;
        }
      }
    }
    return removed;
  },
};
