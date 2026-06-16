# State Dataset Audit

Validates the per-state PolicyEngine datasets
(`hf://policyengine/policyengine-us-data/states/{ST}.h5`) that power the
dashboard. For all 50 states + DC at **2026** it reports population counts,
SPM child-poverty rates, and the budgetary cost of each state's EITC and CTC,
each compared to an external target with a percent difference.

## Run

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

## Outputs

- **`output/state_populations_poverty.csv`** — per state: PE population
  (total, under-1, under-5, under-6, under-18) and SPM poverty rates (child,
  young child <6, under-1, deep child, all-ages), with target + `pct_diff`
  where a target exists.
- **`output/state_credit_costs.csv`** — per state with an EITC and/or CTC:
  PE program cost (the static repeal budgetary impact) with target + `pct_diff`.

## How values are computed (`state_audit_modal.py`)

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

## Targets

| Metric | Target source | Status |
|---|---|---|
| Total population | `population_by_state.csv` (data repo calibration) | exact |
| Under-5 population | `population_by_state.csv` `population_under_5` | exact |
| Under-6 / under-18 population | `age_state.csv` 5-yr brackets | **approximate** (15-19 bracket overcounts 18-19yo; under-6 ≈ 0-4 + ⅕·5-9) |
| Under-1 population | — | no target (PE only) |
| Child SPM poverty | `targets/census_child_spm.csv` (Census ACS SPM State-by-Age, Under-18, **2023**) | exact measure match (SPM vs SPM) |
| State EITC / CTC cost | `targets/state_credit_costs.csv` (hand-compiled) | **INCOMPLETE** — see caveat |

## Caveats

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
  so poverty divergence vs the Census target is expected and is a key finding
  of this audit.
