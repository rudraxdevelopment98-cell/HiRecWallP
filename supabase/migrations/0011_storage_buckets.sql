-- =============================================================================
-- HirecWallp — Supabase Storage buckets (zero-setup storage; see src/lib/storage)
--
-- wallpapers-private : originals, paid sizes, free sizes, per-buyer copies,
--                      raw uploads. NOT public; no RLS policies, so only the
--                      service role (server) can read/write; buyers get 60 s
--                      signed URLs.
-- wallpapers-public  : watermarked previews (≤720 px) + 600² crops only.
-- 50 MB per file = Supabase free-plan limit. Switch to R2 any time via env.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('wallpapers-private', 'wallpapers-private', false, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/tiff']),
  ('wallpapers-public', 'wallpapers-public', true, 5242880,
   array['image/jpeg', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
