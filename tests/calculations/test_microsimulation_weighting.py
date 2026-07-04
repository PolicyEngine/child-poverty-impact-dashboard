from __future__ import annotations

import importlib
from pathlib import Path

import pandas as pd

from cpid_calc.calculations import microsim
from cpid_calc.reforms.config import ReformConfig


def test_policyengine_microsim_code_uses_microseries_aggregation() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    source_roots = [
        repo_root / "backend",
        repo_root / "cpid_calc",
        repo_root / "modal_app",
    ]
    forbidden_names = [
        "household" + "_weight",
        "person" + "_weight",
        "tax_unit" + "_weight",
        "spm_unit" + "_weight",
    ]

    offenders: list[str] = []
    for source_root in source_roots:
        for path in source_root.rglob("*.py"):
            text = path.read_text()
            for name in forbidden_names:
                for token in (f'"{name}"', f"'{name}'"):
                    if token in text:
                        offenders.append(
                            f"{path.relative_to(repo_root)} contains {token}"
                        )

    assert not offenders, (
        "PolicyEngine microsim code should use MicroSeries .sum()/.mean() "
        "and map_to, not manual weight variables:\n" + "\n".join(offenders)
    )


def test_population_microsim_module_uses_policyengine_py_pe_us() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    source = (repo_root / "cpid_calc" / "calculations" / "microsim.py").read_text()

    assert "import policyengine as pe" in source
    assert "pe.us.managed_microsimulation" in source
    assert "from policyengine_us import Microsimulation" not in source


def test_tiny_population_microsim_smoke_path_uses_pe_us(
    monkeypatch,
    tmp_path,
) -> None:
    tiny_dataset = tmp_path / "tiny_us.h5"
    _write_tiny_us_dataset(tiny_dataset)

    us_model = importlib.import_module("policyengine.tax_benefit_models.us.model")
    real_managed_microsimulation = microsim.pe.us.managed_microsimulation
    calls: list[dict] = []

    def recording_managed_microsimulation(**kwargs):
        calls.append(kwargs)
        return real_managed_microsimulation(**kwargs)

    monkeypatch.setattr(
        microsim.pe.us,
        "managed_microsimulation",
        recording_managed_microsimulation,
    )
    monkeypatch.setattr(
        us_model,
        "resolve_managed_dataset_reference",
        lambda country_id, dataset, allow_unmanaged=False: "tiny_us",
    )
    monkeypatch.setattr(
        us_model,
        "resolve_local_managed_dataset_source",
        lambda country_id, dataset_uri, allow_local_mirror=True: str(tiny_dataset),
    )
    monkeypatch.setattr(microsim, "create_reform", lambda config: None)

    baseline, reform = microsim.run_microsimulation(
        ReformConfig(year=2024),
        dataset="tiny_us",
    )
    age = baseline.calc("age", period=2024, map_to="person")
    children = microsim.get_child_filter(baseline, year=2024)

    assert baseline.policyengine_bundle["managed_by"] == "policyengine.py"
    assert reform.policyengine_bundle["managed_by"] == "policyengine.py"
    assert calls == [
        {
            "dataset": "tiny_us",
            "reform": None,
            "allow_unmanaged": True,
        },
        {
            "dataset": "tiny_us",
            "reform": None,
            "allow_unmanaged": True,
        },
    ]
    assert microsim.micro_mean(age) == 10
    assert microsim.micro_sum(children) == 2


def _write_tiny_us_dataset(path: Path) -> None:
    person = pd.DataFrame(
        {
            "person_id": [1],
            "person_household_id": [1],
            "person_tax_unit_id": [1],
            "person_spm_unit_id": [1],
            "person_family_id": [1],
            "person_marital_unit_id": [1],
            "age": [10],
            "person_weight": [2.0],
            "employment_income": [0.0],
        }
    )
    household = pd.DataFrame(
        {
            "household_id": [1],
            "household_weight": [2.0],
            "state_code": ["CA"],
        }
    )
    tax_unit = pd.DataFrame({"tax_unit_id": [1], "tax_unit_weight": [2.0]})
    spm_unit = pd.DataFrame({"spm_unit_id": [1], "spm_unit_weight": [2.0]})
    family = pd.DataFrame({"family_id": [1], "family_weight": [2.0]})
    marital_unit = pd.DataFrame(
        {"marital_unit_id": [1], "marital_unit_weight": [2.0]}
    )

    with pd.HDFStore(path, mode="w") as store:
        store["person"] = person
        store["household"] = household
        store["tax_unit"] = tax_unit
        store["spm_unit"] = spm_unit
        store["family"] = family
        store["marital_unit"] = marital_unit
        store["_time_period"] = pd.Series([2024])
