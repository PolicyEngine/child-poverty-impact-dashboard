"""Split the ACS-local dataset that policyengine.py certifies for US state
regions into one file per state, on a Modal Volume.

A statewide dashboard request only needs one state's households. The dataset
policyengine.py's bundle selects for state regions (``region_datasets.state``
in its manifest: the Microcosm ACS-local file, 1.59M households) would make
every request simulate the whole country, so this script splits it once per
bundle release into 51 state files (WY: about 3.4k households, CA: about
163k).

Each state's rows are chosen exactly as policyengine.py selects a state
region: the region registry's scoping strategy for ``state/xx`` (a row filter
on the household ``state_fips``) is applied to the bundle's file, which
policyengine.py downloads and checks against its certified SHA-256. The
stored tables are written back unchanged apart from the row selection, so
every input column, including the record-type evidence policyengine.py
derives SPM measurement scope from, survives. The script refuses to write
anything if an SPM unit, tax unit, family or marital unit would straddle two
states, and checks that the 51 files partition the national file.

Run once per policyengine.py bump that changes the state dataset:

    modal run scripts/build_populace_state_slices.py

The files land on the ``cpid-populace-slices`` Volume under
``/sha256-{first 12 hex digits of the certified file's SHA-256}/{ST}.h5``,
with a ``manifest.json`` that names the source file and its SHA-256.
scripts/modal_cpid_endpoint.py mounts the Volume read-only and refuses to
compute when the manifest does not match the installed policyengine.py
bundle. Existing state files are skipped (each file is written under a
temporary name and renamed when complete), so a cancelled run can be resumed.
"""

import modal

app = modal.App("cpid-populace-slice-builder")

# Same policyengine.py pin as the endpoint image
# (scripts/modal_cpid_endpoint.py). policyengine.py pins policyengine-us,
# policyengine-core and spm-calculator itself, so they are not listed here.
POLICYENGINE_REQUIREMENT = "policyengine[us]==6.11.1"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(POLICYENGINE_REQUIREMENT)
    # eMudhra CA key compromise (2026-10-20, emudhra.we-have-a-problem.com):
    # Hugging Face downloads go through hf-xet (which reads the Debian CA
    # store from 1.4.3 on; 1.2.x bundles a CA list that trusts the affected
    # roots) or requests (certifi, fixed in 2026.10.19).
    .apt_install("ca-certificates")
    .pip_install("certifi>=2026.10.19", "hf-xet>=1.4.3")
)

volume = modal.Volume.from_name("cpid-populace-slices", create_if_missing=True)

GROUP_ENTITIES = ("tax_unit", "spm_unit", "family", "marital_unit")
TABLES = ("person", "household", *GROUP_ENTITIES)


def state_dataset_reference() -> dict:
    """The dataset policyengine.py's bundle selects for US state regions.

    Returns its bundle name, URI and certified SHA-256, read from the
    installed policyengine.py release manifest. Every state region must
    select the same file.
    """
    import policyengine as pe
    from policyengine.provenance.manifest import (
        get_release_manifest,
        resolve_dataset_reference,
    )

    regions = pe.us.model.region_registry.get_by_type("state")
    uris = {region.dataset_path for region in regions}
    if len(uris) != 1:
        raise ValueError(f"State regions select several datasets: {sorted(uris)}")
    uri = uris.pop()
    manifest = get_release_manifest("us")
    for name, reference in manifest.datasets.items():
        if resolve_dataset_reference("us", name) == uri:
            return {"name": name, "uri": uri, "sha256": reference.sha256}
    raise ValueError(f"No bundle dataset resolves to the state dataset {uri}")


def slice_directory_name(sha256: str) -> str:
    return f"sha256-{sha256[:12]}"


def write_state_slices(output_root: str, download_folder: str) -> dict:
    """Write one file per state region under ``output_root``; return a report.

    Kept free of Modal objects so the audit in analysis/state_audit can run
    it against a scratch volume.
    """
    import json
    import os
    import time
    from importlib import metadata
    from pathlib import Path

    import pandas as pd
    import policyengine as pe
    from microdf import MicroDataFrame
    from policyengine.provenance.dataset_materialization import materialize_dataset
    from policyengine.tax_benefit_models.us.model import US_GROUP_ENTITIES

    started = time.perf_counter()
    reference = state_dataset_reference()
    source = materialize_dataset(
        "us", reference["name"], data_dir=Path(download_folder)
    )
    if source.bundle_dataset is None or (
        source.bundle_dataset.sha256 != reference["sha256"]
    ):
        raise ValueError("policyengine.py did not verify the state dataset")
    output_dir = Path(output_root) / slice_directory_name(reference["sha256"])
    output_dir.mkdir(parents=True, exist_ok=True)

    with pd.HDFStore(source.path, mode="r") as store:
        tables = {name: store[name] for name in TABLES}
        data_year = (
            int(store["_time_period"].iloc[0]) if "_time_period" in store else 2024
        )
    print(
        f"loaded {source.path}: {len(tables['household'])} households, "
        f"{len(tables['person'])} people "
        f"({time.perf_counter() - started:.0f}s)",
        flush=True,
    )

    # No group may straddle two states: a state file would then hold a
    # partial group and every group sum would silently shrink.
    person = tables["person"]
    household_state = tables["household"].set_index("household_id")["state_fips"]
    person_state = person["person_household_id"].map(household_state)
    if person_state.isna().any():
        raise ValueError("Some people belong to no household with a state_fips")
    for group in GROUP_ENTITIES:
        states_per_group = person_state.groupby(person[f"person_{group}_id"]).nunique()
        straddling = int((states_per_group > 1).sum())
        if straddling:
            raise ValueError(f"{straddling} {group} rows straddle two states")

    entity_data = {name: MicroDataFrame(frame) for name, frame in tables.items()}
    report: dict = {}
    for region in pe.us.model.region_registry.get_by_type("state"):
        state = region.state_code
        destination = output_dir / f"{state}.h5"
        rows = region.scoping_strategy.apply(
            entity_data=entity_data,
            group_entities=US_GROUP_ENTITIES,
            year=data_year,
        )
        report[state] = {
            "households": len(rows["household"]),
            "people": len(rows["person"]),
        }
        if destination.exists():
            print(f"{state}: already written, skipping", flush=True)
            continue
        partial = destination.with_suffix(".h5.partial")
        with pd.HDFStore(partial, mode="w") as store:
            for name in TABLES:
                # Fixed format, as policyengine.py saves datasets: the source's
                # mixed-type bookkeeping columns are kept as they are.
                store.put(name, pd.DataFrame(rows[name]), format="fixed")
            store.put("_time_period", pd.Series([data_year]))
        os.replace(partial, destination)
        report[state]["megabytes"] = round(destination.stat().st_size / 1e6, 1)
        print(
            f"{state}: {report[state]['households']} households, "
            f"{report[state]['people']} people, "
            f"{report[state]['megabytes']} MB",
            flush=True,
        )

    for key, table in (("households", "household"), ("people", "person")):
        written = sum(entry[key] for entry in report.values())
        if written != len(tables[table]):
            raise ValueError(
                f"State files do not partition the dataset: {written} of "
                f"{len(tables[table])} {key}"
            )

    manifest = {
        "source": {**reference, "data_year": data_year},
        "policyengine": metadata.version("policyengine"),
        "policyengine_us": metadata.version("policyengine-us"),
        "states": report,
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"done in {time.perf_counter() - started:.0f}s -> {output_dir}", flush=True)
    return manifest


@app.function(
    image=image,
    timeout=7200,
    memory=131072,
    cpu=8.0,
    volumes={"/slices": volume},
)
def build_slices() -> dict:
    manifest = write_state_slices("/slices", "/tmp/policyengine-data")
    volume.commit()
    return manifest


@app.local_entrypoint()
def main():
    manifest = build_slices.remote()
    print(
        f"wrote {len(manifest['states'])} state files from "
        f"{manifest['source']['uri']} (sha256 {manifest['source']['sha256']})"
    )
