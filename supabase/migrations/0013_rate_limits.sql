-- =============================================================================
-- HirecWallp — shared rate limiting for public endpoints (contact, newsletter,
-- takedown, analytics). Works across all serverless instances.
-- =============================================================================

create table rate_hits (
  key text not null,
  at  timestamptz not null default now()
);
create index rate_hits_key_at_idx on rate_hits (key, at desc);
alter table rate_hits enable row level security; -- service role only

-- Record a hit for p_key and say whether it is within p_limit per p_window_s.
create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_s int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count from public.rate_hits
  where key = p_key and at > now() - make_interval(secs => p_window_s);
  if v_count >= p_limit then
    return false;
  end if;
  insert into public.rate_hits (key) values (p_key);
  return true;
end;
$$;
revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- Keep the table tiny: housekeeping also removes hits older than a day.
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
  delete from public.rate_hits where at < now() - interval '1 day';

  return v_deleted;
end;
$$;
