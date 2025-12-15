#!/usr/bin/env python3
"""
验证工作流修复是否生效
"""
import json
import os
import sys

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_registry():
    """测试节点注册"""
    print("=" * 60)
    print("测试节点注册")
    print("=" * 60)
    
    try:
        from app.core.registry import node_registry
        import app.nodes  # 触发注册
        
        # 检查 get_node_class 方法是否存在
        if not hasattr(node_registry, 'get_node_class'):
            print("[FAIL] get_node_class method missing!")
            return False
        
        print("[OK] get_node_class method exists")
        
        # 测试查找节点
        test_nodes = ["ExcelLoader", "FileUploadNode", "ColumnMapperNode"]
        all_found = True
        for node_name in test_nodes:
            node_class = node_registry.get_node_class(node_name)
            if node_class:
                print(f"[OK] {node_name}: found")
            else:
                print(f"[FAIL] {node_name}: not found")
                all_found = False
        
        return all_found
    except Exception as e:
        print(f"[FAIL] Registry test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_executor():
    """测试executor格式转换"""
    print("\n" + "=" * 60)
    print("测试工作流格式转换")
    print("=" * 60)
    
    try:
        from app.core.executor import executor
        
        # 检查方法是否存在
        if not hasattr(executor, '_normalize_workflow_format'):
            print("[FAIL] _normalize_workflow_format method missing!")
            return False
        
        print("[OK] _normalize_workflow_format method exists")
        
        # 创建测试工作流（简化格式）
        test_workflow = {
            "nodes": [
                {
                    "id": "n1",
                    "type": "ExcelLoader",
                    "params": {"file_path": "test.xlsx"}
                },
                {
                    "id": "n2",
                    "type": "ColumnMapperNode",
                    "params": {"mapping_json": "{}"}
                }
            ],
            "edges": [
                {"from": "n1", "to": "n2", "from_slot": 0, "to_slot": 0}
            ]
        }
        
        # 测试转换
        normalized = executor._normalize_workflow_format(test_workflow)
        
        if not isinstance(normalized, dict):
            print(f"[FAIL] Normalized result is not a dict: {type(normalized)}")
            return False
        
        if len(normalized) != 2:
            print(f"[FAIL] Expected 2 nodes, got {len(normalized)}")
            return False
        
        # 检查节点格式
        for node_id, node_def in normalized.items():
            if "class_type" not in node_def:
                print(f"[FAIL] Node {node_id} missing 'class_type'")
                return False
            if "inputs" not in node_def:
                print(f"[FAIL] Node {node_id} missing 'inputs'")
                return False
        
        print("[OK] Format conversion successful")
        print(f"  - Converted nodes: {list(normalized.keys())}")
        for node_id, node_def in normalized.items():
            print(f"  - {node_id}: class_type={node_def['class_type']}")
        
        return True
    except Exception as e:
        print(f"[FAIL] Executor test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_workflow_file():
    """测试实际工作流文件"""
    print("\n" + "=" * 60)
    print("测试工作流文件")
    print("=" * 60)
    
    workflow_paths = [
        "backend/backend/workflows/audit_mock_workflow.json",
        "backend/workflows/invoice_audit_workflow.json"
    ]
    
    for workflow_path in workflow_paths:
        if os.path.exists(workflow_path):
            print(f"\nTesting: {workflow_path}")
            try:
                with open(workflow_path, "r", encoding="utf-8") as f:
                    workflow_data = json.load(f)
                
                # 检查格式
                if "nodes" not in workflow_data:
                    print(f"[SKIP] Not in simplified format")
                    continue
                
                # 测试转换
                from app.core.executor import executor
                normalized = executor._normalize_workflow_format(workflow_data)
                
                print(f"[OK] File loaded and converted successfully")
                print(f"  - Nodes: {len(normalized)}")
                
                # 验证所有节点类型
                from app.core.registry import node_registry
                import app.nodes
                
                all_valid = True
                for node_id, node_def in normalized.items():
                    class_type = node_def.get("class_type")
                    node_class = node_registry.get_node_class(class_type)
                    if node_class:
                        print(f"  [OK] {node_id}: {class_type}")
                    else:
                        print(f"  [FAIL] {node_id}: {class_type} - NOT FOUND")
                        all_valid = False
                
                return all_valid
            except Exception as e:
                print(f"[FAIL] Error processing {workflow_path}: {e}")
                import traceback
                traceback.print_exc()
                return False
    
    print("[SKIP] No workflow files found")
    return True

if __name__ == "__main__":
    print("工作流修复验证")
    print("=" * 60)
    
    results = []
    results.append(test_registry())
    results.append(test_executor())
    results.append(test_workflow_file())
    
    print("\n" + "=" * 60)
    print("验证结果")
    print("=" * 60)
    
    if all(results):
        print("[SUCCESS] All tests passed!")
        sys.exit(0)
    else:
        print("[FAILURE] Some tests failed")
        sys.exit(1)














