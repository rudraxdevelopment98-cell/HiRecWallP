import { expect, test } from '@playwright/test';

test.describe('checkout (demo mode, no payment env)', () => {
  test('status endpoint reports payments off without leaking config', async ({ request }) => {
    const res = await request.get('/api/checkout/status');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.payments).toBe(false);
    expect(json.signedIn).toBe(false);
    expect(JSON.stringify(json)).not.toMatch(/rzp_|secret/i);
  });

  test('demo cart checks out to the success page', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem(
        'hw_cart',
        JSON.stringify([
          {
            id: 'demo-1',
            slug: 'alpine-serenity',
            title: 'Alpine Serenity',
            image: null,
            price: 2,
            priceLabel: '2 credits',
            licence: 'personal',
          },
        ]),
      );
    });
    await page.goto('/checkout');
    await expect(page.getByTestId('demo-banner')).toBeVisible();
    await page.getByRole('button', { name: /Proceed to Payment/ }).click();
    await expect(page).toHaveURL(/\/checkout\/success\?order=WPC-/);
    await expect(page.getByRole('heading', { name: 'Payment Successful!' })).toBeVisible();
  });

  test('login page explains accounts are not connected', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(/Accounts are not connected/)).toBeVisible();
  });

  test('auth callback without a code returns to login with an error', async ({ request }) => {
    const res = await request.get('/auth/callback?next=//evil.example', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()['location']).toContain('/login?error=auth');
  });

  test('order status requires auth', async ({ request }) => {
    const res = await request.get('/api/orders/00000000-0000-0000-0000-000000000000');
    expect(res.status()).toBe(401);
  });
});
