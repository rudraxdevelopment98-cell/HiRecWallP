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
  await expect(page.getByRole('heading', { name: 'Free picks' })).toBeVisible();
});

test('pricing page renders', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Unlimited beautiful screens' })).toBeVisible();
});

test('region switcher changes the pricing cookie', async ({ page, context }) => {
  await page.goto('/');
  await page.getByLabel('Change region').selectOption('IN');
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === 'region')?.value).toBe('IN');
});
