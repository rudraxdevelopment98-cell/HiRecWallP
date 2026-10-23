import 'server-only';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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
    }),
  );
}
