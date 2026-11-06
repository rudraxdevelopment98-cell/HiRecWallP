// Render walkthrough videos (silent) + full-length voice tracks + SRT per chapter.
// Usage: node render.cjs <workDir> [chapterSlug...]
// workDir holds: cap/ (from capture.cjs), vo/ (per-line Piper clips + durations.json), fonts/, out/.
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const [work, ...only] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'steps.json'), 'utf8'));
const cap = JSON.parse(fs.readFileSync(path.join(work, 'cap', 'capture.json'), 'utf8'));
const D = JSON.parse(fs.readFileSync(path.join(work, 'vo', 'durations.json'), 'utf8'));
fs.copyFileSync(path.join(__dirname, 'stage.html'), path.join(work, 'stage.html'));
fs.mkdirSync(path.join(work, 'out'), { recursive: true });
const FPS = 30;
const GROUP = { customer: 'public', creator: 'public', admin: 'admin' };
const LABEL = { customer: 'For customers', creator: 'For creators', admin: 'For the admin' };

function plan(ch) {
  const longer = (k) => Math.max(D[`${ch.slug}/${k}/en`], D[`${ch.slug}/${k}/hi`]);
  const items = [];
  let t = 0;
  const introDur = Math.max(5, longer('00') + 1.8 + ch.steps.length * 0.12);
  items.push({ type: 'intro', start: 0, dur: introDur, vo: '00', voAt: 0.6, title: ch.title, summary: ch.summary, steps: ch.steps.map((s) => s.title) });
  t = introDur;
  ch.steps.forEach((s, i) => {
    const k = String(i + 1).padStart(2, '0');
    const dur = Math.max(4.2, longer(k) + 1.6);
    const c = cap[ch.slug][i];
    items.push({ type: 'step', start: t, dur, vo: k, voAt: t + 0.7, img: `cap/${c.file}`, box: c.box, title: s.title, n: i + 1, total: ch.steps.length, en: s.en, hi: s.hi });
    t += dur;
  });
  const same = spec.chapters.filter((c) => GROUP[c.audience] === GROUP[ch.audience]);
  const next = same[same.findIndex((c) => c.slug === ch.slug) + 1];
  items.push({ type: 'outro', start: t, dur: 3.6, next: next ? next.title : null, url: ch.audience === 'admin' ? 'Admin → Guide' : 'hirecwallp.com/guide' });
  t += 3.6;
  items[0].voAt = 0.6;
  return { items, total: t };
}

const ts = (x) => {
  let ms = Math.round(x * 1000);
  const hh = Math.floor(ms / 3600000); ms -= hh * 3600000;
  const mm = Math.floor(ms / 60000); ms -= mm * 60000;
  const ss = Math.floor(ms / 1000); ms -= ss * 1000;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};

function voiceTrack(ch, P, lang, name) {
  // Lay each clip at its time with ffmpeg adelay, mix, loudness-normalise.
  const clips = P.items.filter((i) => i.vo);
  const args = ['-y', '-loglevel', 'error'];
  clips.forEach((c) => args.push('-i', path.join(work, 'vo', `${ch.slug}-${c.vo}-${lang}.wav`)));
  const f = clips.map((c, i) => `[${i}]adelay=${Math.round((c.type === 'intro' ? c.voAt : c.voAt) * 1000)}:all=1[a${i}]`).join(';');
  const mix = `${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0,apad,atrim=0:${P.total.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
  args.push('-filter_complex', `${f};${mix}`, '-map', '[out]', '-ar', '48000', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '192k', path.join(work, 'out', `${name}-voice-${lang}.mp3`));
  execFileSync('ffmpeg', args);
  const srt = clips.map((c, i) => {
    const text = c.type === 'intro' ? ch.intro[lang] : c[lang];
    const d = D[`${ch.slug}/${c.vo}/${lang}`];
    return `${i + 1}\n${ts(c.voAt)} --> ${ts(c.voAt + d)}\n${text}\n`;
  }).join('\n');
  fs.writeFileSync(path.join(work, 'out', `${name}-subtitles-${lang}.srt`), srt);
}

(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'], executablePath: process.env.CHROME || undefined });
  for (const [idx, ch] of spec.chapters.entries()) {
    if (only.length && !only.includes(ch.slug)) continue;
    const name = `${String(idx + 1).padStart(2, '0')}-${ch.slug}`;
    const P = plan(ch);
    for (const lang of ['hi', 'en']) voiceTrack(ch, P, lang, name);
    const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
    page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
    await page.addInitScript((p) => { window.PLAN = p; }, { items: P.items, chapterTitle: ch.title, audienceLabel: LABEL[ch.audience] });
    await page.goto('file://' + path.join(work, 'stage.html'));
    await page.evaluate(() => window.ready);
    if (process.env.STILLS) {
      for (const t of process.env.STILLS.split(',').map(Number)) {
        await page.evaluate((x) => window.renderAt(x), t);
        await page.screenshot({ path: path.join(work, 'out', `still-${ch.slug}-${t}.jpg`), type: 'jpeg', quality: 80 });
      }
      await page.context().close();
      continue;
    }
    const outFile = path.join(work, 'out', `${name}-silent.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
    const N = Math.ceil(P.total * FPS);
    for (let f = 0; f < N; f++) {
      await page.evaluate((x) => window.renderAt(x), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    // Ready-mixed versions for convenience.
    for (const lang of ['hi', 'en']) {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', outFile, '-i', path.join(work, 'out', `${name}-voice-${lang}.mp3`), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', path.join(work, 'out', `${name}-${lang}.mp4`)]);
    }
    console.log('done', name, P.total.toFixed(1) + 's');
    await page.context().close();
  }
  await browser.close();
})();
