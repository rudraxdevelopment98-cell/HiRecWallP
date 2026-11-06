# Promo videos (source)

Two persuasive promo videos in the site's own light theme, each in 16:9 and 9:16:

- **buyer**: "Your screen, upgraded". Premium wallpapers, every device, a comparison with typical free downloads, real pack prices, library, free offers.
- **creator**: "Create. Upload. Earn.". 70% creator share, a labelled earnings example, affiliate +10%, selling alone vs with us, dashboard.

The videos are silent. The voice-over (Hindi + English) is delivered as separate tracks that start at 0:00. `SCRIPTS.md` has the lines with timecodes.

## Re-render (e.g. after a price change or with real catalogue art)

1. `python3 make_art.py art`: original generated art (or put your own `<name>-l.jpg` / `<name>-p.jpg` in `art/`).
2. `node shots.cjs`: screenshots of a running local copy of the site into `shots/`. The stage uses the `c-*.jpg` crops.
3. Fonts in `fonts/`:
   - Space Grotesk and Cormorant (`@fontsource/*`)
   - Inter / Inter Display `.otf` files
4. `PIPER_DIR=… python3 tts.py`: per-scene voice clips. Scene lengths follow the longer of the Hindi and English clips.
5. `node render.cjs <buyer|creator> <land|port> video`: silent MP4 (Playwright frame-by-frame → ffmpeg).
6. `python3 voice.py`: full-length voice tracks (loudness-normalised) and SRT subtitles.

## Keep it truthful

- Prices, the 70% share, the ₹5 credit value, the 10% affiliate rate and the 30-day welcome-credit validity are today's defaults. Re-render if they change in Admin.
- Earnings are always shown as a labelled example, with the fine print on screen.
