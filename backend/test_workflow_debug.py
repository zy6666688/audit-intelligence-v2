#!/usr/bin/env python3
"""
测试工作流格式转换和节点注册
"""
import sys
import os
import json

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.registry import node_registry
from app.core.executor import executor
import app.nodes  # 触发节点注册

def test_node_registry():
    """测试节点注册"""
    print("=" * 60)
    print("测试节点注册")
    print("=" * 60)
    
    print(f"\n已注册的节点数量: {len(node_registry.node_mappings)}")
    print(f"\n已注册的节点列表:")
    for name in sorted(node_registry.node_mappings.keys()):
        node_class = node_registry.node_mappings[name]
        has_input_types = hasattr(node_class, "INPUT_TYPES")
        has_function = hasattr(node_class, "FUNCTION")
        print(f"  - {name}: INPUT_TYPES={has_input_types}, FUNCTION={has_function}")
    
    # 测试 get_node_class
    print(f"\n测试 get_node_class 方法:")
    test_nodes = ["ExcelLoader", "FileUploadNode", "ColumnMapperNode", "NullValueCleanerNode", 
                  "ExcelColumnValidator", "AuditCheckNode", "QuickPlotNode", "DataFrameToTableNode"]
    
    for node_name in test_nodes:
        node_class = node_registry.get_node_class(node_name)
        if node_class:
            print(f"  [OK] {node_name}: found")
        else:
            print(f"  [FAIL] {node_name}: not found")

def test_workflow_format_conversion():
    """测试工作流格式转换"""
    print("\n" + "=" * 60)
    print("测试工作流格式转换")
    print("=" * 60)
    
    # 加载测试工作流
    workflow_path = os.path.join("backend", "workflows", "audit_mock_workflow.json")
    if not os.path.exists(workflow_path):
        workflow_path = os.path.join("backend", "backend", "workflows", "audit_mock_workflow.json")
    
    if not os.path.exists(workflow_path):
        print(f"\n[FAIL] Workflow file not found: {workflow_path}")
        return
    
    print(f"\n加载工作流文件: {workflow_path}")
    with open(workflow_path, "r", encoding="utf-8") as f:
        workflow_data = json.load(f)
    
    print(f"\n原始工作流格式:")
    print(f"  - 包含 'nodes': {'nodes' in workflow_data}")
    print(f"  - 包含 'edges': {'edges' in workflow_data}")
    print(f"  - 节点数量: {len(workflow_data.get('nodes', []))}")
    
    # 测试格式转换
    try:
        normalized = executor._normalize_workflow_format(workflow_data)
        print(f"\n[OK] Format conversion successful")
        print(f"  - Normalized node count: {len(normalized)}")
        print(f"  - Normalized node IDs: {list(normalized.keys())}")
        
        # 检查每个节点的 class_type
        print(f"\nNode type validation:")
        all_found = True
        for node_id, node_def in normalized.items():
            class_type = node_def.get("class_type")
            node_class = node_registry.get_node_class(class_type)
            status = "[OK]" if node_class else "[FAIL]"
            found_str = "found" if node_class else "NOT FOUND"
            print(f"  {status} {node_id}: {class_type} -> {found_str}")
            if not node_class:
                all_found = False
        
        if all_found:
            print(f"\n[SUCCESS] All nodes are registered and can be found!")
        else:
            print(f"\n[FAILURE] Some nodes are missing from registry!")
            
    except Exception as e:
        print(f"\n[FAIL] Format conversion failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("工作流调试测试")
    print("=" * 60)
    
    test_node_registry()
    test_workflow_format_conversion()
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)

