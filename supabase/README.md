# Supabase — database

Phase 1 schema, Row Level Security and seed data for HirecWallp.

## Files

| File | Purpose |
|---|---|
| `migrations/0001_phase1_init.sql` | Extensions, enums, tables, indexes, functions, triggers |
| `migrations/0002_phase1_rls.sql` | `enable row level security` + policies on every table |
| `seed/seed.sql` | Regions, global price rules, credit packs, launch categories |

## Applying

With the Supabase CLI (preferred) against a local or linked project:

```bash
supabase db reset            # applies migrations/ in order, then seed
# or apply individually:
psql "$DATABASE_URL" -f supabase/migrations/0001_phase1_init.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_phase1_rls.sql
psql "$DATABASE_URL" -f supabase/seed/seed.sql
```

## Security model (summary)

- **Deny by default.** The `service_role` key bypasses RLS and is used **only**
  on the server for privileged flows (payment webhooks, credit spend, issuing
  signed download URLs, admin writes).
- Public/auth roles get the minimum: published catalogue + **public-bucket
  previews only**. Private-bucket (original) asset rows are never selectable by
  anon/auth — only `service_role` reaches them to mint a 60-second signed URL.
- Each user reads only their own `orders`, `order_items`, `entitlements`,
  `credit_ledger`, `downloads`, `price_quotes`.
- Admin access is gated by `public.is_admin()` (a server-side role check), not
  hidden UI.

## Decisions flagged for owner confirmation

1. **Price unit convention** — money regions (IN) store rules/prices in **rupees**
   (snap points 9/19/29…); conversion to minor units (paise) happens at the
   payment boundary. Credit regions store whole credits. Confirm this split.
2. **Region ↔ currency** — a credit region (e.g. `T1`) carries multiple credit
   packs in different currencies (GBP/USD/EUR). `regions.currency` is only a
   default label. Confirm this is acceptable vs. splitting T1 per currency.
3. **Sample wallpapers** — the 20 seed wallpapers need real image assets, so they
   load through the admin upload flow (not `seed.sql`).
