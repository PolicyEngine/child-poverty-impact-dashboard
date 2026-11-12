"""The reform scorecard's Public API reference column sends the workflow's own credential.

``score_reforms.py --with-api`` calls the Public API (``POST /us/policy``, then
``GET /us/economy/<id>/over/2``). These tests run the script's ``main()`` with
every HTTP request answered by ``FakeNetwork``, so nothing leaves the machine:
``requests`` (the dashboard's Modal backend) and urllib (Auth0 and the Public
API) are both replaced.
"""

from __future__ import annotations

import io
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "analysis" / "reform_scores"))

import score_reforms  # noqa: E402

AUTH0_DOMAIN = "policyengine-api.uk.auth0.com"
TOKEN_URL = f"https://{AUTH0_DOMAIN}/oauth/token"
AUDIENCE = "https://api.policyengine.org/"
PUBLIC_API_URL = "https://api.policyengine.org"
CLIENT_ID = "reform-scores-client-id"
CLIENT_SECRET = "reform-scores-client-secret-must-not-appear"
ACCESS_TOKEN = "access-token-from-auth0"
MODAL_URL = "https://modal.example.test"
POLICY_ID = 4321

SETTING_VALUES = {
    "POLICYENGINE_API_URL": PUBLIC_API_URL,
    "POLICYENGINE_API_AUTH0_DOMAIN": AUTH0_DOMAIN,
    "POLICYENGINE_API_AUTH0_AUDIENCE": AUDIENCE,
    "POLICYENGINE_API_AUTH0_CLIENT_ID": CLIENT_ID,
    "POLICYENGINE_API_AUTH0_CLIENT_SECRET": CLIENT_SECRET,
}

DASHBOARD_RESULT = {
    "poverty": {
        "child_baseline_rate": 10.0,
        "child_reform_rate": 8.0,
        "overall_baseline_rate": 12.0,
        "overall_reform_rate": 11.0,
        "children_lifted": 1000,
    },
    "fiscal": {"total_budgetary_impact": -5e9},
    "distributional": {"gini_change": -0.01},
}
PUBLIC_API_RESULT = {"poverty": {"poverty": {"child": {"baseline": 0.1, "reform": 0.08}}}}


@dataclass
class RecordedRequest:
    method: str
    url: str
    headers: dict[str, str]
    body: Any
    timeout: float | None

    def header(self, name: str) -> str | None:
        for header_name, value in self.headers.items():
            if header_name.lower() == name.lower():
                return value
        return None


@dataclass
class FakeAnswer:
    status_code: int
    body: Any

    def encoded_body(self) -> bytes:
        return json.dumps(self.body).encode()


class FakeRequestsResponse:
    """What ``score_reforms`` reads from a ``requests`` response."""

    def __init__(self, answer: FakeAnswer) -> None:
        self.status_code = answer.status_code
        self.ok = answer.status_code < 400
        self._body = answer.body

    def json(self) -> Any:
        return self._body

    def raise_for_status(self) -> None:
        if not self.ok:
            raise RuntimeError(f"HTTP {self.status_code}")


class FakeUrllibResponse(io.BytesIO):
    """A urllib response: a context manager whose ``read()`` gives the body."""

    def __init__(self, answer: FakeAnswer) -> None:
        super().__init__(answer.encoded_body())
        self.status = answer.status_code


@dataclass
class FakeNetwork:
    """Answers every request the script sends, and records each one."""

    token_answer: FakeAnswer = field(
        default_factory=lambda: FakeAnswer(
            200, {"access_token": ACCESS_TOKEN, "expires_in": 86400, "token_type": "Bearer"}
        )
    )
    policy_answer: FakeAnswer = field(
        default_factory=lambda: FakeAnswer(200, {"status": "ok", "result": {"policy_id": POLICY_ID}})
    )
    economy_answer: FakeAnswer = field(
        default_factory=lambda: FakeAnswer(200, {"status": "ok", "result": PUBLIC_API_RESULT})
    )
    # Raised for the token request after it is recorded, as when Auth0 drops the
    # connection before answering (http.client raises it unconverted from getresponse).
    token_connection_error: Exception | None = None
    requests_sent: list[RecordedRequest] = field(default_factory=list)

    def answer(self, request: RecordedRequest) -> FakeAnswer:
        self.requests_sent.append(request)
        parsed = urllib.parse.urlsplit(request.url)
        if request.url.startswith(MODAL_URL):
            if parsed.path == "/economy/start":
                return FakeAnswer(200, {"job_id": "dashboard-job"})
            if parsed.path == "/economy/status/dashboard-job":
                return FakeAnswer(200, {"status": "ok", "result": DASHBOARD_RESULT})
        if request.url == TOKEN_URL and request.method == "POST":
            return self.token_answer
        if parsed.path == "/us/policy" and request.method == "POST":
            return self.policy_answer
        if parsed.path == f"/us/economy/{POLICY_ID}/over/2" and request.method == "GET":
            return self.economy_answer
        raise AssertionError(f"Unexpected request: {request.method} {request.url}")

    # requests, as score_reforms calls it: requests.post(url, json=..., timeout=...)
    def requests_post(self, url: str, json: Any = None, headers: Any = None, timeout: Any = None, **_: Any):
        recorded = RecordedRequest("POST", url, dict(headers or {}), json, timeout)
        return FakeRequestsResponse(self.answer(recorded))

    def requests_get(self, url: str, params: Any = None, headers: Any = None, timeout: Any = None, **_: Any):
        if params:
            url = f"{url}?{urllib.parse.urlencode(params)}"
        recorded = RecordedRequest("GET", url, dict(headers or {}), None, timeout)
        return FakeRequestsResponse(self.answer(recorded))

    # urllib, as OpenerDirector.open(request, timeout=...) is called
    def urllib_open(self, opener: Any, request: Any, data: Any = None, timeout: Any = None):
        if isinstance(request, str):
            request = urllib.request.Request(request, data=data)
        body = json.loads(request.data) if request.data else None
        recorded = RecordedRequest(
            request.get_method(), request.full_url, dict(request.header_items()), body, timeout
        )
        answer = self.answer(recorded)
        if recorded.url == TOKEN_URL and self.token_connection_error is not None:
            raise self.token_connection_error
        if answer.status_code >= 300:
            raise urllib.error.HTTPError(
                request.full_url, answer.status_code, "error", {}, io.BytesIO(answer.encoded_body())
            )
        return FakeUrllibResponse(answer)

    @property
    def token_requests(self) -> list[RecordedRequest]:
        return [request for request in self.requests_sent if request.url == TOKEN_URL]

    @property
    def modal_requests(self) -> list[RecordedRequest]:
        return [request for request in self.requests_sent if request.url.startswith(MODAL_URL)]

    @property
    def public_api_requests(self) -> list[RecordedRequest]:
        return [
            request
            for request in self.requests_sent
            if request not in self.token_requests and request not in self.modal_requests
        ]


@pytest.fixture
def network(monkeypatch: pytest.MonkeyPatch) -> FakeNetwork:
    fake_network = FakeNetwork()
    monkeypatch.setattr(score_reforms.requests, "post", fake_network.requests_post)
    monkeypatch.setattr(score_reforms.requests, "get", fake_network.requests_get)
    monkeypatch.setattr(
        urllib.request.OpenerDirector,
        "open",
        lambda opener, request, data=None, timeout=None: fake_network.urllib_open(
            opener, request, data, timeout
        ),
    )
    monkeypatch.setattr(urllib.request, "urlopen", lambda *arguments, **keywords: pytest.fail("urlopen used"))
    return fake_network


@pytest.fixture
def scorecard_folder(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """Points the script's inputs, caches and outputs at a temporary folder."""
    monkeypatch.setattr(score_reforms, "HERE", tmp_path)
    monkeypatch.setattr(score_reforms, "SCENARIOS_PATH", tmp_path / "score-scenarios.json")
    monkeypatch.setattr(score_reforms, "PRIORS_PATH", tmp_path / "priors.yaml")
    monkeypatch.setattr(score_reforms, "DASH_DIR", tmp_path / "results_dashboard")
    monkeypatch.setattr(score_reforms, "API_DIR", tmp_path / "results_api")
    monkeypatch.setattr(score_reforms, "POLL_INTERVAL_S", 0)
    return tmp_path


def write_scenarios(folder: Path, count: int) -> list[str]:
    scenario_ids = [f"scenario_{number}" for number in range(1, count + 1)]
    scenarios = [
        {
            "id": scenario_id,
            "label": f"Scenario {scenario_id}",
            "state": "NY",
            "scope": "state",
            "direction": "expansion",
            "region": "state/ny",
            "year": 2026,
            "reform": {"gov.states.ny.tax.income.credits.ctc.amount.minimum": 500},
        }
        for scenario_id in scenario_ids
    ]
    (folder / "score-scenarios.json").write_text(json.dumps({"scenarios": scenarios}), encoding="utf-8")
    return scenario_ids


def set_settings(monkeypatch: pytest.MonkeyPatch, **overrides: str | None) -> None:
    for name, value in {**SETTING_VALUES, **overrides}.items():
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)


def run_scorecard(monkeypatch: pytest.MonkeyPatch, *arguments: str) -> dict[str, dict[str, Any]]:
    monkeypatch.setattr(
        sys, "argv", ["score_reforms.py", "--modal-url", MODAL_URL, *arguments]
    )
    score_reforms.main()
    rows = json.loads((score_reforms.HERE / "results.json").read_text(encoding="utf-8"))["rows"]
    return {row["id"]: row["res"] for row in rows}


def test_with_api_sends_one_token_on_every_public_api_request(
    network: FakeNetwork, scorecard_folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    set_settings(monkeypatch)
    scenario_ids = write_scenarios(scorecard_folder, 3)

    results = run_scorecard(monkeypatch, "--with-api", "--concurrency", "3")

    assert len(network.token_requests) == 1
    token_request = network.token_requests[0]
    assert token_request.body == {
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "audience": AUDIENCE,
    }
    # One policy and one economy read per scenario, each with the same token.
    assert len(network.public_api_requests) == 2 * len(scenario_ids)
    for request in network.public_api_requests:
        assert request.url.startswith(f"{PUBLIC_API_URL}/us/")
        assert request.header("Authorization") == f"Bearer {ACCESS_TOKEN}"
        assert request.timeout is not None
    assert token_request.timeout is not None
    # The token goes only to the Public API, never to the dashboard's Modal backend.
    assert network.modal_requests
    assert all(request.header("Authorization") is None for request in network.modal_requests)
    for scenario_id in scenario_ids:
        assert results[scenario_id]["api"]["child_poverty_rel_reduction"] == pytest.approx(0.2)


def test_public_api_address_comes_from_its_setting(
    network: FakeNetwork, scorecard_folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    staging_address = "https://public-api-staging.example.test"
    set_settings(monkeypatch, POLICYENGINE_API_URL=f"{staging_address}/")
    write_scenarios(scorecard_folder, 1)

    run_scorecard(monkeypatch, "--with-api")

    assert [request.url.split("?")[0] for request in network.public_api_requests] == [
        f"{staging_address}/us/policy",
        f"{staging_address}/us/economy/{POLICY_ID}/over/2",
    ]


def test_missing_setting_skips_the_public_api_and_names_the_variable(
    network: FakeNetwork,
    scorecard_folder: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    set_settings(monkeypatch, POLICYENGINE_API_AUTH0_CLIENT_SECRET=None)
    scenario_ids = write_scenarios(scorecard_folder, 2)

    results = run_scorecard(monkeypatch, "--with-api")

    assert network.token_requests == []
    assert network.public_api_requests == []
    for scenario_id in scenario_ids:
        assert "POLICYENGINE_API_AUTH0_CLIENT_SECRET" in results[scenario_id]["api"]["error"]
        # The dashboard column is scored as before.
        assert results[scenario_id]["dashboard"]["annual_cost"] == pytest.approx(5e9)
    assert "POLICYENGINE_API_AUTH0_CLIENT_SECRET" in capsys.readouterr().out


def test_refused_token_request_is_not_repeated_and_never_shows_the_secret(
    network: FakeNetwork,
    scorecard_folder: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    caplog: pytest.LogCaptureFixture,
) -> None:
    network.token_answer = FakeAnswer(
        401, {"error": "access_denied", "error_description": f"Unauthorized {CLIENT_SECRET}"}
    )
    set_settings(monkeypatch)
    scenario_ids = write_scenarios(scorecard_folder, 3)

    results = run_scorecard(monkeypatch, "--with-api", "--concurrency", "3")

    assert len(network.token_requests) == 1
    assert network.public_api_requests == []
    for scenario_id in scenario_ids:
        assert "Auth0 refused the token request with HTTP 401 access_denied" in (
            results[scenario_id]["api"]["error"]
        )
    captured = capsys.readouterr()
    written_files = [
        (scorecard_folder / "results.json").read_text(encoding="utf-8"),
        (scorecard_folder / "REPORT.md").read_text(encoding="utf-8"),
    ]
    for text in [captured.out, captured.err, caplog.text, *written_files]:
        assert CLIENT_SECRET not in text


def test_public_api_401_stops_further_requests_without_a_new_token(
    network: FakeNetwork, scorecard_folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    network.policy_answer = FakeAnswer(
        401, {"status": "error", "message": "Authentication is required"}
    )
    set_settings(monkeypatch)
    scenario_ids = write_scenarios(scorecard_folder, 3)

    results = run_scorecard(monkeypatch, "--with-api", "--concurrency", "1")

    assert len(network.token_requests) == 1
    assert len(network.public_api_requests) == 1
    for scenario_id in scenario_ids:
        assert "401" in results[scenario_id]["api"]["error"]


def test_failed_comparison_keeps_the_public_api_message(
    network: FakeNetwork, scorecard_folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    network.economy_answer = FakeAnswer(
        502, {"status": "error", "message": "The comparison failed", "retry_after_seconds": 600}
    )
    set_settings(monkeypatch)
    (scenario_id,) = write_scenarios(scorecard_folder, 1)

    results = run_scorecard(monkeypatch, "--with-api")

    assert results[scenario_id]["api"]["error"] == "RuntimeError: The comparison failed"
    assert len(network.public_api_requests) == 2


def test_run_without_api_requests_no_token_and_needs_no_settings(
    network: FakeNetwork, scorecard_folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    for name in SETTING_VALUES:
        monkeypatch.delenv(name, raising=False)
    (scenario_id,) = write_scenarios(scorecard_folder, 1)

    results = run_scorecard(monkeypatch)

    assert network.token_requests == []
    assert network.public_api_requests == []
    assert "api" not in results[scenario_id]
    assert results[scenario_id]["dashboard"]["annual_cost"] == pytest.approx(5e9)


def test_cached_public_api_results_need_no_token(
    network: FakeNetwork, scorecard_folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    for name in SETTING_VALUES:
        monkeypatch.delenv(name, raising=False)
    (scenario_id,) = write_scenarios(scorecard_folder, 1)
    (scorecard_folder / "results_api").mkdir()
    (scorecard_folder / "results_api" / f"{scenario_id}.json").write_text(
        json.dumps(PUBLIC_API_RESULT), encoding="utf-8"
    )

    results = run_scorecard(monkeypatch, "--with-api")

    assert network.token_requests == []
    assert network.public_api_requests == []
    assert results[scenario_id]["api"]["child_poverty_rel_reduction"] == pytest.approx(0.2)


def test_requests_use_the_template_timeouts(
    network: FakeNetwork, scorecard_folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    set_settings(monkeypatch)
    write_scenarios(scorecard_folder, 1)

    run_scorecard(monkeypatch, "--with-api")

    assert [request.timeout for request in network.token_requests] == [10]
    assert [
        (request.method, request.timeout) for request in network.public_api_requests
    ] == [("POST", 60), ("GET", 120)]


def test_dropped_token_connection_is_not_retried_by_later_scenarios(
    network: FakeNetwork, scorecard_folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    network.token_connection_error = ConnectionResetError("reset while sending the token request")
    set_settings(monkeypatch)
    scenario_ids = write_scenarios(scorecard_folder, 3)

    results = run_scorecard(monkeypatch, "--with-api", "--concurrency", "1")

    assert len(network.token_requests) == 1
    assert network.public_api_requests == []
    for scenario_id in scenario_ids:
        assert "the Auth0 token request failed (ConnectionResetError)" in (
            results[scenario_id]["api"]["error"]
        )
        assert "reset while sending" not in results[scenario_id]["api"]["error"]


def test_public_api_401_on_the_economy_read_stops_the_run(
    network: FakeNetwork, scorecard_folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    network.economy_answer = FakeAnswer(
        401, {"status": "error", "message": "Authentication is required"}
    )
    set_settings(monkeypatch)
    scenario_ids = write_scenarios(scorecard_folder, 3)

    results = run_scorecard(monkeypatch, "--with-api", "--concurrency", "1")

    # The first scenario's policy request and economy read; nothing after the 401.
    assert len(network.token_requests) == 1
    assert [request.method for request in network.public_api_requests] == ["POST", "GET"]
    for scenario_id in scenario_ids:
        error = results[scenario_id]["api"]["error"]
        assert "401" in error
        # A refused credential is not reported as a failed comparison.
        assert error != "RuntimeError: Authentication is required"


def test_economy_read_sends_only_the_query_parameters_the_public_api_accepts(
    network: FakeNetwork, scorecard_folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The Public API refuses unknown query parameters with 400, and has chosen the
    # dataset itself since 2026-09-18 (PolicyEngine/policyengine-api d116021e6).
    set_settings(monkeypatch)
    write_scenarios(scorecard_folder, 1)

    run_scorecard(monkeypatch, "--with-api")

    (economy_read,) = [request for request in network.public_api_requests if request.method == "GET"]
    query = urllib.parse.parse_qs(urllib.parse.urlsplit(economy_read.url).query)
    assert query == {"region": ["state/ny"], "time_period": ["2026"]}
