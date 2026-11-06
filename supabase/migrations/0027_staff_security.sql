-- 0027 — Admin functions (B6): staff roles, settings history, customer timeline.
--
-- * profiles.staff_role narrows what an admin (profiles.role = 'admin') can open:
--   owner | manager | support | content (see src/lib/staff.ts). Existing admins
--   become owners. Not client-writable: authenticated users may only update
--   display_name / country_code / gstin (column grants from 0007).
-- * site_settings_history + save_setting(): every settings change is recorded
--   with who made it, so it can be reviewed and reverted. Service role only.
-- * admin_login_events(): recent sign-ins for the customer timeline, read from
--   the Supabase auth audit log when it's available (empty otherwise).

alter table profiles add column if not exists staff_role text
  check (staff_role is null or staff_role in ('owner', 'manager', 'support', 'content'));
update profiles set staff_role = 'owner' where role = 'admin' and staff_role is null;

create table if not exists site_settings_history (
  id          bigint generated always as identity primary key,
  key         text not null,
  old_value   jsonb,
  new_value   jsonb,
  actor_id    uuid references profiles(id) on delete set null,
  actor_email text,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists site_settings_history_created_idx on site_settings_history (created_at desc);
create index if not exists site_settings_history_key_idx on site_settings_history (key, created_at desc);
alter table site_settings_history enable row level security; -- no policies: service role only
revoke all on table site_settings_history from anon, authenticated;

create or replace function public.save_setting(p_key text, p_value jsonb, p_actor uuid, p_actor_email text, p_note text default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_id bigint;
begin
  select value into v_old from site_settings where key = p_key for update;
  if v_old is not distinct from p_value then
    return null; -- nothing changed, nothing recorded
  end if;
  insert into site_settings (key, value, updated_at) values (p_key, p_value, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into site_settings_history (key, old_value, new_value, actor_id, actor_email, note)
    values (p_key, v_old, p_value, p_actor, p_actor_email, p_note)
    returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.save_setting(text, jsonb, uuid, text, text) from public, anon, authenticated;
grant execute on function public.save_setting(text, jsonb, uuid, text, text) to service_role;

create or replace function public.admin_login_events(p_user uuid, p_limit int default 30)
returns table (at timestamptz, action text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return query
    select e.created_at, (e.payload ->> 'action')::text
    from auth.audit_log_entries e
    where e.payload ->> 'actor_id' = p_user::text
      and e.payload ->> 'action' in ('login', 'logout', 'user_signedup', 'user_recovery_requested', 'user_updated_password', 'factor_in_progress', 'factor_unenrolled')
    order by e.created_at desc
    limit least(greatest(p_limit, 1), 100);
exception when others then
  return; -- audit log not available on this project
end;
$$;
revoke execute on function public.admin_login_events(uuid, int) from public, anon, authenticated;
grant execute on function public.admin_login_events(uuid, int) to service_role;
