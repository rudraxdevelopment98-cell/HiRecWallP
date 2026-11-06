// Turn captures into the website's written guide: public/guide/*.webp + src/lib/guide-content.json.
// Usage: node build-guide.cjs <captureDir>
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const [capDir] = process.argv.slice(2);
const ROOT = path.join(__dirname, '..', '..');
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'steps.json'), 'utf8'));
const cap = JSON.parse(fs.readFileSync(path.join(capDir, 'capture.json'), 'utf8'));
const OUT = path.join(ROOT, 'public', 'guide');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const chapters = [];
  for (const ch of spec.chapters) {
    const steps = [];
    let lastUrl = '';
    for (const [i, st] of ch.steps.entries()) {
      const c = cap[ch.slug]?.[i];
      if (!c) throw new Error(`missing capture ${ch.slug} ${i + 1}`);
      const name = `${ch.slug}-${String(i + 1).padStart(2, '0')}.webp`;
      const info = await sharp(path.join(capDir, c.file)).resize({ width: 1600 }).webp({ quality: 78 }).toFile(path.join(OUT, name));
      const round = (b) => b && Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * 10000) / 10000]));
      steps.push({ title: st.title, body: st.body, image: `/guide/${name}`, width: info.width, height: info.height, box: round(c.box), href: ch.audience === 'admin' || st.url === lastUrl || st.url.startsWith('/w/') ? undefined : st.url });
      lastUrl = st.url;
    }
    chapters.push({ slug: ch.slug, audience: ch.audience, title: ch.title, summary: ch.summary, steps });
  }
  fs.writeFileSync(path.join(ROOT, 'src', 'lib', 'guide-content.json'), JSON.stringify({ chapters }, null, 1) + '\n');
  console.log(chapters.length, 'chapters', chapters.reduce((s, c) => s + c.steps.length, 0), 'steps');
})();
