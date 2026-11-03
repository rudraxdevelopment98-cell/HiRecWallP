-- =============================================================================
-- HirecWallp — support tickets + self-serve refunds (2026-11-03)
-- * support_tickets: numbered tickets (HW-T1001…), linked to an order/wallpaper,
--   with the SLA from the Consumer Protection (E-Commerce) Rules 2020:
--   acknowledge within 48 hours, resolve within one month.
-- * support_messages: the thread. `internal` notes are staff-only (RLS).
-- * refund_facts(): everything the self-serve refund rules need, in one read.
-- Writes go through the API with the service role; customers only read their own.
-- =============================================================================

do $$ begin
  create type ticket_status as enum ('open', 'waiting_customer', 'resolved', 'closed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type ticket_category as enum ('refund', 'download', 'wrong_charge', 'quality', 'account', 'other');
exception when duplicate_object then null; end $$;

create sequence if not exists support_ticket_seq start 1001;

create table if not exists support_tickets (
  id                       uuid primary key default gen_random_uuid(),
  number                   int not null unique default nextval('support_ticket_seq'),
  user_id                  uuid not null references profiles(id) on delete cascade,
  order_id                 uuid references orders(id) on delete set null,
  wallpaper_id             uuid references wallpapers(id) on delete set null,
  category                 ticket_category not null,
  subject                  text not null check (char_length(subject) between 3 and 140),
  status                   ticket_status not null default 'open',
  priority                 text not null default 'normal' check (priority in ('normal', 'high')),
  assigned_to              uuid references profiles(id) on delete set null,
  ack_due_at               timestamptz not null default now() + interval '48 hours',
  resolve_due_at           timestamptz not null default now() + interval '30 days',
  first_response_at        timestamptz,
  resolved_at              timestamptz,
  resolution               text,
  last_message_at          timestamptz not null default now(),
  last_customer_message_at timestamptz default now(),
  customer_unread          boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
alter sequence support_ticket_seq owned by support_tickets.number;
create index if not exists support_tickets_user_idx  on support_tickets (user_id, created_at desc);
create index if not exists support_tickets_queue_idx on support_tickets (status, last_message_at desc);
create index if not exists support_tickets_order_idx on support_tickets (order_id) where order_id is not null;
create index if not exists support_tickets_assignee_idx on support_tickets (assigned_to) where assigned_to is not null;

create table if not exists support_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references support_tickets(id) on delete cascade,
  author_id   uuid references profiles(id) on delete set null,
  author_role text not null check (author_role in ('customer', 'staff', 'system')),
  body        text not null check (char_length(body) between 1 and 5000),
  internal    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists support_messages_ticket_idx on support_messages (ticket_id, created_at);
create index if not exists support_messages_author_idx on support_messages (author_id) where author_id is not null;

create or replace function public.touch_support_ticket()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists support_tickets_touch on support_tickets;
create trigger support_tickets_touch before update on support_tickets
  for each row execute function public.touch_support_ticket();

alter table support_tickets  enable row level security;
alter table support_messages enable row level security;

create policy "support_tickets: read own" on support_tickets for select
  using (user_id = (select auth.uid()));
create policy "support_tickets: admin read" on support_tickets for select
  using ((select public.is_admin()));
create policy "support_messages: read own public" on support_messages for select
  using (not internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = (select auth.uid())));
create policy "support_messages: admin read" on support_messages for select
  using ((select public.is_admin()));

-- Facts for the self-serve refund rules (decided in src/lib/refund-rules.ts).
create or replace function public.refund_facts(p_order uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'order_id',        o.id,
    'user_id',         o.user_id,
    'status',          o.status,
    'paid_at',         coalesce(o.paid_at, o.created_at),
    'has_payment_id',  o.provider_payment_id is not null,
    'kind', case
      when o.subscription_id is not null then 'autopay'
      when o.gift_email is not null then 'gift'
      when exists (select 1 from public.order_items i where i.order_id = o.id and i.membership_plan_id is not null) then 'membership'
      when exists (select 1 from public.order_items i where i.order_id = o.id and i.credit_pack_id is not null) then 'credit_pack'
      else 'other' end,
    'pack_credits',    (select coalesce(sum(l.delta), 0) from public.credit_ledger l where l.ref_id = o.id and l.reason = 'purchase' and l.bucket = 'paid'),
    'spends_since',    (select count(*) from public.credit_ledger l where l.user_id = o.user_id and l.reason = 'spend' and l.created_at >= coalesce(o.paid_at, o.created_at)),
    'paid_balance',    (select coalesce(sum(l.delta), 0) from public.credit_ledger l where l.user_id = o.user_id and l.bucket = 'paid'),
    'gift_status',     (select g.status from public.gift_codes g where g.order_id = o.id),
    'membership_used', (select m.period_used + m.downloads_used from public.memberships m where m.order_id = o.id),
    'membership_status', (select m.status from public.memberships m where m.order_id = o.id)
  )
  from public.orders o
  where o.id = p_order
$$;

revoke execute on function public.refund_facts(uuid) from public, anon, authenticated;
grant execute on function public.refund_facts(uuid) to service_role;

-- Retention (Privacy Policy): support requests are kept 3 years after they're
-- resolved/closed, unless linked to an order (kept with the order's tax record).
create or replace function public.support_retention()
returns int
language sql security definer set search_path = public
as $$
  with gone as (
    delete from public.support_tickets
    where status in ('resolved', 'closed') and order_id is null
      and coalesce(resolved_at, updated_at) < now() - interval '3 years'
    returning 1
  )
  select count(*)::int from gone
$$;
revoke execute on function public.support_retention() from public, anon, authenticated;
grant execute on function public.support_retention() to service_role;
