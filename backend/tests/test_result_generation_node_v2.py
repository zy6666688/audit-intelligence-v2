"""
Test suite for ResultGenerationNode v2 - Audit Result Structuring & Governance
"""

import json
import pytest
import pandas as pd
from datetime import datetime
from backend.app.nodes.result_node import ResultGenerationNode, SignatureStatus


class TestResultGenerationNodeV2:
    """Test cases for the governance-aware ResultGenerationNode v2"""

    def setup_method(self):
        """Setup test environment"""
        self.node = ResultGenerationNode()

    def test_basic_audit_result_generation(self):
        """Test basic audit result generation with minimal inputs"""
        result = self.node.generate_audit_result(
            workflow_id="wf_test_001",
            run_id="run_test_001",
            findings=[
                {
                    "finding_id": "finding_001",
                    "rule_id": "rule_threshold",
                    "description": "金额超过阈值",
                    "amount_impact": 1500.0,
                    "risk_level": "high",
                    "evidence_refs": ["evidence_001"],
                    "governance_flags": {"critical": True}
                }
            ]
        )

        # Verify basic structure
        assert "audit_result_id" in result
        assert result["workflow_id"] == "wf_test_001"
        assert result["run_id"] == "run_test_001"
        assert result["version"] == "1.0"
        assert "generated_at" in result
        assert "immutable_hash" in result

        # Verify four-layer structure
        assert "decision_layer" not in result  # ResultGenerationNode doesn't have decision layer
        assert "governance_layer" not in result  # Governance is embedded in flags
        assert "evidence_layer" not in result  # Evidence is in evidence_trace
        assert "audit_trail_layer" not in result  # Audit trail is embedded

        # Verify structured result components
        assert "document_meta" in result
        assert "summary" in result
        assert "findings" in result
        assert isinstance(result["findings"], list)
        assert len(result["findings"]) == 1

        # Verify governance flags
        assert "governance_flags" in result
        assert result["governance_flags"]["critical_findings_count"] == 1
        assert result["governance_flags"]["requires_human_review"] == True

        # Verify signature workflow
        assert "signatures" in result
        assert "signature_status" in result
        assert result["signature_status"] == SignatureStatus.PENDING_REVIEW.value

    def test_comprehensive_audit_result_with_all_inputs(self):
        """Test comprehensive audit result generation with all input types"""
        # Mock analysis results
        analysis_results = [
            {
                "analysis_id": "analysis_001",
                "model_info": {"model_name": "gpt-4", "version": "v1.0"},
                "governance_flags": {"experimental_logic_used": True},
                "snapshot_metadata": {"confidence": 0.85}
            }
        ]

        # Mock human review states
        human_review_states = [
            {
                "review_id": "review_001",
                "decision": "approved",
                "governance_flags": {"requires_human_review": False}
            }
        ]

        result = self.node.generate_audit_result(
            workflow_id="wf_comprehensive",
            run_id="run_comprehensive",
            findings=[
                {
                    "finding_id": "finding_001",
                    "rule_id": "rule_compliance",
                    "description": "合规性问题",
                    "amount_impact": 50000.0,
                    "risk_level": "critical",
                    "evidence_refs": ["evidence_001", "evidence_002"],
                    "governance_flags": {"critical": True, "compliance_sensitive": True}
                }
            ],
            analysis_results=analysis_results,
            human_review_states=human_review_states,
            document_meta={"custom_field": "test_value"},
            client_name="Test Client Corp",
            period_start="2024-01-01",
            period_end="2024-12-31",
            report_type="annual_audit"
        )

        # Verify document metadata
        assert result["document_meta"]["client_name"] == "Test Client Corp"
        assert result["document_meta"]["period_start"] == "2024-01-01"
        assert result["document_meta"]["report_type"] == "annual_audit"
        assert result["document_meta"]["custom_field"] == "test_value"

        # Verify provenance
        assert "provenance" in result
        assert result["provenance"]["generated_by"] == "ResultGenerationNode"
        assert result["provenance"]["input_sources"]["findings_count"] == 1
        assert result["provenance"]["input_sources"]["analysis_results_count"] == 1
        assert result["provenance"]["input_sources"]["human_review_states_count"] == 1

        # Verify governance flags aggregation
        assert result["governance_flags"]["experimental_logic_used"] == True
        assert result["governance_flags"]["critical_findings_count"] == 1

        # Verify analysis refs
        assert "analysis_refs" in result["provenance"]
        assert len(result["provenance"]["analysis_refs"]) == 1

    def test_executive_summary_generation(self):
        """Test executive summary generation based on findings"""
        # Test case 1: No findings
        result_empty = self.node.generate_audit_result(
            workflow_id="wf_test",
            run_id="run_test",
            findings=[]
        )
        assert "未发现" in result_empty["summary"] or "个发现" in result_empty["summary"]

        # Test case 2: Critical findings
        result_critical = self.node.generate_audit_result(
            workflow_id="wf_test",
            run_id="run_test",
            findings=[
                {
                    "finding_id": "finding_critical",
                    "rule_id": "rule_critical",
                    "description": "严重问题",
                    "risk_level": "critical",
                    "governance_flags": {"critical": True}
                }
            ]
        )
        assert "关键风险项" in result_critical["summary"]

    def test_signature_workflow_initialization(self):
        """Test signature workflow initialization"""
        # Test case 1: Normal findings
        result_normal = self.node.generate_audit_result(
            workflow_id="wf_test",
            run_id="run_test",
            findings=[
                {
                    "finding_id": "finding_normal",
                    "rule_id": "rule_normal",
                    "description": "正常问题",
                    "risk_level": "low"
                }
            ]
        )

        assert result_normal["signature_status"] == SignatureStatus.DRAFT.value
        assert result_normal["signatures"]["prepared_by"] is None

        # Test case 2: Requires human review
        result_review = self.node.generate_audit_result(
            workflow_id="wf_test",
            run_id="run_test",
            findings=[
                {
                    "finding_id": "finding_review",
                    "rule_id": "rule_review",
                    "description": "需要审核的问题",
                    "governance_flags": {"requires_human_review": True}
                }
            ]
        )

        assert result_review["signature_status"] == SignatureStatus.PENDING_REVIEW.value

    def test_evidence_trace_generation(self):
        """Test evidence trace generation"""
        result = self.node.generate_audit_result(
            workflow_id="wf_test",
            run_id="run_test",
            findings=[
                {
                    "finding_id": "finding_001",
                    "evidence_refs": ["evidence_001", "evidence_002"]
                },
                {
                    "finding_id": "finding_002",
                    "evidence_refs": []  # No evidence
                }
            ]
        )

        # Verify evidence trace
        assert "evidence_trace" in result
        trace = result["evidence_trace"]
        assert trace["total_evidence_refs"] == 2
        assert trace["missing_evidence_count"] == 1  # One finding has no evidence

    def test_immutable_hash_generation(self):
        """Test immutable hash generation for audit integrity"""
        result1 = self.node.generate_audit_result(
            workflow_id="wf_test",
            run_id="run_test",
            findings=[{"finding_id": "test"}]
        )

        result2 = self.node.generate_audit_result(
            workflow_id="wf_test",
            run_id="run_test",
            findings=[{"finding_id": "test"}]  # Same input
        )

        # Same input should produce same hash
        assert result1["immutable_hash"] == result2["immutable_hash"]

        # Different input should produce different hash
        result3 = self.node.generate_audit_result(
            workflow_id="wf_test",
            run_id="run_test",
            findings=[{"finding_id": "different"}]
        )

        assert result1["immutable_hash"] != result3["immutable_hash"]

    def test_input_validation_rejects_dataframes(self):
        """Test that raw DataFrame inputs are rejected"""
        from backend.app.nodes.base_node import ExecutionContext

        context = ExecutionContext(
            workflow_id="test",
            run_id="test",
            node_exec_id="test"
        )

        # Should reject DataFrame inputs
        with pytest.raises(ValueError, match="does not accept DataFrame inputs"):
            self.node._execute_pure({
                "findings": [],
                "dataframe": pd.DataFrame({"test": [1, 2, 3]})  # Invalid input
            }, context)

    def test_audit_result_schema_completeness(self):
        """Test complete audit result schema"""
        result = self.node.generate_audit_result(
            workflow_id="wf_schema_test",
            run_id="run_schema_test",
            findings=[{
                "finding_id": "schema_test",
                "rule_id": "rule_schema",
                "description": "Schema completeness test",
                "evidence_refs": ["evidence_test"],
                "governance_flags": {"test_flag": True}
            }],
            analysis_results=[{
                "analysis_id": "analysis_test",
                "model_info": {"model_name": "test_model"}
            }],
            human_review_states=[{
                "review_id": "review_test",
                "decision": "approved"
            }]
        )

        # Required top-level fields
        required_fields = [
            "audit_result_id", "workflow_id", "run_id", "version", "generated_at",
            "document_meta", "summary", "findings", "overall_opinion", "signatures",
            "signature_status", "provenance", "governance_flags", "evidence_trace",
            "immutable_hash", "storage_path"
        ]

        for field in required_fields:
            assert field in result, f"Missing required field: {field}"

        # Verify findings structure
        assert isinstance(result["findings"], list)
        assert len(result["findings"]) >= 1

        finding = result["findings"][0]
        finding_fields = [
            "finding_id", "rule_id", "description", "evidence_refs",
            "analysis_refs", "human_review_status"
        ]

        for field in finding_fields:
            assert field in finding, f"Missing finding field: {field}"

        # Verify provenance structure
        assert "generated_by" in result["provenance"]
        assert "generated_at" in result["provenance"]
        assert "input_sources" in result["provenance"]

    def test_backward_compatibility_with_legacy_interface(self):
        """Test backward compatibility with legacy interface expectations"""
        # This test ensures the new ResultGenerationNode can work with
        # existing workflow expectations that might expect different field names

        result = self.node.generate_audit_result(
            workflow_id="wf_legacy",
            run_id="run_legacy",
            findings=[{
                "finding_id": "legacy_test",
                "rule_id": "legacy_rule",
                "description": "Legacy compatibility test"
            }]
        )

        # Should be able to access key fields that legacy consumers expect
        assert result.get("audit_result_id") is not None
        assert isinstance(result.get("findings"), list)
        assert result.get("workflow_id") == "wf_legacy"
        assert result.get("run_id") == "run_legacy"

        # Legacy consumers might expect a nested structure
        # Our implementation provides direct access for simplicity
