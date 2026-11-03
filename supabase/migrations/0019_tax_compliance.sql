-- =============================================================================
-- HirecWallp — tax compliance (2026-11-03)
-- * Creator tax details for TDS on payouts (Income-tax Act 2025, s.393):
--   PAN, residency and entity type. PAN is visible to the creator and admins only.
-- * Payout rows record the TDS deducted (sales: Table 8(v), ex-194-O;
--   affiliate commission: Table 1(ii), ex-194H) and the financial year.
-- * Sales register helper for the admin Tax Centre (service role only).
-- ⚠️ Rates/thresholds live in site_settings.tax and are owner-editable.
-- =============================================================================

alter table creators
  add column if not exists pan         text check (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  add column if not exists tax_resident text not null default 'IN' check (tax_resident in ('IN', 'foreign')),
  add column if not exists entity_type text not null default 'individual' check (entity_type in ('individual', 'huf', 'firm', 'company'));

alter table creator_payouts
  add column if not exists affiliate      numeric not null default 0,
  add column if not exists tds_sales      numeric not null default 0,
  add column if not exists tds_commission numeric not null default 0,
  add column if not exists financial_year text,
  add column if not exists tax_note       text;

-- Financial year label (Apr–Mar, India) for a timestamp, e.g. '2026-27'.
create or replace function public.fy_label(p_at timestamptz)
returns text language sql immutable set search_path = public
as $$
  select case when extract(month from (p_at at time zone 'Asia/Kolkata')) >= 4
    then extract(year from (p_at at time zone 'Asia/Kolkata'))::int || '-' || lpad(((extract(year from (p_at at time zone 'Asia/Kolkata'))::int + 1) % 100)::text, 2, '0')
    else (extract(year from (p_at at time zone 'Asia/Kolkata'))::int - 1) || '-' || lpad((extract(year from (p_at at time zone 'Asia/Kolkata'))::int % 100)::text, 2, '0')
  end
$$;

-- Paid/refunded orders in a window, for the sales register and turnover monitor.
create or replace function public.admin_sales_register(p_from timestamptz, p_to timestamptz)
returns table (
  order_id uuid, invoice_no text, paid_at timestamptz, status text, currency text, amount_minor int,
  billing_country text, buyer_gstin text, email text, kind text
)
language sql stable security definer set search_path = public
as $$
  select o.id, o.invoice_no, coalesce(o.paid_at, o.created_at), o.status::text, o.currency, o.amount_minor,
         o.billing_country, o.buyer_gstin, p.email,
         case when o.subscription_id is not null then 'autopay'
              when o.gift_email is not null then 'gift'
              when exists (select 1 from public.order_items i where i.order_id = o.id and i.membership_plan_id is not null) then 'membership'
              when exists (select 1 from public.order_items i where i.order_id = o.id and i.credit_pack_id is not null) then 'credits'
              else 'other' end
  from public.orders o
  left join public.profiles p on p.id = o.user_id
  where o.status in ('paid', 'refunded')
    and coalesce(o.paid_at, o.created_at) >= p_from and coalesce(o.paid_at, o.created_at) < p_to
  order by coalesce(o.paid_at, o.created_at);
$$;

revoke execute on function public.admin_sales_register(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_sales_register(timestamptz, timestamptz) to service_role;
grant execute on function public.fy_label(timestamptz) to service_role, authenticated;
