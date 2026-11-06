-- =============================================================================
-- HirecWallp — upload pipeline (2026-11-05)
-- * wallpapers.phash: perceptual hash (dHash, 16 hex) of the clean original, so
--   every upload (admin, creator, AI pipeline) is checked for near-duplicates
--   against the real catalogue — not against watermarked previews.
-- * wallpapers.source_width/height: the original's size (quality badge, re-crops).
-- * wallpapers.ai_filled: metadata was suggested by the vision model (shown on
--   the drafts review grid until a person edits it).
-- =============================================================================

alter table wallpapers
  add column if not exists phash text check (phash is null or phash ~ '^[0-9a-f]{16}$'),
  add column if not exists source_width int,
  add column if not exists source_height int,
  add column if not exists ai_filled boolean not null default false;

create index if not exists wallpapers_phash_idx on wallpapers (phash) where phash is not null;
