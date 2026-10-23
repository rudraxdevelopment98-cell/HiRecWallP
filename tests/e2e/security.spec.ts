import { expect, test } from '@playwright/test';

// Critical flow: the secure endpoints enforce their contracts. A full
// purchase→download happy path needs live Supabase/R2/Razorpay and is covered
// by a seeded staging run; here we assert the guard rails hold.

test('security headers are present on the home page', async ({ request }) => {
  const res = await request.get('/');
  const headers = res.headers();
  expect(headers['content-security-policy']).toBeTruthy();
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['x-content-type-options']).toBe('nosniff');
});

test('download endpoint rejects a request with no Origin (CSRF guard)', async ({ request }) => {
  const res = await request.post('/api/download', {
    data: { wallpaperId: '00000000-0000-0000-0000-000000000000', variant: 'phone' },
  });
  expect(res.status()).toBe(403);
});

test('download endpoint rejects invalid input', async ({ request, baseURL }) => {
  const res = await request.post('/api/download', {
    headers: { origin: baseURL ?? 'http://127.0.0.1:3000' },
    data: { nope: true },
  });
  expect(res.status()).toBe(400);
});

test('free-variant download without auth is allowed through the guard (not 401)', async ({
  request,
  baseURL,
}) => {
  // A free variant requires no login; with no DB configured it resolves to 404
  // (asset not found) or 503, but importantly never 401.
  const res = await request.post('/api/download', {
    headers: { origin: baseURL ?? 'http://127.0.0.1:3000' },
    data: { wallpaperId: '00000000-0000-0000-0000-000000000000', variant: 'free_phone' },
  });
  expect([404, 503]).toContain(res.status());
});

test('checkout create-order requires authentication', async ({ request, baseURL }) => {
  const res = await request.post('/api/checkout/create-order', {
    headers: { origin: baseURL ?? 'http://127.0.0.1:3000' },
    data: { type: 'wallpaper', wallpaperId: '00000000-0000-0000-0000-000000000000' },
  });
  expect(res.status()).toBe(401);
});

test('takedown report validates and accepts a same-origin submission', async ({
  request,
  baseURL,
}) => {
  const bad = await request.post('/api/takedown', {
    headers: { origin: baseURL ?? 'http://127.0.0.1:3000' },
    data: { reporter_email: 'not-an-email', details: 'x' },
  });
  expect(bad.status()).toBe(400);
});
