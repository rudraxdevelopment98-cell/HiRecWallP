import { expect, test } from '@playwright/test';

const origin = (baseURL?: string) => ({ origin: baseURL ?? 'http://127.0.0.1:3000' });

test('unknown pages show the branded 404', async ({ page }) => {
  const res = await page.goto('/this-does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'This page wandered off' })).toBeVisible();
});

test('product page lists real sizes and shows no fake discount or rating', async ({ page }) => {
  await page.goto('/w/alpine-serenity');
  await expect(page.getByText('Sizes included')).toBeVisible();
  await expect(page.getByText('Desktop 5K')).toBeVisible();
  await expect(page.getByText('% OFF')).toHaveCount(0);
  await expect(page.getByText(/reviews\)/)).toHaveCount(0);
  await expect(page.getByText('PayPal')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Add commercial licence/ })).toBeVisible();
});

test('explore filters actually filter', async ({ page }) => {
  await page.goto('/explore?orientation=portrait');
  await expect(page.getByText('No wallpapers match these filters yet.')).toBeVisible();
  await page.goto('/explore?device=Desktop&res=5K');
  await expect(page.getByText(/^\d+ wallpapers?$/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Alpine Serenity/ }).first()).toBeVisible();
});

test('favourite heart toggles', async ({ page }) => {
  await page.goto('/explore');
  const heart = page.getByRole('button', { name: 'Save to favourites' }).first();
  await heart.click();
  await expect(page.getByRole('button', { name: 'Remove from favourites' }).first()).toBeVisible();
});

test('pricing page shows real offers, not membership', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Simple, fair pricing' })).toBeVisible();
  await expect(page.getByText('Cancel anytime')).toHaveCount(0);
});

test('account pages require sign-in', async ({ page }) => {
  await page.goto('/account/orders');
  await expect(page).toHaveURL(/\/login\?next=%2Faccount|\/login\?next=\/account/);
});

test('contact and newsletter APIs validate and require same origin', async ({ request, baseURL }) => {
  expect((await request.post('/api/contact', { data: { name: 'a', email: 'a@b.co', message: 'hello there' } })).status()).toBe(403);
  expect((await request.post('/api/contact', { headers: origin(baseURL), data: { name: '', email: 'x' } })).status()).toBe(400);
  expect((await request.post('/api/newsletter', { headers: origin(baseURL), data: { email: 'not-an-email' } })).status()).toBe(400);
});

test('admin APIs reject non-admins', async ({ request, baseURL }) => {
  const id = '00000000-0000-0000-0000-000000000000';
  expect((await request.patch(`/api/admin/wallpapers/${id}`, { headers: origin(baseURL), data: { title: 'x' } })).status()).toBe(403);
  expect((await request.delete(`/api/admin/wallpapers/${id}`, { headers: origin(baseURL) })).status()).toBe(403);
  expect((await request.get('/api/admin/newsletter')).status()).toBe(403);
  expect((await request.patch(`/api/admin/creators/${id}`, { headers: origin(baseURL), data: { kyc_status: 'verified' } })).status()).toBe(403);
});

test('control-centre and membership APIs are protected', async ({ request, baseURL }) => {
  const h = origin(baseURL);
  const id = '00000000-0000-0000-0000-000000000000';
  expect((await request.put('/api/admin/settings', { headers: h, data: { key: 'store_open', value: false } })).status()).toBe(403);
  expect((await request.patch('/api/admin/price-rules', { headers: h, data: { region_code: 'IN' } })).status()).toBe(403);
  expect((await request.post('/api/admin/plans', { headers: h, data: {} })).status()).toBe(403);
  expect((await request.post('/api/admin/members', { headers: h, data: {} })).status()).toBe(403);
  expect((await request.delete(`/api/admin/categories/${id}`, { headers: h })).status()).toBe(403);
  expect((await request.post('/api/membership/claim', { headers: h, data: { wallpaperId: id } })).status()).toBe(401);
});
