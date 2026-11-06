import { expect, test } from '@playwright/test';

const ID = '00000000-0000-4000-8000-000000000000';

test('support pages ask customers to sign in', async ({ page }) => {
  await page.goto('/account/support');
  await expect(page).toHaveURL(/\/login/);
});

test('ticket and refund endpoints need same origin and sign-in', async ({ request, baseURL }) => {
  const h = { origin: baseURL! };
  const ticket = { category: 'download', subject: 'File will not open', body: 'The 4K file shows an error on my phone.' };
  expect((await request.post('/api/support/tickets', { data: ticket })).status()).toBe(403);
  expect((await request.post('/api/support/tickets', { data: ticket, headers: h })).status()).toBe(401);
  expect((await request.post(`/api/support/tickets/${ID}/reply`, { data: { body: 'hi' }, headers: h })).status()).toBe(401);
  expect((await request.post(`/api/account/orders/${ID}/refund`, { data: {}, headers: h })).status()).toBe(401);
});

test('admin support actions are admin-only', async ({ request, baseURL }) => {
  const res = await request.post(`/api/admin/support/${ID}`, { data: { action: 'credits', amount: 100 }, headers: { origin: baseURL! } });
  expect(res.status()).toBe(403);
});

test('refund policy explains instant refunds and support requests', async ({ page }) => {
  await page.goto('/refunds');
  await expect(page.getByText('Instant:')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Account → Help & support' })).toBeVisible();
});

test('upload, drafts and image replacement are admin-only', async ({ page, request, baseURL }) => {
  const h = { origin: baseURL! };
  expect((await request.post('/api/admin/upload', { multipart: { auto: '1' }, headers: h })).status()).toBe(403);
  expect((await request.post('/api/admin/wallpapers/00000000-0000-4000-8000-000000000000/media', { multipart: { mode: 'regenerate' }, headers: h })).status()).toBe(403);
  await page.goto('/admin/drafts');
  await expect(page).toHaveURL(/\/login/);
});
