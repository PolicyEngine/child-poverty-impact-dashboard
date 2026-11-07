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
| Population: total, under 1, under 5, under 6, under 18 | `targets/census_pep_v2025_state_single_age.csv` (Census Vintage 2025 resident population by single year of age, July 1 of the audit year; audits after 2025 use 2025) | exact |
| Child SPM poverty | `targets/census_child_spm.csv` (Census ACS SPM State-by-Age, Under-18, **2023**) | exact measure match (SPM vs SPM) |
| State EITC / CTC cost | `targets/state_credit_costs.csv` (hand-compiled) | **INCOMPLETE** — see caveat |

### Caveats

- **Cost targets are the weak link.** There is no clean per-state dataset of
  *actual* state EITC/CTC program expenditure — they live in each state's tax
  expenditure / budget reports. `targets/state_credit_costs.csv` is a stub to
  be filled best-effort; PE costs are reported regardless, with `pct_diff`
  only where a target is present.
- **Vintage**: a 2026 audit compares with Census's 2025 population estimates
  and with 2023 poverty targets, so part of its % diff is vintage drift (e.g.
  post-ARPA child poverty rose after 2021-2023). The `target_year` column
  records the population year.
- **Approximate age targets**: `state_populations_poverty.csv`, `_buildp` and
  `_populace` compare under-18 with ages 0-19 and under-6 with ages 0-4 plus a
  fifth of ages 5-9, from the data repo's five-year brackets (columns ending
  `_approx`). Against Census's exact counts for 2024, Build P's slices hold
  10% more children under 18 (`ANALYSIS_CENSUS_AGE_1528.md`).
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

## Census age checks (`census_age_fit.py`, `census_age_reweight_modal.py`)

`census_age_fit.py` scores any audit output's ages against the Census single
years, and `census_age_reweight_modal.py` projects Census-correct ages onto a
slice set: it reweights each state's 2024 household weights to Census's age
groups, holds the slice's SNAP, Medicaid, AGI, EITC and CTC aggregates, and
simulates the result. `ANALYSIS_CENSUS_AGE_1528.md` has the results.

```bash
python analysis/state_audit/census_age_fit.py --year 2024 \
    buildp_18252=state_audit_buildp_v2_2024_raw.json
AUDIT_PE_US=1.825.2 AUDIT_SPM_CALC=0.3.1 \
    AUDIT_PE_US_SPEC="policyengine-us @ git+https://github.com/PolicyEngine/policyengine-us@9f77bffb6b" \
    modal deploy analysis/state_audit/census_age_reweight_modal.py
python analysis/state_audit/census_age_reweight_modal.py spawn 1.825.2 592ae5d6 buildp_18252
python analysis/state_audit/census_age_reweight_modal.py collect buildp_18252
python analysis/state_audit/census_age_reweight_summary.py buildp_18252 \
    --audit-2024 state_audit_buildp_v2_2024_raw.json \
    --audit-2026 state_audit_buildp_v2_2026_raw.json
```

`concentration_state` in the same app repeats the balance and measures the
concentration of the weights before and after it: Kish effective sample, the
top 1% of households' share of the weight, and the share that households on
the ASEC-by-PUF spine hold. It also simulates the universal $2,000 allowance
for each child under 4 in 2026 on both datasets in every state and records how
many sample households account for the children it lifts out of SPM poverty.
`weight_concentration_summary.py` refuses unless the run's Kish values, 2026
counts of children under 4, 2026 child SPM poverty and Indiana's cost match
the projection run's. For a slice set with no projection run, `--audit-label`
checks the run's year, slice tag, pin, household counts and child SPM poverty
against that audit sweep instead.

```bash
python analysis/state_audit/census_age_reweight_modal.py spawn-concentration 1.825.2 592ae5d6 buildp_18252
python analysis/state_audit/census_age_reweight_modal.py collect-concentration buildp_18252
python analysis/state_audit/weight_concentration_summary.py buildp_18252
python analysis/state_audit/census_age_reweight_modal.py spawn-concentration 1.825.2 766b7c7 buildo_18252
python analysis/state_audit/census_age_reweight_modal.py collect-concentration buildo_18252
python analysis/state_audit/weight_concentration_summary.py buildo_18252 --audit-label o1017_18252
```
