# State-by-state wizard display audit

Generated from the option registries at analysis year 2026. Each
section shows exactly what the wizard presents for that state: the
Current Programs summary line(s), then every option card with its
adjustable parameters (label, current-law default, range, unit) and
descriptions. Review order: summary accuracy first, then card names,
then parameter defaults vs the actual statute.

## Alaska (AK)

**Income tax:** no
**Current Programs panel:**
- State CTC: None
- State EITC: None
- CDCC: no | Dependent exemption: no

## Alabama (AL)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: None
- CDCC: no | Dependent exemption: yes

**State EITC options:**
- **Alabama EITC**
  - _Create a refundable Alabama EITC as a percentage of the federal EITC._
  - Match rate (match_rate): default 0%, range 0-100%
    - _Percentage of the federal EITC. Set a rate to create the credit._

**Dependent exemption options:**
- **Alabama Dependent exemption**
  - _Adjust, partially repeal, or eliminate Alabama's dependent exemption. Pair it with a state EITC or child allowance to model a swap. Per-dependent exemption steps down by AGI ($1,000 / $500 / $300); each tier amount and the AGI cutoffs are editable._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Alabama's dependent exemption entirely (set it to $0)._
  - Amount per dependent (lowest AGI tier) (amount): default 1000$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $1,000. Lower it to partially repeal._
  - Amount per dependent (middle AGI tier) (amount_mid): default 500$, range 0-10000$
    - _Current: $500. Set to 0 to drop just this piece, or use Eliminate to remove all of Alabama's dependent exemption._
  - Amount per dependent (highest AGI tier) (amount_high): default 300$, range 0-10000$
    - _Current: $300. Set to 0 to drop just this piece, or use Eliminate to remove all of Alabama's dependent exemption._
  - AGI where the middle tier starts (threshold_mid): default 50000$, range 0-500000$
    - _Income/age threshold where this bracket applies. Current: $50,000._
  - AGI where the top tier starts (threshold_high): default 100000$, range 0-500000$
    - _Income/age threshold where this bracket applies. Current: $100,000._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Arkansas (AR)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: None
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **Arkansas EITC**
  - _Create a refundable Arkansas EITC as a percentage of the federal EITC._
  - Match rate (match_rate): default 0%, range 0-100%
    - _Percentage of the federal EITC. Set a rate to create the credit._

**Dependent exemption options:**
- **Arkansas Dependent credit**
  - _Adjust, partially repeal, or eliminate Arkansas's dependent credit. Pair it with a state EITC or child allowance to model a swap. Dependent slice of AR's personal tax credit ($29/dependent), separated by the contributed reform so it can be edited or eliminated._
  - Eliminate the dependent credit (eliminate): default 0, range 0-1
    - _Repeal Arkansas's dependent credit entirely (set it to $0)._
  - Amount per dependent (amount): default 29$, range 0-10000$
    - _Per-dependent dependent credit amount. Current: $29. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent credit to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent credit by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent credit; dependents this age or older get none._

## Arizona (AZ)

**Income tax:** yes
**Current Programs panel:**
- State CTC: Arizona Dependent Tax Credit - $100
- State EITC: None
- CDCC: yes | Dependent exemption: no

**State EITC options:**
- **Arizona EITC**
  - _Create a refundable Arizona EITC as a percentage of the federal EITC._
  - Match rate (match_rate): default 0%, range 0-100%
    - _Percentage of the federal EITC. Set a rate to create the credit._

**Dependent exemption options:**
- **Arizona Dependent credit**
  - _Adjust, partially repeal, or eliminate Arizona's dependent credit. Pair it with a state EITC or child allowance to model a swap. Dependent tax credit: $125/child under 17, $25 per older dependent (2026). Amounts and the age cutoff are editable._
  - Eliminate the dependent credit (eliminate): default 0, range 0-1
    - _Repeal Arizona's dependent credit entirely (set it to $0)._
  - Credit per dependent (under 17) (amount): default 125$, range 0-10000$
    - _Per-dependent dependent credit amount. Current: $125. Lower it to partially repeal._
  - Credit per dependent (17 and older) (amount_older): default 25$, range 0-10000$
    - _Current: $25. Set to 0 to drop just this piece, or use Eliminate to remove all of Arizona's dependent credit._
  - Age the older-dependent credit starts at (threshold_age): default 17years, range 0-24years
    - _Income/age threshold where this bracket applies. Current: 17 years._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent credit to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent credit by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent credit; dependents this age or older get none._

## California (CA)

**Income tax:** yes
**Current Programs panel:**
- State CTC: Young Child Tax Credit (CalYCTC) - $1216
- State EITC: California Earned Income Tax Credit (CalEITC) - own schedule, 85% adjustment factor
- CDCC: yes | Dependent exemption: yes

**State CTC options:**
- **California Young Child Tax Credit**
  - _Refundable credit for young children. Phases out against earned income._
  - Credit amount (amount): default 1216$, range 0-5000$
    - _Maximum credit per eligible child._
  - Eligible if under age (age): default 6yr, range 0-19yr
    - _Age limit for an eligible child._
  - Phase-out start (earned income) (phaseout_start): default 28047$, range 0-500000$
    - _Earned income at which the credit starts phasing out._
  - Reduction amount (phaseout_amount): default 21.71$, range 0-100$
    - _Dollars of credit removed per earned-income increment (below) above the phase-out start. Current: $21.71 (2025)._
  - Earned-income increment (phaseout_increment): default 100$, range 1-1000$
    - _Earned-income step the reduction applies per. Current: $100._

**State EITC options:**
- **California EITC adjustment factor**
  - _California's credit has its own schedule (CalEITC pays earners up to about $32,000), scaled by a statutory adjustment factor rather than matching the federal EITC. Raise or lower the factor to scale every credit amount proportionally; 100% pays the full schedule. Current: 85%._
  - Adjustment factor (match_rate): default 85%, range 0-150%
    - _Scales every amount in the state's own credit schedule; not a percentage of the federal EITC. Current: 85%._

**Dependent exemption options:**
- **California Dependent exemption**
  - _Adjust, partially repeal, or eliminate California's dependent exemption. Pair it with a state EITC or child allowance to model a swap. Note: California's exemption is a non-refundable credit against tax, so raising it has no effect once CA tax reaches $0 — which happens at fairly high incomes for families with children (a $50,000 single parent of two already owes no CA income tax)._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal California's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 486$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $486. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Colorado (CO)

**Income tax:** yes
**Current Programs panel:**
- State CTC: Colorado Child Tax Credit - $1200
- State EITC: Colorado EITC - 25% match
- CDCC: yes | Dependent exemption: no

**State CTC options:**
- **Colorado Child Tax Credit**
  - _Refundable credit for children under 6, paid as a per-child amount that steps down with federal AGI (same tier amounts across filing statuses; income thresholds differ). Edit each tier amount._
  - Tier 1 amount (lowest AGI) (tier1): default 1200$, range 0-3000$
    - _Per-child credit for this income tier (all filing statuses)._
  - Tier 2 amount (middle AGI) (tier2): default 600$, range 0-3000$
    - _Per-child credit for this income tier (all filing statuses)._
  - Tier 3 amount (upper AGI) (tier3): default 200$, range 0-3000$
    - _Per-child credit for this income tier (all filing statuses)._
  - Tier 2 income threshold (single filer) (threshold1): default 26000$, range 0-200000$
    - _Federal AGI where the per-child credit steps down to the next tier. Current law varies by filing status (single shown); editing sets the same cutoff for all statuses._
  - Tier 3 income threshold (single filer) (threshold2): default 51000$, range 0-200000$
    - _Federal AGI where the per-child credit steps down to the next tier. Current law varies by filing status (single shown); editing sets the same cutoff for all statuses._
  - Credit ends (single filer income threshold) (threshold3): default 77000$, range 0-200000$
    - _Federal AGI where the per-child credit steps down to the next tier. Current law varies by filing status (single shown); editing sets the same cutoff for all statuses._
  - Eligible if under age (age): default 6yr, range 0-19yr
    - _Age limit for an eligible child._
- **Colorado Family Affordability Credit**
  - _Colorado's second, larger child credit (HB24-1311): a refundable per-child amount for children under 17, paying the full base for children under 6 and 75% of it for ages 6–16, phasing down with AGI. Amounts shown are the full-funding schedule PE-US encodes; actual-law amounts depend on TABOR revenue triggers._
  - Base amount per child (under 6) (amount): default 3273$, range 0-8000$
    - _Per-child base amount for children under 6. Current: $3,273 (the full-funding amount; actual-law amounts are TABOR-revenue-triggered)._
  - Older-child share (ages 6–16) (older_child_share): default 75%, range 0-100%
    - _Share of the base amount paid per child aged 6–16. Current: 75%._
  - Full amount applies under age (young_child_age): default 6years, range 1-17years
    - _Children under this age receive the full base amount; older children get the older-child share._
  - Credit ends at age (max_child_age): default 17years, range 6-19years
    - _Children this age or older receive nothing. Current: 17._
  - Phase-down start (AGI, single filer) (phaseout_start): default 16000$, range 0-150000$
    - _AGI where the credit starts phasing down (single filer; joint filers keep their statutory $10k-higher threshold)._
  - Phase-down rate per increment (phaseout_rate): default 6.88%, range 0-50%
    - _Percent of the credit lost per income increment above the threshold. Current: 6.875%._
  - Phase-down income increment (phaseout_increment): default 5000$, range 500-25000$
    - _Income step size for the phase-down. Current: $5,000 of AGI per reduction step._

**State EITC options:**
- **Colorado EITC**
  - _Adjust Colorado's state EITC as a percentage of the federal EITC. Current: 25%._
  - Match rate (match_rate): default 25%, range 0-100%
    - _Percentage of the federal EITC. Current: 25%._

## Connecticut (CT)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None (note: Connecticut's Child Tax Rebate was a one-time 2022 payment and has ended. The ongoing $250-per-child amount is the EITC qualifying-child bonus, shown under State EITC.)
- State EITC: Connecticut EITC (structured; name only)
- CDCC: yes | Dependent exemption: no

**State EITC options:**
- **Connecticut EITC**
  - _Connecticut's earned income credit is a percentage of the federal EITC, plus a flat bonus for filers with at least one qualifying child. Set the match rate and the per-filer child bonus._
  - Match rate (match_rate): default 40%, range 0-100%
    - _Percentage of the federal EITC. Current: 40%._
  - Qualifying-child bonus (child_bonus): default 250$, range 0-2000$
    - _Flat additional credit for filers with at least one qualifying child (stacks on the match). Current: $250 (2025)._

## District of Columbia (DC)

**Income tax:** yes
**Current Programs panel:**
- State CTC: DC Child Tax Credit - $1000
- State EITC: DC EITC - 100% match
- CDCC: yes | Dependent exemption: no

**State CTC options:**
- **DC Child Tax Credit**
  - _Refundable credit (up to $1,000/child). Phases out against DC taxable income by filing status._
  - Credit amount (amount): default 1000$, range 0-5000$
    - _Maximum credit per eligible child._
  - Eligible if under age (age): default 18yr, range 0-19yr
    - _Age limit for an eligible child._
  - Phase-out (single) (threshold_single): default 55000$, range 0-500000$
    - _DC taxable income where phase-out begins (single)._
  - Phase-out (joint) (threshold_joint): default 70000$, range 0-500000$
    - _DC taxable income where phase-out begins (joint)._
  - Phase-out (head of household) (threshold_hoh): default 55000$, range 0-500000$
    - _DC taxable income where phase-out begins (HoH)._
  - Phase-out (separate) (threshold_separate): default 35000$, range 0-500000$
    - _DC taxable income where phase-out begins (separate)._
  - Phase-out (surviving spouse) (threshold_surviving_spouse): default 55000$, range 0-500000$
    - _DC taxable income where phase-out begins (surviving spouse)._
  - Reduction amount (phaseout_amount): default 50$, range 0-500$
    - _Dollars of credit lost per income increment (below) of DC taxable income over the threshold. Current: $50 (2026)._
  - Income increment (DC taxable income) (phaseout_increment): default 1000$, range 1-10000$
    - _DC taxable income step the reduction applies per. Current: $1,000._

**State EITC options:**
- **District of Columbia EITC**
  - _Adjust District of Columbia's state EITC as a percentage of the federal EITC. Current: 100%._
  - Match rate (match_rate): default 100%, range 0-100%
    - _Percentage of the federal EITC. Current: 100%._

## Delaware (DE)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: Delaware EITC (structured; name only)
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **Delaware EITC**
  - _Delaware offers two EITCs and filers claim whichever is larger: a refundable credit worth 4.5% of the federal EITC, or a nonrefundable one worth 20%. Set each rate._
  - Refundable match rate (refundable_match): default 4.5%, range 0-100%
    - _Refundable percentage of the federal EITC. Current: 4.5%. Filers claim the larger of the refundable or nonrefundable credit._
  - Nonrefundable match rate (nonrefundable_match): default 20%, range 0-100%
    - _Nonrefundable percentage of the federal EITC. Current: 20%. Only offsets tax owed, so low-income filers usually do better with the refundable credit._

**Dependent exemption options:**
- **Delaware Dependent credit**
  - _Adjust, partially repeal, or eliminate Delaware's dependent credit. Pair it with a state EITC or child allowance to model a swap._
  - Eliminate the dependent credit (eliminate): default 0, range 0-1
    - _Repeal Delaware's dependent credit entirely (set it to $0)._
  - Amount per dependent (amount): default 110$, range 0-10000$
    - _Per-dependent dependent credit amount. Current: $110. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent credit to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent credit by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent credit; dependents this age or older get none._

## Florida (FL)

**Income tax:** no
**Current Programs panel:**
- State CTC: None
- State EITC: None
- CDCC: no | Dependent exemption: no

## Georgia (GA)

**Income tax:** yes
**Current Programs panel:**
- State CTC: Georgia Child Tax Credit - $250
- State EITC: None
- CDCC: yes | Dependent exemption: yes

**State CTC options:**
- **Georgia Child Tax Credit**
  - _Non-refundable credit ($250/child under 6). No income phase-out._
  - Credit amount (amount): default 250$, range 0-3000$
    - _Maximum credit per eligible child._
  - Eligible if under age (age): default 6yr, range 0-19yr
    - _Age limit for an eligible child._
  - Make the credit refundable (make_refundable): default 0, range 0-1
    - _Pay credit beyond tax owed as a refund, capped per child at the refundable amount below._
  - Refundable portion per child (refundable_amount): default 250$, range 0-3000$, shown when make_refundable
    - _Maximum refunded per child beyond tax owed. Defaults to $250 (the full current credit); raise it alongside the credit amount for a fully refundable higher credit._

**State EITC options:**
- **Georgia EITC**
  - _Create a refundable Georgia EITC as a percentage of the federal EITC._
  - Match rate (match_rate): default 0%, range 0-100%
    - _Percentage of the federal EITC. Set a rate to create the credit._

**Dependent exemption options:**
- **Georgia Dependent exemption**
  - _Adjust, partially repeal, or eliminate Georgia's dependent exemption. Pair it with a state EITC or child allowance to model a swap._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Georgia's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 5000$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $5,000. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Hawaii (HI)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: Hawaii EITC - 40% match
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **Hawaii EITC**
  - _Adjust Hawaii's state EITC as a percentage of the federal EITC. Current: 40%._
  - Match rate (match_rate): default 40%, range 0-100%
    - _Percentage of the federal EITC. Current: 40%._

**Dependent exemption options:**
- **Hawaii Dependent exemption**
  - _Adjust, partially repeal, or eliminate Hawaii's dependent exemption. Pair it with a state EITC or child allowance to model a swap. Dependent portion of the state's personal exemption._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Hawaii's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 1144$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $1,144. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Iowa (IA)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: Iowa EITC - 15% match
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **Iowa EITC**
  - _Adjust Iowa's state EITC as a percentage of the federal EITC. Current: 15%._
  - Match rate (match_rate): default 15%, range 0-100%
    - _Percentage of the federal EITC. Current: 15%._

**Dependent exemption options:**
- **Iowa Dependent credit**
  - _Adjust, partially repeal, or eliminate Iowa's dependent credit. Pair it with a state EITC or child allowance to model a swap._
  - Eliminate the dependent credit (eliminate): default 0, range 0-1
    - _Repeal Iowa's dependent credit entirely (set it to $0)._
  - Amount per dependent (amount): default 40$, range 0-10000$
    - _Per-dependent dependent credit amount. Current: $40. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent credit to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent credit by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent credit; dependents this age or older get none._

## Idaho (ID)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None (note: Idaho's $205-per-child nonrefundable credit expired at the end of 2025. The Child Tax Credit reform option revives it from 2026.)
- State EITC: None
- CDCC: yes | Dependent exemption: no

**State CTC options:**
- **Revive the expired Idaho Child Tax Credit** [CREATES PROGRAM]
  - _Idaho's $205-per-child nonrefundable credit expired at the end of 2025. Selecting this reform revives it from 2026; optionally adjust the amount or add a refundable portion._
  - Credit amount (amount): default 205$, range 0-3000$
    - _Maximum credit per eligible child._
  - Make the revived credit refundable (make_refundable): default 0, range 0-1
    - _Pay the full credit amount as a refund when it exceeds tax owed._

**State EITC options:**
- **Idaho EITC**
  - _Create a refundable Idaho EITC as a percentage of the federal EITC._
  - Match rate (match_rate): default 0%, range 0-100%
    - _Percentage of the federal EITC. Set a rate to create the credit._

**Grocery credit options:**
- **Idaho Grocery Credit**
  - _Refundable credit per person, including children, offsetting sales tax on groceries ($155/person from 2025), prorated by months not receiving SNAP. Raise the per-person amount, or restore the seniors (65+) add-on repealed in 2025._
  - Credit per person (amount): default 155$, range 0-1000$
    - _Annual refundable credit per person, including children. Current: $155 (2025+)._
  - Restore the seniors (65+) add-on (restore_aged): default 0, range 0-1
    - _Reinstate the additional amount for filers 65 and over, repealed in 2025 (H.B. 231)._
  - Seniors add-on amount (aged_amount): default 20$, range 0-500$, shown when restore_aged
    - _Additional annual amount per person 65 and over. Was $20 before the 2025 repeal._
  - Seniors add-on age threshold (aged_age): default 65yr, range 50-80yr, shown when restore_aged
    - _Age at or above which the add-on applies. Current: 65._

## Illinois (IL)

**Income tax:** yes
**Current Programs panel:**
- State CTC: Illinois Child Tax Credit - $300
- State EITC: Illinois EITC - 20% match
- CDCC: yes | Dependent exemption: yes

**State CTC options:**
- **Illinois Child Tax Credit**
  - _Refundable credit set as a percentage of the state EITC, for filers with an eligible child._
  - Credit (% of state EITC) (rate): default 40%, range 0-100%
    - _Credit as a percentage of the Illinois EITC._
  - Eligible if under age (age): default 12yr, range 0-19yr
    - _Age limit for an eligible child._

**State EITC options:**
- **Illinois EITC**
  - _Adjust Illinois's state EITC as a percentage of the federal EITC. Current: 20%._
  - Match rate (match_rate): default 20%, range 0-100%
    - _Percentage of the federal EITC. Current: 20%._

**Dependent exemption options:**
- **Illinois Dependent exemption**
  - _Adjust, partially repeal, or eliminate Illinois's dependent exemption. Pair it with a state EITC or child allowance to model a swap._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Illinois's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 2925$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $2,925. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Indiana (IN)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: Indiana EITC - 10% match
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **Indiana EITC**
  - _Adjust Indiana's state EITC as a percentage of the federal EITC. Current: 10%._
  - Match rate (match_rate): default 10%, range 0-100%
    - _Percentage of the federal EITC. Current: 10%._

**Dependent exemption options:**
- **Indiana Dependent exemption**
  - _Adjust, partially repeal, or eliminate Indiana's dependent exemption. Pair it with a state EITC or child allowance to model a swap. Indiana's additional exemption per qualifying child ($1,500). The base $1,000 per-person exemption that also covers dependents is bundled and would need a contributed reform to separate._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Indiana's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 1500$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $1,500. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Kansas (KS)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: Kansas EITC - 17% match
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **Kansas EITC**
  - _Adjust Kansas's state EITC as a percentage of the federal EITC. Current: 17%._
  - Match rate (match_rate): default 17%, range 0-100%
    - _Percentage of the federal EITC. Current: 17%._

**Dependent exemption options:**
- **Kansas Dependent exemption**
  - _Adjust, partially repeal, or eliminate Kansas's dependent exemption. Pair it with a state EITC or child allowance to model a swap._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Kansas's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 2320$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $2,320. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Kentucky (KY)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: None
- CDCC: yes | Dependent exemption: no

**State EITC options:**
- **Kentucky EITC**
  - _Create a refundable Kentucky EITC as a percentage of the federal EITC._
  - Match rate (match_rate): default 0%, range 0-100%
    - _Percentage of the federal EITC. Set a rate to create the credit._

## Louisiana (LA)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: Louisiana EITC - 5% match
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **Louisiana EITC**
  - _Adjust Louisiana's state EITC as a percentage of the federal EITC. Current: 5%._
  - Match rate (match_rate): default 5%, range 0-100%
    - _Percentage of the federal EITC. Current: 5%._

## Massachusetts (MA)

**Income tax:** yes
**Current Programs panel:**
- State CTC: Child and Family Tax Credit - $440
- State EITC: Massachusetts EITC - 40% match
- CDCC: yes | Dependent exemption: yes

**State CTC options:**
- **Massachusetts Child and Family Tax Credit**
  - _Refundable credit per qualifying dependent (child under 13, adult 65 or older, or disabled); no cap on the number of dependents._
  - Credit amount per dependent (amount): default 440$, range 0-5000$
    - _Refundable credit per qualifying dependent. Current: $440._
  - Child eligible if under age (age): default 13yr, range 0-19yr
    - _Age limit for an eligible child._

**State EITC options:**
- **Massachusetts EITC**
  - _Adjust Massachusetts's state EITC as a percentage of the federal EITC. Current: 40%._
  - Match rate (match_rate): default 40%, range 0-100%
    - _Percentage of the federal EITC. Current: 40%._

**Dependent exemption options:**
- **Massachusetts Dependent exemption**
  - _Adjust, partially repeal, or eliminate Massachusetts's dependent exemption. Pair it with a state EITC or child allowance to model a swap._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Massachusetts's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 1000$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $1,000. Lower it to partially repeal._

## Maryland (MD)

**Income tax:** yes
**Current Programs panel:**
- State CTC: Maryland Child Tax Credit - $500
- State EITC: Maryland EITC (structured; name only)
- CDCC: yes | Dependent exemption: yes

**State CTC options:**
- **Maryland Child Tax Credit**
  - _Refundable credit ($500/child). Phases out against federal AGI (2025+)._
  - Credit amount (amount): default 500$, range 0-5000$
    - _Maximum credit per eligible child._
  - Eligible if under age (age): default 6yr, range 0-19yr
    - _Age limit for an eligible child._
  - Disabled child age limit (age_disabled): default 17yr, range 0-19yr
    - _Age limit for an eligible child._
  - Phase-out start (AGI) (phaseout_threshold): default 15000$, range 0-100000$
    - _Federal AGI where the credit starts phasing out._
  - Reduction amount (phaseout_rate): default 50$, range 0-500$
    - _Dollars of credit lost per AGI increment (below) over the threshold._
  - AGI increment (phaseout_increment): default 1000$, range 1-10000$
    - _AGI step the reduction applies per. Current: $1,000._
  - Phase-out ends (AGI) (phaseout_max_agi): default 24001$, range 0-100000$
    - _Federal AGI at/above which the phased-out credit reaches $0 (2025+). Current: $24,001._

**State EITC options:**
- **Maryland EITC**
  - _Maryland lets filers who are married or have a qualifying child claim either a refundable EITC (45% of the federal credit) or a larger nonrefundable one (50%). Set each rate. (The separate 100% nonrefundable childless credit is unchanged.)_
  - Refundable match rate (refundable_match): default 45%, range 0-150%
    - _Refundable percentage of the federal EITC for filers married or with a qualifying child. Current: 45%._
  - Nonrefundable match rate (nonrefundable_match): default 50%, range 0-150%
    - _Nonrefundable percentage of the federal EITC for the same filers; the credit paid is whichever of the two is larger. Current: 50%._

**Dependent exemption options:**
- **Maryland Dependent exemption**
  - _Adjust, partially repeal, or eliminate Maryland's dependent exemption. Pair it with a state EITC or child allowance to model a swap. Maryland applies this exemption per person (taxpayer, spouse, and each dependent), stepped by AGI; editing it adjusts the full per-exemption schedule, not dependents alone. The per-person amounts are shared across filing statuses; the AGI cutoffs differ by filing status (single/separate vs joint/head/surviving-spouse), so each is editable separately._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Maryland's dependent exemption entirely (set it to $0)._
  - Per person (lowest AGI tier) (amount): default 3200$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $3,200. Lower it to partially repeal._
  - Per person (middle AGI tier) (amount_mid): default 1600$, range 0-10000$
    - _Current: $1,600. Set to 0 to drop just this piece, or use Eliminate to remove all of Maryland's dependent exemption._
  - Per person (upper AGI tier) (amount_low): default 800$, range 0-10000$
    - _Current: $800. Set to 0 to drop just this piece, or use Eliminate to remove all of Maryland's dependent exemption._
  - Middle-tier AGI cutoff — single / married-separate (threshold_mid_single): default 100000$, range 0-500000$
    - _Income/age threshold where this bracket applies. Current: $100,000._
  - Middle-tier AGI cutoff — joint / head / surviving spouse (threshold_mid_joint): default 150000$, range 0-500000$
    - _Income/age threshold where this bracket applies. Current: $150,000._
  - Upper-tier AGI cutoff — single / married-separate (threshold_top_single): default 125000$, range 0-500000$
    - _Income/age threshold where this bracket applies. Current: $125,000._
  - Upper-tier AGI cutoff — joint / head / surviving spouse (threshold_top_joint): default 175000$, range 0-500000$
    - _Income/age threshold where this bracket applies. Current: $175,000._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Maine (ME)

**Income tax:** yes
**Current Programs panel:**
- State CTC: Maine Dependent Exemption Tax Credit - $310
- State EITC: Maine EITC - 25% match
- CDCC: yes | Dependent exemption: yes

**State CTC options:**
- **Maine Dependent Exemption Tax Credit**
  - _Maine's Child Tax Credit (officially the Dependent Exemption Tax Credit): $310 per dependent in 2026 (indexed), doubled to $620 for children under 6 (young-child boost new in 2025), phasing out above income thresholds that vary by filing status._
  - Credit amount per dependent (amount): default 310$, range 0-3000$
    - _Base credit per dependent (before the young-child multiplier). Current: $310 (2026, indexed)._
  - Young child multiplier (under 6) (young_child_multiplier): default 2x, range 1-4x
    - _Multiplier on the credit for children under 6. Current: 2× (i.e. $620 in 2026), new in 2025; set to 1 to remove the young-child boost._
  - Young-child boost applies under age (young_child_age): default 6yr, range 0-19yr
    - _Age limit for an eligible child._
  - Phase-out start (AGI) (phaseout_start): default 102266$, range 0-400000$
    - _AGI where the credit starts phasing out. Current law varies by filing status (~$102k single to ~$153k joint, 2026); changing this sets the same threshold for all statuses._
  - Reduction amount (phaseout_step): default 20$, range 0-200$
    - _Dollars of credit lost per AGI increment (below) above the threshold. Current: $20._
  - AGI increment (phaseout_increment): default 500$, range 1-5000$
    - _AGI step the reduction applies per. Current: $500._

**State EITC options:**
- **Maine EITC**
  - _Adjust Maine's state EITC as a percentage of the federal EITC. Current: 25%._
  - Match rate (match_rate): default 25%, range 0-100%
    - _Percentage of the federal EITC. Current: 25%._

## Michigan (MI)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: Michigan EITC - 30% match
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **Michigan EITC**
  - _Adjust Michigan's state EITC as a percentage of the federal EITC. Current: 30%._
  - Match rate (match_rate): default 30%, range 0-100%
    - _Percentage of the federal EITC. Current: 30%._

**Dependent exemption options:**
- **Michigan Dependent exemption**
  - _Adjust, partially repeal, or eliminate Michigan's dependent exemption. Pair it with a state EITC or child allowance to model a swap. Dependent portion of the state's personal exemption._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Michigan's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 5950$, range 0-11900$
    - _Per-dependent dependent exemption amount. Current: $5,950. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Minnesota (MN)

**Income tax:** yes
**Current Programs panel:**
- State CTC: Child and Working Families Credits - $1800
- State EITC: Minnesota Working Family Credit (structured; name only)
- CDCC: yes | Dependent exemption: yes

**State CTC options:**
- **Minnesota Child Tax Credit**
  - _Refundable credit ($1,800/child in 2026; the statutory $1,750 indexes from 2026). Phases out against the larger of earned income or AGI._
  - Credit amount (amount): default 1800$, range 0-6000$
    - _Maximum credit per eligible child._
  - Eligible if under age (age): default 18yr, range 0-19yr
    - _Age limit for an eligible child._
  - Phase-out start (joint) (threshold_joint): default 38770$, range 0-500000$
    - _Income where phase-out begins (joint)._
  - Phase-out start (non-joint) (threshold_other): default 32670$, range 0-500000$
    - _Income where phase-out begins (non-joint)._

**State EITC options:**
- **Minnesota Working Family Credit**
  - _Minnesota's Working Family Credit, the state's EITC equivalent. It phases in on earned income, adds an amount per qualifying child over 18, and phases out with income (the phase-out is shared with the state Child Tax Credit)._
  - Phase-in rate (phase_in_rate): default 4%, range 0-20%
    - _Credit as a share of earned income during phase-in. Current: 4%._
  - Additional amount (1 child) (additional_1_child): default 1020$, range 0-5000$
    - _Extra credit for one qualifying child over 18. Current: $1,000 (2025)._
  - Additional amount (2 children) (additional_2_children): default 2320$, range 0-7000$
    - _Extra credit for two qualifying children over 18. Current: $2,270 (2025)._
  - Additional amount (3+ children) (additional_3_children): default 2770$, range 0-8000$
    - _Extra credit for three or more qualifying children over 18. Current: $2,710 (2025)._
  - Phase-out rate (phase_out_rate): default 12%, range 0-30%
    - _Rate at which the credit phases out above the income threshold (shared with the MN Child Tax Credit). Current: 12%._

**Dependent exemption options:**
- **Minnesota Dependent exemption**
  - _Adjust, partially repeal, or eliminate Minnesota's dependent exemption. Pair it with a state EITC or child allowance to model a swap. Per-dependent exemption ($5,300), phased out with AGI._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Minnesota's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 5300$, range 0-10600$
    - _Per-dependent dependent exemption amount. Current: $5,300. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Missouri (MO)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: Missouri Working Families Tax Credit - 20% match
- CDCC: no | Dependent exemption: no

**State EITC options:**
- **Missouri EITC**
  - _Convert Missouri's nonrefundable EITC to refundable and adjust the match rate. Current: 20% (nonrefundable)._
  - Make refundable (make_refundable): default 0, range 0-1
    - _Make Missouri's EITC fully refundable._
  - Match rate (match_rate): default 20%, range 0-150%
    - _Percentage of the federal EITC. Current: 20%. Adjusting the rate alone keeps the credit non-refundable._

## Mississippi (MS)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: None
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **Mississippi EITC**
  - _Create a refundable Mississippi EITC as a percentage of the federal EITC._
  - Match rate (match_rate): default 0%, range 0-100%
    - _Percentage of the federal EITC. Set a rate to create the credit._

**Dependent exemption options:**
- **Mississippi Dependent exemption**
  - _Adjust, partially repeal, or eliminate Mississippi's dependent exemption. Pair it with a state EITC or child allowance to model a swap._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Mississippi's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 1500$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $1,500. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Montana (MT)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: Montana EITC - 20% match
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **Montana EITC**
  - _Adjust Montana's state EITC as a percentage of the federal EITC. Current: 20%._
  - Match rate (match_rate): default 20%, range 0-100%
    - _Percentage of the federal EITC. Current: 20%._

## North Carolina (NC)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: None
- CDCC: no | Dependent exemption: no

**State EITC options:**
- **North Carolina EITC**
  - _Create a refundable North Carolina EITC as a percentage of the federal EITC._
  - Match rate (match_rate): default 0%, range 0-100%
    - _Percentage of the federal EITC. Set a rate to create the credit._

**Dependent exemption options:**
- **North Carolina Dependent deduction**
  - _Eliminate North Carolina's dependent deduction. (Its per-dependent value varies by income/age/filing status, so only full repeal is offered.) Pair it with a state EITC or child allowance to model a swap. Child deduction varies by AGI bracket and filing status (no single per-child amount), so eliminate-only._
  - Eliminate the dependent deduction (eliminate): default 0, range 0-1
    - _Repeal North Carolina's dependent deduction entirely (set it to $0)._

## North Dakota (ND)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: None
- CDCC: no | Dependent exemption: no

**State EITC options:**
- **North Dakota EITC**
  - _Create a refundable North Dakota EITC as a percentage of the federal EITC._
  - Match rate (match_rate): default 0%, range 0-100%
    - _Percentage of the federal EITC. Set a rate to create the credit._

## Nebraska (NE)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None (note: Nebraska offers a refundable Child Care Tax Credit of up to $2,000 per child age 5 or under (income-limited), but it requires the child to be enrolled in licensed child care, so it is not a per-child Child Tax Credit and is not adjustable here.)
- State EITC: Nebraska EITC - 10% match
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **Nebraska EITC**
  - _Adjust Nebraska's state EITC as a percentage of the federal EITC. Current: 10%._
  - Match rate (match_rate): default 10%, range 0-100%
    - _Percentage of the federal EITC. Current: 10%._

**Dependent exemption options:**
- **Nebraska Dependent credit**
  - _Adjust, partially repeal, or eliminate Nebraska's dependent credit. Pair it with a state EITC or child allowance to model a swap. Dependent portion of NE's personal-exemption credit._
  - Eliminate the dependent credit (eliminate): default 0, range 0-1
    - _Repeal Nebraska's dependent credit entirely (set it to $0)._
  - Amount per dependent (amount): default 175$, range 0-10000$
    - _Per-dependent dependent credit amount. Current: $175. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent credit to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent credit by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent credit; dependents this age or older get none._

## New Hampshire (NH)

**Income tax:** no
**Current Programs panel:**
- State CTC: None
- State EITC: None
- CDCC: no | Dependent exemption: no

## New Jersey (NJ)

**Income tax:** yes
**Current Programs panel:**
- State CTC: New Jersey Child Tax Credit - $1250
- State EITC: New Jersey EITC - 40% match
- CDCC: yes | Dependent exemption: yes

**State CTC options:**
- **New Jersey Child Tax Credit**
  - _Refundable credit for children under 6, stepping down with NJ taxable income across six brackets. Tier amounts reflect the 25% increase P.L.2026 c.26 enacted for TY2026-2028. Edit each tier amount and the income thresholds between tiers._
  - Tier 1 amount (lowest income) (tier1): default 1250$, range 0-3000$
    - _Per-child credit for this income tier._
  - Tier 2 income threshold (threshold2): default 30000$, range 0-200000$
    - _NJ taxable income where the credit steps down to the tier-2 amount._
  - Tier 2 amount (tier2): default 1000$, range 0-3000$
    - _Per-child credit for this income tier._
  - Tier 3 income threshold (threshold3): default 40000$, range 0-200000$
    - _NJ taxable income where the credit steps down to the tier-3 amount._
  - Tier 3 amount (tier3): default 750$, range 0-3000$
    - _Per-child credit for this income tier._
  - Tier 4 income threshold (threshold4): default 50000$, range 0-200000$
    - _NJ taxable income where the credit steps down to the tier-4 amount._
  - Tier 4 amount (tier4): default 500$, range 0-3000$
    - _Per-child credit for this income tier._
  - Tier 5 income threshold (threshold5): default 60000$, range 0-200000$
    - _NJ taxable income where the credit steps down to the tier-5 amount._
  - Tier 5 amount (tier5): default 250$, range 0-3000$
    - _Per-child credit for this income tier._
  - Top tier income threshold (threshold6): default 80000$, range 0-200000$
    - _NJ taxable income at/above which the top-tier amount applies._
  - Top tier amount (highest income) (tier6): default 0$, range 0-3000$
    - _Per-child credit for this income tier._
  - Eligible if under age (age): default 6yr, range 0-19yr
    - _Age limit for an eligible child._

**State EITC options:**
- **New Jersey EITC**
  - _Adjust New Jersey's state EITC as a percentage of the federal EITC. Current: 40%._
  - Match rate (match_rate): default 40%, range 0-100%
    - _Percentage of the federal EITC. Current: 40%._

**Dependent exemption options:**
- **New Jersey Dependent exemption**
  - _Adjust, partially repeal, or eliminate New Jersey's dependent exemption. Pair it with a state EITC or child allowance to model a swap._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal New Jersey's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 1500$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $1,500. Lower it to partially repeal._
  - Additional per college dependent (under 22) (college_amount): default 1000$, range 0-10000$
    - _Current: $1,000. Set to 0 to drop just this piece, or use Eliminate to remove all of New Jersey's dependent exemption._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## New Mexico (NM)

**Income tax:** yes
**Current Programs panel:**
- State CTC: New Mexico Child Income Tax Credit - $651
- State EITC: New Mexico EITC - 25% match
- CDCC: yes | Dependent exemption: yes

**State CTC options:**
- **New Mexico Child Income Tax Credit**
  - _Refundable credit for all qualifying children, stepping down with federal AGI ($651 down to about $27 in 2026, indexed). Edit each tier amount._
  - Tier 1 amount (lowest AGI) (tier1): default 651$, range 0-2000$
    - _Per-child credit for this income tier._
  - Tier 2 amount (tier2): default 434$, range 0-2000$
    - _Per-child credit for this income tier._
  - Tier 3 amount (tier3): default 217$, range 0-2000$
    - _Per-child credit for this income tier._
  - Tier 4 amount (tier4): default 108$, range 0-2000$
    - _Per-child credit for this income tier._
  - Tier 5 amount (tier5): default 80.79$, range 0-2000$
    - _Per-child credit for this income tier._
  - Tier 6 amount (tier6): default 54.2$, range 0-2000$
    - _Per-child credit for this income tier._
  - Tier 7 amount (highest AGI) (tier7): default 26.59$, range 0-2000$
    - _Per-child credit for this income tier._
  - Tier 2 income threshold (threshold1): default 25000$, range 0-500000$
    - _Federal AGI where the credit steps down to the second tier._
  - Tier 3 income threshold (threshold2): default 50000$, range 0-500000$
    - _Federal AGI where the credit steps down to the third tier._
  - Tier 4 income threshold (threshold3): default 75001$, range 0-500000$
    - _Federal AGI where the credit steps down to the fourth tier._
  - Tier 5 income threshold (threshold4): default 100000$, range 0-500000$
    - _Federal AGI where the credit steps down to the fifth tier._
  - Tier 6 income threshold (threshold5): default 200000$, range 0-500000$
    - _Federal AGI where the credit steps down to the sixth tier._
  - Top tier income threshold (threshold6): default 350000$, range 0-500000$
    - _Federal AGI at/above which the lowest tier applies._

**State EITC options:**
- **New Mexico EITC**
  - _Adjust New Mexico's state EITC as a percentage of the federal EITC. Current: 25%._
  - Match rate (match_rate): default 25%, range 0-100%
    - _Percentage of the federal EITC. Current: 25%._

## Nevada (NV)

**Income tax:** no
**Current Programs panel:**
- State CTC: None
- State EITC: None
- CDCC: no | Dependent exemption: no

## New York (NY)

**Income tax:** yes
**Current Programs panel:**
- State CTC: Empire State Child Credit - $1000
- State EITC: New York EITC - 30% match
- CDCC: yes | Dependent exemption: yes

**State CTC options:**
- **New York Empire State Child Credit**
  - _Current (2025–2027) structure pays by child age and phases out by filing status. After 2027 it reverts to the regular 33%-of-federal credit unless you extend it below._
  - Amount (ages 0–3) (young_amount): default 1000$, range 0-5000$
    - _Credit per child under age 4._
  - Amount (ages 4–16) (older_amount): default 500$, range 0-5000$
    - _Credit per child age 4–16._
  - Older tier starts at age (split_age): default 4yr, range 1-18yr
    - _Children under this age get the ages 0–3 amount; from this age up to the eligibility cap they get the ages 4–16 amount._
  - Ineligible at age (max_age): default 17yr, range 1-19yr
    - _Children this age or older receive no credit._
  - Phase-out (single) (threshold_single): default 75000$, range 0-500000$
    - _Federal AGI where phase-out begins (single)._
  - Phase-out (joint) (threshold_joint): default 110000$, range 0-500000$
    - _Federal AGI where phase-out begins (joint)._
  - Phase-out (head of household) (threshold_hoh): default 75000$, range 0-500000$
    - _Federal AGI where phase-out begins (HoH)._
  - Phase-out (separate) (threshold_separate): default 55000$, range 0-500000$
    - _Federal AGI where phase-out begins (separate)._
  - Phase-out (surviving spouse) (threshold_surviving_spouse): default 110000$, range 0-500000$
    - _Federal AGI where phase-out begins (surviving spouse)._
  - Reduction per increment (rate): default 16.5$, range 0-500$
    - _Dollars of credit lost for each AGI increment over the threshold (increments are rounded up)._
  - AGI increment size (increment): default 1000$, range 1-20000$
    - _Income step the phase-out counts: the credit drops by the reduction amount for each increment of AGI over the threshold._

**State EITC options:**
- **New York EITC**
  - _Adjust New York's state EITC as a percentage of the federal EITC. Current: 30%._
  - Match rate (match_rate): default 30%, range 0-100%
    - _Percentage of the federal EITC. Current: 30%._

**Dependent exemption options:**
- **New York Dependent exemption**
  - _Adjust, partially repeal, or eliminate New York's dependent exemption. Pair it with a state EITC or child allowance to model a swap._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal New York's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 1000$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $1,000. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Ohio (OH)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: Ohio EITC - 30% match
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **Ohio EITC**
  - _Convert Ohio's nonrefundable EITC to refundable and adjust the match rate. Current: 30% (nonrefundable)._
  - Make refundable (make_refundable): default 0, range 0-1
    - _Make Ohio's EITC fully refundable._
  - Match rate (match_rate): default 30%, range 0-150%
    - _Percentage of the federal EITC. Current: 30%. Adjusting the rate alone keeps the credit non-refundable._

**Dependent exemption options:**
- **Ohio Dependent exemption**
  - _Adjust, partially repeal, or eliminate Ohio's dependent exemption. Pair it with a state EITC or child allowance to model a swap. Ohio applies this exemption per person (taxpayer, spouse, and each dependent), stepped by MAGI; editing it adjusts the full per-exemption schedule, not dependents alone._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Ohio's dependent exemption entirely (set it to $0)._
  - Per person (MAGI under $40k) (amount): default 2400$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $2,400. Lower it to partially repeal._
  - Per person (MAGI $40k-$80k) (amount_mid): default 2150$, range 0-10000$
    - _Current: $2,150. Set to 0 to drop just this piece, or use Eliminate to remove all of Ohio's dependent exemption._
  - Per person (MAGI over $80k) (amount_high): default 1900$, range 0-10000$
    - _Current: $1,900. Set to 0 to drop just this piece, or use Eliminate to remove all of Ohio's dependent exemption._
  - MAGI where the middle tier starts (threshold_mid): default 40001$, range 0-500000$
    - _Income/age threshold where this bracket applies. Current: $40,001._
  - MAGI where the top tier starts (threshold_high): default 80001$, range 0-500000$
    - _Income/age threshold where this bracket applies. Current: $80,001._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Oklahoma (OK)

**Income tax:** yes
**Current Programs panel:**
- State CTC: Oklahoma Child Care/Child Tax Credit - $110
- State EITC: Oklahoma EITC - 5% match
- CDCC: yes | Dependent exemption: yes

**State CTC options:**
- **Oklahoma Child Tax Credit**
  - _Nonrefundable credit worth a percentage of the greater of the federal Child Tax Credit or the federal Child and Dependent Care Credit, for filers below the state income limit._
  - Credit (% of federal CTC/CDCC) (rate): default 5%, range 0-100%
    - _Percentage of the greater of the federal CTC or CDCC. Current: 5%._
  - Make the credit refundable (make_refundable): default 0, range 0-1
    - _Pay the full credit as a refund when it exceeds tax owed. Under 68 O.S. § 2357 the credit cannot exceed tax liability, which strands most of its value for low-income families._

**State EITC options:**
- **Oklahoma EITC**
  - _Adjust Oklahoma's state EITC as a percentage of the federal EITC. Current: 5%._
  - Match rate (match_rate): default 5%, range 0-100%
    - _Percentage of the federal EITC. Current: 5%._

**Dependent exemption options:**
- **Oklahoma Dependent exemption**
  - _Adjust, partially repeal, or eliminate Oklahoma's dependent exemption. Pair it with a state EITC or child allowance to model a swap. Dependent portion of the state's personal exemption._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Oklahoma's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 1000$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $1,000. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Oregon (OR)

**Income tax:** yes
**Current Programs panel:**
- State CTC: Oregon Kids Credit - $1050
- State EITC: Oregon EITC (structured; name only)
- CDCC: yes | Dependent exemption: yes

**State CTC options:**
- **Oregon Child Tax Credit**
  - _Refundable credit ($1,050 per child, ages 0–5 only; Oregon excludes children at or above the age below). Phases out against Oregon AGI._
  - Credit amount (amount): default 1050$, range 0-6000$
    - _Maximum credit per eligible child._
  - Ineligible at/above age (age): default 6yr, range 0-19yr
    - _Age limit for an eligible child._
  - Max children (child_limit): default 5, range 1-12
    - _Maximum number of children the credit covers._
  - Phase-out start (OR AGI) (phaseout_start): default 27250$, range 0-200000$
    - _Oregon AGI where the credit starts phasing out ($27,250 for 2026 under ORS 315.273(5), encoded exactly in the pinned PE-US)._
  - Phase-out width (phaseout_width): default 5000$, range 0-100000$
    - _Income range over which the credit phases to $0._

**State EITC options:**
- **Oregon earned income credit**
  - _Oregon's earned income credit is a percentage of the federal EITC, with a higher rate for filers who have a young child (under 3). Set each rate._
  - Match rate (with young child) (match_young_child): default 17%, range 0-100%
    - _Percentage of the federal EITC for filers with a child under 3. Current: 17% (raised from 12% by SB 1507 for tax year 2026)._
  - Match rate (no young child) (match_no_young_child): default 14%, range 0-100%
    - _Percentage of the federal EITC for filers with no child under 3. Current: 14% (raised from 9% by SB 1507 for tax year 2026)._

**Dependent exemption options:**
- **Oregon Dependent credit**
  - _Adjust, partially repeal, or eliminate Oregon's dependent credit. Pair it with a state EITC or child allowance to model a swap._
  - Eliminate the dependent credit (eliminate): default 0, range 0-1
    - _Repeal Oregon's dependent credit entirely (set it to $0)._
  - Amount per dependent (amount): default 262$, range 0-10000$
    - _Per-dependent dependent credit amount. Current: $262. Lower it to partially repeal._

## Pennsylvania (PA)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: Working Pennsylvanians Tax Credit - 10% match
- CDCC: yes | Dependent exemption: no

**State EITC options:**
- **Pennsylvania EITC**
  - _Adjust Pennsylvania's state EITC as a percentage of the federal EITC. Current: 10%._
  - Match rate (match_rate): default 10%, range 0-100%
    - _Percentage of the federal EITC. Current: 10%._

## Rhode Island (RI)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None (note: Rhode Island's Child Tax Rebate was a one-time 2022 payment. The state's $330 Child Tax Credit (H 7127) takes effect in 2027, so it appears as a reform option for 2027 or later analysis years.)
- State EITC: Rhode Island EITC - 16% match
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **Rhode Island EITC**
  - _Adjust Rhode Island's state EITC as a percentage of the federal EITC. Current: 16%._
  - Match rate (match_rate): default 16%, range 0-100%
    - _Percentage of the federal EITC. Current: 16%._

**Dependent exemption options:**
- **Rhode Island Dependent exemption**
  - _Adjust, partially repeal, or eliminate Rhode Island's dependent exemption. Pair it with a state EITC or child allowance to model a swap._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Rhode Island's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 5250$, range 0-10500$
    - _Per-dependent dependent exemption amount. Current: $5,250. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## South Carolina (SC)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: South Carolina EITC - 125% match
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **South Carolina EITC**
  - _Convert South Carolina's nonrefundable EITC to refundable and adjust the match rate. Current: 125% (nonrefundable)._
  - Make refundable (make_refundable): default 0, range 0-1
    - _Make South Carolina's EITC fully refundable._
  - Match rate (match_rate): default 125%, range 0-150%
    - _Percentage of the federal EITC. Current: 125%. Adjusting the rate alone keeps the credit non-refundable._
  - Eliminate the cap (eliminate_cap): default 0, range 0-1
    - _Remove South Carolina's EITC cap (raise it to $1 billion)._
  - EITC cap (eitc_cap): default 200$, range 0-5000$
    - _Maximum South Carolina EITC per filer. Current: $200 (2026)._

**Dependent exemption options:**
- **South Carolina Dependent exemption**
  - _Adjust, partially repeal, or eliminate South Carolina's dependent exemption. Pair it with a state EITC or child allowance to model a swap. Per-dependent dependent exemption (Â§12-6-1140) plus a stacked young-child deduction (Â§12-6-1160) of the same amount for dependents under 6, each its own policyengine-us parameter. Both amounts are editable; â€˜eliminateâ€™ zeroes both. The young-child age limit sets which dependents qualify for the extra deduction._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal South Carolina's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 5040$, range 0-10100$
    - _Per-dependent dependent exemption amount. Current: $5,040. Lower it to partially repeal._
  - Young-child deduction (per dependent under 6) (young_child_amount): default 5040$, range 0-12000$
    - _Current: $5,040. Set to 0 to drop just this piece, or use Eliminate to remove all of South Carolina's dependent exemption._
  - Young-child deduction age limit (young_child_age): default 6years, range 0-24years
    - _Income/age threshold where this bracket applies. Current: 6 years._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## South Dakota (SD)

**Income tax:** no
**Current Programs panel:**
- State CTC: None
- State EITC: None
- CDCC: no | Dependent exemption: no

## Tennessee (TN)

**Income tax:** no
**Current Programs panel:**
- State CTC: None
- State EITC: None
- CDCC: no | Dependent exemption: no

## Texas (TX)

**Income tax:** no
**Current Programs panel:**
- State CTC: None
- State EITC: None
- CDCC: no | Dependent exemption: no

## Utah (UT)

**Income tax:** yes
**Current Programs panel:**
- State CTC: Utah Child Tax Credit - $1000
- State EITC: Utah EITC - 20% match
- CDCC: yes | Dependent exemption: yes

**State CTC options:**
- **Utah Child Tax Credit**
  - _Non-refundable credit ($1,000/child). Phases out by filing status against state AGI plus tax-exempt interest. (Age eligibility is a fixed band and is not adjustable here.)_
  - Credit amount (amount): default 1000$, range 0-5000$
    - _Maximum credit per eligible child._
  - Phase-out (single) (threshold_single): default 49000$, range 0-500000$
    - _Income where phase-out begins (single)._
  - Phase-out (head of household) (threshold_hoh): default 49000$, range 0-500000$
    - _Income where phase-out begins (HoH)._
  - Phase-out (joint) (threshold_joint): default 61000$, range 0-500000$
    - _Income where phase-out begins (joint)._
  - Phase-out (surviving spouse) (threshold_surviving_spouse): default 61000$, range 0-500000$
    - _Income where phase-out begins (surviving spouse)._
  - Phase-out (separate) (threshold_separate): default 30500$, range 0-500000$
    - _Income where phase-out begins (separate)._
  - Phase-out rate (phaseout_rate): default 10%, range 0-100%
    - _Share of income above the threshold that reduces the credit._
  - Make the credit (partially) refundable (make_refundable): default 0, range 0-1
    - _Apply a proposed restructure of Utah Code 59-10-1047 (a proposal, not enacted law): $1,000 per child with higher phase-out starts (single $49k / joint $98k / separate $30.5k) and a refundable portion per child (below). While on, the reform's own thresholds replace the phase-out inputs above; the phase-out rate still applies._
  - Reform credit amount (reform_amount): default 1000$, range 0-5000$, shown when make_refundable
    - _Per-child amount under the proposed restructure. Reform default: $1,000._
  - Refundable portion per child (refundable_amount): default 800$, range 0-5000$, shown when make_refundable
    - _Maximum refunded per child beyond tax owed. $800 under the 2026 reform; set it equal to the credit amount for a fully refundable credit, or 0 for nonrefundable._

**State EITC options:**
- **Utah EITC**
  - _Convert Utah's nonrefundable EITC to refundable and adjust the match rate. Current: 20% (nonrefundable)._
  - Make refundable (make_refundable): default 0, range 0-1
    - _Make Utah's EITC fully refundable._
  - Match rate (match_rate): default 20%, range 0-150%
    - _Percentage of the federal EITC. Current: 20%. Adjusting the rate alone keeps the credit non-refundable._

**Dependent exemption options:**
- **Utah Dependent exemption**
  - _Eliminate Utah's dependent exemption. (Its per-dependent value varies by income/age/filing status, so only full repeal is offered.) Pair it with a state EITC or child allowance to model a swap. The per-dependent exemption inside the Utah Taxpayer Tax Credit shares its amount with the personal exemption, so only full repeal (which isolates ut_personal_exemption) is offered; editing the amount would need a contributed reform._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Utah's dependent exemption entirely (set it to $0)._

## Virginia (VA)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: Virginia EITC - 20% match
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **Virginia EITC**
  - _Adjust Virginia's state EITC as a percentage of the federal EITC. Current: 20%._
  - Match rate (match_rate): default 20%, range 0-100%
    - _Percentage of the federal EITC. Current: 20%._

**Dependent exemption options:**
- **Virginia Dependent exemption**
  - _Adjust, partially repeal, or eliminate Virginia's dependent exemption. Pair it with a state EITC or child allowance to model a swap._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Virginia's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 930$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $930. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Vermont (VT)

**Income tax:** yes
**Current Programs panel:**
- State CTC: Vermont Child Tax Credit - $1000
- State EITC: Vermont EITC - 38% match
- CDCC: yes | Dependent exemption: yes

**State CTC options:**
- **Vermont Child Tax Credit**
  - _Refundable credit ($1,000/child, ages 0–6). Phases out against AGI above $125,000._
  - Credit amount (amount): default 1000$, range 0-5000$
    - _Maximum credit per eligible child._
  - Eligible if age at most (age): default 6yr, range 0-19yr
    - _Age limit for an eligible child._
  - Phase-out start (AGI) (phaseout_start): default 125000$, range 0-500000$
    - _AGI where the credit starts phasing out._
  - Reduction amount (phaseout_amount): default 20$, range 0-500$
    - _Dollars of credit lost per AGI increment (below) over the threshold._
  - AGI increment (phaseout_increment): default 1000$, range 1-10000$
    - _AGI step the reduction applies per. Current: $1,000._

**State EITC options:**
- **Vermont EITC**
  - _Adjust Vermont's state EITC as a percentage of the federal EITC. Current: 38%._
  - Match rate (match_rate): default 38%, range 0-100%
    - _Percentage of the federal EITC. Current: 38%._

**Dependent exemption options:**
- **Vermont Dependent exemption**
  - _Adjust, partially repeal, or eliminate Vermont's dependent exemption. Pair it with a state EITC or child allowance to model a swap. Dependent portion of the state's personal exemption._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Vermont's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 5400$, range 0-10800$
    - _Per-dependent dependent exemption amount. Current: $5,400. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Washington (WA)

**Income tax:** no
**Current Programs panel:**
- State CTC: None
- State EITC: Working Families Tax Credit (structured; name only)
- CDCC: no | Dependent exemption: no

**State EITC options:**
- **Washington Working Families Tax Credit**
  - _Washington's Working Families Tax Credit, a refundable EITC-style credit (Washington has no income tax). The maximum amount rises with the number of qualifying children._
  - Max amount (no children) (amount_0_children): default 345$, range 0-3000$
    - _Maximum credit for a filer with no qualifying children. Current: $335 (2025)._
  - Max amount (1 child) (amount_1_child): default 675$, range 0-4000$
    - _Maximum credit with one qualifying child. Current: $660 (2025)._
  - Max amount (2 children) (amount_2_children): default 1020$, range 0-5000$
    - _Maximum credit with two qualifying children. Current: $995 (2025)._
  - Max amount (3+ children) (amount_3_children): default 1360$, range 0-6000$
    - _Maximum credit with three or more qualifying children. Current: $1,330 (2025)._
  - Minimum amount (min_amount): default 50$, range 0-500$
    - _Minimum credit for an eligible filer with a nonzero benefit. Current: $50._
  - Phase-out margin (no children) (phaseout_start_below_none): default 2500$, range 0-30000$
    - _The credit starts phasing out this far below the federal EITC income limit for filers with no qualifying children. Current: $2,500. A larger margin starts the phase-out at lower incomes._
  - Phase-out margin (with children) (phaseout_start_below_children): default 5000$, range 0-30000$
    - _The credit starts phasing out this far below the federal EITC income limit for filers with qualifying children. Current: $5,000._

## Wisconsin (WI)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: Wisconsin Earned Income Credit (structured; name only)
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **Wisconsin Earned Income Credit**
  - _Wisconsin's earned income credit is a percentage of the federal EITC that rises with the number of qualifying children. Set the match rate for each family size._
  - Match rate (1 child) (match_1_child): default 4%, range 0-100%
    - _Percentage of the federal EITC with one qualifying child. Current: 4%._
  - Match rate (2 children) (match_2_children): default 11%, range 0-100%
    - _Percentage of the federal EITC with two qualifying children. Current: 11%._
  - Match rate (3+ children) (match_3_children): default 34%, range 0-100%
    - _Percentage of the federal EITC with three or more qualifying children. Current: 34%._

**Dependent exemption options:**
- **Wisconsin Dependent exemption**
  - _Adjust, partially repeal, or eliminate Wisconsin's dependent exemption. Pair it with a state EITC or child allowance to model a swap. Dependent portion of the state's personal exemption._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal Wisconsin's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 700$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $700. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## West Virginia (WV)

**Income tax:** yes
**Current Programs panel:**
- State CTC: None
- State EITC: None
- CDCC: yes | Dependent exemption: yes

**State EITC options:**
- **West Virginia EITC**
  - _Create a refundable West Virginia EITC as a percentage of the federal EITC._
  - Match rate (match_rate): default 0%, range 0-100%
    - _Percentage of the federal EITC. Set a rate to create the credit._

**Dependent exemption options:**
- **West Virginia Dependent exemption**
  - _Adjust, partially repeal, or eliminate West Virginia's dependent exemption. Pair it with a state EITC or child allowance to model a swap. Dependent portion of the state's personal exemption._
  - Eliminate the dependent exemption (eliminate): default 0, range 0-1
    - _Repeal West Virginia's dependent exemption entirely (set it to $0)._
  - Amount per dependent (amount): default 2000$, range 0-10000$
    - _Per-dependent dependent exemption amount. Current: $2,000. Lower it to partially repeal._
  - Only dependents under a certain age (age_limit_enabled): default 0, range 0-1
    - _Limit the dependent exemption to dependents under the age below; dependents at or above that age no longer receive it. Combine with the amount above to re-target the dependent exemption by age._
  - Maximum dependent age (age_limit_age): default 18years, range 1-24years, shown when age_limit_enabled
    - _Only dependents under this age receive the dependent exemption; dependents this age or older get none._

## Wyoming (WY)

**Income tax:** no
**Current Programs panel:**
- State CTC: None
- State EITC: None
- CDCC: no | Dependent exemption: no

