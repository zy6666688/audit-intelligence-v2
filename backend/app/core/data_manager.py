import os
import pandas as pd
import uuid
from typing import Any

class DataManager:
    """
    负责数据的序列化与缓存管理 (Parquet/Arrow)
    """
    def __init__(self, cache_dir="cache"):
        self.cache_dir = cache_dir
        os.makedirs(self.cache_dir, exist_ok=True)

    def save_intermediate(
        self, 
        prompt_id: str, 
        node_id: str, 
        data: Any, 
        slot_index: int = 0,
        custom_cache_dir: str = None
    ) -> str:
        """
        缓存中间结果，如果是 DataFrame 则存为 Parquet
        返回: 缓存路径 或 原始数据的引用(如果无需缓存)
        """
        if isinstance(data, pd.DataFrame):
            # 使用自定义缓存目录（项目化执行）或默认缓存目录（临时执行）
            if custom_cache_dir:
                cache_dir = custom_cache_dir
            else:
                cache_dir = os.path.join(self.cache_dir, prompt_id)
            
            os.makedirs(cache_dir, exist_ok=True)
            
            filename = f"{node_id}_{slot_index}.parquet"
            filepath = os.path.join(cache_dir, filename)
            
            # 使用 PyArrow 引擎写入 Parquet
            data.to_parquet(filepath, engine='pyarrow', index=False)
            print(f"[DataManager] Cached DataFrame to {filepath} (Shape: {data.shape})")
            return filepath
        
        # 其他类型暂不缓存到磁盘 (或者可以使用 pickle/json)
        return data

    def load_intermediate(self, filepath_or_data: Any) -> Any:
        """
        读取中间结果
        支持相对路径和绝对路径
        会尝试多个可能的路径来查找文件
        """
        if isinstance(filepath_or_data, str) and filepath_or_data.endswith(".parquet"):
            # 尝试多个可能的路径
            possible_paths = []
            
            # 如果是绝对路径，直接使用
            if os.path.isabs(filepath_or_data):
                possible_paths.append(filepath_or_data)
            else:
                # 相对路径，尝试多个位置
                possible_paths.extend([
                    filepath_or_data,  # 相对路径（相对于当前工作目录）
                    os.path.join(self.cache_dir, filepath_or_data),  # 相对于cache_dir
                    os.path.join(os.getcwd(), filepath_or_data),  # 相对于当前工作目录
                    os.path.abspath(filepath_or_data),  # 绝对路径版本
                ])
            
            # 如果路径包含cache目录，也尝试从项目根目录查找
            if "cache" in filepath_or_data:
                # 尝试从项目根目录查找（如果当前在backend目录）
                current_dir = os.getcwd()
                if os.path.basename(current_dir) == 'backend':
                    # 在backend目录，尝试从上级目录查找
                    project_root = os.path.dirname(current_dir)
                    possible_paths.append(os.path.join(project_root, filepath_or_data))
                else:
                    # 在项目根目录，直接使用
                    possible_paths.append(os.path.join(current_dir, filepath_or_data))
            
            # 去重
            possible_paths = list(dict.fromkeys(possible_paths))
            
            # 尝试每个路径
            for path in possible_paths:
                if os.path.exists(path):
                    print(f"[DataManager] Loading DataFrame from {os.path.abspath(path)}")
                    return pd.read_parquet(path, engine='pyarrow')
            
            # 如果所有路径都不存在，打印所有尝试的路径以便调试
            print(f"[DataManager] Warning: Parquet file not found: {filepath_or_data}")
            print(f"[DataManager] Tried paths:")
            for path in possible_paths:
                print(f"  - {os.path.abspath(path)}")
            return None
            
        return filepath_or_data

    def cleanup(self, prompt_id: str):
        """
        清理指定任务的缓存
        """
        prompt_dir = os.path.join(self.cache_dir, prompt_id)
        if os.path.exists(prompt_dir):
            import shutil
            shutil.rmtree(prompt_dir)
            print(f"[DataManager] Cleaned up cache for {prompt_id}")

data_manager = DataManager()
