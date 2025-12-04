"""Tests for the FastAPI backend."""

import pytest
from fastapi.testclient import TestClient


# Import will fail without proper setup, so we use try/except
try:
    from app.main import app
    client = TestClient(app)
    API_AVAILABLE = True
except ImportError:
    API_AVAILABLE = False
    client = None


@pytest.mark.skipif(not API_AVAILABLE, reason="API not available")
class TestHealthEndpoints:
    """Test health check endpoints."""

    def test_root(self):
        """Test root endpoint."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data

    def test_health(self):
        """Test health endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


@pytest.mark.skipif(not API_AVAILABLE, reason="API not available")
class TestReformEndpoints:
    """Test reform configuration endpoints."""

    def test_get_preset_reforms(self):
        """Test getting preset reforms."""
        response = client.get("/api/reforms/presets")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_get_preset_reform(self):
        """Test getting a specific preset reform."""
        response = client.get("/api/reforms/presets/expanded_ctc_2021")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "expanded_ctc_2021"
        assert "name" in data

    def test_get_nonexistent_preset(self):
        """Test getting a nonexistent preset."""
        response = client.get("/api/reforms/presets/nonexistent")
        assert response.status_code == 404

    def test_validate_reform_valid(self):
        """Test validating a valid reform."""
        reform = {
            "name": "Test Reform",
            "year": 2024,
            "ctc": {"enabled": True, "amount_young": 3600},
        }
        response = client.post("/api/reforms/validate", json=reform)
        assert response.status_code == 200
        data = response.json()
        assert data["valid"]
        assert "ctc" in data["enabled_reforms"]

    def test_validate_reform_no_reforms(self):
        """Test validating a reform with no reforms enabled."""
        reform = {"name": "Empty Reform", "year": 2024}
        response = client.post("/api/reforms/validate", json=reform)
        assert response.status_code == 200
        data = response.json()
        assert not data["valid"]


@pytest.mark.skipif(not API_AVAILABLE, reason="API not available")
class TestStateEndpoints:
    """Test state information endpoints."""

    def test_get_all_states(self):
        """Test getting all states."""
        response = client.get("/api/states/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 51  # 50 states + DC

    def test_get_state(self):
        """Test getting a specific state."""
        response = client.get("/api/states/CA")
        assert response.status_code == 200
        data = response.json()
        assert data["state_code"] == "CA"
        assert data["state_name"] == "California"
        assert data["has_state_ctc"]

    def test_get_nonexistent_state(self):
        """Test getting a nonexistent state."""
        response = client.get("/api/states/XX")
        assert response.status_code == 404


# Model validation tests
class TestReformModels:
    """Test reform request model validation."""

    def test_ctc_config_defaults(self):
        """Test CTCRequest defaults."""
        from app.api.models.reforms import CTCRequest
        ctc = CTCRequest()
        assert not ctc.enabled
        assert ctc.amount_young == 0
        assert ctc.refundable

    def test_reform_request_example(self):
        """Test ReformRequest with example data."""
        from app.api.models.reforms import ReformRequest, CTCRequest
        reform = ReformRequest(
            name="Test",
            year=2024,
            ctc=CTCRequest(enabled=True, amount_young=3600)
        )
        assert reform.name == "Test"
        assert reform.ctc.enabled
        assert reform.ctc.amount_young == 3600


class TestResponseModels:
    """Test response model validation."""

    def test_poverty_impact_response(self):
        """Test PovertyImpactResponse model."""
        from app.api.models.responses import PovertyImpactResponse
        response = PovertyImpactResponse(
            baseline_child_poverty_rate=12.5,
            reform_child_poverty_rate=8.5,
            child_poverty_change_pp=-4.0,
            child_poverty_percent_change=-32.0,
            baseline_young_child_poverty_rate=14.0,
            reform_young_child_poverty_rate=9.0,
            young_child_poverty_change_pp=-5.0,
            young_child_poverty_percent_change=-35.7,
            children_lifted_out_of_poverty=2500000,
            young_children_lifted_out_of_poverty=800000,
            baseline_deep_child_poverty_rate=5.0,
            reform_deep_child_poverty_rate=3.0,
            deep_poverty_change_pp=-2.0,
        )
        assert response.child_poverty_change_pp == -4.0
        assert response.children_lifted_out_of_poverty == 2500000

    def test_fiscal_cost_response(self):
        """Test FiscalCostResponse model."""
        from app.api.models.responses import FiscalCostResponse
        response = FiscalCostResponse(
            total_cost_billions=105.5,
            federal_cost_billions=100.0,
            state_cost_billions=5.5,
            ctc_cost_billions=105.5,
            eitc_cost_billions=0,
            dependent_exemption_cost_billions=0,
            ubi_cost_billions=0,
            snap_cost_billions=0,
            state_ctc_cost_billions=0,
            income_tax_change_billions=-5.0,
            payroll_tax_change_billions=0,
            cost_per_child=1400,
            cost_per_child_lifted_from_poverty=42000,
        )
        assert response.total_cost_billions == 105.5
        assert response.cost_per_child == 1400
