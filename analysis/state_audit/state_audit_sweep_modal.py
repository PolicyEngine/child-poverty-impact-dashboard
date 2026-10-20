"""Dataset-adoption sweep: audit a set of per-state slices under a given
policyengine-us pin.

Generalizes ``state_audit_populace_modal.py`` (the Build P adoption audit,
kept as-is so its 8/20 numbers stay reproducible) so two production
candidates can be audited with identical code:

    production:  Build P slices (592ae5d6) under policyengine-us 1.825.2
    candidate:   Build O 10/17 slices (766b7c7) under policyengine-us 2.30.1

Per state it reports the Build P audit's metrics — populations, SPM poverty
rates, the state's own EITC/CTC program cost — plus Social Security, SSI and
SNAP totals and a reference reform (restore the 2021 expanded CTC): the
child-poverty change and the aggregate transfer, since reform impacts are what
the dashboard reports. Poverty rates come two ways: all SPM units, and
"measured" (ACS group quarters masked, the Census ACS SPM universe).

The pin is baked into the image at deploy time, so set it in the environment
and deploy one app per pin; ``sweep_jobs.py`` then spawns and collects the
per-state calls server-side (see ANALYSIS_BUILDO_1017.md for the 10/20 run)::

    AUDIT_PE_US=2.30.1 modal deploy analysis/state_audit/state_audit_sweep_modal.py
    AUDIT_PE_US=1.825.2 AUDIT_SPM_CALC=0.3.1 \
        AUDIT_PE_US_SPEC="policyengine-us @ git+https://github.com/PolicyEngine/policyengine-us@9f77bffb6b" \
        modal deploy analysis/state_audit/state_audit_sweep_modal.py

``modal run ... --slice-tag 766b7c7 --label x --year 2024`` also works for a
quick interactive run, but its local client must stay alive for the whole map.
Writes ``analysis/state_audit/output/state_audit_{label}_{year}_raw.json``.
"""

from __future__ import annotations

import json
import os

import modal

PE_US_PIN = os.environ.get("AUDIT_PE_US", "2.30.1")
# 1.825.2 needs spm-calculator 0.3.1 (1.0.0 dropped the geoadj module it
# imports); 2.x pins its own compatible spm-calculator.
SPM_CALC = os.environ.get("AUDIT_SPM_CALC", "")

app = modal.App(f"cpid-dataset-sweep-{PE_US_PIN.replace('.', '-')}")

# AUDIT_PE_US_SPEC overrides the requirement for versions no longer on PyPI
# (1.825.2 was pruned; its release commit is 9f77bffb6b):
#   AUDIT_PE_US_SPEC="policyengine-us @ git+https://github.com/PolicyEngine/policyengine-us@9f77bffb6b"
PE_US_SPEC = os.environ.get("AUDIT_PE_US_SPEC", f"policyengine-us=={PE_US_PIN}")
_pkgs = [PE_US_SPEC, "numpy>=1.24.0", "pandas>=2.0.0", "tables", "huggingface_hub"]
if SPM_CALC:
    _pkgs.append(f"spm-calculator=={SPM_CALC}")
_base = modal.Image.debian_slim(python_version="3.11")
if "git+" in PE_US_SPEC:
    _base = _base.apt_install("git")
image = _base.pip_install(*_pkgs)

slices_volume = modal.Volume.from_name("cpid-populace-slices")

STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
    "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
    "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
    "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
    "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]


def _ctc_2021_reform(year: int) -> dict:
    d = f"{year}-01-01"
    return {
        "gov.irs.credits.ctc.amount.arpa[0].amount": {d: 3600},
        "gov.irs.credits.ctc.amount.arpa[1].amount": {d: 3000},
        "gov.irs.credits.ctc.refundable.fully_refundable": {d: True},
        "gov.irs.credits.ctc.phase_out.arpa.in_effect": {d: True},
    }


# ACS group quarters are outside Census's ACS SPM universe (household
# population only). Same rule as policyengine.py's legacy SPM override
# (tax_benefit_models/us/legacy_spm/universe.py): an ACS-channel person whose
# household TYPEHUGQ is 2 (institutional, RELSHIPP 37) or 3 (noninstitutional,
# RELSHIPP 38) is in an OUTSIDE SPM unit. Plain policyengine-us does not scope
# SPM measurement yet (PolicyEngine/policyengine-us#9462), so the audit masks
# these people out of poverty rates itself ("measured" rates).
ACS_CHANNEL = "acs_2024_1yr"
ACS_GROUP_QUARTERS = {2: 37, 3: 38}


def _outside_person_ids(path: str):
    """Person IDs in OUTSIDE (group-quarters) SPM units, or None when the
    slice lacks the record-type evidence (pre-rebuild releases)."""
    import pandas as pd

    with pd.HDFStore(path, "r") as store:
        person = store["person"]
        household = store["household"]
    need_p = {"person_id", "person_household_id", "person_spm_unit_id",
              "person_support_channel", "RELSHIPP"}
    if not need_p <= set(person.columns) or "TYPEHUGQ" not in household.columns:
        return None
    channel = person["person_support_channel"].map(
        lambda v: v.decode() if isinstance(v, bytes) else str(v)
    )
    rel = pd.to_numeric(person["RELSHIPP"], errors="coerce")
    rtype = pd.to_numeric(
        person["person_household_id"].map(
            household.set_index("household_id")["TYPEHUGQ"]
        ),
        errors="coerce",
    )
    gq = pd.Series(False, index=person.index)
    for t, r in ACS_GROUP_QUARTERS.items():
        gq |= channel.eq(ACS_CHANNEL) & rtype.eq(t) & rel.eq(r)
    outside_units = set(person.loc[gq, "person_spm_unit_id"])
    return set(
        person.loc[person["person_spm_unit_id"].isin(outside_units), "person_id"]
    )


@app.function(
    image=image,
    memory=32768,
    cpu=2.0,
    timeout=3600,
    retries=1,
    volumes={"/slices": slices_volume},
)
def audit_state(state_code: str, year: int, slice_tag: str) -> dict:
    import importlib.metadata as md
    import time

    import numpy as np
    from policyengine_core.reforms import Reform
    from policyengine_us import Microsimulation
    from policyengine_us.data import USSingleYearDataset

    t0 = time.perf_counter()
    state_code = state_code.upper()
    path = f"/slices/{slice_tag}/{state_code}.h5"
    if not os.path.exists(path):
        raise RuntimeError(f"Missing slice {path}")

    def _sim(reform=None):
        return Microsimulation(
            dataset=USSingleYearDataset(file_path=path), reform=reform
        )

    out: dict = {
        "state": state_code,
        "year": year,
        "slice_tag": slice_tag,
        "pe_us": md.version("policyengine-us"),
        "spm_calculator": md.version("spm-calculator"),
        # Transitive pins move results too (policyengine-core is unpinned by
        # policyengine-us): record them so drift between runs is attributable.
        "policyengine_core": md.version("policyengine-core"),
        "numpy": md.version("numpy"),
        "pandas": md.version("pandas"),
    }
    try:
        sim = _sim()
        age = np.array(sim.calculate("age", period=year))
        pw = np.array(sim.calculate("person_weight", period=year))
        hw = np.array(sim.calculate("household_weight", period=year))

        def _pop(mask) -> float:
            return float(pw[mask].sum())

        def _rate(arr, mask) -> float:
            tot = float(pw[mask].sum())
            return float((arr[mask] * pw[mask]).sum() / tot * 100) if tot else 0.0

        def _mrate(arr, mask) -> float:  # measured units only (GQ masked)
            return _rate(arr, mask & measured)

        def _hh_sum(s, name: str) -> float:
            try:
                arr = np.array(s.calculate(name, period=year, map_to="household"))
                return float((arr * hw).sum())
            except Exception:
                return float("nan")

        all_m = np.ones_like(age, dtype=bool)
        u1, u5, u6, u18 = age < 1, age < 5, age < 6, age < 18
        outside_ids = _outside_person_ids(path)
        if outside_ids is None:
            measured = all_m
        else:
            pid = np.array(sim.calculate("person_id", period=year))
            measured = ~np.isin(pid, list(outside_ids))
        pov = np.array(
            sim.calculate("in_poverty", period=year, map_to="person")
        ).astype(bool)
        deep = np.array(
            sim.calculate("in_deep_poverty", period=year, map_to="person")
        ).astype(bool)

        # Own-state credit variables only (the state_eitc/state_ctc
        # aggregates add every state's credits — see state_audit_modal.py).
        st = state_code.lower()
        params = sim.tax_benefit_system.parameters

        def _own(param_path: str) -> list:
            try:
                node = params
                for part in param_path.split("."):
                    node = getattr(node, part)
                names = list(node(f"{year}-01-01"))
            except Exception:
                return []
            return [
                v for v in names
                if v.startswith(f"{st}_") or v.startswith(f"taxsim_{st}_")
            ]

        eitc_vars = _own("gov.states.household.state_eitcs")
        ctc_vars = _own("gov.states.household.state_ctcs")
        net_base = _hh_sum(sim, "household_net_income")
        out.update(
            {
                "pop_total": _pop(all_m),
                "pop_under_1": _pop(u1),
                "pop_under_5": _pop(u5),
                "pop_under_6": _pop(u6),
                "pop_under_18": _pop(u18),
                "poverty_all": _rate(pov, all_m),
                "poverty_child": _rate(pov, u18),
                "poverty_young_child": _rate(pov, u6),
                "poverty_under_1": _rate(pov, u1),
                "poverty_deep_child": _rate(deep, u18),
                "gq_mask_available": outside_ids is not None,
                "gq_person_share": float(pw[~measured].sum() / pw.sum() * 100),
                "gq_child_share": float(pw[u18 & ~measured].sum() / max(pw[u18].sum(), 1) * 100),
                "poverty_all_measured": _mrate(pov, all_m),
                "poverty_child_measured": _mrate(pov, u18),
                "poverty_young_child_measured": _mrate(pov, u6),
                "poverty_deep_child_measured": _mrate(deep, u18),
                "social_security_total": _hh_sum(sim, "social_security"),
                "eitc_vars": eitc_vars,
                "ctc_vars": ctc_vars,
                "eitc_cost": sum(_hh_sum(sim, v) for v in eitc_vars),
                "ctc_cost": sum(_hh_sum(sim, v) for v in ctc_vars),
                "ssi_total": _hh_sum(sim, "ssi"),
                "snap_total": _hh_sum(sim, "snap"),
                "tanf_total": _hh_sum(sim, "tanf"),
                "federal_eitc_total": _hh_sum(sim, "eitc"),
                "federal_ctc_total": _hh_sum(sim, "ctc"),
                "net_income_total": net_base,
                "households": float(hw.sum()),
                "n_households": int(len(hw)),
            }
        )
        out["has_eitc"] = out["eitc_cost"] > 1_000
        out["has_ctc"] = out["ctc_cost"] > 1_000
        del sim

        # Reference reform: restore the 2021 expanded CTC.
        rsim = _sim(Reform.from_dict(_ctc_2021_reform(year), country_id="us"))
        pov_r = np.array(
            rsim.calculate("in_poverty", period=year, map_to="person")
        ).astype(bool)
        out["ref_ctc2021_child_poverty"] = _rate(pov_r, u18)
        out["ref_ctc2021_child_poverty_measured"] = _mrate(pov_r, u18)
        out["ref_ctc2021_child_pov_change_pp_measured"] = (
            out["ref_ctc2021_child_poverty_measured"]
            - out["poverty_child_measured"]
        )
        out["ref_ctc2021_child_pov_change_pp"] = (
            out["ref_ctc2021_child_poverty"] - out["poverty_child"]
        )
        out["ref_ctc2021_transfer"] = _hh_sum(rsim, "household_net_income") - net_base
        out["status"] = "ok"
    except Exception as e:  # recorded, so one bad state can't sink the map
        out["status"] = "error"
        out["error"] = f"{type(e).__name__}: {str(e)[:400]}"
    out["runtime_s"] = round(time.perf_counter() - t0, 1)
    return out


@app.local_entrypoint()
def main(slice_tag: str, label: str, year: int = 2024, states: str = ""):
    targets = (
        [s.strip().upper() for s in states.split(",") if s.strip()]
        if states
        else STATES
    )
    print(f"Auditing {len(targets)} slices ({label}@{slice_tag}, "
          f"image pe-us {PE_US_PIN}) for {year}...")
    results = sorted(
        audit_state.map(targets, kwargs={"year": year, "slice_tag": slice_tag}),
        key=lambda r: r["state"],
    )
    out_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"state_audit_{label}_{year}_raw.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    bad = [r for r in results if r.get("status") != "ok"]
    print(f"\n{len(results) - len(bad)} ok, {len(bad)} errors -> {out_path}")
    for r in bad:
        print(f"  ERROR {r['state']}: {r.get('error')}")
    for r in results:
        if r.get("status") == "ok":
            print(f"{r['state']:<4}{r['pop_total']/1e6:>8.2f}M "
                  f"child_spm {r['poverty_child']:>5.1f}%  "
                  f"ctc2021 {r['ref_ctc2021_child_pov_change_pp']:>+6.2f}pp  "
                  f"{r['runtime_s']:>6.0f}s")
