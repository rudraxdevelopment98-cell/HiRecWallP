import { expect, test } from '@playwright/test';

test('account rights endpoints need sign-in (and same origin for changes)', async ({ request, baseURL }) => {
  const h = { origin: baseURL! };
  expect((await request.get('/api/account/export')).status()).toBe(401);
  expect((await request.post('/api/account/close', { data: { confirm: 'x@y.z' } })).status()).toBe(403);
  expect((await request.post('/api/account/close', { data: { confirm: 'x@y.z' }, headers: h })).status()).toBe(401);
  expect((await request.post('/api/account/email', { data: { email: 'new@example.com' }, headers: h })).status()).toBe(401);
  expect((await request.post('/api/account/signout-all', { headers: h })).status()).toBe(401);
});

test('privacy policy explains export and closing the account', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByText('download all your data')).toBeVisible();
  await expect(page.getByText('close your account').first()).toBeVisible();
});

test('password reset link without a session explains it expired', async ({ page }) => {
  await page.goto('/auth/reset');
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request a new one' })).toHaveAttribute('href', '/login?mode=forgot');
});

test('welcome endpoint needs sign-in', async ({ request, baseURL }) => {
  expect((await request.post('/api/account/welcome', { headers: { origin: baseURL! } })).status()).toBe(401);
});
