"""Project Census-correct ages onto the production state slices.

The ACS local-area slices count about 10% more children than Census
(microcosm#1528). Microcosm's fix calibrates each state's release to Census
Vintage 2025 age groups; until that release is rebuilt, this script projects
the fix onto existing slices:

1. For each state, entropy-balance the slice's 2024 household weights (minimum
   KL divergence from the slice's weights) to Census Vintage 2025 resident
   population on July 1, 2024 in the 15 age groups Microcosm binds (single
   years 0-5, 6-11, 12-17, 18-24, ten-year groups to 64, 65-74, 75+), while
   holding the slice's own 2024 SNAP units and dollars, Medicaid enrollment,
   filer AGI, filers by AGI bracket, EITC claims by qualifying children and
   CTC and refundable-CTC claims at their current values.
2. Write the reweighted 2024 household weights into a copy of the slice and
   simulate it. Child counts and child SPM poverty at 2024 and 2026 come from
   the slice's own run and from that run; policyengine-us uprates both
   datasets' weights to 2026 itself. ``rescore_check`` records how far the
   production run's poverty flags, re-scored with the new weights, would have
   differed from the new run.
3. For ``REFORM_STATES`` (Indiana), simulate the dashboard's universal $2,000
   credit for each child under 4 in 2026 on both datasets and record its cost
   (benefit change less federal and state income tax change).

This is a projection, not the rebuilt release: the release re-solves every
target jointly (IRS SOI by district, counties, and so on).

The pin is baked into the image at deploy time, as in
``state_audit_sweep_modal.py``::

    AUDIT_PE_US=1.825.2 AUDIT_SPM_CALC=0.3.1 \\
        AUDIT_PE_US_SPEC="policyengine-us @ git+https://github.com/PolicyEngine/policyengine-us@9f77bffb6b" \\
        modal deploy analysis/state_audit/census_age_reweight_modal.py
    python analysis/state_audit/census_age_reweight_modal.py spawn 1.825.2 592ae5d6 buildp_18252
    python analysis/state_audit/census_age_reweight_modal.py collect buildp_18252

``collect`` exits 3 while calls are still running and writes
``output/census_age_reweight_{label}.json`` when all are done.
"""

from __future__ import annotations

import csv
import json
import os
import sys

import modal

PE_US_PIN = os.environ.get("AUDIT_PE_US", "1.825.2")
SPM_CALC = os.environ.get("AUDIT_SPM_CALC", "")
PE_US_SPEC = os.environ.get("AUDIT_PE_US_SPEC", f"policyengine-us=={PE_US_PIN}")
APP_NAME = f"cpid-census-age-reweight-{PE_US_PIN.replace('.', '-')}"

app = modal.App(APP_NAME)
_pkgs = [PE_US_SPEC, "numpy>=1.24.0", "pandas>=2.0.0", "tables"]
if SPM_CALC:
    _pkgs.append(f"spm-calculator=={SPM_CALC}")
_base = modal.Image.debian_slim(python_version="3.11")
if "git+" in PE_US_SPEC:
    _base = _base.apt_install("git")
image = _base.pip_install(*_pkgs)
slices_volume = modal.Volume.from_name("cpid-populace-slices")

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "output")
CALLS = os.path.join(HERE, ".sweep_calls")
CENSUS = os.path.join(HERE, "targets", "census_pep_v2025_state_single_age.csv")

#: Microcosm's age family groups (lower bound inclusive, upper exclusive) and
#: their columns in the Census targets file.
AGE_GROUPS = [(f"age_{a}", a, a + 1) for a in range(6)] + [
    ("ages_6_11", 6, 12),
    ("ages_12_17", 12, 18),
    ("ages_18_24", 18, 25),
    ("ages_25_34", 25, 35),
    ("ages_35_44", 35, 45),
    ("ages_45_54", 45, 55),
    ("ages_55_64", 55, 65),
    ("ages_65_74", 65, 75),
    ("ages_75_plus", 75, 10_000),
]
AGI_BRACKETS = [
    ("agi_lt_25k", -1e18, 25_000),
    ("agi_25_50k", 25_000, 50_000),
    ("agi_50_75k", 50_000, 75_000),
    ("agi_75_100k", 75_000, 100_000),
    ("agi_100_200k", 100_000, 200_000),
    ("agi_200k_plus", 200_000, 1e18),
]
BASE_YEAR = 2024
YEARS = (2024, 2026)
#: States that also score the dashboard's universal $2,000 credit for each
#: child under 4 (the Indiana r=82 scenario), on both datasets, at 2026.
REFORM_STATES = ("IN",)
REFORM_YEAR = 2026
BASIC_INCOME = "gov.contrib.ubi_center.basic_income.amount.person.by_age"


def _universal_under4(year: int, amount: int = 2000) -> dict:
    """The dashboard's child allowance writes for $2,000 to each child under 4."""

    flat = {
        f"{BASIC_INCOME}[1].threshold": 1,
        f"{BASIC_INCOME}[2].threshold": 4,
        f"{BASIC_INCOME}[3].threshold": 6,
        f"{BASIC_INCOME}[4].threshold": 18,
        f"{BASIC_INCOME}[0].amount": amount,
        f"{BASIC_INCOME}[1].amount": amount,
        f"{BASIC_INCOME}[2].amount": 0,
        f"{BASIC_INCOME}[3].amount": 0,
    }
    return {key: {f"{year}-01-01": value} for key, value in flat.items()}


STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
    "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
    "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
    "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
    "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]
# ACS group quarters (outside Census's ACS SPM universe), as in
# state_audit_sweep_modal.py.
ACS_CHANNEL = "acs_2024_1yr"
ACS_GROUP_QUARTERS = {2: 37, 3: 38}


def _outside_person_ids(path: str):
    import pandas as pd

    with pd.HDFStore(path, "r") as store:
        person = store["person"]
        household = store["household"]
    need = {"person_id", "person_household_id", "person_spm_unit_id",
            "person_support_channel", "RELSHIPP"}
    if not need <= set(person.columns) or "TYPEHUGQ" not in household.columns:
        return None
    channel = person["person_support_channel"].map(
        lambda v: v.decode() if isinstance(v, bytes) else str(v)
    )
    rel = pd.to_numeric(person["RELSHIPP"], errors="coerce")
    rtype = pd.to_numeric(
        person["person_household_id"].map(household.set_index("household_id")["TYPEHUGQ"]),
        errors="coerce",
    )
    gq = pd.Series(False, index=person.index)
    for t, r in ACS_GROUP_QUARTERS.items():
        gq |= channel.eq(ACS_CHANNEL) & rtype.eq(t) & rel.eq(r)
    outside_units = set(person.loc[gq, "person_spm_unit_id"])
    return set(person.loc[person["person_spm_unit_id"].isin(outside_units), "person_id"])


def _balance(X, targets, w0, max_iter=200):
    """Entropy balance: w = w0 * exp(Xs @ lam), Xs = X / targets, by damped
    Newton on the dual (minimum KL divergence from w0 subject to X.T @ w = targets)."""
    import numpy as np

    Xs = X / targets
    lam = np.zeros(Xs.shape[1])

    def weights(lam_):
        return w0 * np.exp(np.clip(Xs @ lam_, -50, 50))

    it = 0
    for it in range(1, max_iter + 1):
        w = weights(lam)
        g = Xs.T @ w - 1.0
        if np.abs(g).max() < 1e-11:
            break
        H = (Xs * w[:, None]).T @ Xs
        step = np.linalg.lstsq(H + 1e-14 * np.eye(len(g)), g, rcond=None)[0]
        f0 = w.sum() - lam.sum()
        s = 1.0
        while True:
            cand = lam - s * step
            wc = weights(cand)
            if wc.sum() - cand.sum() <= f0 - 1e-4 * s * (g @ step) or s < 1e-10:
                break
            s *= 0.5
        lam = cand
    w = weights(lam)
    rel = X.T @ w / targets - 1
    return w, it, float(np.abs(rel).max())


@app.function(image=image, memory=32768, cpu=4.0, timeout=5400, retries=1,
              volumes={"/slices": slices_volume})
def reweight_state(state: str, slice_tag: str, census: dict) -> dict:
    import importlib.metadata as md
    import tempfile
    import time

    import numpy as np
    import pandas as pd
    from policyengine_core.reforms import Reform
    from policyengine_us import Microsimulation
    from policyengine_us.data import USSingleYearDataset

    t0 = time.perf_counter()
    path = f"/slices/{slice_tag}/{state}.h5"
    out: dict = {
        "state": state,
        "slice_tag": slice_tag,
        "versions": {p: md.version(p) for p in ("policyengine-us", "policyengine-core", "numpy", "pandas")},
    }

    def arr(sim, name, period, **kw):
        return np.asarray(sim.calculate(name, period=period, **kw))

    try:
        base = Microsimulation(dataset=USSingleYearDataset(file_path=path))
        by = BASE_YEAR
        hh_ids = arr(base, "household_id", by)
        p_hh = arr(base, "person_household_id", by)
        p_spm = arr(base, "person_spm_unit_id", by)
        p_tu = arr(base, "person_tax_unit_id", by)
        spm_ids = arr(base, "spm_unit_id", by)
        tu_ids = arr(base, "tax_unit_id", by)
        hh_index = pd.Index(hh_ids)
        p_hix = hh_index.get_indexer(p_hh)
        spm_hix = hh_index.get_indexer(
            pd.Series(p_hh, index=p_spm).groupby(level=0).first().reindex(spm_ids).to_numpy()
        )
        tu_hix = hh_index.get_indexer(
            pd.Series(p_hh, index=p_tu).groupby(level=0).first().reindex(tu_ids).to_numpy()
        )
        if (p_hix < 0).any() or (spm_hix < 0).any() or (tu_hix < 0).any():
            raise ValueError("an entity does not map to a household")
        n_hh = len(hh_ids)

        def hh_sum(values, index):
            total = np.zeros(n_hh)
            np.add.at(total, index, np.asarray(values, dtype=float))
            return total

        w24 = arr(base, "household_weight", by)
        age24 = arr(base, "age", by)
        cols, targets, names, kinds = [], [], [], []
        for name, lo, hi in AGE_GROUPS:
            cols.append(hh_sum((age24 >= lo) & (age24 < hi), p_hix))
            targets.append(float(census[name]))
            names.append(name)
            kinds.append("census_age")
        snap = arr(base, "snap", by)
        filer = arr(base, "tax_unit_is_filer", by).astype(bool)
        agi = arr(base, "adjusted_gross_income", by)
        eitc = arr(base, "eitc", by)
        eitc_kids = arr(base, "eitc_child_count", by)
        held = [
            ("snap_units", hh_sum(snap > 0, spm_hix)),
            ("snap_dollars", hh_sum(snap, spm_hix)),
            ("medicaid_enrolled", hh_sum(arr(base, "medicaid_enrolled", by), p_hix)),
            ("agi_filers", hh_sum(agi * filer, tu_hix)),
            ("eitc_claims_0", hh_sum((eitc > 0) & (eitc_kids == 0), tu_hix)),
            ("eitc_claims_1", hh_sum((eitc > 0) & (eitc_kids == 1), tu_hix)),
            ("eitc_claims_2", hh_sum((eitc > 0) & (eitc_kids == 2), tu_hix)),
            ("eitc_claims_3p", hh_sum((eitc > 0) & (eitc_kids >= 3), tu_hix)),
            ("ctc_claims", hh_sum(arr(base, "ctc_value", by) > 0, tu_hix)),
            ("actc_claims", hh_sum(arr(base, "refundable_ctc", by) > 0, tu_hix)),
        ] + [
            (name, hh_sum(filer & (agi >= lo) & (agi < hi), tu_hix))
            for name, lo, hi in AGI_BRACKETS
        ]
        dropped = []
        for name, col in held:
            current = float(col @ w24)
            if not current > 0:
                dropped.append(name)
                continue
            cols.append(col)
            targets.append(current)
            names.append(name)
            kinds.append("held_at_current")
        X = np.column_stack(cols)
        t = np.asarray(targets)
        before = X.T @ w24
        w_new, iters, max_rel = _balance(X, t, w24)
        positive = w24 > 0
        ratio = w_new[positive] / w24[positive]
        out["balance"] = {
            "iterations": iters,
            "max_abs_rel_error": max_rel,
            "converged": max_rel < 1e-6,
            "dropped_held_at_zero": dropped,
            "constraints": [
                {"name": n, "kind": k, "before": float(b), "target": float(tt)}
                for n, k, b, tt in zip(names, kinds, before, t)
            ],
            "weight_ratio_percentiles": dict(zip(
                ["p0", "p1", "p5", "p50", "p95", "p99", "p100"],
                np.percentile(ratio, [0, 1, 5, 50, 95, 99, 100]).round(4).tolist(),
            )),
            "kish_ess_before": float(w24.sum() ** 2 / (w24 ** 2).sum()),
            "kish_ess_after": float(w_new.sum() ** 2 / (w_new ** 2).sum()),
            "n_households": int(n_hh),
        }

        outside = _outside_person_ids(path)
        out["gq_mask_available"] = outside is not None

        def score(sim, year):
            """Child counts and SPM poverty from one simulation at one year."""
            hw = arr(sim, "household_weight", year)
            hid = arr(sim, "household_id", year)
            pix = pd.Index(hid).get_indexer(arr(sim, "person_household_id", year))
            pw = arr(sim, "person_weight", year)
            if not np.allclose(pw, hw[pix]):
                raise ValueError(f"person_weight is not the household weight at {year}")
            age = arr(sim, "age", year)
            pov = arr(sim, "in_poverty", year, map_to="person").astype(bool)
            pid = arr(sim, "person_id", year)
            measured = np.ones_like(pov) if outside is None else ~np.isin(pid, list(outside))
            child = age < 18

            def rate(mask):
                return float(pw[mask & pov].sum() / pw[mask].sum() * 100)

            return {
                "population": float(pw.sum()),
                "children_under_18": float(pw[child].sum()),
                "children_under_6": float(pw[age < 6].sum()),
                "children_under_5": float(pw[age < 5].sum()),
                "children_under_4": float(pw[age < 4].sum()),
                "children_under_1": float(pw[age < 1].sum()),
                "adults": float(pw[~child].sum()),
                "child_poverty": rate(child),
                "child_poverty_measured": rate(child & measured),
                "young_child_poverty": rate(age < 6),
                "all_poverty": rate(np.ones_like(child)),
                "children_in_poverty": float(pw[child & pov].sum()),
            }, pov

        # Write the reweighted 2024 household weights into a copy of the slice
        # and simulate it: every reweighted figure comes from that run.
        entities = ("household", "person", "tax_unit", "spm_unit", "family", "marital_unit")
        with pd.HDFStore(path, "r") as store:
            tables = {k.strip("/"): store[k] for k in store.keys() if k.strip("/") in entities}
        hh = tables["household"].copy()
        order = pd.Index(hh["household_id"]).get_indexer(hh_ids)
        if (order < 0).any() or len(set(order)) != len(order):
            raise ValueError("household ids differ between the store and the simulation")
        new_col = np.asarray(hh["household_weight"], dtype=float).copy()
        new_col[order] = w_new
        hh["household_weight"] = new_col
        tables["household"] = hh
        with tempfile.TemporaryDirectory() as tmp:
            rpath = os.path.join(tmp, f"{state}_census_age.h5")
            USSingleYearDataset(time_period=BASE_YEAR, **tables).save(rpath)
            resim = Microsimulation(dataset=USSingleYearDataset(file_path=rpath))
            metrics, checks = {}, {}
            for y in YEARS:
                prod, pov_p = score(base, y)
                rew, pov_r = score(resim, y)
                metrics[str(y)] = {"production": prod, "reweighted": rew}
                # Cross-check: the production run's flags re-scored with the
                # reweighted run's person weights.
                if not np.array_equal(arr(base, "person_id", y), arr(resim, "person_id", y)):
                    raise ValueError(f"the two runs order persons differently at {y}")
                pw_r = arr(resim, "person_weight", y)
                child = arr(base, "age", y) < 18
                checks[str(y)] = {
                    "flags_differ_persons": int((pov_r != pov_p).sum()),
                    "flags_differ_weight": float(pw_r[pov_r != pov_p].sum()),
                    "child_poverty_rescored": float(pw_r[child & pov_p].sum() / pw_r[child].sum() * 100),
                }
            out["years"] = metrics
            out["rescore_check"] = checks
            if state in REFORM_STATES:
                year = REFORM_YEAR
                reform = Reform.from_dict(_universal_under4(year), country_id="us")
                costs = {}
                for label, dataset_path in (("production", path), ("reweighted", rpath)):
                    b = Microsimulation(dataset=USSingleYearDataset(file_path=dataset_path))
                    r = Microsimulation(dataset=USSingleYearDataset(file_path=dataset_path), reform=reform)
                    hw = arr(b, "household_weight", year)

                    def total(sim, name):
                        return float(arr(sim, name, year, map_to="household") @ hw)

                    d_ben = total(r, "household_benefits") - total(b, "household_benefits")
                    d_fed = total(r, "income_tax") - total(b, "income_tax")
                    d_st = total(r, "state_income_tax") - total(b, "state_income_tax")
                    costs[label] = {
                        "cost": d_ben - d_fed - d_st,
                        "benefit_change": d_ben,
                        "federal_tax_change": d_fed,
                        "state_tax_change": d_st,
                        "basic_income_total": total(r, "basic_income"),
                    }
                out["universal_under4_2000"] = {"year": year, **costs}
        out["status"] = "ok"
    except Exception as exc:  # recorded so one state cannot sink the map
        out["status"] = "error"
        out["error"] = f"{type(exc).__name__}: {str(exc)[:600]}"
    out["runtime_s"] = round(time.perf_counter() - t0, 1)
    return out


def _census_groups(year: int = BASE_YEAR) -> dict[str, dict[str, float]]:
    with open(CENSUS, newline="", encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if int(r["year"]) == year]
    return {r["state"]: {name: float(r[name]) for name, _, _ in AGE_GROUPS} for r in rows}


def spawn(pin: str, slice_tag: str, label: str, states: str = "") -> None:
    census = _census_groups()
    f = modal.Function.from_name(f"cpid-census-age-reweight-{pin.replace('.', '-')}", "reweight_state")
    chosen = [s.strip().upper() for s in states.split(",") if s.strip()] or STATES
    calls = {st: f.spawn(st, slice_tag, census[st]).object_id for st in chosen}
    os.makedirs(CALLS, exist_ok=True)
    with open(os.path.join(CALLS, f"census_age_reweight_{label}.json"), "w", encoding="utf-8") as fh:
        json.dump(calls, fh, indent=1)
    print(f"spawned {len(calls)} calls for {label} ({slice_tag} @ pe-us {pin})")


def collect(label: str) -> None:
    with open(os.path.join(CALLS, f"census_age_reweight_{label}.json"), encoding="utf-8") as fh:
        calls = json.load(fh)
    done, pending, failed = {}, [], {}
    for st, cid in calls.items():
        try:
            done[st] = modal.FunctionCall.from_id(cid).get(timeout=0)
        except TimeoutError:
            pending.append(st)
        except Exception as exc:
            failed[st] = f"{type(exc).__name__}: {str(exc)[:200]}"
    if pending:
        print(f"RUNNING {label}: done={len(done)} pending={len(pending)} failed={len(failed)}")
        sys.exit(3)
    rows = [done[st] for st in STATES if st in done] + [
        {"state": st, "status": "error", "error": f"call failed: {msg}"} for st, msg in failed.items()
    ]
    path = os.path.join(OUT, f"census_age_reweight_{label}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(rows, fh, indent=1)
    errors = [r["state"] for r in rows if r.get("status") != "ok"]
    unconverged = [r["state"] for r in rows if r.get("status") == "ok" and not r["balance"]["converged"]]
    print(f"DONE {label}: wrote {path}; errors={errors} unconverged={unconverged}")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "spawn":
        spawn(*sys.argv[2:6])
    elif command == "collect":
        collect(sys.argv[2])
    else:
        sys.exit("usage: census_age_reweight_modal.py spawn <pin> <slice_tag> <label> | collect <label>")
