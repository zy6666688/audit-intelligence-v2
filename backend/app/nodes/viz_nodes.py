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
        return {
            "required": {
                "dataframe": ("DATAFRAME",),
                "chart_type": (["line", "bar", "pie", "scatter", "area"],),
                "x_column": ("STRING", {"default": ""}),
                "y_column": ("STRING", {"default": ""}),
            },
            "optional": {
                "title": ("STRING", {"default": "Chart"}),
                "legend_show": ("BOOLEAN", {"default": True}),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("echarts_option",)
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
            df_sampled = self._sample_dataframe(dataframe)
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
            option_json = json.dumps(option, ensure_ascii=False, indent=2)
            
            return (option_json,)
            
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
        if len(df) <= self.MAX_DATA_POINTS:
            return df
        
        # Systematic sampling
        step = len(df) // self.MAX_DATA_POINTS
        return df.iloc[::step].reset_index(drop=True)
    
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
        # Extract data
        x_data = df[x_col].tolist()
        y_data = df[y_col].tolist()
        
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
        # Add area fill
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
        # Prepare data in [{name: x, value: y}] format
        data = [
            {"name": str(name), "value": float(value)}
            for name, value in zip(df[name_col], df[value_col])
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
        # Prepare data in [[x, y]] format
        data = [[float(x), float(y)] for x, y in zip(df[x_col], df[y_col])]
        
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
            "required": {
                "risk_items": ("DATAFRAME",),
                "risk_assessment": ("DICT",)
            },
            "optional": {
                "suggestions": ("LIST",)
            }
        }
    
    RETURN_TYPES = ("DICT",)
    RETURN_NAMES = ("audit_result",)
    FUNCTION = "generate_result"
    
    def generate_result(self, risk_items: pd.DataFrame, risk_assessment: Dict, suggestions: List = None):
        """生成结构化审计结果"""
        
        # 统计分析
        high_risk_count = 0
        medium_risk_count = 0
        
        if not risk_items.empty and "risk_level" in risk_items.columns:
            high_risk_count = len(risk_items[risk_items["risk_level"] == "HIGH"])
            medium_risk_count = len(risk_items[risk_items["risk_level"] == "MEDIUM"])
        
        audit_result = {
            "summary": {
                "total_items": len(risk_items),
                "high_risk_count": high_risk_count,
                "medium_risk_count": medium_risk_count,
                "overall_risk_level": risk_assessment.get("risk_level", "UNKNOWN")
            },
            "findings": risk_items.to_dict('records') if not risk_items.empty else [],
            "risk_assessment": risk_assessment,
            "recommendations": suggestions or ["无特别建议"],
            "generation_time": datetime.now().isoformat()
        }
        
        return (audit_result,)


class ExportReportNode(BaseNode):
    """
    5B 报告导出节点 - 生成多种格式的报告
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
            }
        }
    
    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("file_path", "status")
    FUNCTION = "export_report"
    
    def export_report(self, audit_result: Dict, export_format: str):
        """导出审计报告"""
        import os
        import json
        from datetime import datetime
        
        # 确保导出目录存在
        export_dir = "backend/output/reports"
        os.makedirs(export_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if export_format == "excel":
            # 导出为Excel
            file_name = f"audit_report_{timestamp}.xlsx"
            file_path = os.path.join(export_dir, file_name)
            
            with pd.ExcelWriter(file_path) as writer:
                # 摘要sheet
                summary_df = pd.DataFrame([audit_result.get("summary", {})])
                summary_df.to_excel(writer, sheet_name="摘要", index=False)
                
                # 发现sheet
                if audit_result.get("findings"):
                    findings_df = pd.DataFrame(audit_result["findings"])
                    findings_df.to_excel(writer, sheet_name="审计发现", index=False)
                
                # 建议sheet
                if audit_result.get("recommendations"):
                    rec_df = pd.DataFrame({"\u5efa\u8bae": audit_result["recommendations"]})
                    rec_df.to_excel(writer, sheet_name="审计建议", index=False)
            
            status = f"Excel报告已生成"
            
        elif export_format == "json":
            # 导出为JSON
            file_name = f"audit_report_{timestamp}.json"
            file_path = os.path.join(export_dir, file_name)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(audit_result, f, ensure_ascii=False, indent=2)
            
            status = f"JSON报告已生成"
            
        elif export_format == "html":
            # 导出为HTML
            file_name = f"audit_report_{timestamp}.html"
            file_path = os.path.join(export_dir, file_name)
            
            # 生成简单的HTML报告
            html_content = f"""
            <html>
            <head>
                <title>审计报告 - {timestamp}</title>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 20px; }}
                    h1 {{ color: #333; }}
                    table {{ border-collapse: collapse; width: 100%; }}
                    th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                    th {{ background-color: #f2f2f2; }}
                </style>
            </head>
            <body>
                <h1>审计报告</h1>
                <h2>摘要</h2>
                <p>总项目数: {audit_result['summary']['total_items']}</p>
                <p>高风险: {audit_result['summary']['high_risk_count']}</p>
                <p>中风险: {audit_result['summary']['medium_risk_count']}</p>
                <p>总体风险级别: {audit_result['summary']['overall_risk_level']}</p>
            </body>
            </html>
            """
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            status = f"HTML报告已生成"
        
        return file_path, status


NODE_CLASS_MAPPINGS = {
    "QuickPlotNode": QuickPlotNode,
    "DataFrameToTableNode": DataFrameToTableNode,
    "ResultGenerationNode": ResultGenerationNode,
    "ExportReportNode": ExportReportNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "QuickPlotNode": "快速绘图",
    "DataFrameToTableNode": "数据表预览",
    "ResultGenerationNode": "结果生成",
    "ExportReportNode": "报告导出"
}
