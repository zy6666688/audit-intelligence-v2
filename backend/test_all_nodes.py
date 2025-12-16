"""
全面测试所有节点的功能
验证每个节点是否能正常执行并产生预期输出
"""
import sys
import os
import json
import traceback
import pandas as pd
import numpy as np

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 初始化节点注册
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

# #region agent log - Test suite start
_log_path = r"d:\审计数智析v2\.cursor\debug.log"
try:
    os.makedirs(os.path.dirname(_log_path), exist_ok=True)
    with open(_log_path, "a", encoding="utf-8") as _f:
        _f.write(json.dumps({
            "sessionId": "debug-session",
            "runId": "node-test-suite",
            "hypothesisId": "H1",
            "location": "test_all_nodes:start",
            "message": "node test suite started",
            "data": {
                "registered_nodes": list(node_registry.node_mappings.keys()),
                "node_count": len(node_registry.node_mappings)
            },
            "timestamp": int(__import__("time").time() * 1000)
        }, ensure_ascii=False) + "\n")
except:
    pass
# #endregion

# 创建测试数据
def create_test_dataframe():
    """创建测试用的DataFrame"""
    return pd.DataFrame({
        "发票号码": ["INV-001", "INV-002", "INV-003", "INV-004"],
        "金额": [1000.0, 2000.0, None, 4000.0],
        "日期": ["2024-01-01", "2024-01-02", "2024-01-03", None],
        "供应商": ["供应商A", "供应商B", "供应商C", "供应商D"]
    })

def test_node(node_name, test_inputs, expected_output_types=None):
    """测试单个节点"""
    print(f"\n{'='*70}")
    print(f"Testing: {node_name}")
    print(f"{'='*70}")
    
    # #region agent log - Node test start
    try:
        with open(_log_path, "a", encoding="utf-8") as _f:
            _f.write(json.dumps({
                "sessionId": "debug-session",
                "runId": "node-test-suite",
                "hypothesisId": "H2",
                "location": f"test_all_nodes:test_node:{node_name}",
                "message": "node test started",
                "data": {
                    "node_name": node_name,
                    "test_inputs_keys": list(test_inputs.keys()),
                    "test_inputs_types": {k: type(v).__name__ for k, v in test_inputs.items()}
                },
                "timestamp": int(__import__("time").time() * 1000)
            }, ensure_ascii=False) + "\n")
    except:
        pass
    # #endregion
    
    try:
        # 1. 获取节点类
        node_class = node_registry.get_node_class(node_name)
        if not node_class:
            print(f"❌ Node class not found: {node_name}")
            return False
        
        print(f"✅ Node class found: {node_class.__name__}")
        
        # 2. 实例化节点
        instance = node_class()
        print(f"✅ Node instance created")
        
        # 3. 获取执行函数
        func_name = getattr(node_class, "FUNCTION", "execute")
        func = getattr(instance, func_name)
        print(f"✅ Execution function: {func_name}")
        
        # 4. 执行节点
        print(f"🔄 Executing with inputs: {list(test_inputs.keys())}")
        outputs = func(**test_inputs)
        
        # 5. 验证输出
        if isinstance(outputs, tuple):
            print(f"✅ Output: tuple with {len(outputs)} items")
            for i, out in enumerate(outputs):
                if isinstance(out, pd.DataFrame):
                    print(f"   Output[{i}]: DataFrame {out.shape}")
                elif isinstance(out, (str, dict, list)):
                    print(f"   Output[{i}]: {type(out).__name__} (length: {len(out) if hasattr(out, '__len__') else 'N/A'})")
                else:
                    print(f"   Output[{i}]: {type(out).__name__} = {str(out)[:100]}")
        else:
            print(f"✅ Output: {type(outputs).__name__}")
            if isinstance(outputs, pd.DataFrame):
                print(f"   Shape: {outputs.shape}")
        
        # 6. 验证输出类型
        if expected_output_types:
            if isinstance(outputs, tuple):
                if len(outputs) != len(expected_output_types):
                    print(f"⚠️  Output count mismatch: expected {len(expected_output_types)}, got {len(outputs)}")
                else:
                    for i, (out, exp_type) in enumerate(zip(outputs, expected_output_types)):
                        if exp_type == "DATAFRAME" and not isinstance(out, pd.DataFrame):
                            print(f"⚠️  Output[{i}] type mismatch: expected DataFrame, got {type(out).__name__}")
                        elif exp_type == "STRING" and not isinstance(out, str):
                            print(f"⚠️  Output[{i}] type mismatch: expected str, got {type(out).__name__}")
                        elif exp_type == "DICT" and not isinstance(out, dict):
                            print(f"⚠️  Output[{i}] type mismatch: expected dict, got {type(out).__name__}")
        
        # #region agent log - Node test success
        try:
            output_info = {}
            if isinstance(outputs, tuple):
                output_info = {
                    "output_count": len(outputs),
                    "output_types": [type(o).__name__ for o in outputs]
                }
                if len(outputs) > 0 and isinstance(outputs[0], pd.DataFrame):
                    output_info["first_output_shape"] = list(outputs[0].shape)
            else:
                output_info = {
                    "output_type": type(outputs).__name__,
                    "is_dataframe": isinstance(outputs, pd.DataFrame)
                }
                if isinstance(outputs, pd.DataFrame):
                    output_info["shape"] = list(outputs.shape)
            
            with open(_log_path, "a", encoding="utf-8") as _f:
                _f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "node-test-suite",
                    "hypothesisId": "H2",
                    "location": f"test_all_nodes:test_node:{node_name}:success",
                    "message": "node test completed successfully",
                    "data": {
                        "node_name": node_name,
                        "success": True,
                        **output_info
                    },
                    "timestamp": int(__import__("time").time() * 1000)
                }, ensure_ascii=False) + "\n")
        except:
            pass
        # #endregion
        
        return True
        
    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()
        print(f"❌ Error: {error_msg}")
        print(f"   Traceback:\n{error_trace[:500]}")
        
        # #region agent log - Node test error
        try:
            with open(_log_path, "a", encoding="utf-8") as _f:
                _f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "node-test-suite",
                    "hypothesisId": "H2",
                    "location": f"test_all_nodes:test_node:{node_name}:error",
                    "message": "node test failed",
                    "data": {
                        "node_name": node_name,
                        "error": error_msg,
                        "error_type": type(e).__name__,
                        "traceback": error_trace[:1000]
                    },
                    "timestamp": int(__import__("time").time() * 1000)
                }, ensure_ascii=False) + "\n")
        except:
            pass
        # #endregion
        
        return False

# 测试用例定义
test_cases = []

# 1. ExcelLoader - 需要实际文件
test_file = "input/sample_invoices.xlsx"
if os.path.exists(test_file):
    test_cases.append(("ExcelLoader", {
        "file_path": test_file
    }, ["DATAFRAME"]))

# 2. FileUploadNode - 需要实际文件
if os.path.exists(test_file):
    test_cases.append(("FileUploadNode", {
        "file_path": test_file,
        "workflow_id": "test_workflow"
    }, ["STRING", "STRING", "DICT"]))

# 3. FileRecognitionNode - 需要先有上传的文件
# 跳过，需要先运行FileUploadNode

# 4. ColumnMapperNode - 需要DataFrame
test_df = create_test_dataframe()
test_cases.append(("ColumnMapperNode", {
    "dataframe": test_df,
    "mapping_json": '{"发票号码":"invoice_no","金额":"amount","日期":"date"}',
    "keep_other_columns": True,
    "strict_mode": False
}, ["DATAFRAME", "STRING"]))

# 5. NullValueCleanerNode - 需要DataFrame
test_cases.append(("NullValueCleanerNode", {
    "dataframe": test_df,
    "target_columns": "amount,日期",
    "strategy": "drop_rows"
}, ["DATAFRAME", "STRING"]))

# 6. ExcelColumnValidator - 需要DataFrame
test_cases.append(("ExcelColumnValidator", {
    "dataframe": test_df,
    "column_name": "金额",
    "min_value": 0,
    "max_value": 5000,
    "include_bounds": True
}, ["DATAFRAME", "STRING"]))

# 7. AuditCheckNode - 只需要amount和threshold
test_cases.append(("AuditCheckNode", {
    "amount": 2000.0,
    "threshold": 1500.0
}, ["BOOLEAN", "STRING"]))

# 8. QuickPlotNode - 需要DataFrame
test_cases.append(("QuickPlotNode", {
    "dataframe": test_df,
    "chart_type": "bar",
    "x_column": "发票号码",
    "y_column": "金额",
    "title": "测试图表"
}, ["STRING"]))

# 9. DataFrameToTableNode - 需要DataFrame
test_cases.append(("DataFrameToTableNode", {
    "dataframe": test_df,
    "max_rows": 10
}, ["STRING"]))

# 10. PythonScriptNode - 需要DataFrame和脚本
test_cases.append(("PythonScriptNode", {
    "dataframe": test_df,
    "script": "result = dataframe.copy()\nresult['new_col'] = result['金额'] * 2\noutput = result"
}, ["DATAFRAME", "STRING"]))

# 11. CommonMetricsNode - 需要DataFrame
test_cases.append(("CommonMetricsNode", {
    "dataframe": test_df
}, ["DICT"]))

# 12. SceneMetricsNode - 需要DataFrame和business_scene
test_cases.append(("SceneMetricsNode", {
    "dataframe": test_df,
    "business_scene": "invoice_audit"
}, ["DICT"]))

# 13. RuleCalculationNode - 需要DataFrame和metrics
test_cases.append(("RuleCalculationNode", {
    "dataframe": test_df,
    "metrics": {"amount_mean": 2000.0, "amount_std": 1000.0}
}, ["DATAFRAME", "INT"]))

# 14. TextUnderstandingAI - 需要文本
test_cases.append(("TextUnderstandingAI", {
    "text_data": "这是一段测试文本，用于测试AI文本理解功能。",
    "task_type": "classify"
}, ["LIST", "LIST", "DICT"]))

# 15. ImageRecognitionAI - 需要图片路径（跳过，需要实际图片）
# test_cases.append(("ImageRecognitionAI", {...}))

# 16. AnalysisReasoningAI - 需要DataFrame和指标
test_risk_df = pd.DataFrame([{"risk_level": "HIGH", "amount": 2000}])
test_cases.append(("AnalysisReasoningAI", {
    "risk_items": test_risk_df,
    "metrics": {"total_amount": 2000, "threshold": 1500}
}, ["STRING", "DICT"]))

# 17. HumanReviewNode - 需要DataFrame和评估
test_cases.append(("HumanReviewNode", {
    "risk_items": test_risk_df,
    "risk_assessment": {"risk_level": "HIGH", "risk_score": 75}
}, ["DICT"]))

# 18. ResultGenerationNode - 需要DataFrame和评估
test_cases.append(("ResultGenerationNode", {
    "risk_items": test_risk_df,
    "risk_assessment": {"risk_level": "HIGH", "risk_score": 75}
}, ["STRING"]))

# 19. ExportReportNode - 需要审计结果和格式
test_cases.append(("ExportReportNode", {
    "audit_result": {"summary": {"total_items": 1}, "findings": []},
    "export_format": "json"
}, ["STRING", "STRING"]))

if __name__ == "__main__":
    print("="*70)
    print("Node Functionality Test Suite")
    print("="*70)
    print(f"Total test cases: {len(test_cases)}")
    print(f"Registered nodes: {len(node_registry.node_mappings)}")
    
    results = {}
    passed = 0
    failed = 0
    
    for node_name, inputs, expected_types in test_cases:
        success = test_node(node_name, inputs, expected_types)
        results[node_name] = success
        if success:
            passed += 1
        else:
            failed += 1
    
    print("\n" + "="*70)
    print("Test Summary")
    print("="*70)
    print(f"Total: {len(test_cases)}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print("\nFailed nodes:")
    for node_name, success in results.items():
        if not success:
            print(f"  - {node_name}")
    
    # #region agent log - Test suite end
    try:
        with open(_log_path, "a", encoding="utf-8") as _f:
            _f.write(json.dumps({
                "sessionId": "debug-session",
                "runId": "node-test-suite",
                "hypothesisId": "H1",
                "location": "test_all_nodes:end",
                "message": "node test suite completed",
                "data": {
                    "total": len(test_cases),
                    "passed": passed,
                    "failed": failed,
                    "results": results
                },
                "timestamp": int(__import__("time").time() * 1000)
            }, ensure_ascii=False) + "\n")
    except:
        pass
    # #endregion

