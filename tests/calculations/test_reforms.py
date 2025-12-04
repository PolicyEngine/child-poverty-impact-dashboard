"""Tests for reform configuration and building."""

import pytest
from cpid_calc.reforms.config import (
    ReformConfig,
    CTCConfig,
    EITCConfig,
    SNAPConfig,
    UBIConfig,
    StateCTCConfig,
    AgeEligibility,
    IncomeBasis,
    PhaseoutStructure,
)
from cpid_calc.reforms.ctc import CTCReform
from cpid_calc.reforms.eitc import EITCReform
from cpid_calc.reforms.snap import SNAPReform
from cpid_calc.reforms.ubi import UBIReform
from cpid_calc.reforms.state_ctc import StateCTCReform, EXISTING_STATE_CTCS


class TestReformConfig:
    """Test ReformConfig dataclass."""

    def test_default_config(self):
        """Test default configuration values."""
        config = ReformConfig()
        assert config.name == "Custom Reform"
        assert config.year == 2024
        assert len(config.states) == 0
        assert not config.ctc.enabled
        assert not config.eitc.enabled

    def test_enabled_reforms(self):
        """Test get_enabled_reforms method."""
        config = ReformConfig(
            ctc=CTCConfig(enabled=True),
            eitc=EITCConfig(enabled=True),
        )
        enabled = config.get_enabled_reforms()
        assert "ctc" in enabled
        assert "eitc" in enabled
        assert "snap" not in enabled

    def test_to_dict(self):
        """Test serialization to dictionary."""
        config = ReformConfig(name="Test Reform", year=2025)
        d = config.to_dict()
        assert d["name"] == "Test Reform"
        assert d["year"] == 2025

    def test_from_dict(self):
        """Test deserialization from dictionary."""
        data = {
            "name": "From Dict",
            "year": 2026,
            "ctc": {"enabled": True, "amount_young": 3600},
        }
        config = ReformConfig.from_dict(data)
        assert config.name == "From Dict"
        assert config.year == 2026
        assert config.ctc.enabled
        assert config.ctc.amount_young == 3600


class TestCTCReform:
    """Test CTC reform factory methods."""

    def test_expanded_ctc(self):
        """Test expanded CTC creation."""
        reform = CTCReform.expanded_ctc()
        assert reform.config.enabled
        assert reform.config.amount_young == 3600
        assert reform.config.amount_older == 3000
        assert reform.config.refundable

    def test_young_child_ctc(self):
        """Test young child CTC."""
        reform = CTCReform.young_child_ctc(amount=4000)
        assert reform.config.enabled
        assert reform.config.amount_young == 4000
        assert reform.config.amount_older == 0
        assert reform.config.age_eligibility == AgeEligibility.AGES_0_5

    def test_universal_child_allowance(self):
        """Test universal child allowance."""
        reform = CTCReform.universal_child_allowance(amount=3000)
        assert reform.config.enabled
        assert reform.config.amount_young == 3000
        assert reform.config.amount_older == 3000
        assert reform.config.phaseout_structure == PhaseoutStructure.NONE

    def test_romney_fsa(self):
        """Test Romney Family Security Act preset."""
        reform = CTCReform.romney_family_security_act()
        assert reform.config.enabled
        assert reform.config.amount_young == 4200
        assert reform.config.amount_older == 3000


class TestEITCReform:
    """Test EITC reform factory methods."""

    def test_standard_expansion(self):
        """Test standard EITC expansion."""
        reform = EITCReform.standard_expansion(expansion_percent=50)
        assert reform.config.enabled
        assert reform.config.expansion_percent == 50

    def test_individualized_eitc(self):
        """Test individualized EITC."""
        reform = EITCReform.individualized_eitc()
        assert reform.config.enabled
        assert reform.config.individualized

    def test_childless_expansion(self):
        """Test childless worker expansion."""
        reform = EITCReform.childless_worker_expansion()
        assert reform.config.enabled
        assert reform.config.childless_expansion


class TestSNAPReform:
    """Test SNAP reform factory methods."""

    def test_benefit_increase(self):
        """Test SNAP benefit increase."""
        reform = SNAPReform.benefit_increase(percent_increase=15)
        assert reform.config.enabled
        assert reform.config.benefit_increase_percent == 15

    def test_eligibility_expansion(self):
        """Test SNAP eligibility expansion."""
        reform = SNAPReform.eligibility_expansion(
            income_limit_increase=30,
            remove_asset_test=True
        )
        assert reform.config.enabled
        assert reform.config.expand_eligibility_percent == 30
        assert reform.config.remove_asset_test

    def test_child_nutrition_boost(self):
        """Test child nutrition boost."""
        reform = SNAPReform.child_nutrition_boost(additional_per_child=50)
        assert reform.config.enabled
        assert reform.config.increase_child_allotment == 600  # 50 * 12


class TestUBIReform:
    """Test UBI reform factory methods."""

    def test_child_allowance(self):
        """Test child allowance."""
        reform = UBIReform.child_allowance(amount=3600)
        assert reform.config.enabled
        assert reform.config.amount_per_child == 3600
        assert reform.config.amount_per_adult == 0

    def test_means_tested_allowance(self):
        """Test means-tested child allowance."""
        reform = UBIReform.means_tested_child_allowance(
            amount=4000,
            phaseout_start=75000,
            phaseout_rate=0.05
        )
        assert reform.config.enabled
        assert reform.config.phase_out_with_income
        assert reform.config.phaseout_start == 75000

    def test_full_ubi(self):
        """Test full UBI."""
        reform = UBIReform.full_ubi(adult_amount=12000, child_amount=4000)
        assert reform.config.enabled
        assert reform.config.amount_per_adult == 12000
        assert reform.config.amount_per_child == 4000


class TestStateCTCReform:
    """Test state CTC reform factory methods."""

    def test_new_state_ctc(self):
        """Test creating a new state CTC."""
        reform = StateCTCReform.new_state_ctc(
            state="TX",
            amount_young=2000,
            amount_older=1500
        )
        assert reform.config.enabled
        assert reform.config.state == "TX"
        assert reform.config.amount_young == 2000

    def test_federal_match(self):
        """Test federal matching CTC."""
        reform = StateCTCReform.federal_match(state="FL", match_percent=25)
        assert reform.config.enabled
        assert reform.config.matches_federal
        assert reform.config.match_percent == 25

    def test_get_existing_state_ctc(self):
        """Test getting existing state CTCs."""
        reform = StateCTCReform.get_existing_state_ctc("CA")
        assert reform is not None
        assert reform.config.state == "CA"
        assert reform.config.amount_young == 1117

    def test_nonexistent_state_ctc(self):
        """Test getting CTC for state without one."""
        reform = StateCTCReform.get_existing_state_ctc("TX")
        assert reform is None

    def test_states_with_ctc(self):
        """Test getting list of states with CTCs."""
        states = StateCTCReform.get_states_with_ctc()
        assert "CA" in states
        assert "MN" in states
        assert len(states) == len(EXISTING_STATE_CTCS)

    def test_states_without_ctc(self):
        """Test getting list of states without CTCs."""
        states = StateCTCReform.get_states_without_ctc()
        assert "TX" in states
        assert "FL" in states
        assert "CA" not in states
