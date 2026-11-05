-- =============================================================================
-- HirecWallp — permanent wallpaper codes for URLs (2026-11-05)
-- /w/<slug>-<code>: the 8-char code never changes, so renaming a wallpaper
-- never breaks links, shares or search results. Alphabet avoids 0/o/1/l/i and
-- every code contains a digit (see src/lib/wallpaper-url.ts).
-- =============================================================================

create or replace function public.new_wallpaper_code()
returns text
language plpgsql volatile set search_path = public
as $$
declare
  a constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..8 loop
      c := c || substr(a, 1 + floor(random() * length(a))::int, 1);
    end loop;
    exit when c ~ '[2-9]' and not exists (select 1 from public.wallpapers w where w.code = c);
  end loop;
  return c;
end
$$;

alter table wallpapers add column if not exists code text;
update wallpapers set code = public.new_wallpaper_code() where code is null;
alter table wallpapers alter column code set default public.new_wallpaper_code();
alter table wallpapers alter column code set not null;
do $$ begin
  alter table wallpapers add constraint wallpapers_code_key unique (code);
exception when duplicate_object or duplicate_table then null; end $$;
alter table wallpapers drop constraint if exists wallpapers_code_format;
alter table wallpapers add constraint wallpapers_code_format check (code ~ '^[a-hjkmnp-z2-9]{8}$' and code ~ '[2-9]');

revoke execute on function public.new_wallpaper_code() from public, anon, authenticated;
grant execute on function public.new_wallpaper_code() to service_role;
