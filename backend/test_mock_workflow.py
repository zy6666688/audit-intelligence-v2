"""
测试Mock工作流执行
验证节点功能和连接功能是否正常
"""

import sys
import os
import asyncio
import pandas as pd
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent))

from app.core.executor import executor
from app.core.registry import node_registry
from app.core.node_validator import node_validator
from app.core.logger import get_logger

logger = get_logger(__name__)


async def test_mock_workflow():
    """测试mock工作流执行"""
    
    print("=" * 60)
    print("测试Mock工作流执行")
    print("=" * 60)
    
    # 1. 加载工作流定义
    workflow_path = Path(__file__).parent / "backend" / "workflows" / "audit_mock_workflow.json"
    if not workflow_path.exists():
        print(f"❌ 工作流文件不存在: {workflow_path}")
        return False
    
    import json
    with open(workflow_path, 'r', encoding='utf-8') as f:
        workflow_data = json.load(f)
    
    print(f"\n✅ 工作流文件加载成功: {workflow_path}")
    print(f"   节点数: {len(workflow_data.get('nodes', []))}")
    print(f"   连接数: {len(workflow_data.get('edges', []))}")
    
    # 2. 验证工作流
    print("\n" + "=" * 60)
    print("验证工作流节点和连接")
    print("=" * 60)
    
    is_valid, errors = node_validator.validate_workflow(workflow_data)
    if not is_valid:
        print("❌ 工作流验证失败:")
        for error in errors:
            print(f"   - {error}")
        return False
    
    print("✅ 工作流验证通过")
    
    # 3. 验证各个节点
    print("\n" + "=" * 60)
    print("验证各个节点接口")
    print("=" * 60)
    
    nodes = workflow_data.get("nodes", [])
    for node in nodes:
        node_type = node.get("type") or node.get("class_type")
        node_id = node.get("id")
        
        if not node_type:
            print(f"❌ 节点 {node_id} 缺少类型定义")
            continue
        
        node_class = node_registry.get_node_class(node_type)
        if not node_class:
            print(f"❌ 节点 {node_id} 类型 '{node_type}' 未注册")
            continue
        
        is_valid, errors = node_validator.validate_node(node_class)
        if is_valid:
            print(f"✅ 节点 {node_id} ({node_type}): 接口验证通过")
        else:
            print(f"❌ 节点 {node_id} ({node_type}): 接口验证失败")
            for error in errors:
                print(f"      - {error}")
    
    # 4. 验证连接
    print("\n" + "=" * 60)
    print("验证节点连接")
    print("=" * 60)
    
    edges = workflow_data.get("edges", [])
    for edge in edges:
        from_node_id = edge.get("from")
        to_node_id = edge.get("to")
        from_slot = edge.get("from_slot", 0)
        to_slot = edge.get("to_slot", 0)
        
        # 找到节点类型
        from_node = next((n for n in nodes if n.get("id") == from_node_id), None)
        to_node = next((n for n in nodes if n.get("id") == to_node_id), None)
        
        if not from_node or not to_node:
            print(f"❌ 连接引用不存在的节点: {from_node_id} -> {to_node_id}")
            continue
        
        from_type = from_node.get("type") or from_node.get("class_type")
        to_type = to_node.get("type") or to_node.get("class_type")
        
        can_connect, reason = node_validator.can_connect(
            from_type, from_slot,
            to_type, to_slot
        )
        
        if can_connect:
            print(f"✅ 连接 {from_node_id}:{from_slot} -> {to_node_id}:{to_slot} ({from_type} -> {to_type})")
            if reason:
                print(f"   提示: {reason}")
        else:
            print(f"❌ 连接 {from_node_id}:{from_slot} -> {to_node_id}:{to_slot} ({from_type} -> {to_type})")
            print(f"   原因: {reason}")
    
    # 5. 执行工作流
    print("\n" + "=" * 60)
    print("执行工作流")
    print("=" * 60)
    
    try:
        # 创建虚拟的WebSocket客户端ID
        client_id = "test_client"
        prompt_id = "test_prompt_" + str(pd.Timestamp.now().value)
        
        # 执行工作流
        print(f"开始执行工作流 (prompt_id: {prompt_id})...")
        
        await executor.execute_graph(
            prompt_id=prompt_id,
            client_id=client_id,
            graph_data=workflow_data,
            project_id=None
        )
        
        print("✅ 工作流执行完成")
        return True
        
    except Exception as e:
        print(f"❌ 工作流执行失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_individual_nodes():
    """测试单个节点功能"""
    
    print("\n" + "=" * 60)
    print("测试单个节点功能")
    print("=" * 60)
    
    # 测试ExcelLoader
    print("\n测试 ExcelLoader...")
    try:
        from app.nodes.file_nodes import ExcelLoader
        
        # 创建测试数据文件（如果不存在）
        test_file = Path(__file__).parent / "backend" / "input" / "test_data.xlsx"
        test_file.parent.mkdir(parents=True, exist_ok=True)
        
        if not test_file.exists():
            # 创建测试Excel文件
            test_df = pd.DataFrame({
                "发票号码": ["INV-001", "INV-002", "INV-003"],
                "金额": [1000.0, 2000.0, 3000.0],
                "日期": ["2024-01-01", "2024-01-02", "2024-01-03"]
            })
            test_df.to_excel(test_file, index=False)
            print(f"   创建测试文件: {test_file}")
        
        loader = ExcelLoader()
        result = loader.load_excel(str(test_file.relative_to(Path.cwd())))
        
        if isinstance(result, tuple) and len(result) > 0:
            df = result[0]
            print(f"   ✅ ExcelLoader 测试通过")
            print(f"   加载数据: {df.shape[0]} 行, {df.shape[1]} 列")
            print(f"   列名: {list(df.columns)}")
        else:
            print(f"   ❌ ExcelLoader 返回格式错误: {type(result)}")
            
    except Exception as e:
        print(f"   ❌ ExcelLoader 测试失败: {str(e)}")
        import traceback
        traceback.print_exc()
    
    # 测试DataFrameToTableNode
    print("\n测试 DataFrameToTableNode...")
    try:
        from app.nodes.viz_nodes import DataFrameToTableNode
        
        test_df = pd.DataFrame({
            "列1": ["值1", "值2", "值3"],
            "列2": [1, 2, 3]
        })
        
        node = DataFrameToTableNode()
        result = node.convert_to_table(test_df, max_rows=5)
        
        if isinstance(result, tuple) and len(result) > 0:
            html = result[0]
            if isinstance(html, str) and "<table" in html:
                print(f"   ✅ DataFrameToTableNode 测试通过")
                print(f"   HTML长度: {len(html)} 字符")
            else:
                print(f"   ❌ DataFrameToTableNode 返回格式错误")
        else:
            print(f"   ❌ DataFrameToTableNode 返回格式错误")
            
    except Exception as e:
        print(f"   ❌ DataFrameToTableNode 测试失败: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("工作流和节点功能测试")
    print("=" * 60)
    
    # 测试单个节点
    test_individual_nodes()
    
    # 测试完整工作流
    try:
        result = asyncio.run(test_mock_workflow())
        if result:
            print("\n" + "=" * 60)
            print("✅ 所有测试通过！")
            print("=" * 60)
        else:
            print("\n" + "=" * 60)
            print("❌ 测试失败")
            print("=" * 60)
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n测试被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n测试执行出错: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

