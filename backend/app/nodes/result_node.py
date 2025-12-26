import json
import os
import hashlib
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime
from enum import Enum

from .base_node import BaseNode, ExecutionContext
from app.schemas.audit_result import AuditResult, Finding, EvidenceRef, Signature
from app.core.config import settings


class SignatureStatus(Enum):
    """审计结果签名状态枚举"""
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    ISSUED = "issued"


class ResultGenerationNode(BaseNode):
    """
    ResultGenerationNode v2 - 审计结果结构化生成器

    核心定位：把规则判断、AI解释、人工复核状态"结构化、版本化、可签字并可追溯"成正式的审计结果快照

    不是"再算一次"，而是"把现有事实与判断封装成档案级对象"

    能力分层：
    ├── 汇总层：收集RuleCalculation/AnalysisReasoning/HumanReview的输入
    ├── 结构化层：生成可归档的AuditResult（而非仅文本）
    ├── 证据绑定层：每个结果项引用证据锚点（rows/file/node id/snapshot id）
    ├── 版本化层：每次生成写入持久化快照（含metadata、生成途径、模型id），历史版本不可篡改
    └── 签字流程层：支持prepared/reviewed/approved/issued等签字流程
    """

    NODE_TYPE = "ResultGenerationNode"
    VERSION = "2.0.0"
    CATEGORY = "audit"
    DISPLAY_NAME = "审计结果结构化生成器"
    NODE_TYPE = "ResultGenerationNode"
    VERSION = "1.0.0"
    DISPLAY_NAME = "Result Generation"
    CATEGORY = "audit"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "workflow_id": {"type": "STRING", "required": False},
            "run_id": {"type": "STRING", "required": False},
            "findings": {"type": "LIST", "required": True},  # RuleCalculation的rule hits
            "analysis_results": {"type": "LIST", "required": False},  # AnalysisReasoning的snapshots
            "human_review_states": {"type": "LIST", "required": False},  # HumanReview的decisions
            "document_meta": {"type": "DICT", "required": False},
            "client_name": {"type": "STRING", "required": False},
            "period_start": {"type": "STRING", "required": False},
            "period_end": {"type": "STRING", "required": False},
            "report_type": {"type": "STRING", "required": False, "default": "audit_report"},
        }

    RETURN_TYPES = ("DICT",)
    RETURN_NAMES = ("audit_result",)
    FUNCTION = "generate_audit_result"

    def generate_audit_result(self, workflow_id: str = None, run_id: str = None,
                             findings: List[Dict[str, Any]] = None,
                             analysis_results: List[Dict[str, Any]] = None,
                             human_review_states: List[Dict[str, Any]] = None,
                             document_meta: Dict[str, Any] = None,
                             client_name: str = None,
                             period_start: str = None,
                             period_end: str = None,
                             report_type: str = "audit_report") -> Dict[str, Any]:
        """
        生成审计结果快照 - 结构化、版本化、可签字的审计结论

        Args:
            workflow_id: 工作流ID
            run_id: 运行ID
            findings: RuleCalculation的规则触发结果
            analysis_results: AnalysisReasoning的分析快照
            human_review_states: HumanReview的决策状态
            document_meta: 文档元信息
            client_name: 客户名称
            period_start/end: 审计期间
            report_type: 报告类型

        Returns:
            完整的审计结果快照
        """

        # 初始化AuditResult
        audit_result_id = str(uuid.uuid4())
        generated_at = datetime.utcnow()

        # 第一层：汇总所有输入
        consolidated_inputs = self._consolidate_inputs(
            findings or [],
            analysis_results or [],
            human_review_states or []
        )

        # 第二层：生成结构化结果
        structured_result = self._create_structured_result(
            audit_result_id, workflow_id, run_id, generated_at,
            consolidated_inputs, document_meta, client_name,
            period_start, period_end, report_type
        )

        # 第三层：证据绑定
        evidence_bound_result = self._bind_evidence_refs(structured_result, consolidated_inputs)

        # 第四层：版本化和快照持久化
        versioned_result = self._create_versioned_snapshot(evidence_bound_result, generated_at)

        # 第五层：签字流程初始化
        signed_result = self._initialize_signature_workflow(versioned_result)

        # 返回完整结果
        return signed_result

    def _extract_ruleset_version(self, consolidated_inputs: Dict) -> str:
        """从输入中提取规则集版本"""
        for finding in consolidated_inputs["findings"]:
            if finding.get("ruleset_version"):
                return finding["ruleset_version"]
        return "unknown"

    def _extract_models_used(self, consolidated_inputs: Dict) -> List[Dict]:
        """从输入中提取使用的模型信息"""
        models = []
        for analysis in consolidated_inputs["analysis_results"]:
            model_info = analysis.get("model_info", {})
            if model_info and model_info not in [m.get("model_info") for m in models]:
                models.append({
                    "model_name": model_info.get("model_name", "unknown"),
                    "version": model_info.get("version", "unknown"),
                    "provider": model_info.get("provider", "unknown")
                })
        return models

    def _persist_snapshot(self, result: Dict, generated_at: datetime) -> str:
        """持久化快照到存储"""
        storage_root = getattr(settings, "STORAGE_PATH", "./storage")
        audit_dir = os.path.join(
            storage_root, "audit",
            result.get("workflow_id", "unknown_workflow"),
            result.get("run_id", "unknown_run")
        )
        os.makedirs(audit_dir, exist_ok=True)

        file_name = f"audit_result_{result['audit_result_id']}.json"
        file_path = os.path.join(audit_dir, file_name)

        # 原子写入：先写临时文件，再重命名
        temp_path = file_path + ".tmp"
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2, sort_keys=True, default=str)

        os.rename(temp_path, file_path)
        return file_path

    def _consolidate_inputs(self, findings: List[Dict], analysis_results: List[Dict],
                           human_review_states: List[Dict]) -> Dict[str, Any]:
        """第一层：汇总所有上游输入"""
        consolidated = {
            "findings": findings,
            "analysis_results": analysis_results,
            "human_review_states": human_review_states,
            "governance_flags": {},
            "analysis_refs": [],
            "evidence_refs": [],
            "requires_human_review": False,
            "experimental_logic_used": False,
            "critical_findings_count": 0
        }

        # 汇总governance flags
        all_sources = findings + analysis_results + human_review_states
        for source in all_sources:
            source_flags = source.get("governance_flags", {})
            if source_flags.get("experimental_logic_used"):
                consolidated["experimental_logic_used"] = True
            if source_flags.get("requires_human_review"):
                consolidated["requires_human_review"] = True
            if source_flags.get("critical"):
                consolidated["critical_findings_count"] += 1
                # 关键发现自动需要人工审核
                consolidated["requires_human_review"] = True

        # 收集analysis_refs
        consolidated["analysis_refs"] = [
            ar.get("snapshot_id") or ar.get("analysis_id")
            for ar in analysis_results
            if ar.get("snapshot_id") or ar.get("analysis_id")
        ]

        # 收集evidence_refs
        for finding in findings:
            consolidated["evidence_refs"].extend(finding.get("evidence_refs", []))

        return consolidated

    def _create_structured_result(self, audit_result_id: str, workflow_id: str, run_id: str,
                                generated_at: datetime, consolidated_inputs: Dict,
                                document_meta: Dict, client_name: str, period_start: str,
                                period_end: str, report_type: str) -> Dict[str, Any]:
        """第二层：创建结构化审计结果"""

        # 构建document_meta
        full_document_meta = {
            "title": f"Audit Report - {client_name or 'Unknown Client'}",
            "client_name": client_name,
            "period_start": period_start,
            "period_end": period_end,
            "report_type": report_type,
            "confidentiality": "internal",
            **(document_meta or {})
        }

        # 生成高层摘要
        summary = self._generate_executive_summary(consolidated_inputs, full_document_meta)

        # 构建findings列表
        structured_findings = []
        for finding in consolidated_inputs["findings"]:
            structured_finding = {
                "finding_id": finding.get("finding_id") or finding.get("rule_id") or hashlib.sha256(
                    json.dumps(finding, sort_keys=True).encode()
                ).hexdigest()[:12],
                "rule_id": finding.get("rule_id"),
                "description": finding.get("description", ""),
                "amount_impact": finding.get("amount_impact"),
                "risk_level": finding.get("risk_level", "medium"),
                "evidence_refs": finding.get("evidence_refs", []),
                "analysis_refs": consolidated_inputs["analysis_refs"],
                "human_review_status": finding.get("human_review_status", {}),
                "ai_explanation": finding.get("ai_explanation"),
                "correlation_items": finding.get("correlation_items", []),
                "hypothesis_items": finding.get("hypothesis_items", [])
            }
            structured_findings.append(structured_finding)

        # 构建provenance
        provenance = {
            "generated_by": self.NODE_TYPE,
            "generated_at": generated_at.isoformat(),
            "input_sources": {
                "findings_count": len(consolidated_inputs["findings"]),
                "analysis_results_count": len(consolidated_inputs["analysis_results"]),
                "human_review_states_count": len(consolidated_inputs["human_review_states"])
            },
            "analysis_refs": consolidated_inputs["analysis_refs"],
            "ruleset_version": self._extract_ruleset_version(consolidated_inputs),
            "models_used": self._extract_models_used(consolidated_inputs),
            "generation_log_hash": ""
        }

        # 构建governance_flags
        governance_flags = {
            "experimental_logic_used": consolidated_inputs["experimental_logic_used"],
            "requires_human_review": consolidated_inputs["requires_human_review"],
            "critical_findings_count": consolidated_inputs["critical_findings_count"],
            "ai_governance_violations": [],
            "ci_scan_report_ref": None
        }

        return {
            "audit_result_id": audit_result_id,
            "workflow_id": workflow_id,
            "run_id": run_id,
            "version": "1.0",
            "generated_at": generated_at.isoformat(),
            "document_meta": full_document_meta,
            "summary": summary,
            "findings": structured_findings,
            "overall_opinion": None,  # 只能由人工最终填写
            "provenance": provenance,
            "governance_flags": governance_flags,
            "attachments": [],
            "auditlog_refs": []
        }

    def _generate_executive_summary(self, consolidated_inputs: Dict, document_meta: Dict) -> str:
        """生成执行摘要"""
        findings_count = len(consolidated_inputs["findings"])
        critical_count = consolidated_inputs["critical_findings_count"]
        experimental = consolidated_inputs["experimental_logic_used"]

        summary_parts = [
            f"在{findings_count}个发现中，",
            f"发现{critical_count}个关键风险项"
        ]

        if experimental:
            summary_parts.append("（包含实验性逻辑，建议人工复核）")

        if critical_count > 0:
            summary_parts.append("，建议重点关注")

        return "".join(summary_parts) + "。"

    def _bind_evidence_refs(self, structured_result: Dict, consolidated_inputs: Dict) -> Dict:
        """第三层：证据绑定"""
        # 为每个finding建立evidence_trace
        evidence_refs = consolidated_inputs["evidence_refs"]
        evidence_trace = {
            "total_evidence_refs": len(evidence_refs),
            "evidence_types": {"evidence_ref": len(evidence_refs)},  # 简化为单一类型统计
            "missing_evidence_count": 0
        }

        # 检查缺失的evidence
        for finding in structured_result["findings"]:
            if not finding["evidence_refs"]:
                evidence_trace["missing_evidence_count"] += 1

        structured_result["evidence_trace"] = evidence_trace
        return structured_result

    def _create_versioned_snapshot(self, result: Dict, generated_at: datetime) -> Dict:
        """第四层：创建版本化快照"""
        # 创建哈希计算用的副本，排除动态生成和时间戳相关字段
        hash_data = result.copy()
        hash_data.pop("audit_result_id", None)  # 排除动态ID
        hash_data.pop("generated_at", None)
        hash_data.pop("immutable_hash", None)  # 避免循环引用
        hash_data.pop("storage_path", None)    # 排除存储路径

        # 清理provenance中的动态字段
        hash_data["provenance"] = hash_data.get("provenance", {}).copy()
        hash_data["provenance"].pop("generated_at", None)
        hash_data["provenance"].pop("generation_log_hash", None)

        # 计算不可变哈希
        canonical_json = json.dumps(hash_data, ensure_ascii=False, sort_keys=True, default=str)
        immutable_hash = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

        result["immutable_hash"] = immutable_hash
        result["provenance"]["generation_log_hash"] = immutable_hash

        # 持久化存储
        storage_path = self._persist_snapshot(result, generated_at)
        result["storage_path"] = storage_path

        return result

    def _initialize_signature_workflow(self, result: Dict) -> Dict:
        """第五层：初始化签字流程"""
        # 初始化签名状态
        result["signatures"] = {
            "prepared_by": None,
            "reviewed_by": None,
            "approved_by": None
        }

        result["signature_status"] = SignatureStatus.DRAFT.value

        # 如果需要人工复核，设置为pending_review
        if result["governance_flags"]["requires_human_review"]:
            result["signature_status"] = SignatureStatus.PENDING_REVIEW.value

        return result

    def _extract_ruleset_version(self, consolidated_inputs: Dict) -> str:
        """从输入中提取规则集版本"""
        for finding in consolidated_inputs["findings"]:
            if finding.get("ruleset_version"):
                return finding["ruleset_version"]
        return "unknown"

    def _extract_models_used(self, consolidated_inputs: Dict) -> List[Dict]:
        """从输入中提取使用的模型信息"""
        models = []
        for analysis in consolidated_inputs["analysis_results"]:
            model_info = analysis.get("model_info", {})
            if model_info and model_info not in [m.get("model_info") for m in models]:
                models.append({
                    "model_name": model_info.get("model_name", "unknown"),
                    "version": model_info.get("version", "unknown"),
                    "provider": model_info.get("provider", "unknown")
                })
        return models

    def _persist_snapshot(self, result: Dict, generated_at: datetime) -> str:
        """持久化快照到存储"""
        storage_root = getattr(settings, "STORAGE_PATH", "./storage")
        audit_dir = os.path.join(
            storage_root, "audit",
            result.get("workflow_id", "unknown_workflow"),
            result.get("run_id", "unknown_run")
        )
        os.makedirs(audit_dir, exist_ok=True)

        file_name = f"audit_result_{result['audit_result_id']}.json"
        file_path = os.path.join(audit_dir, file_name)

        # 原子写入：先写临时文件，再重命名
        temp_path = file_path + ".tmp"
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2, sort_keys=True, default=str)

        os.rename(temp_path, file_path)
        return file_path

    # Default bridge will call this via BaseNode._execute_pure
    def _execute_pure(self, inputs: Dict[str, Any], context: ExecutionContext) -> Dict[str, Any]:
        """
        执行审计结果生成的纯函数版本
        """
        # 提取输入参数
        workflow_id = inputs.get("workflow_id") or context.workflow_id
        run_id = inputs.get("run_id") or context.run_id
        findings = inputs.get("findings", [])
        analysis_results = inputs.get("analysis_results", [])
        human_review_states = inputs.get("human_review_states", [])
        document_meta = inputs.get("document_meta", {})
        client_name = inputs.get("client_name")
        period_start = inputs.get("period_start")
        period_end = inputs.get("period_end")
        report_type = inputs.get("report_type", "audit_report")

        # 治理检查：拒绝直接的DataFrame输入
        for k, v in inputs.items():
            if k.lower().endswith("dataframe") or k == "dataframe":
                raise ValueError("ResultGenerationNode does not accept DataFrame inputs directly. Use structured audit_result/findings inputs.")

        # 执行结果生成
        audit_result = self.generate_audit_result(
            workflow_id=workflow_id,
            run_id=run_id,
            findings=findings,
            analysis_results=analysis_results,
            human_review_states=human_review_states,
            document_meta=document_meta,
            client_name=client_name,
            period_start=period_start,
            period_end=period_end,
            report_type=report_type
        )

        # 添加执行上下文到证据链
        try:
            context.add_evidence(
                f"audit_result_generation:{audit_result.get('audit_result_id')}",
                {
                    "operation": "audit_result_created",
                    "input_sources": {
                        "findings_count": len(findings),
                        "analysis_results_count": len(analysis_results),
                        "human_review_states_count": len(human_review_states)
                    },
                    "generated_at": audit_result.get("generated_at"),
                    "storage_path": audit_result.get("storage_path")
                }
            )
        except Exception as e:
            print(f"Warning: Failed to add evidence to context: {e}")

        # 返回单个字典结果（符合RETURN_TYPES定义）
        return audit_result


# Register mapping for compatibility (imported by registry loader)
NODE_CLASS_MAPPINGS = {
    "ResultGenerationNode": ResultGenerationNode
}


