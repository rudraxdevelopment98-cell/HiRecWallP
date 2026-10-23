import { z } from 'zod';

/**
 * Environment access.
 *
 * - `publicEnv` holds only NEXT_PUBLIC_* values; these are safe in the browser
 *   bundle. Everything else is server-only and read lazily via `serverEnv()`
 *   so a missing server secret never leaks into client code or breaks static
 *   pages that don't need it.
 * - NEVER import `serverEnv()` into a Client Component.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_BRAND_NAME: z.string().default('HirecWallp'),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME ?? process.env.BRAND_NAME,
});

const serverSchema = z.object({
  BRAND_NAME: z.string().default('HirecWallp'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_PRIVATE_BUCKET: z.string().min(1),
  R2_PUBLIC_BUCKET: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.string().url(),

  DOWNLOAD_TOKEN_SECRET: z.string().min(16),

  // Payments (validated only when the payments adapter is used).
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  CRON_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

/**
 * Validate and return server-only env. Throws a clear error listing missing
 * keys. Call this inside server code paths (route handlers, server actions),
 * never at module top-level of a shared file, so static pages stay buildable.
 */
export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid or missing server environment variables: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}
