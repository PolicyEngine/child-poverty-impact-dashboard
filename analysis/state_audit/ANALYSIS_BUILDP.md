# Build P production audit (2026-08-20)

Same metrics as the #61/#64 audits, run against what production now
serves: the Microcosm Build P ACS-local slices
(`cpid-populace-slices/592ae5d6`, release
`populace-us-2024-buildp-acs-local-592ae5d6-20260819T020303Z`) under
policyengine-us 1.808.0, at the dashboard's analysis year (2026).
Deliverables: `output/state_populations_poverty_buildp.csv`,
`output/state_credit_costs_buildp.csv` (the `_populace` files remain the
sparse-pin record for comparison).

## Headlines

- **Population**: median +0.9% vs calibration targets — well calibrated.
- **Child SPM, 2026 vs Census 2023: median −19.5%** (26/51 within ±25%).
  Read this together with the same-year check: at **2024** — the year the
  dataset represents and the Census-comparable year — Build P's child SPM
  runs **median +4.7%** vs Census with 28/51 states within ±25% (the
  corrected 8/20 sweep). The 2026 gap is dominated by REAL law changes
  between 2023 and 2026 (OBBBA's $2,200 CTC, SNAP rule changes, new state
  childcare programs) plus projection uncertainty — not dataset
  miscalibration. Outliers both directions: VT +155%, ME +54% hot;
  AR −68%, HI −61%, MI −54% cold.
- **State EITC cost (2026 vs recent official)**: median **+2.4%**, 23/29
  within ±25% — the best EITC cost fit of any dataset audited (sparse pin:
  median −11%). Worst: DE +176% (revenue-estimate target), OK −32%
  (TY2022 target vintage).
- **State CTC cost**: median **+33.2%**, 7/19 within ±25% — the known
  refundable-child-credit take-up class (microcosm pays every eligible
  unit; real take-up ~50–75%) plus stale targets (MD +399% vs a TY2023
  first-year actual; CO targets predate the 2024 restructure). UT −32% is
  a claimed-vs-used target-concept artifact per the 8/20 benchmark audit.

## Standing caveats

- SSI is uncalibrated on the ACS-local arm (−33% median in the 2024
  sweep) — deep-poverty and SSI-interacting results carry that bias.
- Dataset transition note: the dashboard switched from the sparse
  populace pin to Build P on 2026-08-20. Reform impacts changed with the
  recalibration — e.g. restore-2021-CTC in CA: −6.5pp child poverty on
  the sparse pin → −4.2pp on Build P (the sparse pin over-concentrated
  CTC-responsive households; Build P's federal credit surfaces are
  calibrated essentially exactly by state).
