const { chromium, devices } = require('playwright');
const BASE = 'http://127.0.0.1:3100';
const W = '/w/liquid-gold-2t8f25uq';
async function login(p, email) {
  await p.goto(`${BASE}/login`);
  await p.fill('#email', email);
  await p.fill('#password', 'Tour-Demo-2026!');
  await p.click('button[type=submit]');
  await p.waitForTimeout(3500);
}
async function shot(p, url, name, opts = {}) {
  await p.goto(BASE + url, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(1200);
  if (opts.before) await opts.before(p);
  await p.evaluate(() => document.querySelectorAll('[data-reveal],.reveal').forEach((e) => e.classList.add('in')));
  await p.waitForTimeout(600);
  await p.screenshot({ path: `shots/${name}.png`, fullPage: !!opts.full });
  console.log('ok', name);
}
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const desk = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, colorScheme: 'dark' };
  // anonymous desktop
  let c = await b.newContext(desk); let p = await c.newPage();
  await shot(p, '/', 'home', { full: true });
  await shot(p, '/explore', 'explore', { full: true });
  await shot(p, W, 'detail', { full: true });
  await shot(p, '/pricing', 'pricing', { full: true });
  await c.close();
  // phone
  c = await b.newContext({ ...devices['iPhone 13'], colorScheme: 'dark' }); p = await c.newPage();
  await shot(p, W, 'm-detail', { full: true });
  await shot(p, '/', 'm-home');
  await shot(p, '/pricing', 'm-pricing', { full: true });
  await login(p, 'priya@example.com');
  await shot(p, '/library', 'm-library', { full: true });
  await c.close();
  // signed-in desktop customer
  c = await b.newContext(desk); p = await c.newPage();
  await login(p, 'priya@example.com');
  await shot(p, '/library', 'library', { full: true });
  await c.close();
  // creator
  c = await b.newContext(desk); p = await c.newPage();
  await login(p, 'studio@example.com');
  for (const [u, n] of [['/creator', 'creator'], ['/creator/earnings', 'creator-earnings'], ['/creator/upload', 'creator-upload'], ['/creator/payouts', 'creator-payouts']]) await shot(p, u, n, { full: true });
  await c.close();
  await b.close();
})();
