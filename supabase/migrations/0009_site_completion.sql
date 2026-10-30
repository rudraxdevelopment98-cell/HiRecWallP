-- =============================================================================
-- HirecWallp — site completion (docs/SITE_AUDIT.md)
--   * public size metadata on wallpapers (explore filters, "sizes included")
--   * favourites, newsletter sign-ups, contact messages
--   * sequential invoice numbers for paid orders (GST-ready receipts)
-- =============================================================================

-- --- Public size metadata (filled at upload from the generated variants) ------
alter table wallpapers
  add column orientation   text check (orientation in ('portrait', 'landscape', 'square')),
  add column max_long_edge int,
  add column devices       text[] not null default '{}';  -- e.g. {phone,tablet} / {desktop_4k,desktop_5k}
create index wallpapers_orientation_idx on wallpapers (orientation);
create index wallpapers_devices_idx on wallpapers using gin (devices);

-- --- Favourites ---------------------------------------------------------------
create table favourites (
  user_id      uuid not null references profiles(id) on delete cascade,
  wallpaper_id uuid not null references wallpapers(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, wallpaper_id)
);
alter table favourites enable row level security;
create policy "favourites: read own"   on favourites for select using (user_id = auth.uid());
create policy "favourites: add own"    on favourites for insert with check (user_id = auth.uid());
create policy "favourites: remove own" on favourites for delete using (user_id = auth.uid());
revoke update on table favourites from anon, authenticated;

-- --- Newsletter sign-ups (written by the server; admin reads/exports) --------
create table newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  source     text,
  created_at timestamptz not null default now()
);
alter table newsletter_subscribers enable row level security;
create policy "newsletter: admin read" on newsletter_subscribers for select using (public.is_admin());

-- --- Contact messages (separate from takedown reports) -----------------------
create type message_status as enum ('new', 'replied', 'closed');
create table contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  message    text not null,
  user_id    uuid references profiles(id) on delete set null,
  status     message_status not null default 'new',
  created_at timestamptz not null default now()
);
create index contact_messages_status_idx on contact_messages (status, created_at desc);
alter table contact_messages enable row level security;
create policy "contact_messages: admin read" on contact_messages for select using (public.is_admin());

-- --- Invoice numbers ----------------------------------------------------------
-- Sequential per financial record; assigned once when an order is paid.
create sequence invoice_seq;
alter table orders
  add column invoice_no  text unique,
  add column buyer_gstin text,
  add column paid_at     timestamptz;

create or replace function public.assign_invoice(p_order uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_no text;
begin
  update public.orders o
     set invoice_no  = coalesce(o.invoice_no, 'HW-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 6, '0')),
         paid_at     = coalesce(o.paid_at, now()),
         buyer_gstin = coalesce(o.buyer_gstin, (select p.gstin from public.profiles p where p.id = o.user_id))
   where o.id = p_order and o.status = 'paid'
  returning invoice_no into v_no;
  return v_no;
end;
$$;
revoke execute on function public.assign_invoice(uuid) from public, anon, authenticated;
grant execute on function public.assign_invoice(uuid) to service_role;

-- --- Global base prices are shown on the storefront, so they are public -------
create policy "price_rules: public read global" on price_rules
  for select using (scope = 'global');
