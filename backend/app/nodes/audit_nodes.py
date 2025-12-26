"""
Audit Nodes Module
Enhanced with workflow orchestration support
"""

from typing import Any, Dict, Tuple, Optional, List
import pandas as pd
import hashlib
import json
import os
from datetime import datetime
from pathlib import Path

from app.core.audit_service import AuditService
from app.core.config import settings

from .base_node import BaseNode, ExecutionContext, NodeMetadata, NodeResult, NodeStatus, FailurePolicy
from app.core.database import SessionLocal
from app.models.rule_metrics import RuleHit


class AuditCheckNode(BaseNode):
    """
    AuditCheckNode v2 - 可审计的判断声明体

    核心定位：不是"判断节点"，而是"可被审计的判断声明体"
    治理原则：每个判断都必须声明其治理属性、证据锚点和审计留痕

    能力分层：
    ├── Decision Layer        （结果声明）
    ├── Governance Layer      （治理声明）
    ├── Evidence Layer        （证据锚定）
    └── Audit Trail Layer     （审计留痕）
    """

    # Node configuration
    NODE_TYPE = "AuditCheckNode"
    VERSION = "2.0.0"
    CATEGORY = "audit"
    DISPLAY_NAME = "可审计判断声明体"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "amount": {"type": "FLOAT", "required": True},
            "threshold": {"type": "FLOAT", "required": True},
            "rule_context": {"type": "DICT", "required": False},  # 规则上下文信息
            "source_artifacts": {"type": "LIST", "required": False},  # 来源artifact IDs
            "workflow_context": {"type": "DICT", "required": False},  # 工作流上下文
        }

    RETURN_TYPES = ("DICT",)  # 返回治理声明结构
    RETURN_NAMES = ("audit_assertion",)  # 审计判断声明
    FUNCTION = "execute_audit_check"
    
    @classmethod
    def INPUT_TYPES_LEGACY(cls) -> Dict[str, Any]:
        return {
            "required": {
                "amount": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1000000.0}),
                "threshold": ("FLOAT", {"default": 1000.0}),
            }
        }
    
    RETURN_TYPES = ("BOOLEAN", "STRING")
    RETURN_NAMES = ("is_valid", "message")
    FUNCTION = "check"
    OUTPUT_NODE = False
    
    def __init__(self, metadata: Optional[NodeMetadata] = None):
        """Initialize with governance-aware metadata"""
        if metadata is None:
            metadata = NodeMetadata(
                node_type=self.NODE_TYPE,
                version=self.VERSION,
                display_name=self.DISPLAY_NAME,
                category=self.CATEGORY,
                failure_policy=FailurePolicy.RETRY,
                timeout_seconds=10,  # Governance checks may take longer
                cache_results=False  # Governance declarations should not be cached
            )
        super().__init__(metadata)
    
    def execute_audit_check(self, amount: float, threshold: float,
                           rule_context: Optional[Dict[str, Any]] = None,
                           source_artifacts: Optional[List[str]] = None,
                           workflow_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        执行审计检查，返回完整的治理声明结构

        Args:
            amount: 待检查的金额
            threshold: 阈值
            rule_context: 规则上下文信息
            source_artifacts: 来源artifact IDs
            workflow_context: 工作流上下文

        Returns:
            audit_assertion: 完整的审计判断声明
        """

        # 创建执行上下文
        context = ExecutionContext(
            workflow_id=workflow_context.get("workflow_id", "unknown") if workflow_context else "unknown",
            run_id=workflow_context.get("run_id", "unknown") if workflow_context else "unknown",
            node_exec_id=f"{self.NODE_TYPE}_{hashlib.md5(f'{amount}_{threshold}'.encode()).hexdigest()[:8]}"
        )

        # 执行核心判断逻辑
        decision_layer = self._create_decision_layer(amount, threshold)

        # 生成治理声明
        governance_layer = self._create_governance_layer(amount, threshold, decision_layer)

        # 创建证据锚定
        evidence_layer = self._create_evidence_layer(
            amount, threshold, source_artifacts or [], context
        )

        # 生成审计留痕
        audit_trail_layer = self._create_audit_trail_layer(
            decision_layer, governance_layer, evidence_layer,
            rule_context or {}, workflow_context or {}, context
        )

        # 组装完整的审计判断声明
        audit_assertion = {
            "assertion_id": f"assertion_{hashlib.sha256(f'{context.node_exec_id}_{datetime.utcnow().isoformat()}'.encode()).hexdigest()[:16]}",
            "node_type": self.NODE_TYPE,
            "node_version": self.VERSION,
            "generated_at": datetime.utcnow().isoformat(),

            # 四层架构声明
            "decision_layer": decision_layer,
            "governance_layer": governance_layer,
            "evidence_layer": evidence_layer,
            "audit_trail_layer": audit_trail_layer,

            # 向后兼容的简单接口
            "legacy_interface": {
                "is_valid": decision_layer["judgment"] == "pass",
                "message": decision_layer["decision_reason"]
            }
        }

        return audit_assertion

    def _create_decision_layer(self, amount: float, threshold: float) -> Dict[str, Any]:
        """创建决策声明层"""
        is_valid = amount < threshold

        decision_layer = {
            "judgment": "pass" if is_valid else "fail",
            "confidence_score": 0.95,  # 阈值检查通常高度确定性
            "decision_reason": (
                f"通过: 金额 {amount:.2f} 低于阈值 {threshold:.2f}"
                if is_valid
                else f"未通过: 金额 {amount:.2f} 超过阈值 {threshold:.2f}"
            ),
            "decision_criteria": {
                "rule_type": "threshold_comparison",
                "operator": "less_than",
                "threshold_value": threshold,
                "actual_value": amount,
                "margin": threshold - amount if is_valid else amount - threshold
            }
        }

        return decision_layer

    def _create_governance_layer(self, amount: float, threshold: float,
                               decision_layer: Dict[str, Any]) -> Dict[str, Any]:
        """创建治理声明层"""
        governance_flags = []

        # 根据判断结果和金额大小设置治理标识
        if decision_layer["judgment"] == "fail":
            governance_flags.append("critical")  # 阈值违规是重大审计风险

        if amount > threshold * 2:  # 超过阈值2倍
            governance_flags.append("compliance_sensitive")  # 可能涉及重大违规

        if amount > threshold * 5:  # 严重超标
            governance_flags.append("requires_disclosure")  # 需要特别披露

        # 计算合规影响等级
        compliance_impact = "low"
        if amount > threshold * 2:
            compliance_impact = "high"
        elif amount > threshold * 1.5:
            compliance_impact = "medium"

        # 如果判断失败且金额相对较低，提升影响等级
        if decision_layer["judgment"] == "fail" and compliance_impact == "low":
            compliance_impact = "medium"  # 任何违规都有至少中等影响

        governance_layer = {
            "governance_flags": governance_flags,
            "compliance_impact": compliance_impact,
            "requires_human_review": "critical" in governance_flags or compliance_impact == "high",
            "auto_approval_blocked": "critical" in governance_flags,
            "disclosure_required": "requires_disclosure" in governance_flags,
            "evidence_weight": 0.9,  # 阈值检查通常是强证据
            "export_restricted": "critical" in governance_flags,
            "retention_years": 7 if compliance_impact == "high" else 3
        }

        return governance_layer

    def _create_evidence_layer(self, amount: float, threshold: float,
                             source_artifacts: List[str], context: ExecutionContext) -> Dict[str, Any]:
        """创建证据锚定层"""
        # 生成证据锚点ID
        evidence_data = f"{amount}_{threshold}_{datetime.utcnow().isoformat()}"
        anchor_id = f"anchor_{hashlib.sha256(evidence_data.encode()).hexdigest()[:16]}"

        evidence_layer = {
            "evidence_anchor": {
                "anchor_id": anchor_id,
                "anchor_type": "reference",
                "source_node_ids": [],  # 当前节点没有上游节点
                "artifact_ids": source_artifacts,
                "data_scope": {
                    "fields_used": ["amount", "threshold"],
                    "records_count": 1,  # 单值检查
                    "value_range": {
                        "amount": amount,
                        "threshold": threshold
                    }
                },
                "integrity": {
                    "checksum": hashlib.sha256(f"{amount}_{threshold}".encode()).hexdigest(),
                    "captured_at": datetime.utcnow().isoformat(),
                    "algorithm": "sha256"
                },
                "scope": {
                    "purpose": "threshold_audit_check",
                    "reuse_allowed": True,
                    "retention_days": 2555  # 7年
                },
                "metadata": {
                    "source_system": "audit_workflow_engine",
                    "data_classification": "financial_amount",
                    "sensitivity_level": "medium"
                }
            }
        }

        # 添加到执行上下文的证据
        context.add_evidence(
            f"threshold_check_evidence_{anchor_id}",
            {
                "amount": amount,
                "threshold": threshold,
                "judgment": "pass" if amount < threshold else "fail",
                "anchor_id": anchor_id
            }
        )

        return evidence_layer

    def _create_audit_trail_layer(self, decision_layer: Dict[str, Any],
                                governance_layer: Dict[str, Any],
                                evidence_layer: Dict[str, Any],
                                rule_context: Dict[str, Any],
                                workflow_context: Dict[str, Any],
                                context: ExecutionContext) -> Dict[str, Any]:
        """创建审计留痕层"""
        event_id = f"evt_{hashlib.sha256(f'{context.node_exec_id}_{datetime.utcnow().isoformat()}'.encode()).hexdigest()[:16]}"

        audit_trail_layer = {
            "audit_log_entry": {
                "event_type": "audit_check_executed",
                "event_id": event_id,
                "node_type": self.NODE_TYPE,
                "node_version": self.VERSION,
                "node_id": context.node_exec_id,

                "decision": decision_layer,
                "governance": governance_layer,
                "evidence": {
                    "anchor_id": evidence_layer["evidence_anchor"]["anchor_id"],
                    "source_integrity_verified": True
                },

                "execution_context": {
                    "workflow_id": workflow_context.get("workflow_id", context.workflow_id),
                    "run_id": workflow_context.get("run_id", context.run_id),
                    "user_id": workflow_context.get("user_id", "system"),
                    "execution_timestamp": datetime.utcnow().isoformat(),
                    "rule_version": rule_context.get("rule_version", "v1.0.0")
                },

                "provenance": {
                    "input_artifacts": evidence_layer["evidence_anchor"]["artifact_ids"],
                    "dependent_nodes": [],
                    "system_version": getattr(settings, "APP_VERSION", "unknown"),
                    "rule_set_version": rule_context.get("rule_set_version", "unknown")
                }
            }
        }

        return audit_trail_layer

    def _execute_pure(self, inputs: Dict[str, Any], context: ExecutionContext) -> Dict[str, Any]:
        """
        执行审计检查，返回治理声明结构
        支持新的治理架构，同时保持向后兼容
        """
        result = self.execute_audit_check(
            amount=inputs.get("amount", 0.0),
            threshold=inputs.get("threshold", 1000.0),
            rule_context=inputs.get("rule_context", {}),
            source_artifacts=inputs.get("source_artifacts", []),
            workflow_context={
                "workflow_id": context.workflow_id,
                "run_id": context.run_id,
                "user_id": getattr(context, 'user_id', 'system')
            }
        )

        # 返回治理声明作为主要结果
        return result

    def check(self, amount: float, threshold: float = 1000.0) -> Tuple[bool, str]:
        """
        Legacy interface for backward compatibility
        返回简单的布尔值和消息
        """
        result = self.execute_audit_check(
            amount=amount,
            threshold=threshold,
            workflow_context={"workflow_id": "legacy", "run_id": "legacy_run"}
        )

        # 从legacy_interface提取简单结果
        legacy = result["legacy_interface"]
        return legacy["is_valid"], legacy["message"]

class ExcelColumnValidator(BaseNode):
    """
    Validates values in a specified column against min/max thresholds.
    Returns rows that violate the constraints.
    Enhanced with streaming support for large datasets.
    """
    
    # Node configuration
    NODE_TYPE = "ExcelColumnValidator"
    VERSION = "2.0.0"
    CATEGORY = "audit"
    DISPLAY_NAME = "Column Validator"
    
    # Schema definition
    INPUT_TYPES = {
        "dataframe": {"type": "DATAFRAME", "required": True},
        "column_name": {"type": "STRING", "required": True},
        "min_value": {"type": "FLOAT", "required": False},
        "max_value": {"type": "FLOAT", "required": False}
    }
    
    OUTPUT_TYPES = {
        "outliers": {"type": "DATAFRAME"},
        "report": {"type": "STRING"}
    }
    
    @classmethod
    def INPUT_TYPES_LEGACY(cls) -> Dict[str, Any]:
        return {
            "required": {
                "dataframe": ("DATAFRAME",),
                "column_name": ("STRING", {"default": "amount"}),
                "min_value": ("FLOAT", {"default": 0.0, "min": 0.0}),
                "max_value": ("FLOAT", {"default": 1000000.0}),
            }
        }
    
    RETURN_TYPES = ("DATAFRAME", "STRING")
    RETURN_NAMES = ("outliers", "report")
    FUNCTION = "execute_validation"
    OUTPUT_NODE = False
    
    def __init__(self, metadata: Optional[NodeMetadata] = None):
        """Initialize with metadata"""
        if metadata is None:
            metadata = NodeMetadata(
                node_type=self.NODE_TYPE,
                version=self.VERSION,
                display_name=self.DISPLAY_NAME,
                category=self.CATEGORY,
                failure_policy=FailurePolicy.SKIP,
                timeout_seconds=60,
                supports_streaming=True,  # Can handle large datasets
                chunk_size=10000,
                cache_results=True
            )
        super().__init__(metadata)
    
    def _execute_pure(self, inputs: Dict[str, Any], context: ExecutionContext) -> Dict[str, Any]:
        """
        Pure function implementation for column validation
        """
        dataframe = inputs.get("dataframe")
        column_name = inputs.get("column_name")
        min_value = inputs.get("min_value")
        max_value = inputs.get("max_value")
        
        # Validate inputs
        if dataframe is None or dataframe.empty:
            return {
                "outliers": pd.DataFrame(),
                "report": "No data to validate"
            }
        
        if column_name not in dataframe.columns:
            return {
                "outliers": pd.DataFrame(),
                "report": f"Column '{column_name}' not found in dataframe"
            }
        
        # Convert column to numeric
        try:
            numeric_col = pd.to_numeric(dataframe[column_name], errors='coerce')
        except Exception as e:
            return {
                "outliers": pd.DataFrame(),
                "report": f"Error converting column to numeric: {str(e)}"
            }
        
        # Build filter conditions
        conditions = []
        if min_value is not None:
            below_min = numeric_col < min_value
            conditions.append(below_min)
            context.add_evidence(
                f"min_threshold_{min_value}",
                f"Checking for values below {min_value}"
            )
        
        if max_value is not None:
            above_max = numeric_col > max_value
            conditions.append(above_max)
            context.add_evidence(
                f"max_threshold_{max_value}",
                f"Checking for values above {max_value}"
            )
        
        # Find outliers
        if conditions:
            outlier_mask = pd.concat(conditions, axis=1).any(axis=1)
            outliers = dataframe[outlier_mask].copy()
            
            # Add violation type column
            violation_types = []
            for idx in outliers.index:
                violations = []
                val = numeric_col.loc[idx]
                if min_value is not None and val < min_value:
                    violations.append(f"Below min ({val:.2f} < {min_value:.2f})")
                if max_value is not None and val > max_value:
                    violations.append(f"Above max ({val:.2f} > {max_value:.2f})")
                violation_types.append("; ".join(violations))
            
            outliers['violation_type'] = violation_types
        else:
            outliers = pd.DataFrame()
        
        # Generate report
        total_rows = len(dataframe)
        outlier_count = len(outliers)
        
        report_lines = [
            f"Validation Report for column '{column_name}':",
            f"Total rows: {total_rows}",
            f"Outliers found: {outlier_count} ({outlier_count/total_rows*100:.1f}% of total)"
        ]
        
        if min_value is not None:
            report_lines.append(f"Min threshold: {min_value:.2f}")
        if max_value is not None:
            report_lines.append(f"Max threshold: {max_value:.2f}")
        
        if outlier_count > 0:
            report_lines.append("\nSample outliers (first 5):")
            for idx, row in outliers.head(5).iterrows():
                report_lines.append(f"  Row {idx}: {column_name}={row[column_name]}, {row['violation_type']}")
            
            # Add statistical summary
            outlier_values = numeric_col[outlier_mask]
            report_lines.append("\nOutlier statistics:")
            report_lines.append(f"  Mean: {outlier_values.mean():.2f}")
            report_lines.append(f"  Median: {outlier_values.median():.2f}")
            report_lines.append(f"  Min: {outlier_values.min():.2f}")
            report_lines.append(f"  Max: {outlier_values.max():.2f}")
            
            # Record evidence
            context.add_evidence(
                f"outliers_found_{outlier_count}",
                f"Found {outlier_count} outliers in column {column_name}"
            )
        else:
            report_lines.append("\nNo outliers found. All values within acceptable range.")
        
        report = "\n".join(report_lines)
        
        return {
            "outliers": outliers,
            "report": report
        }
    
    def execute_validation(self, dataframe, column_name, min_value, max_value):
        print(f"Validating column '{column_name}' range [{min_value}, {max_value}]")
        
        context = ExecutionContext(
            workflow_id="legacy",
            run_id="legacy_run",
            node_exec_id="column_validator"
        )
        
        result = self._execute_pure(
            {
                "dataframe": dataframe,
                "column_name": column_name,
                "min_value": min_value,
                "max_value": max_value
            },
            context
        )
        
        return result["outliers"], result["report"]
    
    def estimate_cost(self, inputs: Dict[str, Any]) -> Dict[str, float]:
        """
        Estimate validation cost based on data size
        """
        dataframe = inputs.get("dataframe")
        if dataframe is not None:
            rows = len(dataframe)
            # Roughly 0.001 seconds per 1000 rows
            time_estimate = rows * 0.001 / 1000
        else:
            time_estimate = 0.1
        
        return {
            "time_seconds": min(60, time_estimate),
            "memory_mb": 100,
            "ai_tokens": 0,
            "ai_cost_usd": 0.0
        }

class CommonMetricsNode(BaseNode):
    """
    2A 通用指标服务 - 跨场景基础指标计算
    """
    
    NODE_TYPE = "CommonMetricsNode"
    VERSION = "1.0.0"
    CATEGORY = "audit"
    DISPLAY_NAME = "通用指标计算"
    
    INPUT_TYPES = {
        "dataframe": {"type": "DATAFRAME", "required": True}
    }
    
    OUTPUT_TYPES = {
        "metrics": {"type": "DICT"}
    }
    
    @classmethod
    def INPUT_TYPES_LEGACY(cls):
        return {
            "required": {
                "dataframe": ("DATAFRAME",)
            }
        }
    
    RETURN_TYPES = ("DICT",)
    RETURN_NAMES = ("metrics",)
    FUNCTION = "calculate_metrics"
    
    def calculate_metrics(self, dataframe: pd.DataFrame) -> Tuple[Dict]:
        """计算通用指标"""
        metrics = {}
        
        # 基础统计
        metrics["record_count"] = len(dataframe)
        
        # 数值列统计
        numeric_columns = dataframe.select_dtypes(include=['number']).columns
        for col in numeric_columns:
            metrics[f"{col}_sum"] = float(dataframe[col].sum())
            metrics[f"{col}_mean"] = float(dataframe[col].mean())
            metrics[f"{col}_median"] = float(dataframe[col].median())
            metrics[f"{col}_std"] = float(dataframe[col].std())
            metrics[f"{col}_min"] = float(dataframe[col].min())
            metrics[f"{col}_max"] = float(dataframe[col].max())
        
        return (metrics,)


class SceneMetricsNode(BaseNode):
    """
    2B 场景指标插件 - 针对不同业务场景
    """
    
    NODE_TYPE = "SceneMetricsNode"
    VERSION = "1.0.0"
    CATEGORY = "audit"
    DISPLAY_NAME = "场景指标计算"
    
    @classmethod
    def INPUT_TYPES_LEGACY(cls):
        return {
            "required": {
                "dataframe": ("DATAFRAME",),
                "business_scene": (["travel_audit", "contract_audit", "invoice_audit"], {"default": "invoice_audit"})
            },
            "optional": {
                "common_metrics": ("DICT",)
            }
        }
    
    RETURN_TYPES = ("DICT",)
    RETURN_NAMES = ("scene_metrics",)
    FUNCTION = "calculate_scene_metrics"
    
    def calculate_scene_metrics(self, dataframe: pd.DataFrame, business_scene: str, common_metrics: Dict = None):
        """
        Calculate scene-specific metrics.
        Enhanced to produce:
         - scene_slices: per-slice aggregated metrics (count, sum, mean, min, max, nulls)
         - comparisons: relative comparison vs common_metrics or overall averages
         - evidence_anchors: for each slice, sample rows (index list) that produced the metric (for traceability)

        This function intentionally does NOT make binary judgements; it only exposes facts and comparisons.
        """
        scene_metrics: Dict[str, Any] = {}
        scene_slices: Dict[str, Any] = {}
        comparisons: Dict[str, Any] = {}
        evidence_anchors: Dict[str, Any] = {}

        # Helper to build per-group stats
        def group_stats(df: pd.DataFrame, group_key: str):
            stats = {}
            cols = df.select_dtypes(include=['number']).columns.tolist()
            stats["record_count"] = len(df)
            stats["null_counts"] = {c: int(df[c].isna().sum()) for c in cols}
            for c in cols:
                vals = df[c].dropna()
                stats[f"{c}_sum"] = float(vals.sum()) if len(vals) > 0 else 0.0
                stats[f"{c}_mean"] = float(vals.mean()) if len(vals) > 0 else 0.0
                stats[f"{c}_min"] = float(vals.min()) if len(vals) > 0 else 0.0
                stats[f"{c}_max"] = float(vals.max()) if len(vals) > 0 else 0.0
                stats[f"{c}_pct_zero"] = float((df[c] == 0).sum() / max(1, len(df)))
            return stats

        # Scene-specific slicing rules (simple templates)
        try:
            if business_scene == "travel_audit":
                # slice by employee_id
                if "employee_id" in dataframe.columns:
                    groups = dataframe.groupby("employee_id")
                    for k, g in groups:
                        key = f"employee:{k}"
                        scene_slices[key] = group_stats(g, key)
                        evidence_anchors[key] = {"sample_index": list(g.index[:5])}
            elif business_scene == "invoice_audit":
                # slice by vendor and by month if date present
                if "vendor" in dataframe.columns and "amount" in dataframe.columns:
                    groups = dataframe.groupby("vendor")
                    for k, g in groups:
                        key = f"vendor:{k}"
                        scene_slices[key] = group_stats(g, key)
                        evidence_anchors[key] = {"sample_index": list(g.index[:5])}
                # month slicing
                if "date" in dataframe.columns:
                    df_dates = dataframe.copy()
                    try:
                        df_dates["__month"] = pd.to_datetime(df_dates["date"], errors="coerce").dt.to_period("M").astype(str)
                        month_groups = df_dates.groupby("__month")
                        for k, g in month_groups:
                            key = f"month:{k}"
                            scene_slices[key] = group_stats(g, key)
                            evidence_anchors[key] = {"sample_index": list(g.index[:5])}
                    except Exception:
                        pass
            else:
                # Generic fallback: slice by one categorical column if exists
                cat_cols = dataframe.select_dtypes(include=['object', 'category']).columns.tolist()
                if cat_cols:
                    col = cat_cols[0]
                    for k, g in dataframe.groupby(col):
                        key = f"{col}:{k}"
                        scene_slices[key] = group_stats(g, key)
                        evidence_anchors[key] = {"sample_index": list(g.index[:5])}

            # comparisons: compare each slice to overall common_metrics or overall aggregate
            overall = group_stats(dataframe, "overall")
            for key, stats in scene_slices.items():
                comp = {}
                for metric_key, val in stats.items():
                    if metric_key.endswith("_mean") or metric_key.endswith("_sum"):
                        base = overall.get(metric_key, None)
                        if base is not None and base != 0:
                            comp[metric_key + "_ratio_to_overall"] = round(val / base, 4) if base else None
                comparisons[key] = comp

            scene_metrics["scene_slices"] = scene_slices
            scene_metrics["comparisons"] = comparisons
            scene_metrics["evidence_anchors"] = evidence_anchors
        except Exception as e:
            # be resilient: return empty structures on failure but do not raise
            scene_metrics = {"error": str(e)}

        return (scene_metrics,)


class RuleCalculationNode(BaseNode):
    """
    2C 规则计算节点 - 基于指标执行审计规则
    """
    
    NODE_TYPE = "RuleCalculationNode"
    VERSION = "1.0.0"
    CATEGORY = "audit"
    DISPLAY_NAME = "规则计算"
    
    @classmethod
    def INPUT_TYPES_LEGACY(cls):
        return {
            "required": {
                "dataframe": ("DATAFRAME",),
                "metrics": ("DICT",)
            }
        }
    
    RETURN_TYPES = ("DATAFRAME", "LIST", "DICT")
    RETURN_NAMES = ("risk_items", "triggered", "risk_assessment")
    FUNCTION = "execute_rules"
    
    def execute_rules(self, dataframe: pd.DataFrame, metrics: Dict):
        """Execute audit rules using the centralized rule registry.
        Returns (risk_df, triggered_rules_list).
        risk_df contains one row per triggered rule with basic metadata and evidence anchors.
        """
        from app.core.rule_registry import evaluate_rules

        # metrics may be common_metrics or include scene_metrics under 'scene_metrics'
        common_metrics = metrics if isinstance(metrics, dict) else {}
        scene_metrics = common_metrics.get("scene_metrics") if isinstance(common_metrics, dict) else {}

        triggered = evaluate_rules(common_metrics, scene_metrics, dataframe)

        records = []
        for t in triggered:
            rec = {
                "rule_id": t.get("rule_id"),
                "rule_name": t.get("name"),
                "severity": t.get("severity"),
                "value": t.get("value"),
                "evidence": t.get("evidence")
            }
            records.append(rec)

        # Persist rule hits to DB - best-effort, do not break node execution on DB errors
        try:
            session = SessionLocal()
            for t in triggered:
                try:
                    rh = RuleHit(
                        workflow_id=metrics.get("workflow_id") if isinstance(metrics, dict) else None,
                        run_id=metrics.get("run_id") if isinstance(metrics, dict) else None,
                        node_exec_id=None,
                        rule_id=t.get("rule_id"),
                        rule_name=t.get("name"),
                        rule_version=t.get("rule_version"),
                        severity=t.get("severity"),
                        trigger_reason=t.get("explanation"),
                        evidence=t.get("evidence") or {},
                        evidence_refs=t.get("evidence_refs") or t.get("evidence") or {},
                        metric_snapshot=t.get("metric_snapshot") or {},
                        meta={"value": t.get("value"), "requires_human_review": t.get("requires_human_review", False)}
                    )
                    session.add(rh)
                except Exception:
                    # skip problematic hit
                    continue
            session.commit()
        except Exception:
            # do not fail execution for DB persistence issues
            try:
                session.rollback()
            except Exception:
                pass
        finally:
            try:
                session.close()
            except Exception:
                pass
        # Regardless of DB persistence success, ensure human review tasks are created for hits requiring review
        try:
            for t in triggered:
                requires = t.get("requires_human_review", False)
                if not requires:
                    continue
                rule_id = t.get("rule_id")
                wf = metrics.get("workflow_id") if isinstance(metrics, dict) else None
                run_id = metrics.get("run_id") if isinstance(metrics, dict) else None
                task_key = f"{rule_id}:{wf or ''}:{run_id or ''}"
                task_hash = hashlib.sha256(task_key.encode()).hexdigest()[:12]
                task_id = f"hr_{task_hash}"
                task_dir = Path(settings.STORAGE_PATH) / "tasks" / "human_review"
                task_dir.mkdir(parents=True, exist_ok=True)
                task_file = task_dir / f"{task_id}.json"
                processed_marker = task_dir / "processed" / f"{task_id}.json"
                if task_file.exists() or processed_marker.exists():
                    continue
                payload = {
                    "task_id": task_id,
                    "audit_result_ref": None,
                    "workflow_id": wf,
                    "run_id": run_id,
                    "rule_id": rule_id,
                    "rule_name": t.get("name"),
                    "severity": t.get("severity"),
                    "created_at": datetime.utcnow().isoformat(),
                    "evidence": t.get("evidence", {}),
                    "explanation": t.get("explanation", "")
                }
                try:
                    with open(task_file, "w", encoding="utf-8") as tf:
                        json.dump(payload, tf, ensure_ascii=False, indent=2)
                except Exception:
                    pass
                # best-effort audit log
                try:
                    db = SessionLocal()
                    AuditService.log(db, action_type="create_human_review_task", target_type="rule_hit", target_id=rule_id, parameters=payload, user_id="system")
                    db.close()
                except Exception:
                    pass
                try:
                    pm_dir = task_dir / "processed"
                    pm_dir.mkdir(parents=True, exist_ok=True)
                    (pm_dir / f"{task_id}.json").write_text(json.dumps({"task": payload, "created_at": datetime.utcnow().isoformat()}, ensure_ascii=False, indent=2), encoding="utf-8")
                except Exception:
                    pass
        except Exception:
            pass
        risk_df = pd.DataFrame(records) if records else pd.DataFrame()

        # build a lightweight risk_assessment summary
        risk_assessment = {
            "workflow_id": metrics.get("workflow_id") if isinstance(metrics, dict) else None,
            "run_id": metrics.get("run_id") if isinstance(metrics, dict) else None,
            "total_triggered": len(triggered),
            "severity_counts": {}
        }
        try:
            for t in triggered:
                sev = t.get("severity") or "unknown"
                risk_assessment["severity_counts"][sev] = risk_assessment["severity_counts"].get(sev, 0) + 1
        except Exception:
            pass

        # Return compact structure for legacy callers: (risk_df, risk_count)
        # Keep triggered and risk_assessment persisted/used internally.
        return risk_df, len(triggered)


NODE_CLASS_MAPPINGS = {
    "AuditCheckNode": AuditCheckNode,
    "ExcelColumnValidator": ExcelColumnValidator,
    "CommonMetricsNode": CommonMetricsNode,
    "SceneMetricsNode": SceneMetricsNode,
    "RuleCalculationNode": RuleCalculationNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AuditCheckNode": "金额合规校验",
    "ExcelColumnValidator": "Excel列值校验",
    "CommonMetricsNode": "通用指标计算",
    "SceneMetricsNode": "场景指标计算",
    "RuleCalculationNode": "规则计算"
}
