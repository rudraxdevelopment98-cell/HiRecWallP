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
