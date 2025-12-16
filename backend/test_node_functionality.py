"""
全面测试所有节点功能，识别异常节点
"""
import sys
import os
import json
import traceback
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.registry import node_registry
import app.nodes.file_nodes
import app.nodes.clean_nodes
import app.nodes.audit_nodes
import app.nodes.viz_nodes
import app.nodes.script_nodes
import app.nodes.ai_nodes

node_registry.register_nodes_from_module("app.nodes.file_nodes")
node_registry.register_nodes_from_module("app.nodes.clean_nodes")
node_registry.register_nodes_from_module("app.nodes.audit_nodes")
node_registry.register_nodes_from_module("app.nodes.viz_nodes")
node_registry.register_nodes_from_module("app.nodes.script_nodes")
node_registry.register_nodes_from_module("app.nodes.ai_nodes")

_log_path = r"d:\审计数智析v2\.cursor\debug.log"

def log_event(location, message, data, hypothesis_id="H1"):
    try:
        os.makedirs(os.path.dirname(_log_path), exist_ok=True)
        with open(_log_path, "a", encoding="utf-8") as _f:
            _f.write(json.dumps({
                "sessionId": "debug-session",
                "runId": "node-functionality-test",
                "hypothesisId": hypothesis_id,
                "location": location,
                "message": message,
                "data": data,
                "timestamp": int(__import__("time").time() * 1000)
            }, ensure_ascii=False) + "\n")
    except:
        pass

log_event("test_node_functionality:start", "node functionality test started", {
    "registered_nodes": list(node_registry.node_mappings.keys()),
    "node_count": len(node_registry.node_mappings)
})

# 创建测试数据
test_df = pd.DataFrame({
    "发票号码": ["INV-001", "INV-002", "INV-003", "INV-004"],
    "金额": [1000.0, 2000.0, None, 4000.0],
    "日期": ["2024-01-01", "2024-01-02", "2024-01-03", None],
    "供应商": ["供应商A", "供应商B", "供应商C", "供应商D"]
})

test_risk_df = pd.DataFrame([{"risk_level": "HIGH", "amount": 2000}])

def test_node(node_name, test_inputs, expected_output_count=None):
    """测试单个节点并返回结果"""
    result = {
        "node_name": node_name,
        "success": False,
        "error": None,
        "error_type": None,
        "error_details": None
    }
    
    try:
        log_event(f"test:{node_name}:start", f"testing {node_name}", {
            "test_inputs_keys": list(test_inputs.keys())
        }, "H2")
        
        # 1. 获取节点类
        node_class = node_registry.get_node_class(node_name)
        if not node_class:
            result["error"] = f"Node class not found: {node_name}"
            result["error_type"] = "NodeNotFound"
            log_event(f"test:{node_name}:error", "node class not found", result, "H2")
            return result
        
        # 2. 实例化节点
        instance = node_class()
        
        # 3. 获取执行函数
        func_name = getattr(node_class, "FUNCTION", "execute")
        if not hasattr(instance, func_name):
            result["error"] = f"Function '{func_name}' not found in {node_class.__name__}"
            result["error_type"] = "FunctionNotFound"
            log_event(f"test:{node_name}:error", "function not found", result, "H2")
            return result
        
        func = getattr(instance, func_name)
        
        # 4. 执行节点
        outputs = func(**test_inputs)
        
        # 5. 验证输出
        if expected_output_count:
            if isinstance(outputs, tuple):
                if len(outputs) != expected_output_count:
                    result["error"] = f"Output count mismatch: expected {expected_output_count}, got {len(outputs)}"
                    result["error_type"] = "OutputCountMismatch"
                    log_event(f"test:{node_name}:error", "output count mismatch", result, "H2")
                    return result
            else:
                if expected_output_count != 1:
                    result["error"] = f"Expected tuple with {expected_output_count} items, got {type(outputs).__name__}"
                    result["error_type"] = "OutputTypeMismatch"
                    log_event(f"test:{node_name}:error", "output type mismatch", result, "H2")
                    return result
        
        result["success"] = True
        output_info = {}
        if isinstance(outputs, tuple):
            output_info = {
                "output_count": len(outputs),
                "output_types": [type(o).__name__ for o in outputs]
            }
        else:
            output_info = {
                "output_type": type(outputs).__name__
            }
        
        log_event(f"test:{node_name}:success", f"{node_name} passed", output_info, "H2")
        
    except TypeError as e:
        result["error"] = str(e)
        result["error_type"] = "TypeError"
        result["error_details"] = traceback.format_exc()[:500]
        log_event(f"test:{node_name}:error", "TypeError", result, "H2")
    except ValueError as e:
        result["error"] = str(e)
        result["error_type"] = "ValueError"
        result["error_details"] = traceback.format_exc()[:500]
        log_event(f"test:{node_name}:error", "ValueError", result, "H2")
    except AttributeError as e:
        result["error"] = str(e)
        result["error_type"] = "AttributeError"
        result["error_details"] = traceback.format_exc()[:500]
        log_event(f"test:{node_name}:error", "AttributeError", result, "H2")
    except Exception as e:
        result["error"] = str(e)
        result["error_type"] = type(e).__name__
        result["error_details"] = traceback.format_exc()[:500]
        log_event(f"test:{node_name}:error", "exception", result, "H2")
    
    return result

# 测试用例
test_cases = []

# 文件节点
test_file = "input/sample_invoices.xlsx"
if os.path.exists(test_file) or os.path.exists(f"backend/{test_file}"):
    test_cases.append(("ExcelLoader", {"file_path": test_file}, 1))
    test_cases.append(("FileUploadNode", {"file_path": test_file, "workflow_id": "test"}, 3))

# 清洗节点
test_cases.append(("ColumnMapperNode", {
    "dataframe": test_df,
    "mapping_json": '{"发票号码":"invoice_no","金额":"amount"}',
    "keep_other_columns": True,
    "strict_mode": False
}, 2))

test_cases.append(("NullValueCleanerNode", {
    "dataframe": test_df,
    "target_columns": "amount,日期",
    "strategy": "drop_rows"
}, 2))

# 审计节点
test_cases.append(("ExcelColumnValidator", {
    "dataframe": test_df,
    "column_name": "金额",
    "min_value": 0,
    "max_value": 5000,
    "include_bounds": True
}, 2))

test_cases.append(("AuditCheckNode", {
    "amount": 2000.0,
    "threshold": 1500.0
}, 2))

test_cases.append(("CommonMetricsNode", {
    "dataframe": test_df
}, 1))

test_cases.append(("SceneMetricsNode", {
    "dataframe": test_df,
    "business_scene": "invoice_audit"
}, 1))

test_cases.append(("RuleCalculationNode", {
    "dataframe": test_df,
    "metrics": {"amount_mean": 2000.0, "amount_std": 1000.0}
}, 2))

# 可视化节点
test_cases.append(("QuickPlotNode", {
    "dataframe": test_df,
    "chart_type": "bar",
    "x_column": "发票号码",
    "y_column": "金额",
    "title": "测试图表"
}, 1))

test_cases.append(("DataFrameToTableNode", {
    "dataframe": test_df,
    "max_rows": 10
}, 1))

test_cases.append(("ResultGenerationNode", {
    "risk_items": test_risk_df,
    "risk_assessment": {"risk_level": "HIGH", "risk_score": 75}
}, 1))

test_cases.append(("ExportReportNode", {
    "audit_result": {"summary": {"total_items": 1}, "findings": []},
    "export_format": "json"
}, 2))

# 脚本节点
test_cases.append(("PythonScriptNode", {
    "dataframe": test_df,
    "script": "result = dataframe.copy()\nresult['new_col'] = result['金额'] * 2\noutput = result"
}, 2))

# AI节点
test_cases.append(("TextUnderstandingAI", {
    "text_data": "这是一段测试文本",
    "task_type": "classify"
}, 3))

test_cases.append(("ImageRecognitionAI", {
    "ocr_text": "发票号码: INV-001, 金额: 1000元",
    "check_type": "anomaly"
}, 2))

test_cases.append(("AnalysisReasoningAI", {
    "risk_items": test_risk_df,
    "metrics": {"total_amount": 2000, "threshold": 1500}
}, 3))

test_cases.append(("HumanReviewNode", {
    "risk_items": test_risk_df,
    "risk_assessment": {"risk_level": "HIGH", "risk_score": 75}
}, 2))

if __name__ == "__main__":
    print("="*70)
    print("节点功能测试")
    print("="*70)
    
    results = {}
    passed = 0
    failed = 0
    
    for node_name, inputs, expected_count in test_cases:
        result = test_node(node_name, inputs, expected_count)
        results[node_name] = result
        if result["success"]:
            passed += 1
            print(f"✅ {node_name}: PASSED")
        else:
            failed += 1
            print(f"❌ {node_name}: FAILED")
            print(f"   错误类型: {result['error_type']}")
            print(f"   错误信息: {result['error']}")
            if result.get('error_details'):
                print(f"   详细信息: {result['error_details'][:200]}")
    
    print("\n" + "="*70)
    print("测试总结")
    print("="*70)
    print(f"总计: {len(test_cases)}")
    print(f"✅ 通过: {passed}")
    print(f"❌ 失败: {failed}")
    
    if failed > 0:
        print("\n异常节点列表:")
        print("-"*70)
        for node_name, result in results.items():
            if not result["success"]:
                print(f"\n节点: {node_name}")
                print(f"  错误类型: {result['error_type']}")
                print(f"  错误信息: {result['error']}")
                if result.get('error_details'):
                    print(f"  详细信息: {result['error_details'][:300]}")
    
    log_event("test_node_functionality:end", "test completed", {
        "total": len(test_cases),
        "passed": passed,
        "failed": failed,
        "failed_nodes": [name for name, r in results.items() if not r["success"]]
    })

