# Build O rebuild sweep (2026-10-20)

Candidate dataset: `populace-us-2024-buildo-acs-local-766b7c7-20261017T030317Z`
(microcosm#1263 rebuild, certified in policyengine.py #649 with policyengine-us
2.2.1), sliced to `cpid-populace-slices/766b7c7/` (51 files, 10,978 MB, exact
partition). Compared against production: Build P slices (`592ae5d6`) under
policyengine-us 1.825.2 (installed from its release commit `9f77bffb6b`, since
1.825.2 is no longer on PyPI).

All poverty rates mask ACS group quarters (TYPEHUGQ 2/3), which are outside
Census's ACS SPM universe — the same rule policyengine.py applies. Masking moves
child rates negligibly (group quarters are ~0.2% of people and ~0.002% of
children). Tooling: `state_audit_sweep_modal.py`, `summarize_sweep.py`,
`decompose_sweep.py`; raw results in `output/state_audit_{label}_{year}_raw.json`.

## Summary

The new data is sound. At its base year (2024), and under policyengine-us 2.x,
it fits Census state child poverty better than production. The dashboard can
only use it under 2.x, which projects a different path than the production
model: child poverty rises about 2.3 points from 2024 to 2026, where production
is flat. In 2025 the 2.x path sits 1.1 points above Census's measured rate. The
2026 baseline would move from 13.1% to 15.5%, so reform impacts and baselines
would change visibly for dashboard users. The release also has a version
ceiling (it loads only through policyengine-us 2.30.1).

## National child SPM poverty (%)

| | 2024 | 2025 | 2026 |
|---|---|---|---|
| Census (P60-290) | 13.5 (re-based) | 13.4 | — |
| Production: Build P @ 1.825.2 | 13.24 | 13.25 | 13.06 |
| New data @ 1.825.2 | 13.76 | 13.64 | 13.34 |
| New data @ 2.2.1 (certified) | 13.43 | — | 15.35 |
| New data @ 2.30.1 (candidate) | 13.15 | 14.53 | 15.48 |

Change versus production, decomposed into data (new data on the old model) and
model (2.30.1 vs 1.825.2 on the new data):

| | Total | Data | Model |
|---|---|---|---|
| 2024 | −0.09 | +0.52 | −0.61 |
| 2025 | +1.28 | +0.39 | +0.89 |
| 2026 | +2.42 | +0.28 | +2.14 |

The data effect is small and steady. The model effect flips sign after the base
year and grows with each projection year. In 2025, the only projection year
with Census ground truth, the 2.x path is 1.1 points above Census while the
production model is within 0.25; PolicyEngine's registered 2025 prediction from
the same engine showed the same direction (+0.9 points; Census measured −0.1).
One year is a thin basis for judging the 2026–2028 path, which also carries
policy changes (for example OBBBA and SNAP rule changes) that the two models
may treat differently.

## State fit, 2024 (vs Census P60-290 Table 18, CPS 3-year average 2023–25)

| | Median % diff | Within ±25% | Within Census MOE | Mean abs error (pp) |
|---|---|---|---|---|
| Production | −0.6% | 27/51 | 24/51 | 2.81 |
| New data @ 1.825.2 | −0.7% | 27/51 | 22/51 | 3.13 |
| New data @ 2.2.1 | −0.6% | 31/51 | 26/51 | 2.57 |
| New data @ 2.30.1 | +0.7% | 32/51 | 28/51 | 2.63 |

The better cross-state fit comes from the 2.x model, not the data: on the old
model the new data fits slightly worse than Build P. The biggest state moves
under 2.x mostly correct production's largest misses (DC 10.7 → 20.6 vs Census
20.3; IL 18.1 → 13.4 vs 12.4; AZ 16.8 → 13.1 vs 13.3; RI 14.9 → 9.6 vs 8.4),
while opening new gaps in GA, WA and PA.

## Program totals, 2024 ($ billions)

| | Social Security | SNAP benefits | SSI | Federal EITC |
|---|---|---|---|---|
| Benchmark | ~1,470 (OASDI CY2024) | 93.7 (FY2024) | — | — |
| Production | 1,258.0 (−14%) | 100.9 (+8%) | 43.9 | 66.1 |
| New data | 1,201.9 (−18%) | 93.7 (≈0%) | 43.8 | 66.2 |

Sources: 2025 OASDI Trustees Report (benefits paid in CY2024: $1.47 trillion);
USDA ERS, *Food and Nutrition Assistance Landscape, FY2024* (SNAP benefits $93.7
billion of $100.3 billion federal spending). The new data hits SNAP benefits
almost exactly. Its Social Security total is $56 billion lower than production's,
consistent with the disclosed inherited erasure (microcosm#1178), which awaits a
national rebuild as donor. SSI remains about 28% under SSA in both.

## Reform impacts (restore 2021 CTC, national child SPM change, pp)

| | 2024 | 2026 |
|---|---|---|
| Production | −3.62 | −3.45 |
| New data @ 2.30.1 | −3.56 | −4.11 |

Nationally the impact is stable at the base year. By 2026 it is larger under
2.x, because the higher projected baseline puts more children near the
threshold. State-level impacts shift substantially: AZ −10.3 → −3.8, DC −1.3 →
−8.1, NC −2.9 → −6.3 (2024).

## Other findings

- **Version ceiling.** The release loads on policyengine-us 2.2.1 through
  2.30.1. From 2.30.2 on (PolicyEngine/policyengine-us#9406, 2026-10-07),
  `parent_1_id` is a model input, and the release stores it with blanks, so
  loading fails (`Unable to set value for variable "parent_1_id", as the input
  contains NaN values`). The current release (2.50.1) cannot load it.
- **Version drift within 2.x.** Between 2.2.1 and 2.30.1 on identical data,
  state child poverty moves by up to 3.6 points in 2026 (KY 9.7 → 13.3), and
  state reform impacts by up to 3.5 points.
- **Unpinned dependencies.** Re-running production's exact model and data in a
  fresh image moved CA 2024 child poverty by 0.5 points (17.6 → 17.1), most
  likely through `policyengine-core`, which the backend does not pin.
- **Production image risk.** policyengine-us 1.825.2 has been removed from PyPI.
  The backend's cached Modal image still works, but a rebuild needs the
  `git+https://github.com/PolicyEngine/policyengine-us@9f77bffb6b` fallback.

## Adoption considerations

1. **Projection path.** Adopting under 2.x moves the 2026 child-poverty baseline
   from 13.1% to about 15.5% and enlarges reform impacts (restore 2021 CTC:
   −3.45 → −4.11 points nationally). If adopted, the methodology page should
   state the change and note the 2025 comparison with Census.
2. **Version ceiling.** Refresh the release against a current policyengine-us, or
   fill `parent_1_id` blanks, so the dashboard is not capped at 2.30.1.
3. **Pin `policyengine-core`** alongside `policyengine-us` in the backend image.
4. **Social Security** stays about 18% under SSA until the release is refreshed
   against a national donor built after microcosm#1186.
