"""
Test suite for AnalysisReasoningAI v2 - User API Key support
"""

import json
import pytest
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

from backend.app.nodes.ai_nodes import AnalysisReasoningAI
from backend.app.core.config import settings


class TestAnalysisReasoningAIv2:
    """Test cases for the restructured AnalysisReasoningAI v2"""

    def setup_method(self):
        """Setup test environment"""
        self.node = AnalysisReasoningAI()
        # Create temporary directory for tests
        self.temp_dir = tempfile.mkdtemp()
        settings.STORAGE_PATH = self.temp_dir

    def teardown_method(self):
        """Cleanup test environment"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_internal_rules_analysis_basic(self):
        """Test basic internal rules analysis without external API"""
        risk_items = [
            {"rule_id": "R001", "description": "金额异常", "risk_level": "HIGH"},
            {"rule_id": "R002", "description": "频率异常", "risk_level": "MEDIUM"}
        ]
        metrics = {
            "total_transactions": 100,
            "high_risk_count": 5,
            "anomaly_rate": 0.05
        }

        risk_assessment, risk_level, suggestions, snapshot_metadata = self.node.analyze_audit_risk(
            risk_items=risk_items,
            metrics=metrics,
            human_review_states=None
        )

        # Verify results
        assert risk_level == "HIGH"
        assert risk_assessment["risk_score"] > 40
        assert len(risk_assessment["risk_factors"]) > 0
        assert len(suggestions) > 0
        assert "assessment_method" in risk_assessment
        assert risk_assessment["assessment_method"] == "internal_rules"

        # Verify snapshot metadata
        assert snapshot_metadata["model_info"]["provider"] == "internal"
        assert not snapshot_metadata["governance_flags"]["user_model_key_used"]
        assert not snapshot_metadata["governance_flags"]["experimental_logic_used"]

    def test_input_validation_governance(self):
        """Test input validation and governance enforcement"""
        # Test invalid risk_items type
        with pytest.raises(ValueError, match="risk_items必须是规则触发结果的列表"):
            self.node.analyze_audit_risk(
                risk_items="invalid",  # Should be list
                metrics={}
            )

        # Test invalid metrics type
        with pytest.raises(ValueError, match="metrics必须是指标数据的字典"):
            self.node.analyze_audit_risk(
                risk_items=[],
                metrics="invalid"  # Should be dict
            )

        # Test forbidden input patterns
        with pytest.raises(ValueError, match="治理违规"):
            self.node.analyze_audit_risk(
                risk_items=[],
                metrics={"dataframe": "forbidden"}
            )

    def test_risk_level_calculation(self):
        """Test risk level calculation based on different scenarios"""
        # Low risk scenario
        risk_items = [{"rule_id": "R001", "risk_level": "LOW"}]
        metrics = {"total_transactions": 10, "high_risk_count": 0}

        _, risk_level, _, _ = self.node.analyze_audit_risk(risk_items, metrics)
        assert risk_level == "LOW"

        # High risk scenario
        risk_items = [
            {"rule_id": "R001", "risk_level": "HIGH"},
            {"rule_id": "R002", "risk_level": "HIGH"},
            {"rule_id": "R003", "risk_level": "CRITICAL"}
        ]
        metrics = {"total_transactions": 10, "high_risk_count": 8, "anomaly_rate": 0.15}

        _, risk_level, _, _ = self.node.analyze_audit_risk(risk_items, metrics)
        assert risk_level in ["HIGH", "CRITICAL"]

    def test_human_review_state_integration(self):
        """Test integration with human review states"""
        risk_items = [{"rule_id": "R001", "risk_level": "MEDIUM"}]
        metrics = {"total_transactions": 50, "high_risk_count": 2}
        human_review_states = {
            "pending_count": 15,
            "rejected_count": 3
        }

        risk_assessment, risk_level, suggestions, _ = self.node.analyze_audit_risk(
            risk_items, metrics, human_review_states
        )

        # Should have higher risk due to rejected reviews
        assert risk_level in ["HIGH", "CRITICAL"]
        assert any("复核" in factor for factor in risk_assessment["risk_factors"])

    def test_external_api_fallback_simulation(self):
        """Test fallback behavior by testing internal rules directly when external API not available"""
        risk_items = [{"rule_id": "R001", "risk_level": "MEDIUM"}]
        metrics = {"total_transactions": 50}

        # Test without external API (should use internal rules)
        risk_assessment, risk_level, suggestions, snapshot_metadata = self.node.analyze_audit_risk(
            risk_items=risk_items,
            metrics=metrics
            # No user_api_key or model_provider provided
        )

        # Verify internal rules behavior
        assert risk_assessment["assessment_method"] == "internal_rules"
        assert not snapshot_metadata["governance_flags"]["user_model_key_used"]
        assert not snapshot_metadata["governance_flags"]["experimental_logic_used"]

    @patch('backend.app.nodes.ai_nodes.AnalysisReasoningAI._call_external_llm')
    def test_external_api_success(self, mock_call_llm):
        """Test successful external API call"""
        # Mock successful external API response
        mock_response = json.dumps({
            "risk_level": "HIGH",
            "risk_factors": ["外部API检测到严重风险"],
            "suggestions": ["立即启动审计程序"],
            "analysis_summary": "外部模型分析结果"
        })
        mock_call_llm.return_value = mock_response

        risk_items = [{"rule_id": "R001", "risk_level": "MEDIUM"}]
        metrics = {"total_transactions": 50}

        risk_assessment, risk_level, suggestions, snapshot_metadata = self.node.analyze_audit_risk(
            risk_items=risk_items,
            metrics=metrics,
            user_api_key="test_key",
            model_provider="openai",
            model_name="gpt-4"
        )

        # Verify external API usage
        assert risk_level == "HIGH"
        assert risk_assessment["assessment_method"] == "external_llm"
        assert "外部API检测到严重风险" in risk_assessment["risk_factors"]
        assert snapshot_metadata["governance_flags"]["user_model_key_used"]
        assert snapshot_metadata["governance_flags"]["experimental_logic_used"]
        assert snapshot_metadata["model_info"]["provider"] == "user_provided"

    def test_snapshot_metadata_structure(self):
        """Test snapshot metadata structure and completeness"""
        risk_items = [{"rule_id": "R001", "risk_level": "HIGH"}]
        metrics = {"total_transactions": 100, "high_risk_count": 5}

        _, _, _, snapshot_metadata = self.node.analyze_audit_risk(risk_items, metrics)

        # Verify required metadata fields
        required_fields = [
            "node_type", "node_version", "execution_hash", "generated_at",
            "model_info", "disclaimer", "governance_flags", "provenance"
        ]

        for field in required_fields:
            assert field in snapshot_metadata

        # Verify model_info structure
        assert "model_name" in snapshot_metadata["model_info"]
        assert "provider" in snapshot_metadata["model_info"]

        # Verify governance flags
        assert "user_model_key_used" in snapshot_metadata["governance_flags"]
        assert "experimental_logic_used" in snapshot_metadata["governance_flags"]
        assert "input_boundary_enforced" in snapshot_metadata["governance_flags"]

        # Verify provenance
        assert "input_risk_items_count" in snapshot_metadata["provenance"]
        assert "input_metrics_keys" in snapshot_metadata["provenance"]

    def test_suggestion_generation(self):
        """Test suggestion generation for different risk levels"""
        # Critical risk
        risk_items = [{"rule_id": "R001", "risk_level": "CRITICAL"}] * 5
        metrics = {"high_risk_count": 50, "total_transactions": 100}

        _, risk_level, suggestions, _ = self.node.analyze_audit_risk(risk_items, metrics)

        assert risk_level == "CRITICAL"
        assert any("紧急" in s or "立即" in s for s in suggestions)

        # Low risk
        risk_items = []
        metrics = {"high_risk_count": 0, "total_transactions": 10}

        _, risk_level, suggestions, _ = self.node.analyze_audit_risk(risk_items, metrics)

        assert risk_level == "LOW"
        assert any("常规" in s for s in suggestions)

    def test_analysis_prompt_building(self):
        """Test LLM analysis prompt construction"""
        risk_items = [{"rule_id": "R001", "description": "Test rule"}]
        metrics = {"total_transactions": 100}
        human_review_states = {"pending_count": 5}

        prompt = self.node._build_analysis_prompt(risk_items, metrics, human_review_states)

        # Verify prompt contains input data
        assert "R001" in prompt
        assert "total_transactions" in prompt
        assert "pending_count" in prompt
        assert "JSON格式返回" in prompt

    def test_level_to_score_conversion(self):
        """Test risk level to score conversion"""
        assert self.node._level_to_score("LOW") == 15
        assert self.node._level_to_score("MEDIUM") == 35
        assert self.node._level_to_score("HIGH") == 65
        assert self.node._level_to_score("CRITICAL") == 85
        assert self.node._level_to_score("UNKNOWN") == 35  # Default

    def test_requires_human_review_flag(self):
        """Test human review requirement flag"""
        # High risk should require review
        risk_items = [{"rule_id": "R001", "risk_level": "HIGH"}]
        metrics = {"high_risk_count": 10}

        risk_assessment, _, _, _ = self.node.analyze_audit_risk(risk_items, metrics)

        assert risk_assessment["requires_human_review"] == True

        # Low risk should not require review
        risk_items = []
        metrics = {"high_risk_count": 0}

        risk_assessment, _, _, _ = self.node.analyze_audit_risk(risk_items, metrics)

        assert risk_assessment["requires_human_review"] == False
