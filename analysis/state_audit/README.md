# State Dataset Audit

Validates the per-state datasets that power the dashboard against external
targets: population counts, SPM child-poverty rates, and the budgetary cost
of each state's EITC and CTC, each with a percent difference. The current
audit is `state_audit_py_modal.py` (below); the sections after it describe
the earlier audits whose outputs remain in `output/`.

## Current audit: policyengine.py (`state_audit_py_modal.py`)

The backend runs on policyengine.py: its bundle pins policyengine-us and
certifies the dataset US state regions use. This audit builds the per-state
files from that dataset exactly as `scripts/build_populace_state_slices.py`
does, on an ephemeral Modal Volume (nothing in production is read or
written), and runs every simulation through the endpoint's own
`_state_microsimulation`. The 2026-10-28 run (label `py6111`) is summarized
in the pull request that moved the backend onto policyengine.py (issue #126).

```bash
cd frontend && npm run manifest && cd ..   # only needed for --reforms
PYTHONUTF8=1 modal run analysis/state_audit/state_audit_py_modal.py \
    --label py6111 --years 2024,2026 --reforms
python analysis/state_audit/compare_child_spm.py --old buildp_v2 --new py6111 --year 2024
python analysis/state_audit/summarize_sweep.py --labels buildp_v2,py6111 --year 2024
python analysis/state_audit/build_csvs.py --raw state_audit_py6111_2026_raw.json --suffix _py6111
```

- `output/state_audit_{label}_{year}_raw.json` uses the dataset-adoption
  sweep's fields, so `summarize_sweep.py` and `build_csvs.py` read it. SPM
  rates count measured people only: policyengine.py declares ACS
  group-quarters SPM units outside measurement for this dataset.
- `--reforms` runs the endpoint's `compute_economy` for each `single-edited`
  and `combo` entry of the frontend coverage manifest at 2026, with cache and
  Supabase writes disabled, and writes `output/reform_compute_{label}_2026.json`.
- The local client must stay alive for the whole run; the ephemeral Volume
  is deleted when it exits.

## Earlier audits

The audits below ran plain policyengine-us on the
`hf://policyengine/policyengine-us-data/states/{ST}.h5` files and on the
Microcosm slices before the backend moved to policyengine.py.

### Run

```bash
# 1. Compute PE values for all 51 states (parallel on Modal, ~10-20 min)
PYTHONUTF8=1 modal run analysis/state_audit/state_audit_modal.py --year 2026
#    -> output/state_audit_raw.json
#    (dry-run a few: --states CA,TX,VT)

# 2. Merge with targets and write the two deliverable CSVs
python analysis/state_audit/build_csvs.py
#    -> output/state_populations_poverty.csv
#    -> output/state_credit_costs.csv
```

### Outputs

- **`output/state_populations_poverty.csv`** — per state: PE population
  (total, under-1, under-5, under-6, under-18) and SPM poverty rates (child,
  young child <6, under-1, deep child, all-ages), with target + `pct_diff`
  where a target exists.
- **`output/state_credit_costs.csv`** — per state with an EITC and/or CTC:
  PE program cost (the static repeal budgetary impact) with target + `pct_diff`.

### How values are computed (`state_audit_modal.py`)

- **Population**: weighted (`person_weight`) counts by age mask.
- **Poverty**: `in_poverty` / `in_deep_poverty` are the **SPM** measure
  (SPMUnit-based), mapped to persons, weighted; rate per age group.
- **Credit cost**: the `state_eitc` / `state_ctc` aggregates `adds` *every*
  state's credit variables, so on one state's reweighted dataset they sum
  credits from other states (and some taxsim components fire universally) —
  inflated 3-10×. Instead we sum only **this state's own** credit variables,
  filtered from the year's `gov.states.household.state_eitcs` /
  `state_ctcs` lists by prefix. PolicyEngine scores reforms statically (no
  behavioral response), so the program total IS the repeal budgetary impact.

### Targets

| Metric | Target source | Status |
|---|---|---|
| Total population | `population_by_state.csv` (data repo calibration) | exact |
| Under-5 population | `population_by_state.csv` `population_under_5` | exact |
| Under-6 / under-18 population | `age_state.csv` 5-yr brackets | **approximate** (15-19 bracket overcounts 18-19yo; under-6 ≈ 0-4 + ⅕·5-9) |
| Under-1 population | — | no target (PE only) |
| Child SPM poverty | `targets/census_child_spm.csv` (Census ACS SPM State-by-Age, Under-18, **2023**) | exact measure match (SPM vs SPM) |
| State EITC / CTC cost | `targets/state_credit_costs.csv` (hand-compiled) | **INCOMPLETE** — see caveat |

### Caveats

- **Cost targets are the weak link.** There is no clean per-state dataset of
  *actual* state EITC/CTC program expenditure — they live in each state's tax
  expenditure / budget reports. `targets/state_credit_costs.csv` is a stub to
  be filled best-effort; PE costs are reported regardless, with `pct_diff`
  only where a target is present.
- **Vintage**: PE values are 2026; population and poverty targets are 2023-24.
  Some of the % diff is genuine vintage drift (e.g. post-ARPA child poverty
  rose after 2021-2023).
- **Child population cuts** (under-1/under-6/under-18) have no exact
  calibration target; only total and under-5 are exact.
- **State datasets are calibrated to population / AGI / SNAP, not poverty**,
  so a poverty gap vs the Census target is one plausible source of the
  divergence — alongside vintage (2026 vs 2023) and measure differences. The
  divergence is something to investigate, not a confirmed PolicyEngine error.

### Dataset-adoption sweep (`state_audit_sweep_modal.py`)

The adoption gate for a new local-area release. It audits two slice sets under
any policyengine-us pins with identical code, so a candidate is compared with
production on the same yardstick. Results from the 2026-10-20 run are in
`ANALYSIS_BUILDO_1017.md`.

```bash
# 1. Slice sets on the cpid-populace-slices Volume (the 10/20 run used the
#    592ae5d6 and 766b7c7 directories written by the earlier slicer).
# 2. One audit app per policyengine-us pin:
AUDIT_PE_US=2.30.1 modal deploy analysis/state_audit/state_audit_sweep_modal.py
# 3. Spawn 51 states x years per (pin, slice set), then collect:
python analysis/state_audit/sweep_jobs.py spawn 2.30.1 766b7c7 o1017_2301
python analysis/state_audit/sweep_jobs.py collect o1017_2301
# 4. Score and decompose:
python analysis/state_audit/summarize_sweep.py --labels buildp_v2,o1017_2301 --year 2024
python analysis/state_audit/decompose_sweep.py
```

- **Benchmarks**: `targets/census_child_spm_cps3yr_2023_2025.csv` (Census
  P60-290 Table 18, CPS 3-year average with margins of error) is the headline
  child-SPM target. The ACS 2023 table is kept for continuity; ACS-based SPM
  runs systematically higher than CPS.
- **Group quarters**: "measured" rates drop ACS group-quarters SPM units, the
  rule policyengine.py applies, since plain policyengine-us does not yet scope
  SPM measurement (policyengine-us#9462).
- **Run with deploy + spawn**: a long `modal run` depends on its local client;
  if that process dies, Modal cancels the remote job.
