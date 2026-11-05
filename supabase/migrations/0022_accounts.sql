-- =============================================================================
-- HirecWallp — account rights + account emails (2026-11-05)
-- * Close account (DPDP right to erasure): personal data is removed and the
--   login is closed, but orders/invoices stay for 8 years as tax law requires
--   (Privacy Policy). Remaining credits are forfeited with a ledger entry so the
--   books stay right; active passes end; library access ends.
-- * account_summary(): what closing would mean, shown before the person confirms.
-- * Flags so account emails go out once: receipts, welcome, bonus-expiry reminders.
-- =============================================================================

alter type credit_reason add value if not exists 'closure';

alter table profiles     add column if not exists deleted_at       timestamptz;
alter table profiles     add column if not exists welcome_email_at timestamptz;
alter table orders       add column if not exists receipt_sent_at  timestamptz;
alter table credit_ledger add column if not exists reminded_at     timestamptz;

create index if not exists credit_ledger_lot_expiry_idx on credit_ledger (expires_at)
  where bucket = 'bonus' and lot_id is null and delta > 0;

-- What the person would lose / what is kept, for the confirmation screen.
create or replace function public.account_summary(p_user uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'role',            (select role from public.profiles where id = p_user),
    'paid_credits',    (select coalesce(sum(delta), 0) from public.credit_ledger where user_id = p_user and bucket = 'paid'),
    'bonus_credits',   (select coalesce(sum(remaining), 0) from public.bonus_lots(p_user) where expires_at > now()),
    'library',         (select count(*) from public.entitlements where user_id = p_user),
    'active_passes',   (select count(*) from public.memberships where user_id = p_user and status = 'active' and ends_at > now()),
    'autopay',         (select count(*) from public.subscriptions where user_id = p_user and status in ('created', 'authenticated', 'active', 'pending') and not cancel_at_cycle_end),
    'orders',          (select count(*) from public.orders where user_id = p_user and status in ('paid', 'refunded')),
    'pending_payouts', (select count(*) from public.creator_payouts where creator_id = p_user and status in ('pending', 'processing'))
  )
$$;

-- Erase personal data and close the account (auth email/ban handled by the API first).
create or replace function public.close_account(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_role public.user_role;
  v_email text;
  v_paid int;
  v_bonus int := 0;
  r record;
  v_passes int;
  v_ents int;
begin
  select role, email into v_role, v_email from public.profiles where id = p_user for update;
  if not found then raise exception 'no_account'; end if;
  if v_role = 'admin' then raise exception 'admin_account'; end if;
  if exists (select 1 from public.creator_payouts where creator_id = p_user and status in ('pending', 'processing')) then
    raise exception 'payout_pending';
  end if;

  -- Forfeit remaining credits (recorded, so outstanding credit liability is accurate).
  select coalesce(sum(delta), 0) into v_paid from public.credit_ledger where user_id = p_user and bucket = 'paid';
  if v_paid > 0 then
    insert into public.credit_ledger (user_id, delta, reason, bucket) values (p_user, -v_paid, 'closure', 'paid');
  end if;
  for r in select * from public.bonus_lots(p_user) where remaining > 0 and expires_at > now() loop
    insert into public.credit_ledger (user_id, delta, reason, bucket, lot_id) values (p_user, -r.remaining, 'closure', 'bonus', r.lot_id);
    v_bonus := v_bonus + r.remaining;
  end loop;

  update public.memberships set status = 'revoked', note = 'Account closed'
    where user_id = p_user and status = 'active';
  get diagnostics v_passes = row_count;
  delete from public.entitlements where user_id = p_user;
  get diagnostics v_ents = row_count;

  delete from public.favourites where user_id = p_user;
  delete from public.support_tickets where user_id = p_user and order_id is null;
  if v_email is not null then
    delete from public.newsletter_subscribers where lower(email) = lower(v_email);
  end if;
  update public.downloads set ip_hash = null, user_agent = null where user_id = p_user;

  update public.profiles
     set display_name = null, email = null, gstin = null, country_code = null,
         referral_code = null, signup_ip_hash = null, deleted_at = now()
   where id = p_user;

  return jsonb_build_object('paid_forfeited', greatest(v_paid, 0), 'bonus_forfeited', v_bonus,
                            'passes_revoked', v_passes, 'library_removed', v_ents);
end
$$;

-- Bonus lots expiring within p_days that still have credits and weren't reminded yet.
create or replace function public.bonus_expiry_due(p_days int)
returns table (lot_id uuid, user_id uuid, email text, remaining int, expires_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select l.id, l.user_id, p.email,
         (l.delta + coalesce((select sum(c.delta) from public.credit_ledger c where c.lot_id = l.id), 0))::int,
         l.expires_at
  from public.credit_ledger l
  join public.profiles p on p.id = l.user_id and p.deleted_at is null and p.email is not null
  where l.bucket = 'bonus' and l.lot_id is null and l.delta > 0 and l.reminded_at is null
    and l.expires_at > now() and l.expires_at <= now() + make_interval(days => p_days)
    and (l.delta + coalesce((select sum(c.delta) from public.credit_ledger c where c.lot_id = l.id), 0)) > 0
$$;

revoke execute on function public.account_summary(uuid) from public, anon, authenticated;
revoke execute on function public.close_account(uuid) from public, anon, authenticated;
revoke execute on function public.bonus_expiry_due(int) from public, anon, authenticated;
grant execute on function public.account_summary(uuid) to service_role;
grant execute on function public.close_account(uuid) to service_role;
grant execute on function public.bonus_expiry_due(int) to service_role;
