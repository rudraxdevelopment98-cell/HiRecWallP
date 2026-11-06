-- 0026 — Exact-fit downloads (B5).
-- * downloads.fit_size: "WxH" when the download was an exact-fit crop made for the
--   buyer's screen (asset_id is null for those; the crop is cached under fit/).
-- * wallpapers.upscaled_from: "WxH" of the original when an upload was slightly too
--   small and was enlarged by the AI upscale provider (shown on the wallpaper page).

alter table downloads add column if not exists fit_size text
  check (fit_size is null or fit_size ~ '^[0-9]{3,4}x[0-9]{3,4}$');

alter table wallpapers add column if not exists upscaled_from text
  check (upscaled_from is null or upscaled_from ~ '^[0-9]{3,5}x[0-9]{3,5}$');
