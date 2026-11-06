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
same policyengine-us pin at 2024 and 2026. Every reweighted figure below comes
from that simulation (`output/census_age_reweight_buildp_18252.json`, by state
in `output/census_age_reweight_buildp_18252_by_state.csv`).

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
reweighted slice puts 327,339. We estimate the allowance costs $747.7 million
on Build P and $654.7 million on the reweighted slice. The payments make up
the whole cost, since neither federal nor state income tax changes. Before the
reform, the reweighted slice puts Indiana's 2026 child SPM poverty rate at
11.63%, against Build P's 10.98%.

### Limits

The rebuilt release re-solves every target jointly, including IRS SOI by
congressional district and county populations, and fits its SNAP, Medicaid and
SOI targets rather than the slices' current values, so its figures will
differ. A few household weights move far. The largest ratio, 435, falls on an
Iowa household, and Iowa's production slice has a Kish effective sample of 238
of its 17,112 households. Most weights move less: across states, the median
1st percentile of the ratio comes to 0.47 and the median 99th to 2.12, and the
effective sample changes by −11% to +5%. New York and Virginia took the full
200 Newton steps and still met every constraint to within 1.1 in 100 million.

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
```
