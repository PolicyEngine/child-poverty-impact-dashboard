"""Reform-option scorecard — validate the DASHBOARD's computed impacts against priors.

This scores each reform option through the **dashboard's own backend** (the Modal
per-state ECPS microsim — the exact numbers users see) and validates the result
against external prior estimates gathered the way `/analyze-policy`'s
`prior-scores-finder` does (`priors.yaml`). It answers: *do the scores our
dashboard produces line up with PolicyEngine's published / think-tank estimates?*

Optionally, a PolicyEngine-API run (`--with-api`) is shown as a same-engine
reference column (api.policyengine.org) for a dashboard-vs-PolicyEngine
consistency check. It sends this job's own Auth0 client-credentials token, so it
needs POLICYENGINE_API_URL, POLICYENGINE_API_AUTH0_DOMAIN,
POLICYENGINE_API_AUTH0_AUDIENCE, POLICYENGINE_API_AUTH0_CLIENT_ID and
POLICYENGINE_API_AUTH0_CLIENT_SECRET (the "Reform scores" workflow passes them in
from the repository's Actions variables and secret; see PublicApiReference).

Pipeline:
1. `npm run score-scenarios` (frontend) -> score-scenarios.json (reform-dicts +
   the state each is evaluated in + scope federal/state).
2. This script -> POST each reform to the dashboard's Modal `/economy` endpoint,
   poll, extract child/overall poverty, cost, Gini.
3. Compare the dashboard's relative child-poverty reduction to the prior band
   (priors.yaml) + direction-aware sanity -> PASS / PASS-WITH-NOTES / INVESTIGATE.
4. Emit REPORT.md + results.json; cache raw results under results_dashboard/.

The dashboard is per-state, so a federal reform is evaluated in a representative
state and compared to the (national) prior's RELATIVE reduction directionally —
dollar costs are state-scoped and not band-checked against national priors.

Usage:
    python score_reforms.py [--only id1,id2] [--with-api] [--refresh]
                            [--offline] [--modal-url URL] [--concurrency 4]
"""

from __future__ import annotations

import argparse
import http.client
import json
import os
import threading
import time
import urllib.error
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from public_api_token import (
    PublicApiSettings,
    PublicApiSettingsError,
    PublicApiTokenError,
    PublicApiTokenProvider,
    call_public_api,
)

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None

HERE = Path(__file__).resolve().parent
SCENARIOS_PATH = HERE / "score-scenarios.json"
PRIORS_PATH = HERE / "priors.yaml"
DASH_DIR = HERE / "results_dashboard"
API_DIR = HERE / "results_api"

DEFAULT_MODAL_URL = os.environ.get(
    "NEXT_PUBLIC_MODAL_CPID_URL", "https://policyengine--cpid-backend-web.modal.run"
)
API_COUNTRY = "us"  # The address is POLICYENGINE_API_URL (see PublicApiReference).
API_BASELINE = 2

TRIVIAL_DOLLARS = 1_000_000
TRIVIAL_POV = 1e-4
WRONG_DIR_POV_SLACK = 5e-4

POLL_INTERVAL_S = 30
MAX_POLLS = 80  # 40 min ceiling


# ---------------------------------------------------------------- dashboard (Modal)
def run_dashboard(modal_url: str, scenario: dict) -> dict:
    """Run the reform through the dashboard's Modal economy endpoint."""
    body = {
        "reform": scenario["reform"],
        "year": scenario["year"],
        "state": scenario["state"],
        "region": "us",
        "dependent_exemption_reform": (
            scenario["reform"] if scenario.get("is_dependent_exemption") else None
        ),
    }
    start = requests.post(f"{modal_url}/economy/start", json=body, timeout=60)
    start.raise_for_status()
    job_id = start.json()["job_id"]
    for _ in range(MAX_POLLS):
        st = requests.get(f"{modal_url}/economy/status/{job_id}", timeout=120).json()
        status = st.get("status")
        if status == "ok":
            return st["result"]
        if status == "error":
            raise RuntimeError(st.get("message", "dashboard economy job failed"))
        time.sleep(POLL_INTERVAL_S)
    raise TimeoutError(f"dashboard job did not finish within {MAX_POLLS * POLL_INTERVAL_S}s")


def summarize_dashboard(raw: dict) -> dict:
    pov = raw.get("poverty", {}) or {}
    fis = raw.get("fiscal", {}) or {}
    dist = raw.get("distributional", {}) or {}
    # The Modal endpoint returns poverty rates as PERCENTAGES (0-100); convert to
    # fractions so display and thresholds match the PolicyEngine-API convention.
    def _frac(x):
        return (x / 100.0) if x is not None else None
    cb, cr = _frac(pov.get("child_baseline_rate")), _frac(pov.get("child_reform_rate"))
    ob, orr = _frac(pov.get("overall_baseline_rate")), _frac(pov.get("overall_reform_rate"))
    bud = fis.get("total_budgetary_impact")
    s = {
        "annual_cost": (-bud) if bud is not None else None,  # negative impact = cost
        "poverty_child_baseline": cb,
        "poverty_child_reform": cr,
        "poverty_child_delta": (cr - cb) if (cb is not None and cr is not None) else None,
        "poverty_all_baseline": ob,
        "poverty_all_reform": orr,
        "poverty_all_delta": (orr - ob) if (ob is not None and orr is not None) else None,
        "children_lifted": pov.get("children_lifted"),
        "gini_delta": dist.get("gini_change"),
    }
    cd = s["poverty_child_delta"]
    s["child_poverty_rel_reduction"] = (-cd / cb) if (cb and cd is not None and cb > 0) else None
    return s


# ---------------------------------------------------------------- PolicyEngine API (optional reference)
def to_policy(reform: dict, year: int) -> dict:
    span = f"{year}-01-01.2100-12-31"
    return {p: {span: v} for p, v in reform.items()}


def run_api(tokens: PublicApiTokenProvider, scenario: dict) -> dict:
    policy_answer = call_public_api(
        tokens,
        "POST",
        f"/{API_COUNTRY}/policy",
        {"data": to_policy(scenario["reform"], scenario["year"])},
        timeout_seconds=60,
    )
    pid = policy_answer["result"]["policy_id"]
    # The Public API chooses the dataset itself and refuses unknown query parameters.
    query = urllib.parse.urlencode({"region": scenario["region"], "time_period": str(scenario["year"])})
    path = f"/{API_COUNTRY}/economy/{pid}/over/{API_BASELINE}?{query}"
    for _ in range(MAX_POLLS):
        body = read_economy(tokens, path)
        if body.get("status") == "ok":
            return body["result"]
        if body.get("status") == "error":
            raise RuntimeError(body.get("message", "api economy job failed"))
        time.sleep(POLL_INTERVAL_S)
    raise TimeoutError("api job timed out")


def read_economy(tokens: PublicApiTokenProvider, path: str) -> dict:
    """One read of the economy comparison.

    The Public API answers a failed comparison with an error status (502) whose JSON
    body has ``status: "error"`` and a message. Any error answer with that body, except
    a 401, is returned like any other, so its message reaches the scorecard as it did
    with the earlier ``requests`` code (a 503 "Authentication is unavailable" too). A
    401 and any other error status are raised.
    """
    try:
        return call_public_api(tokens, "GET", path, timeout_seconds=120)
    except urllib.error.HTTPError as error:
        if error.code == 401:
            raise
        try:
            answer = json.loads(error.read())
        except ValueError:
            answer = None
        if isinstance(answer, dict) and answer.get("status") == "error":
            return answer
        raise


class PublicApiReference:
    """Runs scenarios on the Public API with one Auth0 token for the whole run.

    The settings are read, and the token requested, when the first scenario needs the
    Public API, so a run answered entirely from cache sends nothing. The token is then
    reused for every request (tokens last 24 hours; a run lasts at most 90 minutes).

    After a missing setting, a failed token request or a 401 from the Public API, no
    new token is requested, and every scenario that reaches the Public API afterwards
    fails with the same reason without sending anything: a new token would be refused
    too, and Auth0 counts every token it issues. A scenario already sending its own
    request in another thread may still get one more answer (``--concurrency``). The
    reasons never include the client secret: they name missing variables, an HTTP
    status, Auth0's error code, urllib's error text or an exception type.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._tokens: PublicApiTokenProvider | None = None
        self._stop_reason: str | None = None

    def run(self, scenario: dict) -> dict:
        tokens = self._token_provider()
        try:
            return run_api(tokens, scenario)
        except PublicApiTokenError as error:
            self._stop(f"Public API reference column stopped: {error}")
            raise
        except urllib.error.HTTPError as error:
            if error.code == 401:
                self._stop(
                    "Public API reference column stopped: the Public API refused this"
                    " job's credential (HTTP 401). Check that the client is on its allow"
                    " list and that the Auth0 domain and audience are its production ones."
                )
            raise

    def _token_provider(self) -> PublicApiTokenProvider:
        with self._lock:
            if self._tokens is None and self._stop_reason is None:
                try:
                    tokens = PublicApiTokenProvider(PublicApiSettings.from_environment())
                    tokens.access_token()
                except (PublicApiSettingsError, PublicApiTokenError) as error:
                    self._stop_locked(f"Public API reference column skipped: {error}")
                except (OSError, http.client.HTTPException) as error:
                    # The template converts urllib's errors and timeouts, but not the
                    # OSError or http.client.HTTPException raised while reading the
                    # answer, for example when Auth0 drops the connection first. Only
                    # the exception's type is recorded.
                    self._stop_locked(
                        "Public API reference column skipped: the Auth0 token request"
                        f" failed ({type(error).__name__})"
                    )
                else:
                    self._tokens = tokens
            if self._stop_reason is not None:
                raise RuntimeError(self._stop_reason)
            return self._tokens

    def _stop(self, reason: str) -> None:
        with self._lock:
            self._stop_locked(reason)

    def _stop_locked(self, reason: str) -> None:
        if self._stop_reason is None:
            self._stop_reason = reason
            print(reason, flush=True)


def summarize_api(raw: dict) -> dict:
    pov = (raw.get("poverty", {}) or {}).get("poverty", {}) or {}
    child = pov.get("child") or {}
    cb, cr = child.get("baseline"), child.get("reform")
    cd = (cr - cb) if (cb is not None and cr is not None) else None
    return {"child_poverty_rel_reduction": (-cd / cb) if (cb and cd is not None and cb > 0) else None,
            "poverty_child_baseline": cb, "poverty_child_reform": cr}


# ---------------------------------------------------------------- scoring + verdict
def _cached(path: Path, runner, scenario, refresh, offline):
    if path.exists() and not refresh:
        return json.loads(path.read_text(encoding="utf-8")), None
    if offline:
        return None, "no cached result and --offline set"
    try:
        raw = runner(scenario)
    except Exception as e:  # noqa: BLE001
        return None, f"{type(e).__name__}: {e}"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(raw, indent=2), encoding="utf-8")
    return raw, None


def score_one(scenario, args, public_api: PublicApiReference | None = None) -> dict:
    sid = scenario["id"]
    t0 = time.time()
    raw, err = _cached(DASH_DIR / f"{sid}.json", lambda s: run_dashboard(args.modal_url, s), scenario, args.refresh, args.offline)
    out = {"id": sid, "seconds": round(time.time() - t0)}
    if err:
        out["error"] = err
        return out
    out["dashboard"] = summarize_dashboard(raw)
    if public_api is not None:
        api_raw, api_err = _cached(API_DIR / f"{sid}.json", public_api.run, scenario, args.refresh, args.offline)
        out["api"] = summarize_api(api_raw) if api_raw else {"error": api_err}
    return out


def verdict(scenario, res, priors) -> tuple[str, str]:
    if "error" in res:
        return "ERROR", res["error"]
    d = res["dashboard"]
    cost, pov, cpd = d.get("annual_cost"), d.get("poverty_all_delta"), d.get("poverty_child_delta")
    if cost is None or pov is None:
        return "INVESTIGATE", "dashboard result missing budget/poverty fields"
    direction = scenario.get("direction", "expansion")

    if abs(cost) < TRIVIAL_DOLLARS and abs(pov) < TRIVIAL_POV:
        return "INVESTIGATE", "dashboard shows no measurable budget or poverty effect (possible dead option)"
    if direction == "expansion":
        if cost <= 0:
            return "INVESTIGATE", f"expansion but dashboard cost is not positive ({cost:,.0f})"
        if pov > WRONG_DIR_POV_SLACK:
            return "INVESTIGATE", f"expansion but dashboard poverty rises (Δ all={pov:+.4f})"
    else:
        if cost >= 0:
            return "INVESTIGATE", f"repeal but dashboard does not raise revenue ({cost:,.0f})"
        if pov < -WRONG_DIR_POV_SLACK:
            return "INVESTIGATE", f"repeal but dashboard poverty falls (Δ all={pov:+.4f})"

    dash_rr = d.get("child_poverty_rel_reduction")
    prior = (priors or {}).get(scenario["id"])
    pband = prior.get("child_poverty_rel_reduction") if prior else None

    def prior_note():
        if not pband or dash_rr is None:
            return ""
        lo, hi = (float(x) for x in pband)
        if lo <= dash_rr <= hi:
            return f"; within national prior {lo:.0%}–{hi:.0%}"
        geo = " (geography: single state vs national prior)" if scenario.get("scope") == "federal" else ""
        return f"; national prior {lo:.0%}–{hi:.0%}{geo}"

    # Primary signal when available: does the dashboard agree with PolicyEngine's
    # API at the SAME geography? That isolates "is our calc right?" from the
    # geography gap to a national prior.
    api = res.get("api") or {}
    api_rr = api.get("child_poverty_rel_reduction") if "error" not in api else None
    if api_rr is not None and dash_rr is not None:
        tol = max(0.03, 0.25 * abs(api_rr))
        if abs(dash_rr - api_rr) <= tol:
            return "PASS", f"dashboard {dash_rr:.0%} matches PolicyEngine API {api_rr:.0%} at {scenario['state']}" + prior_note()
        return "INVESTIGATE", f"dashboard {dash_rr:.0%} diverges from PolicyEngine API {api_rr:.0%} at same geography (Δ {abs(dash_rr-api_rr)*100:.1f}pp)"

    # No API reference — fall back to prior band (directional for federal) or sanity.
    if pband and dash_rr is not None:
        lo, hi = (float(x) for x in pband)
        geo = " (directional — national prior vs single-state dashboard)" if scenario.get("scope") == "federal" else ""
        if lo <= dash_rr <= hi:
            return "PASS", f"dashboard child-poverty reduction {dash_rr:.0%} within prior {lo:.0%}–{hi:.0%}{geo}"
        return "PASS-WITH-NOTES", f"dashboard child-poverty reduction {dash_rr:.0%} outside prior {lo:.0%}–{hi:.0%}{geo}"

    small = abs(pov) < WRONG_DIR_POV_SLACK
    return ("PASS-WITH-NOTES" if small else "PASS"), (
        "dashboard sign correct; small overall-poverty effect (no published prior)"
        if small else "dashboard sign correct (sanity only; no published prior)"
    )


# ---------------------------------------------------------------- report
def fmt_pct(x):
    return "—" if x is None else f"{x*100:.2f}%"


def fmt_money(x):
    if x is None:
        return "—"
    a = abs(x)
    sign = "−" if x < 0 else ""
    if a >= 1e9:
        return f"{sign}${a/1e9:.1f}B"
    if a >= 1e6:
        return f"{sign}${a/1e6:.1f}M"
    return f"{sign}${a:,.0f}"


def rel_txt(rr):
    return "—" if rr is None else f"{-rr:+.0%}"  # signed change (negative = poverty fell)


def write_report(rows, priors, with_api):
    out = [
        "# Reform-option scorecard",
        "",
        "Validates the **dashboard's own computed scores** (Modal per-state ECPS microsim —",
        "the numbers users see) against external prior estimates gathered the way",
        "`/analyze-policy`'s `prior-scores-finder` does (`priors.yaml`). Regenerate with:",
        "",
        "```bash",
        "cd frontend && npm run score-scenarios && cd ..",
        "python analysis/reform_scores/score_reforms.py            # dashboard vs priors",
        "python analysis/reform_scores/score_reforms.py --with-api  # + PolicyEngine-API reference",
        "```",
        "",
        "Cost = annual budgetary impact (positive = costs money), state-scoped.",
        "Federal reforms are evaluated in one state, so their prior check is directional",
        "(relative child-poverty reduction vs the national estimate). See Caveats.",
        "",
    ]
    header = "| Scenario | State | Scope | Dashboard cost | Dashboard child pov | Δ rel |"
    sep = "|---|---|---|---|---|---|"
    if with_api:
        header += " API child pov Δ rel |"
        sep += "---|"
    header += " Prior (rel reduction) | Verdict | Note |"
    sep += "---|---|---|"
    out += [header, sep]
    for r in rows:
        res = r["res"]
        prior = (priors or {}).get(r["id"]) or {}
        pband = prior.get("child_poverty_rel_reduction")
        pband_txt = f"{pband[0]*100:.0f}–{pband[1]*100:.0f}%↓" if pband else "—"
        if "error" in res:
            cells = [r["label"], r["state"], r["scope"], "—", "—", "—"]
            if with_api:
                cells.append("—")
            cells += [pband_txt, "**ERROR**", res["error"]]
            out.append("| " + " | ".join(cells) + " |")
            continue
        d = res["dashboard"]
        cells = [
            r["label"], r["state"], r["scope"], fmt_money(d.get("annual_cost")),
            f"{fmt_pct(d.get('poverty_child_baseline'))}→{fmt_pct(d.get('poverty_child_reform'))}",
            rel_txt(d.get("child_poverty_rel_reduction")),
        ]
        if with_api:
            api = res.get("api") or {}
            cells.append(rel_txt(api.get("child_poverty_rel_reduction")) if "error" not in api else "err")
        cells += [pband_txt, f"**{r['verdict']}**", r["note"]]
        out.append("| " + " | ".join(cells) + " |")

    counts = {}
    for r in rows:
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1
    out += [
        "",
        "## Summary",
        ", ".join(f"{k}: {v}" for k, v in sorted(counts.items())) or "(none)",
        "",
        "## Caveats",
        "- The dashboard is **per-state**: a federal reform is evaluated in one state, so its",
        "  prior comparison is a *directional* check of the relative child-poverty reduction,",
        "  not the national dollar cost.",
        "- State EITC/CTC tweaks have no published prior — validated by direction-aware sanity",
        "  rules (and, with `--with-api`, dashboard-vs-PolicyEngine-API consistency).",
        "- INVESTIGATE = the dashboard's score looks implausible (wrong sign, no effect, or far",
        "  from a prior); deep-dive with `/analyze-policy \"<reform>\"`.",
        "",
    ]
    (HERE / "REPORT.md").write_text("\n".join(out), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--with-api", action="store_true", help="also run a PolicyEngine-API reference column")
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--modal-url", default=DEFAULT_MODAL_URL)
    ap.add_argument("--concurrency", type=int, default=4)
    args = ap.parse_args()

    scenarios = json.loads(SCENARIOS_PATH.read_text(encoding="utf-8"))["scenarios"]
    if args.only:
        wanted = set(args.only.split(","))
        scenarios = [s for s in scenarios if s["id"] in wanted]
    priors = {}
    if PRIORS_PATH.exists() and yaml is not None:
        priors = yaml.safe_load(PRIORS_PATH.read_text(encoding="utf-8")) or {}

    public_api = PublicApiReference() if args.with_api else None
    print(f"Scoring {len(scenarios)} scenario(s) on the dashboard backend "
          f"({'+API ' if args.with_api else ''}{args.concurrency}x)…", flush=True)
    with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        results = list(ex.map(lambda s: score_one(s, args, public_api), scenarios))
    by_id = {r["id"]: r for r in results}

    rows = []
    for s in scenarios:
        res = by_id[s["id"]]
        v, note = verdict(s, res, priors)
        rows.append({"id": s["id"], "label": s["label"], "state": s["state"],
                     "scope": s["scope"], "res": res, "verdict": v, "note": note})
        print(f"  [{v:16s}] {s['id']} — {note} ({res.get('seconds','?')}s)", flush=True)

    (HERE / "results.json").write_text(json.dumps({"rows": rows}, indent=2), encoding="utf-8")
    write_report(rows, priors, args.with_api)
    print(f"\nWrote {HERE / 'REPORT.md'}", flush=True)


if __name__ == "__main__":
    main()
