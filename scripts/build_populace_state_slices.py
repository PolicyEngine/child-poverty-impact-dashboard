"""Build per-state slices of the Microcosm ACS-local national file on a
Modal Volume.

A statewide dashboard request only needs one state's households, but the
national file (Build P: 1.59M households) would make every request simulate
the whole country. Slicing the file once per release into 51 state files
(WY: 3.4k households … CA: 163k) keeps statewide runs bounded while
preserving exactly the calibrated numbers — verified by asserting the
slices partition the frame exactly and that no tax/spm/family/marital unit
straddles a state boundary.

Run once per release bump (resume-safe: existing slices are skipped, so a
cancelled run can be re-run; delete a slice file first to force a rebuild):
    modal run scripts/build_populace_state_slices.py

Writes to the `cpid-populace-slices` Volume under /{SLICE_TAG}/{ST}.h5,
which scripts/modal_cpid_endpoint.py mounts read-only.

Ops notes from the Build P rollout (2026-08-19/20):
- A killed `modal run --detach` CLIENT can still propagate cancellation to
  the app; a truncated slice from a cancelled save must be deleted before
  the resume run (it would otherwise be skipped as complete).
- The ACS-local releases apply the engine-pass contract to the published
  bytes, so they load directly — but spine bookkeeping columns are
  mixed-dtype objects HDF refuses to re-save; the normalization below is
  required.
"""

import modal

app = modal.App("cpid-populace-slice-builder")

# Same pins as the endpoint image (scripts/modal_cpid_endpoint.py).
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "policyengine-us==1.808.0",
    "numpy>=1.24.0",
    "pandas>=2.0.0",
    "huggingface_hub",
)

POPULACE_REPO = "policyengine/populace-us"
POPULACE_FILE = "populace_us_2024_acs_local.h5"
# HF release tag; slices land under the short hash from the release id.
POPULACE_REVISION = "populace-us-2024-buildp-acs-local-592ae5d6-20260819T020303Z"
SLICE_TAG = "592ae5d6"

volume = modal.Volume.from_name("cpid-populace-slices", create_if_missing=True)

STATE_FIPS = {
    "AL": 1, "AK": 2, "AZ": 4, "AR": 5, "CA": 6, "CO": 8, "CT": 9,
    "DE": 10, "DC": 11, "FL": 12, "GA": 13, "HI": 15, "ID": 16,
    "IL": 17, "IN": 18, "IA": 19, "KS": 20, "KY": 21, "LA": 22,
    "ME": 23, "MD": 24, "MA": 25, "MI": 26, "MN": 27, "MS": 28,
    "MO": 29, "MT": 30, "NE": 31, "NV": 32, "NH": 33, "NJ": 34,
    "NM": 35, "NY": 36, "NC": 37, "ND": 38, "OH": 39, "OK": 40,
    "OR": 41, "PA": 42, "RI": 44, "SC": 45, "SD": 46, "TN": 47,
    "TX": 48, "UT": 49, "VT": 50, "VA": 51, "WA": 53, "WV": 54,
    "WI": 55, "WY": 56,
}

GROUP_ENTITIES = ("tax_unit", "spm_unit", "family", "marital_unit")


@app.function(image=image, timeout=7200, memory=131072, cpu=8.0, volumes={"/slices": volume})
def build_slices() -> dict:
    import os

    from huggingface_hub import hf_hub_download
    from policyengine_us.data import USSingleYearDataset

    path = hf_hub_download(
        POPULACE_REPO, POPULACE_FILE, repo_type="dataset", revision=POPULACE_REVISION
    )
    ds = USSingleYearDataset(file_path=path)
    if hasattr(ds, "load"):
        ds.load()
    # Spine bookkeeping columns (source ids etc.) load as mixed-dtype
    # objects that HDF "table" format refuses to re-save; normalize every
    # object column to str (pure-bool ones to bool) before slicing.
    for entity in ("household", "person", *GROUP_ENTITIES):
        df = getattr(ds, entity)
        for col in df.columns:
            if df[col].dtype == object:
                uniques = set(df[col].dropna().unique())
                if uniques <= {True, False}:
                    df[col] = df[col].astype(bool)
                else:
                    df[col] = df[col].astype(str)
    hh_all = ds.household
    person_all = ds.person

    out_dir = f"/slices/{SLICE_TAG}"
    os.makedirs(out_dir, exist_ok=True)
    report: dict[str, dict] = {}

    for st, fips in STATE_FIPS.items():
        keep_hh = hh_all[hh_all["state_fips"] == fips]
        out = f"{out_dir}/{st}.h5"
        if os.path.exists(out):
            report[st] = {
                "households": len(keep_hh),
                "persons": -1,
                "mb": round(os.path.getsize(out) / 1e6, 1),
                "skipped": True,
            }
            print(f"{st}: already sliced, skipping", flush=True)
            continue
        hh_ids = set(keep_hh["household_id"])
        person = person_all[person_all["person_household_id"].isin(hh_ids)]
        frames = {"household": keep_hh, "person": person}
        for g in GROUP_ENTITIES:
            ids = set(person[f"person_{g}_id"].unique())
            gdf = getattr(ds, g)
            frames[g] = gdf[gdf[f"{g}_id"].isin(ids)]
            # No group may straddle the state boundary: every member of every
            # kept group must be a kept person, or group sums silently shrink.
            members = person_all[person_all[f"person_{g}_id"].isin(ids)]
            if len(members) != len(person):
                raise ValueError(
                    f"{st}: {g} straddles the state boundary "
                    f"({len(members)} members vs {len(person)} persons)"
                )
        sliced = USSingleYearDataset(
            time_period=2024,
            **{k: v.reset_index(drop=True) for k, v in frames.items()},
        )
        sliced.save(out)
        report[st] = {
            "households": len(keep_hh),
            "persons": len(person),
            "mb": round(os.path.getsize(out) / 1e6, 1),
        }
        print(f"{st}: {len(keep_hh)} hh / {len(person)} persons "
              f"-> {report[st]['mb']}MB", flush=True)

    # Coverage: every national household lands in exactly one slice.
    total_hh = sum(r["households"] for r in report.values())
    if total_hh != len(hh_all):
        raise ValueError(
            f"Slices do not partition the frame: {total_hh}/{len(hh_all)} "
            "households"
        )
    volume.commit()
    return report


@app.function(image=image, timeout=1800, memory=8192, volumes={"/slices": volume})
def verify_slice(st: str) -> dict:
    """Full-sim spot check: baseline poverty and weights on the slice."""
    import numpy as np
    from policyengine_us import Microsimulation
    from policyengine_us.data import USSingleYearDataset

    year = 2026
    sim = Microsimulation(
        dataset=USSingleYearDataset(
            file_path=f"/slices/{SLICE_TAG}/{st}.h5"
        )
    )
    pw = np.array(sim.calculate("person_weight", period=year))
    age = np.array(sim.calculate("age", period=year))
    pov = np.array(
        sim.calculate("in_poverty", period=year, map_to="person")
    ).astype(bool)
    child = age < 18
    return {
        "state": st,
        "population": float(pw.sum()),
        "child_poverty_pct": float((pov[child] * pw[child]).sum() / pw[child].sum() * 100),
        "overall_poverty_pct": float((pov * pw).sum() / pw.sum() * 100),
    }


CTC_2021_REFORM = {
    "gov.irs.credits.ctc.amount.arpa[0].amount": {"2026-01-01": 3600},
    "gov.irs.credits.ctc.amount.arpa[1].amount": {"2026-01-01": 3000},
    "gov.irs.credits.ctc.refundable.fully_refundable": {"2026-01-01": True},
    "gov.irs.credits.ctc.phase_out.arpa.in_effect": {"2026-01-01": True},
}
VERIFY_YEAR = 2026


def _state_metrics(sim_base, sim_reform, year, person_mask, hh_mask):
    """Per-state comparison metrics from baseline+reform sims, masked to a
    state (all-true masks on a slice)."""
    import numpy as np

    pw = np.array(sim_base.calculate("person_weight", period=year))[person_mask]
    age = np.array(sim_base.calculate("age", period=year))[person_mask]
    pov_b = np.array(
        sim_base.calculate("in_poverty", period=year, map_to="person")
    )[person_mask].astype(bool)
    pov_r = np.array(
        sim_reform.calculate("in_poverty", period=year, map_to="person")
    )[person_mask].astype(bool)
    hw = np.array(sim_base.calculate("household_weight", period=year))[hh_mask]
    nin_b = np.array(
        sim_base.calculate("household_net_income", period=year, map_to="household")
    )[hh_mask]
    nin_r = np.array(
        sim_reform.calculate("household_net_income", period=year, map_to="household")
    )[hh_mask]
    child = age < 18

    def rate(p, m):
        w = pw[m]
        return float((p[m] * w).sum() / w.sum() * 100) if w.sum() else 0.0

    return {
        "population": float(pw.sum()),
        "child_pov_base": rate(pov_b, child),
        "child_pov_reform": rate(pov_r, child),
        "overall_pov_base": rate(pov_b, np.ones_like(child, bool)),
        "transfer_total": float(((nin_r - nin_b) * hw).sum()),
    }


@app.function(image=image, timeout=3600, memory=32768, cpu=4.0)
def national_metrics() -> dict:
    """The 2021-CTC reform on the FULL national file, masked per state."""
    import numpy as np
    from huggingface_hub import hf_hub_download
    from policyengine_core.reforms import Reform
    from policyengine_us import Microsimulation

    path = hf_hub_download(
        POPULACE_REPO, POPULACE_FILE, repo_type="dataset", revision=POPULACE_REVISION
    )
    base = Microsimulation(dataset=path)
    reform = Microsimulation(
        dataset=path, reform=Reform.from_dict(CTC_2021_REFORM, country_id="us")
    )
    hh_states = np.array(base.calculate("state_code", period=VERIFY_YEAR)).astype(str)
    p_states = np.array(
        base.calculate("state_code", period=VERIFY_YEAR, map_to="person")
    ).astype(str)
    return {
        st: _state_metrics(base, reform, VERIFY_YEAR, p_states == st, hh_states == st)
        for st in STATE_FIPS
    }


@app.function(image=image, timeout=1800, memory=8192, volumes={"/slices": volume})
def slice_metrics(st: str) -> tuple:
    """The same reform on the state's slice."""
    import numpy as np
    from policyengine_core.reforms import Reform
    from policyengine_us import Microsimulation
    from policyengine_us.data import USSingleYearDataset

    path = f"/slices/{POPULACE_REVISION[:8]}/{st}.h5"
    base = Microsimulation(dataset=USSingleYearDataset(file_path=path))
    reform = Microsimulation(
        dataset=USSingleYearDataset(file_path=path),
        reform=Reform.from_dict(CTC_2021_REFORM, country_id="us"),
    )
    n_persons = len(np.array(base.calculate("person_weight", period=VERIFY_YEAR)))
    n_hh = len(np.array(base.calculate("household_weight", period=VERIFY_YEAR)))
    ones_p = np.ones(n_persons, dtype=bool)
    ones_h = np.ones(n_hh, dtype=bool)
    return st, _state_metrics(base, reform, VERIFY_YEAR, ones_p, ones_h)


@app.local_entrypoint()
def verify_vs_national():
    """Compare every slice against the national file, all 51 states.

    Same federal reform (2021 CTC restoration) both ways; every metric must
    agree to float noise. Run after build_slices when bumping the revision.
    """
    national = national_metrics.remote()
    worst = {}
    failures = []
    for st, sl in slice_metrics.map(list(STATE_FIPS)):
        nat = national[st]
        for key in nat:
            a, b = nat[key], sl[key]
            denom = max(abs(a), abs(b), 1e-9)
            rel = abs(a - b) / denom
            if rel > worst.get(key, (0, ""))[0]:
                worst[key] = (rel, st)
            tol = 1e-6 if key in ("population", "transfer_total") else 1e-4
            if rel > tol:
                failures.append(f"{st}.{key}: national={a} slice={b} rel={rel:.2e}")
        print(f"{st}: ok", flush=True)
    print("worst relative differences:")
    for key, (rel, st) in sorted(worst.items()):
        print(f"  {key}: {rel:.2e} ({st})")
    if failures:
        raise SystemExit('MISMATCHES:\n' + '\n'.join(failures))
    print("ALL 51 STATES MATCH")


@app.local_entrypoint()
def main():
    report = build_slices.remote()
    print(f"built {len(report)} slices, "
          f"total {sum(r['mb'] for r in report.values()):.0f}MB")
    for res in verify_slice.map(["ID", "CA", "TX", "NY", "WY"]):
        print("verify:", res)
