"""
测试 HumanReviewNode - 审计决策登记器 (简化版本)
"""

import pytest
import tempfile
from backend.app.nodes.ai_nodes import HumanReviewNode
from backend.app.nodes.base_node import ExecutionContext
from backend.app.core.config import settings


class TestHumanReviewNode:

    def setup_method(self):
        """每个测试前的设置"""
        self.temp_dir = tempfile.mkdtemp()
        settings.STORAGE_PATH = self.temp_dir

    def test_create_review_task_api(self):
        """测试创建人工复核任务API"""
        node = HumanReviewNode()
        ctx = ExecutionContext(workflow_id="wf_test", run_id="run_test", node_exec_id="hr")

        result = node.execute({
            "action": "create_task",
            "audit_result_id": "audit_123",
            "trigger_source": "ai_gov",
            "trigger_reason": "AI governance violation detected",
            "affected_rule_ids": ["rule_1", "rule_2"],
            "analysis_refs": ["analysis_456"]
        }, ctx)

        assert result.status.name == "SUCCESS"

        response = result.outputs["result"]

        assert response["status"] == "created"
        assert "task_id" in response
        assert response["task_id"].startswith("hr_")
        assert "review_task_id" in response
        assert "task_payload" in response

        # 验证任务payload结构
        payload = response["task_payload"]
        assert payload["audit_result_id"] == "audit_123"
        assert payload["trigger_source"] == "ai_gov"
        assert payload["status"] == "pending_review"
        assert payload["affected_rule_ids"] == ["rule_1", "rule_2"]
        assert payload["analysis_refs"] == ["analysis_456"]
