"""State audit of the dataset and model the backend runs: the state dataset
policyengine.py's bundle certifies, under the policyengine-us version it pins.

It builds the per-state files exactly as scripts/build_populace_state_slices.py
does, but on an ephemeral Modal Volume that is deleted when the run ends, so
a policyengine.py release can be audited before the production Volume is
touched. Every simulation goes through the endpoint's own
``_state_microsimulation`` (scripts/modal_cpid_endpoint.py), so the audit
measures what the dashboard computes.

Per state and year it writes the dataset-adoption sweep's metrics
(state_audit_sweep_modal.py: populations, SPM poverty rates, the state's own
EITC/CTC program cost, program totals, and the restore-2021-CTC reference
reform) to ``output/state_audit_{label}_{year}_raw.json``, so
``summarize_sweep.py`` scores it against the same Census benchmarks. SPM
rates count measured people only: ACS group-quarters SPM units are outside
measurement, as policyengine.py declares for this dataset.

With ``--reforms``, it also runs the endpoint's ``compute_economy`` for every
reform the frontend's coverage manifest lists for each state (``single-edited``
and ``combo`` entries; run ``cd frontend && npm run manifest`` first) and
writes ``output/reform_compute_{label}_{year}.json``. Those runs write nothing
to the results cache or Supabase.

    PYTHONUTF8=1 modal run analysis/state_audit/state_audit_py_modal.py \\
        --label py6111 --years 2024,2026 --reforms

The local client must stay alive for the whole run: the ephemeral Volume
lives only as long as the client.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import modal

HERE = Path(__file__).resolve().parent
# Inside a Modal container this module sits at /root, with no repo above it.
REPO = HERE.parents[1] if len(HERE.parents) > 1 else HERE

app = modal.App("cpid-state-audit-policyengine-py")

# The endpoint's image, plus the endpoint and slice-builder modules.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("policyengine[us]==6.11.1", "fastapi", "pydantic>=2", "requests")
    .apt_install("ca-certificates")
    .pip_install("certifi>=2026.10.19", "hf-xet>=1.4.3")
    .add_local_file(
        str(REPO / "scripts" / "modal_cpid_endpoint.py"),
        "/root/modal_cpid_endpoint.py",
    )
    .add_local_file(
        str(REPO / "scripts" / "build_populace_state_slices.py"),
        "/root/build_populace_state_slices.py",
    )
)

STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
    "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
    "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
    "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
    "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]
REFORM_YEAR = 2026


def _ctc_2021_reform(year: int) -> dict:
    date = f"{year}-01-01"
    return {
        "gov.irs.credits.ctc.amount.arpa[0].amount": {date: 3600},
        "gov.irs.credits.ctc.amount.arpa[1].amount": {date: 3000},
        "gov.irs.credits.ctc.refundable.fully_refundable": {date: True},
        "gov.irs.credits.ctc.phase_out.arpa.in_effect": {date: True},
    }


def _peak_memory_gb() -> float:
    import resource

    # Linux reports kilobytes.
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 / 1024


def _endpoint():
    """The endpoint module, with every cache and progress write disabled."""
    sys.path.insert(0, "/root")
    import modal_cpid_endpoint as endpoint

    endpoint.results_cache = {}
    endpoint._result_store_put = lambda *args, **kwargs: None
    endpoint._progress_put = lambda *args, **kwargs: None
    endpoint._supabase_cfg = lambda: None
    return endpoint


@app.function(image=image, memory=131072, cpu=8.0, timeout=7200)
def build_state_files(scratch_volume) -> dict:
    import time

    sys.path.insert(0, "/root")
    import build_populace_state_slices as builder

    started = time.perf_counter()
    manifest = builder.write_state_slices("/slices", "/tmp/policyengine-data")
    manifest["build_seconds"] = round(time.perf_counter() - started)
    manifest["build_peak_memory_gb"] = round(_peak_memory_gb(), 1)
    scratch_volume.commit()
    return manifest


@app.function(
    image=image, memory=32768, cpu=2.0, timeout=3600, single_use_containers=True
)
def audit_state(state: str, year: int, scratch_volume) -> dict:
    import importlib.metadata as metadata
    import time

    import numpy as np
    from policyengine_core.reforms import Reform

    scratch_volume.reload()
    endpoint = _endpoint()
    started = time.perf_counter()
    out: dict = {
        "state": state,
        "year": year,
        "dataset": endpoint._state_dataset()["uri"],
        "policyengine": metadata.version("policyengine"),
        "pe_us": metadata.version("policyengine-us"),
        "policyengine_core": metadata.version("policyengine-core"),
        "spm_calculator": metadata.version("spm-calculator"),
    }
    try:
        sim = endpoint._state_microsimulation(state)
        age = np.asarray(sim.calculate("age", period=year))
        person_weight = np.asarray(sim.calculate("person_weight", period=year))
        household_weight = np.asarray(sim.calculate("household_weight", period=year))

        def indicator(simulation, name):
            return np.asarray(
                simulation.calculate(name, period=year, map_to="person"),
                dtype=float,
            )

        poverty = indicator(sim, "in_poverty")
        deep_poverty = indicator(sim, "in_deep_poverty")
        measured = ~np.isnan(poverty)

        def population(mask) -> float:
            return float(person_weight[mask].sum())

        def rate(values, mask) -> float:
            mask = mask & measured
            total = float(person_weight[mask].sum())
            return float((values[mask] * person_weight[mask]).sum() / total * 100) if total else 0.0

        def household_total(simulation, name: str) -> float:
            values = np.asarray(simulation.calculate(name, period=year, map_to="household"))
            return float((values * household_weight).sum())

        everyone = np.ones_like(age, dtype=bool)
        under_1, under_5, under_6, under_18 = age < 1, age < 5, age < 6, age < 18

        # The state's own credit variables: the state_eitc/state_ctc
        # aggregates add every state's credits (see state_audit_modal.py).
        state_lower = state.lower()
        household_parameters = sim.tax_benefit_system.parameters.gov.states.household

        def own_variables(list_name: str) -> list:
            try:
                names = list(getattr(household_parameters, list_name)(f"{year}-01-01"))
            except Exception:
                return []
            return [
                name for name in names
                if name.startswith(f"{state_lower}_") or name.startswith(f"taxsim_{state_lower}_")
            ]

        eitc_variables = own_variables("state_eitcs")
        ctc_variables = own_variables("state_ctcs")
        net_income = household_total(sim, "household_net_income")
        child_poverty = rate(poverty, under_18)
        out.update(
            {
                "spm_config": dict(sim.spm_config),
                "pop_total": population(everyone),
                "pop_under_1": population(under_1),
                "pop_under_5": population(under_5),
                "pop_under_6": population(under_6),
                "pop_under_18": population(under_18),
                # Measured people only, so the "_measured" fields
                # summarize_sweep.py prefers hold the same values.
                "poverty_all": rate(poverty, everyone),
                "poverty_child": child_poverty,
                "poverty_young_child": rate(poverty, under_6),
                "poverty_age_0_3": rate(poverty, age < 4),
                "poverty_under_1": rate(poverty, under_1),
                "poverty_deep_child": rate(deep_poverty, under_18),
                "gq_mask_available": True,
                "gq_person_share": float(person_weight[~measured].sum() / person_weight.sum() * 100),
                "gq_child_share": float(
                    person_weight[under_18 & ~measured].sum() / max(person_weight[under_18].sum(), 1) * 100
                ),
                "poverty_all_measured": rate(poverty, everyone),
                "poverty_child_measured": child_poverty,
                "poverty_young_child_measured": rate(poverty, under_6),
                "poverty_deep_child_measured": rate(deep_poverty, under_18),
                "social_security_total": household_total(sim, "social_security"),
                "eitc_vars": eitc_variables,
                "ctc_vars": ctc_variables,
                "eitc_cost": sum(household_total(sim, name) for name in eitc_variables),
                "ctc_cost": sum(household_total(sim, name) for name in ctc_variables),
                "ssi_total": household_total(sim, "ssi"),
                "snap_total": household_total(sim, "snap"),
                "tanf_total": household_total(sim, "tanf"),
                "federal_eitc_total": household_total(sim, "eitc"),
                "federal_ctc_total": household_total(sim, "ctc"),
                "net_income_total": net_income,
                "households": float(household_weight.sum()),
                "n_households": int(len(household_weight)),
            }
        )
        out["has_eitc"] = out["eitc_cost"] > 1_000
        out["has_ctc"] = out["ctc_cost"] > 1_000
        out["baseline_seconds"] = round(time.perf_counter() - started, 1)
        del sim

        reform = endpoint._state_microsimulation(
            state, Reform.from_dict(_ctc_2021_reform(year), country_id="us")
        )
        reform_child_poverty = rate(
            np.nan_to_num(indicator(reform, "in_poverty")), under_18
        )
        out["ref_ctc2021_child_poverty"] = reform_child_poverty
        out["ref_ctc2021_child_poverty_measured"] = reform_child_poverty
        out["ref_ctc2021_child_pov_change_pp"] = reform_child_poverty - child_poverty
        out["ref_ctc2021_child_pov_change_pp_measured"] = reform_child_poverty - child_poverty
        out["ref_ctc2021_transfer"] = household_total(reform, "household_net_income") - net_income
        out["status"] = "ok"
    except Exception as error:  # recorded, so one state cannot sink the map
        import traceback

        out["status"] = "error"
        out["error"] = f"{type(error).__name__}: {str(error)[:600]}"
        out["traceback"] = traceback.format_exc()[-3000:]
    out["runtime_s"] = round(time.perf_counter() - started, 1)
    out["peak_memory_gb"] = round(_peak_memory_gb(), 2)
    return out


@app.function(
    image=image,
    memory=(32768, 65536),
    cpu=2.0,
    timeout=1800,
    single_use_containers=True,
)
def compute_reform(state: str, year: int, entry: dict, scratch_volume) -> dict:
    """The endpoint's compute_economy, on compute_economy's resources."""
    import time

    scratch_volume.reload()
    endpoint = _endpoint()
    payload = {"state": state, "year": year, "reform": entry["reform"]}
    started = time.perf_counter()
    out = {"state": state, "year": year, "ids": entry["ids"], "kind": entry["kind"]}
    try:
        result = endpoint.compute_economy.local(payload)
        poverty = result["poverty"]
        fiscal = result["fiscal"]
        out.update(
            {
                "status": "ok",
                "child_baseline_rate": poverty["child_baseline_rate"],
                "child_reform_rate": poverty["child_reform_rate"],
                "children_lifted": poverty["children_lifted"],
                "children_entering": poverty["children_entering"],
                "total_budgetary_impact": fiscal["total_budgetary_impact"],
                "state_eitc_change": fiscal["state_eitc_change"],
                "state_ctc_change": fiscal["state_ctc_change"],
                "stacked_rows": fiscal.get("stacked", {}).get("rows", []),
                "districts": len(result["districts"]),
            }
        )
    except Exception as error:
        import traceback

        out["status"] = "error"
        out["error"] = f"{type(error).__name__}: {str(error)[:600]}"
        out["traceback"] = traceback.format_exc()[-3000:]
    out["runtime_s"] = round(time.perf_counter() - started, 1)
    out["peak_memory_gb"] = round(_peak_memory_gb(), 2)
    return out


@app.local_entrypoint()
def main(label: str, years: str = "2024,2026", states: str = "", reforms: bool = False):
    targets = [s.strip().upper() for s in states.split(",") if s.strip()] or STATES
    year_list = [int(y) for y in years.split(",") if y.strip()]
    out_dir = HERE / "output"
    out_dir.mkdir(exist_ok=True)
    entries = []
    if reforms:
        manifest_path = REPO / "frontend" / "__generated__" / "reform-manifest.json"
        entries = [
            entry
            for entry in json.loads(manifest_path.read_text())["entries"]
            if entry["reform"] and entry["kind"] in ("single-edited", "combo")
            and entry["state"] in targets
        ]
    with modal.Volume.ephemeral() as scratch:
        built = build_state_files.with_options(volumes={"/slices": scratch}).remote(scratch)
        print(
            f"built {len(built['states'])} state files from {built['source']['uri']} "
            f"in {built['build_seconds']}s (peak {built['build_peak_memory_gb']} GB)",
            flush=True,
        )
        auditor = audit_state.with_options(volumes={"/slices": scratch})
        reform_runner = compute_reform.with_options(volumes={"/slices": scratch})
        audit_calls = {
            (year, state): auditor.spawn(state, year, scratch)
            for year in year_list
            for state in targets
        }
        reform_calls = [
            (entry, reform_runner.spawn(entry["state"], REFORM_YEAR, entry, scratch))
            for entry in entries
        ]
        for year in year_list:
            rows = []
            for state in targets:
                try:
                    row = audit_calls[(year, state)].get()
                except Exception as error:
                    row = {"state": state, "year": year, "status": "error", "error": f"call failed: {error!r}"[:600]}
                rows.append(row)
                print(
                    f"{year} {state:<3} {row.get('status')} "
                    f"child_spm={row.get('poverty_child')} "
                    f"{row.get('runtime_s')}s {row.get('peak_memory_gb')}GB "
                    f"{row.get('error', '')[:160]}",
                    flush=True,
                )
            path = out_dir / f"state_audit_{label}_{year}_raw.json"
            path.write_text(json.dumps(rows, indent=2))
        if reform_calls:
            results = []
            for entry, call in reform_calls:
                try:
                    result = call.get()
                except Exception as error:
                    result = {"state": entry["state"], "ids": entry["ids"], "kind": entry["kind"],
                              "status": "error", "error": f"call failed: {error!r}"[:600]}
                results.append(result)
                print(
                    f"reform {result['state']} {'+'.join(result['ids'])[:60]} {result.get('status')} "
                    f"{result.get('runtime_s')}s {result.get('error', '')[:160]}",
                    flush=True,
                )
            (out_dir / f"reform_compute_{label}_{REFORM_YEAR}.json").write_text(
                json.dumps(results, indent=2)
            )
        (out_dir / f"state_files_{label}.json").write_text(json.dumps(built, indent=2))
