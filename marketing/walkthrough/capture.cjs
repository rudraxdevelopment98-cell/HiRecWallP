// Capture walkthrough screenshots + highlight boxes from a running copy of the site.
// Usage: node capture.cjs <outDir> [chapterSlug...]   (BASE env, default http://127.0.0.1:3100)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:3100';
const PASSWORD = process.env.DEMO_PASSWORD || 'Tour-Demo-2026!';
const USERS = { anon: null, priya: 'priya@example.com', studio: 'studio@example.com', admin: 'owner@hirecwallp.test' };
const VW = 1440, VH = 810, DSF = 4 / 3; // → 1920×1080 images
const [outDir, ...only] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'steps.json'), 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

async function boxOf(page, sel) {
  const up = sel.startsWith('up:');
  const loc = page.locator(up ? sel.slice(3) : sel).first();
  if (!(await loc.count())) return null;
  if (!up) return loc.boundingBox();
  return loc.evaluate((el) => {
    // Nearest ancestor that looks like a card/section: has a border or background, and isn't huge.
    let e = el.parentElement;
    while (e && e !== document.body) {
      const s = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      const framed = parseFloat(s.borderTopWidth) > 0 || (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') || e.tagName === 'SECTION' || e.tagName === 'FORM';
      if (framed && r.width > 80 && r.height > 40 && r.width < innerWidth * 0.98) return { x: r.x, y: r.y, width: r.width, height: r.height };
      e = e.parentElement;
    }
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.evaluate(async () => {
    document.querySelectorAll('[data-reveal],.reveal').forEach((e) => e.classList.add('in'));
    const vis = [...document.images].filter((i) => !i.complete && i.getBoundingClientRect().top < innerHeight * 1.5);
    await Promise.race([Promise.all(vis.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))), new Promise((r) => setTimeout(r, 4000))]);
  });
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-proxy-server'], executablePath: process.env.CHROME || undefined });
  const contexts = {};
  async function pageFor(who) {
    if (contexts[who]) return contexts[who];
    const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DSF, timezoneId: 'Asia/Kolkata', locale: 'en-IN' });
    await ctx.addInitScript(() => {
      const st = document.createElement('style');
      st.textContent = '*,*::before,*::after{caret-color:transparent!important;scroll-behavior:auto!important}';
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));
    });
    const page = await ctx.newPage();
    if (USERS[who]) {
      await page.goto(`${BASE}/login`);
      await page.fill('#email', USERS[who]);
      await page.fill('#password', PASSWORD);
      await page.click('button[type=submit]');
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
      await page.waitForTimeout(800);
    }
    contexts[who] = page;
    return page;
  }
  const result = {};
  for (const ch of spec.chapters) {
    if (only.length && !only.includes(ch.slug)) continue;
    result[ch.slug] = [];
    for (const [i, st] of ch.steps.entries()) {
      const page = await pageFor(st.who || ch.who);
      await page.goto(BASE + st.url, { waitUntil: 'domcontentloaded' });
      await settle(page);
      for (const a of st.do || []) {
        if (a.click) await page.locator(a.click).first().click();
        if (a.fill) await page.locator(a.fill[0]).first().fill(a.fill[1]);
        if (a.wait) await page.waitForTimeout(a.wait);
      }
      if (st.scroll === 'bottom') await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      else if (st.scroll) {
        const loc = page.locator(st.scroll).first();
        if (await loc.count()) await loc.evaluate((e) => { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -150); });
        else console.warn('  ! scroll target missing', ch.slug, i + 1, st.scroll);
      }
      await page.waitForTimeout(400);
      let u = null;
      for (const sel of st.hl || []) {
        const b = await boxOf(page, sel);
        if (!b) { console.warn('  ! highlight missing', ch.slug, i + 1, sel); continue; }
        u = u ? { x1: Math.min(u.x1, b.x), y1: Math.min(u.y1, b.y), x2: Math.max(u.x2, b.x + b.width), y2: Math.max(u.y2, b.y + b.height) }
              : { x1: b.x, y1: b.y, x2: b.x + b.width, y2: b.y + b.height };
      }
      let box = null;
      if (u) {
        const pad = 8;
        const x1 = Math.max(0, u.x1 - pad), y1 = Math.max(0, u.y1 - pad), x2 = Math.min(VW, u.x2 + pad), y2 = Math.min(VH, u.y2 + pad);
        if (x2 > x1 + 4 && y2 > y1 + 4) box = { x: x1 / VW, y: y1 / VH, w: (x2 - x1) / VW, h: (y2 - y1) / VH };
        else console.warn('  ! highlight off-screen', ch.slug, i + 1);
      }
      const file = `${ch.slug}-${String(i + 1).padStart(2, '0')}.png`;
      await page.screenshot({ path: path.join(outDir, file) });
      result[ch.slug].push({ file, box, finalUrl: page.url().replace(BASE, '') });
      console.log('ok', ch.slug, i + 1, box ? '' : '(no box)');
    }
  }
  const out = path.join(outDir, 'capture.json');
  const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
  fs.writeFileSync(out, JSON.stringify({ ...prev, ...result }, null, 1));
  await browser.close();
})();
