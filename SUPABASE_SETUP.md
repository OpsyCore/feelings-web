# FEELINGS — Supabase setup

This project is wired for the existing FEELINGS Supabase project.

## Public browser variables

```env
VITE_SUPABASE_URL=https://wsyfeitsqrxmvrjrghey.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
VITE_SUPABASE_SCHEMA_REVIEWED=false
```

## Server-only variable

Configure `DATABASE_URL` as a server-side secret using the Supabase PostgreSQL pooler connection string. Never put it in a `VITE_*` variable and never commit its password.

## Safe rollout

1. Run `node scripts/inspect-supabase.mjs` with the server-only `DATABASE_URL`.
2. Compare the generated report with `docs/DATABASE_SCHEMA.md`.
3. Reconcile the remote schema before applying `supabase/migrations/0003_web_completion.sql`.
4. Apply only additive/compatible changes.
5. Verify Auth, RLS, Storage and Realtime with real test accounts.
6. Set `VITE_SUPABASE_SCHEMA_REVIEWED=true` only after the remote review and migration are complete.

The migration is intentionally not applied by this source package.
