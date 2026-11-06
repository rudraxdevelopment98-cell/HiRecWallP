import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { normaliseCountry, regionForCountry } from '@/lib/geo';
import { canAccessPath, isMfaExempt } from '@/lib/staff';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Edge middleware: refreshes the Supabase session cookie (when signed in),
 * applies security headers to every response and seeds a best-effort pricing
 * region cookie from the Vercel geo header (display only; the charged region
 * is re-verified at checkout against the billing country).
 */
export async function middleware(request: NextRequest) {
  // Let server components know the route (admin pages use their own shell).
  request.headers.set('x-hw-path', request.nextUrl.pathname);
  let response = NextResponse.next({ request });

  // --- Supabase session refresh ---------------------------------------------
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith('sb-'));
  const path = request.nextUrl.pathname;
  const adminPath = path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin/');
  let isAdmin = false;
  let signedIn = false;
  let staffRole: string | null = null;
  // 'verify': has an authenticator but hasn't used it this session; 'setup': 2FA required but not set up.
  let mfa: 'ok' | 'verify' | 'setup' = 'ok';
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
      const { data } = await supabase.auth.getUser();
      signedIn = Boolean(data.user);
      // First line of the admin gate (pages and APIs re-check server-side; RLS too).
      if (adminPath && data.user) {
        const { data: profile } = await supabase.from('profiles').select('role, staff_role').eq('id', data.user.id).maybeSingle();
        isAdmin = profile?.role === 'admin';
        staffRole = (profile?.staff_role as string | null) ?? null;
        if (isAdmin) {
          const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') mfa = 'verify';
          else if (aal?.nextLevel !== 'aal2') {
            const { data: sec } = await supabase.from('site_settings').select('value').eq('key', 'security').maybeSingle();
            if ((sec?.value as { require_staff_mfa?: boolean } | null)?.require_staff_mfa) mfa = 'setup';
          }
        }
      }
    } catch {
      // Never block a page on auth refresh.
    }
  }
  if (adminPath && !isAdmin) {
    response = path.startsWith('/api/')
      ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      : // Signed in but not an admin: sending them to /login would bounce straight back here (redirect loop).
        NextResponse.redirect(new URL(signedIn ? '/' : '/login?next=/admin', request.url));
  } else if (adminPath && mfa !== 'ok' && !isMfaExempt(path)) {
    // Staff must finish (or set up) two-factor sign-in before anything else.
    response = path.startsWith('/api/')
      ? NextResponse.json({ error: 'Two-factor sign-in required', code: 'mfa_required' }, { status: 403 })
      : NextResponse.redirect(new URL('/admin/security', request.url));
  } else if (adminPath && !canAccessPath(staffRole, path)) {
    // Staff role doesn't include this area (src/lib/staff.ts).
    response = path.startsWith('/api/')
      ? NextResponse.json({ error: 'Your staff role does not include this area' }, { status: 403 })
      : NextResponse.redirect(new URL('/admin?denied=1', request.url));
  }

  // --- Creator affiliate attribution: ?via=CODE on any link (last click, 30 days)
  const via = request.nextUrl.searchParams.get('via')?.toUpperCase();
  if (via && /^[A-Z0-9]{6,12}$/.test(via)) {
    response.cookies.set('aff', via, { path: '/', httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', maxAge: 60 * 60 * 24 * 30 });
  }

  // --- Country / pricing tier cookies (display only) -------------------------
  // Auto-detected from the geo header on first visit; the visitor can change it
  // with the country picker. Checkout re-checks against the billing country.
  if (!request.cookies.get('country')?.value) {
    const country = normaliseCountry(
      request.headers.get('x-vercel-ip-country') ?? request.headers.get('cf-ipcountry') ?? undefined,
    );
    const cookie = { path: '/', sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 30 };
    if (country) response.cookies.set('country', country, cookie);
    response.cookies.set('region', regionForCountry(country), cookie);
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
    // Previews come from R2 (publicBase) or Supabase Storage (supabaseUrl).
    `img-src 'self' data: blob: ${razorpay} ${publicBase} ${supabaseUrl}`.trim(),
    `font-src 'self' data:`,
    // R2 S3 endpoint: browsers PUT large originals via presigned URLs.
    // api.pwnedpasswords.com: k-anonymity breach check for new passwords (only a 5-char hash prefix is sent).
    `connect-src 'self' ${razorpay} https://*.r2.cloudflarestorage.com https://api.pwnedpasswords.com ${supabaseUrl}`.trim(),
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
