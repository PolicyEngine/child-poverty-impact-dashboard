# Reform-option scorecard

Validates the **dashboard's own computed scores** — do the cost, poverty, and
distributional impacts our Modal per-state backend produces line up with
**external prior estimates**? It scores each reform through the same backend the
dashboard ships, then checks it against priors gathered the way PolicyEngine's
[`/analyze-policy`](https://github.com/PolicyEngine/policyengine-claude/blob/main/commands/analyze-policy.md)
`prior-scores-finder` agent does.

It complements `tests/calculations/test_reform_computes.py`: that proves every
option *computes*; this proves the dashboard's *numbers are sane and match
published estimates*.

## How it works

1. **Scenarios** — `npm run score-scenarios` (in `frontend/`) emits
   `score-scenarios.json`: a representative set of options, each with a meaningful
   config, the `state` it's evaluated in, a `scope` (federal/state), and a
   `direction`. Reform-dicts come from the shipped `buildReformDict`.
2. **Score (dashboard)** — `score_reforms.py` POSTs each reform to the
   dashboard's Modal `/economy` endpoint (per-state ECPS — *the numbers users
   see*) and extracts child/overall poverty, cost, and Gini.
3. **Priors** — `priors.yaml` holds external estimates (PolicyEngine published
   scores, Census, Columbia CPSP, Niskanen/NBER, think-tank fiscal notes),
   gathered the way `prior-scores-finder` does. Refresh by re-running that
   research (it's an LLM research step, not a deterministic call).
4. **Validate** — compares the dashboard's relative child-poverty reduction to
   the prior band + direction-aware sanity → **PASS / PASS-WITH-NOTES /
   INVESTIGATE**.
5. **Report** — `REPORT.md` + `results.json`; raw results cached under
   `results_dashboard/` (git-ignored).

Optional: `--with-api` adds a PolicyEngine-API column (`api.policyengine.org`) as
a *dashboard-vs-PolicyEngine consistency* reference at the same geography.

## Run it

```bash
cd frontend && npm run score-scenarios && cd ..
pip install requests pyyaml
python analysis/reform_scores/score_reforms.py             # dashboard vs priors
python analysis/reform_scores/score_reforms.py --with-api  # + PolicyEngine-API reference
python analysis/reform_scores/score_reforms.py --offline   # re-render from cache
```

Runtime: each dashboard economy run is ~8–15 min (Modal, per state). On-demand /
scheduled via the `reform-scores` GitHub Actions workflow — not a per-PR gate.
Needs `NEXT_PUBLIC_MODAL_CPID_URL` (defaults to the deployed endpoint).

## Adding a scenario / prior

- Scenario: add to `DEFS` in `frontend/scripts/dump-score-scenarios.ts` (id,
  label, option id, `state`, `scope`, `direction`, optional `params`), re-run
  `npm run score-scenarios`.
- Prior: add the external estimate to `priors.yaml` (run `prior-scores-finder` /
  `/analyze-policy "<reform>"` to source it).

## Cost sweep on a version bump (`sweep_reforms.py`)

The scorecard above validates a representative slice against priors. For a
**policyengine-us version bump** — which will happen a few more times — use the
**cost sweep**, which re-scores **every** configurable option's budgetary cost on
the dashboard backend and diffs against the previous version's snapshot, so a
bump that silently changes a reform's cost is caught.

Flow on a version bump:

```bash
# 1. bump the policyengine-us pin (pyproject.toml / backend/requirements.txt /
#    scripts/modal_cpid_endpoint.py / ci.yml) and redeploy the Modal endpoint:
PYTHONUTF8=1 modal deploy scripts/modal_cpid_endpoint.py
# 2. sweep all reforms at the new version (auto-reads the pin if --label omitted):
cd frontend && npm run manifest && cd ..
python analysis/reform_scores/sweep_reforms.py --label 1.741.0
# 3. review SWEEP.md → "Cost changes vs <prev>" lists any reform whose cost moved.
```

Snapshots are committed at `sweep/<version>.json` (so the next bump has a
baseline to diff against); raw economy dumps under `sweep/cache/` are not.
The full sweep is ~80 economy runs (~1–2h) — run it in the background or via the
`reform-sweep` GitHub Actions workflow (`workflow_dispatch`, takes a version
label). Smoke-test with `--only CA:ca_ctc` or `--limit 3`.

A move beyond ±10% **and** ±$5M vs the baseline snapshot is flagged.

## Caveats

- The dashboard is **per-state**, so a federal reform is evaluated in one state
  and compared to the (national) prior's **relative** child-poverty reduction
  *directionally* — national dollar costs aren't band-checked against a
  single-state run.
- Design must match the prior: e.g. a *universal* child allowance is a different
  reform (and cost) than the *income-tested* ARPA structure most priors score.
- State EITC/CTC tweaks have no published prior — validated by sanity rules and,
  with `--with-api`, dashboard-vs-PolicyEngine-API consistency.
