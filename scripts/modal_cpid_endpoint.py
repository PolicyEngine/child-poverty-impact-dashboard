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
        "policyengine-us==1.729.5",
        "numpy>=1.24.0",
        "pandas>=2.0.0",
        "huggingface_hub",
        "fastapi",
        "pydantic>=2",
    )
    # Cache-bust marker — bump when we want Modal to rebuild the image
    # even though pip deps haven't changed.
    .env({"CPID_BUILD_REV": "2026-06-16-peus-1.729.5-allowance-phaseout"})
)


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


def _build_household_situation(payload: dict, employment_income: float) -> dict:
    """Build the PolicyEngine situation dict for one income point.

    Keeps the same shape PolicyEngine-US's ``Simulation`` accepts —
    one tax unit with the head, optional spouse, and any children.
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
            "employment_income": {year: float(employment_income)},
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

    return {
        "people": people,
        "tax_units": {
            "tax_unit": {
                "members": members,
            }
        },
        "households": {
            "household": {
                "members": members,
                "state_name": {year: state},
            }
        },
    }


def _household_point(sim_baseline, sim_reform, year: int) -> dict:
    """Compute the per-point payload the React client expects."""

    def _val(sim, name: str) -> float:
        try:
            return float(sim.calculate(name, period=year)[0])
        except Exception:
            return 0.0

    return {
        "baseline": {
            "net_income": _val(sim_baseline, "household_net_income"),
            "federal_ctc": _val(sim_baseline, "ctc"),
            "federal_eitc": _val(sim_baseline, "eitc"),
            "state_ctc": _val(sim_baseline, "state_ctc"),
            "state_eitc": _val(sim_baseline, "state_eitc"),
            "snap_benefits": _val(sim_baseline, "snap"),
            "in_poverty": bool(_val(sim_baseline, "in_poverty") > 0),
        },
        "reform": {
            "net_income": _val(sim_reform, "household_net_income"),
            "federal_ctc": _val(sim_reform, "ctc"),
            "federal_eitc": _val(sim_reform, "eitc"),
            "state_ctc": _val(sim_reform, "state_ctc"),
            "state_eitc": _val(sim_reform, "state_eitc"),
            "snap_benefits": _val(sim_reform, "snap"),
            "in_poverty": bool(_val(sim_reform, "in_poverty") > 0),
        },
    }


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

    data_points: list[dict] = []
    baseline_data_points: list[dict] = []
    import traceback as _tb
    for income in incomes:
        try:
            situation = _build_household_situation(payload, income)
            sim_baseline = Simulation(situation=situation)
            sim_reform = (
                Simulation(situation=situation, reform=reform)
                if reform is not None
                else sim_baseline
            )
            point = _household_point(sim_baseline, sim_reform, year)
            baseline_data_points.append({"income": float(income), **point["baseline"]})
            data_points.append({"income": float(income), **point["reform"]})
        except Exception as exc:
            raise RuntimeError(
                f"Failed at income={income}: {type(exc).__name__}: {exc}\n"
                f"Traceback:\n{_tb.format_exc()}"
            ) from exc

    _log(f"sweep done ({len(incomes)} points)")

    return {
        "state": payload.get("state"),
        "year": year,
        "data_points": data_points,
        "baseline_data_points": baseline_data_points,
    }


# --- statewide economy --------------------------------------------------


@app.function(image=image, timeout=1800, memory=16384)
def compute_economy(payload: dict) -> dict:
    """Compute statewide microsim impact (poverty, fiscal, distributional)."""
    import time
    import numpy as np
    from policyengine_core.reforms import Reform
    from policyengine_us import Microsimulation

    t0 = time.perf_counter()

    def _log(stage: str) -> None:
        print(f"[{time.perf_counter() - t0:6.2f}s] {stage}", flush=True)

    year = int(payload["year"])
    state_code = payload.get("state")
    if not state_code:
        raise ValueError("`state` is required.")

    # State-specific calibrated CPS dataset (uppercase code). Same dataset
    # the SC / MO / RCC dashboards use — _not_ the national ECPS, which
    # would be slower and less accurate for state-level totals.
    state_dataset = (
        f"hf://policyengine/policyengine-us-data/states/{state_code.upper()}.h5"
    )

    reform_payload = payload.get("reform")
    reform_dict = _build_core_reform_dict(reform_payload, year)
    reform = Reform.from_dict(reform_dict) if reform_dict else None
    _log(
        f"reform loaded (params={len(reform_dict) if reform_dict else 0}) "
        f"on dataset={state_dataset}"
    )

    sim_baseline = Microsimulation(dataset=state_dataset)
    sim_reform = (
        Microsimulation(dataset=state_dataset, reform=reform)
        if reform is not None
        else sim_baseline
    )
    _log("microsims built")

    household_weight = np.array(
        sim_baseline.calculate("household_weight", period=year)
    )

    # State-specific .h5 already contains only this state's households,
    # so sums run unmasked across the whole sim.
    def _hh_sum(sim, name: str) -> float:
        arr = np.array(sim.calculate(name, period=year, map_to="household"))
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

    federal_tax_change = _delta("income_tax")
    state_tax_change = _delta("state_income_tax")
    benefit_change = _delta("household_benefits")
    ctc_change = _delta("ctc")
    eitc_change = _delta("eitc")
    snap_change = _delta("snap")
    state_ctc_change = _delta("state_ctc")
    state_eitc_change = _delta("state_eitc")
    # ubi_center basic income — the child allowance / baby bonus reforms.
    ubi_change = _delta("basic_income")
    _log("fiscal done")

    # ---- Poverty: overall, children, young children (0-3), deep child poverty.
    age_arr = np.array(sim_baseline.calculate("age", period=year))
    person_weight = np.array(
        sim_baseline.calculate("person_weight", period=year)
    )
    pov_bl_arr = np.array(
        sim_baseline.calculate("in_poverty", period=year, map_to="person")
    ).astype(bool)
    pov_rf_arr = np.array(
        sim_reform.calculate("in_poverty", period=year, map_to="person")
    ).astype(bool)
    try:
        deep_bl_arr = np.array(
            sim_baseline.calculate(
                "in_deep_poverty", period=year, map_to="person"
            )
        ).astype(bool)
        deep_rf_arr = np.array(
            sim_reform.calculate(
                "in_deep_poverty", period=year, map_to="person"
            )
        ).astype(bool)
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
    )
    person_net_reform = np.array(
        sim_reform.calculate(
            "household_net_income", period=year, map_to="person"
        )
    )
    person_gain = person_net_reform - person_net_baseline
    # Per-person equivalised baseline (used to cut deciles and compute
    # relative gain). Equivalised = household net / sqrt(household size),
    # standard PolicyEngine convention.
    person_hh_size = np.array(
        sim_baseline.calculate("household_size", period=year, map_to="person")
    )
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

    return {
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
        call = compute_economy.spawn(payload)
        return {"job_id": call.object_id}

    @api.post("/household/start")
    def household_start(payload: dict) -> dict:
        call = compute_household_sweep.spawn(payload)
        return {"job_id": call.object_id}

    @api.get("/economy/status/{job_id}")
    def economy_status(job_id: str):
        return _status(job_id)

    @api.get("/household/status/{job_id}")
    def household_status(job_id: str):
        return _status(job_id)

    def _status(job_id: str) -> dict:
        try:
            call = modal.FunctionCall.from_id(job_id)
            result = call.get(timeout=0)
            return {"status": "ok", "result": result}
        except modal.exception.OutputExpiredError:
            raise HTTPException(status_code=410, detail="Result expired.")
        except TimeoutError:
            return {"status": "computing"}
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    @api.get("/healthz")
    def healthz():
        return {"ok": True}

    return api
