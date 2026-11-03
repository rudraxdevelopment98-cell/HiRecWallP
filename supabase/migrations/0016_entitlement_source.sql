-- =============================================================================
-- HirecWallp — where each library item came from (creator earnings valuation)
-- entitlements.source: 'order' (paid order / webhook), 'credits' (credit spend),
-- 'membership' (pass claim), 'gift' (admin). Creator payouts value credit spends
-- and membership claims at site setting `creator_credit_value_inr` per credit.
-- =============================================================================

alter table entitlements add column if not exists source text
  check (source in ('order', 'credits', 'membership', 'gift'));
update entitlements set source = case when order_id is not null then 'order' else 'gift' end where source is null;
create index if not exists entitlements_source_created_idx on entitlements (source, created_at);

create or replace function public.spend_credits_and_entitle(
  p_user uuid, p_wallpaper uuid, p_cost int, p_licence licence_type default 'personal', p_max_downloads int default 5
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_existing uuid;
  v_id uuid;
  v_left int := p_cost;
  v_take int;
  r record;
begin
  if p_cost < 0 then raise exception 'cost must be non-negative'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user::text));

  select id into v_existing from public.entitlements
  where user_id = p_user and wallpaper_id = p_wallpaper and licence = p_licence;
  if v_existing is not null then return v_existing; end if;

  if public.credit_balance(p_user) < p_cost then return null; end if;

  insert into public.entitlements (user_id, wallpaper_id, licence, max_downloads, source)
  values (p_user, p_wallpaper, p_licence, p_max_downloads, 'credits')
  returning id into v_id;

  for r in select * from public.bonus_lots(p_user) where remaining > 0 order by expires_at asc nulls last loop
    exit when v_left <= 0;
    v_take := least(v_left, r.remaining);
    insert into public.credit_ledger (user_id, delta, reason, ref_id, bucket, lot_id)
    values (p_user, -v_take, 'spend', v_id, 'bonus', r.lot_id);
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    insert into public.credit_ledger (user_id, delta, reason, ref_id, bucket)
    values (p_user, -v_left, 'spend', v_id, 'paid');
  end if;
  return v_id;
end;
$$;

create or replace function public.member_unlock(p_user uuid, p_wallpaper uuid, p_max_downloads int default 5)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_cat     uuid;
  v_parent  uuid;
  m         record;
  v_pstart  timestamptz;
  v_used    int;
  v_licence licence_type;
  v_id      uuid;
begin
  perform pg_advisory_xact_lock(hashtext('member:' || p_user::text));

  select w.category_id, c.parent_id into v_cat, v_parent
  from public.wallpapers w left join public.categories c on c.id = w.category_id
  where w.id = p_wallpaper;

  for m in
    select * from public.memberships
    where user_id = p_user and status = 'active' and starts_at <= now() and ends_at > now()
      and (category_id is null or category_id = v_cat or category_id = v_parent)
    order by (category_id is null), includes_commercial, ends_at asc
  loop
    v_pstart := m.starts_at + make_interval(days => m.period_days * floor(extract(epoch from now() - m.starts_at) / (m.period_days * 86400))::int);
    v_used := case when m.period_start is not distinct from v_pstart then m.period_used else 0 end;
    if v_used >= m.download_limit then continue; end if;

    v_licence := case when m.includes_commercial then 'commercial'::licence_type else 'personal'::licence_type end;
    select id into v_id from public.entitlements
    where user_id = p_user and wallpaper_id = p_wallpaper and (licence = v_licence or licence = 'commercial');
    if v_id is not null then return v_id; end if;

    insert into public.entitlements (user_id, wallpaper_id, licence, max_downloads, source)
    values (p_user, p_wallpaper, v_licence, p_max_downloads, 'membership')
    returning id into v_id;

    update public.memberships
    set period_start = v_pstart, period_used = v_used + 1, downloads_used = downloads_used + 1
    where id = m.id;
    return v_id;
  end loop;
  return null;
end;
$$;
