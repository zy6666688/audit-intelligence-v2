"""
简单的节点功能测试
不依赖文件系统路径
"""

import sys
import os
from pathlib import Path

# 添加项目路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

import pandas as pd

print("=" * 60)
print("节点功能测试")
print("=" * 60)

# 测试1: ExcelLoader
print("\n1. 测试 ExcelLoader...")
try:
    from app.nodes.file_nodes import ExcelLoader
    
    # 创建测试数据
    test_df = pd.DataFrame({
        "发票号码": ["INV-001", "INV-002"],
        "金额": [1000.0, 2000.0],
        "日期": ["2024-01-01", "2024-01-02"]
    })
    
    # 保存到临时文件
    import tempfile
    with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
        test_file = tmp.name
        test_df.to_excel(test_file, index=False)
    
    try:
        loader = ExcelLoader()
        # 使用绝对路径
        result = loader.load_excel(test_file)
        
        if isinstance(result, tuple) and len(result) > 0:
            df = result[0]
            if isinstance(df, pd.DataFrame) and df.shape[0] == 2:
                print(f"   ✅ ExcelLoader 测试通过")
                print(f"   加载数据: {df.shape[0]} 行, {df.shape[1]} 列")
            else:
                print(f"   ❌ ExcelLoader 数据不正确")
        else:
            print(f"   ❌ ExcelLoader 返回格式错误")
    finally:
        # 清理临时文件
        if os.path.exists(test_file):
            os.unlink(test_file)
            
except Exception as e:
    print(f"   ❌ ExcelLoader 测试失败: {str(e)}")
    import traceback
    traceback.print_exc()

# 测试2: DataFrameToTableNode
print("\n2. 测试 DataFrameToTableNode...")
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

# 测试3: 节点接口验证
print("\n3. 测试节点接口验证...")
try:
    from app.core.node_validator import node_validator
    from app.nodes.file_nodes import ExcelLoader
    from app.nodes.viz_nodes import DataFrameToTableNode
    
    for node_class, name in [(ExcelLoader, "ExcelLoader"), (DataFrameToTableNode, "DataFrameToTableNode")]:
        is_valid, errors = node_validator.validate_node(node_class)
        if is_valid:
            print(f"   ✅ {name} 接口验证通过")
        else:
            print(f"   ❌ {name} 接口验证失败:")
            for error in errors:
                print(f"      - {error}")
                
except Exception as e:
    print(f"   ❌ 节点接口验证失败: {str(e)}")
    import traceback
    traceback.print_exc()

# 测试4: 连接兼容性检查
print("\n4. 测试连接兼容性...")
try:
    from app.core.node_validator import node_validator
    
    # 测试ExcelLoader -> DataFrameToTableNode
    can_connect, reason = node_validator.can_connect(
        "ExcelLoader", 0,
        "DataFrameToTableNode", 0
    )
    
    if can_connect:
        print(f"   ✅ ExcelLoader -> DataFrameToTableNode 连接兼容")
        if reason:
            print(f"      提示: {reason}")
    else:
        print(f"   ❌ ExcelLoader -> DataFrameToTableNode 连接不兼容: {reason}")
        
except Exception as e:
    print(f"   ❌ 连接兼容性检查失败: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("测试完成")
print("=" * 60)
