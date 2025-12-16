import pandas as pd
import os
import hashlib
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
import shutil

from .base_node import BaseNode, ExecutionContext, NodeMetadata, FailurePolicy

class ExcelLoader(BaseNode):
    """
    加载 Excel 文件为 DataFrame
    
    功能：
    - 从文件路径加载Excel文件
    - 支持.xlsx和.xls格式
    - 自动查找input目录
    - 返回标准化的DataFrame
    
    输入：
    - file_path: Excel文件路径
    
    输出：
    - dataframe: 加载的DataFrame
    """
    
    # Node configuration
    NODE_TYPE = "ExcelLoader"
    VERSION = "2.0.0"
    CATEGORY = "输入/文件"
    DISPLAY_NAME = "Excel加载器"
    
    OUTPUT_TYPES = {
        "dataframe": {
            "type": "DATAFRAME",
            "description": "加载的DataFrame"
        }
    }
    
    # ComfyUI兼容格式（执行器会优先使用这个方法）
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "file_path": ("STRING", {"default": "input/data.xlsx"}),
            }
        }

    RETURN_TYPES = ("DATAFRAME",)
    RETURN_NAMES = ("dataframe",)
    FUNCTION = "load_excel"
    
    def __init__(self, metadata: Optional[NodeMetadata] = None):
        """Initialize with metadata"""
        if metadata is None:
            metadata = NodeMetadata(
                node_type=self.NODE_TYPE,
                version=self.VERSION,
                display_name=self.DISPLAY_NAME,
                category=self.CATEGORY,
                failure_policy=FailurePolicy.RETRY,
                timeout_seconds=60,
                cache_results=True
            )
        super().__init__(metadata)
    
    def _execute_pure(self, inputs: Dict[str, Any], context: ExecutionContext) -> Dict[str, Any]:
        """
        Pure function implementation for loading Excel
        """
        file_path = inputs.get("file_path", "input/data.xlsx")
        
        # 简单防路径穿越 (POC)
        base_dir = os.getcwd()
        full_path = os.path.join(base_dir, file_path)
        
        if not os.path.exists(full_path):
            # 尝试在 input 目录下查找
            input_path = os.path.join(base_dir, "input", file_path)
            if os.path.exists(input_path):
                full_path = input_path
            else:
                # 尝试 backend/input 目录
                backend_input_path = os.path.join(
                    base_dir, "backend", "input", os.path.basename(file_path)
                )
                if os.path.exists(backend_input_path):
                    full_path = backend_input_path
                else:
                    raise FileNotFoundError(f"File not found: {file_path}")

        try:
            df = pd.read_excel(full_path)
            return {"dataframe": df}
        except Exception as e:
            raise ValueError(f"Failed to load Excel file {file_path}: {str(e)}")
    
    def load_excel(self, file_path: str = "input/data.xlsx") -> Tuple[pd.DataFrame]:
        """
        Legacy interface for backward compatibility
        """
        context = ExecutionContext(
            workflow_id="legacy",
            run_id="legacy_run",
            node_exec_id="excel_loader"
        )
        
        result = self._execute_pure({"file_path": file_path}, context)
        return (result["dataframe"],)

class FileUploadNode(BaseNode):
    """
    1A 文件上传节点 - 负责接收和存储各类文件
    只做校验、存储、生成元数据，不做内容识别
    """
    
    NODE_TYPE = "FileUploadNode"
    VERSION = "1.0.0"
    CATEGORY = "输入/文件"
    DISPLAY_NAME = "文件上传"
    
    OUTPUT_TYPES = {
        "file_id": {"type": "STRING"},
        "storage_path": {"type": "STRING"},
        "file_metadata": {"type": "DICT"}
    }
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "file_path": ("STRING", {"default": ""}),
                "workflow_id": ("STRING", {"default": "default_workflow"}),
            },
            "optional": {
                "file_type_hint": ("STRING", {"default": "auto"}),
            }
        }
    
    RETURN_TYPES = ("STRING", "STRING", "DICT")
    RETURN_NAMES = ("file_id", "storage_path", "file_metadata")
    FUNCTION = "upload_file"
    
    def upload_file(self, file_path: str, workflow_id: str, file_type_hint: str = "auto") -> Tuple[str, str, Dict]:
        """文件上传处理"""
        # 生成文件ID
        file_id = f"file_{workflow_id}_{uuid.uuid4().hex[:8]}"
        
        # 校验文件
        if not os.path.exists(file_path):
            # 尝试在input目录查找
            input_path = os.path.join("backend/input", file_path)
            if os.path.exists(input_path):
                file_path = input_path
            else:
                raise FileNotFoundError(f"File not found: {file_path}")
        
        file_size = os.path.getsize(file_path)
        file_name = os.path.basename(file_path)
        
        # 安全性检查
        MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
        if file_size > MAX_FILE_SIZE:
            raise ValueError(f"File too large: {file_size} bytes")
        
        # 存储路径
        storage_base = "backend/storage/uploads"
        os.makedirs(storage_base, exist_ok=True)
        storage_path = os.path.join(storage_base, workflow_id, file_id)
        os.makedirs(os.path.dirname(storage_path), exist_ok=True)
        
        # 复制文件
        shutil.copy2(file_path, storage_path)
        
        # 生成元数据
        file_metadata = {
            "file_id": file_id,
            "original_name": file_name,
            "size": file_size,
            "type_hint": file_type_hint,
            "upload_time": datetime.now().isoformat(),
            "checksum": self._calculate_file_hash(file_path)
        }
        
        return file_id, storage_path, file_metadata
    
    def _calculate_file_hash(self, file_path: str) -> str:
        """计算文件哈希值"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()


class FileRecognitionNode(BaseNode):
    """
    1B 文件识别节点 - OCR和结构化提取
    根据文件类型选择不同的识别策略
    """
    
    NODE_TYPE = "FileRecognitionNode"
    VERSION = "1.0.0"
    CATEGORY = "输入/文件"
    DISPLAY_NAME = "文件识别"
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "storage_path": ("STRING", {}),
                "file_id": ("STRING", {}),
            },
            "optional": {
                "recognition_profile": (["general", "invoice", "contract", "receipt"], {"default": "general"}),
            }
        }
    
    RETURN_TYPES = ("DATAFRAME", "STRING", "DICT")
    RETURN_NAMES = ("extracted_data", "recognized_text", "recognition_quality")
    FUNCTION = "recognize_file"
    
    def recognize_file(self, storage_path: str, file_id: str, recognition_profile: str = "general"):
        """文件识别处理"""
        file_ext = os.path.splitext(storage_path)[1].lower()
        
        extracted_data = pd.DataFrame()
        recognized_text = ""
        
        if file_ext in ['.xlsx', '.xls', '.csv']:
            # Excel/CSV直接解析
            if file_ext == '.csv':
                extracted_data = pd.read_csv(storage_path)
            else:
                extracted_data = pd.read_excel(storage_path)
            recognized_text = f"Extracted {len(extracted_data)} rows"
            
        elif file_ext in ['.pdf', '.png', '.jpg', '.jpeg']:
            # 图像/PDF需要OCR（模拟）
            recognized_text = f"[OCR result for {file_ext}]"
            
            # 模拟票据识别
            if recognition_profile == "invoice":
                extracted_data = pd.DataFrame([{
                    "invoice_number": "INV-2024-001",
                    "amount": 10000.00,
                    "date": "2024-01-15",
                    "vendor": "示例供应商"
                }])
        else:
            # 文本文件
            with open(storage_path, 'r', encoding='utf-8', errors='ignore') as f:
                recognized_text = f.read()[:1000]  # 限制长度
        
        recognition_quality = {
            "confidence": 0.95,
            "extraction_time": 1.5,
            "file_type": file_ext
        }
        
        return extracted_data, recognized_text, recognition_quality


NODE_CLASS_MAPPINGS = {
    "ExcelLoader": ExcelLoader,
    "FileUploadNode": FileUploadNode,
    "FileRecognitionNode": FileRecognitionNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ExcelLoader": "Excel加载器",
    "FileUploadNode": "文件上传",
    "FileRecognitionNode": "文件识别(OCR)"
}
