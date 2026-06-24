"""Cost-regression sweep — re-score EVERY reform option's budgetary cost on each
policyengine-us version bump and flag costs that moved.

Where `score_reforms.py` validates a representative slice against priors, this
sweeps **all** configurable options (the coverage manifest the dashboard ships)
through the dashboard's own Modal backend, focused on **annual budgetary cost**.
It snapshots the cost of every reform per version, and diffs against the previous
version's snapshot so a version bump that silently changes a reform's cost is
caught.

Intended flow on a version bump:
    1. Bump the policyengine-us pin and redeploy the Modal endpoint.
    2. `python analysis/reform_scores/sweep_reforms.py --label <new-version>`
       (auto-reads the pinned version if --label omitted).
    3. Review SWEEP.md — anything under "Cost changes vs <prev>" is a reform whose
       cost shifted with the bump.

Snapshots live in `sweep/<label>.json` (committed); raw results cache under
`sweep/cache/` (git-ignored). Each dashboard economy run is ~8-15 min, so the
full sweep is a long batch — run it in the background / via the reform-sweep
workflow, not inline.

Usage:
    python sweep_reforms.py [--label X] [--baseline Y] [--only id,..]
                            [--limit N] [--concurrency 6] [--refresh]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from score_reforms import (  # noqa: E402
    DEFAULT_MODAL_URL,
    run_dashboard,
    summarize_dashboard,
)

REPO_ROOT = HERE.parents[1]
MANIFEST_PATH = REPO_ROOT / "frontend" / "__generated__" / "reform-manifest.json"
SWEEP_DIR = HERE / "sweep"
CACHE_DIR = SWEEP_DIR / "cache"

# A cost move beyond either of these (vs the previous snapshot) is flagged.
REL_FLAG = 0.10  # 10% relative
ABS_FLAG = 5_000_000  # or $5M absolute


def pinned_version() -> str:
    txt = (REPO_ROOT / "pyproject.toml").read_text(encoding="utf-8")
    m = re.search(r"policyengine-us==([0-9][0-9.]*)", txt)
    return m.group(1) if m else "unknown"


def deployed_version(modal_url: str) -> str | None:
    """The policyengine-us version the live Modal endpoint actually runs — what
    the dashboard computes with. None if the deploy predates the /healthz field."""
    try:
        import requests

        return requests.get(f"{modal_url}/healthz", timeout=20).json().get("policyengine_us")
    except Exception:  # noqa: BLE001
        return None


def manifest_scenarios() -> list[dict]:
    """Every configurable option with a meaningful (non-empty) reform, from the
    coverage manifest — one scenario per option, scored in its state."""
    if not MANIFEST_PATH.exists():
        sys.exit(f"manifest not found: {MANIFEST_PATH} — run `cd frontend && npm run manifest` first")
    entries = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))["entries"]
    out = {}
    for e in entries:
        if e["kind"] != "single-edited" or not e["reform"]:
            continue
        oid = e["ids"][0]
        out[f"{e['state']}:{oid}"] = {
            "id": f"{e['state']}:{oid}",
            "option_id": oid,
            "state": e["state"],
            "year": e["year"],
            "reform": e["reform"],
            "is_dependent_exemption": oid.endswith("_dependent_exemption"),
        }
    return list(out.values())


def score_cost(scenario: dict, modal_url: str, label: str, refresh: bool) -> dict:
    sid = scenario["id"]
    cache = CACHE_DIR / label / f"{sid.replace(':', '__')}.json"
    t0 = time.time()
    try:
        if cache.exists() and not refresh:
            raw = json.loads(cache.read_text(encoding="utf-8"))
        else:
            raw = run_dashboard(modal_url, scenario)
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps(raw, indent=2), encoding="utf-8")
    except Exception as e:  # noqa: BLE001
        return {"id": sid, "state": scenario["state"], "error": f"{type(e).__name__}: {e}",
                "seconds": round(time.time() - t0)}
    s = summarize_dashboard(raw)
    return {"id": sid, "state": scenario["state"], "annual_cost": s.get("annual_cost"),
            "poverty_child_delta": s.get("poverty_child_delta"),
            "gini_delta": s.get("gini_delta"), "seconds": round(time.time() - t0)}


def fmt_money(x):
    if x is None:
        return "—"
    a = abs(x)
    sign = "-" if x < 0 else ""
    if a >= 1e9:
        return f"{sign}${a/1e9:.2f}B"
    if a >= 1e6:
        return f"{sign}${a/1e6:.1f}M"
    return f"{sign}${a:,.0f}"


def latest_other_snapshot(label: str) -> str | None:
    snaps = sorted(p.stem for p in SWEEP_DIR.glob("*.json") if p.stem != label)
    return snaps[-1] if snaps else None


def write_report(label: str, rows: list[dict], baseline_label: str | None, baseline: dict, banner: str | None = None):
    rows = sorted(rows, key=lambda r: -(abs(r.get("annual_cost") or 0)))
    out = [
        f"# Reform cost sweep — policyengine-us {label}",
        "",
    ]
    if banner:
        out += [f"> {banner}", ""]
    out += [
        f"Annual budgetary cost of every configurable reform option, scored on the "
        f"dashboard's own backend at version **{label}**. {len(rows)} options.",
        "",
    ]
    # Version diff first — the point of a version bump.
    if baseline:
        flags = []
        for r in rows:
            if "error" in r:
                continue
            b = baseline.get(r["id"], {}).get("annual_cost")
            c = r.get("annual_cost")
            if b is None or c is None:
                continue
            d = c - b
            rel = (d / abs(b)) if b else (0 if d == 0 else 1)
            if abs(d) >= ABS_FLAG and abs(rel) >= REL_FLAG:
                flags.append((r["id"], b, c, d, rel))
        out += [f"## Cost changes vs {baseline_label}", ""]
        if flags:
            out += ["| Reform | Prev | Now | Δ | Δ% |", "|---|---|---|---|---|"]
            for sid, b, c, d, rel in sorted(flags, key=lambda x: -abs(x[3])):
                out.append(f"| {sid} | {fmt_money(b)} | {fmt_money(c)} | {fmt_money(d)} | {rel*100:+.0f}% |")
        else:
            out.append(f"No reform cost moved beyond ±{REL_FLAG*100:.0f}% / ±{fmt_money(ABS_FLAG)} vs {baseline_label}. ✓")
        out.append("")

    out += ["## All reforms (by cost)", "",
            "| Reform | State | Annual cost | Δ child pov | Δ Gini |", "|---|---|---|---|---|"]
    for r in rows:
        if "error" in r:
            out.append(f"| {r['id']} | {r['state']} | — | — | — (ERROR: {r['error']}) |")
            continue
        out.append(
            f"| {r['id']} | {r['state']} | {fmt_money(r.get('annual_cost'))} | "
            f"{(r.get('poverty_child_delta') or 0)*100:+.2f}pp | {(r.get('gini_delta') or 0):+.4f} |"
        )
    errs = [r for r in rows if "error" in r]
    out += ["", "## Summary",
            f"{len(rows)} options, {len(errs)} errored. Cost = annual budgetary impact "
            f"(positive = costs money), state-scoped.", ""]
    (HERE / "SWEEP.md").write_text("\n".join(out), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--label", default=None, help="version label (default: pinned policyengine-us)")
    ap.add_argument("--baseline", default=None, help="snapshot label to diff against (default: latest other)")
    ap.add_argument("--only", help="comma-separated reform ids (state:option)")
    ap.add_argument("--limit", type=int, help="score only the first N options (smoke test)")
    ap.add_argument("--concurrency", type=int, default=6)
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--modal-url", default=DEFAULT_MODAL_URL)
    args = ap.parse_args()

    pin = pinned_version()
    deployed = deployed_version(args.modal_url)
    # Label by what the endpoint ACTUALLY runs (that's what was scored), not the
    # repo pin — they differ until the endpoint is redeployed.
    label = args.label or deployed or pin
    banner = None
    if deployed and deployed != pin:
        banner = (f"⚠️ Deployed Modal runs policyengine-us **{deployed}**, but the repo pins "
                  f"**{pin}** — redeploy the endpoint to score the pinned version.")
        print(f"WARNING: deployed Modal {deployed} != pinned {pin}; labeling snapshot '{label}'.", flush=True)
    elif not deployed:
        banner = (f"⚠️ Deployed Modal version unknown (its /healthz predates the version field) — "
                  f"labeled '{label}'; redeploy so future sweeps self-label.")
        print(f"NOTE: deployed Modal version unknown; labeling '{label}'.", flush=True)
    scenarios = manifest_scenarios()
    if args.only:
        wanted = set(args.only.split(","))
        scenarios = [s for s in scenarios if s["id"] in wanted]
    if args.limit:
        scenarios = scenarios[: args.limit]

    print(f"Cost sweep: {len(scenarios)} options at version {label} ({args.concurrency}x)…", flush=True)
    with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        rows = list(ex.map(lambda s: score_cost(s, args.modal_url, label, args.refresh), scenarios))

    # Persist artifacts BEFORE any console printing, so an stdout-encoding issue
    # can never discard the (expensive) results.
    SWEEP_DIR.mkdir(exist_ok=True)
    snapshot = {r["id"]: {k: r.get(k) for k in ("state", "annual_cost", "poverty_child_delta", "gini_delta")}
                for r in rows if "error" not in r}
    (SWEEP_DIR / f"{label}.json").write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    baseline_label = args.baseline or latest_other_snapshot(label)
    baseline = json.loads((SWEEP_DIR / f"{baseline_label}.json").read_text(encoding="utf-8")) if baseline_label and (SWEEP_DIR / f"{baseline_label}.json").exists() else {}
    write_report(label, rows, baseline_label, baseline, banner)

    for r in rows:
        print(f"  {r['id']:34s} {fmt_money(r.get('annual_cost')) if 'error' not in r else 'ERROR':>12s} "
              f"({r.get('seconds','?')}s)", flush=True)
    print(f"\nWrote {HERE / 'SWEEP.md'} and sweep/{label}.json"
          + (f" (diffed vs {baseline_label})" if baseline else " (no baseline to diff)"), flush=True)


if __name__ == "__main__":
    main()
