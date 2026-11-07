# Census ages in the state slices (2026-11-05)

Census estimates 72.5 million children under 18 and 267.5 million adults in
the 50 states and DC on July 1, 2024 (Vintage 2025). For 2024, production's
state slices hold 79.9 million children and 251.5 million adults (Build P,
`592ae5d6`, under policyengine-us 1.825.2 from its release commit
`9f77bffb6b`), and the Build O candidate (`766b7c7`) holds 80.7 million
children. The ACS local-area calibration behind both releases has no age
targets (PolicyEngine/microcosm#1528), and PolicyEngine/microcosm#1531 adds
them. Until a rebuilt release exists, we project the fix onto Build P's
slices: we reweight each state to Census's age groups and simulate the result.

## Census targets

`targets/census_pep_v2025_state_single_age.csv` holds Census's Vintage 2025
resident population for each state and DC by single year of age on July 1,
2024 and 2025. It sums Census's `sc-est2025-alldata6.csv` (sha256 `505fd45b…`)
over all sexes, origins and races 1 to 6, and resident population includes
people in group quarters. `build_csvs.py` and `census_age_fit.py` compare the
slices' total, under-1, under-5, under-6 and under-18 counts with these
counts.

Earlier audits compared under-18 with ages 0 to 19 and under-6 with ages 0 to
4 plus a fifth of ages 5 to 9, from the data repo's five-year brackets.
Against that target, Build P's 2026 under-18 counts fell within 5% in 45 of 50
states, with a median of −0.9%
(`output/state_populations_poverty_buildp.csv`).

## Before: the slices against Census, 2024

| Ages | Census | Build P, vs Census | Build O, vs Census |
|---|---:|---:|---:|
| All ages | 340,003,797 | −2.52% | −2.54% |
| Under 1 | 3,617,221 | −15.16% | −14.72% |
| Under 5 | 18,584,735 | +5.51% | +7.01% |
| Under 6 | 22,450,934 | +6.82% | +8.11% |
| Under 18 | 72,548,879 | +10.18% | +11.30% |
| 18 and over | 267,454,918 | −5.97% | −6.30% |

Build P's under-18 count exceeds Census's in every state, by 2.8% in Oklahoma
up to 24.5% in DC (median 10.3%), and by more than 5% in 49 of 51. Its single
years miss by more. The under-1 count runs from 56% below Census in Vermont to
105% above in Wyoming and misses by more than 25% in 19 states. Build O gives
the same counts under policyengine-us 1.825.2, 2.2.1 and 2.30.1
(`output/census_age_fit_2024.csv`; by state in
`output/state_populations_poverty_buildp_v2_2024.csv`).

## Projected after: Build P reweighted to Census ages

For each state, `census_age_reweight_modal.py` finds the 2024 household
weights closest to the slice's own (minimum Kullback-Leibler divergence) that
match Census's count in each of the 15 age groups microcosm#1531 binds. Those
groups take single years 0 to 5, then 6 to 11, 12 to 17, 18 to 24, ten-year
groups to 64, 65 to 74, and 75 and over. The same weights keep 16 of the
slice's own 2024 aggregates at their current values: SNAP units and dollars,
Medicaid enrollment, filers' AGI, filers in six AGI brackets, EITC claims by
number of qualifying children, and CTC and refundable CTC claims. The script
writes the new weights into a copy of the slice and simulates it under the
same policyengine-us pin at 2024 and 2026.
`output/census_age_reweight_buildp_18252.json` holds the results, by state in
`output/census_age_reweight_buildp_18252_by_state.csv`.

| Ages, 2024 | Census | Build P | Reweighted |
|---|---:|---:|---:|
| All ages | 340,003,797 | 331,427,411 | 340,003,801 |
| Under 1 | 3,617,221 | 3,068,753 | 3,617,221 |
| Under 4 | 14,773,579 | 15,176,486 | 14,773,579 |
| Under 18 | 72,548,879 | 79,932,451 | 72,548,878 |
| 18 and over | 267,454,918 | 251,494,959 | 267,454,915 |

Float32 weights leave each state's reweighted counts within 2 in 10 million of
Census's.

| Child SPM poverty | Build P | Reweighted | Change (points) |
|---|---:|---:|---:|
| 2024 | 13.24% | 13.94% | +0.70 |
| 2026 | 13.05% | 13.77% | +0.71 |

No person's poverty status differs between the two runs, so the rates move
through the weights alone. In 2024 the reweight removes 10.0% of the children
not in poverty and 4.4% of the children in poverty. The rate rises in 31 of 51
states, and the median state's rises 0.34 points. Changes run from a fall of
2.23 points in Vermont to a rise of 5.01 points in DC, whose slice held 24.5%
more children than Census counts.

We score both runs against Census's CPS three-year state rates (P60-290 Table
18, 2023-25) as `summarize_sweep.py` does, with group quarters masked. The
reweighted rates fall within Census's margin of error in 26 states, against
Build P's 24, and miss by 2.70 points on average, against 2.81:

| 2024 | Median % diff | Within ±25% | Within Census MOE | Mean abs error (points) |
|---|---:|---:|---:|---:|
| Build P | −0.6% | 27/51 | 24/51 | 2.81 |
| Reweighted | +2.9% | 31/51 | 26/51 | 2.70 |

### Indiana: universal $2,000 for each child under 4 in 2026 (report r=82)

For example, Build P puts 373,860 Indiana children under 4 in 2026, and the
reweighted slice puts 327,339. We estimate the allowance would cost $747.7
million on Build P and $654.7 million on the reweighted slice. The payments
make up the whole cost, since neither federal nor state income tax changes.
Before the reform, the reweighted slice puts Indiana's 2026 child SPM poverty
rate at 11.63%, against Build P's 10.98%.

### Limits

The rebuild calibrates to all 5,632 targets of its default surface, including
4,227 state SOI targets, state SNAP and Medicaid targets and each
congressional district's population. It aims at those targets themselves rather
than the slices' current values, so its figures will differ.

A few household weights move far. The largest ratio, 435, falls on an Iowa
household, and Iowa's production slice has a Kish effective sample of 238 of
its 17,112 households. Most weights move less: across states, the median 1st
percentile of the ratio comes to 0.47 and the median 99th to 2.12, and the
effective sample changes by −11% to +5%. New York and Virginia took the full
200 Newton steps and still met every constraint to within 1.1 in 100 million.

## Weight concentration

Balancing to Census ages barely changes how few households hold each state's
weight. On Build P it lowers the Kish effective sample in 43 of 51 states, by
2.3% in the median state, and moves the median across states from 331 households
to 314. The top 1% of households keep 67.7% of the median state's weight.
Households on the ASEC-by-PUF spine (`household_spine` of `asec_puf`) make up
3.6% of Build P's households, 57,240 of 1,588,854, and hold 67.6% of the median
state's weight before the balance and 67.0% after. Build O shows the same
pattern.

| 2024 weights, 51 states: median (lowest to highest) | Build P | Build P reweighted | Build O | Build O reweighted |
|---|---:|---:|---:|---:|
| Kish effective sample, households | 331 (194 to 1,501) | 314 (190 to 1,482) | 280 (193 to 1,146) | 278 (185 to 1,124) |
| Kish effective sample, % of households | 1.4% (0.6% to 8.6%) | 1.4% (0.6% to 7.7%) | 1.2% (0.5% to 7.2%) | 1.2% (0.5% to 6.8%) |
| Top 1% of households' share of weight | 67.7% (25.1% to 73.6%) | 67.7% (26.8% to 73.6%) | 66.6% (28.9% to 75.4%) | 66.3% (29.0% to 75.8%) |
| ASEC-by-PUF households' share of weight | 67.6% (57.8% to 72.3%) | 67.0% (59.2% to 72.3%) | 66.2% (55.6% to 73.2%) | 66.0% (57.5% to 73.3%) |

We simulate the universal $2,000 for each child under 4 in 2026 in every state
on all four datasets, and count the sample households behind the children it
lifts out of SPM poverty. A median of 19 sample households on Build P account
for a state's whole lift, and the top household accounts for a median of 43.2%
of it. On Build P, the allowance lifts at least 1,000 children in 36 states,
before the balance and after, and one household accounts for more than half of
the lift in 15 of them each time. Across all 51 states that count rises from 21
to 24, all of it in states lifting fewer than 1,000, and the District of
Columbia counts in both on a net lift under 0.001 children.

| $2,000 for each child under 4, 2026 | Build P | Build P reweighted | Build O | Build O reweighted |
|---|---:|---:|---:|---:|
| Children lifted out of SPM poverty, net, 51 states | 638,471 | 615,401 | 796,573 | 770,047 |
| ASEC-by-PUF households' share of them | 73.6% | 69.9% | 78.4% | 75.2% |
| Sample households lifting a child, median state | 19 | 19 | 18 | 18 |
| Top household's share of a state's lift, median state | 43.2% | 45.3% | 50.2% | 47.2% |
| States where one household accounts for more than half | 21 | 24 | 26 | 24 |
| States where one household accounts for more than a quarter | 42 | 43 | 43 | 44 |
| States lifting at least 1,000 children | 36 | 36 | 36 | 37 |
| Of those, states where one household accounts for more than half | 15 | 15 | 16 | 14 |

For example, we estimate that the allowance lifts 68,158 Illinois children on
Build P, and one household accounts for 92.7% of them. In Arizona it cuts child
SPM poverty 7.09 points, from 16.11% to 9.03%, against 0.22 points in the median
state, and five households account for 97.0% of that lift.

The balance moves Build P's 51-state lift 3.6%. Among the 36 states where the
allowance lifts at least 1,000 children on Build P, the balance moves the lift
by more than a fifth in 10, from a 36% fall in Washington to a 64% rise in
Mississippi. Build O's lift exceeds Build P's by 25% across the 51 states, and
among those 36 states it falls below half of Build P's or exceeds double in 6.
For example, Indiana's lift falls from 12,417 on Build P to 2,356 on Build O,
and Minnesota's rises from 2,284 on Build P to 9,476 on Build O. We ran both
builds under policyengine-us 1.825.2, so these differences come from the data.
PolicyEngine/child-poverty-impact-dashboard#127 runs Build O under 2.2.1.

`output/weight_concentration_buildp_18252_summary.md` and
`output/weight_concentration_buildo_18252_summary.md` hold more measures, and
the `_by_state.csv` files beside them hold each state.
PolicyEngine/microcosm#1446 plans a higher ACS share of state mass and a
calibration anchor, and PolicyEngine/child-poverty-impact-dashboard#130 asks how
the dashboard should show results that rest on so few households.

## Reproduce

```bash
python analysis/state_audit/build_csvs.py --raw state_audit_buildp_v2_2024_raw.json --suffix _buildp_v2_2024
python analysis/state_audit/census_age_fit.py --year 2024 \
    buildp_18252=state_audit_buildp_v2_2024_raw.json \
    buildo_18252=state_audit_o1017_18252_2024_raw.json \
    buildo_221=state_audit_o1017_221_2024_raw.json \
    buildo_2301=state_audit_o1017_2301_2024_raw.json
AUDIT_PE_US=1.825.2 AUDIT_SPM_CALC=0.3.1 \
    AUDIT_PE_US_SPEC="policyengine-us @ git+https://github.com/PolicyEngine/policyengine-us@9f77bffb6b" \
    modal deploy analysis/state_audit/census_age_reweight_modal.py
python analysis/state_audit/census_age_reweight_modal.py spawn 1.825.2 592ae5d6 buildp_18252
python analysis/state_audit/census_age_reweight_modal.py collect buildp_18252
python analysis/state_audit/census_age_reweight_summary.py buildp_18252 \
    --audit-2024 state_audit_buildp_v2_2024_raw.json \
    --audit-2026 state_audit_buildp_v2_2026_raw.json
python analysis/state_audit/census_age_reweight_modal.py spawn-concentration 1.825.2 592ae5d6 buildp_18252
python analysis/state_audit/census_age_reweight_modal.py collect-concentration buildp_18252
python analysis/state_audit/weight_concentration_summary.py buildp_18252
python analysis/state_audit/census_age_reweight_modal.py spawn-concentration 1.825.2 766b7c7 buildo_18252
python analysis/state_audit/census_age_reweight_modal.py collect-concentration buildo_18252
python analysis/state_audit/weight_concentration_summary.py buildo_18252 --audit-label o1017_18252
```
