import { expect, test } from '@playwright/test';

// Critical flow: a visitor can browse the public catalogue. These assert the
// shell and navigation render; they do not require a seeded database.

test('home page renders the hero and a browse CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('your screen');
  // Hero CTA is visible on every viewport (nav links collapse on mobile).
  await expect(page.getByRole('link', { name: 'Browse the collection' }).first()).toBeVisible();
});

test('explore page renders with filters', async ({ page }) => {
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible();
  // "Paid" only appears as a filter chip, so it's unambiguous.
  await expect(page.getByRole('link', { name: 'Paid' })).toBeVisible();
});

test('free page renders', async ({ page }) => {
  await page.goto('/free');
  await expect(page.getByRole('heading', { name: 'Free picks' })).toBeVisible();
});

test('pricing page renders', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible();
});

test('region switcher changes the pricing cookie', async ({ page, context }) => {
  await page.goto('/');
  await page.getByLabel('Change region').selectOption('IN');
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === 'region')?.value).toBe('IN');
});
