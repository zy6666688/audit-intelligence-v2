"""
测试 TextUnderstandingAI - 文本事实结构化引擎
"""

import pytest
import json
from unittest.mock import patch
from backend.app.nodes.ai_nodes import TextUnderstandingAI
from backend.app.nodes.base_node import ExecutionContext


class TestTextUnderstandingAI:

    def test_contract_template_extraction(self):
        """测试合同模板的字段抽取"""
        text = """
        甲方：北京科技有限公司
        乙方：上海贸易有限公司
        合同金额：人民币500,000.00元
        合同生效日期：2024年1月1日
        合同到期日：2024年12月31日
        甲方应按时支付合同款项，乙方应按时交付货物。
        若遇不可抗力因素，则双方协商处理。
        """

        node = TextUnderstandingAI()
        ctx = ExecutionContext(workflow_id="wf_test", run_id="run_test", node_exec_id="text_ai")

        res = node.execute({
            "text_data": text,
            "template_type": "contract",
            "extraction_method": "rule",
            "confidence_threshold": 0.7
        }, ctx)

        assert res.status.name == "SUCCESS"

        structured_fields, extraction_metadata = res.outputs["structured_fields"], res.outputs["extraction_metadata"]

        # 验证至少抽取到了某些字段
        assert len(structured_fields) > 0

        # 验证字段结构
        first_field_name = next(iter(structured_fields.keys()))
        first_field = structured_fields[first_field_name]

        assert "value" in first_field
        assert "confidence" in first_field
        assert "evidence" in first_field
        assert "extraction_info" in first_field

        # 验证原文锚定
        evidence = first_field["evidence"]
        assert "start" in evidence
        assert "end" in evidence
        assert "text" in evidence
        assert evidence["method"] == "rule"

        # 验证元数据
        assert len(extraction_metadata) == 1
        meta = extraction_metadata[0]
        assert meta["extraction_method"] == "rule"
        assert meta["template_type"] == "contract"

    def test_custom_template(self):
        """测试自定义字段模板"""
        text = "项目编号：PROJ-2024-001，预算：200000元"

        custom_template = {
            "project_id": {
                "type": "reference",
                "description": "项目编号",
                "patterns": [r"项目编号[：:]([^\s,。]+)"]
            },
            "budget": {
                "type": "currency",
                "description": "预算金额",
                "patterns": [r"预算[：:]\d+(?:\.\d+)?元"]
            }
        }

        node = TextUnderstandingAI()
        ctx = ExecutionContext(workflow_id="wf_test", run_id="run_test", node_exec_id="text_ai")

        res = node.execute({
            "text_data": text,
            "template_type": "custom",
            "custom_fields": json.dumps(custom_template),
            "extraction_method": "rule"
        }, ctx)

        assert res.status.name == "SUCCESS"

        structured_fields = res.outputs["structured_fields"]

        # 验证自定义字段被正确抽取
        assert "project_id" in structured_fields
        assert "budget" in structured_fields

    def test_extraction_metadata_completeness(self):
        """测试抽取元数据的完整性"""
        text = "这是一个测试文本，包含一些信息。"

        node = TextUnderstandingAI()
        ctx = ExecutionContext(workflow_id="wf_test", run_id="run_test", node_exec_id="text_ai")

        res = node.execute({
            "text_data": text,
            "template_type": "contract",
            "extraction_method": "rule"
        }, ctx)

        assert res.status.name == "SUCCESS"

        extraction_metadata = res.outputs["extraction_metadata"]
        assert len(extraction_metadata) == 1

        meta = extraction_metadata[0]

        # 验证所有必需的元数据字段
        required_fields = [
            "extraction_method", "template_type", "total_fields_attempted",
            "fields_extracted", "low_confidence_fields", "timestamp",
            "text_length", "text_hash"
        ]

        for field in required_fields:
            assert field in meta

        assert meta["extraction_method"] == "rule"
        assert meta["template_type"] == "contract"
        assert meta["text_length"] == len(text)
        assert isinstance(meta["text_hash"], str)
        assert len(meta["text_hash"]) == 16  # SHA256前16字符