-- =============================================================================
-- HirecWallp — housekeeping (keeps the database small; see docs/STORAGE_STRATEGY.md)
--
-- Raw analytics events are the only unbounded table (~0.4 KB/row with indexes).
-- Older events are rolled up into daily counts and the raw rows deleted, so
-- history is kept at a tiny fraction of the size. Dynamic pricing and the
-- weekly report only read the last 7 days of raw events.
-- =============================================================================

create table events_daily (
  day          date not null,
  type         event_type not null,
  wallpaper_id uuid references wallpapers(id) on delete cascade,
  region_code  text,
  count        int not null default 0
);
create unique index events_daily_key
  on events_daily (day, type, coalesce(wallpaper_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(region_code, ''));
create index events_daily_wallpaper_idx on events_daily (wallpaper_id, day desc);

alter table events_daily enable row level security;
create policy "events_daily: admin read" on events_daily for select using (public.is_admin());

-- Roll up raw events older than p_keep_days into events_daily, delete them,
-- and drop expired price quotes. Returns the number of raw events removed.
create or replace function public.housekeeping(p_keep_days int default 90)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := date_trunc('day', now()) - make_interval(days => p_keep_days);
  v_deleted int;
begin
  insert into public.events_daily (day, type, wallpaper_id, region_code, count)
  select created_at::date, type, wallpaper_id, region_code, count(*)::int
  from public.events
  where created_at < v_cutoff
  group by 1, 2, 3, 4
  on conflict (day, type, coalesce(wallpaper_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(region_code, ''))
  do update set count = public.events_daily.count + excluded.count;

  delete from public.events where created_at < v_cutoff;
  get diagnostics v_deleted = row_count;

  delete from public.price_quotes where expires_at < now() - interval '1 day';

  return v_deleted;
end;
$$;

revoke execute on function public.housekeeping(int) from public, anon, authenticated;
grant execute on function public.housekeeping(int) to service_role;
