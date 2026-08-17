-- CPID durable impact store (dark until launch week).
--
-- One row per computed result, keyed by the same cache key the Modal
-- backend already uses: sha256(CPID_BUILD_REV | kind | canonical payload).
-- The build rev pins policyengine-us, the Populace revision, and the
-- compute code, so rows are immutable — a new build starts a fresh
-- keyspace and old rows just age out unused.
--
-- Apply with: supabase db push, or paste into the SQL editor.

create table if not exists impact_results (
  cache_key text primary key,
  kind text not null check (kind in ('economy', 'household')),
  build_rev text not null,
  state text,
  year int,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- The Modal backend is the only client and uses the service-role key,
-- which bypasses RLS. Enable RLS with no policies so the anon key can
-- read nothing if it ever leaks into a frontend bundle.
alter table impact_results enable row level security;

-- Launch-day queries: everything for the current build, newest first.
create index if not exists impact_results_build_rev_idx
  on impact_results (build_rev, created_at desc);
