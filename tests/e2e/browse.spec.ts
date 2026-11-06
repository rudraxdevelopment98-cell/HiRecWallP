import { expect, test } from '@playwright/test';

// Critical flow: a visitor can browse the public catalogue. These assert the
// shell and navigation render; they do not require a seeded database.

test('home page renders the hero and a browse CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Any Screen');
  // Hero CTA is visible on every viewport.
  await expect(page.getByRole('link', { name: 'Explore Wallpapers' }).first()).toBeVisible();
});

test('explore page renders with filters', async ({ page }) => {
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Explore Wallpapers' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply Filters' })).toBeVisible();
});

test('free page renders', async ({ page }) => {
  await page.goto('/free');
  await expect(page.getByRole('heading', { name: 'Free wallpapers' })).toBeVisible();
});

test('pricing page renders with plan-type tabs', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Pick how you want to pay' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Plan types' }).getByRole('link', { name: 'Credit packs' })).toBeVisible();
});

test('visitors cannot pick a cheaper country: prices follow location + time zone', async ({ page, context }) => {
  // A "VPN" cookie claiming Pakistan, but the browser time zone is New York.
  await context.addCookies([
    { name: 'country', value: 'PK', url: test.info().project.use.baseURL ?? 'http://127.0.0.1:3000' },
    { name: 'tz', value: encodeURIComponent('America/New_York'), url: test.info().project.use.baseURL ?? 'http://127.0.0.1:3000' },
  ]);
  await page.goto('/pricing');
  await expect(page.locator('select[aria-label="Change country"]')).toHaveCount(0);
  await expect(page.getByText('Prices for', { exact: false }).getByText('United States')).toBeVisible();
});

test('wallpaper page previews the wallpaper on a device and full screen', async ({ page }) => {
  await page.goto('/w/alpine-serenity');
  const tabs = page.getByRole('tablist', { name: 'Preview on a device' });
  await expect(tabs.getByRole('tab', { name: /^On (your|this)/ })).toBeVisible();
  await tabs.getByRole('tab', { name: 'Tablet', exact: true }).click();
  await expect(tabs.getByRole('tab', { name: 'Tablet', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Home screen' }).click();
  await page.getByRole('button', { name: 'Try it full screen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Full-screen preview' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('wallpaper URLs carry a permanent code; old and renamed links redirect', async ({ page }) => {
  await page.goto('/w/canyon-river');
  await expect(page).toHaveURL(/\/w\/canyon-river-[a-hjkmnp-z2-9]{8}$/);
  const canonical = new URL(page.url()).pathname;
  const code = canonical.split('-').pop()!;
  await page.goto(`/w/an-old-title-${code}`);
  await expect(page).toHaveURL(new RegExp(`${canonical}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Canyon River' })).toBeVisible();
  const card = page.locator('a[href^="/w/"]').first();
  await expect(card).toHaveAttribute('href', /\/w\/[a-z0-9-]+-[a-hjkmnp-z2-9]{8}$/);
});

test.describe('phone layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const path of ['/', '/explore', '/pricing', '/w/alpine-serenity']) {
    test(`no sideways scrolling on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test('guide: chapters with pictures, admin guide stays private', async ({ page }) => {
  await page.goto('/guide');
  await expect(page.getByRole('heading', { level: 1, name: 'Guide' })).toBeVisible();
  await page.getByRole('link', { name: /Getting around/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Getting around' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Step 1:/ })).toBeVisible();
  const r = await page.request.get('/guide/admin-dashboard');
  expect(r.status()).toBe(404);
  await page.goto('/admin/guide');
  await expect(page).toHaveURL(/\/login/);
});
