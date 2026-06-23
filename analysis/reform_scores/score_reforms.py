"""Reform-option scorecard — validate dashboard option impacts via the PolicyEngine API.

Applies the methodology of Pavel's `/analyze-policy` command (its `microsim-runner`
agent) to the dashboard's own reform options: for each scenario in
``score-scenarios.json`` (emitted by ``npm run score-scenarios``), POST the
reform to ``api.policyengine.org``, run an economy-wide simulation over the
current-law baseline for the scenario's region, and collect budgetary, poverty,
inequality, and distributional impacts. Each result is then validated against a
curated prior anchor (``anchors.yaml``) or, lacking one, direction-aware sanity
rules, yielding a PASS / PASS-WITH-NOTES / INVESTIGATE verdict — mirroring
`reform-comparator`.

Output: ``REPORT.md`` (scannable table) + ``results.json`` (machine-readable) +
``results/<id>.json`` (full raw API result per scenario, cached).

This is an offline validation artifact, NOT a per-PR gate: each economy run is
~7 min (federal) to ~20 min (state). Run on demand / on a schedule.

Caveat: the API scores on the national Enhanced CPS filtered by ``region``,
whereas the dashboard ships per-state ECPS via Modal — absolute numbers can
differ. This is a standardized external check of sign/magnitude and agreement
with PolicyEngine priors, not a reproduction of the dashboard's exact figures.

Usage:
    python score_reforms.py [--only id1,id2] [--year 2026] [--concurrency 4]
                            [--refresh] [--offline] [--base-url URL] [--baseline 2]
"""

from __future__ import annotations

import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

try:
    import yaml
except ImportError:  # pragma: no cover - anchors are optional
    yaml = None

HERE = Path(__file__).resolve().parent
SCENARIOS_PATH = HERE / "score-scenarios.json"
ANCHORS_PATH = HERE / "anchors.yaml"
RESULTS_DIR = HERE / "results"

DEFAULT_BASE_URL = "https://api.policyengine.org/us"
DEFAULT_BASELINE = 2  # US current-law policy id
DATASET = "enhanced_cps_2024"

# Sanity thresholds.
TRIVIAL_DOLLARS = 1_000_000  # annual budgetary impact below this magnitude ≈ no effect
TRIVIAL_POV = 1e-4  # 0.01pp poverty change below this ≈ no effect
WRONG_DIR_POV_SLACK = 5e-4  # allow tiny wrong-direction wiggle from microsim noise

POLL_INTERVAL_S = 30
MAX_POLLS = 80  # 80 * 30s = 40 min ceiling per scenario (state runs ~20 min)


def to_policy(reform: dict, year: int) -> dict:
    """Flat dashboard reform-dict -> PolicyEngine API policy data (date-ranged)."""
    span = f"{year}-01-01.2100-12-31"
    out = {}
    for path, value in reform.items():
        out[path] = {span: value}
    return out


def _delta(node: dict | None):
    if not node:
        return None, None, None
    b, r = node.get("baseline"), node.get("reform")
    d = (r - b) if (b is not None and r is not None) else None
    return b, r, d


def summarize(result: dict) -> dict:
    """Pull the headline metrics out of the raw API economy result."""
    budget = result.get("budget", {}) or {}
    pov = (result.get("poverty", {}) or {}).get("poverty", {}) or {}
    deep = (result.get("poverty", {}) or {}).get("deep_poverty", {}) or {}
    ineq = result.get("inequality", {}) or {}

    budgetary_impact = budget.get("budgetary_impact")
    s = {
        # budgetary_impact is NEGATIVE for a cost (revenue loss); flip to a cost.
        "annual_cost": (-budgetary_impact) if budgetary_impact is not None else None,
        "budgetary_impact": budgetary_impact,
        "tax_revenue_impact": budget.get("tax_revenue_impact"),
        "state_tax_revenue_impact": budget.get("state_tax_revenue_impact"),
        "benefit_spending_impact": budget.get("benefit_spending_impact"),
    }
    for grp in ("all", "child", "adult", "senior"):
        b, r, d = _delta(pov.get(grp))
        s[f"poverty_{grp}_baseline"], s[f"poverty_{grp}_reform"], s[f"poverty_{grp}_delta"] = b, r, d
    _, _, s["deep_poverty_child_delta"] = _delta(deep.get("child"))
    gb, gr, gd = _delta(ineq.get("gini"))
    s["gini_baseline"], s["gini_reform"], s["gini_delta"] = gb, gr, gd
    _, _, s["top_1_pct_share_delta"] = _delta(ineq.get("top_1_pct_share"))
    # Relative child-poverty reduction (positive = poverty fell).
    cb, cd = s.get("poverty_child_baseline"), s.get("poverty_child_delta")
    s["child_poverty_rel_reduction"] = (-cd / cb) if (cb and cd is not None and cb > 0) else None
    return s


def run_economy(base_url: str, baseline: int, scenario: dict, year: int) -> dict:
    """Create the policy and run the economy simulation; return the raw result."""
    policy_resp = requests.post(
        f"{base_url}/policy", json={"data": to_policy(scenario["reform"], year)}, timeout=60
    )
    policy_resp.raise_for_status()
    policy_id = policy_resp.json()["result"]["policy_id"]
    url = f"{base_url}/economy/{policy_id}/over/{baseline}"
    params = {"region": scenario["region"], "time_period": str(year), "dataset": DATASET}
    for _ in range(MAX_POLLS):
        g = requests.get(url, params=params, timeout=120)
        body = g.json()
        status = body.get("status")
        if status == "ok":
            res = body["result"]
            res["_policy_id"] = policy_id
            return res
        if status == "error":
            raise RuntimeError(body.get("message", "economy job failed"))
        time.sleep(POLL_INTERVAL_S)
    raise TimeoutError(f"economy job did not finish within {MAX_POLLS * POLL_INTERVAL_S}s")


def score_one(scenario: dict, args) -> dict:
    sid = scenario["id"]
    cache = RESULTS_DIR / f"{sid}.json"
    t0 = time.time()
    if cache.exists() and not args.refresh:
        raw = json.loads(cache.read_text(encoding="utf-8"))
    elif args.offline:
        return {"id": sid, "error": "no cached result and --offline set"}
    else:
        try:
            raw = run_economy(args.base_url, args.baseline, scenario, scenario.get("year", args.year))
        except Exception as e:  # noqa: BLE001 - record and continue
            return {"id": sid, "error": f"{type(e).__name__}: {e}", "seconds": round(time.time() - t0)}
        RESULTS_DIR.mkdir(exist_ok=True)
        cache.write_text(json.dumps(raw, indent=2), encoding="utf-8")
    s = summarize(raw)
    s.update({"id": sid, "seconds": round(time.time() - t0)})
    return s


def verdict(scenario: dict, s: dict, anchors: dict) -> tuple[str, str]:
    """direction-aware sanity + optional anchor comparison -> (verdict, note)."""
    if "error" in s:
        return "ERROR", s["error"]
    cost = s.get("annual_cost")
    # Judge sign on OVERALL poverty so childless-targeted reforms (e.g. a
    # childless EITC) aren't false-flagged for a ~0 child-poverty effect.
    pov = s.get("poverty_all_delta")
    if cost is None or pov is None:
        return "INVESTIGATE", "missing budget/poverty fields in API result"
    direction = scenario.get("direction", "expansion")

    trivial = abs(s.get("budgetary_impact") or 0) < TRIVIAL_DOLLARS and abs(pov) < TRIVIAL_POV
    if trivial:
        return "INVESTIGATE", "no measurable budget or poverty effect (possible dead option)"

    if direction == "expansion":
        if cost <= 0:
            return "INVESTIGATE", f"expansion but does not cost money (annual_cost={cost:,.0f})"
        if pov > WRONG_DIR_POV_SLACK:
            return "INVESTIGATE", f"expansion but poverty rises (Δ all={pov:+.4f})"
    else:  # repeal
        if cost >= 0:
            return "INVESTIGATE", f"repeal but does not raise revenue (annual_cost={cost:,.0f})"
        if pov < -WRONG_DIR_POV_SLACK:
            return "INVESTIGATE", f"repeal but poverty falls (Δ all={pov:+.4f})"

    anchor = (anchors or {}).get(scenario["id"])
    if anchor:
        notes = []
        v = "PASS"
        rr = s.get("child_poverty_rel_reduction")
        band = anchor.get("child_poverty_rel_reduction")
        if band and rr is not None:
            lo, hi = float(band[0]), float(band[1])
            if not (lo <= rr <= hi):
                v = "PASS-WITH-NOTES"
                notes.append(f"child-poverty reduction {rr:.0%} outside prior band {lo:.0%}–{hi:.0%}")
        cband = anchor.get("annual_cost")
        if cband and cost is not None:
            lo, hi = float(cband[0]), float(cband[1])
            if not (lo <= cost <= hi):
                v = "PASS-WITH-NOTES"
                notes.append(f"annual cost ${cost/1e9:.1f}B outside prior band ${lo/1e9:.0f}–${hi/1e9:.0f}B")
        return v, "; ".join(notes) or f"matches prior anchor ({anchor.get('source','')})".strip()

    # Sign correct, non-trivial, no anchor.
    small = abs(pov) < WRONG_DIR_POV_SLACK
    return ("PASS-WITH-NOTES" if small else "PASS"), (
        "sign correct; small overall-poverty effect (no prior anchor)" if small else "sign correct (sanity only; no prior anchor)"
    )


def fmt_pct(x):
    return "—" if x is None else f"{x*100:.2f}%"


def fmt_money(x):
    if x is None:
        return "—"
    a = abs(x)
    if a >= 1e9:
        return f"${x/1e9:.1f}B"
    if a >= 1e6:
        return f"${x/1e6:.1f}M"
    return f"${x:,.0f}"


def write_report(rows: list[dict], year: int) -> None:
    lines = [
        "# Reform-option scorecard",
        "",
        "Standardized validation of the dashboard's reform options via the PolicyEngine API",
        "(the `/analyze-policy` `microsim-runner` methodology). Regenerate with:",
        "",
        "```bash",
        "cd frontend && npm run score-scenarios && cd ..",
        "python analysis/reform_scores/score_reforms.py",
        "```",
        "",
        f"Year: **{year}**. Cost = annual budgetary impact (positive = costs money).",
        "Baselines are the national Enhanced CPS filtered by region — see Caveats.",
        "",
        "| Scenario | Region | Dir | Annual cost | Child pov | Δ child | Δ all pov | Δ Gini | Verdict | Note |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        s = r["summary"]
        if "error" in s:
            lines.append(f"| {r['label']} | {r['region']} | {r['direction']} | — | — | — | — | — | **ERROR** | {s['error']} |")
            continue
        cpr = s.get("child_poverty_rel_reduction")
        # Show signed relative CHANGE (negative = poverty fell), not the reduction.
        cpr_txt = f" ({-cpr:+.0%})" if cpr is not None else ""
        lines.append(
            f"| {r['label']} | {r['region']} | {r['direction']} | {fmt_money(s.get('annual_cost'))} | "
            f"{fmt_pct(s.get('poverty_child_baseline'))}→{fmt_pct(s.get('poverty_child_reform'))}{cpr_txt} | "
            f"{(s.get('poverty_child_delta') or 0)*100:+.2f}pp | {(s.get('poverty_all_delta') or 0)*100:+.2f}pp | "
            f"{(s.get('gini_delta') or 0):+.4f} | **{r['verdict']}** | {r['note']} |"
        )
    counts: dict[str, int] = {}
    for r in rows:
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1
    lines += [
        "",
        "## Summary",
        ", ".join(f"{k}: {v}" for k, v in sorted(counts.items())) or "(none)",
        "",
        "## Caveats",
        "- API uses the national Enhanced CPS filtered by `region`; the dashboard ships per-state",
        "  ECPS via Modal, so absolute figures can differ. This validates sign/magnitude and",
        "  agreement with PolicyEngine priors, not the dashboard's exact numbers.",
        "- Single-year (static) analysis; cost is annual, not 10-year.",
        "- INVESTIGATE means the score looks implausible (wrong sign, no effect, or far from a",
        "  prior) and warrants a `/analyze-policy` deep-dive — not necessarily a bug.",
        "",
    ]
    (HERE / "REPORT.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="comma-separated scenario ids to run")
    ap.add_argument("--year", type=int, default=2026)
    ap.add_argument("--concurrency", type=int, default=4)
    ap.add_argument("--refresh", action="store_true", help="ignore cached results")
    ap.add_argument("--offline", action="store_true", help="use only cached results")
    ap.add_argument("--base-url", default=DEFAULT_BASE_URL)
    ap.add_argument("--baseline", type=int, default=DEFAULT_BASELINE)
    args = ap.parse_args()

    data = json.loads(SCENARIOS_PATH.read_text(encoding="utf-8"))
    scenarios = data["scenarios"]
    if args.only:
        wanted = set(args.only.split(","))
        scenarios = [s for s in scenarios if s["id"] in wanted]
    anchors = {}
    if ANCHORS_PATH.exists() and yaml is not None:
        anchors = yaml.safe_load(ANCHORS_PATH.read_text(encoding="utf-8")) or {}

    print(f"Scoring {len(scenarios)} scenario(s) at {args.concurrency}x concurrency…", flush=True)
    with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        summaries = list(ex.map(lambda sc: score_one(sc, args), scenarios))
    by_id = {s["id"]: s for s in summaries}

    rows = []
    for sc in scenarios:
        s = by_id[sc["id"]]
        v, note = verdict(sc, s, anchors)
        rows.append({"id": sc["id"], "label": sc["label"], "region": sc["region"],
                     "direction": sc["direction"], "summary": s, "verdict": v, "note": note})
        print(f"  [{v:16s}] {sc['id']} — {note} ({s.get('seconds','?')}s)", flush=True)

    (HERE / "results.json").write_text(
        json.dumps({"year": args.year, "rows": rows}, indent=2), encoding="utf-8"
    )
    write_report(rows, args.year)
    print(f"\nWrote {HERE / 'REPORT.md'}", flush=True)


if __name__ == "__main__":
    main()
