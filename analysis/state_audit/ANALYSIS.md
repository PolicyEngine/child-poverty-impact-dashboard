# State Dataset Audit — Analysis & Findings

**What:** validation of the per-state PolicyEngine datasets
(`hf://policyengine/policyengine-us-data/states/{ST}.h5`) that power the
Child Poverty Impact Dashboard, for all 50 states + DC.
**Year:** 2026 (PolicyEngine estimates). **Compute:** 51-state parallel
microsimulation on Modal (`state_audit_modal.py`).
**Deliverables:** [`output/state_populations_poverty.csv`](output/state_populations_poverty.csv),
[`output/state_credit_costs.csv`](output/state_credit_costs.csv).

---

## 1. Population — well calibrated ✅

PolicyEngine total population vs the data-repo calibration target
(`population_by_state.csv`): **median +1.4%**, range −0.9% to +3.6%. The
state datasets reproduce population closely (they are calibrated to it).
Under-5 is similarly close. Child cuts (under-1/under-6/under-18) have no
exact calibration target (only total + under-5 are exact); under-18 is
approximated from 5-year ACS brackets.

## 2. Child poverty — PolicyEngine systematically overstates it ⚠️

PolicyEngine reports the **SPM** (`in_poverty` is SPMUnit-based). Compared
to the **Census ACS SPM, Under-18, 2023** (same measure), PolicyEngine child
poverty is a **median +25% high**:

- Closest: MI (−4%), KY (−1%), PA (+0.3%)
- Furthest: VT (+199%), ME (+106%), KS (+64%) — small states with low
  Census rates, so small absolute gaps explode in percent.

**Why:** the state datasets are calibrated to population / AGI / SNAP — **not
poverty** — and PolicyEngine's 2026 vintage sits above the 2023 target
(post-pandemic child poverty rose). This is the headline finding: treat
dashboard state-level *poverty* figures with caution until the datasets are
calibrated to a poverty target.

## 3. State EITC cost — mostly accurate, a few flags ✅⚠️

Target = **statutory refundable match % × IRS federal EITC by state (TY2024)**
for refundable-match states (the user-approved "easy math"); match rates
**verified against PolicyEngine-US parameters**. Most states land within
±10%, validating the EITC modeling:

> HI +1%, RI +1%, WI +0%, IL −2%, KS −4%, MA −5%, PA −6%, IA −6%, LA −6%,
> MI −6%, NE −7%, IN −10%, CT +10%, CA +12%, CO +13%, VT +19%

**Flags:**
- **MT +604%** — PolicyEngine-US uses a **20%** EITC match for Montana, but
  the statutory rate (CBPP) is **3%**. Likely a PE-US parameter error worth
  fixing.
- **MN WFC +88%** — target is an approximate 20% split of the combined
  $724.8M CWFC; PE's standalone WFC is larger. Partly a definition issue.
- **DC +81%, DE +100%** — DC's credit (generous childless-worker component,
  phasing to 100%) and DE both exceed a simple-match estimate.
- **VA +36%** — PE includes both the nonrefundable (20%) and refundable
  (15%) components; the target used only the refundable 15%.
- Nonrefundable EITCs (OH, SC, UT, MO) are not estimated via easy-math (the
  cost only offsets tax liability), so no target.

## 4. State CTC cost — more divergence, several flags ⚠️

CTC targets are hand-sourced from state budget / tax-expenditure documents
(see source column / links). Close matches: DC +0.4%, NE −0.01%, MN +2%,
UT +4%, VT +10%, MA +11%, OK +13%, NM +19%, CA +24%.

**Flags:**
- **MD CTC +219%** — Maryland's CTC is tiny and hard-capped at $15k AGI
  ($500/child under 6). PE ($29M) far exceeds the ~$9M actual — PE likely
  doesn't bind the income cap tightly.
- **NY ESCC +117%** — PE ($1.79B) vs ~$825M (base + FY26 enhancement). Either
  PE overstates the expanded 2025–2027 credit or the budget figure
  understates it; worth a closer look (this credit was newly wired in the
  dashboard).
- **CO +41%, IL +41%, NJ +47%, OR +39%, ID +38%, GA −32%** — moderate gaps,
  several involving brand-new credits (GA 2026, CO Family Affordability 2024)
  with limited or fast-moving cost data.

## Actionable data-quality flags
1. **MT state EITC match = 20% in PE-US vs 3% statutory** — verify/fix upstream.
2. **State datasets overstate SPM child poverty (~+25% median)** — they aren't
   calibrated to poverty; consider adding a state child-poverty target.
3. **NY ESCC and MD CTC cost** — investigate the large gaps (modeling vs target).

## Method notes & caveats
- **Credit cost** sums each state's *own* credit variables (from the year's
  `state_eitcs`/`state_ctcs` lists), because the `state_eitc`/`state_ctc`
  aggregates `adds` every state's credits and inflate 3–10× on a single
  state's reweighted dataset. PE scores statically, so the program total =
  the repeal budgetary impact.
- **Vintage:** PE 2026 vs 2023–24 targets; some divergence is genuine drift.
- **Cost targets are approximate** — actual state EITC/CTC expenditure lives
  in scattered state reports; many are easy-math estimates or new-credit
  figures with limited data. EITC easy-math assumes full refundability.

## Sources
- **PolicyEngine US data** — per-state datasets, `policyengine/policyengine-us-data`.
- **Census ACS SPM State-by-Age Tables (2021–2023):** https://www.census.gov/data/tables/time-series/demo/supplemental-poverty-measure/ACS-SPM-State-Tables.html (file: `State_by_Age_SPM_Rates.xlsx`).
- **IRS EITC by state, TY2024:** https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit/statistics-for-tax-returns-with-the-earned-income-tax-credit-eitc
- **CBPP State EITCs (rates/refundability):** https://www.cbpp.org/research/state-budget-and-tax/state-earned-income-tax-credits
- **Calibration population targets:** `policyengine-us-data/.../calibration_targets/population_by_state.csv`, `age_state.csv`.
- **Per-state credit-cost sources** — see the `source` column of
  `targets/state_credit_costs.csv` (CA FTB, NY Tax Dept, MN House Research,
  CO DOR, NM Tax & Rev, OR DOR, VT JFO, MA budget, ID Revenue Book, OK Policy
  Institute, MD Comptroller, NJPP, IL budget, ME Revenue, etc.).
