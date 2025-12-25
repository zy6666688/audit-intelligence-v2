"""
Test suite for ImageRecognitionAI node (restructured as ticket fact structuring engine)
"""

import json
import pytest
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

from backend.app.nodes.ai_nodes import ImageRecognitionAI
from backend.app.core.config import settings


class TestImageRecognitionAI:
    """Test cases for the restructured ImageRecognitionAI"""

    def setup_method(self):
        """Setup test environment"""
        self.node = ImageRecognitionAI()
        # Create temporary directory for tests
        self.temp_dir = tempfile.mkdtemp()
        settings.STORAGE_PATH = self.temp_dir

    def teardown_method(self):
        """Cleanup test environment"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_invoice_template_extraction(self):
        """Test extraction of invoice fields using invoice template"""
        ocr_text = """
        发票代码：1234567890
        发票号码：00123456
        开票日期：2024-01-15
        销方名称：北京科技有限公司
        销方税号：91110000123456789X
        购方名称：上海贸易有限公司
        购方税号：91320000123456789A
        金额：10000.00元
        税额：600.00
        """

        structured_fields, extraction_metadata = self.node.extract_ticket_facts(
            ocr_text=ocr_text,
            template_type="invoice",
            extraction_method="rule",
            confidence_threshold=0.7
        )

        # Verify structured fields
        assert "invoice_number" in structured_fields
        assert structured_fields["invoice_number"]["value"] == "00123456"
        assert "evidence" in structured_fields["invoice_number"]
        assert structured_fields["invoice_number"]["confidence"] >= 0.7

        assert "amount" in structured_fields
        assert structured_fields["amount"]["value"] == "10000.00"
        assert "seller_name" in structured_fields
        assert structured_fields["seller_name"]["value"] == "北京科技有限公司"

        # Verify metadata
        assert len(extraction_metadata) > 0
        meta = extraction_metadata[0]
        assert meta["extraction_method"] == "rule"
        assert meta["template_type"] == "invoice"
        assert meta["fields_extracted"] > 0
        assert "text_hash" in meta

    def test_receipt_template_extraction(self):
        """Test extraction of receipt fields using receipt template"""
        ocr_text = """
        收据号码：R2024001234
        收款人：张三会计
        付款人：李四客户
        金额：5000.00元
        日期：2024年1月20日
        """

        structured_fields, extraction_metadata = self.node.extract_ticket_facts(
            ocr_text=ocr_text,
            template_type="receipt",
            extraction_method="rule",
            confidence_threshold=0.7
        )

        # Verify structured fields
        assert "receipt_number" in structured_fields
        assert structured_fields["receipt_number"]["value"] == "R2024001234"
        assert "amount" in structured_fields
        assert structured_fields["amount"]["value"] == "5000.00"
        assert "payee" in structured_fields
        assert "receipt_date" in structured_fields

        # Verify evidence anchoring
        for field_name, field_data in structured_fields.items():
            if field_data:
                assert "evidence" in field_data
                assert "start" in field_data["evidence"]
                assert "end" in field_data["evidence"]
                assert "method" in field_data["evidence"]

    def test_confidence_threshold_and_human_review_flags(self):
        """Test confidence threshold application and human review flag setting"""
        ocr_text = """
        合同编号：HT20240001
        合同金额：20000.00元
        生效日期：2024-02-01
        甲方：甲公司
        乙方：乙公司
        """

        structured_fields, extraction_metadata = self.node.extract_ticket_facts(
            ocr_text=ocr_text,
            template_type="contract",
            extraction_method="rule",
            confidence_threshold=0.9  # High threshold
        )

        # Check if low confidence fields are flagged
        low_confidence_fields = [f for f in structured_fields.values()
                               if f and f.get("confidence", 0) < 0.9]

        for field in low_confidence_fields:
            assert "needs_human_review" in field
            assert "review_reason" in field
            assert "低于阈值" in field["review_reason"]

    def test_custom_template(self):
        """Test custom template functionality"""
        custom_fields_json = json.dumps({
            "custom_field": {
                "type": "reference",
                "description": "自定义字段",
                "patterns": [r"自定义字段[为:：]*([A-Za-z0-9]+)"]
            }
        })

        ocr_text = "自定义字段：ABC123"

        structured_fields, extraction_metadata = self.node.extract_ticket_facts(
            ocr_text=ocr_text,
            template_type="custom",
            custom_fields=custom_fields_json,
            extraction_method="rule",
            confidence_threshold=0.7
        )

        assert "custom_field" in structured_fields
        assert structured_fields["custom_field"]["value"] == "ABC123"

    def test_invalid_custom_template_error_handling(self):
        """Test error handling for malformed custom template JSON"""
        structured_fields, extraction_metadata = self.node.extract_ticket_facts(
            ocr_text="test text",
            template_type="custom",
            custom_fields="invalid json {",
            extraction_method="rule",
            confidence_threshold=0.7
        )

        # Should have error in metadata
        assert len(extraction_metadata) > 0
        error_found = any(meta.get("type") == "error" and "JSON格式错误" in meta.get("message", "")
                         for meta in extraction_metadata)
        assert error_found

    def test_empty_input_handling(self):
        """Test handling of empty or None input"""
        # Test None input
        structured_fields, extraction_metadata = self.node.extract_ticket_facts(
            ocr_text=None,
            template_type="invoice",
            extraction_method="rule"
        )

        assert len(structured_fields) == 0
        assert len(extraction_metadata) > 0
        assert any(meta.get("type") == "error" for meta in extraction_metadata)

        # Test empty string
        structured_fields, extraction_metadata = self.node.extract_ticket_facts(
            ocr_text="",
            template_type="invoice",
            extraction_method="rule"
        )

        assert len(structured_fields) == 0
        assert len(extraction_metadata) > 0
        assert any(meta.get("type") == "error" for meta in extraction_metadata)

    def test_extraction_metadata_completeness(self):
        """Test that extraction metadata contains all required fields"""
        ocr_text = "发票号码：12345 金额：1000.00元"

        structured_fields, extraction_metadata = self.node.extract_ticket_facts(
            ocr_text=ocr_text,
            template_type="invoice",
            extraction_method="hybrid",
            confidence_threshold=0.7
        )

        assert len(extraction_metadata) > 0
        meta = extraction_metadata[0]

        required_fields = [
            "extraction_method", "template_type", "total_fields_attempted",
            "fields_extracted", "low_confidence_fields", "timestamp",
            "text_length", "text_hash"
        ]

        for field in required_fields:
            assert field in meta

        assert meta["extraction_method"] == "hybrid"
        assert meta["template_type"] == "invoice"
        assert meta["text_length"] == len(ocr_text)

    @patch('backend.app.nodes.ai_nodes.has_llm_config')
    def test_fallback_behavior_without_llm(self, mock_has_llm):
        """Test fallback to rule-based extraction when LLM config is unavailable"""
        mock_has_llm.return_value = False

        ocr_text = "发票号码：12345 金额：1000.00元"

        structured_fields, extraction_metadata = self.node.extract_ticket_facts(
            ocr_text=ocr_text,
            template_type="invoice",
            extraction_method="hybrid",
            model="test-model",
            provider="test-provider"
        )

        # Should still extract fields using rules
        assert len(structured_fields) > 0
        assert any(meta["extraction_method"] == "hybrid" for meta in extraction_metadata)

        # Verify has_llm_config was called
        mock_has_llm.assert_called_once()

    def test_evidence_anchoring_completeness(self):
        """Test that all extracted fields have proper evidence anchoring"""
        ocr_text = """
        发票号码：INV20240001
        金额：2500.50元
        销方：测试公司
        """

        structured_fields, extraction_metadata = self.node.extract_ticket_facts(
            ocr_text=ocr_text,
            template_type="invoice",
            extraction_method="rule",
            confidence_threshold=0.7
        )

        # Check evidence anchoring for each extracted field
        for field_name, field_data in structured_fields.items():
            if field_data and isinstance(field_data, dict):
                assert "evidence" in field_data
                evidence = field_data["evidence"]
                assert "start" in evidence
                assert "end" in evidence
                assert "text" in evidence
                assert "method" in evidence

                # Verify evidence text matches original text snippet
                start, end = evidence["start"], evidence["end"]
                assert evidence["text"] == ocr_text[start:end]
