import { existsSync, readdirSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Use a pre-installed Chromium when present (cloud sandbox) instead of letting
 * Playwright download one, since the pinned package build may differ from the
 * installed build. Falls back to Playwright's managed browser locally.
 */
function resolveExecutablePath(): string | undefined {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  const dir = readdirSync(root).find((d) => /^chromium-\d+$/.test(d));
  if (!dir) return undefined;
  const bin = `${root}/${dir}/chrome-linux/chrome`;
  return existsSync(bin) ? bin : undefined;
}

const executablePath = resolveExecutablePath();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
