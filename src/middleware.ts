import { NextResponse, type NextRequest } from 'next/server';
import { regionForCountry } from '@/lib/geo';

/**
 * Edge middleware: applies security headers to every response and seeds a
 * best-effort pricing region cookie from the Vercel geo header (display only;
 * the charged region is re-verified at checkout).
 *
 * NOTE: a nonce-based strict CSP and Supabase session refresh are planned
 * hardening steps (tracked in CLAUDE.md). Razorpay's checkout/frame hosts must
 * be added to script-src/frame-src when payments are wired.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const isDev = process.env.NODE_ENV !== 'production';

  const csp = [
    `default-src 'self'`,
    // Next.js injects inline bootstrap scripts; dev also needs eval for HMR.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${publicBase}`.trim(),
    `font-src 'self' data:`,
    `connect-src 'self' ${supabaseUrl}`.trim(),
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
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

export const config = {
  // Run on all routes except static assets and image optimizer.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
