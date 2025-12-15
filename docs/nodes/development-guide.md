# 节点开发指南

> **如何开发自定义节点**

---

## 📋 开发流程

### 步骤1: 后端实现 (Python)

在 `backend/app/nodes/` 目录下创建 Python 文件。

**示例文件**: `backend/app/nodes/custom_nodes.py`

```python
import pandas as pd
from typing import Tuple, Dict, Any
from app.nodes.base_node import BaseNode

class MyCustomNode(BaseNode):
    """
    这是一个示例节点，用于演示如何处理 DataFrame。
    """
    
    NODE_TYPE = "MyCustomNode"
    VERSION = "1.0.0"
    CATEGORY = "自定义"
    DISPLAY_NAME = "我的自定义节点"
    
    # 定义输入参数（ComfyUI 格式）
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "dataframe": ("DATAFRAME",),  # 接收上游 DataFrame
                "threshold": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0}),
                "mode": (["strict", "loose"], {"default": "strict"}),  # 下拉菜单
            },
            "optional": {
                "custom_param": ("STRING", {"default": ""}),
            }
        }
    
    # 定义输出类型
    RETURN_TYPES = ("DATAFRAME", "STRING")
    RETURN_NAMES = ("filtered_data", "summary")
    FUNCTION = "execute"
    CATEGORY = "自定义"
    
    def execute(
        self, 
        dataframe: pd.DataFrame, 
        threshold: float, 
        mode: str,
        custom_param: str = ""
    ) -> Tuple[pd.DataFrame, str]:
        """
        执行逻辑
        
        Args:
            dataframe: 输入数据
            threshold: 阈值
            mode: 模式
            custom_param: 自定义参数
            
        Returns:
            Tuple[DataFrame, str]: 过滤后的数据和摘要
        """
        print(f"[MyCustomNode] Processing with threshold={threshold}, mode={mode}")
        
        # 业务逻辑
        filtered_df = dataframe[dataframe['amount'] > threshold]
        summary = f"Filtered {len(filtered_df)} rows from {len(dataframe)} total rows."
        
        # 返回结果 (Tuple)
        return (filtered_df, summary)

# 注册节点
NODE_CLASS_MAPPINGS = {
    "MyCustomNode": MyCustomNode
}
```

**关键点**:
- 继承 `BaseNode` 获得基础功能
- `INPUT_TYPES` 定义输入控件（参考 ComfyUI 规范）
- `execute` 方法参数名必须与 `INPUT_TYPES` 中的 key 一致
- 返回类型必须是 Tuple

---

### 步骤2: 注册节点模块

在 `backend/app/nodes/__init__.py` 中导入：

```python
from .custom_nodes import NODE_CLASS_MAPPINGS as CUSTOM_NODES

# 合并所有节点映射
ALL_NODE_MAPPINGS = {
    **FILE_NODES,
    **CLEAN_NODES,
    **AUDIT_NODES,
    **CUSTOM_NODES,  # 添加自定义节点
}
```

---

### 步骤3: 验证与调试

1. **重启后端**: Python 代码修改后需要重启后端服务
2. **刷新前端**: 刷新浏览器，前端会调用 `/object_info` 重新拉取最新的节点定义
3. **拖拽测试**: 在"自定义"分类下找到你的节点，拖入画布
4. **查看日志**: 后端控制台会打印 `execute` 方法中的 `print` 内容

---

## 📝 INPUT_TYPES 规范

### 基本类型

```python
@classmethod
def INPUT_TYPES(cls):
    return {
        "required": {
            # 字符串
            "name": ("STRING", {"default": ""}),
            
            # 整数
            "count": ("INT", {"default": 10, "min": 1, "max": 100}),
            
            # 浮点数
            "threshold": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0}),
            
            # 布尔值
            "enabled": ("BOOLEAN", {"default": True}),
            
            # 下拉菜单
            "mode": (["option1", "option2", "option3"], {"default": "option1"}),
            
            # DataFrame（从上游节点接收）
            "dataframe": ("DATAFRAME",),
            
            # 多行文本
            "description": ("STRING", {"multiline": True}),
        },
        "optional": {
            # 可选参数
            "optional_param": ("STRING", {"default": ""}),
        }
    }
```

---

## 🎯 最佳实践

### 1. 错误处理

```python
def execute(self, dataframe: pd.DataFrame, threshold: float) -> Tuple[pd.DataFrame, str]:
    try:
        # 输入验证
        if dataframe.empty:
            raise ValueError("DataFrame is empty")
        
        if threshold < 0:
            raise ValueError("Threshold must be non-negative")
        
        # 业务逻辑
        result = dataframe[dataframe['amount'] > threshold]
        summary = f"Filtered {len(result)} rows"
        
        return (result, summary)
        
    except Exception as e:
        # 返回错误信息
        error_df = pd.DataFrame()
        error_msg = f"Error: {str(e)}"
        return (error_df, error_msg)
```

### 2. 性能优化

```python
# 大数据集采样
MAX_DATA_POINTS = 1000

def _sample_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
    """系统采样，保持分布"""
    if len(df) <= self.MAX_DATA_POINTS:
        return df
    step = len(df) // self.MAX_DATA_POINTS
    return df.iloc[::step].reset_index(drop=True)
```

### 3. 日志记录

```python
from app.core.logger import get_logger

logger = get_logger(__name__)

def execute(self, dataframe: pd.DataFrame) -> Tuple[pd.DataFrame, str]:
    logger.info("node_execution_started", 
                node_type="MyCustomNode",
                input_rows=len(dataframe))
    
    # 业务逻辑...
    
    logger.info("node_execution_completed",
                node_type="MyCustomNode",
                output_rows=len(result))
    
    return (result, summary)
```

---

## 📚 参考示例

### QuickPlotNode - 可视化节点

**文件**: `backend/app/nodes/viz_nodes.py`

**关键特性**:
- 自动采样大数据集
- 类型验证
- 友好的错误提示
- 返回 ECharts JSON 字符串

### PythonScriptNode - 脚本节点

**文件**: `backend/app/nodes/script_nodes.py`

**关键特性**:
- RestrictedPython 沙箱
- Console 输出捕获
- 安全限制

---

## 🧪 测试

创建测试文件 `backend/tests/test_custom_node.py`:

```python
import pandas as pd
from app.nodes.custom_nodes import MyCustomNode

def test_my_custom_node():
    # 准备测试数据
    test_df = pd.DataFrame({
        "amount": [100, 200, 300, 400, 500]
    })
    
    # 实例化节点
    node = MyCustomNode()
    
    # 执行
    result_df, summary = node.execute(test_df, threshold=250.0, mode="strict")
    
    # 验证
    assert len(result_df) == 3  # 300, 400, 500
    assert "Filtered 3 rows" in summary
    print("✅ Test passed")

if __name__ == "__main__":
    test_my_custom_node()
```

---

## 📖 更多资源

- [节点方案基线](./solution-plan.md) - 节点设计规范
- [节点使用指南](./user-guide.md) - 现有节点使用说明
- [技术实施指南](../development/implementation-guide.md) - 完整技术文档

---

**开发完成后**: 记得更新文档和测试用例！

