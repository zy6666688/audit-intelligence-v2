"""
Python Script Node 测试脚本
用于验证 RestrictedPython 沙箱功能
"""
import pandas as pd
from app.nodes.script_nodes import PythonScriptNode


def test_basic_execution():
    """测试基础执行功能"""
    print("\n=== Test 1: 基础执行 ===")
    
    node = PythonScriptNode()
    
    # 创建测试数据
    df = pd.DataFrame({
        'amount': [100, 200, 300, 400, 500],
        'category': ['A', 'B', 'A', 'C', 'B']
    })
    
    script = """
result = df.copy()
result['tax'] = result['amount'] * 0.13
print(f"处理了 {len(result)} 行数据")
"""
    
    output_df, console_log = node.execute_script(script, df)
    
    print(f"输出形状: {output_df.shape}")
    print(f"控制台输出:\n{console_log}")
    assert 'tax' in output_df.columns, "应该包含 tax 列"
    assert len(output_df) == 5, "行数应该为 5"
    print("✅ 测试通过")


def test_security_restrictions():
    """测试安全限制"""
    print("\n=== Test 2: 安全限制 ===")
    
    node = PythonScriptNode()
    df = pd.DataFrame({'value': [1, 2, 3]})
    
    # 尝试危险操作
    dangerous_scripts = [
        ("文件操作", """
with open('/tmp/test.txt', 'w') as f:
    f.write('evil')
result = df
"""),
        ("系统导入", """
import os
os.system('echo pwned')
result = df
"""),
        ("网络请求", """
import requests
requests.get('https://evil.com')
result = df
"""),
    ]
    
    for name, script in dangerous_scripts:
        print(f"\n测试限制: {name}")
        output_df, console_log = node.execute_script(script, df)
        print(f"控制台输出:\n{console_log}")
        # 应该包含错误信息
        assert ('Error' in console_log or 'not defined' in console_log or 'not found' in console_log), \
            f"{name} 应该被阻止"
        print(f"✅ {name} 被成功阻止")


def test_pandas_operations():
    """测试 Pandas 操作"""
    print("\n=== Test 3: Pandas 操作 ===")
    
    node = PythonScriptNode()
    
    df = pd.DataFrame({
        'category': ['A', 'B', 'A', 'C', 'B', 'A'],
        'amount': [100, 200, 150, 300, 250, 120]
    })
    
    script = """
# 分组聚合
result = df.groupby('category').agg({
    'amount': ['sum', 'mean', 'count']
}).reset_index()

result.columns = ['category', 'total', 'average', 'count']

print(f"聚合结果:\\n{result}")
"""
    
    output_df, console_log = node.execute_script(script, df)
    
    print(f"输出:\n{output_df}")
    print(f"控制台:\n{console_log}")
    assert len(output_df) == 3, "应该有 3 个分类"
    assert 'total' in output_df.columns, "应该包含 total 列"
    print("✅ 测试通过")


def test_numpy_operations():
    """测试 NumPy 操作"""
    print("\n=== Test 4: NumPy 操作 ===")
    
    node = PythonScriptNode()
    
    df = pd.DataFrame({
        'value': [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    })
    
    script = """
# np is already available in the environment, no need to import

result = df.copy()

# 使用 NumPy 统计函数
mean_val = np.mean(df['value'])
std_val = np.std(df['value'])

# Z-score 标准化
result['z_score'] = (result['value'] - mean_val) / std_val

print(f"均值: {mean_val}")
print(f"标准差: {std_val}")
print(f"Z-score 范围: [{result['z_score'].min():.2f}, {result['z_score'].max():.2f}]")
"""
    
    output_df, console_log = node.execute_script(script, df)
    
    print(f"控制台:\n{console_log}")
    assert 'z_score' in output_df.columns, "应该包含 z_score 列"
    print("✅ 测试通过")


def test_error_handling():
    """测试错误处理"""
    print("\n=== Test 5: 错误处理 ===")
    
    node = PythonScriptNode()
    df = pd.DataFrame({'a': [1, 2, 3]})
    
    # 运行时错误
    script = """
result = df.copy()
result['b'] = result['nonexistent_column'] * 2  # KeyError
"""
    
    output_df, console_log = node.execute_script(script, df)
    
    print(f"控制台输出:\n{console_log}")
    assert 'Error' in console_log, "应该包含错误信息"
    assert len(output_df) == 3, "应该返回原始 DataFrame"
    print("✅ 错误被正确捕获")


def test_no_result_variable():
    """测试缺少返回变量的情况"""
    print("\n=== Test 6: 缺少返回变量 ===")
    
    node = PythonScriptNode()
    df = pd.DataFrame({'x': [1, 2, 3]})
    
    script = """
# 没有设置 result 或 output
df_temp = df.copy()
df_temp['y'] = df_temp['x'] * 2
"""
    
    output_df, console_log = node.execute_script(script, df)
    
    print(f"控制台输出:\n{console_log}")
    assert 'No \'result\' or \'output\' variable found' in console_log, \
        "应该警告缺少返回变量"
    print("✅ 警告正确显示")


def test_print_output():
    """测试 print 输出捕获"""
    print("\n=== Test 7: Print 输出捕获 ===")
    
    node = PythonScriptNode()
    df = pd.DataFrame({'n': range(10)})
    
    script = """
result = df.copy()
print("开始处理...")
for i in range(3):
    print(f"  步骤 {i+1}: OK")
print("处理完成！")
"""
    
    output_df, console_log = node.execute_script(script, df)
    
    print(f"控制台输出:\n{console_log}")
    assert "开始处理" in console_log, "应该包含 print 输出"
    assert "步骤 1" in console_log, "应该包含循环输出"
    assert "处理完成" in console_log, "应该包含结束输出"
    print("✅ Print 输出完整捕获")


if __name__ == '__main__':
    print("=" * 60)
    print("Python Script Node 测试套件")
    print("=" * 60)
    
    try:
        test_basic_execution()
        test_security_restrictions()
        test_pandas_operations()
        test_numpy_operations()
        test_error_handling()
        test_no_result_variable()
        test_print_output()
        
        print("\n" + "=" * 60)
        print("✅ 所有测试通过！Python Script Node 工作正常")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
