-- 0028 — SEO: an editable intro for each category page (/collections/<slug>).
-- Shown under the heading and used as the page's meta description. Public read
-- like the rest of categories (existing RLS policy); written by admins only.
alter table categories add column if not exists description text
  check (description is null or char_length(description) <= 600);
