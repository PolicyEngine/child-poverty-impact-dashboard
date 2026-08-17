"""Standalone Modal batch job: audit the PRODUCTION per-state datasets.

Same metrics as ``state_audit_modal.py`` (#61) — population counts, SPM
poverty rates, state EITC/CTC program cost — but computed from what the
dashboard actually serves: the per-state slices of the pinned Populace
revision on the ``cpid-populace-slices`` Volume, under the dashboard's
policyengine-us pin. The #61 run audited the legacy
``policyengine-us-data/states/{ST}.h5`` files, which the dashboard left
behind on 2026-07-07, so its numbers do not validate production; this
run does. Diff the two raw JSONs (plus the targets CSVs) via
``build_csvs.py --raw output/state_audit_populace_raw.json``.

Usage::

    modal run analysis/state_audit/state_audit_populace_modal.py
    modal run analysis/state_audit/state_audit_populace_modal.py --states CA,TX,VT

Writes ``analysis/state_audit/output/state_audit_populace_raw.json``.
"""

from __future__ import annotations

import json
import os

import modal

app = modal.App("state-dataset-audit-populace")

# Pins match scripts/modal_cpid_endpoint.py exactly — this audits the
# production build, so the two must move together.
PE_US_PIN = "1.768.5"
POPULACE_REVISION = "053baf6cf56aaf1160e2f1bfe7631c6924d46b2e"  # 2026-07-01

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        f"policyengine-us=={PE_US_PIN}",
        "numpy>=1.24.0",
        "huggingface_hub",
    )
    .env({"AUDIT_BUILD_REV": f"2026-08-17-populace-slices+pe-us-{PE_US_PIN}"})
)

slices_volume = modal.Volume.from_name("cpid-populace-slices")

STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
    "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
    "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
    "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
    "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]


@app.function(
    image=image,
    memory=16384,
    timeout=1800,
    retries=1,
    volumes={"/slices": slices_volume},
)
def audit_state(state_code: str, year: int) -> dict:
    import numpy as np
    from policyengine_us import Microsimulation

    state_code = state_code.upper()
    dataset = f"/slices/{POPULACE_REVISION[:8]}/{state_code}.h5"
    if not os.path.exists(dataset):
        raise RuntimeError(
            f"Missing slice {dataset} — run "
            "scripts/build_populace_state_slices.py for this revision."
        )
    sim = Microsimulation(dataset=dataset)

    age = np.array(sim.calculate("age", period=year))
    person_weight = np.array(sim.calculate("person_weight", period=year))

    def _pop(mask) -> float:
        return float(person_weight[mask].sum())

    all_mask = np.ones_like(age, dtype=bool)
    under_1 = age < 1
    under_5 = age < 5
    under_6 = age < 6
    under_18 = age < 18

    # SPM poverty (in_poverty is the SPM measure; map to person).
    pov = np.array(
        sim.calculate("in_poverty", period=year, map_to="person")
    ).astype(bool)
    try:
        deep = np.array(
            sim.calculate("in_deep_poverty", period=year, map_to="person")
        ).astype(bool)
    except Exception:
        deep = np.zeros_like(pov)

    def _rate(arr, mask) -> float:
        w = person_weight[mask]
        tot = float(w.sum())
        if tot == 0:
            return 0.0
        return float((arr[mask] * w).sum() / tot * 100)

    # State credit cost = weighted household sum of the credit variable.
    household_weight = np.array(
        sim.calculate("household_weight", period=year)
    )

    def _hh_sum(name: str) -> float:
        try:
            arr = np.array(
                sim.calculate(name, period=year, map_to="household")
            )
            return float((arr * household_weight).sum())
        except Exception:
            return 0.0

    # Sum only THIS state's own credit variables (the state_eitc/state_ctc
    # aggregates `adds` every state's credits — see state_audit_modal.py).
    date = f"{year}-01-01"
    st = state_code.lower()

    def _own_vars(param_path: str) -> list:
        try:
            node = sim.tax_benefit_system.parameters
            for part in param_path.split("."):
                node = getattr(node, part)
            names = list(node(date))
        except Exception:
            return []
        return [
            v for v in names
            if v.startswith(f"{st}_") or v.startswith(f"taxsim_{st}_")
        ]

    eitc_vars = _own_vars("gov.states.household.state_eitcs")
    ctc_vars = _own_vars("gov.states.household.state_ctcs")
    eitc_cost = sum(_hh_sum(v) for v in eitc_vars)
    ctc_cost = sum(_hh_sum(v) for v in ctc_vars)

    return {
        "state": state_code,
        "year": year,
        "dataset": f"populace@{POPULACE_REVISION[:8]} slice",
        "pe_us": PE_US_PIN,
        "pop_total": _pop(all_mask),
        "pop_under_1": _pop(under_1),
        "pop_under_5": _pop(under_5),
        "pop_under_6": _pop(under_6),
        "pop_under_18": _pop(under_18),
        "poverty_all": _rate(pov, all_mask),
        "poverty_child": _rate(pov, under_18),
        "poverty_young_child": _rate(pov, under_6),
        "poverty_under_1": _rate(pov, under_1),
        "poverty_deep_child": _rate(deep, under_18),
        "has_eitc": eitc_cost > 1_000,
        "eitc_cost": eitc_cost,
        "has_ctc": ctc_cost > 1_000,
        "ctc_cost": ctc_cost,
        "eitc_vars": eitc_vars,
        "ctc_vars": ctc_vars,
    }


@app.local_entrypoint()
def main(states: str = "", year: int = 2026):
    targets = (
        [s.strip().upper() for s in states.split(",") if s.strip()]
        if states
        else STATES
    )
    print(
        f"Auditing {len(targets)} production slices "
        f"(populace@{POPULACE_REVISION[:8]}, pe-us {PE_US_PIN}) for {year}..."
    )
    results = list(audit_state.map(targets, kwargs={"year": year}))
    results = [r for r in results if r]
    results.sort(key=lambda r: r["state"])

    out_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "state_audit_populace_raw.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"\n{len(results)} states audited -> {out_path}")
    print(f"{'st':<4}{'pop(M)':>9}{'child_pov%':>11}{'eitc($M)':>11}{'ctc($M)':>10}")
    for r in results:
        print(
            f"{r['state']:<4}{r['pop_total']/1e6:>9.2f}"
            f"{r['poverty_child']:>11.1f}"
            f"{r['eitc_cost']/1e6:>11.1f}{r['ctc_cost']/1e6:>10.1f}"
        )
