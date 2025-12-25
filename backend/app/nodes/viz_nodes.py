"""
Visualization Nodes - Generate interactive charts from DataFrames
Uses ECharts JSON configuration format for frontend rendering

Performance optimizations:
- Automatic data sampling for large datasets (> 1000 rows)
- Type validation for numeric columns
- Efficient data conversion with numpy
"""

import json
import pandas as pd
import numpy as np
from typing import Tuple, Any, Dict, List, Optional
from datetime import datetime

from .base_node import BaseNode, ExecutionContext, NodeMetadata, FailurePolicy
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.database import DB_PATH
import sqlite3
from app.schemas.audit_result import AuditResult, RiskItem, EvidenceAnchor, Signatory, DocumentMeta
from pathlib import Path
import hashlib
import json as _json
import os

class QuickPlotNode(BaseNode):
    """
    Generate interactive charts from DataFrame data.
    Outputs ECharts option JSON for frontend rendering with vue-echarts.
    
    Supported chart types:
    - line: Line chart (time series, trends)
    - bar: Bar chart (comparisons)
    - pie: Pie chart (proportions)
    - scatter: Scatter plot (correlations)
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        # flat mapping expected by BaseNode.validate_inputs
        return {
            "dataframe": {"type": "DATAFRAME", "required": True},
            "chart_type": {"type": "STRING", "required": True},
            "x_column": {"type": "STRING", "required": True},
            "y_column": {"type": "STRING", "required": True},
            "title": {"type": "STRING", "required": False},
            "legend_show": {"type": "BOOLEAN", "required": False},
            "include_metadata": {"type": "BOOLEAN", "required": False},
            "persist_sample": {"type": "BOOLEAN", "required": False},
            "sample_strategy": {"type": "STRING", "required": False},
            "sample_seed": {"type": "INT", "required": False},
        }
    
    RETURN_TYPES = ("STRING", "JSON")
    RETURN_NAMES = ("echarts_option", "qp_metadata")
    FUNCTION = "generate_chart"
    CATEGORY = "visualization"
    
    # Performance settings
    MAX_DATA_POINTS = 1000  # Auto-sample if dataset larger than this
    
    def generate_chart(
        self,
        dataframe: pd.DataFrame,
        chart_type: str,
        x_column: str,
        y_column: str,
        title: str = "Chart",
        legend_show: bool = True
        , include_metadata: bool = True, persist_sample: bool = False, sample_strategy: str = "systematic", sample_seed: int = 42
    ) -> Tuple[str]:
        """
        Generate ECharts configuration JSON from DataFrame.
        
        Args:
            dataframe: Input pandas DataFrame
            chart_type: Type of chart (line, bar, pie, scatter, area)
            x_column: Column name for X-axis (category or independent variable)
            y_column: Column name for Y-axis (value or dependent variable)
            title: Chart title
            legend_show: Whether to show legend
            
        Returns:
            Tuple containing JSON string of ECharts option
        """
        try:
            # Validate inputs
            if dataframe.empty:
                raise ValueError("DataFrame is empty")
            
            if not x_column or x_column not in dataframe.columns:
                raise ValueError(f"X column '{x_column}' not found in DataFrame. Available columns: {list(dataframe.columns)}")
            
            if not y_column or y_column not in dataframe.columns:
                raise ValueError(f"Y column '{y_column}' not found in DataFrame. Available columns: {list(dataframe.columns)}")
            
            # Validate numeric columns for specific chart types
            if chart_type in ["pie", "scatter"]:
                self._validate_numeric_column(dataframe, y_column, chart_type)
                if chart_type == "scatter":
                    self._validate_numeric_column(dataframe, x_column, chart_type)
            
            # Sample large datasets for performance
            df_sampled, sample_indices = self._sample_dataframe(dataframe, sample_strategy, sample_seed)
            if len(df_sampled) < len(dataframe):
                title += f" (Sampled {len(df_sampled)}/{len(dataframe)} points)"

            # Generate chart based on type (use sampled data)
            if chart_type == "pie":
                option = self._generate_pie_chart(df_sampled, x_column, y_column, title, legend_show)
            elif chart_type == "scatter":
                option = self._generate_scatter_chart(df_sampled, x_column, y_column, title, legend_show)
            elif chart_type == "area":
                option = self._generate_area_chart(df_sampled, x_column, y_column, title, legend_show)
            else:  # line or bar
                option = self._generate_basic_chart(df_sampled, chart_type, x_column, y_column, title, legend_show)

            # Convert to JSON string
            # attach metadata if requested
            metadata = {}
            # always attach metadata (include_metadata flag kept for backward compatible UI control)
            metadata = {
                "sample_count": len(df_sampled),
                "total_count": len(dataframe),
                "sample_indices": sample_indices
            }
            # persist sample rows if requested
            if persist_sample:
                try:
                    sample_path = self._persist_sample_rows(df_sampled, sample_indices)
                    metadata["sample_path"] = sample_path
                except Exception:
                    metadata["sample_path"] = None
            option["_metadata"] = metadata
            # wrap option and metadata at top-level to ensure metadata is discoverable
            full = {"option": option, "_metadata": metadata}
            option_json = json.dumps(full, ensure_ascii=False, indent=2)

            return (option_json, metadata)
            
        except Exception as e:
            # Return error message in chart format
            error_option = {
                "title": {"text": "Chart Generation Error", "left": "center"},
                "graphic": {
                    "type": "text",
                    "left": "center",
                    "top": "middle",
                    "style": {
                        "text": f"Error: {str(e)}",
                        "fontSize": 16,
                        "fill": "#e74c3c"
                    }
                }
            }
            return (json.dumps(error_option),)
    
    def _sample_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Sample large datasets for better performance.
        Uses systematic sampling to maintain distribution.
        """
        # compatibility wrapper: default to systematic
        return self._sample_dataframe_with_strategy(df, "systematic", 42)

    def _sample_dataframe_with_strategy(self, df: pd.DataFrame, strategy: str, seed: int = 42) -> Tuple[pd.DataFrame, List[int]]:
        n = len(df)
        if n <= self.MAX_DATA_POINTS:
            return df, list(df.index)

        if strategy == "reservoir":
            # reservoir sampling
            import random
            random.seed(seed)
            reservoir = []
            it = enumerate(df.itertuples(index=True))
            for i, row in it:
                if len(reservoir) < self.MAX_DATA_POINTS:
                    reservoir.append(i)
                else:
                    j = random.randint(0, i)
                    if j < self.MAX_DATA_POINTS:
                        reservoir[j] = i
            reservoir_sorted = sorted(reservoir)
            return df.loc[reservoir_sorted].reset_index(drop=True), reservoir_sorted
        else:
            # systematic sampling
            step = max(1, n // self.MAX_DATA_POINTS)
            indices = list(range(0, n, step))[:self.MAX_DATA_POINTS]
            return df.iloc[indices].reset_index(drop=True), indices

    def _sample_dataframe(self, df: pd.DataFrame, strategy: str = "systematic", seed: int = 42) -> Tuple[pd.DataFrame, List[int]]:
        return self._sample_dataframe_with_strategy(df, strategy, seed)

    def _persist_sample_rows(self, df_sampled: pd.DataFrame, indices: List[int]) -> Optional[str]:
        """
        Persist selected sample rows atomically to storage and return path.
        df_sampled: the sampled dataframe (already subset)
        indices: original indices for reference
        """
        storage_root = getattr(settings, "STORAGE_PATH", "./storage")
        sample_dir = Path(storage_root) / "samples"
        sample_dir.mkdir(parents=True, exist_ok=True)
        # generate filename by hash of indices + timestamp
        key = ",".join(map(str, indices))
        fname = hashlib.sha1(key.encode()).hexdigest()[:12] + ".json"
        final_path = sample_dir / fname
        try:
            tmp = sample_dir / f".{fname}.tmp"
            # Convert sampled dataframe to JSON-safe records
            payload = []
            for _, row in df_sampled.iterrows():
                row_dict = {}
                for col in df_sampled.columns:
                    value = row[col]
                    if pd.isna(value):
                        row_dict[col] = None
                    elif pd.api.types.is_datetime64_any_dtype(df_sampled[col]):
                        row_dict[col] = value.isoformat()
                    else:
                        row_dict[col] = value
                payload.append(row_dict)

            with open(tmp, "w", encoding="utf-8") as f:
                _json.dump({"sample_indices": indices, "rows": payload}, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(str(tmp), str(final_path))
            return str(final_path)
        except Exception:
            try:
                if tmp.exists():
                    tmp.unlink()
            except Exception:
                pass
            return None
    
    def _serialize_for_json(self, series: pd.Series) -> list:
        """
        Convert pandas Series to JSON-serializable list, handling datetime and other types.
        """
        if pd.api.types.is_datetime64_any_dtype(series):
            # Convert datetime to ISO string format
            return [dt.isoformat() if pd.notna(dt) else None for dt in series]
        elif pd.api.types.is_numeric_dtype(series):
            # Numeric types can be converted directly
            return series.tolist()
        else:
            # For other types (string, object), convert to string
            return [str(val) if pd.notna(val) else None for val in series]

    def _validate_numeric_column(self, df: pd.DataFrame, col: str, chart_type: str) -> None:
        """
        Validate that numeric columns contain valid numbers for charting.
        Raises ValueError with helpful message if validation fails.
        """
        # Pie charts need numeric values column
        if chart_type == "pie":
            if col not in df.columns:
                raise ValueError(f"Column '{col}' not found")
            if not pd.api.types.is_numeric_dtype(df[col]):
                raise ValueError(f"Pie chart requires numeric values. Column '{col}' is {df[col].dtype}")
        
        # Scatter plots need numeric on both axes
        elif chart_type == "scatter":
            if col not in df.columns:
                raise ValueError(f"Column '{col}' not found")
            if not pd.api.types.is_numeric_dtype(df[col]):
                raise ValueError(f"Scatter plot requires numeric data. Column '{col}' is {df[col].dtype}")
    
    def _generate_basic_chart(
        self,
        df: pd.DataFrame,
        chart_type: str,
        x_col: str,
        y_col: str,
        title: str,
        legend_show: bool
    ) -> dict:
        """Generate line or bar chart configuration."""
        # Extract data with JSON serialization support
        x_data = self._serialize_for_json(df[x_col])
        y_data = self._serialize_for_json(df[y_col])
        
        option = {
            "title": {
                "text": title,
                "left": "center"
            },
            "tooltip": {
                "trigger": "axis",
                "axisPointer": {
                    "type": "shadow" if chart_type == "bar" else "line"
                }
            },
            "legend": {
                "show": legend_show,
                "top": "bottom"
            },
            "xAxis": {
                "type": "category",
                "data": x_data,
                "name": x_col
            },
            "yAxis": {
                "type": "value",
                "name": y_col
            },
            "series": [{
                "name": y_col,
                "type": chart_type,
                "data": y_data,
                "smooth": True if chart_type == "line" else False,
                "emphasis": {
                    "focus": "series"
                }
            }]
        }
        
        return option
    
    def _generate_area_chart(
        self,
        df: pd.DataFrame,
        x_col: str,
        y_col: str,
        title: str,
        legend_show: bool
    ) -> dict:
        """Generate area chart (line chart with filled area)."""
        option = self._generate_basic_chart(df, "line", x_col, y_col, title, legend_show)
        # Convert series type to 'area' and add area fill
        option["series"][0]["type"] = "area"
        option["series"][0]["areaStyle"] = {}
        return option
    
    def _generate_pie_chart(
        self,
        df: pd.DataFrame,
        name_col: str,
        value_col: str,
        title: str,
        legend_show: bool
    ) -> dict:
        """Generate pie chart configuration."""
        # Prepare data in [{name: x, value: y}] format with JSON serialization
        name_data = self._serialize_for_json(df[name_col])
        value_data = self._serialize_for_json(df[value_col])
        data = [
            {"name": str(name), "value": float(value)}
            for name, value in zip(name_data, value_data)
        ]
        
        option = {
            "title": {
                "text": title,
                "left": "center"
            },
            "tooltip": {
                "trigger": "item",
                "formatter": "{a} <br/>{b}: {c} ({d}%)"
            },
            "legend": {
                "show": legend_show,
                "orient": "vertical",
                "left": "left"
            },
            "series": [{
                "name": value_col,
                "type": "pie",
                "radius": "50%",
                "data": data,
                "emphasis": {
                    "itemStyle": {
                        "shadowBlur": 10,
                        "shadowOffsetX": 0,
                        "shadowColor": "rgba(0, 0, 0, 0.5)"
                    }
                }
            }]
        }
        
        return option
    
    def _generate_scatter_chart(
        self,
        df: pd.DataFrame,
        x_col: str,
        y_col: str,
        title: str,
        legend_show: bool
    ) -> dict:
        """Generate scatter plot configuration."""
        # Prepare data in [[x, y]] format with JSON serialization
        x_data = self._serialize_for_json(df[x_col])
        y_data = self._serialize_for_json(df[y_col])
        data = [[float(x) if x is not None else 0, float(y) if y is not None else 0]
                for x, y in zip(x_data, y_data)]
        
        option = {
            "title": {
                "text": title,
                "left": "center"
            },
            "tooltip": {
                "trigger": "item",
                "formatter": f"{x_col}: {{c[0]}}<br/>{y_col}: {{c[1]}}"
            },
            "legend": {
                "show": legend_show,
                "top": "bottom"
            },
            "xAxis": {
                "type": "value",
                "name": x_col,
                "splitLine": {
                    "lineStyle": {
                        "type": "dashed"
                    }
                }
            },
            "yAxis": {
                "type": "value",
                "name": y_col,
                "splitLine": {
                    "lineStyle": {
                        "type": "dashed"
                    }
                }
            },
            "series": [{
                "name": f"{x_col} vs {y_col}",
                "type": "scatter",
                "symbolSize": 8,
                "data": data,
                "emphasis": {
                    "focus": "series"
                }
            }]
        }
        
        return option


class DataFrameToTableNode(BaseNode):
    """
    Convert DataFrame to HTML table for display.
    Useful for previewing data before visualization.
    Enhanced with workflow orchestration support.
    """
    
    # Node configuration
    NODE_TYPE = "DataFrameToTableNode"
    VERSION = "2.0.0"
    CATEGORY = "visualization"
    DISPLAY_NAME = "数据表格"
    
    OUTPUT_TYPES = {
        "html_table": {
            "type": "STRING",
            "description": "HTML格式的表格字符串"
        }
    }
    
    # ComfyUI兼容格式（执行器会优先使用这个方法）
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "dataframe": ("DATAFRAME",),
            },
            "optional": {
                "max_rows": ("INT", {"default": 10, "min": 1, "max": 1000}),
                "include_index": ("BOOLEAN", {"default": False}),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("html_table",)
    FUNCTION = "convert_to_table"
    
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
                cache_results=True
            )
        super().__init__(metadata)
    
    def _execute_pure(self, inputs: Dict[str, Any], context: ExecutionContext) -> Dict[str, Any]:
        """
        Pure function implementation for converting DataFrame to HTML table
        """
        dataframe = inputs.get("dataframe")
        max_rows = inputs.get("max_rows", 10)
        include_index = inputs.get("include_index", False)
        
        if dataframe is None or dataframe.empty:
            return {"html_table": '<div class="alert alert-warning">DataFrame为空</div>'}
        
        try:
            # Limit rows
            df_display = dataframe.head(max_rows)
            
            # Convert to HTML with styling
            html = df_display.to_html(
                index=include_index,
                classes="table table-striped table-bordered",
                border=0
            )
            
            # Add row count info if truncated
            if len(dataframe) > max_rows:
                html += f'<p class="text-muted">Showing {max_rows} of {len(dataframe)} rows</p>'
            
            return {"html_table": html}
            
        except Exception as e:
            # Return error message as HTML
            error_html = f'<div class="alert alert-danger">Error generating table: {str(e)}</div>'
            return {"html_table": error_html}
    
    def convert_to_table(
        self,
        dataframe: pd.DataFrame,
        max_rows: int = 10,
        include_index: bool = False
    ) -> Tuple[str]:
        """
        Legacy interface for backward compatibility
        """
        context = ExecutionContext(
            workflow_id="legacy",
            run_id="legacy_run",
            node_exec_id="dataframe_to_table"
        )
        
        result = self._execute_pure(
            {
                "dataframe": dataframe,
                "max_rows": max_rows,
                "include_index": include_index
            },
            context
        )
        return (result["html_table"],)
class ResultGenerationNode(BaseNode):
    """
    5A 结果生成节点 - 将审计结论结构化
    """
    
    NODE_TYPE = "ResultGenerationNode"
    VERSION = "1.0.0"
    CATEGORY = "viz"
    DISPLAY_NAME = "结果生成"
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "risk_items": {"type": "DATAFRAME", "required": False},  # legacy support - not required
            "risk_assessment": {"type": "DICT", "required": False},  # legacy support - not required
            "findings": {"type": "LIST", "required": False},  # legacy support
            "workflow_id": {"type": "STRING", "required": False},  # legacy support
            "run_id": {"type": "STRING", "required": False},  # legacy support
            "suggestions": {"type": "LIST", "required": False}
        }
    
    RETURN_TYPES = ("DICT",)
    RETURN_NAMES = ("audit_result",)
    FUNCTION = "generate_result"
    
    def _execute_pure(self, inputs: Dict[str, Any], context: ExecutionContext) -> Dict[str, Any]:
        """
        Pure function implementation for generating audit results
        """
        risk_items = inputs.get("risk_items") or inputs.get("findings")  # support both legacy and new input names

        # Convert findings list to DataFrame if needed
        if isinstance(risk_items, list):
            risk_items = pd.DataFrame(risk_items)

        risk_assessment = inputs.get("risk_assessment", {})
        suggestions = inputs.get("suggestions")

        # Merge workflow_id and run_id from inputs into risk_assessment if not present
        if "workflow_id" in inputs and "workflow_id" not in risk_assessment:
            risk_assessment["workflow_id"] = inputs["workflow_id"]
        if "run_id" in inputs and "run_id" not in risk_assessment:
            risk_assessment["run_id"] = inputs["run_id"]

        # Call generate_result and return as dict
        result_dict = self.generate_result(risk_items, risk_assessment, suggestions)
        if isinstance(result_dict, dict) and "audit_result" in result_dict and "file_path" in result_dict:
            return result_dict
        else:
            # Legacy compatibility: if generate_result returns tuple, convert to dict
            return {"audit_result": result_dict[0], "file_path": result_dict[1]}

    def generate_result(self, risk_items: pd.DataFrame, risk_assessment: Dict, suggestions: List = None):
        """生成结构化审计结果（AuditResult），并将版本化结果写入 storage"""
        workflow_id = risk_assessment.get("workflow_id") if isinstance(risk_assessment, dict) else None
        run_id = risk_assessment.get("run_id") if isinstance(risk_assessment, dict) else None

        # Convert risk_items rows to RiskItem models (best-effort)
        findings: List[RiskItem] = []
        if risk_items is not None and not getattr(risk_items, "empty", True):
            for idx, row in risk_items.reset_index(drop=True).iterrows():
                evid = []
                # support evidence anchors in row if present
                if "evidence" in row and isinstance(row["evidence"], dict):
                    # try to normalize
                    ev = row["evidence"]
                    if isinstance(ev, list):
                        for e in ev:
                            evid.append(EvidenceAnchor(**e) if isinstance(e, dict) else EvidenceAnchor(evidence_id=str(e), source_node="unknown"))
                    elif isinstance(ev, dict):
                        # single anchor
                        evid.append(EvidenceAnchor(**ev) if "evidence_id" in ev else EvidenceAnchor(evidence_id=str(idx), source_node="unknown", description=str(ev)))
                ri = RiskItem(
                    item_id = f"RISK-{idx+1}",
                    rule_id = row.get("rule_id") if "rule_id" in row else None,
                    description = row.get("description") if "description" in row else str(row.to_dict()),
                    subject = row.get("subject") if "subject" in row else None,
                    amount = float(row.get("amount")) if "amount" in row and row.get("amount") is not None else None,
                    risk_level = row.get("risk_level") if "risk_level" in row else None,
                    evidence = evid,
                    ai_explanation = row.get("ai_explanation") if "ai_explanation" in row else None,
                    human_review = row.get("human_review") or row.get("human_review_status") if "human_review" in row or "human_review_status" in row else None
                )
                findings.append(ri)

        # Build AuditResult
        # simple version id: v1-<timestamp>-<hash of findings>
        ts = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        # Normalize findings to dicts for stable hashing
        normalized_findings = [f.dict() if hasattr(f, "dict") else f for f in findings]
        hash_source = _json.dumps(normalized_findings, ensure_ascii=False, sort_keys=True).encode("utf-8")
        short_hash = hashlib.sha1(hash_source).hexdigest()[:8]
        version = f"v1-{ts}-{short_hash}"
        result_id = f"{workflow_id or 'wf'}_{run_id or 'run'}_{version}"

        # Build audit_result as plain dict for compatibility with tests and downstream consumers
        audit_result_dict: Dict[str, Any] = {
            "result_id": result_id,
            "workflow_id": workflow_id,
            "run_id": run_id,
            "version": version,
            "prepared_by": None,
            "reviewed_by": None,
            "approved_by": None,
            "signature_required": True,
            "signature_status": "draft",
            "legal_basis": risk_assessment.get("legal_basis") if isinstance(risk_assessment, dict) else [],
            "policy_version": risk_assessment.get("policy_version") if isinstance(risk_assessment, dict) else None,
            "jurisdiction": risk_assessment.get("jurisdiction") if isinstance(risk_assessment, dict) else None,
            "overall_opinion": None,
            "key_findings": [f.dict() if hasattr(f, "dict") else f for f in findings],
            "adjustments": [],
            "management_response": None,
            "document_meta": {
                "title": risk_assessment.get("report_title") if isinstance(risk_assessment, dict) else "审计报告",
                "report_type": risk_assessment.get("report_type") if isinstance(risk_assessment, dict) else "audit",
                "client_name": risk_assessment.get("client_name") if isinstance(risk_assessment, dict) else None,
                "period_start": risk_assessment.get("period_start") if isinstance(risk_assessment, dict) else None,
                "period_end": risk_assessment.get("period_end") if isinstance(risk_assessment, dict) else None,
                "issue_date": datetime.utcnow().isoformat(),
                "confidentiality_level": risk_assessment.get("confidentiality_level") if isinstance(risk_assessment, dict) else "internal",
                "version": version,
                "hash": short_hash
            },
            "evidence_trace": {},
            "metadata": {"generated_by": "ResultGenerationNode", "suggestions": suggestions or []},
            "immutable_hash": short_hash
        }

        # Add basic summary for compatibility
        try:
            high_count = 0
            for f in normalized_findings:
                if isinstance(f, dict) and f.get("risk_level") == "HIGH":
                    high_count += 1
            audit_result_dict["summary"] = {
                "total_items": len(normalized_findings),
                "high_risk_count": high_count,
                "overall_risk_level": "HIGH" if high_count > 0 else "LOW"
            }
        except Exception:
            audit_result_dict["summary"] = {"total_items": len(normalized_findings)}

        # Populate governance flags if any finding used experimental logic
        governance_flags = {}
        for f in findings:
            try:
                if isinstance(f, dict):
                    hr = f.get("human_review_status", {}) or {}
                else:
                    hr = getattr(f, "human_review", {}) or getattr(f, "human_review_status", {}) or {}
                if isinstance(hr, dict) and hr.get("experimental_logic_used"):
                    governance_flags["experimental_logic_used"] = True
                    break
            except Exception:
                continue
        audit_result_dict["governance_flags"] = governance_flags

        # Persist to storage: settings.STORAGE_PATH/results/{workflow_id}/{run_id}/{version}.json
        base_dir = Path(settings.STORAGE_PATH) / "results" / (workflow_id or "unknown_workflow") / (run_id or "unknown_run")
        os.makedirs(str(base_dir), exist_ok=True)
        file_path = base_dir / f"{version}.json"

        # remediation: ensure audit result contains model_info and disclaimers
        try:
            from app.core.ai_remediation import remediate_audit_result
            ar_dict = remediate_audit_result(audit_result_dict)
        except Exception:
            ar_dict = audit_result_dict
        with open(str(file_path), "w", encoding="utf-8") as f:
            f.write(_json.dumps(ar_dict, ensure_ascii=False, indent=2))

        # Return as dict for downstream nodes (include file_path for consumers)
        return {"audit_result": audit_result_dict, "file_path": str(file_path)}


class ReportGenerationNode(BaseNode):
    """
    5A-2 审计报告生成节点 - 将文本摘要转换为结构化审计报告
    """
    
    NODE_TYPE = "ReportGeneration"
    VERSION = "1.0.0"
    CATEGORY = "audit"
    DISPLAY_NAME = "报告生成"
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "violation_records": ("STRING", {"default": ""}),
            },
            "optional": {
                "inventory_variance": ("STRING", {"default": ""}),
                "benefit_transfer_clues": ("STRING", {"default": ""})
            }
        }
    
    RETURN_TYPES = ("DICT", "STRING")
    RETURN_NAMES = ("audit_report", "recommendations")
    FUNCTION = "generate_report"
    
    def generate_report(self, violation_records: str, inventory_variance: str = "", benefit_transfer_clues: str = ""):
        """生成结构化审计报告"""
        from datetime import datetime
        
        # 构建结构化报告
        audit_report = {
            "summary": {
                "report_type": "审计报告",
                "generation_time": datetime.now().isoformat(),
                "violation_count": len(violation_records.split('\n')) if violation_records else 0,
                "has_inventory_issues": bool(inventory_variance),
                "has_benefit_transfer": bool(benefit_transfer_clues)
            },
            "findings": {
                "violations": violation_records if violation_records else "无违规事项",
                "inventory_variance": inventory_variance if inventory_variance else "无盘点差异",
                "benefit_transfer_clues": benefit_transfer_clues if benefit_transfer_clues else "无利益输送线索"
            },
            "metadata": {
                "generated_by": "ReportGenerationNode",
                "version": "1.0.0"
            }
        }
        
        # 生成整改建议
        recommendations = f"""整改建议：
1. 针对违规事项：{violation_records[:100] if violation_records else '无'}
2. 针对盘点差异：{inventory_variance[:100] if inventory_variance else '无'}
3. 针对利益输送：{benefit_transfer_clues[:100] if benefit_transfer_clues else '无'}
"""
        
        return (audit_report, recommendations)


class ExportReportNode(BaseNode):
    """
    5B 报告导出节点 - 生成多种格式的报告（有输出端点）
    """
    
    NODE_TYPE = "ExportReportNode"
    VERSION = "1.0.0"
    CATEGORY = "viz"
    DISPLAY_NAME = "报告导出"
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "audit_result": ("DICT",),
                "export_format": (["excel", "json", "html"], {"default": "excel"})
            },
            "optional": {
                "save_path": ("STRING", {"default": ""}),
                "file_name_template": ("STRING", {"default": "audit_report_{timestamp}"})
            }
        }
    
    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("file_path", "status")
    FUNCTION = "export_report"


class SaveResultNode(BaseNode):
    """
    结果保存节点 - 保存数据到文件（无输出端点，类似 ComfyUI 的保存图像节点）
    """
    
    NODE_TYPE = "SaveResult"
    VERSION = "1.0.0"
    CATEGORY = "output"
    DISPLAY_NAME = "保存结果"
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "data": ("*",),  # 接受任何类型
                "file_name": ("STRING", {"default": "result_{timestamp}"}),
            },
            "optional": {
                "save_path": ("STRING", {"default": ""}),
                "format": (["json", "excel", "csv", "txt"], {"default": "json"}),
                "auto_open": ("BOOLEAN", {"default": False})
            }
        }
    
    RETURN_TYPES = ("DICT",)  # 返回结果信息用于节点内显示
    RETURN_NAMES = ("result_info",)
    FUNCTION = "save_result"
    
    def save_result(self, data, file_name: str, save_path: str = "", format: str = "json", auto_open: bool = False):
        """保存数据到文件"""
        import os
        import json
        import pandas as pd
        from datetime import datetime
        
        # 解析文件名模板
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        date_str = datetime.now().strftime("%Y%m%d")
        time_str = datetime.now().strftime("%H%M%S")
        
        final_file_name = file_name.replace("{timestamp}", timestamp).replace("{date}", date_str).replace("{time}", time_str)
        
        # 确定保存路径
        if save_path:
            export_dir = os.path.join(settings.STORAGE_PATH, save_path)
        else:
            export_dir = os.path.join(settings.STORAGE_PATH, "output", "results")
        os.makedirs(export_dir, exist_ok=True)
        
        # 根据格式保存
        if format == "json":
            file_path = os.path.join(export_dir, f"{final_file_name}.json")
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        elif format == "excel":
            file_path = os.path.join(export_dir, f"{final_file_name}.xlsx")
            if isinstance(data, dict):
                with pd.ExcelWriter(file_path) as writer:
                    for sheet_name, sheet_data in data.items():
                        if isinstance(sheet_data, (list, dict)):
                            df = pd.DataFrame(sheet_data) if isinstance(sheet_data, list) else pd.DataFrame([sheet_data])
                            df.to_excel(writer, sheet_name=str(sheet_name), index=False)
                        else:
                            pd.DataFrame([{"value": sheet_data}]).to_excel(writer, sheet_name=str(sheet_name), index=False)
            elif isinstance(data, pd.DataFrame):
                data.to_excel(file_path, index=False)
            else:
                pd.DataFrame([{"value": data}]).to_excel(file_path, index=False)
        elif format == "csv":
            file_path = os.path.join(export_dir, f"{final_file_name}.csv")
            if isinstance(data, pd.DataFrame):
                data.to_csv(file_path, index=False, encoding="utf-8-sig")
            else:
                pd.DataFrame([{"value": data}]).to_csv(file_path, index=False, encoding="utf-8-sig")
        else:  # txt
            file_path = os.path.join(export_dir, f"{final_file_name}.txt")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(str(data))
        
        status = f"已保存为 {format.upper()} 格式"
        
        # 返回结果信息（用于节点内显示）
        result_info = {
            "file_path": file_path,
            "status": status,
            "format": format,
            "saved_at": datetime.now().isoformat(),
            "file_size": os.path.getsize(file_path) if os.path.exists(file_path) else 0
        }
        return (result_info,)


class PreviewResultNode(BaseNode):
    """
    预览结果节点 - 在节点内显示数据预览（无输出端点）
    """
    
    NODE_TYPE = "PreviewResult"
    VERSION = "1.0.0"
    CATEGORY = "output"
    DISPLAY_NAME = "预览结果"
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "data": ("*",),  # 接受任何类型
            },
            "optional": {
                "preview_type": (["table", "json", "text", "chart"], {"default": "table"}),
                "max_rows": ("INT", {"default": 50, "min": 1, "max": 1000})
            }
        }
    
    RETURN_TYPES = ("DICT",)  # 返回预览数据用于节点内显示
    RETURN_NAMES = ("preview_data",)
    FUNCTION = "preview_result"
    
    def preview_result(self, data, preview_type: str = "table", max_rows: int = 50):
        """生成预览数据"""
        import json
        import pandas as pd
        
        preview_data = {
            "preview_type": preview_type,
            "data_type": type(data).__name__,
            "preview": ""
        }
        
        if preview_type == "table":
            if isinstance(data, pd.DataFrame):
                preview_data["preview"] = data.head(max_rows).to_dict('records')
                preview_data["total_rows"] = len(data)
                preview_data["columns"] = list(data.columns)
            elif isinstance(data, (list, dict)):
                df = pd.DataFrame(data) if isinstance(data, list) else pd.DataFrame([data])
                preview_data["preview"] = df.head(max_rows).to_dict('records')
                preview_data["total_rows"] = len(df)
                preview_data["columns"] = list(df.columns)
            else:
                preview_data["preview"] = str(data)
        elif preview_type == "json":
            preview_data["preview"] = json.dumps(data, ensure_ascii=False, indent=2) if not isinstance(data, str) else data
        elif preview_type == "text":
            preview_data["preview"] = str(data)
        else:  # chart
            preview_data["preview"] = "图表预览需要数据框格式"
        
        return (preview_data,)


class ExportReportResultNode(BaseNode):
    """
    导出报告结果节点 - 导出报告并在节点内显示（无输出端点）
    """
    
    NODE_TYPE = "ExportReportResult"
    VERSION = "1.0.0"
    CATEGORY = "output"
    DISPLAY_NAME = "导出报告（结果）"
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "audit_result": ("DICT",),
                "export_format": (["excel", "json", "html", "pdf"], {"default": "excel"})
            },
            "optional": {
                "save_path": ("STRING", {"default": ""}),
                "file_name_template": ("STRING", {"default": "audit_report_{timestamp}"}),
                "show_preview": ("BOOLEAN", {"default": True}),
                "auto_open": ("BOOLEAN", {"default": False})
            }
        }
    
    RETURN_TYPES = ("DICT",)  # 返回结果信息用于节点内显示
    RETURN_NAMES = ("result_info",)
    FUNCTION = "export_report_result"
    
    def export_report_result(self, audit_result: Dict, export_format: str, save_path: str = "", 
                            file_name_template: str = "audit_report_{timestamp}", 
                            show_preview: bool = True, auto_open: bool = False):
        """导出报告并在节点内显示结果"""
        import os
        import json
        from datetime import datetime
        
        # Determine deterministic filename using audit_result metadata if available
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        version = ""
        rid = None
        try:
            rid = audit_result.get("result_id")
        except Exception:
            rid = None
        version = audit_result.get("document_meta", {}).get("version") if isinstance(audit_result.get("document_meta"), dict) else None
        if rid:
            final_file_name = f"{rid}"
            if version:
                final_file_name = f"{final_file_name}_{version}"
        else:
            date_str = datetime.now().strftime("%Y%m%d")
            time_str = datetime.now().strftime("%H%M%S")
            final_file_name = file_name_template.replace("{timestamp}", timestamp).replace("{date}", date_str).replace("{time}", time_str)
        
        # 确定保存路径
        if save_path:
            export_dir = os.path.join(settings.STORAGE_PATH, save_path)
        else:
            export_dir = os.path.join(settings.STORAGE_PATH, "output", "reports")
        os.makedirs(export_dir, exist_ok=True)
        
        # 导出文件（复用 ExportReportNode 的逻辑）
        file_path = None
        status = ""
        
        if export_format == "excel":
            file_path = os.path.join(export_dir, f"{final_file_name}.xlsx")
            with pd.ExcelWriter(file_path) as writer:
                summary_df = pd.DataFrame([audit_result.get("summary", {})])
                summary_df.to_excel(writer, sheet_name="摘要", index=False)
                # 处理 findings 字段（可能是 dict 或 list）
                findings = audit_result.get("findings", {})
                if isinstance(findings, dict) and findings:
                    # 如果是字典，转换为列表格式
                    findings_list = []
                    for key, value in findings.items():
                        findings_list.append({"类型": key, "内容": str(value)})
                    if findings_list:
                        findings_df = pd.DataFrame(findings_list)
                        findings_df.to_excel(writer, sheet_name="审计发现", index=False)
                elif isinstance(findings, list) and findings:
                    findings_df = pd.DataFrame(findings)
                    findings_df.to_excel(writer, sheet_name="审计发现", index=False)
        elif export_format == "json":
            file_path = os.path.join(export_dir, f"{final_file_name}.json")
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(audit_result, f, ensure_ascii=False, indent=2)
        elif export_format == "html":
            file_path = os.path.join(export_dir, f"{final_file_name}.html")
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"><title>审计报告</title></head>
            <body>
                <h1>审计报告</h1>
                <pre>{json.dumps(audit_result, ensure_ascii=False, indent=2)}</pre>
            </body>
            </html>
            """
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(html_content)
        
        status = f"已导出为 {export_format.upper()} 格式"
        
        # 返回结果信息（用于节点内显示）
        result = {
            "file_path": file_path,
            "status": status,
            "format": export_format,
            "saved_at": datetime.now().isoformat(),
            "file_size": os.path.getsize(file_path) if file_path and os.path.exists(file_path) else 0,
            "preview": audit_result.get("summary", {}) if show_preview else None,
            "show_preview": show_preview
        }
        
        return (result,)
    
def _export_report_impl(self, audit_result: Dict, export_format: str):
    """Simplified export implementation with AI governance checks"""
    import os
    import json
    from datetime import datetime

    # AI governance check
    from app.core import ai_gov
    gov_res = ai_gov.check(audit_result)

    # If hard violations -> block issuance
    if gov_res.get("violations", {}).get("hard", 0) > 0 or gov_res.get("status") == "FAILED_HARD":
        # Try audit log
        try:
            # Try to write audit log if possible
            from app.core.audit_service import AuditService
            db = SessionLocal()
            try:
                AuditService.log(db, action_type="AI_GOVERNANCE_BLOCK", target_type="audit_result", target_id=audit_result.get("result_id"), parameters={"ai_gov": gov_res})
                db.commit()
            finally:
                db.close()
        except Exception:
            # If audit logging fails, just continue
            pass

        # Return blocked status
        status_obj = {"error_type": "AI_GOVERNANCE_BLOCK", "ai_scan_artifact": gov_res.get("report_ref"), "violations_summary": gov_res.get("violations")}
        return None, json.dumps(status_obj, ensure_ascii=False)

    export_dir = os.path.join(settings.STORAGE_PATH, "output", "reports")
    os.makedirs(export_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    rid = audit_result.get("result_id") if isinstance(audit_result, dict) else None
    version = None
    if isinstance(audit_result.get("document_meta"), dict):
        version = audit_result["document_meta"].get("version")
    base_name = (rid + (f"_{version}" if version else "")) if rid else f"audit_report_{timestamp}"

    if export_format == "json":
        file_name = f"{base_name}.json"
        file_path = os.path.join(export_dir, file_name)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(audit_result, f, ensure_ascii=False, indent=2)
        status = "JSON report generated"
    elif export_format == "excel":
        try:
            import pandas as _pd
            file_name = f"{base_name}.xlsx"
            file_path = os.path.join(export_dir, file_name)
            with _pd.ExcelWriter(file_path) as writer:
                summary_df = _pd.DataFrame([audit_result.get("summary", {})])
                summary_df.to_excel(writer, sheet_name="summary", index=False)
                findings = audit_result.get("findings", [])
                if isinstance(findings, list) and findings:
                    findings_df = _pd.DataFrame(findings)
                    findings_df.to_excel(writer, sheet_name="findings", index=False)
            status = "Excel report generated"
        except Exception:
            file_path = None
            status = "Failed to generate Excel report"
    else:
        file_name = f"{base_name}.html"
        file_path = os.path.join(export_dir, file_name)
        html_content = f"<html><body><pre>{json.dumps(audit_result, ensure_ascii=False, indent=2)}</pre></body></html>"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        status = "HTML report generated"
    return file_path, status

# Backwards-compatible: ensure ExportReportNode instances have an export_report method
try:
    ExportReportNode.export_report = _export_report_impl
except Exception:
    pass


NODE_CLASS_MAPPINGS = {
    "QuickPlotNode": QuickPlotNode,
    "DataFrameToTableNode": DataFrameToTableNode,
    "ResultGenerationNode": ResultGenerationNode,
    "ReportGeneration": ReportGenerationNode,
    "ExportReportNode": ExportReportNode,
    "SaveResult": SaveResultNode,
    "PreviewResult": PreviewResultNode,
    "ExportReportResult": ExportReportResultNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "QuickPlotNode": "快速绘图",
    "DataFrameToTableNode": "数据表预览",
    "ResultGenerationNode": "结果生成",
    "ReportGeneration": "报告生成",
    "ExportReportNode": "报告导出",
    "SaveResult": "保存结果",
    "PreviewResult": "预览结果",
    "ExportReportResult": "导出报告（结果）"
}
