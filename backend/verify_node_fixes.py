"""
验证节点修复
直接在Python环境中运行，不依赖文件系统路径
"""

import sys
import os
from pathlib import Path

# 添加项目路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

print("=" * 60)
print("节点修复验证")
print("=" * 60)

# 1. 验证节点可以正常导入
print("\n1. 验证节点导入...")
try:
    from app.nodes.file_nodes import ExcelLoader, FileUploadNode
    from app.nodes.viz_nodes import DataFrameToTableNode
    print("   ✅ 所有节点导入成功")
except Exception as e:
    print(f"   ❌ 节点导入失败: {e}")
    sys.exit(1)

# 2. 验证INPUT_TYPES定义
print("\n2. 验证INPUT_TYPES定义...")
try:
    # ExcelLoader
    excel_inputs = ExcelLoader.INPUT_TYPES()
    if isinstance(excel_inputs, dict) and "required" in excel_inputs:
        print("   ✅ ExcelLoader.INPUT_TYPES() 正常")
    else:
        print("   ❌ ExcelLoader.INPUT_TYPES() 格式错误")
    
    # DataFrameToTableNode
    table_inputs = DataFrameToTableNode.INPUT_TYPES()
    if isinstance(table_inputs, dict) and "required" in table_inputs:
        print("   ✅ DataFrameToTableNode.INPUT_TYPES() 正常")
    else:
        print("   ❌ DataFrameToTableNode.INPUT_TYPES() 格式错误")
    
    # FileUploadNode
    upload_inputs = FileUploadNode.INPUT_TYPES()
    if isinstance(upload_inputs, dict) and "required" in upload_inputs:
        print("   ✅ FileUploadNode.INPUT_TYPES() 正常")
    else:
        print("   ❌ FileUploadNode.INPUT_TYPES() 格式错误")
        
except Exception as e:
    print(f"   ❌ INPUT_TYPES验证失败: {e}")
    import traceback
    traceback.print_exc()

# 3. 验证节点接口
print("\n3. 验证节点接口...")
try:
    from app.core.node_validator import node_validator
    
    nodes_to_test = [
        (ExcelLoader, "ExcelLoader"),
        (DataFrameToTableNode, "DataFrameToTableNode"),
        (FileUploadNode, "FileUploadNode")
    ]
    
    all_valid = True
    for node_class, name in nodes_to_test:
        is_valid, errors = node_validator.validate_node(node_class)
        if is_valid:
            print(f"   ✅ {name} 接口验证通过")
        else:
            print(f"   ❌ {name} 接口验证失败:")
            for error in errors:
                print(f"      - {error}")
            all_valid = False
    
    if all_valid:
        print("\n   ✅ 所有节点接口验证通过")
    else:
        print("\n   ❌ 部分节点接口验证失败")
        
except Exception as e:
    print(f"   ❌ 节点接口验证失败: {e}")
    import traceback
    traceback.print_exc()

# 4. 验证连接兼容性
print("\n4. 验证连接兼容性...")
try:
    from app.core.node_validator import node_validator
    
    # ExcelLoader -> DataFrameToTableNode
    can_connect, reason = node_validator.can_connect(
        "ExcelLoader", 0,
        "DataFrameToTableNode", 0
    )
    
    if can_connect:
        print("   ✅ ExcelLoader -> DataFrameToTableNode 可以连接")
        if reason:
            print(f"      提示: {reason}")
    else:
        print(f"   ❌ ExcelLoader -> DataFrameToTableNode 无法连接: {reason}")
        
except Exception as e:
    print(f"   ❌ 连接兼容性验证失败: {e}")
    import traceback
    traceback.print_exc()

# 5. 验证节点可以实例化
print("\n5. 验证节点实例化...")
try:
    loader = ExcelLoader()
    table_node = DataFrameToTableNode()
    upload_node = FileUploadNode()
    
    print("   ✅ 所有节点可以正常实例化")
    
except Exception as e:
    print(f"   ❌ 节点实例化失败: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("验证完成")
print("=" * 60)

