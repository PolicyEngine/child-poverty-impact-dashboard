"""The "Reform scores" workflow gives the scorecard its Public API credential.

The scoring step reads the five settings from the repository's GitHub Actions
variables and its secret. Scheduled runs never call the Public API, so the
secret reaches the step only when a dispatch asks for the reference column.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

WORKFLOW_PATH = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "reform-scores.yml"
SCORING_STEP_NAME = "Score reforms (dashboard backend)"


def scoring_step() -> dict[str, Any]:
    workflow = yaml.safe_load(WORKFLOW_PATH.read_text(encoding="utf-8"))
    (step,) = [step for step in workflow["jobs"]["score"]["steps"] if step.get("name") == SCORING_STEP_NAME]
    return step


def test_scoring_step_reads_the_settings_from_variables_and_the_secret() -> None:
    environment = scoring_step()["env"]

    assert environment.get("POLICYENGINE_API_URL") == (
        "${{ vars.POLICYENGINE_API_URL || 'https://api.policyengine.org' }}"
    )
    assert environment.get("POLICYENGINE_API_AUTH0_DOMAIN") == "${{ vars.POLICYENGINE_API_AUTH0_DOMAIN }}"
    assert environment.get("POLICYENGINE_API_AUTH0_AUDIENCE") == "${{ vars.POLICYENGINE_API_AUTH0_AUDIENCE }}"
    assert environment.get("POLICYENGINE_API_AUTH0_CLIENT_ID") == "${{ vars.POLICYENGINE_API_AUTH0_CLIENT_ID }}"
    assert environment.get("POLICYENGINE_API_AUTH0_CLIENT_SECRET") == (
        "${{ github.event.inputs.with_api == 'true'"
        " && secrets.POLICYENGINE_API_AUTH0_CLIENT_SECRET || '' }}"
    )


def test_only_the_scoring_step_gets_the_secret() -> None:
    workflow_text = WORKFLOW_PATH.read_text(encoding="utf-8")
    workflow = yaml.safe_load(workflow_text)

    assert workflow_text.count("secrets.") == 1
    assert "env" not in workflow
    assert "env" not in workflow["jobs"]["score"]
    steps_with_secret = [
        step.get("name")
        for step in workflow["jobs"]["score"]["steps"]
        if "secrets." in str(step.get("env", {}))
    ]
    assert steps_with_secret == [SCORING_STEP_NAME]


def test_dispatch_inputs_reach_the_script_through_the_environment() -> None:
    step = scoring_step()

    # Inputs are not pasted into the shell script, so a scenario list cannot
    # run commands in the step that holds the secret.
    assert "github.event.inputs.only" not in step["run"]
    assert step["env"].get("ONLY_SCENARIOS") == "${{ github.event.inputs.only }}"
