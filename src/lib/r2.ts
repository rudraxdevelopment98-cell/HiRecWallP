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
import { serverEnv } from '@/lib/env';

/**
 * Cloudflare R2 access via the S3 API.
 *
 * Originals live in the PRIVATE bucket and are only ever exposed through a
 * short-lived presigned GET URL (default 60 s). No code path returns a
 * permanent or public URL to a private object.
 */
let client: S3Client | null = null;

function r2(): S3Client {
  if (client) return client;
  const env = serverEnv();
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

export type R2Bucket = 'private' | 'public';

function bucketName(bucket: R2Bucket): string {
  const env = serverEnv();
  return bucket === 'private' ? env.R2_PRIVATE_BUCKET : env.R2_PUBLIC_BUCKET;
}

/** Presigned GET URL. `expiresIn` is seconds (default 60, max 600). */
export async function presignedGetUrl(
  bucket: R2Bucket,
  key: string,
  expiresIn = 60,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucketName(bucket), Key: key });
  return getSignedUrl(r2(), command, { expiresIn: Math.min(Math.max(expiresIn, 1), 600) });
}

/** True if an object exists in the bucket (HEAD). */
export async function objectExists(bucket: R2Bucket, key: string): Promise<boolean> {
  try {
    await r2().send(new HeadObjectCommand({ Bucket: bucketName(bucket), Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Fetch an object's bytes from a bucket (server-side pipelines only). */
export async function getObject(bucket: R2Bucket, key: string): Promise<Buffer> {
  const res = await r2().send(new GetObjectCommand({ Bucket: bucketName(bucket), Key: key }));
  const stream = res.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

/** Upload an object to a bucket (used by the admin publish flow). */
export async function putObject(
  bucket: R2Bucket,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await r2().send(
    new PutObjectCommand({
      Bucket: bucketName(bucket),
      Key: key,
      Body: body,
      ContentType: contentType,
      // Public objects are immutable per key (previews are regenerated under
      // the same wallpaper id only on re-upload), so let the CDN cache them.
      CacheControl: bucket === 'public' ? 'public, max-age=31536000, immutable' : undefined,
    }),
  );
}

/** Delete an object (missing keys are not an error). */
export async function deleteObject(bucket: R2Bucket, key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: bucketName(bucket), Key: key }));
}

/**
 * Presigned PUT for a browser to upload straight to the PRIVATE bucket,
 * bypassing the ~4.5 MB serverless request limit. The signature pins the
 * content type and exact byte length; keys live under `incoming/` and are
 * auto-deleted after a day by the lifecycle rule below.
 */
export async function presignedPutUrl(
  key: string,
  contentType: string,
  contentLength: number,
  expiresIn = 600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucketName('private'),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(r2(), command, { expiresIn });
}

/**
 * Apply bucket housekeeping (idempotent):
 *   - CORS on the private bucket so the site can PUT uploads directly
 *   - lifecycle rules that delete temporary objects:
 *       incoming/    1 day   (raw uploads, deleted after processing anyway)
 *       wm/          7 days  (per-buyer watermarked copies; rebuilt on demand)
 *       generation/  45 days (AI batch candidates awaiting/after review)
 */
export async function applyStorageRules(allowedOrigins: string[]): Promise<void> {
  await r2().send(
    new PutBucketCorsCommand({
      Bucket: bucketName('private'),
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: allowedOrigins,
            AllowedMethods: ['PUT'],
            AllowedHeaders: ['content-type'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );

  const expire = (id: string, prefix: string, days: number) => ({
    ID: id,
    Status: 'Enabled' as const,
    Filter: { Prefix: prefix },
    Expiration: { Days: days },
  });
  await r2().send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: bucketName('private'),
      LifecycleConfiguration: {
        Rules: [
          expire('incoming-1d', 'incoming/', 1),
          expire('wm-cache-7d', 'wm/', 7),
          expire('generation-45d', 'generation/', 45),
        ],
      },
    }),
  );
  await r2().send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: bucketName('public'),
      LifecycleConfiguration: { Rules: [expire('generation-45d', 'generation/', 45)] },
    }),
  );
}
