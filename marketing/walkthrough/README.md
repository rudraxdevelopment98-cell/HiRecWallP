# Walkthrough: written guide + videos

One list of steps (`steps.json`) produces both:

- the **written guide** on the site (`/guide`, `/admin/guide`), with screenshots and a highlight ring;
- **walkthrough videos**, one per chapter, silent, with separate Hindi + English voice tracks and subtitles.

Each step has:

- `url` and `who` (anon / priya / studio / admin demo user);
- optional `scroll` and `do` (click / fill / wait);
- `hl`: highlight selectors. `up:` means the nearest card around the element; several selectors are joined into one box;
- `title` and `body` (written guide);
- `en` / `hi` (voice).

## Steps

1. Run a local copy of the site seeded with the demo users (password in `DEMO_PASSWORD`) on `BASE` (default `http://127.0.0.1:3100`).
2. Capture: `CHROME=/path/to/chrome node capture.cjs <work>/cap [slug…]`, which writes PNGs and `capture.json`.
3. Update the website guide: `node build-guide.cjs <work>/cap`, which writes `public/guide/*.webp` and `src/lib/guide-content.json`. Commit both.
4. Voice: generate one Piper clip per line into `<work>/vo/<slug>-<NN>-<hi|en>.wav` (00 = chapter intro), plus `vo/durations.json`.
5. Videos: put `fonts/` (Space Grotesk, Inter) in `<work>`, then run `node render.cjs <work> [slug…]`. This writes `out/NN-slug-silent.mp4`, `-voice-hi.mp3`, `-voice-en.mp3`, `-subtitles-*.srt`, and ready-mixed `-hi.mp4` / `-en.mp4`.

Voice tracks start at 0:00 and match the silent video exactly.
