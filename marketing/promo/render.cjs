const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const plan = require('./plan.cjs');
const [video, fmt, mode, ...rest] = process.argv.slice(2); // mode: video | stills t1,t2...
const [W, H] = fmt === 'port' ? [1080, 1920] : [1920, 1080];
const FPS = 30;
(async () => {
  const P = plan(video);
  const total = P[P.length - 1].start + P[P.length - 1].dur;
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  await page.addInitScript((p) => { window.PLAN = p; }, P);
  page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, `stage.html?video=${video}`));
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(500);
  if (mode === 'stills') {
    for (const t of rest[0].split(',').map(Number)) {
      await page.evaluate((t) => window.renderAt(t), t);
      await page.screenshot({ path: `out/still-${video}-${fmt}-${t}.jpg`, type: 'jpeg', quality: 80 });
    }
    await b.close();
    return;
  }
  const outFile = `out/${video}-${fmt}-silent.mp4`;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = Math.ceil(total * FPS);
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    await page.evaluate((t) => window.renderAt(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 300 === 0) console.log(video, fmt, f, '/', N, Math.round((Date.now() - t0) / 1000) + 's');
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('done', outFile, total.toFixed(2) + 's');
  await b.close();
})();
