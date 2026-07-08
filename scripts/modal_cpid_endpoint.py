"""Modal-hosted compute backend for the Child Poverty Impact Dashboard.

Mirrors the spawn-and-poll pattern that ``refundable-credit-conversion``
uses: the browser POSTs a job to ``/economy/start`` (or
``/household/start``), gets back a ``job_id``, then GETs
``/economy/status/{job_id}`` until ``status`` flips from ``computing``
to ``ok`` / ``error``. Heavy ``Microsimulation`` calls run as spawned
Modal functions so each HTTP request itself stays under the per-request
wall-clock limit.

Two job types:

* ``/economy``  — full statewide microsimulation (poverty, fiscal,
  distributional). The browser sends the reform as a flat dict
  (``{param.path: value | {date: value}}``); the endpoint canonicalises
  via ``Reform.from_dict`` — no PolicyEngine /us/policy round-trip.

* ``/household`` — single-household sweep across employment income
  ($0–$400k). Returns both baseline and reform results at each step.

Deploy with::

    modal deploy scripts/modal_cpid_endpoint.py

The persistent URL Modal prints is what to put in
``NEXT_PUBLIC_MODAL_CPID_URL`` (frontend ``.env.local`` and the Vercel
project's environment variables).

Test locally with::

    modal serve scripts/modal_cpid_endpoint.py
"""

from __future__ import annotations

import modal

app = modal.App("cpid-backend")

# Pinned for reproducibility — bump deliberately when we want a refresh
# rather than letting Modal grab whatever's latest at build time.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "policyengine-us==1.765.0",
        "numpy>=1.24.0",
        "pandas>=2.0.0",
        "huggingface_hub",
        "fastapi",
        "pydantic>=2",
    )
    # Cache-bust marker — bump when we want Modal to rebuild the image
    # even though pip deps haven't changed.
    .env({"CPID_BUILD_REV": "2026-07-07-populace-slices+pe-us-1.765.0"})
)

# Populace: PolicyEngine's single national calibrated dataset (replaces the 51
# per-state ECPS files — PE is standardizing every project on it). A national
# simulation costs ~5.3 min regardless of the requested state, so each pinned
# revision is pre-sliced into 51 per-state files on the cpid-populace-slices
# Volume (scripts/build_populace_state_slices.py — run it once per revision
# bump). Slice sums are verified to match the national state-masked values,
# so results are exactly Populace's at a fraction of the runtime.
POPULACE_REPO = "policyengine/populace-us"
POPULACE_FILE = "populace_us_2024.h5"
POPULACE_REVISION = "053baf6cf56aaf1160e2f1bfe7631c6924d46b2e"  # 2026-07-01

slices_volume = modal.Volume.from_name(
    "cpid-populace-slices", create_if_missing=True
)


# Results cache: identical (payload, build) pairs return the stored result
# instead of re-simulating. The build rev pins policyengine-us, the Populace
# revision, and the compute code, so entries are immutable — a new deploy
# with a bumped CPID_BUILD_REV starts a fresh keyspace and old entries just
# age out unused. This is what makes shared deep links populate instantly
# once anyone has run the same report on the current build (and the seam a
# durable store like Supabase can later replace).
results_cache = modal.Dict.from_name("cpid-results-cache", create_if_missing=True)


def _cache_key(kind: str, payload: dict) -> str:
    import hashlib
    import json
    import os

    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    build = os.environ.get("CPID_BUILD_REV", "dev")
    digest = hashlib.sha256(f"{build}|{kind}|{canonical}".encode()).hexdigest()
    return f"{kind}:{build}:{digest[:32]}"


def _cache_get(key: str):
    try:
        return results_cache[key]
    except KeyError:
        return None
    except Exception:  # cache is best-effort, never a failure source
        return None


def _cache_put(key: str, value: dict) -> None:
    try:
        results_cache[key] = value
    except Exception:
        pass


def _progress_put(stage: str) -> None:
    """Best-effort stage marker for the polling UI, keyed by this call's id.

    The status endpoint surfaces it while the job is computing so the 1-2
    minute statewide wait shows real progress instead of a bare spinner.
    Never allowed to fail a compute."""
    try:
        call_id = modal.current_function_call_id()
        if call_id:
            results_cache[f"progress:{call_id}"] = stage
    except Exception:
        pass


def _state_slice_path(state: str) -> str:
    import os

    path = f"/slices/{POPULACE_REVISION[:8]}/{state}.h5"
    if not os.path.exists(path):
        raise RuntimeError(
            f"No Populace slice for {state} at revision "
            f"{POPULACE_REVISION[:8]} — run "
            "`modal run scripts/build_populace_state_slices.py` after a "
            "revision bump."
        )
    return path


def _build_core_reform_dict(reform: dict | None, year: int) -> dict | None:
    """Coerce the frontend's flat reform dict into the
    ``{param.path: {date: value}}`` shape PolicyEngine-core's
    ``Reform.from_dict`` expects.

    Frontend sends scalars (defaulting effective date to ``{year}-01-01``)
    or ``{date: value}`` maps. Either is accepted here; output is always
    in the date-keyed form.
    """
    if not reform:
        return None
    default_date = f"{year}-01-01"
    out: dict = {}
    for path, spec in reform.items():
        if isinstance(spec, dict):
            out[path] = dict(spec)
        else:
            out[path] = {default_date: spec}
    return out


_ALLOW_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3009",
    "https://child-poverty-impact-dashboard.vercel.app",
    "https://child-poverty-impact-dashboard-sigma.vercel.app",
]
_ALLOW_ORIGIN_REGEX = (
    # Vercel preview deployments, plus any localhost port for local dev
    # (next dev picks 3001+ when 3000 is taken, which otherwise fails CORS).
    r"(https://child-poverty-impact-dashboard-[a-z0-9-]+(?:-policy-engine)?\.vercel\.app"
    r"|http://localhost:\d+)"
)


# --- household sweep ----------------------------------------------------


def _build_household_situation(
    payload: dict,
    employment_income: float,
    sweep: tuple | None = None,
) -> dict:
    """Build the PolicyEngine situation dict.

    One tax unit with the head, optional spouse, and any children. When
    ``sweep`` is ``(min, max, count)`` the head's employment income is
    swept via a PolicyEngine ``axes`` block instead of a fixed value, so a
    single vectorised ``Simulation`` computes the whole net-income chart at
    once (far faster than one Simulation per income point).
    """
    year = int(payload["year"])
    state = str(payload["state"]).upper()
    married = bool(payload.get("married", False))
    head_age = int(payload.get("head_age", 35))
    spouse_age = payload.get("spouse_age")
    dependent_ages = list(payload.get("dependent_ages", []))

    people: dict = {
        "head": {
            "age": {year: head_age},
            # None when sweeping — the axes block supplies the values.
            "employment_income": {
                year: None if sweep else float(employment_income)
            },
        }
    }
    members = ["head"]
    if married:
        people["spouse"] = {
            "age": {year: int(spouse_age) if spouse_age else 35},
            "employment_income": {
                year: float(payload.get("spouse_employment_income", 0))
            },
        }
        members.append("spouse")
    for i, age in enumerate(dependent_ages):
        key = f"dep{i}"
        people[key] = {"age": {year: int(age)}}
        members.append(key)

    # Optional extra income sources on the head.
    for key in (
        "self_employment_income",
        "social_security",
        "unemployment_compensation",
        "taxable_pension_income",
        "long_term_capital_gains",
        "qualified_dividend_income",
        "taxable_interest_income",
    ):
        val = float(payload.get(key, 0) or 0)
        if val > 0:
            people["head"][key] = {year: val}

    situation: dict = {
        "people": people,
        "tax_units": {"tax_unit": {"members": members}},
        "households": {
            "household": {"members": members, "state_name": {year: state}}
        },
    }
    if sweep is not None:
        income_min, income_max, count = sweep
        situation["axes"] = [
            [
                {
                    "name": "employment_income",
                    "min": float(income_min),
                    "max": float(income_max),
                    "count": int(count),
                    "period": year,
                }
            ]
        ]
    return situation


def _own_state_credit_vars(sim, state_code: str, year: int, kind: str) -> list:
    """This state's own EITC/CTC variable names, from the year's list
    (``state_eitcs``/``state_ctcs``). The ``state_eitc``/``state_ctc``
    aggregates ``adds`` every state's credits, and some taxsim components
    fire universally — so for one household we sum only this state's own
    variables instead. (``basic_income`` / the child allowance is NOT in
    these lists, so it stays separate.)"""
    st = state_code.lower()
    try:
        node = getattr(
            sim.tax_benefit_system.parameters.gov.states.household, kind
        )
        names = list(node(f"{year}-01-01"))
    except Exception:
        return []
    return [
        v for v in names
        if v.startswith(f"{st}_") or v.startswith(f"taxsim_{st}_")
    ]


def _household_point(
    sim_baseline, sim_reform, year: int, state_code: str, sim_dep=None
) -> dict:
    """Compute the per-point payload the React client expects.

    ``sim_dep`` is an optional baseline-plus-(dependent-exemption-only)
    simulation. When supplied, each row carries ``dependent_exemption_change``
    = baseline state income tax − dependent-only state income tax, which
    isolates the dependent-exemption portion from the rest of the reform
    (federal tax, state CTC/EITC) exactly as the economy breakdown does.
    """

    def _val(sim, name: str) -> float:
        try:
            return float(sim.calculate(name, period=year)[0])
        except Exception:
            return 0.0

    eitc_vars = _own_state_credit_vars(sim_baseline, state_code, year, "state_eitcs")
    ctc_vars = _own_state_credit_vars(sim_baseline, state_code, year, "state_ctcs")

    def _sum(sim, names: list) -> float:
        return float(sum(_val(sim, n) for n in names))

    def _row(sim) -> dict:
        return {
            "net_income": _val(sim, "household_net_income"),
            "federal_income_tax": _val(sim, "income_tax"),
            "state_income_tax": _val(sim, "state_income_tax"),
            "federal_ctc": _val(sim, "ctc"),
            "federal_eitc": _val(sim, "eitc"),
            "state_ctc": _sum(sim, ctc_vars),
            "state_eitc": _sum(sim, eitc_vars),
            "child_allowance": _val(sim, "basic_income"),
            "snap_benefits": _val(sim, "snap"),
            "in_poverty": bool(_val(sim, "in_poverty") > 0),
        }

    base_row = _row(sim_baseline)
    reform_row = _row(sim_reform)
    # Isolated dependent-exemption portion (signed as a benefit: positive when
    # the exemption is raised, negative when shrunk/eliminated). 0 when no
    # dependent-exemption sub-reform is sent.
    dep_change = 0.0
    if sim_dep is not None:
        dep_change = _val(sim_baseline, "state_income_tax") - _val(
            sim_dep, "state_income_tax"
        )
    base_row["dependent_exemption_change"] = dep_change
    reform_row["dependent_exemption_change"] = dep_change
    return {"baseline": base_row, "reform": reform_row}


@app.function(image=image, timeout=600, memory=2048)
def compute_household_sweep(payload: dict) -> dict:
    """Run a household income sweep on Modal."""
    import time
    import numpy as np
    from policyengine_core.reforms import Reform
    from policyengine_us import Simulation

    t0 = time.perf_counter()

    def _log(stage: str) -> None:
        print(f"[{time.perf_counter() - t0:6.2f}s] {stage}", flush=True)
        _progress_put(stage)

    year = int(payload["year"])
    incomes = list(payload.get("income_range", []))
    if not incomes:
        incomes = [
            float(i) for i in np.arange(0, 400_001, 10_000).tolist()
        ]

    reform_payload = payload.get("reform")
    reform_dict = _build_core_reform_dict(reform_payload, year)
    reform = Reform.from_dict(reform_dict) if reform_dict else None
    _log(f"reform loaded (params={len(reform_dict) if reform_dict else 0})")

    # Optional dependent-exemption-only sub-reform, for isolating its portion
    # of the state income-tax change (mirrors the economy breakdown).
    dep_reform_payload = payload.get("dependent_exemption_reform")
    dep_reform_dict = _build_core_reform_dict(dep_reform_payload, year)
    dep_reform = Reform.from_dict(dep_reform_dict) if dep_reform_dict else None
    if dep_reform is not None:
        _log("dependent-exemption sub-reform loaded")

    state_code = str(payload["state"]).upper()

    if len(incomes) == 1:
        # Single household point — no sweep.
        situation = _build_household_situation(payload, incomes[0])
        sim_b = Simulation(situation=situation)
        sim_r = (
            Simulation(situation=situation, reform=reform)
            if reform is not None
            else sim_b
        )
        sim_dep = (
            Simulation(situation=situation, reform=dep_reform)
            if dep_reform is not None
            else None
        )
        point = _household_point(sim_b, sim_r, year, state_code, sim_dep=sim_dep)
        data_points = [{"income": float(incomes[0]), **point["reform"]}]
        baseline_data_points = [{"income": float(incomes[0]), **point["baseline"]}]
    else:
        # Vectorised sweep: ONE Simulation with an employment_income axis
        # computes every income point at once (≫ faster than per-point sims).
        situation = _build_household_situation(
            payload, 0.0, sweep=(incomes[0], incomes[-1], len(incomes))
        )
        sim_b = Simulation(situation=situation)
        sim_r = (
            Simulation(situation=situation, reform=reform)
            if reform is not None
            else sim_b
        )
        eitc_vars = _own_state_credit_vars(sim_b, state_code, year, "state_eitcs")
        ctc_vars = _own_state_credit_vars(sim_b, state_code, year, "state_ctcs")
        n = len(incomes)

        def _arr(sim, name: str):
            try:
                return np.asarray(sim.calculate(name, period=year), dtype=float)
            except Exception:
                return np.zeros(n)

        def _sum_arr(sim, names: list):
            total = np.zeros(n)
            for nm in names:
                total = total + _arr(sim, nm)
            return total

        def _rows(sim):
            net = _arr(sim, "household_net_income")
            fit = _arr(sim, "income_tax")
            sit = _arr(sim, "state_income_tax")
            fctc = _arr(sim, "ctc")
            feitc = _arr(sim, "eitc")
            sctc = _sum_arr(sim, ctc_vars)
            seitc = _sum_arr(sim, eitc_vars)
            ca = _arr(sim, "basic_income")
            snap = _arr(sim, "snap")
            pov = _arr(sim, "in_poverty")
            return [
                {
                    "income": float(incomes[i]),
                    "net_income": float(net[i]),
                    "federal_income_tax": float(fit[i]),
                    "state_income_tax": float(sit[i]),
                    "federal_ctc": float(fctc[i]),
                    "federal_eitc": float(feitc[i]),
                    "state_ctc": float(sctc[i]),
                    "state_eitc": float(seitc[i]),
                    "child_allowance": float(ca[i]),
                    "snap_benefits": float(snap[i]),
                    "in_poverty": bool(pov[i] > 0),
                }
                for i in range(n)
            ]

        sim_dep = (
            Simulation(situation=situation, reform=dep_reform)
            if dep_reform is not None
            else None
        )

        baseline_data_points = _rows(sim_b)
        data_points = _rows(sim_r)

        # Isolated dependent-exemption portion per income point: baseline state
        # income tax − dependent-only state income tax. 0 everywhere when no
        # dependent-exemption sub-reform is supplied.
        if sim_dep is not None:
            dep_delta = _arr(sim_b, "state_income_tax") - _arr(
                sim_dep, "state_income_tax"
            )
        else:
            dep_delta = np.zeros(n)
        for i in range(n):
            v = float(dep_delta[i])
            baseline_data_points[i]["dependent_exemption_change"] = v
            data_points[i]["dependent_exemption_change"] = v

    _log(f"sweep done ({len(incomes)} points)")

    result = {
        "state": payload.get("state"),
        "year": year,
        "data_points": data_points,
        "baseline_data_points": baseline_data_points,
    }
    _cache_put(_cache_key("household", payload), result)
    return result


# --- statewide economy --------------------------------------------------


@app.function(
    image=image, timeout=1800, memory=16384, cpu=2.0, volumes={"/slices": slices_volume}
)
def compute_economy(payload: dict) -> dict:
    """Compute statewide microsim impact (poverty, fiscal, distributional)."""
    import time
    import numpy as np
    from policyengine_core.reforms import Reform
    from policyengine_us import Microsimulation

    t0 = time.perf_counter()

    def _log(stage: str) -> None:
        print(f"[{time.perf_counter() - t0:6.2f}s] {stage}", flush=True)
        _progress_put(stage)

    year = int(payload["year"])
    state_code = payload.get("state")
    if not state_code:
        raise ValueError("`state` is required.")

    # Pre-built per-state slice of the pinned Populace revision (verified to
    # reproduce the national state-masked values exactly). The masks below are
    # trivially all-true on a slice; they stay as a guard so a mis-built slice
    # (wrong state's households) fails loudly instead of silently.
    from policyengine_us.data import USSingleYearDataset

    state = state_code.upper()
    dataset_path = _state_slice_path(state)

    def _dataset():
        return USSingleYearDataset(file_path=dataset_path)

    reform_payload = payload.get("reform")
    reform_dict = _build_core_reform_dict(reform_payload, year)
    reform = Reform.from_dict(reform_dict) if reform_dict else None
    _log(
        f"reform loaded (params={len(reform_dict) if reform_dict else 0}) "
        f"on slice {state}@{POPULACE_REVISION[:8]}"
    )

    sim_baseline = Microsimulation(dataset=_dataset())
    sim_reform = (
        Microsimulation(dataset=_dataset(), reform=reform)
        if reform is not None
        else sim_baseline
    )
    _log("microsims built")

    # Row order is identical across sims built from the same dataset, so
    # baseline masks slice reform arrays too.
    hh_mask = (
        np.array(sim_baseline.calculate("state_code", period=year)).astype(str)
        == state
    )
    person_mask = (
        np.array(
            sim_baseline.calculate("state_code", period=year, map_to="person")
        ).astype(str)
        == state
    )
    if not hh_mask.all():
        raise ValueError(
            f"Slice for {state!r} contains other states' households — "
            "rebuild the slices."
        )

    household_weight = np.array(
        sim_baseline.calculate("household_weight", period=year)
    )[hh_mask]

    def _hh_sum(sim, name: str) -> float:
        arr = np.array(sim.calculate(name, period=year, map_to="household"))[
            hh_mask
        ]
        return float((arr * household_weight).sum())

    # Per-program fiscal breakdown. The grant deliverable lists CTC,
    # EITC, SNAP, dependent exemption, UBI, and state credits explicitly.
    # PE-US gives us totals for each program; "cost" = baseline - reform
    # when the reform increases the benefit (sign flipped to positive),
    # so we report (reform - baseline) and let the frontend flip if it
    # prefers cost positive.
    #
    # Caveat: variables like `ctc` track the claimed amount which can be
    # unchanged by a refundability reform even though the cash outlay
    # changes (the refundable portion gets paid out vs offsetting tax).
    # `total_budgetary_impact` captures the true cost regardless;
    # per-program numbers may understate the impact for reforms that
    # convert credits between refundable and nonrefundable.
    def _delta(name: str) -> float:
        try:
            return _hh_sum(sim_reform, name) - _hh_sum(sim_baseline, name)
        except Exception:
            return 0.0

    def _reform_only_sum(name: str) -> float:
        """Total of a variable the reform CREATES.

        The create-state-credit contribs (e.g. gov.contrib.states.ms.
        child_poverty_impact_dashboard.eitc) define new {st}_eitc /
        {st}_refundable_ctc variables that the gov.states.household
        registries — and therefore the state_eitc / state_ctc aggregates —
        do not include, so _delta() misses them entirely. A variable absent
        from baseline law contributes its whole reform-side total as the
        change."""
        if (
            name in sim_baseline.tax_benefit_system.variables
            or name not in sim_reform.tax_benefit_system.variables
        ):
            return 0.0
        try:
            return _hh_sum(sim_reform, name)
        except Exception:
            return 0.0

    st_l = state.lower()
    federal_tax_change = _delta("income_tax")
    state_tax_change = _delta("state_income_tax")
    benefit_change = _delta("household_benefits")
    ctc_change = _delta("ctc")
    eitc_change = _delta("eitc")
    snap_change = _delta("snap")
    state_ctc_change = (
        _delta("state_ctc")
        + _reform_only_sum(f"{st_l}_ctc")
        + _reform_only_sum(f"{st_l}_refundable_ctc")
    )
    state_eitc_change = _delta("state_eitc") + _reform_only_sum(f"{st_l}_eitc")
    # ubi_center basic income — the child allowance / baby bonus reforms.
    ubi_change = _delta("basic_income")
    _log("fiscal done")

    # Dependent exemption/credit cost — isolated. A dependent exemption only
    # moves state income tax, and that delta overlaps with state CTC/EITC
    # changes in the combined reform, so attribute it via a separate
    # baseline-vs-(dependent-only) sub-simulation. Reported as a benefit-value
    # delta (baseline tax - reform tax) to match the sign of the credit rows:
    # negative when the exemption is shrunk/eliminated. Skipped (0) when no
    # dependent-exemption sub-reform is sent — only one extra microsim, and
    # only when the option is used.
    dependent_exemption_change = 0.0
    dep_payload = payload.get("dependent_exemption_reform")
    dep_dict = (
        _build_core_reform_dict(dep_payload, year) if dep_payload else None
    )
    # The isolation sub-simulation is deferred to the end of the request so
    # the third national sim is built only after the baseline/reform sims are
    # released (three concurrent national sims would strain even 32GB).
    baseline_state_tax_total = _hh_sum(sim_baseline, "state_income_tax")

    # ---- Poverty: overall, children, young children (0-3), deep child poverty.
    age_arr = np.array(sim_baseline.calculate("age", period=year))[person_mask]
    person_weight = np.array(
        sim_baseline.calculate("person_weight", period=year)
    )[person_mask]
    pov_bl_arr = np.array(
        sim_baseline.calculate("in_poverty", period=year, map_to="person")
    )[person_mask].astype(bool)
    pov_rf_arr = np.array(
        sim_reform.calculate("in_poverty", period=year, map_to="person")
    )[person_mask].astype(bool)
    try:
        deep_bl_arr = np.array(
            sim_baseline.calculate(
                "in_deep_poverty", period=year, map_to="person"
            )
        )[person_mask].astype(bool)
        deep_rf_arr = np.array(
            sim_reform.calculate(
                "in_deep_poverty", period=year, map_to="person"
            )
        )[person_mask].astype(bool)
    except Exception:
        deep_bl_arr = np.zeros_like(pov_bl_arr)
        deep_rf_arr = np.zeros_like(pov_rf_arr)

    all_mask = np.ones_like(age_arr, dtype=bool)
    child_mask = age_arr < 18
    young_child_mask = age_arr < 4  # ages 0-3 (prenatal-3 in the grant)

    def _rate(arr, mask):
        w = person_weight[mask]
        total = float(w.sum())
        if total == 0:
            return 0.0
        return float((arr[mask] * w).sum() / total * 100)

    def _lifted(mask):
        # Lifted = was in poverty baseline AND not in poverty reform.
        return float(
            ((pov_bl_arr & ~pov_rf_arr) * person_weight * mask).sum()
        )

    _log("poverty done")

    # ---- Distributional analysis: per-decile averages, winners/losers,
    # Gini, and aggregate shares. Deciles are over persons by their
    # household's equivalised net income (square-root scale), which is
    # the standard PolicyEngine convention.
    # Person-level gain = household net income change for the person's
    # household, expanded to person level via map_to="person".
    person_net_baseline = np.array(
        sim_baseline.calculate(
            "household_net_income", period=year, map_to="person"
        )
    )[person_mask]
    person_net_reform = np.array(
        sim_reform.calculate(
            "household_net_income", period=year, map_to="person"
        )
    )[person_mask]
    person_gain = person_net_reform - person_net_baseline
    # Per-person equivalised baseline (used to cut deciles and compute
    # relative gain). Equivalised = household net / sqrt(household size),
    # standard PolicyEngine convention.
    person_hh_size = np.array(
        sim_baseline.calculate("household_size", period=year, map_to="person")
    )[person_mask]
    person_equiv_baseline = person_net_baseline / np.sqrt(
        np.maximum(person_hh_size, 1)
    )

    def _weighted_deciles(values, weights):
        """Return 10 decile-edge indicators (1..10) for each row, by
        weighted percentile. Edge cases: zero or all-equal income → all
        in decile 1."""
        if weights.sum() == 0:
            return np.ones_like(values, dtype=int)
        order = np.argsort(values, kind="stable")
        sorted_w = weights[order]
        cum_w = np.cumsum(sorted_w)
        total = cum_w[-1]
        # Decile boundaries at 10%, 20%, …, 90% of total weight.
        cuts = np.searchsorted(cum_w, total * np.arange(1, 10) / 10)
        decile_sorted = np.searchsorted(cuts, np.arange(len(values))) + 1
        decile = np.empty_like(decile_sorted)
        decile[order] = decile_sorted
        return np.clip(decile, 1, 10)

    decile_arr = _weighted_deciles(person_equiv_baseline, person_weight)

    total_weight = float(person_weight.sum())
    total_benefit = float((person_gain * person_weight).sum())

    avg_gain_all = (
        total_benefit / total_weight if total_weight > 0 else 0.0
    )
    bottom_50_mask = decile_arr <= 5
    top_10_mask = decile_arr == 10
    bottom_20_mask = decile_arr <= 2
    top_20_mask = decile_arr >= 9

    def _avg(mask):
        w = person_weight[mask]
        s = float(w.sum())
        if s == 0:
            return 0.0
        return float((person_gain[mask] * w).sum() / s)

    def _share(mask):
        if total_benefit == 0:
            return 0.0
        return float(
            (person_gain[mask] * person_weight[mask]).sum() / total_benefit
            * 100
        )

    # Per-person relative gain vs. baseline income. Use equivalised
    # baseline so the 5%-cutoff buckets aren't dominated by large
    # households.
    rel_gain = np.where(
        person_net_baseline > 0,
        person_gain / np.maximum(person_net_baseline, 1),
        0.0,
    )

    GAIN_THRESHOLD = 0.05
    LOSS_THRESHOLD = -0.05

    decile_impacts = []
    for d in range(1, 11):
        mask = decile_arr == d
        w = person_weight[mask]
        sw = float(w.sum())
        if sw == 0:
            decile_impacts.append(
                {
                    "decile": d,
                    "average_gain": 0.0,
                    "relative_gain": 0.0,
                    "percent_gaining": 0.0,
                    "percent_losing": 0.0,
                    "percent_unchanged": 100.0,
                    "gain_more_than_5_pct": 0.0,
                    "gain_less_than_5_pct": 0.0,
                    "no_change_pct": 100.0,
                    "lose_less_than_5_pct": 0.0,
                    "lose_more_than_5_pct": 0.0,
                    "total_benefit": 0.0,
                    "share_of_total_benefit": 0.0,
                }
            )
            continue
        g = person_gain[mask]
        r = rel_gain[mask]
        gain_total = float((g * w).sum())
        # Decile relative gain = decile total gain / decile baseline net
        # income, for the "relative" (% change) distributional view.
        decile_baseline_total = float((person_net_baseline[mask] * w).sum())
        decile_relative_gain = (
            gain_total / decile_baseline_total
            if decile_baseline_total > 0
            else 0.0
        )
        pct_gain_more = float((w * (r > GAIN_THRESHOLD)).sum() / sw * 100)
        pct_gain_less = float(
            (w * ((r > 0) & (r <= GAIN_THRESHOLD))).sum() / sw * 100
        )
        pct_lose_less = float(
            (w * ((r < 0) & (r >= LOSS_THRESHOLD))).sum() / sw * 100
        )
        pct_lose_more = float((w * (r < LOSS_THRESHOLD)).sum() / sw * 100)
        pct_no_change = max(
            0.0,
            100.0 - pct_gain_more - pct_gain_less - pct_lose_less - pct_lose_more,
        )
        decile_impacts.append(
            {
                "decile": d,
                "average_gain": float((g * w).sum() / sw),
                "relative_gain": decile_relative_gain,
                "percent_gaining": pct_gain_more + pct_gain_less,
                "percent_losing": pct_lose_less + pct_lose_more,
                "percent_unchanged": pct_no_change,
                "gain_more_than_5_pct": pct_gain_more,
                "gain_less_than_5_pct": pct_gain_less,
                "no_change_pct": pct_no_change,
                "lose_less_than_5_pct": pct_lose_less,
                "lose_more_than_5_pct": pct_lose_more,
                "total_benefit": gain_total,
                "share_of_total_benefit": (
                    gain_total / total_benefit * 100 if total_benefit else 0.0
                ),
            }
        )

    def _gini(values, weights):
        """Weighted Gini from the Lorenz-curve trapezoidal formula.
        Clips values to non-negative — negative net incomes (taxes
        exceeding cash income) otherwise push Gini past 1."""
        if weights.sum() == 0 or values.size == 0:
            return 0.0
        v = np.clip(values, 0, None)
        order = np.argsort(v, kind="stable")
        v_s = v[order]
        w_s = weights[order]
        cum_vw = np.cumsum(v_s * w_s)
        total_w = float(w_s.sum())
        total_vw = float(cum_vw[-1])
        if total_w == 0 or total_vw == 0:
            return 0.0
        # G = 1 - Σ w_i (cum_vw_i + cum_vw_{i-1}) / (total_w * total_vw)
        #   = 1 - Σ w_i (2*cum_vw_i - v_i*w_i) / (total_w * total_vw)
        return float(
            1.0 - (w_s * (2 * cum_vw - v_s * w_s)).sum() / (total_w * total_vw)
        )

    # Gini over equivalised net income (sqrt-of-size scale). Using the
    # raw household-net-mapped-to-person inflates Gini because each
    # person in a large household carries the full household total
    # rather than a per-capita share.
    person_equiv_reform = person_net_reform / np.sqrt(
        np.maximum(person_hh_size, 1)
    )
    baseline_gini = _gini(person_equiv_baseline, person_weight)
    reform_gini = _gini(person_equiv_reform, person_weight)

    pct_gaining_all = float(
        (person_weight * (person_gain > 0)).sum() / total_weight * 100
        if total_weight > 0 else 0.0
    )
    pct_losing_all = float(
        (person_weight * (person_gain < 0)).sum() / total_weight * 100
        if total_weight > 0 else 0.0
    )
    pct_unchanged_all = max(0.0, 100.0 - pct_gaining_all - pct_losing_all)

    _log("distributional done")

    # Dependent exemption/credit cost — isolated. A dependent exemption only
    # moves state income tax, and that delta overlaps with state CTC/EITC
    # changes in the combined reform, so attribute it via a separate
    # baseline-vs-(dependent-only) sub-simulation. Reported as a benefit-value
    # delta (baseline tax - reform tax) to match the sign of the credit rows.
    # Runs last, after the baseline/reform sims are released — three
    # concurrent national Populace sims would strain the container.
    if dep_dict:
        import gc

        del sim_reform, sim_baseline
        gc.collect()
        sim_dep = Microsimulation(
            dataset=_dataset(), reform=Reform.from_dict(dep_dict)
        )
        dependent_exemption_change = baseline_state_tax_total - _hh_sum(
            sim_dep, "state_income_tax"
        )
        del sim_dep
        gc.collect()
        _log("dependent-exemption isolation done")

    result = {
        "state": state_code,
        "year": year,
        "fiscal": {
            "federal_tax_change": federal_tax_change,
            "state_tax_change": state_tax_change,
            "benefit_change": benefit_change,
            "total_budgetary_impact": federal_tax_change
            + state_tax_change
            - benefit_change,
            "ctc_change": ctc_change,
            "eitc_change": eitc_change,
            "snap_change": snap_change,
            "state_ctc_change": state_ctc_change,
            "state_eitc_change": state_eitc_change,
            "ubi_change": ubi_change,
            "dependent_exemption_change": dependent_exemption_change,
        },
        "poverty": {
            "overall_baseline_rate": _rate(pov_bl_arr, all_mask),
            "overall_reform_rate": _rate(pov_rf_arr, all_mask),
            "child_baseline_rate": _rate(pov_bl_arr, child_mask),
            "child_reform_rate": _rate(pov_rf_arr, child_mask),
            "young_child_baseline_rate": _rate(pov_bl_arr, young_child_mask),
            "young_child_reform_rate": _rate(pov_rf_arr, young_child_mask),
            "deep_child_baseline_rate": _rate(deep_bl_arr, child_mask),
            "deep_child_reform_rate": _rate(deep_rf_arr, child_mask),
            "children_lifted": _lifted(child_mask),
            "young_children_lifted": _lifted(young_child_mask),
        },
        "distributional": {
            "deciles": decile_impacts,
            "average_gain_all": avg_gain_all,
            "average_gain_bottom_50": _avg(bottom_50_mask),
            "average_gain_top_10": _avg(top_10_mask),
            "share_to_bottom_20_pct": _share(bottom_20_mask),
            "share_to_bottom_50_pct": _share(bottom_50_mask),
            "share_to_top_20_pct": _share(top_20_mask),
            "share_to_top_10_pct": _share(top_10_mask),
            "baseline_gini": baseline_gini,
            "reform_gini": reform_gini,
            "gini_change": reform_gini - baseline_gini,
            "percent_gaining": pct_gaining_all,
            "percent_losing": pct_losing_all,
            "percent_unchanged": pct_unchanged_all,
        },
    }
    _cache_put(_cache_key("economy", payload), result)
    return result


# --- spawn-and-poll FastAPI surface ------------------------------------


@app.function(image=image, timeout=300, memory=512)
@modal.asgi_app()
def web():
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware

    api = FastAPI()
    api.add_middleware(
        CORSMiddleware,
        allow_origins=_ALLOW_ORIGINS,
        allow_origin_regex=_ALLOW_ORIGIN_REGEX,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # NOTE: `payload: dict` (not a Pydantic model) — matches the
    # refundable-credit-conversion shape so FastAPI's body-vs-query
    # detection doesn't trip over the polymorphic reform field.
    @api.post("/economy/start")
    def economy_start(payload: dict) -> dict:
        key = _cache_key("economy", payload)
        if _cache_get(key) is not None:
            return {"job_id": f"cache:{key}"}
        call = compute_economy.spawn(payload)
        return {"job_id": call.object_id}

    @api.post("/household/start")
    def household_start(payload: dict) -> dict:
        key = _cache_key("household", payload)
        if _cache_get(key) is not None:
            return {"job_id": f"cache:{key}"}
        call = compute_household_sweep.spawn(payload)
        return {"job_id": call.object_id}

    @api.get("/economy/status/{job_id}")
    def economy_status(job_id: str):
        return _status(job_id)

    @api.get("/household/status/{job_id}")
    def household_status(job_id: str):
        return _status(job_id)

    def _status(job_id: str) -> dict:
        # Cache-backed pseudo-jobs: the start endpoint found a stored result
        # for this exact (payload, build) pair, so there is no FunctionCall.
        if job_id.startswith("cache:"):
            cached = _cache_get(job_id[len("cache:"):])
            if cached is not None:
                return {"status": "ok", "result": cached, "cached": True}
            return {"status": "error", "message": "Cached result expired; retry."}
        try:
            call = modal.FunctionCall.from_id(job_id)
            result = call.get(timeout=0)
            try:
                results_cache.pop(f"progress:{job_id}")
            except Exception:
                pass
            return {"status": "ok", "result": result}
        except modal.exception.OutputExpiredError:
            raise HTTPException(status_code=410, detail="Result expired.")
        except TimeoutError:
            stage = _cache_get(f"progress:{job_id}")
            if stage:
                return {"status": "computing", "stage": stage}
            return {"status": "computing"}
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    @api.get("/healthz")
    def healthz():
        # Surface the deployed policyengine-us version so the reform-score sweep
        # can label snapshots by what the dashboard ACTUALLY runs and warn when
        # the deploy is behind the repo's pin.
        import os

        try:
            from importlib.metadata import version

            pe_us = version("policyengine-us")
        except Exception:  # pragma: no cover
            pe_us = None
        return {
            "ok": True,
            "policyengine_us": pe_us,
            "dataset": (
                f"{POPULACE_REPO}/{POPULACE_FILE}@{POPULACE_REVISION[:8]}"
                " (per-state slices)"
            ),
            "build_rev": os.environ.get("CPID_BUILD_REV"),
        }

    return api
