import { expect, test } from '@playwright/test';

test('gift redeem page renders and redeeming needs sign-in', async ({ page, request, baseURL }) => {
  await page.goto('/gift');
  await expect(page.getByRole('heading', { name: 'Redeem a gift' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in to redeem' })).toBeVisible();
  const res = await request.post('/api/gifts/redeem', { data: { code: 'ABCDEFGHJKLM' }, headers: { origin: baseURL! } });
  expect(res.status()).toBe(401);
});

test('unknown gift link shows a friendly not-found', async ({ page }) => {
  await page.goto('/gift/ZZZZZZZZZZZZ');
  await expect(page.getByRole('heading', { name: 'Gift not found' })).toBeVisible();
});

test('daily claim needs sign-in and same origin', async ({ request, baseURL }) => {
  expect((await request.post('/api/daily/claim')).status()).toBe(403);
  expect((await request.post('/api/daily/claim', { headers: { origin: baseURL! } })).status()).toBe(401);
});

test('?via= sets an httpOnly affiliate cookie', async ({ page, context }) => {
  await page.goto('/explore?via=abc2345');
  const aff = (await context.cookies()).find((c) => c.name === 'aff');
  expect(aff?.value).toBe('ABC2345');
  expect(aff?.httpOnly).toBe(true);
});

test('unsubscribe rejects forged links', async ({ request }) => {
  const res = await request.get('/api/newsletter/unsubscribe?e=someone%40example.com&t=forged');
  expect(res.status()).toBe(400);
});

test('referral links remember the code and send people to sign-up', async ({ request }) => {
  const res = await request.get('/r/abc2345', { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()['location']).toContain('/login?ref=1');
  expect(res.headers()['set-cookie']).toContain('ref=ABC2345');
});

test('tax centre and registers are admin-only', async ({ page, request }) => {
  await page.goto('/admin/tax');
  await expect(page).toHaveURL(/\/login/);
  expect([401, 403]).toContain((await request.get('/api/admin/tax/sales-register')).status());
  expect([401, 403]).toContain((await request.get('/api/admin/tax/tds-register')).status());
  expect((await request.get('/api/jobs/fx-rates')).status()).toBe(401);
});

test('all policy pages Razorpay checks for exist, with versions and grievance contact', async ({ page }) => {
  for (const [path, title] of [
    ['/terms', 'Terms of Service'],
    ['/privacy', 'Privacy Policy'],
    ['/refunds', 'Refund & Cancellation Policy'],
    ['/delivery', 'Shipping & Delivery Policy'],
    ['/licence', 'Licence'],
    ['/grievance', 'Grievance Redressal'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByText(/version 20\d\d-\d\d-\d\d/)).toBeVisible();
  }
  await page.goto('/grievance');
  await expect(page.getByText('48 hours', { exact: false }).first()).toBeVisible();
});
