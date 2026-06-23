# Reform-option scorecard

Standardized validation of the dashboard's reform options — do they produce
**plausible cost, poverty, distributional, and inequality impacts**? This applies
the methodology of PolicyEngine's [`/analyze-policy`](https://github.com/PolicyEngine/policyengine-claude/blob/main/commands/analyze-policy.md)
command (its `microsim-runner` agent) to our own option set.

It complements the compute guardrail in `tests/calculations/test_reform_computes.py`:
that proves every option *computes*; this proves the *numbers are sane* (non-zero,
right sign, in line with PolicyEngine priors).

## How it works

1. **Scenarios** — `npm run score-scenarios` (in `frontend/`) emits
   `score-scenarios.json`: a representative set of options, each with a
   *meaningful* configuration (not the no-op default), a `region` (state or `us`),
   and a `direction` (`expansion` → cost↑/poverty↓, `repeal` → revenue↑/poverty↑).
   The reform-dicts come from the same `buildReformDict` the dashboard ships.
2. **Score** — `score_reforms.py` POSTs each reform to `api.policyengine.org`,
   runs an economy-wide simulation over the current-law baseline for the region,
   and extracts budgetary, poverty (all/child/adult/senior + deep), inequality
   (Gini, top-share), and distributional impacts.
3. **Validate** — each result is checked against a curated prior anchor
   (`anchors.yaml`) or, lacking one, direction-aware sanity rules, yielding
   **PASS / PASS-WITH-NOTES / INVESTIGATE** (mirroring `reform-comparator`).
4. **Report** — `REPORT.md` (scannable table) + `results.json`; full raw API
   results are cached under `results/` (git-ignored).

## Run it

```bash
cd frontend && npm run score-scenarios && cd ..
pip install requests pyyaml
python analysis/reform_scores/score_reforms.py            # all scenarios
python analysis/reform_scores/score_reforms.py --only federal_ctc_expanded   # one
python analysis/reform_scores/score_reforms.py --offline  # re-render from cache
```

Runtime: ~7 min/federal scenario, ~20 min/state scenario (server-side compute).
This is an **on-demand / scheduled** artifact, not a per-PR gate — run it via the
`reform-scores` GitHub Actions workflow (`workflow_dispatch`).

## Adding a scenario

Add an entry to `DEFS` in `frontend/scripts/dump-score-scenarios.ts` (id, label,
option id, `direction`, optional `state` and `params`), re-run
`npm run score-scenarios`. Add a prior anchor to `anchors.yaml` if a published
score exists.

## Caveats

- The API scores on the **national Enhanced CPS filtered by `region`**; the
  dashboard ships **per-state ECPS via Modal**, so absolute figures can differ.
  This is an external sign/magnitude + prior-agreement check, not a reproduction
  of the dashboard's exact numbers. (A future pass can cross-check Modal vs API.)
- Single-year static analysis; cost is **annual**, not 10-year.
- `INVESTIGATE` flags an implausible-looking score (wrong sign, no effect, or far
  from a prior) — investigate with a full `/analyze-policy "<reform>"` deep-dive.
