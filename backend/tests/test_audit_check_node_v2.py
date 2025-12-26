"""
Test suite for AuditCheckNode v2 - Auditable Assertion governance framework
"""

import json
import hashlib
from typing import List
import pytest
from backend.app.nodes.audit_nodes import AuditCheckNode
from backend.app.core.config import settings


class TestAuditCheckNodeV2:
    """Test cases for the governance-aware AuditCheckNode v2"""

    def setup_method(self):
        """Setup test environment"""
        self.node = AuditCheckNode()

    def test_basic_threshold_check_pass(self):
        """Test basic threshold check that passes"""
        result = self.node.execute_audit_check(
            amount=500.0,
            threshold=1000.0
        )

        # Verify decision layer
        assert result["decision_layer"]["judgment"] == "pass"
        assert result["decision_layer"]["confidence_score"] == 0.95
        assert "低于阈值" in result["decision_layer"]["decision_reason"]

        # Verify governance layer
        assert result["governance_layer"]["compliance_impact"] == "low"
        assert result["governance_layer"]["requires_human_review"] == False

        # Verify evidence layer exists
        assert "evidence_anchor" in result["evidence_layer"]
        assert result["evidence_layer"]["evidence_anchor"]["anchor_type"] == "reference"

        # Verify audit trail layer
        assert result["audit_trail_layer"]["audit_log_entry"]["event_type"] == "audit_check_executed"
        assert result["audit_trail_layer"]["audit_log_entry"]["node_type"] == "AuditCheckNode"

        # Verify legacy interface compatibility
        assert result["legacy_interface"]["is_valid"] == True
        assert "低于阈值" in result["legacy_interface"]["message"]

    def test_threshold_check_fail_critical(self):
        """Test threshold check that fails with critical governance flags"""
        result = self.node.execute_audit_check(
            amount=2500.0,  # 2.5x threshold to trigger high impact
            threshold=1000.0
        )

        # Verify decision layer
        assert result["decision_layer"]["judgment"] == "fail"
        assert "超过阈值" in result["decision_layer"]["decision_reason"]

        # Verify governance layer - should be critical and high impact
        assert "critical" in result["governance_layer"]["governance_flags"]
        assert "compliance_sensitive" in result["governance_layer"]["governance_flags"]
        assert result["governance_layer"]["compliance_impact"] == "high"
        assert result["governance_layer"]["requires_human_review"] == True
        assert result["governance_layer"]["auto_approval_blocked"] == True

        # Verify legacy interface
        assert result["legacy_interface"]["is_valid"] == False

    def test_severe_violation_compliance_sensitive(self):
        """Test severe violation that triggers compliance sensitivity"""
        result = self.node.execute_audit_check(
            amount=3000.0,  # 3x threshold
            threshold=1000.0
        )

        # Verify governance flags
        assert "critical" in result["governance_layer"]["governance_flags"]
        assert "compliance_sensitive" in result["governance_layer"]["governance_flags"]
        assert result["governance_layer"]["compliance_impact"] == "high"

    def test_extreme_violation_disclosure_required(self):
        """Test extreme violation that requires disclosure"""
        result = self.node.execute_audit_check(
            amount=6000.0,  # 6x threshold
            threshold=1000.0
        )

        # Verify disclosure requirement
        assert "requires_disclosure" in result["governance_layer"]["governance_flags"]
        assert result["governance_layer"]["disclosure_required"] == True

    def test_evidence_anchor_structure(self):
        """Test evidence anchor structure and integrity"""
        source_artifacts = ["artifact_123", "artifact_456"]

        result = self.node.execute_audit_check(
            amount=500.0,
            threshold=1000.0,
            source_artifacts=source_artifacts
        )

        anchor = result["evidence_layer"]["evidence_anchor"]

        # Verify anchor structure
        assert "anchor_id" in anchor
        assert anchor["anchor_type"] == "reference"
        assert anchor["artifact_ids"] == source_artifacts
        assert anchor["data_scope"]["fields_used"] == ["amount", "threshold"]
        assert anchor["integrity"]["algorithm"] == "sha256"
        assert "captured_at" in anchor["integrity"]
        assert anchor["scope"]["purpose"] == "threshold_audit_check"
        assert anchor["scope"]["retention_days"] == 2555  # 7 years

    def test_audit_trail_completeness(self):
        """Test audit trail completeness"""
        rule_context = {
            "rule_version": "v2.1.0",
            "rule_set_version": "audit_rules_v3.0"
        }

        workflow_context = {
            "workflow_id": "wf_test_001",
            "run_id": "run_test_001",
            "user_id": "test_user"
        }

        result = self.node.execute_audit_check(
            amount=500.0,
            threshold=1000.0,
            rule_context=rule_context,
            workflow_context=workflow_context
        )

        audit_entry = result["audit_trail_layer"]["audit_log_entry"]

        # Verify audit trail structure
        assert audit_entry["event_type"] == "audit_check_executed"
        assert "event_id" in audit_entry
        assert audit_entry["node_type"] == "AuditCheckNode"
        assert audit_entry["node_version"] == "2.0.0"

        # Verify execution context
        assert audit_entry["execution_context"]["workflow_id"] == "wf_test_001"
        assert audit_entry["execution_context"]["run_id"] == "run_test_001"
        assert audit_entry["execution_context"]["user_id"] == "test_user"
        assert audit_entry["execution_context"]["rule_version"] == "v2.1.0"

        # Verify provenance
        assert audit_entry["provenance"]["rule_set_version"] == "audit_rules_v3.0"
        assert "execution_timestamp" in audit_entry["execution_context"]

    def test_assertion_id_uniqueness(self):
        """Test that assertion IDs are unique for different executions"""
        result1 = self.node.execute_audit_check(amount=500.0, threshold=1000.0)
        result2 = self.node.execute_audit_check(amount=600.0, threshold=1000.0)

        assert result1["assertion_id"] != result2["assertion_id"]
        assert result1["assertion_id"].startswith("assertion_")
        assert result2["assertion_id"].startswith("assertion_")

    def test_legacy_interface_compatibility(self):
        """Test legacy interface backward compatibility"""
        # Test legacy method
        is_valid, message = self.node.check(amount=500.0, threshold=1000.0)

        assert is_valid == True
        assert "低于阈值" in message

        # Test fail case
        is_valid, message = self.node.check(amount=1500.0, threshold=1000.0)

        assert is_valid == False
        assert "超过阈值" in message

    def test_workflow_context_integration(self):
        """Test workflow context integration"""
        workflow_context = {
            "workflow_id": "compliance_wf",
            "run_id": "run_20241226",
            "user_id": "auditor_john"
        }

        result = self.node.execute_audit_check(
            amount=2000.0,
            threshold=1000.0,
            workflow_context=workflow_context
        )

        audit_entry = result["audit_trail_layer"]["audit_log_entry"]
        assert audit_entry["execution_context"]["workflow_id"] == "compliance_wf"
        assert audit_entry["execution_context"]["run_id"] == "run_20241226"
        assert audit_entry["execution_context"]["user_id"] == "auditor_john"

    def test_governance_flags_critical_scenarios(self):
        """Test governance flags in various critical scenarios"""

        # Test cases with expected governance flags
        test_cases = [
            # (amount, threshold, expected_flags, compliance_impact)
            (500.0, 1000.0, [], "low"),                                    # Pass case
            (1200.0, 1000.0, ["critical"], "medium"),                     # Fail with medium impact
            (2500.0, 1000.0, ["critical", "compliance_sensitive"], "high"), # Severe violation
            (5500.0, 1000.0, ["critical", "compliance_sensitive", "requires_disclosure"], "high"), # Extreme violation
        ]

        for amount, threshold, expected_flags, expected_impact in test_cases:
            result = self.node.execute_audit_check(amount=amount, threshold=threshold)

            governance = result["governance_layer"]

            # Check all expected flags are present
            for flag in expected_flags:
                assert flag in governance["governance_flags"], f"Missing flag {flag} for amount {amount}"

            # Check compliance impact
            assert governance["compliance_impact"] == expected_impact

            # Check human review requirement
            if "critical" in expected_flags or expected_impact == "high":
                assert governance["requires_human_review"] == True

    def test_evidence_anchor_data_integrity(self):
        """Test evidence anchor data integrity and checksum"""
        amount, threshold = 1234.56, 1000.00

        result = self.node.execute_audit_check(amount=amount, threshold=threshold)

        anchor = result["evidence_layer"]["evidence_anchor"]

        # Verify data scope contains correct values
        assert anchor["data_scope"]["value_range"]["amount"] == amount
        assert anchor["data_scope"]["value_range"]["threshold"] == threshold

        # Verify checksum is deterministic
        expected_checksum = hashlib.sha256(f"{amount}_{threshold}".encode()).hexdigest()
        assert anchor["integrity"]["checksum"] == expected_checksum

    def test_audit_assertion_schema_completeness(self):
        """Test complete audit assertion schema"""
        result = self.node.execute_audit_check(
            amount=500.0,
            threshold=1000.0,
            rule_context={"rule_version": "v1.0"},
            source_artifacts=["art_123"],
            workflow_context={"workflow_id": "wf_123", "run_id": "run_123"}
        )

        # Required top-level fields
        required_fields = [
            "assertion_id", "node_type", "node_version", "generated_at",
            "decision_layer", "governance_layer", "evidence_layer", "audit_trail_layer",
            "legacy_interface"
        ]

        for field in required_fields:
            assert field in result, f"Missing required field: {field}"

        # Decision layer fields
        decision_fields = ["judgment", "confidence_score", "decision_reason", "decision_criteria"]
        for field in decision_fields:
            assert field in result["decision_layer"]

        # Governance layer fields
        governance_fields = ["governance_flags", "compliance_impact", "requires_human_review"]
        for field in governance_fields:
            assert field in result["governance_layer"]

        # Evidence layer fields
        assert "evidence_anchor" in result["evidence_layer"]

        # Audit trail layer fields
        assert "audit_log_entry" in result["audit_trail_layer"]

        # Legacy interface compatibility
        assert "is_valid" in result["legacy_interface"]
        assert "message" in result["legacy_interface"]
