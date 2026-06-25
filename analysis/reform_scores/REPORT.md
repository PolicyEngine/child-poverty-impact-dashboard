# Reform-option scorecard

Validates the **dashboard's own computed scores** (Modal per-state ECPS microsim —
the numbers users see) against external prior estimates gathered the way
`/analyze-policy`'s `prior-scores-finder` does (`priors.yaml`). Regenerate with:

```bash
cd frontend && npm run score-scenarios && cd ..
python analysis/reform_scores/score_reforms.py            # dashboard vs priors
python analysis/reform_scores/score_reforms.py --with-api  # + PolicyEngine-API reference
```

Cost = annual budgetary impact (positive = costs money), state-scoped.
Federal reforms are evaluated in one state, so their prior check is directional
(relative child-poverty reduction vs the national estimate). See Caveats.

| Scenario | State | Scope | Dashboard cost | Dashboard child pov | Δ rel | API child pov Δ rel | Prior (rel reduction) | Verdict | Note |
|---|---|---|---|---|---|---|---|---|---|
| Restore the 2021 (ARPA) expanded CTC | CA | federal | $8.8B | 23.88%→20.51% | -14% | -12% | 35–50%↓ | **PASS** | dashboard 14% matches PolicyEngine API 12% at CA; national prior 35%–50% (geography: single state vs national prior) |
| Child allowance, $3,000/child under 18 (universal) | CA | federal | $26.7B | 23.88%→17.06% | -29% | -26% | 40–65%↓ | **PASS** | dashboard 29% matches PolicyEngine API 26% at CA; national prior 40%–65% (geography: single state vs national prior) |
| Working Parents Tax Relief Act | CA | federal | $2.4B | 23.88%→22.46% | -6% | -5% | — | **PASS** | dashboard 6% matches PolicyEngine API 5% at CA |
| California Young Child Tax Credit raised to $2,000 | CA | state | $330.9M | 23.88%→23.71% | -1% | -1% | — | **PASS** | dashboard 1% matches PolicyEngine API 1% at CA |
| New York Empire State Child Credit young amount $2,000 | NY | state | $744.2M | 22.60%→22.15% | -2% | -2% | — | **PASS** | dashboard 2% matches PolicyEngine API 2% at NY |
| California EITC raised to 100% of federal | CA | state | $97.1M | 23.88%→23.83% | -0% | -0% | — | **PASS** | dashboard 0% matches PolicyEngine API 0% at CA |
| Eliminate the New York dependent exemption | NY | state | −$265.9M | 22.60%→22.79% | +1% | +1% | — | **PASS** | dashboard -1% matches PolicyEngine API -1% at NY |

## Summary
PASS: 7

## Caveats
- The dashboard is **per-state**: a federal reform is evaluated in one state, so its
  prior comparison is a *directional* check of the relative child-poverty reduction,
  not the national dollar cost.
- State EITC/CTC tweaks have no published prior — validated by direction-aware sanity
  rules (and, with `--with-api`, dashboard-vs-PolicyEngine-API consistency).
- INVESTIGATE = the dashboard's score looks implausible (wrong sign, no effect, or far
  from a prior); deep-dive with `/analyze-policy "<reform>"`.
