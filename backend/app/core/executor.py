import asyncio
import uuid
import traceback
import os
import sys
import inspect
import pandas as pd
import json
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor
from app.core.registry import node_registry
from app.api.websocket import manager as ws_manager
from app.core.data_manager import data_manager
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)

class PromptExecutor:
    def __init__(self):
        self.running_tasks = {}
        # 自定义线程池，用于卸载 CPU 密集型任务
        self.thread_pool = ThreadPoolExecutor(max_workers=settings.MAX_CONCURRENT_TASKS)
        # 信号量，限制并发执行的工作流数量
        self.semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_TASKS)
    
    def shutdown(self):
        """
        Gracefully shutdown the executor and clean up resources.
        Should be called on application shutdown.
        """
        logger.info("executor_shutdown_started")
        self.thread_pool.shutdown(wait=True)
        logger.info("executor_shutdown_completed")

    async def execute_graph(
        self, 
        prompt_id: str, 
        client_id: str, 
        graph_data: Dict[str, Any],
        project_id: str = None
    ):
        """
        执行图的主循环 (Async)
        使用 Semaphore 限制并发数，防止资源耗尽
        
        Args:
            prompt_id: 执行任务 ID (也作为 run_id)
            client_id: WebSocket 客户端 ID
            graph_data: 图数据
            project_id: 项目 ID (可选，如果提供则输出保存到项目目录)
        """
        async with self.semaphore:  # 限制并发执行数量
            logger.info("workflow_execution_started",
                       prompt_id=prompt_id,
                       project_id=project_id or "temp",
                       active_tasks=settings.MAX_CONCURRENT_TASKS - self.semaphore._value)
            
            try:
                # 整个工作流执行添加超时保护
                await asyncio.wait_for(
                    self._execute_graph_internal(prompt_id, client_id, graph_data, project_id),
                    timeout=settings.TASK_TIMEOUT_SECONDS
                )
            except asyncio.TimeoutError:
                error_msg = f"Workflow execution timeout after {settings.TASK_TIMEOUT_SECONDS}s"
                logger.error("workflow_timeout",
                            prompt_id=prompt_id,
                            timeout_seconds=settings.TASK_TIMEOUT_SECONDS)
                await ws_manager.send_personal_message({
                    "type": "execution_error",
                    "prompt_id": prompt_id,
                    "error": error_msg
                }, client_id)
            except Exception as e:
                error_msg = f"Workflow execution failed: {str(e)}"
                logger.error("workflow_execution_failed",
                            prompt_id=prompt_id,
                            error=str(e),
                            exc_info=True)
                await ws_manager.send_personal_message({
                    "type": "execution_error",
                    "prompt_id": prompt_id,
                    "error": error_msg,
                    "traceback": traceback.format_exc()
                }, client_id)

    def _normalize_workflow_format(self, workflow_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        将工作流格式（type/params）转换为 executor 格式（class_type/inputs）
        支持两种格式：
        1. 简化格式: {"nodes": [{"id": "n1", "type": "ExcelLoader", "params": {...}}], "edges": [...]}
        2. ComfyUI格式: {"n1": {"class_type": "ExcelLoader", "inputs": {...}}}
        
        Returns:
            标准化的图数据字典 {node_id: {class_type, inputs}}
        """
        # 如果已经是 ComfyUI 格式（直接是节点字典），直接返回
        if not isinstance(workflow_data, dict):
            raise ValueError("Invalid workflow format: must be a dictionary")
        
        # 检查是否是简化格式（包含 nodes 和 edges）
        if "nodes" in workflow_data:
            # 简化格式：需要转换为 ComfyUI 格式
            nodes = workflow_data["nodes"]
            edges = workflow_data.get("edges", [])
            
            # 构建节点映射 {node_id: {class_type, inputs}}
            graph = {}
            for node in nodes:
                node_id = node.get("id")
                if not node_id:
                    continue
                
                # 转换 type -> class_type, params -> inputs
                class_type = node.get("type") or node.get("class_type")
                params = node.get("params") or node.get("inputs", {})
                
                if not class_type:
                    continue
                
                # 处理节点名称映射（兼容性）
                if class_type == "FileUpload":
                    class_type = "FileUploadNode"
                
                graph[node_id] = {
                    "class_type": class_type,
                    "inputs": params.copy() if params else {}  # 先复制原始参数
                }
            
            # 处理 edges，将连线转换为 inputs 中的引用
            # 注意：如果 params 中已经包含了引用（如 "@n5.filtered_df.amount"），
            # 需要解析这些引用并转换为 ComfyUI 格式 ["node_id", slot_index]
            for edge in edges:
                from_node = edge.get("from")
                to_node = edge.get("to")
                from_slot = edge.get("from_slot", 0)
                to_slot = edge.get("to_slot", 0)
                
                if from_node not in graph or to_node not in graph:
                    continue
                
                # 找到目标节点的输入参数名
                target_node = graph[to_node]
                target_class_type = target_node["class_type"]
                
                # 获取节点类以确定输入参数名
                node_class = node_registry.get_node_class(target_class_type)
                if node_class:
                    # 尝试获取 INPUT_TYPES（支持新格式和旧格式）
                    input_types = None
                    if hasattr(node_class, "INPUT_TYPES"):
                        input_types_attr = getattr(node_class, "INPUT_TYPES")
                        if callable(input_types_attr):
                            # 是方法，调用它
                            input_types = input_types_attr()
                        else:
                            # 是类属性（字典），直接使用
                            input_types = input_types_attr
                    elif hasattr(node_class, "INPUT_TYPES_LEGACY"):
                        input_types = node_class.INPUT_TYPES_LEGACY()
                    
                    if isinstance(input_types, dict):
                        # ComfyUI 格式: {"required": {...}, "optional": {...}}
                        if "required" in input_types or "optional" in input_types:
                            required_inputs = list(input_types.get("required", {}).keys())
                            optional_inputs = list(input_types.get("optional", {}).keys())
                            all_inputs = required_inputs + optional_inputs
                            # 获取参数类型信息
                            required_types = input_types.get("required", {})
                            optional_types = input_types.get("optional", {})
                            all_types = {**required_types, **optional_types}
                        else:
                            # 新格式: {"param_name": {"type": ..., "required": ...}}
                            # 按定义顺序获取参数名
                            all_inputs = list(input_types.keys())
                            all_types = input_types
                        
                        if to_slot < len(all_inputs):
                            input_name = all_inputs[to_slot]
                            
                            # 检查参数类型是否匹配
                            # 如果目标参数不是 DATAFRAME 类型，但源输出是 DataFrame，则跳过此 edge
                            param_type_info = all_types.get(input_name)
                            if param_type_info:
                                # ComfyUI 格式: ("DATAFRAME",) 或 ("FLOAT", {...})
                                if isinstance(param_type_info, tuple):
                                    param_type = param_type_info[0] if len(param_type_info) > 0 else None
                                # 新格式: {"type": "DATAFRAME", ...}
                                elif isinstance(param_type_info, dict):
                                    param_type = param_type_info.get("type")
                                else:
                                    param_type = None
                                
                                # 获取源节点的输出类型（如果可能）
                                source_node_class = node_registry.get_node_class(
                                    graph[from_node]["class_type"]
                                )
                                source_output_type = None
                                if source_node_class and hasattr(source_node_class, "RETURN_TYPES"):
                                    return_types = source_node_class.RETURN_TYPES
                                    if from_slot < len(return_types):
                                        source_output_type = return_types[from_slot]
                                
                                # 类型兼容性检查
                                # 如果类型不匹配且不是DATAFRAME，跳过此edge
                                if param_type and source_output_type:
                                    if param_type != source_output_type and param_type != "DATAFRAME":
                                        logger.debug(
                                            f"Skipping edge {from_node}:{from_slot} -> {to_node}:{to_slot} "
                                            f"due to type mismatch: {source_output_type} != {param_type}"
                                        )
                                        continue
                                elif param_type and param_type != "DATAFRAME":
                                    # 如果无法确定源类型，但目标不是DATAFRAME，保守地跳过
                                    logger.debug(
                                        f"Skipping edge {from_node}:{from_slot} -> {to_node}:{to_slot} "
                                        f"due to unknown source type and non-DATAFRAME target"
                                    )
                                    continue
                            
                            # 将引用添加到 inputs（覆盖 params 中的值）
                            target_node["inputs"][input_name] = [from_node, from_slot]
                        else:
                            # to_slot超出范围，记录警告但继续
                            logger.warning(
                                f"Edge to_slot {to_slot} out of range for node {to_node} "
                                f"(class: {target_class_type}). Available inputs: {len(all_inputs)}"
                            )
            
            # 处理 params 中的字符串引用（如 "@n5.filtered_df.amount"）
            # 这些引用需要转换为 ComfyUI 格式
            for node_id, node_def in graph.items():
                inputs = node_def.get("inputs", {})
                for key, value in list(inputs.items()):
                    if isinstance(value, str) and value.startswith("@"):
                        # 解析引用格式: "@node_id.output_name.field"
                        # 简化处理：假设格式为 "@node_id" 或 "@node_id.slot"
                        parts = value[1:].split(".")
                        ref_node_id = parts[0]
                        slot_index = 0
                        if len(parts) > 1 and parts[1].isdigit():
                            slot_index = int(parts[1])
                        
                        if ref_node_id in graph:
                            inputs[key] = [ref_node_id, slot_index]
            
            return graph
        else:
            # 已经是 ComfyUI 格式，直接返回
            return workflow_data
    
    async def _execute_graph_internal(
        self, 
        prompt_id: str, 
        client_id: str, 
        graph_data: Dict[str, Any],
        project_id: str = None
    ):
        """
        内部执行逻辑（从原 execute_graph 提取）
        
        Args:
            prompt_id: 执行任务 ID
            client_id: WebSocket 客户端 ID
            graph_data: 图数据（支持简化格式和 ComfyUI 格式）
            project_id: 项目 ID (决定输出目录)
        """
        # 标准化工作流格式
        try:
            graph_data = self._normalize_workflow_format(graph_data)
        except Exception as e:
            raise
        
        # 确定输出目录
        if project_id:
            from app.core.project_manager import project_manager
            run_dir = project_manager.get_run_dir(project_id, prompt_id)
            output_dir = os.path.join(run_dir, "outputs")
            cache_dir = os.path.join(run_dir, "cache")
        else:
            # 临时执行，使用旧的输出目录
            output_dir = "output"
            cache_dir = os.path.join("cache", prompt_id)
            os.makedirs(cache_dir, exist_ok=True)
        
        # 1. 解析 DAG 并获取拓扑排序
        sorted_nodes = self._topological_sort(graph_data)
        logger.info("workflow_dag_sorted",
                   prompt_id=prompt_id,
                   execution_order=sorted_nodes,
                   output_dir=output_dir)
        
        # 2. 执行上下文缓存 (存储节点输出)
        # 格式: { node_id: (output0, output1, ...) }
        results_cache = {} 
        
        total_steps = len(sorted_nodes)

        for step, node_id in enumerate(sorted_nodes):
            node_def = graph_data[node_id]
            class_type = node_def.get("class_type")
            if not class_type:
                raise ValueError(f"Node {node_id} missing 'class_type' field")
            
            node_class = node_registry.get_node_class(class_type)
            
            if not node_class:
                raise ValueError(f"Unknown node class: {class_type}. Available: {list(node_registry.node_mappings.keys())}")

            # 3. 通知前端: 开始执行该节点
            await ws_manager.send_personal_message({
                "type": "executing",
                "node": node_id,
                "step": step + 1,
                "max_steps": total_steps
            }, client_id)

            # 4. 实例化节点（在解析输入之前，因为可能需要节点实例）
            instance = node_class()
            func_name = getattr(node_class, "FUNCTION", "execute")
            func = getattr(instance, func_name)
            
            # 5. 准备输入参数 (解析依赖，支持默认值)
            inputs = self._resolve_inputs(
                node_def.get("inputs", {}), 
                results_cache,
                node_class=node_class,
                func=func
            )
            
            # 6. 验证和转换输入类型（确保类型匹配）
            inputs = self._validate_and_convert_inputs(
                inputs, node_class, class_type
            )
            
            logger.debug("node_execution_started",
                        prompt_id=prompt_id,
                        node_id=node_id,
                        class_type=class_type,
                        input_keys=list(inputs.keys()))
            
            # 支持同步和异步节点方法
            # 对于同步方法，使用线程池卸载以防止阻塞事件循环
            try:
                if asyncio.iscoroutinefunction(func):
                    outputs = await func(**inputs)
                else:
                    # 将同步 CPU 密集型操作卸载到线程池
                    loop = asyncio.get_event_loop()
                    outputs = await loop.run_in_executor(
                        self.thread_pool, 
                        lambda: func(**inputs)
                    )
            except TypeError as e:
                # 参数不匹配错误，尝试使用函数签名过滤参数
                if "unexpected keyword argument" in str(e) or "missing" in str(e).lower():
                    logger.warning(
                        f"Parameter mismatch for {class_type}.{func_name}, "
                        f"attempting to filter parameters using function signature",
                        exc_info=True
                    )
                    # 获取函数签名，只传递函数接受的参数
                    sig = inspect.signature(func)
                    filtered_inputs = {
                        k: v for k, v in inputs.items() 
                        if k in sig.parameters or k == "self"
                    }
                    if asyncio.iscoroutinefunction(func):
                        outputs = await func(**filtered_inputs)
                    else:
                        loop = asyncio.get_event_loop()
                        outputs = await loop.run_in_executor(
                            self.thread_pool,
                            lambda: func(**filtered_inputs)
                        )
                else:
                    raise

            # 确保输出是元组 (即使只有一个输出)
            if not isinstance(outputs, tuple):
                outputs = (outputs,)
            
            # 6. 缓存结果 & 持久化
            results_cache[node_id] = outputs
            
            # 处理输出以便前端展示 & Parquet 缓存
            ui_outputs = []
            for idx, val in enumerate(outputs):
                # 使用 DataManager 进行 Parquet 缓存 (Audit Trail / High Performance Cache)
                # 注意: 这里我们同时保留了内存对象 (val) 和磁盘缓存
                # 在内存不足场景下，可以只保留路径，下次使用 data_manager.load_intermediate()
                if isinstance(val, pd.DataFrame):
                    cache_path = data_manager.save_intermediate(
                        prompt_id, node_id, val, idx,
                        custom_cache_dir=cache_dir if project_id else None
                    )
                
                if isinstance(val, pd.DataFrame):
                    # 保存 DataFrame 为 Excel (供前端下载)
                    filename = f"{prompt_id}_{node_id}_{idx}.xlsx"
                    filepath = os.path.join(output_dir, filename)
                    val.to_excel(filepath, index=False)
                    
                    # 生成下载 URL (项目执行使用相对路径，临时执行使用 /output)
                    if project_id:
                        download_url = f"{settings.API_BASE_URL}/projects/{project_id}/runs/{prompt_id}/outputs/{filename}"
                    else:
                        download_url = f"{settings.API_BASE_URL}/output/{filename}"
                    
                    ui_outputs.append({
                        "type": "file", 
                        "url": download_url,
                        "preview": val.head(5).to_dict(orient="records"),
                        "cache_path": cache_path # 调试用
                    })
                else:
                    ui_outputs.append({
                        "type": "text",
                        "value": str(val)
                    })

            # 7. 通知前端: 节点执行完成，带上结果
            await ws_manager.send_personal_message({
                "type": "executed", 
                "node": node_id,
                "output": ui_outputs
            }, client_id)

        logger.info("workflow_execution_completed",
                   prompt_id=prompt_id,
                   project_id=project_id or "temp")
        await ws_manager.send_personal_message({
            "type": "status", 
            "status": { "exec_info": { "queue_remaining": 0 } }
        }, client_id)

    def _topological_sort(self, graph: Dict[str, Any]) -> List[str]:
        """
        简单的拓扑排序
        """
        # 1. 构建邻接表和入度表
        adj = {node: [] for node in graph}
        in_degree = {node: 0 for node in graph}
        
        for node_id, node_def in graph.items():
            inputs = node_def.get("inputs", {})
            for key, val in inputs.items():
                # 检查是否是引用类型 ["node_id", slot_index]
                if isinstance(val, list) and len(val) == 2 and isinstance(val[0], str):
                    dep_node_id = val[0]
                    # 只有当引用的是图中的节点时才算依赖
                    if dep_node_id in graph:
                        adj[dep_node_id].append(node_id)
                        in_degree[node_id] += 1

        # 2. Kahn 算法
        queue = [n for n in graph if in_degree[n] == 0]
        sorted_nodes = []
        
        while queue:
            u = queue.pop(0)
            sorted_nodes.append(u)
            
            for v in adj[u]:
                in_degree[v] -= 1
                if in_degree[v] == 0:
                    queue.append(v)
                    
        if len(sorted_nodes) != len(graph):
            raise ValueError("Graph contains cycles!")
            
        return sorted_nodes

    def _resolve_inputs(
        self, 
        inputs_def: Dict[str, Any], 
        results_cache: Dict[str, Any],
        node_class: Optional[Any] = None,
        func: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        解析输入参数，将 ["node_id", slot] 替换为实际值
        支持默认值和可选参数（参考ComfyUI实现）
        
        Args:
            inputs_def: 输入定义字典
            results_cache: 节点输出缓存
            node_class: 节点类（用于获取INPUT_TYPES和默认值）
            func: 执行函数（用于获取函数签名和默认值）
        """
        resolved = {}
        
        # 首先解析所有引用
        for key, val in inputs_def.items():
            if isinstance(val, list) and len(val) == 2 and isinstance(val[0], str):
                # 这是一个引用 ["node_id", slot_index]
                dep_node_id, slot_index = val
                
                if dep_node_id not in results_cache:
                    raise ValueError(f"Dependency {dep_node_id} not computed yet!")
                
                outputs = results_cache[dep_node_id]
                # 越界检查
                if slot_index >= len(outputs):
                    raise ValueError(
                        f"Output index {slot_index} out of range for node {dep_node_id}. "
                        f"Available outputs: {len(outputs)}"
                    )
                    
                resolved[key] = outputs[slot_index]
            else:
                # 普通值
                resolved[key] = val
        
        # 如果提供了节点类和函数，尝试填充默认值
        if node_class and func:
            try:
                # 获取函数签名
                sig = inspect.signature(func)
                func_params = sig.parameters
                
                # 获取INPUT_TYPES定义（用于获取默认值）
                input_types = None
                if hasattr(node_class, "INPUT_TYPES"):
                    input_types_attr = getattr(node_class, "INPUT_TYPES")
                    if callable(input_types_attr):
                        input_types = input_types_attr()
                    else:
                        input_types = input_types_attr
                elif hasattr(node_class, "INPUT_TYPES_LEGACY"):
                    input_types = node_class.INPUT_TYPES_LEGACY()
                
                # 为缺失的参数填充默认值
                for param_name, param in func_params.items():
                    if param_name == "self":
                        continue
                    
                    # 如果参数已经在resolved中，跳过
                    if param_name in resolved:
                        continue
                    
                    # 尝试从函数签名获取默认值
                    if param.default != inspect.Parameter.empty:
                        resolved[param_name] = param.default
                    # 尝试从INPUT_TYPES获取默认值
                    elif input_types:
                        default_val = self._extract_default_from_input_types(
                            input_types, param_name
                        )
                        if default_val is not None:
                            resolved[param_name] = default_val
                            
            except Exception as e:
                # 如果获取默认值失败，记录警告但继续执行
                logger.warning(f"Failed to extract default values: {e}")
        
        return resolved
    
    def _extract_default_from_input_types(
        self, 
        input_types: Dict[str, Any], 
        param_name: str
    ) -> Any:
        """
        从INPUT_TYPES中提取参数的默认值
        支持ComfyUI格式和新格式
        """
        # ComfyUI格式: {"required": {...}, "optional": {...}}
        if "required" in input_types or "optional" in input_types:
            # 先检查required
            if "required" in input_types:
                required = input_types["required"]
                if param_name in required:
                    param_def = required[param_name]
                    # ComfyUI格式: ("TYPE", {"default": value})
                    if isinstance(param_def, tuple) and len(param_def) > 1:
                        if isinstance(param_def[1], dict) and "default" in param_def[1]:
                            return param_def[1]["default"]
            
            # 再检查optional
            if "optional" in input_types:
                optional = input_types["optional"]
                if param_name in optional:
                    param_def = optional[param_name]
                    if isinstance(param_def, tuple) and len(param_def) > 1:
                        if isinstance(param_def[1], dict) and "default" in param_def[1]:
                            return param_def[1]["default"]
        else:
            # 新格式: {"param_name": {"type": ..., "default": ..., "required": ...}}
            if param_name in input_types:
                param_def = input_types[param_name]
                if isinstance(param_def, dict) and "default" in param_def:
                    return param_def["default"]
                # 如果required=False，可以返回None作为默认值
                if isinstance(param_def, dict) and not param_def.get("required", True):
                    return None
        
        return None
    
    def _validate_and_convert_inputs(
        self,
        inputs: Dict[str, Any],
        node_class: Any,
        class_type: str
    ) -> Dict[str, Any]:
        """
        验证和转换输入类型，确保与INPUT_TYPES定义匹配
        参考ComfyUI的实现，进行类型检查和转换
        """
        validated = {}
        
        # 获取INPUT_TYPES定义
        input_types = None
        if hasattr(node_class, "INPUT_TYPES"):
            input_types_attr = getattr(node_class, "INPUT_TYPES")
            if callable(input_types_attr):
                input_types = input_types_attr()
            else:
                input_types = input_types_attr
        elif hasattr(node_class, "INPUT_TYPES_LEGACY"):
            input_types = node_class.INPUT_TYPES_LEGACY()
        
        if not input_types:
            # 如果没有INPUT_TYPES定义，直接返回原始输入
            return inputs
        
        # 解析INPUT_TYPES格式
        all_types = {}
        if isinstance(input_types, dict):
            if "required" in input_types or "optional" in input_types:
                # ComfyUI格式
                all_types = {
                    **input_types.get("required", {}),
                    **input_types.get("optional", {})
                }
            else:
                # 新格式
                all_types = input_types
        
        # 验证和转换每个输入
        for key, value in inputs.items():
            if key not in all_types:
                # 如果INPUT_TYPES中没有定义，可能是函数参数但不在schema中
                # 保留它，让函数签名处理
                validated[key] = value
                continue
            
            type_info = all_types[key]
            expected_type = None
            
            # 提取类型信息
            if isinstance(type_info, tuple):
                expected_type = type_info[0] if len(type_info) > 0 else None
            elif isinstance(type_info, dict):
                expected_type = type_info.get("type")
            
            if not expected_type:
                validated[key] = value
                continue
            
            # 类型检查和转换
            try:
                converted_value = self._convert_value_type(value, expected_type)
                validated[key] = converted_value
            except (ValueError, TypeError) as e:
                logger.warning(
                    f"Type conversion failed for {class_type}.{key}: "
                    f"{type(value).__name__} -> {expected_type}. Error: {e}. "
                    f"Using original value."
                )
                validated[key] = value
        
        return validated
    
    def _convert_value_type(self, value: Any, target_type: str) -> Any:
        """
        将值转换为目标类型
        支持基本类型转换
        """
        if target_type == "DATAFRAME":
            if isinstance(value, pd.DataFrame):
                return value
            else:
                raise TypeError(f"Cannot convert {type(value)} to DataFrame")
        elif target_type == "STRING":
            if isinstance(value, str):
                return value
            else:
                return str(value)
        elif target_type == "INT":
            if isinstance(value, int):
                return value
            elif isinstance(value, (float, str)):
                return int(float(value))
            else:
                raise TypeError(f"Cannot convert {type(value)} to int")
        elif target_type == "FLOAT":
            if isinstance(value, (int, float)):
                return float(value)
            elif isinstance(value, str):
                return float(value)
            else:
                raise TypeError(f"Cannot convert {type(value)} to float")
        elif target_type == "BOOLEAN":
            if isinstance(value, bool):
                return value
            elif isinstance(value, str):
                return value.lower() in ("true", "1", "yes", "on")
            elif isinstance(value, (int, float)):
                return bool(value)
            else:
                raise TypeError(f"Cannot convert {type(value)} to bool")
        elif target_type == "LIST":
            if isinstance(value, list):
                return value
            else:
                return [value]
        elif target_type == "DICT":
            if isinstance(value, dict):
                return value
            else:
                raise TypeError(f"Cannot convert {type(value)} to dict")
        else:
            # 未知类型，返回原值
            return value

# 全局单例
executor = PromptExecutor()
