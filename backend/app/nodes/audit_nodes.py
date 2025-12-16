"""
Audit Nodes Module
Enhanced with workflow orchestration support
"""

from typing import Any, Dict, Tuple, Optional
import pandas as pd
import hashlib
import json

from .base_node import BaseNode, ExecutionContext, NodeMetadata, NodeResult, NodeStatus, FailurePolicy


class AuditCheckNode(BaseNode):
    """
    Simple demonstration node for audit logic.
    Checks if an amount meets a threshold requirement.
    Enhanced with workflow support and deterministic execution.
    """
    
    # Node configuration
    NODE_TYPE = "AuditCheckNode"
    VERSION = "2.0.0"
    CATEGORY = "audit"
    DISPLAY_NAME = "Audit Check"
    
    # Schema definition
    INPUT_TYPES = {
        "amount": {"type": "FLOAT", "required": True},
        "threshold": {"type": "FLOAT", "required": True, "default": 1000.0}
    }
    
    OUTPUT_TYPES = {
        "is_valid": {"type": "BOOLEAN"},
        "message": {"type": "STRING"}
    }
    
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
        """Initialize with metadata"""
        if metadata is None:
            metadata = NodeMetadata(
                node_type=self.NODE_TYPE,
                version=self.VERSION,
                display_name=self.DISPLAY_NAME,
                category=self.CATEGORY,
                failure_policy=FailurePolicy.RETRY,
                timeout_seconds=5,  # Quick check
                cache_results=True  # Deterministic, can cache
            )
        super().__init__(metadata)
    
    def _execute_pure(self, inputs: Dict[str, Any], context: ExecutionContext) -> Dict[str, Any]:
        """
        Pure function implementation for audit check
        """
        amount = inputs.get("amount", 0.0)
        threshold = inputs.get("threshold", 1000.0)
        
        # Perform check
        is_valid = amount < threshold
        
        # Generate message
        if is_valid:
            message = f"Pass: Amount {amount:.2f} is below threshold {threshold:.2f}"
        else:
            message = f"Amount exceeds threshold: {amount:.2f} >= {threshold:.2f}"
            # Add evidence for audit trail
            context.add_evidence(
                f"threshold_violation_{amount:.2f}",
                f"Amount {amount:.2f} exceeds threshold {threshold:.2f}"
            )
        
        return {
            "is_valid": is_valid,
            "message": message
        }
    
    def check(self, amount: float, threshold: float = 1000.0) -> Tuple[bool, str]:
        """
        Legacy interface for backward compatibility
        """
        context = ExecutionContext(
            workflow_id="legacy",
            run_id="legacy_run",
            node_exec_id="audit_check"
        )
        
        result = self._execute_pure(
            {"amount": amount, "threshold": threshold},
            context
        )
        
        return result["is_valid"], result["message"]

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
        """计算场景特定指标"""
        scene_metrics = {}
        
        if business_scene == "travel_audit":
            # 差旅审计指标
            if "employee_id" in dataframe.columns and "amount" in dataframe.columns:
                scene_metrics["avg_travel_per_person"] = dataframe.groupby("employee_id")["amount"].mean().mean()
                scene_metrics["max_travel_per_person"] = dataframe.groupby("employee_id")["amount"].sum().max()
                
        elif business_scene == "invoice_audit":
            # 发票审计指标
            if "vendor" in dataframe.columns and "amount" in dataframe.columns:
                vendor_amounts = dataframe.groupby("vendor")["amount"].sum()
                if len(vendor_amounts) > 0:
                    scene_metrics["top_vendor"] = vendor_amounts.idxmax()
                    scene_metrics["vendor_concentration"] = float(vendor_amounts.max() / vendor_amounts.sum())
        
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
    
    RETURN_TYPES = ("DATAFRAME", "INT")
    RETURN_NAMES = ("risk_items", "risk_count")
    FUNCTION = "execute_rules"
    
    def execute_rules(self, dataframe: pd.DataFrame, metrics: Dict):
        """执行规则计算"""
        risk_items = []
        
        # 示例规则1：金额异常
        if "amount" in dataframe.columns:
            amount_mean = metrics.get("amount_mean", 0)
            amount_std = metrics.get("amount_std", 1)
            threshold = amount_mean + 3 * amount_std
            
            outliers = dataframe[dataframe["amount"] > threshold]
            for idx, row in outliers.iterrows():
                risk_items.append({
                    "rule_id": "AMOUNT_OUTLIER",
                    "risk_level": "HIGH",
                    "description": f"金额异常: {row['amount']:.2f}",
                    "record_id": int(idx)
                })
        
        # 示例规则2：重复记录
        duplicates = dataframe[dataframe.duplicated(keep=False)]
        if len(duplicates) > 0:
            risk_items.append({
                "rule_id": "DUPLICATE_RECORDS",
                "risk_level": "MEDIUM",
                "description": f"发现{len(duplicates)}条重复记录"
            })
        
        risk_df = pd.DataFrame(risk_items) if risk_items else pd.DataFrame()
        return risk_df, len(risk_items)


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
