export type Bucket = 'private' | 'public';

/**
 * Object storage behind one interface so the provider can change by env alone.
 * Originals and paid files only ever live in the PRIVATE bucket and are only
 * exposed through short-lived signed URLs.
 */
export interface StorageProvider {
  id: 'r2' | 'supabase';
  /** Largest single upload the provider accepts. */
  maxUploadBytes: number;
  /** Permanent URL for a PUBLIC-bucket object (watermarked previews only). */
  publicUrl(key: string): string;
  put(bucket: Bucket, key: string, body: Buffer, contentType: string): Promise<void>;
  get(bucket: Bucket, key: string): Promise<Buffer>;
  exists(bucket: Bucket, key: string): Promise<boolean>;
  remove(bucket: Bucket, key: string): Promise<void>;
  /** Short-lived GET URL for a private object. */
  signedGetUrl(bucket: Bucket, key: string, expiresIn: number): Promise<string>;
  /** Browser PUT URL for a new object in the PRIVATE bucket. */
  signedPutUrl(key: string, contentType: string, contentLength: number): Promise<string>;
  /** One-time bucket setup (CORS/lifecycle/buckets). Returns a summary. */
  applyRules(allowedOrigins: string[]): Promise<string>;
  /** Delete expired temp objects (incoming/, wm/, generation/). Returns count. */
  cleanupTemporary(): Promise<number>;
}
