import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { regionForCountry } from '@/lib/geo';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Edge middleware: refreshes the Supabase session cookie (when signed in),
 * applies security headers to every response and seeds a best-effort pricing
 * region cookie from the Vercel geo header (display only; the charged region
 * is re-verified at checkout against the billing country).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // --- Supabase session refresh ---------------------------------------------
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith('sb-'));
  if (supabaseUrl && supabaseAnon && hasSession) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      });
      await supabase.auth.getUser();
    } catch {
      // Never block a page on auth refresh.
    }
  }

  // --- Pricing region cookie (display only) ---------------------------------
  const existing = request.cookies.get('region')?.value;
  if (!existing) {
    const country =
      request.headers.get('x-vercel-ip-country') ??
      request.headers.get('cf-ipcountry') ??
      undefined;
    const region = regionForCountry(country);
    response.cookies.set('region', region, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  // --- Security headers ------------------------------------------------------
  const publicBase = process.env.R2_PUBLIC_BASE_URL ?? '';
  const isDev = process.env.NODE_ENV !== 'production';
  const razorpay = 'https://*.razorpay.com';

  const csp = [
    `default-src 'self'`,
    // Next.js injects inline bootstrap scripts; dev also needs eval for HMR.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://checkout.razorpay.com`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${razorpay} ${publicBase}`.trim(),
    `font-src 'self' data:`,
    // R2 S3 endpoint: browsers PUT large originals via presigned URLs.
    `connect-src 'self' ${razorpay} https://*.r2.cloudflarestorage.com ${supabaseUrl}`.trim(),
    `frame-src ${razorpay}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com")');

  return response;
}

export const config = {
  // Run on all routes except static assets, the image optimizer and demo images.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|demo/|.*\\.(?:jpg|jpeg|png|webp|svg|ico)$).*)'],
};
