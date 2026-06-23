# Reform-option scorecard

Standardized validation of the dashboard's reform options via the PolicyEngine API
(the `/analyze-policy` `microsim-runner` methodology). Regenerate with:

```bash
cd frontend && npm run score-scenarios && cd ..
python analysis/reform_scores/score_reforms.py
```

Year: **2026**. Cost = annual budgetary impact (positive = costs money).
Baselines are the national Enhanced CPS filtered by region — see Caveats.

| Scenario | Region | Dir | Annual cost | Child pov | Δ child | Δ all pov | Δ Gini | Verdict | Note |
|---|---|---|---|---|---|---|---|---|---|
| Restore the 2021 (ARPA) expanded CTC | us | expansion | $86.6B | 18.68%→12.18% (-35%) | -6.51pp | -2.21pp | -0.0042 | **PASS** | matches prior anchor (PolicyEngine / Columbia CPSP — 2021 ARPA CTC) |
| Child allowance, $3,000/child under 18 | us | expansion | $224.2B | 18.68%→10.14% (-46%) | -8.54pp | -3.12pp | -0.0077 | **PASS** | sign correct (sanity only; no prior anchor) |
| American Family Act CTC | us | expansion | — | — | — | — | — | **ERROR** | RuntimeError: None |
| Tax Cuts for Workers (childless EITC expansion) | us | expansion | $9.2B | 18.68%→18.68% (+0%) | +0.00pp | -0.25pp | -0.0003 | **PASS** | sign correct (sanity only; no prior anchor) |
| Working Parents Tax Relief Act | us | expansion | $28.5B | 18.68%→17.23% (-8%) | -1.46pp | -0.44pp | -0.0015 | **PASS** | sign correct (sanity only; no prior anchor) |
| California Young Child Tax Credit raised to $2,000 | ca | expansion | $322.2M | 26.54%→26.38% (-1%) | -0.16pp | -0.07pp | -0.0002 | **PASS** | sign correct (sanity only; no prior anchor) |
| New York Empire State Child Credit young amount $2,000 | ny | expansion | $740.6M | 24.56%→24.12% (-2%) | -0.45pp | -0.17pp | -0.0006 | **PASS** | sign correct (sanity only; no prior anchor) |
| California EITC raised to 100% of federal | ca | expansion | $95.4M | 26.54%→26.49% (-0%) | -0.05pp | -0.02pp | -0.0001 | **PASS-WITH-NOTES** | sign correct; small overall-poverty effect (no prior anchor) |
| Minnesota WFC additional amount (2 children) +$3,000 | mn | expansion | $400,024 | 12.37%→12.37% (+0%) | +0.00pp | +0.00pp | -0.0000 | **INVESTIGATE** | no measurable budget or poverty effect (possible dead option) |
| Eliminate the New York dependent exemption | ny | repeal | $-272.4M | 24.56%→24.77% (+1%) | +0.21pp | +0.09pp | +0.0002 | **PASS** | sign correct (sanity only; no prior anchor) |

## Summary
ERROR: 1, INVESTIGATE: 1, PASS: 7, PASS-WITH-NOTES: 1

## Caveats
- API uses the national Enhanced CPS filtered by `region`; the dashboard ships per-state
  ECPS via Modal, so absolute figures can differ. This validates sign/magnitude and
  agreement with PolicyEngine priors, not the dashboard's exact numbers.
- Single-year (static) analysis; cost is annual, not 10-year.
- INVESTIGATE means the score looks implausible (wrong sign, no effect, or far from a
  prior) and warrants a `/analyze-policy` deep-dive — not necessarily a bug.
