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
