"""
Data Cleaning Nodes - Essential preprocessing for audit data
Enhanced with workflow orchestration support
"""
import pandas as pd
import json
import re
from typing import Optional, Dict, Any, Tuple, Generator
import hashlib

from .base_node import BaseNode, ExecutionContext, NodeMetadata, NodeResult, NodeStatus, FailurePolicy

class ColumnMapperNode(BaseNode):
    """
    列名标准化与筛选节点 (Column Mapper)
    
    功能：
    1. 列重命名：将原始列名映射为标准列名（如 "借方金额" -> "debit_amount"）。
    2. 列筛选：仅保留需要的列，剔除无关数据以减小内存占用。
    3. 严格模式检查：确保关键列必须存在。
    Enhanced with streaming support for large datasets.
    """
    
    # Node configuration
    NODE_TYPE = "ColumnMapperNode"
    VERSION = "2.0.0"
    CATEGORY = "审计/数据清洗"
    DISPLAY_NAME = "列名映射"
    
    # Schema definition
    INPUT_TYPES = {
        "dataframe": {"type": "DATAFRAME", "required": True},
        "mapping_json": {"type": "STRING", "required": True, "multiline": True},
        "keep_other_columns": {"type": "BOOLEAN", "required": False, "default": True},
        "strict_mode": {"type": "BOOLEAN", "required": False, "default": False}
    }
    
    OUTPUT_TYPES = {
        "cleaned_df": {"type": "DATAFRAME"},
        "report": {"type": "STRING"}
    }
    
    @classmethod
    def INPUT_TYPES_LEGACY(cls):
        return {
            "required": {
                "dataframe": ("DATAFRAME",),
                "mapping_json": ("STRING", {
                    "multiline": True,
                    "default": '{\n  "原始列名1": "标准列名1",\n  "借方": "debit",\n  "贷方": "credit"\n}',
                    "placeholder": "输入JSON格式的列名映射关系"
                }),
            },
            "optional": {
                "keep_other_columns": ("BOOLEAN", {"default": True, "label": "保留其他未映射列"}),
                "strict_mode": ("BOOLEAN", {"default": False, "label": "严格模式(缺少列则报错)"}),
            }
        }

    RETURN_TYPES = ("DATAFRAME", "STRING")
    RETURN_NAMES = ("cleaned_df", "report")
    FUNCTION = "process_columns"
    CATEGORY = "审计/数据清洗"

    def __init__(self, metadata: Optional[NodeMetadata] = None):
        """Initialize with metadata"""
        if metadata is None:
            metadata = NodeMetadata(
                node_type=self.NODE_TYPE,
                version=self.VERSION,
                display_name=self.DISPLAY_NAME,
                category=self.CATEGORY,
                failure_policy=FailurePolicy.SKIP,
                timeout_seconds=30,
                supports_streaming=True,
                chunk_size=10000,
                cache_results=True
            )
        super().__init__(metadata)
    
    def _execute_pure(self, inputs: Dict[str, Any], context: ExecutionContext) -> Dict[str, Any]:
        """
        Pure function implementation for column mapping
        """
        dataframe = inputs.get("dataframe")
        mapping_json = inputs.get("mapping_json", "{}")
        keep_other_columns = inputs.get("keep_other_columns", True)
        strict_mode = inputs.get("strict_mode", False)
        
        # Parse mapping
        try:
            mapping = json.loads(mapping_json)
            if not isinstance(mapping, dict):
                raise ValueError("Mapping must be a JSON object (dict)")
        except json.JSONDecodeError as e:
            return {
                "cleaned_df": dataframe,
                "report": f"❌ JSON Config Error: {str(e)}"
            }
        
        # Track evidence
        context.add_evidence(
            f"column_mapping_{len(mapping)}",
            f"Applying {len(mapping)} column mappings"
        )
        
        # Strict mode check
        missing = []
        if strict_mode:
            for old_col in mapping.keys():
                if old_col not in dataframe.columns:
                    missing.append(old_col)
            
            if missing:
                error_msg = f"❌ Strict Mode: Missing required columns: {missing}"
                return {
                    "cleaned_df": dataframe,
                    "report": error_msg
                }
        
        # Apply mapping
        new_df = dataframe.copy()
        rename_map = {}
        
        for old_col, new_col in mapping.items():
            if old_col in new_df.columns:
                rename_map[old_col] = new_col
        
        new_df = new_df.rename(columns=rename_map)
        
        # Filter columns if needed
        if not keep_other_columns:
            keep_cols = list(mapping.values())
            new_df = new_df[[col for col in new_df.columns if col in keep_cols]]
        
        # Generate report
        report_lines = [
            f"✅ Column Mapping Completed:",
            f"  • Input shape: {dataframe.shape}",
            f"  • Output shape: {new_df.shape}",
            f"  • Columns renamed: {len(rename_map)}",
            f"  • Final columns: {list(new_df.columns)[:10]}{'...' if len(new_df.columns) > 10 else ''}"
        ]
        
        if missing:
            report_lines.append(f"  • ⚠️ Missing columns (ignored): {missing}")
        
        return {
            "cleaned_df": new_df,
            "report": "\n".join(report_lines)
        }
    
    def process_columns(self, dataframe: pd.DataFrame, mapping_json: str, 
                        keep_other_columns: bool = True, strict_mode: bool = False) -> Tuple[pd.DataFrame, str]:
        """
        Legacy interface for backward compatibility
        """
        context = ExecutionContext(
            workflow_id="legacy",
            run_id="legacy_run",
            node_exec_id="column_mapper"
        )
        
        result = self._execute_pure(
            {
                "dataframe": dataframe,
                "mapping_json": mapping_json,
                "keep_other_columns": keep_other_columns,
                "strict_mode": strict_mode
            },
            context
        )
        
        return result["cleaned_df"], result["report"]


class NullValueCleanerNode(BaseNode):
    """
    空值清洗节点 (Null Value Cleaner)
    
    功能：
    1. 统计空值：分析各列的空值分布。
    2. 清洗策略：删除行、填充默认值、填充均值、前向/后向填充等。
    3. 审计记录：记录清洗操作的影响范围。
    Enhanced with chunk processing for memory efficiency.
    """
    
    # Node configuration
    NODE_TYPE = "NullValueCleanerNode"
    VERSION = "2.0.0"
    CATEGORY = "审计/数据清洗"
    DISPLAY_NAME = "空值清洗"
    
    # Schema definition
    INPUT_TYPES = {
        "dataframe": {"type": "DATAFRAME", "required": True},
        "target_columns": {"type": "STRING", "required": False},
        "strategy": {"type": "STRING", "required": True},
        "custom_value": {"type": "FLOAT", "required": False}
    }
    
    OUTPUT_TYPES = {
        "cleaned_df": {"type": "DATAFRAME"},
        "report": {"type": "STRING"}
    }
    
    @classmethod
    def INPUT_TYPES_LEGACY(cls):
        return {
            "required": {
                "dataframe": ("DATAFRAME",),
                "strategy": (["drop_rows", "fill_zero", "fill_mean", "fill_custom", "forward_fill", "backward_fill"], {
                    "default": "drop_rows"
                }),
            },
            "optional": {
                "target_columns": ("STRING", {
                    "default": "*",
                    "multiline": False,
                    "placeholder": "指定要处理的列，逗号分隔，或*表示全部"
                }),
                "custom_value": ("FLOAT", {"default": 0}),
            }
        }

    RETURN_TYPES = ("DATAFRAME", "STRING")
    RETURN_NAMES = ("cleaned_df", "report")
    FUNCTION = "clean_nulls"
    CATEGORY = "审计/数据清洗"
    
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
                supports_streaming=True,
                chunk_size=10000,
                cache_results=False  # Don't cache since null patterns may change
            )
        super().__init__(metadata)
    
    def _execute_pure(self, inputs: Dict[str, Any], context: ExecutionContext) -> Dict[str, Any]:
        """
        Pure function implementation for null value cleaning
        """
        dataframe = inputs.get("dataframe")
        target_columns = inputs.get("target_columns", "*")
        strategy = inputs.get("strategy", "drop_rows")
        custom_value = inputs.get("custom_value", 0)
        
        # Parse target columns
        if target_columns and target_columns != "*":
            cols = [c.strip() for c in target_columns.split(',') if c.strip() in dataframe.columns]
        else:
            cols = dataframe.columns.tolist()
        
        # Analyze nulls before cleaning
        null_stats = {}
        for col in cols:
            null_count = dataframe[col].isna().sum()
            null_pct = (null_count / len(dataframe)) * 100 if len(dataframe) > 0 else 0
            null_stats[col] = {"count": null_count, "pct": null_pct}
        
        # Apply strategy
        df = dataframe.copy()
        rows_before = len(df)
        
        if strategy == "drop_rows":
            df = df.dropna(subset=cols)
        elif strategy == "fill_zero":
            df[cols] = df[cols].fillna(0)
        elif strategy == "fill_mean":
            for col in cols:
                if pd.api.types.is_numeric_dtype(df[col]):
                    df[col] = df[col].fillna(df[col].mean())
        elif strategy == "fill_custom":
            df[cols] = df[cols].fillna(custom_value)
        elif strategy == "forward_fill":
            df[cols] = df[cols].ffill()
        elif strategy == "backward_fill":
            df[cols] = df[cols].bfill()
        
        rows_after = len(df)
        rows_removed = rows_before - rows_after
        
        # Generate report
        report_lines = [
            f"🧹 Null Value Cleaning Report:",
            f"  • Strategy: {strategy}",
            f"  • Rows before: {rows_before}",
            f"  • Rows after: {rows_after}",
            f"  • Rows removed: {rows_removed}"
        ]
        
        if null_stats:
            report_lines.append("\nNull statistics (before cleaning):")
            for col, stats in list(null_stats.items())[:10]:
                if stats["count"] > 0:
                    report_lines.append(f"  • {col}: {stats['count']} nulls ({stats['pct']:.1f}%)")
        
        # Record evidence
        context.add_evidence(
            f"null_cleaning_{strategy}",
            f"Applied {strategy} to {len(cols)} columns, removed {rows_removed} rows"
        )
        
        return {
            "cleaned_df": df,
            "report": "\n".join(report_lines)
        }
    
    def clean_nulls(self, dataframe: pd.DataFrame, target_columns: str = None, 
                   strategy: str = "drop_rows", custom_value: float = 0) -> Tuple[pd.DataFrame, str]:
        """
        Legacy interface for backward compatibility
        """
        context = ExecutionContext(
            workflow_id="legacy",
            run_id="legacy_run",
            node_exec_id="null_cleaner"
        )
        
        result = self._execute_pure(
            {
                "dataframe": dataframe,
                "target_columns": target_columns,
                "strategy": strategy,
                "custom_value": custom_value
            },
            context
        )
        
        return result["cleaned_df"], result["report"]
    
    def estimate_cost(self, inputs: Dict[str, Any]) -> Dict[str, float]:
        """
        Estimate cleaning cost based on data size and strategy
        """
        dataframe = inputs.get("dataframe")
        strategy = inputs.get("strategy", "drop_rows")
        
        if dataframe is not None:
            size_factor = (len(dataframe) * len(dataframe.columns)) / 1000000
            # More complex strategies take longer
            strategy_factor = {
                "drop_rows": 1.0,
                "fill_zero": 1.2,
                "fill_mean": 2.0,  # Needs computation
                "forward_fill": 1.5,
                "backward_fill": 1.5
            }.get(strategy, 1.0)
            
            time_estimate = size_factor * strategy_factor
        else:
            time_estimate = 0.1
        
        return {
            "time_seconds": min(60, time_estimate),
            "memory_mb": 200,
            "ai_tokens": 0,
            "ai_cost_usd": 0.0
        }

# Cost estimation for ColumnMapperNode
def _column_mapper_estimate_cost(self, inputs: Dict[str, Any]) -> Dict[str, float]:
    """
    Estimate mapping cost based on data size
    """
    dataframe = inputs.get("dataframe")
    if dataframe is not None:
        size_factor = len(dataframe) / 100000
        time_estimate = 0.5 + size_factor
    else:
        time_estimate = 0.1
    
    return {
        "time_seconds": min(30, time_estimate),
        "memory_mb": 100,
        "ai_tokens": 0,
        "ai_cost_usd": 0.0
    }

# Add cost estimation to ColumnMapperNode
ColumnMapperNode.estimate_cost = _column_mapper_estimate_cost

# Register nodes for ComfyUI
NODE_CLASS_MAPPINGS = {
    "ColumnMapperNode": ColumnMapperNode,
    "NullValueCleanerNode": NullValueCleanerNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ColumnMapperNode": "列名映射",
    "NullValueCleanerNode": "空值清洗"
}
