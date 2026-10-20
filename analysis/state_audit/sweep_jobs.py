"""Spawn and collect dataset-sweep audit runs on a deployed sweep app.

Long Modal jobs must not depend on a local client (a memory-reaped
``modal run`` client cancels its remote job), so the sweep deploys the audit
app once per policyengine-us pin and spawns one call per state-year:

    # 1. deploy the audit app for a pin (see state_audit_sweep_modal.py)
    AUDIT_PE_US=2.30.1 modal deploy analysis/state_audit/state_audit_sweep_modal.py

    # 2. spawn 51 states x years against a slice set (default years 2024,2026)
    python analysis/state_audit/sweep_jobs.py spawn 2.30.1 766b7c7 o1017_2301
    python analysis/state_audit/sweep_jobs.py spawn 2.30.1 766b7c7 o1017_2301_y25 2025

    # 3. collect (exit 0 = done and written, 3 = still running)
    python analysis/state_audit/sweep_jobs.py collect o1017_2301

Call IDs are kept in ``.sweep_calls/`` (ephemeral, git-ignored). Collected
results go to ``output/state_audit_{label}_{year}_raw.json``.
"""

import json
import os
import sys

import modal

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "output")
CALLS = os.path.join(HERE, ".sweep_calls")
STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI",
          "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
          "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
          "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
          "WV", "WI", "WY"]
YEARS = (2024, 2026)


def spawn(pin, slice_tag, label, years=None):
    yrs = [int(y) for y in years.split(",")] if years else list(YEARS)
    f = modal.Function.from_name(f"cpid-dataset-sweep-{pin.replace('.', '-')}", "audit_state")
    calls = {f"{y}:{st}": f.spawn(st, year=y, slice_tag=slice_tag).object_id
             for y in yrs for st in STATES}
    os.makedirs(CALLS, exist_ok=True)
    with open(os.path.join(CALLS, f"{label}.json"), "w", encoding="utf-8") as fh:
        json.dump(calls, fh, indent=1)
    print(f"spawned {len(calls)} calls for {label} ({slice_tag} @ pe-us {pin})")


def collect(label):
    with open(os.path.join(CALLS, f"{label}.json"), encoding="utf-8") as fh:
        calls = json.load(fh)
    done, pending, failed = {}, [], {}
    for key, cid in calls.items():
        try:
            done[key] = modal.FunctionCall.from_id(cid).get(timeout=0)
        except TimeoutError:
            pending.append(key)
        except Exception as e:
            failed[key] = f"{type(e).__name__}: {str(e)[:200]}"
    errs = [k for k, r in done.items() if r.get("status") != "ok"]
    if pending:
        print(f"RUNNING {label}: done={len(done)} pending={len(pending)} "
              f"failed={len(failed)} state_errors={len(errs)}")
        sys.exit(3)
    for y in sorted({int(k.split(":")[0]) for k in calls}):
        rows = [r for k, r in done.items() if k.startswith(str(y))]
        rows += [{"state": k.split(":")[1], "year": y, "status": "error",
                  "error": f"call failed: {m}"}
                 for k, m in failed.items() if k.startswith(str(y))]
        rows.sort(key=lambda r: r["state"])
        with open(os.path.join(OUT, f"state_audit_{label}_{y}_raw.json"), "w",
                  encoding="utf-8") as fh:
            json.dump(rows, fh, indent=2)
    sample = sorted({done[k].get("error", "")[:140] for k in errs})[:3]
    print(f"DONE {label}: collected={len(done)} failed_calls={len(failed)} "
          f"state_errors={len(errs)} {sample if sample else ''}")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "spawn":
        spawn(*sys.argv[2:6])
    elif cmd == "collect":
        collect(sys.argv[2])
    else:
        sys.exit(f"unknown command {cmd!r}; use spawn or collect")
