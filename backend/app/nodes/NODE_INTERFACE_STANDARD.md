# 节点接口标准

> **参考**: n8n, ComfyUI  
> **版本**: 2.0  
> **更新日期**: 2025-12-12

---

## 📋 核心原则

### 1. 单一职责原则
每个节点应该专注于完成一个明确的功能，从输入到输出。

### 2. 接口标准化
所有节点必须遵循统一的接口规范，确保可以自由连接。

### 3. 类型明确
输入和输出类型必须明确定义，支持类型检查和自动连接验证。

### 4. 向后兼容
节点接口变更必须保持向后兼容，或提供迁移路径。

---

## 🔌 标准接口定义

### 必需属性

每个节点类必须定义以下属性：

```python
class MyNode(BaseNode):
    # 1. 节点标识
    NODE_TYPE = "MyNode"           # 唯一节点类型标识
    VERSION = "1.0.0"               # 版本号（语义化版本）
    CATEGORY = "category/name"       # 分类（用于UI分组）
    DISPLAY_NAME = "显示名称"        # 用户友好的显示名称
    
    # 2. 输入定义（新格式）
    INPUT_TYPES = {
        "param1": {
            "type": "DATAFRAME",      # 类型：DATAFRAME, STRING, INT, FLOAT, BOOLEAN, LIST, DICT
            "required": True,         # 是否必需
            "default": None,          # 默认值（可选）
            "description": "参数描述" # 参数说明（可选）
        },
        "param2": {
            "type": "STRING",
            "required": False,
            "default": "default_value"
        }
    }
    
    # 3. 输出定义
    OUTPUT_TYPES = {
        "output1": {"type": "DATAFRAME"},
        "output2": {"type": "STRING"}
    }
    
    # 4. ComfyUI兼容格式（可选，用于向后兼容）
    @classmethod
    def INPUT_TYPES_LEGACY(cls):
        return {
            "required": {
                "param1": ("DATAFRAME",),
                "param2": ("STRING", {"default": "value"})
            },
            "optional": {
                "param3": ("INT", {"default": 0})
            }
        }
    
    RETURN_TYPES = ("DATAFRAME", "STRING")  # 输出类型元组
    RETURN_NAMES = ("output1", "output2")  # 输出名称元组（与RETURN_TYPES对应）
    FUNCTION = "execute_method"            # 执行方法名
    
    # 5. 执行方法
    def execute_method(self, param1, param2="default"):
        """执行逻辑"""
        # 处理输入
        result1 = process(param1)
        result2 = generate_report(result1)
        # 返回元组（顺序与RETURN_TYPES对应）
        return (result1, result2)
```

---

## 📊 支持的数据类型

### 基础类型

| 类型 | Python类型 | 说明 | 示例 |
|------|-----------|------|------|
| `DATAFRAME` | `pd.DataFrame` | Pandas DataFrame | 数据表 |
| `STRING` | `str` | 字符串 | "text" |
| `INT` | `int` | 整数 | 42 |
| `FLOAT` | `float` | 浮点数 | 3.14 |
| `BOOLEAN` | `bool` | 布尔值 | True/False |
| `LIST` | `list` | 列表 | [1, 2, 3] |
| `DICT` | `dict` | 字典 | {"key": "value"} |

### 类型兼容性规则

1. **严格匹配**: 相同类型可以连接
2. **自动转换**: 
   - `INT` ↔ `FLOAT` (数字类型可互转)
   - `STRING` → 其他类型 (字符串可转换为其他类型)
3. **DATAFRAME**: 只能连接到接受 `DATAFRAME` 的输入

---

## 🔗 节点连接规则

### 连接验证

节点A的输出可以连接到节点B的输入，当且仅当：

1. **类型匹配**: 输出类型与输入类型相同
2. **类型兼容**: 输出类型可以自动转换为输入类型
3. **槽位正确**: 输出槽位索引在有效范围内

### 连接示例

```python
# ✅ 有效连接
ExcelLoader (DATAFRAME) → ColumnMapperNode (DATAFRAME)
ColumnMapperNode (DATAFRAME) → NullValueCleanerNode (DATAFRAME)

# ✅ 类型转换
SomeNode (INT) → AnotherNode (FLOAT)  # INT自动转换为FLOAT

# ❌ 无效连接
ExcelLoader (DATAFRAME) → AuditCheckNode (FLOAT)  # 类型不匹配
```

---

## 🎯 节点实现检查清单

### 必需项

- [ ] 继承自 `BaseNode` 或实现标准接口
- [ ] 定义 `NODE_TYPE`（唯一标识）
- [ ] 定义 `VERSION`（语义化版本）
- [ ] 定义 `INPUT_TYPES`（新格式）或 `INPUT_TYPES_LEGACY()`（ComfyUI格式）
- [ ] 定义 `OUTPUT_TYPES` 和 `RETURN_TYPES`
- [ ] 定义 `RETURN_NAMES`（与RETURN_TYPES对应）
- [ ] 定义 `FUNCTION`（执行方法名）
- [ ] 实现执行方法（返回元组）

### 推荐项

- [ ] 实现 `_execute_pure()` 方法（纯函数实现）
- [ ] 添加输入验证
- [ ] 添加错误处理
- [ ] 添加日志记录
- [ ] 提供默认值
- [ ] 编写文档字符串

---

## 📝 节点实现示例

### 示例1: 数据处理节点

```python
class DataFilterNode(BaseNode):
    """数据过滤节点 - 根据条件过滤DataFrame"""
    
    NODE_TYPE = "DataFilterNode"
    VERSION = "1.0.0"
    CATEGORY = "数据处理"
    DISPLAY_NAME = "数据过滤"
    
    INPUT_TYPES = {
        "dataframe": {
            "type": "DATAFRAME",
            "required": True,
            "description": "输入数据表"
        },
        "condition": {
            "type": "STRING",
            "required": True,
            "description": "过滤条件（Python表达式）"
        },
        "keep_index": {
            "type": "BOOLEAN",
            "required": False,
            "default": False,
            "description": "是否保留索引"
        }
    }
    
    OUTPUT_TYPES = {
        "filtered_df": {"type": "DATAFRAME"},
        "filtered_count": {"type": "INT"}
    }
    
    RETURN_TYPES = ("DATAFRAME", "INT")
    RETURN_NAMES = ("filtered_df", "filtered_count")
    FUNCTION = "filter_data"
    
    def filter_data(self, dataframe, condition, keep_index=False):
        """执行过滤"""
        try:
            # 执行过滤
            filtered = dataframe.query(condition)
            
            if not keep_index:
                filtered = filtered.reset_index(drop=True)
            
            count = len(filtered)
            return (filtered, count)
            
        except Exception as e:
            # 错误处理
            raise ValueError(f"过滤失败: {str(e)}")
```

### 示例2: 计算节点

```python
class CalculateNode(BaseNode):
    """计算节点 - 执行数学计算"""
    
    NODE_TYPE = "CalculateNode"
    VERSION = "1.0.0"
    CATEGORY = "计算"
    DISPLAY_NAME = "计算"
    
    INPUT_TYPES = {
        "a": {
            "type": "FLOAT",
            "required": True
        },
        "b": {
            "type": "FLOAT",
            "required": True
        },
        "operation": {
            "type": "STRING",
            "required": False,
            "default": "add",
            "description": "操作类型: add, subtract, multiply, divide"
        }
    }
    
    OUTPUT_TYPES = {
        "result": {"type": "FLOAT"}
    }
    
    RETURN_TYPES = ("FLOAT",)
    RETURN_NAMES = ("result",)
    FUNCTION = "calculate"
    
    def calculate(self, a, b, operation="add"):
        """执行计算"""
        ops = {
            "add": lambda x, y: x + y,
            "subtract": lambda x, y: x - y,
            "multiply": lambda x, y: x * y,
            "divide": lambda x, y: x / y if y != 0 else float('inf')
        }
        
        if operation not in ops:
            raise ValueError(f"不支持的操作: {operation}")
        
        result = ops[operation](a, b)
        return (result,)
```

---

## 🔍 类型兼容性检查

### 自动类型转换

执行器会自动进行以下类型转换：

1. **数字类型互转**:
   - `INT` → `FLOAT`: 自动转换
   - `FLOAT` → `INT`: 自动转换（可能丢失精度）

2. **字符串转换**:
   - `STRING` → `INT`: 尝试解析为整数
   - `STRING` → `FLOAT`: 尝试解析为浮点数
   - `STRING` → `BOOLEAN`: 解析 "true"/"false" 等

3. **列表包装**:
   - 任何类型 → `LIST`: 自动包装为单元素列表

### 类型检查工具

```python
from app.core.node_validator import NodeValidator

# 检查节点接口
validator = NodeValidator()
is_valid = validator.validate_node(MyNode)

# 检查连接兼容性
can_connect = validator.can_connect(
    source_node="ExcelLoader",
    source_slot=0,
    target_node="ColumnMapperNode",
    target_slot=0
)
```

---

## 🚀 最佳实践

### 1. 输入验证

```python
def _execute_pure(self, inputs, context):
    dataframe = inputs.get("dataframe")
    if dataframe is None or dataframe.empty:
        raise ValueError("输入DataFrame不能为空")
    
    # 继续处理...
```

### 2. 错误处理

```python
def process_data(self, dataframe, config):
    try:
        result = process(dataframe, config)
        return (result,)
    except Exception as e:
        # 记录错误但不中断工作流
        logger.error(f"处理失败: {e}")
        # 返回空结果或默认值
        return (pd.DataFrame(),)
```

### 3. 性能优化

```python
# 对于大数据集，使用流式处理
def _execute_pure(self, inputs, context):
    if self.metadata.supports_streaming:
        return self._process_streaming(inputs, context)
    else:
        return self._process_batch(inputs, context)
```

### 4. 文档化

```python
class MyNode(BaseNode):
    """
    节点功能描述
    
    输入:
        - param1: 参数1说明
        - param2: 参数2说明
    
    输出:
        - output1: 输出1说明
        - output2: 输出2说明
    
    示例:
        >>> node = MyNode()
        >>> result = node.execute_method(input1, input2)
        >>> print(result)
    """
```

---

## 📚 参考资源

- **n8n节点开发**: https://docs.n8n.io/integrations/creating-nodes/
- **ComfyUI节点开发**: https://docs.comfy.org/zh-CN/
- **类型系统**: Python typing module

---

**遵循此标准可确保节点可以自由连接并组成完整的工作流！** 🎉

