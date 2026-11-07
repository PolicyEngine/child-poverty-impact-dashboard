# Census-age reweight projection: buildp_18252

Checks passed: 51 states ran and converged; each state's 2024 reweighted counts match Census's to within 1.9e-07 (float32 weights); each state's production figures equal the audit sweep's (state_audit_buildp_v2_2024_raw.json, state_audit_buildp_v2_2026_raw.json).

## Population by age, 2024, against Census Vintage 2025

| Ages | Census | Production | vs Census | Reweighted | vs Census |
|---|---:|---:|---:|---:|---:|
| All ages | 340,003,797 | 331,427,411 | -2.52% | 340,003,801 | +0.00% |
| Under 1 | 3,617,221 | 3,068,753 | -15.16% | 3,617,221 | -0.00% |
| Under 4 | 14,773,579 | 15,176,486 | +2.73% | 14,773,579 | +0.00% |
| Under 5 | 18,584,735 | 19,609,438 | +5.51% | 18,584,735 | -0.00% |
| Under 6 | 22,450,934 | 23,982,286 | +6.82% | 22,450,934 | +0.00% |
| Under 18 | 72,548,879 | 79,932,451 | +10.18% | 72,548,878 | -0.00% |
| 18 and over | 267,454,918 | 251,494,959 | -5.97% | 267,454,915 | -0.00% |

Production under-18 by state against Census (%): median +10.28, min +2.77, max +24.55; over +5% in 49 of 51.

## Child SPM poverty

National rates divide children in poverty by children, summed over the 51 slices.

| Year | Production | Reweighted | Change (pp) | Children in poverty, production | Reweighted |
|---|---:|---:|---:|---:|---:|
| 2024 | 13.24% | 13.94% | +0.70 | 10,580,621 | 10,112,608 |
| 2026 | 13.05% | 13.77% | +0.71 | 10,607,275 | 10,154,262 |

2024: the reweight changes the number of children in poverty by -4.4% and of other children by -10.0%.

2026: the reweight changes the number of children in poverty by -4.3% and of other children by -10.0%.

2024 change by state (pp): median +0.34, min -2.23, max +5.01; up in 31 of 51. Largest falls: VT -2.23, DE -1.18, MS -1.12, ND -1.07, SD -1.05. Largest rises: DC +5.01, TX +2.25, IL +2.16, FL +1.96, KY +1.83.

2026 change by state (pp): median +0.37, min -2.23, max +4.51; up in 33 of 51. Largest falls: VT -2.23, MA -1.17, DE -1.06, ND -1.04, SD -0.98. Largest rises: DC +4.51, FL +2.54, TX +2.20, KY +1.87, UT +1.72.

## State child SPM poverty against Census, 2024

Measured rates (ACS group quarters masked) against Census's CPS 3-year state rates (P60-290 Table 18, 2023-25), scored as in summarize_sweep.py.

| | Median % diff | Within ±25% | Within Census MOE | Mean abs error (pp) |
|---|---:|---:|---:|---:|
| Production | -0.6% | 27/51 | 24/51 | 2.81 |
| Reweighted | +2.9% | 31/51 | 26/51 | 2.70 |

## Checks on the reweight

- Balance: every state converged, in at most 200 Newton steps, with the largest constraint error 1.1e-08 of its target.
- Held aggregates dropped because the slice's value is zero: none.
- Household weight ratios, new over production: smallest 0.009, largest 434.68; median state's 1st and 99th percentiles 0.473 and 2.119.
- Kish effective sample size, new over production: median state 0.977, range 0.891 to 1.049.
- Poverty status: in every state and year, 0 persons have a different SPM poverty status in the reweighted run than in the production run, so the reweight moves poverty rates through weights alone (re-scoring the production run's flags differs by 0.0e+00 pp).
- Newton steps above 50: NY 200, VA 200.
- Largest household weight ratios: IA 434.7 (Kish 238 of 17,112 households), GA 207.6 (Kish 379 of 50,241 households), TX 76.2 (Kish 913 of 125,924 households).

## IN: universal $2,000 for each child under 4, 2026

| | Production | Reweighted |
|---|---:|---:|
| Cost | $747.7M | $654.7M |
| Payments | $747.7M | $654.7M |
| Change in benefits | $747.7M | $654.7M |
| Change in federal income tax | $0.0M | $0.0M |
| Change in state income tax | $0.0M | $0.0M |
| Children under 4 | 373,860 | 327,339 |
