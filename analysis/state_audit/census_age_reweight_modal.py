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

This is a projection, not the rebuilt release: the release fits all 5,632
targets of its default surface (4,227 state SOI targets, state SNAP and
Medicaid targets, state and district populations and the age groups) rather
than the slices' current values.

``concentration_state`` repeats the same balance from the same start, so it
reaches the same weights, and measures how concentrated each weight set is:
Kish effective sample, the top 1% of households' share of the weight, and the
share held by households from the ASEC-by-PUF spine. It then simulates the
$2,000 under-4 allowance on both datasets in every state and records how many
sample households carry the children it lifts out of SPM poverty.

The pin is baked into the image at deploy time, as in
``state_audit_sweep_modal.py``::

    AUDIT_PE_US=1.825.2 AUDIT_SPM_CALC=0.3.1 \\
        AUDIT_PE_US_SPEC="policyengine-us @ git+https://github.com/PolicyEngine/policyengine-us@9f77bffb6b" \\
        modal deploy analysis/state_audit/census_age_reweight_modal.py
    python analysis/state_audit/census_age_reweight_modal.py spawn 1.825.2 592ae5d6 buildp_18252
    python analysis/state_audit/census_age_reweight_modal.py collect buildp_18252

    python analysis/state_audit/census_age_reweight_modal.py spawn-concentration 1.825.2 592ae5d6 buildp_18252
    python analysis/state_audit/census_age_reweight_modal.py collect-concentration buildp_18252

``collect`` exits 3 while calls are still running and writes
``output/census_age_reweight_{label}.json`` when all are done;
``collect-concentration`` writes ``output/weight_concentration_{label}.json``.
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
#: The slices tag each household with its source spine: the 2024 ACS 1-year
#: file or the CPS ASEC records the release pools with the PUF.
ASEC_SPINE = "asec_puf"


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


def _arr(sim, name, period, **kw):
    import numpy as np

    return np.asarray(sim.calculate(name, period=period, **kw))


def _kish(x) -> float:
    """Kish effective sample size of nonnegative weights: (sum w)^2 / sum w^2."""
    import numpy as np

    x = np.asarray(x, dtype=float)
    x = x[x > 0]
    if not x.size:
        return 0.0
    x = x / x.max()  # scale first, so tiny weights cannot underflow when squared
    return float(x.sum() ** 2 / (x ** 2).sum())


def _weight_stats(w, spine, kids) -> dict:
    """How concentrated one vector of household weights is, overall and by spine.

    The top 1% takes the max(1, n // 100) heaviest households. Child weight is
    each household's weight times its children under 18. ``spine`` (or None)
    tags each household's source spine.
    """
    import numpy as np

    w = np.asarray(w, dtype=float)
    child_w = w * np.asarray(kids, dtype=float)
    n = len(w)
    heaviest = np.sort(w)[::-1]
    out = {
        "n_households": int(n),
        "kish_ess": _kish(w),
        "top1pct_share": float(heaviest[: max(1, n // 100)].sum() / heaviest.sum()),
        "max_weight": float(heaviest[0]),
        "median_weight": float(np.median(w)),
        "p99_weight": float(np.percentile(w, 99)),
        "child_kish_ess": _kish(child_w),
    }
    if spine is not None:
        asec = np.asarray(spine) == ASEC_SPINE
        out.update({
            "asec_households": int(asec.sum()),
            "asec_weight_share": float(w[asec].sum() / w.sum()),
            "asec_child_weight_share": (
                float(child_w[asec].sum() / child_w.sum()) if child_w.sum() > 0 else None
            ),
            "asec_kish_ess": _kish(w[asec]),
            "other_kish_ess": _kish(w[~asec]),
        })
    return out


def _lift_stats(contrib, spine) -> dict:
    """How a reform's children lifted out of poverty spread across households.

    ``contrib`` holds each household's weight times its children under 18
    lifted out of SPM poverty, less its children the reform pushes into it.
    """
    import numpy as np

    c = np.asarray(contrib, dtype=float)
    total = float(c.sum())
    lifting = np.sort(c[c > 0])[::-1]
    out = {
        "children_lifted_net": total,
        "households_with_net_lift": int((c > 0).sum()),
        "households_with_net_entry": int((c < 0).sum()),
        "lifters_kish_ess": _kish(lifting),
        "top1_share": None,
        "top5_share": None,
        "asec_share": None,
        "top_household_spine": None,
    }
    if lifting.size and total > 0:
        out["top1_share"] = float(lifting[0] / total)
        out["top5_share"] = float(lifting[:5].sum() / total)
        if spine is not None:
            spine = np.asarray(spine)
            out["asec_share"] = float(c[spine == ASEC_SPINE].sum() / total)
            out["top_household_spine"] = str(spine[int(np.argmax(c))])
    return out


def _setup(base, census: dict, by: int = BASE_YEAR) -> dict:
    """Household maps, 2024 weights and the balance's constraints for one slice.

    The constraint columns hold each household's count in each Census age
    group, then the slice's 16 held aggregates; a held aggregate the slice
    puts at zero is dropped.
    """
    import numpy as np
    import pandas as pd

    hh_ids = _arr(base, "household_id", by)
    p_hh = _arr(base, "person_household_id", by)
    p_spm = _arr(base, "person_spm_unit_id", by)
    p_tu = _arr(base, "person_tax_unit_id", by)
    spm_ids = _arr(base, "spm_unit_id", by)
    tu_ids = _arr(base, "tax_unit_id", by)
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

    w24 = _arr(base, "household_weight", by)
    age24 = _arr(base, "age", by)
    cols, targets, names, kinds = [], [], [], []
    for name, lo, hi in AGE_GROUPS:
        cols.append(hh_sum((age24 >= lo) & (age24 < hi), p_hix))
        targets.append(float(census[name]))
        names.append(name)
        kinds.append("census_age")
    snap = _arr(base, "snap", by)
    filer = _arr(base, "tax_unit_is_filer", by).astype(bool)
    agi = _arr(base, "adjusted_gross_income", by)
    eitc = _arr(base, "eitc", by)
    eitc_kids = _arr(base, "eitc_child_count", by)
    held = [
        ("snap_units", hh_sum(snap > 0, spm_hix)),
        ("snap_dollars", hh_sum(snap, spm_hix)),
        ("medicaid_enrolled", hh_sum(_arr(base, "medicaid_enrolled", by), p_hix)),
        ("agi_filers", hh_sum(agi * filer, tu_hix)),
        ("eitc_claims_0", hh_sum((eitc > 0) & (eitc_kids == 0), tu_hix)),
        ("eitc_claims_1", hh_sum((eitc > 0) & (eitc_kids == 1), tu_hix)),
        ("eitc_claims_2", hh_sum((eitc > 0) & (eitc_kids == 2), tu_hix)),
        ("eitc_claims_3p", hh_sum((eitc > 0) & (eitc_kids >= 3), tu_hix)),
        ("ctc_claims", hh_sum(_arr(base, "ctc_value", by) > 0, tu_hix)),
        ("actc_claims", hh_sum(_arr(base, "refundable_ctc", by) > 0, tu_hix)),
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
    return {
        "hh_ids": hh_ids,
        "p_hix": p_hix,
        "n_hh": n_hh,
        "hh_sum": hh_sum,
        "w24": w24,
        "age24": age24,
        "X": np.column_stack(cols),
        "t": np.asarray(targets),
        "names": names,
        "kinds": kinds,
        "dropped": dropped,
    }


def _write_reweighted(path: str, hh_ids, w_new, rpath: str) -> None:
    """Save a copy of the slice whose 2024 household weights are ``w_new``."""
    import numpy as np
    import pandas as pd
    from policyengine_us.data import USSingleYearDataset

    entities = ("household", "person", "tax_unit", "spm_unit", "family", "marital_unit")
    with pd.HDFStore(path, "r") as store:
        tables = {k.strip("/"): store[k] for k in store if k.strip("/") in entities}
    hh = tables["household"].copy()
    order = pd.Index(hh["household_id"]).get_indexer(hh_ids)
    if (order < 0).any() or len(set(order)) != len(order):
        raise ValueError("household ids differ between the store and the simulation")
    new_col = np.asarray(hh["household_weight"], dtype=float).copy()
    new_col[order] = w_new
    hh["household_weight"] = new_col
    tables["household"] = hh
    USSingleYearDataset(time_period=BASE_YEAR, **tables).save(rpath)


def _household_spine(path: str, hh_ids):
    """Each simulated household's source spine from the store, or None."""
    import pandas as pd

    with pd.HDFStore(path, "r") as store:
        household = store["household"]
    if "household_spine" not in household.columns:
        return None
    order = pd.Index(household["household_id"]).get_indexer(hh_ids)
    if (order < 0).any():
        raise ValueError("a simulated household is missing from the store")
    spine = household["household_spine"].map(
        lambda v: v.decode() if isinstance(v, bytes) else str(v)
    )
    return spine.to_numpy()[order].astype(str)


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
    arr = _arr

    try:
        base = Microsimulation(dataset=USSingleYearDataset(file_path=path))
        s = _setup(base, census)
        hh_ids, w24 = s["hh_ids"], s["w24"]
        X, t, names, kinds = s["X"], s["t"], s["names"], s["kinds"]
        before = X.T @ w24
        w_new, iters, max_rel = _balance(X, t, w24)
        positive = w24 > 0
        ratio = w_new[positive] / w24[positive]
        out["balance"] = {
            "iterations": iters,
            "max_abs_rel_error": max_rel,
            "converged": max_rel < 1e-6,
            "dropped_held_at_zero": s["dropped"],
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
            "n_households": int(s["n_hh"]),
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
        with tempfile.TemporaryDirectory() as tmp:
            rpath = os.path.join(tmp, f"{state}_census_age.h5")
            _write_reweighted(path, hh_ids, w_new, rpath)
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


@app.function(image=image, memory=32768, cpu=4.0, timeout=5400, retries=1,
              volumes={"/slices": slices_volume})
def concentration_state(state: str, slice_tag: str, census: dict) -> dict:
    """Weight concentration before and after the Census-age balance, and how
    many sample households carry the children the $2,000 under-4 allowance
    lifts out of SPM poverty in 2026, from each dataset's own simulation."""
    import gc
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
    try:
        base = Microsimulation(dataset=USSingleYearDataset(file_path=path))
        s = _setup(base, census)
        hh_ids, w24, hh_sum = s["hh_ids"], s["w24"], s["hh_sum"]
        w_new, iters, max_rel = _balance(s["X"], s["t"], w24)
        out["balance"] = {
            "iterations": iters,
            "max_abs_rel_error": max_rel,
            "converged": max_rel < 1e-6,
        }
        spine = _household_spine(path, hh_ids)
        out["spine_available"] = spine is not None
        kids = hh_sum(s["age24"] < 18, s["p_hix"])
        out["weights_2024"] = {
            "production": _weight_stats(w24, spine, kids),
            "reweighted": _weight_stats(w_new, spine, kids),
        }
        year = REFORM_YEAR
        reform = Reform.from_dict(_universal_under4(year), country_id="us")
        results = {}
        with tempfile.TemporaryDirectory() as tmp:
            rpath = os.path.join(tmp, f"{state}_census_age.h5")
            _write_reweighted(path, hh_ids, w_new, rpath)
            for label, dataset_path in (("production", path), ("reweighted", rpath)):
                b = (
                    base if label == "production"
                    else Microsimulation(dataset=USSingleYearDataset(file_path=dataset_path))
                )
                r = Microsimulation(dataset=USSingleYearDataset(file_path=dataset_path), reform=reform)
                hid = _arr(b, "household_id", year)
                if not np.array_equal(hid, hh_ids):
                    raise ValueError(f"{label}: households ordered differently at {year}")
                hw = _arr(b, "household_weight", year)
                pix = pd.Index(hid).get_indexer(_arr(b, "person_household_id", year))
                pw = _arr(b, "person_weight", year)
                if not np.allclose(pw, hw[pix]):
                    raise ValueError(f"{label}: person_weight is not the household weight at {year}")
                if not np.array_equal(_arr(b, "person_id", year), _arr(r, "person_id", year)):
                    raise ValueError(f"{label}: baseline and reform order persons differently")
                age = _arr(b, "age", year)
                pov_b = _arr(b, "in_poverty", year, map_to="person").astype(bool)
                pov_r = _arr(r, "in_poverty", year, map_to="person").astype(bool)
                child, young = age < 18, age < 4
                lifted = hh_sum(child & pov_b & ~pov_r, pix) - hh_sum(child & ~pov_b & pov_r, pix)
                young_poor = hw * hh_sum(young & pov_b, pix)

                def total(sim, name):
                    return float(_arr(sim, name, year, map_to="household") @ hw)

                d_ben = total(r, "household_benefits") - total(b, "household_benefits")
                d_fed = total(r, "income_tax") - total(b, "income_tax")
                d_st = total(r, "state_income_tax") - total(b, "state_income_tax")
                results[label] = {
                    "cost": d_ben - d_fed - d_st,
                    "children_under_4": float(pw[young].sum()),
                    "child_poverty_baseline": float(pw[child & pov_b].sum() / pw[child].sum() * 100),
                    "child_poverty_reform": float(pw[child & pov_r].sum() / pw[child].sum() * 100),
                    "young_poor_households": int((young_poor > 0).sum()),
                    "young_poor_kish_ess": _kish(young_poor),
                    **_lift_stats(hw * lifted, spine),
                }
                del r
                if label != "production":
                    del b
                gc.collect()
        out["universal_under4_2000"] = {"year": year, **results}
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


#: CLI kinds: the Modal function and the file prefix for its calls and output.
KINDS = {
    "reweight": ("reweight_state", "census_age_reweight"),
    "concentration": ("concentration_state", "weight_concentration"),
}


def spawn(pin: str, slice_tag: str, label: str, states: str = "", kind: str = "reweight") -> None:
    function, prefix = KINDS[kind]
    census = _census_groups()
    f = modal.Function.from_name(f"cpid-census-age-reweight-{pin.replace('.', '-')}", function)
    chosen = [s.strip().upper() for s in states.split(",") if s.strip()] or STATES
    calls = {st: f.spawn(st, slice_tag, census[st]).object_id for st in chosen}
    os.makedirs(CALLS, exist_ok=True)
    with open(os.path.join(CALLS, f"{prefix}_{label}.json"), "w", encoding="utf-8") as fh:
        json.dump(calls, fh, indent=1)
    print(f"spawned {len(calls)} {function} calls for {label} ({slice_tag} @ pe-us {pin})")


def collect(label: str, kind: str = "reweight") -> None:
    _, prefix = KINDS[kind]
    with open(os.path.join(CALLS, f"{prefix}_{label}.json"), encoding="utf-8") as fh:
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
    path = os.path.join(OUT, f"{prefix}_{label}.json")
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
    elif command == "spawn-concentration":
        spawn(*sys.argv[2:6], kind="concentration")
    elif command == "collect-concentration":
        collect(sys.argv[2], kind="concentration")
    else:
        sys.exit(
            "usage: census_age_reweight_modal.py spawn|spawn-concentration <pin> <slice_tag> <label> [states]"
            " | collect|collect-concentration <label>"
        )
