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
  distributional). Reform is canonicalised via
  ``Reform.from_api(policy_id, "us")`` so PE-core gets the bracket
  indices + period-range strings the React client mints with
  ``createPolicy``.

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
        "policyengine-us==1.715.2",
        "numpy>=1.24.0",
        "pandas>=2.0.0",
        "huggingface_hub",
        "fastapi",
        "pydantic>=2",
    )
    # Cache-bust marker — bump when we want Modal to rebuild the image
    # even though pip deps haven't changed.
    .env({"CPID_BUILD_REV": "2026-05-29-4-1800s-16gb"})
)


_ALLOW_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3009",
    "https://child-poverty-impact-dashboard.vercel.app",
    "https://child-poverty-impact-dashboard-sigma.vercel.app",
]
_ALLOW_ORIGIN_REGEX = (
    r"https://child-poverty-impact-dashboard-[a-z0-9-]+(?:-policy-engine)?\.vercel\.app"
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

    policy_id = payload.get("policy_id")
    year = int(payload["year"])
    incomes = list(payload.get("income_range", []))
    if not incomes:
        incomes = [
            float(i) for i in np.arange(0, 400_001, 10_000).tolist()
        ]

    reform = None
    if policy_id and str(policy_id) not in ("1", "2"):
        reform = Reform.from_api(str(policy_id), country_id="us")
    _log(f"reform loaded (policy_id={policy_id})")

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

    policy_id = payload.get("policy_id")
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

    reform = (
        Reform.from_api(str(policy_id), country_id="us")
        if policy_id and str(policy_id) not in ("1", "2")
        else None
    )
    _log(f"reform loaded (policy_id={policy_id}) on dataset={state_dataset}")

    sim_baseline = Microsimulation(dataset=state_dataset)
    sim_reform = (
        Microsimulation(dataset=state_dataset, reform=reform)
        if reform is not None
        else sim_baseline
    )
    _log("microsims built")

    # State-specific .h5 already contains only this state's households,
    # so all sums and rates run unmasked across the whole sim.
    def _sum(sim, name: str) -> float:
        arr = np.array(sim.calculate(name, period=year, map_to="household"))
        weight = np.array(sim.calculate("household_weight", period=year))
        return float((arr * weight).sum())

    federal_baseline = _sum(sim_baseline, "income_tax")
    federal_reform = _sum(sim_reform, "income_tax")
    federal_tax_change = federal_reform - federal_baseline
    _log("federal_tax done")

    state_baseline = _sum(sim_baseline, "state_income_tax")
    state_reform = _sum(sim_reform, "state_income_tax")
    state_tax_change = state_reform - state_baseline
    _log("state_tax done")

    benefit_baseline = _sum(sim_baseline, "household_benefits")
    benefit_reform = _sum(sim_reform, "household_benefits")
    benefit_change = benefit_reform - benefit_baseline
    _log("benefits done")

    pov_baseline = sim_baseline.calculate(
        "in_poverty", period=year, map_to="person"
    )
    pov_reform = sim_reform.calculate(
        "in_poverty", period=year, map_to="person"
    )
    age_arr = np.array(sim_baseline.calculate("age", period=year))
    person_weight = np.array(
        sim_baseline.calculate("person_weight", period=year)
    )
    child_mask = age_arr < 18
    total_children = float(person_weight[child_mask].sum())

    pov_bl_arr = np.array(pov_baseline).astype(bool)
    pov_rf_arr = np.array(pov_reform).astype(bool)
    all_mask = np.ones_like(age_arr, dtype=bool)

    def _rate(arr, mask):
        w = person_weight[mask]
        total = float(w.sum())
        if total == 0:
            return 0.0
        return float((arr[mask] * w).sum() / total * 100)

    return {
        "state": state_code,
        "year": year,
        "fiscal": {
            "federal_tax_change": federal_tax_change,
            "state_tax_change": state_tax_change,
            "benefit_change": benefit_change,
            "total_budgetary_impact": federal_tax_change + state_tax_change - benefit_change,
        },
        "poverty": {
            "overall_baseline_rate": _rate(pov_bl_arr, all_mask),
            "overall_reform_rate": _rate(pov_rf_arr, all_mask),
            "child_baseline_rate": _rate(pov_bl_arr, child_mask),
            "child_reform_rate": _rate(pov_rf_arr, child_mask),
            "children_lifted": float(
                ((pov_bl_arr & ~pov_rf_arr) * person_weight * child_mask).sum()
            ),
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
    # detection doesn't trip over the polymorphic policy_id field.
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
