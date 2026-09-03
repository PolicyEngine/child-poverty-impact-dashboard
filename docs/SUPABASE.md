# Supabase impact store

A durable second cache layer behind the Modal Dict (`cpid-results-cache`)
in `scripts/modal_cpid_endpoint.py`. Same cache key —
`sha256(CPID_BUILD_REV | kind | canonical payload)` — same
immutable-per-build contract. Modal remains the source of truth: Supabase
is a pure cache, every helper is best-effort, and the dashboard behaves
identically with it off. The frontend never talks to Supabase.

**Status: ACTIVE (2026-09-03).** The store lives in the org's
consolidated Supabase project ("database", ref usugnrssspkdutcjeevk),
which also hosts the core platform schema — hence the `cpid_` table
prefix. The `cpid-supabase` Modal secret is attached and deploys run
with `CPID_ATTACH_SUPABASE=1`.

## What it adds once active

- Results survive Modal Dict eviction — shared deep links stay instant
  indefinitely on the current build.
- Pre-warming: batch-run the default report for all 51 states before
  launch; webinar-day traffic hits stored rows instead of 1–2 min sims.
- On a Dict miss, `_cache_get` falls through to Supabase and backfills
  the Dict.

## Activation (three steps)

1. Apply the schema to the Supabase project:
   [`supabase/schema.sql`](../supabase/schema.sql) (SQL editor or
   `supabase db push`).
2. Create the Modal secret:

   ```
   modal secret create cpid-supabase \
     SUPABASE_URL=https://<project>.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
     CPID_SUPABASE_ENABLED=1
   ```

3. Redeploy with the secret attached (deploy-time opt-in, so today's
   deploys can't fail on a missing secret):

   ```
   CPID_ATTACH_SUPABASE=1 PYTHONUTF8=1 modal deploy scripts/modal_cpid_endpoint.py
   ```

Verify: `GET /healthz` reports `"supabase": "enabled"`, then run any
report twice — the row should appear in `cpid_impact_results` and the second
run should return `cached: true` instantly even after
`modal dict clear cpid-results-cache` (or waiting out Dict eviction).

## Deactivation / kill switch

Any one of: redeploy without `CPID_ATTACH_SUPABASE=1`, set
`CPID_SUPABASE_ENABLED=0` in the secret and redeploy, or delete the
secret. Failures inside the helpers already degrade to plain
Modal-Dict behavior, so an unreachable Supabase never breaks a report.

## Notes

- The service-role key bypasses RLS; the table has RLS enabled with no
  policies so an anon key can read nothing. Keep the service key only in
  the Modal secret — never in Vercel env or the frontend.
- Rows are keyed by build rev. After a pin bump (PE-US, Populace
  revision, or compute-code change bumps `CPID_BUILD_REV`), old rows are
  simply never read again; prune them whenever convenient:
  `delete from cpid_impact_results where build_rev <> '<current>';`
