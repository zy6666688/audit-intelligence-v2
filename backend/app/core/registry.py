import importlib
import os
import inspect

class NodeRegistry:
    def __init__(self):
        self.node_mappings = {}
        self.node_display_names = {}

    def register_nodes_from_module(self, module_name):
        """
        从指定模块中加载 NODE_CLASS_MAPPINGS
        """
        try:
            module = importlib.import_module(module_name)
            if hasattr(module, "NODE_CLASS_MAPPINGS"):
                self.node_mappings.update(module.NODE_CLASS_MAPPINGS)
            if hasattr(module, "NODE_DISPLAY_NAME_MAPPINGS"):
                self.node_display_names.update(module.NODE_DISPLAY_NAME_MAPPINGS)
        except ImportError as e:
            print(f"Failed to load module {module_name}: {e}")

    def get_node_class(self, node_name: str):
        """
        根据节点名称获取节点类
        
        Args:
            node_name: 节点名称（如 "ExcelLoader", "FileUploadNode"）
            
        Returns:
            节点类，如果不存在则返回 None
        """
        return self.node_mappings.get(node_name)
    
    def get_all_definitions(self):
        """
        将所有注册节点转换为 ComfyUI 标准的 ObjectInfo JSON
        """
        definitions = {}
        for name, node_cls in self.node_mappings.items():
            if hasattr(node_cls, "INPUT_TYPES"):
                # 支持 INPUT_TYPES 作为方法或字典
                input_types_attr = getattr(node_cls, "INPUT_TYPES")
                if callable(input_types_attr):
                    input_config = input_types_attr()
                else:
                    # INPUT_TYPES 是字典，可能是新格式或ComfyUI格式
                    input_config = input_types_attr
                
                # 如果是新格式（字典，键是参数名，值是 {"type": ..., "required": ...}），转换为ComfyUI格式
                if isinstance(input_config, dict) and "required" not in input_config and "optional" not in input_config:
                    # 新格式：{"param_name": {"type": ..., "required": ...}}
                    required = {}
                    optional = {}
                    for param_name, param_info in input_config.items():
                        if isinstance(param_info, dict):
                            param_type = param_info.get("type", "STRING")
                            is_required = param_info.get("required", False)
                            # 构建ComfyUI格式的配置
                            comfy_config = (param_type,)
                            # 如果有其他配置（如default, multiline等），添加到元组
                            if "default" in param_info or "multiline" in param_info:
                                opts = {}
                                if "default" in param_info:
                                    opts["default"] = param_info["default"]
                                if "multiline" in param_info:
                                    opts["multiline"] = param_info["multiline"]
                                comfy_config = (param_type, opts)
                            
                            if is_required:
                                required[param_name] = comfy_config
                            else:
                                optional[param_name] = comfy_config
                    
                    # 转换为ComfyUI格式
                    input_config = {}
                    if required:
                        input_config["required"] = required
                    if optional:
                        input_config["optional"] = optional
                
                # 构建输出定义
                outputs = []
                if hasattr(node_cls, "RETURN_TYPES"):
                    for idx, type_name in enumerate(node_cls.RETURN_TYPES):
                        out_name = node_cls.RETURN_NAMES[idx] if hasattr(node_cls, "RETURN_NAMES") else f"output_{idx}"
                        outputs.append({"name": out_name, "type": type_name})

                definitions[name] = {
                    "input": input_config, # ComfyUI 协议中使用 'input' 而非 'inputs'
                    "output": node_cls.RETURN_TYPES if hasattr(node_cls, "RETURN_TYPES") else [],
                    "output_name": node_cls.RETURN_NAMES if hasattr(node_cls, "RETURN_NAMES") else [],
                    "name": name,
                    "display_name": self.node_display_names.get(name, name),
                    "description": node_cls.__doc__.strip() if node_cls.__doc__ else "",
                    "category": getattr(node_cls, "CATEGORY", "Uncategorized"),
                }
        return definitions

# 单例实例
node_registry = NodeRegistry()

# 自动扫描 nodes 目录 (暂硬编码，后续改为自动)
# 暂时创建一个空的 __init__.py 让 Python 识别包
