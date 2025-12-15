"""
节点验证工具
用于验证节点接口是否符合标准，以及检查节点之间的连接兼容性
参考: n8n, ComfyUI
"""

from typing import Dict, Any, List, Tuple, Optional
from app.core.registry import node_registry
from app.core.logger import get_logger

logger = get_logger(__name__)


class NodeValidator:
    """节点验证器"""
    
    # 类型兼容性映射
    TYPE_COMPATIBILITY = {
        "INT": ["FLOAT", "STRING"],
        "FLOAT": ["STRING"],
        "STRING": [],  # 字符串可以转换为其他类型，但不应该自动连接
        "BOOLEAN": ["STRING"],
        "DATAFRAME": [],  # DataFrame只能连接到DATAFRAME类型
        "LIST": [],
        "DICT": []
    }
    
    def validate_node(self, node_class: Any) -> Tuple[bool, List[str]]:
        """
        验证节点是否符合标准接口
        
        Returns:
            (is_valid, errors): 是否有效和错误列表
        """
        errors = []
        
        # 检查必需属性
        required_attrs = [
            ("NODE_TYPE", "节点类型标识"),
            ("VERSION", "版本号"),
            ("CATEGORY", "分类"),
            ("RETURN_TYPES", "返回类型"),
            ("FUNCTION", "执行方法名")
        ]
        
        for attr, desc in required_attrs:
            if not hasattr(node_class, attr):
                errors.append(f"缺少必需属性: {attr} ({desc})")
        
        # 检查INPUT_TYPES
        if not hasattr(node_class, "INPUT_TYPES") and not hasattr(node_class, "INPUT_TYPES_LEGACY"):
            errors.append("缺少INPUT_TYPES或INPUT_TYPES_LEGACY定义")
        
        # 检查RETURN_TYPES和RETURN_NAMES的一致性
        if hasattr(node_class, "RETURN_TYPES") and hasattr(node_class, "RETURN_NAMES"):
            return_types = node_class.RETURN_TYPES
            return_names = node_class.RETURN_NAMES
            
            if len(return_types) != len(return_names):
                errors.append(
                    f"RETURN_TYPES和RETURN_NAMES长度不匹配: "
                    f"{len(return_types)} != {len(return_names)}"
                )
        
        # 检查执行方法是否存在
        if hasattr(node_class, "FUNCTION"):
            func_name = node_class.FUNCTION
            if not hasattr(node_class, func_name):
                # 检查实例方法
                instance = node_class()
                if not hasattr(instance, func_name):
                    errors.append(f"执行方法 '{func_name}' 不存在")
        
        return len(errors) == 0, errors
    
    def can_connect(
        self,
        source_node: str,
        source_slot: int,
        target_node: str,
        target_slot: int
    ) -> Tuple[bool, Optional[str]]:
        """
        检查两个节点是否可以连接
        
        Args:
            source_node: 源节点类型名
            source_slot: 源节点输出槽位索引
            target_node: 目标节点类型名
            target_slot: 目标节点输入槽位索引
        
        Returns:
            (can_connect, reason): 是否可以连接和原因
        """
        # 获取节点类
        source_class = node_registry.get_node_class(source_node)
        target_class = node_registry.get_node_class(target_node)
        
        if not source_class:
            return False, f"源节点 '{source_node}' 未找到"
        
        if not target_class:
            return False, f"目标节点 '{target_node}' 未找到"
        
        # 获取源节点输出类型
        source_output_types = self._get_output_types(source_class)
        if source_slot >= len(source_output_types):
            return False, f"源节点输出槽位 {source_slot} 超出范围 (共 {len(source_output_types)} 个输出)"
        
        source_type = source_output_types[source_slot]
        
        # 获取目标节点输入类型
        target_input_types = self._get_input_types(target_class)
        if target_slot >= len(target_input_types):
            return False, f"目标节点输入槽位 {target_slot} 超出范围 (共 {len(target_input_types)} 个输入)"
        
        target_type = target_input_types[target_slot]
        
        # 检查类型兼容性
        if source_type == target_type:
            return True, None
        
        # 检查类型转换兼容性
        if self._is_type_compatible(source_type, target_type):
            return True, f"类型自动转换: {source_type} -> {target_type}"
        
        return False, f"类型不兼容: {source_type} 无法连接到 {target_type}"
    
    def _get_output_types(self, node_class: Any) -> List[str]:
        """获取节点的输出类型列表"""
        if hasattr(node_class, "RETURN_TYPES"):
            return list(node_class.RETURN_TYPES)
        elif hasattr(node_class, "OUTPUT_TYPES"):
            # 从OUTPUT_TYPES提取类型
            output_types = node_class.OUTPUT_TYPES
            if isinstance(output_types, dict):
                return [info.get("type", "UNKNOWN") for info in output_types.values()]
        return []
    
    def _get_input_types(self, node_class: Any) -> List[str]:
        """获取节点的输入类型列表"""
        input_types = None
        
        # 尝试获取INPUT_TYPES
        if hasattr(node_class, "INPUT_TYPES"):
            input_types_attr = getattr(node_class, "INPUT_TYPES")
            if callable(input_types_attr):
                input_types = input_types_attr()
            else:
                input_types = input_types_attr
        
        # 尝试获取INPUT_TYPES_LEGACY
        if not input_types and hasattr(node_class, "INPUT_TYPES_LEGACY"):
            input_types = node_class.INPUT_TYPES_LEGACY()
        
        if not input_types:
            return []
        
        # 解析输入类型
        types_list = []
        
        if isinstance(input_types, dict):
            # ComfyUI格式: {"required": {...}, "optional": {...}}
            if "required" in input_types or "optional" in input_types:
                required = input_types.get("required", {})
                optional = input_types.get("optional", {})
                all_inputs = {**required, **optional}
                
                # 按顺序提取类型
                for key, type_info in all_inputs.items():
                    if isinstance(type_info, tuple):
                        types_list.append(type_info[0] if len(type_info) > 0 else "UNKNOWN")
                    elif isinstance(type_info, dict):
                        types_list.append(type_info.get("type", "UNKNOWN"))
                    else:
                        types_list.append("UNKNOWN")
            else:
                # 新格式: {"param_name": {"type": ...}}
                for key, type_info in input_types.items():
                    if isinstance(type_info, dict):
                        types_list.append(type_info.get("type", "UNKNOWN"))
                    else:
                        types_list.append("UNKNOWN")
        
        return types_list
    
    def _is_type_compatible(self, source_type: str, target_type: str) -> bool:
        """检查类型是否兼容（可以自动转换）"""
        # 相同类型总是兼容
        if source_type == target_type:
            return True
        
        # 检查兼容性映射
        compatible_types = self.TYPE_COMPATIBILITY.get(source_type, [])
        return target_type in compatible_types
    
    def validate_workflow(self, workflow_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        验证整个工作流的节点连接
        
        Args:
            workflow_data: 工作流数据（包含nodes和edges）
        
        Returns:
            (is_valid, errors): 是否有效和错误列表
        """
        errors = []
        
        if "nodes" not in workflow_data or "edges" not in workflow_data:
            return False, ["工作流格式无效：缺少nodes或edges"]
        
        nodes = workflow_data["nodes"]
        edges = workflow_data.get("edges", [])
        
        # 验证每个节点
        node_map = {}
        for node in nodes:
            node_id = node.get("id")
            node_type = node.get("type") or node.get("class_type")
            
            if not node_id:
                errors.append("节点缺少id")
                continue
            
            if not node_type:
                errors.append(f"节点 {node_id} 缺少type或class_type")
                continue
            
            node_map[node_id] = node_type
            
            # 验证节点类
            node_class = node_registry.get_node_class(node_type)
            if not node_class:
                errors.append(f"节点 {node_id} 的类型 '{node_type}' 未注册")
                continue
            
            is_valid, node_errors = self.validate_node(node_class)
            if not is_valid:
                errors.extend([f"节点 {node_id} ({node_type}): {e}" for e in node_errors])
        
        # 验证每个连接
        for edge in edges:
            from_node_id = edge.get("from")
            to_node_id = edge.get("to")
            from_slot = edge.get("from_slot", 0)
            to_slot = edge.get("to_slot", 0)
            
            if from_node_id not in node_map:
                errors.append(f"连接引用不存在的源节点: {from_node_id}")
                continue
            
            if to_node_id not in node_map:
                errors.append(f"连接引用不存在目标节点: {to_node_id}")
                continue
            
            source_type = node_map[from_node_id]
            target_type = node_map[to_node_id]
            
            can_connect, reason = self.can_connect(
                source_type, from_slot,
                target_type, to_slot
            )
            
            if not can_connect:
                errors.append(
                    f"连接无效 ({from_node_id}:{from_slot} -> {to_node_id}:{to_slot}): {reason}"
                )
        
        return len(errors) == 0, errors


# 全局实例
node_validator = NodeValidator()

