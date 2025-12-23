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
        
        # 解析文件名模板
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
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
    
    def export_report(self, audit_result: Dict, export_format: str):
        """导出审计报告"""
        import os
        import json
        from datetime import datetime
        
        # 确保导出目录存在（统一使用 STORAGE_PATH/output/reports）
        export_dir = os.path.join(settings.STORAGE_PATH, "output", "reports")
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
