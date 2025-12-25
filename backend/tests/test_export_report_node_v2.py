"""
Test suite for ExportReportNode v2 - Complete artifact management and governance
"""

import json
import os
import pytest
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

from backend.app.nodes.export_node import ExportReportNode, GovernanceError
from backend.app.core.config import settings


class TestExportReportNodeV2:
    """Test cases for the restructured ExportReportNode v2"""

    def setup_method(self):
        """Setup test environment"""
        self.node = ExportReportNode()
        # Create temporary directory for tests
        self.temp_dir = tempfile.mkdtemp()
        settings.STORAGE_PATH = self.temp_dir

    def teardown_method(self):
        """Cleanup test environment"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_audit_result_ref_validation(self):
        """Test audit_result_ref validation"""
        # Valid ref
        valid_ref = {
            "workflow_id": "wf1",
            "run_id": "run1",
            "audit_result_id": "audit1"
        }
        assert self.node._validate_audit_result_ref(valid_ref) == True

        # Invalid ref - missing fields
        invalid_ref = {"workflow_id": "wf1"}
        assert self.node._validate_audit_result_ref(invalid_ref) == False

    def test_successful_export_internal(self):
        """Test successful internal export without governance issues"""
        # Create mock audit result
        audit_result = {
            "audit_result_id": "audit123",
            "workflow_id": "wf1",
            "run_id": "run1",
            "signature_status": "approved",
            "governance_flags": {"experimental_logic_used": False},
            "metadata": {
                "ci_scan_report_ref": "/storage/scans/scan1.json",
                "analysis_refs": ["/storage/analysis/analysis1.json"]
            }
        }

        # Create audit result file
        audit_dir = os.path.join(self.temp_dir, "audit", "wf1", "run1")
        os.makedirs(audit_dir, exist_ok=True)
        audit_path = os.path.join(audit_dir, "audit123.json")
        with open(audit_path, "w") as f:
            json.dump(audit_result, f)

        audit_result_ref = {
            "workflow_id": "wf1",
            "run_id": "run1",
            "audit_result_id": "audit123",
            "storage_path": audit_path
        }

        export_options = {"format": "json", "for_external_use": False}

        with patch('backend.app.nodes.export_node.ai_gov') as mock_ai_gov:
            mock_ai_gov.check.return_value = {"status": "CLEAN", "violations": {"hard": 0, "warnings": 0}}

            result = self.node.export_audit_report(audit_result_ref, export_options)

            assert result["status"] == "SUCCESS"
            assert "artifact_id" in result
            assert "file_path" in result
            assert "ui_link" in result
            assert "metadata_path" in result

            # Verify artifact was created
            assert os.path.exists(result["file_path"])
            assert os.path.exists(result["metadata_path"])

            # Verify metadata content
            with open(result["metadata_path"], "r") as f:
                metadata = json.load(f)
                assert metadata["audit_result_id"] == "audit123"
                assert metadata["governance"]["experimental_logic_used"] == False
                assert metadata["access_control"]["visibility"] == "internal"

    def test_governance_block_experimental_external(self):
        """Test governance block when experimental logic used for external export"""
        audit_result = {
            "audit_result_id": "audit123",
            "workflow_id": "wf1",
            "run_id": "run1",
            "signature_status": "approved",
            "governance_flags": {"experimental_logic_used": True}
        }

        # Create audit result file
        audit_dir = os.path.join(self.temp_dir, "audit", "wf1", "run1")
        os.makedirs(audit_dir, exist_ok=True)
        audit_path = os.path.join(audit_dir, "audit123.json")
        with open(audit_path, "w") as f:
            json.dump(audit_result, f)

        audit_result_ref = {
            "workflow_id": "wf1",
            "run_id": "run1",
            "audit_result_id": "audit123",
            "storage_path": audit_path
        }

        export_options = {"for_external_use": True}

        result = self.node.export_audit_report(audit_result_ref, export_options)

        assert result["status"] == "BLOCKED"
        assert result["error_type"] == "AI_GOVERNANCE_BLOCK"
        assert "review_task_id" in result["internal_detail"]

    def test_governance_block_hard_violations(self):
        """Test governance block due to hard AI violations"""
        audit_result = {
            "audit_result_id": "audit123",
            "workflow_id": "wf1",
            "run_id": "run1",
            "signature_status": "approved",
            "governance_flags": {"experimental_logic_used": False}
        }

        # Create audit result file
        audit_dir = os.path.join(self.temp_dir, "audit", "wf1", "run1")
        os.makedirs(audit_dir, exist_ok=True)
        audit_path = os.path.join(audit_dir, "audit123.json")
        with open(audit_path, "w") as f:
            json.dump(audit_result, f)

        audit_result_ref = {
            "workflow_id": "wf1",
            "run_id": "run1",
            "audit_result_id": "audit123",
            "storage_path": audit_path
        }

        export_options = {"for_external_use": False}

        with patch('backend.app.nodes.export_node.ai_gov') as mock_ai_gov:
            mock_ai_gov.check.return_value = {
                "status": "FAILED_HARD",
                "violations": {
                    "hard": 1,
                    "hard_violations": ["missing_disclaimer"]
                }
            }

            result = self.node.export_audit_report(audit_result_ref, export_options)

            assert result["status"] == "BLOCKED"
            assert result["error_type"] == "AI_GOVERNANCE_BLOCK"
            assert "review_task_id" in result["internal_detail"]

    def test_success_with_warnings_watermark(self):
        """Test successful export with warnings requiring watermark"""
        audit_result = {
            "audit_result_id": "audit123",
            "workflow_id": "wf1",
            "run_id": "run1",
            "signature_status": "approved",
            "governance_flags": {"experimental_logic_used": True}
        }

        # Create audit result file
        audit_dir = os.path.join(self.temp_dir, "audit", "wf1", "run1")
        os.makedirs(audit_dir, exist_ok=True)
        audit_path = os.path.join(audit_dir, "audit123.json")
        with open(audit_path, "w") as f:
            json.dump(audit_result, f)

        audit_result_ref = {
            "workflow_id": "wf1",
            "run_id": "run1",
            "audit_result_id": "audit123",
            "storage_path": audit_path
        }

        export_options = {"for_external_use": False}

        with patch('backend.app.nodes.export_node.ai_gov') as mock_ai_gov:
            mock_ai_gov.check.return_value = {"status": "CLEAN", "violations": {"hard": 0, "warnings": 0}}

            result = self.node.export_audit_report(audit_result_ref, export_options)

            assert result["status"] == "SUCCESS_WITH_WARNINGS"
            assert "EXPERIMENTAL_LOGIC_USED" in result["warnings"]

            # Verify watermark was applied
            with open(result["file_path"], "r") as f:
                exported_content = json.load(f)
                assert "watermark" in exported_content
                assert exported_content["watermark"]["applied"] == True

    def test_signature_validation_external(self):
        """Test signature validation for external use"""
        audit_result = {
            "audit_result_id": "audit123",
            "workflow_id": "wf1",
            "run_id": "run1",
            "signature_status": "pending_review",  # Not approved
            "governance_flags": {"experimental_logic_used": False}
        }

        # Create audit result file
        audit_dir = os.path.join(self.temp_dir, "audit", "wf1", "run1")
        os.makedirs(audit_dir, exist_ok=True)
        audit_path = os.path.join(audit_dir, "audit123.json")
        with open(audit_path, "w") as f:
            json.dump(audit_result, f)

        audit_result_ref = {
            "workflow_id": "wf1",
            "run_id": "run1",
            "audit_result_id": "audit123",
            "storage_path": audit_path
        }

        export_options = {"for_external_use": True}

        result = self.node.export_audit_report(audit_result_ref, export_options)

        assert result["status"] == "BLOCKED"
        assert result["error_type"] == "AI_GOVERNANCE_BLOCK"
        assert "MISSING_SIGNATURE" in result["internal_detail"]["violations_summary"]["hard"]

    def test_artifact_metadata_structure(self):
        """Test artifact metadata structure and completeness"""
        audit_result = {
            "audit_result_id": "audit123",
            "workflow_id": "wf1",
            "run_id": "run1",
            "signature_status": "approved",
            "governance_flags": {"experimental_logic_used": False},
            "metadata": {
                "ci_scan_report_ref": "/storage/scans/scan1.json",
                "analysis_refs": ["/storage/analysis/analysis1.json"]
            }
        }

        # Create audit result file
        audit_dir = os.path.join(self.temp_dir, "audit", "wf1", "run1")
        os.makedirs(audit_dir, exist_ok=True)
        audit_path = os.path.join(audit_dir, "audit123.json")
        with open(audit_path, "w") as f:
            json.dump(audit_result, f)

        audit_result_ref = {
            "workflow_id": "wf1",
            "run_id": "run1",
            "audit_result_id": "audit123",
            "storage_path": audit_path
        }

        with patch('backend.app.nodes.export_node.ai_gov') as mock_ai_gov:
            mock_ai_gov.check.return_value = {"status": "CLEAN", "violations": {"hard": 0, "warnings": 0}}

            result = self.node.export_audit_report(audit_result_ref)

            # Verify metadata file exists and has correct structure
            with open(result["metadata_path"], "r") as f:
                metadata = json.load(f)

                required_fields = [
                    "artifact_id", "audit_result_id", "workflow_id", "run_id",
                    "file_name", "format", "ui_link", "storage_path",
                    "generated_by", "generated_at", "provenance",
                    "governance", "access_control", "file_hash"
                ]

                for field in required_fields:
                    assert field in metadata

                # Verify provenance links
                assert len(metadata["provenance"]["analysis_snapshot_refs"]) > 0
                assert metadata["provenance"]["ci_scan_report_ref"] is not None

                # Verify UI link format
                assert metadata["ui_link"].startswith("/ui/exports/")

    def test_storage_path_conventions(self):
        """Test storage path conventions"""
        audit_result = {
            "audit_result_id": "audit123",
            "workflow_id": "wf1",
            "run_id": "run1",
            "signature_status": "approved"
        }

        # Create audit result file
        audit_dir = os.path.join(self.temp_dir, "audit", "wf1", "run1")
        os.makedirs(audit_dir, exist_ok=True)
        audit_path = os.path.join(audit_dir, "audit123.json")
        with open(audit_path, "w") as f:
            json.dump(audit_result, f)

        audit_result_ref = {
            "workflow_id": "wf1",
            "run_id": "run1",
            "audit_result_id": "audit123",
            "storage_path": audit_path
        }

        with patch('backend.app.nodes.export_node.ai_gov') as mock_ai_gov:
            mock_ai_gov.check.return_value = {"status": "CLEAN", "violations": {"hard": 0, "warnings": 0}}

            result = self.node.export_audit_report(audit_result_ref)

            # Verify path structure contains the expected components
            assert "exports" in result["file_path"]
            assert "dev" in result["file_path"]
            assert "wf1" in result["file_path"]
            assert "run1" in result["file_path"]
            assert "audit123" in result["file_path"]
            assert result["file_path"].endswith("audit_report_audit123.json")

            assert "exports" in result["metadata_path"]
            assert "dev" in result["metadata_path"]
            assert result["metadata_path"].endswith("metadata.json")

            # Verify artifact directory structure
            artifact_dir = os.path.dirname(result["file_path"])
            assert os.path.exists(artifact_dir)
            assert os.path.exists(os.path.join(artifact_dir, "metadata.json"))

    def test_artifact_id_uniqueness(self):
        """Test that artifact IDs are unique"""
        audit_result = {
            "audit_result_id": "audit123",
            "workflow_id": "wf1",
            "run_id": "run1",
            "signature_status": "approved"
        }

        # Create audit result file
        audit_dir = os.path.join(self.temp_dir, "audit", "wf1", "run1")
        os.makedirs(audit_dir, exist_ok=True)
        audit_path = os.path.join(audit_dir, "audit123.json")
        with open(audit_path, "w") as f:
            json.dump(audit_result, f)

        audit_result_ref = {
            "workflow_id": "wf1",
            "run_id": "run1",
            "audit_result_id": "audit123",
            "storage_path": audit_path
        }

        with patch('backend.app.nodes.export_node.ai_gov') as mock_ai_gov:
            mock_ai_gov.check.return_value = {"status": "CLEAN", "violations": {"hard": 0, "warnings": 0}}

            result1 = self.node.export_audit_report(audit_result_ref)
            result2 = self.node.export_audit_report(audit_result_ref)

            # Artifact IDs should be different
            assert result1["artifact_id"] != result2["artifact_id"]

            # Each artifact should be in its own subdirectory under the audit result directory
            # So they should have the same parent directory (audit result level)
            parent_dir1 = os.path.dirname(os.path.dirname(result1["file_path"]))
            parent_dir2 = os.path.dirname(os.path.dirname(result2["file_path"]))
            assert parent_dir1 == parent_dir2

            # But different artifact subdirectories
            artifact_dir1 = os.path.dirname(result1["file_path"])
            artifact_dir2 = os.path.dirname(result2["file_path"])
            assert artifact_dir1 != artifact_dir2

    def test_invalid_audit_result_ref(self):
        """Test handling of invalid audit_result_ref"""
        invalid_ref = {"workflow_id": "wf1"}  # Missing required fields

        result = self.node.export_audit_report(invalid_ref)

        assert result["status"] == "BLOCKED"
        assert result["error_type"] == "INVALID_INPUT"

    def test_missing_audit_result_snapshot(self):
        """Test handling when audit result snapshot cannot be loaded"""
        audit_result_ref = {
            "workflow_id": "wf1",
            "run_id": "run1",
            "audit_result_id": "nonexistent"
        }

        result = self.node.export_audit_report(audit_result_ref)

        assert result["status"] == "BLOCKED"
        assert result["error_type"] == "SCHEMA_MISMATCH"
