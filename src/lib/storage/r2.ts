import 'server-only';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutBucketLifecycleConfigurationCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Bucket, StorageProvider } from './types';

/** Cloudflare R2 via the S3 API (zero egress fees; lifecycle rules native). */
export function r2Configured(): boolean {
  const e = process.env;
  return Boolean(e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_PRIVATE_BUCKET && e.R2_PUBLIC_BUCKET && e.R2_PUBLIC_BASE_URL);
}

let client: S3Client | null = null;
function s3(): S3Client {
  if (client) return client;
  if (!r2Configured()) throw new Error('R2 not configured');
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

const name = (b: Bucket) => (b === 'private' ? process.env.R2_PRIVATE_BUCKET! : process.env.R2_PUBLIC_BUCKET!);

export const r2Provider: StorageProvider = {
  id: 'r2',
  // R2 single-PUT limit is 5 GB; keep uploads sane.
  maxUploadBytes: 150 * 1024 * 1024,

  publicUrl(key) {
    return `${process.env.R2_PUBLIC_BASE_URL!.replace(/\/$/, '')}/${key}`;
  },

  async put(bucket, key, body, contentType) {
    await s3().send(
      new PutObjectCommand({
        Bucket: name(bucket),
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: bucket === 'public' ? 'public, max-age=31536000, immutable' : undefined,
      }),
    );
  },

  async get(bucket, key) {
    const res = await s3().send(new GetObjectCommand({ Bucket: name(bucket), Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as Readable) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
    }
    return Buffer.concat(chunks);
  },

  async exists(bucket, key) {
    try {
      await s3().send(new HeadObjectCommand({ Bucket: name(bucket), Key: key }));
      return true;
    } catch {
      return false;
    }
  },

  async remove(bucket, key) {
    await s3().send(new DeleteObjectCommand({ Bucket: name(bucket), Key: key }));
  },

  async signedGetUrl(bucket, key, expiresIn) {
    return getSignedUrl(s3(), new GetObjectCommand({ Bucket: name(bucket), Key: key }), { expiresIn });
  },

  async signedPutUrl(key, contentType, contentLength) {
    const command = new PutObjectCommand({ Bucket: name('private'), Key: key, ContentType: contentType, ContentLength: contentLength });
    return getSignedUrl(s3(), command, { expiresIn: 600 });
  },

  async applyRules(allowedOrigins) {
    await s3().send(
      new PutBucketCorsCommand({
        Bucket: name('private'),
        CORSConfiguration: {
          CORSRules: [{ AllowedOrigins: allowedOrigins, AllowedMethods: ['PUT'], AllowedHeaders: ['content-type'], MaxAgeSeconds: 3600 }],
        },
      }),
    );
    const expire = (id: string, prefix: string, days: number) => ({
      ID: id,
      Status: 'Enabled' as const,
      Filter: { Prefix: prefix },
      Expiration: { Days: days },
    });
    await s3().send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: name('private'),
        LifecycleConfiguration: {
          Rules: [expire('incoming-1d', 'incoming/', 1), expire('wm-cache-7d', 'wm/', 7), expire('generation-45d', 'generation/', 45)],
        },
      }),
    );
    await s3().send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: name('public'),
        LifecycleConfiguration: { Rules: [expire('generation-45d', 'generation/', 45)] },
      }),
    );
    return 'R2 CORS + lifecycle rules applied';
  },

  // R2 deletes temp files itself via lifecycle rules.
  async cleanupTemporary() {
    return 0;
  },
};
