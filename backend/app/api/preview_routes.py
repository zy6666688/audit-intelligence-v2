from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
import os
import pandas as pd
import pyarrow.parquet as pq
from app.core.data_manager import data_manager
from app.core.project_manager import project_manager
from app.models.user import User
from app.core.config import settings

# 从 routes.py 导入可选认证依赖（因为它在 routes.py 中定义）
from app.api.routes import get_current_user_optional

router = APIRouter(prefix="/preview", tags=["preview"])

class DataPreviewResponse(BaseModel):
    """数据预览响应模型"""
    rows: List[Dict[str, Any]]  # 预览数据（最多 100 行）
    total_rows: int              # 总行数
    columns: List[str]           # 列名列表
    schema: Dict[str, str]       # 列名 -> 数据类型映射
    sample_values: Dict[str, List[Any]]  # 每列的示例值（用于UI筛选）


@router.get("/node/{prompt_id}/{node_id}/{output_index}", response_model=DataPreviewResponse)
async def preview_node_output(
    prompt_id: str,
    node_id: str,
    output_index: int = 0,
    current_user: Optional[User] = Depends(get_current_user_optional),
    limit: int = 100
):
    """
    预览节点输出数据
    
    参考 n8n 的 Schema Preview 功能，提供：
    - 前 N 行数据
    - 完整 Schema 信息
    - 每列的示例值（用于构建筛选器）
    
    Args:
        prompt_id: 执行任务 ID
        node_id: 节点 ID
        output_index: 输出索引（默认 0）
        limit: 返回行数限制（最大 1000）
    
    Returns:
        数据预览信息
    """
    if limit > 1000:
        limit = 1000
    
    # 构造缓存路径（与executor.py中的保存路径一致）
    # executor.py中保存路径为: cache_dir = os.path.join(self.cache_dir, prompt_id)
    # filename = f"{node_id}_{slot_index}.parquet"
    # DataManager的cache_dir默认是"cache"，所以完整路径应该是: cache/{prompt_id}/{node_id}_{output_index}.parquet
    # data_manager.save_intermediate返回的是绝对路径或相对路径，取决于cache_dir的设置
    # 我们需要尝试多个可能的路径
    
    # 获取当前工作目录（通常是backend目录）
    current_dir = os.getcwd()
    backend_dir = current_dir if os.path.basename(current_dir) == 'backend' else os.path.join(current_dir, 'backend')
    
    # 尝试多个可能的路径
    possible_paths = [
        # 相对路径（相对于当前工作目录）
        os.path.join("cache", prompt_id, f"{node_id}_{output_index}.parquet"),
        # 相对于backend目录
        os.path.join(backend_dir, "cache", prompt_id, f"{node_id}_{output_index}.parquet"),
        # 使用data_manager的cache_dir（可能是绝对路径）
        os.path.join(data_manager.cache_dir, prompt_id, f"{node_id}_{output_index}.parquet"),
        # 绝对路径（如果cache_dir是绝对路径）
        os.path.abspath(os.path.join(data_manager.cache_dir, prompt_id, f"{node_id}_{output_index}.parquet")),
    ]
    
    # 使用第一个路径作为默认值，data_manager.load_intermediate会尝试多个路径
    cache_path = possible_paths[0]
    
    # #region agent log
    try:
        with open(r'd:\审计数智析v2\.cursor\debug.log', 'a', encoding='utf-8') as f:
            import json
            f.write(json.dumps({"sessionId":"debug-session","runId":"preview","hypothesisId":"A","location":"preview_routes.py:58","message":"Preview request received","data":{"prompt_id":prompt_id,"node_id":node_id,"output_index":output_index,"cache_path":cache_path,"cache_exists":os.path.exists(cache_path)},"timestamp":int(__import__('time').time()*1000)}) + '\n')
    except: pass
    # #endregion
    
    try:
        # 加载 DataFrame
        # #region agent log
        try:
            with open(r'd:\审计数智析v2\.cursor\debug.log', 'a', encoding='utf-8') as f:
                import json
                f.write(json.dumps({"sessionId":"debug-session","runId":"preview","hypothesisId":"A","location":"preview_routes.py:68","message":"Before loading intermediate","data":{"cache_path":cache_path,"absolute_path":os.path.abspath(cache_path) if cache_path else None},"timestamp":int(__import__('time').time()*1000)}) + '\n')
        except: pass
        # #endregion
        df = data_manager.load_intermediate(cache_path)
        # #region agent log
        try:
            with open(r'd:\审计数智析v2\.cursor\debug.log', 'a', encoding='utf-8') as f:
                import json
                f.write(json.dumps({"sessionId":"debug-session","runId":"preview","hypothesisId":"A","location":"preview_routes.py:77","message":"DataFrame loaded","data":{"df_is_none":df is None,"df_type":str(type(df)),"rows":len(df) if df is not None and isinstance(df, pd.DataFrame) else 0,"columns":df.columns.tolist() if df is not None and isinstance(df, pd.DataFrame) else []},"timestamp":int(__import__('time').time()*1000)}) + '\n')
        except: pass
        # #endregion
        
        if df is None:
            # 缓存文件不存在，可能的原因：
            # 1. 节点没有DataFrame输出（如FileUploadNode输出文件元数据）
            # 2. 节点执行失败
            # 3. 工作流未执行
            # 4. 缓存路径不匹配
            
            # 尝试查找其他可能的缓存文件（检查是否有其他输出索引）
            cache_dir = os.path.join(data_manager.cache_dir, prompt_id)
            has_any_cache = False
            if os.path.exists(cache_dir):
                cache_files = [f for f in os.listdir(cache_dir) if f.startswith(f"{node_id}_") and f.endswith(".parquet")]
                has_any_cache = len(cache_files) > 0
            
            if has_any_cache:
                # 有其他输出索引的缓存文件，说明节点有DataFrame输出，但请求的output_index不存在
                detail = f"Cache file not found for output index {output_index} of node '{node_id}'. This node may have DataFrame outputs at different indices. Please check the node's output structure."
            else:
                # 没有任何缓存文件，说明节点可能没有DataFrame输出
                detail = f"No DataFrame cache found for node '{node_id}'. This node may not output DataFrame data (it may output metadata, strings, or other non-tabular data). Please select a node that outputs DataFrame, such as ExcelLoader, ColumnMapperNode, NullValueCleanerNode, or ExcelColumnValidator."
            
            raise HTTPException(
                status_code=404,
                detail=detail
            )
        
        if not isinstance(df, pd.DataFrame):
            raise HTTPException(
                status_code=400,
                detail=f"Output is not a DataFrame. Got type: {type(df)}. Only DataFrame outputs can be previewed."
            )
        
        # 提取预览数据
        try:
            preview_df = df.head(limit)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to extract preview data: {str(e)}"
            )
        
        # 构造 Schema（列名 -> 数据类型）
        try:
            schema = {col: str(df[col].dtype) for col in df.columns}
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to extract schema: {str(e)}"
            )
        
        # 提取每列的示例值（用于 UI 筛选）
        sample_values = {}
        try:
            for col in df.columns:
                try:
                    # 对于分类列，提取唯一值
                    if df[col].dtype == 'object' or df[col].nunique() < 20:
                        unique_vals = df[col].dropna().unique().tolist()[:10]
                        # 确保值可以序列化为JSON
                        sample_values[col] = [str(v) if not isinstance(v, (int, float, bool, str, type(None))) else v for v in unique_vals]
                    else:
                        # 对于数值列，提取 min/max
                        col_min = df[col].min()
                        col_max = df[col].max()
                        sample_values[col] = [
                            float(col_min) if pd.notnull(col_min) else None,
                            float(col_max) if pd.notnull(col_max) else None
                        ]
                except Exception as col_error:
                    # 如果某列处理失败，跳过该列
                    print(f"[Preview] Warning: Failed to extract sample values for column {col}: {col_error}")
                    sample_values[col] = []
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to extract sample values: {str(e)}"
            )
        
        # 转换为字典格式
        try:
            rows_dict = preview_df.to_dict(orient="records")
            # 确保所有值都可以序列化
            for row in rows_dict:
                for key, value in row.items():
                    if pd.isna(value):
                        row[key] = None
                    elif isinstance(value, (pd.Timestamp,)):
                        row[key] = value.isoformat()
                    elif not isinstance(value, (int, float, bool, str, type(None), list, dict)):
                        row[key] = str(value)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to convert DataFrame to dict: {str(e)}"
            )
        
        try:
            return DataPreviewResponse(
                rows=rows_dict,
                total_rows=len(df),
                columns=df.columns.tolist(),
                schema=schema,
                sample_values=sample_values
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create response: {str(e)}"
            )
    
    except FileNotFoundError:
        # #region agent log
        try:
            with open(r'd:\审计数智析v2\.cursor\debug.log', 'a', encoding='utf-8') as f:
                import json
                f.write(json.dumps({"sessionId":"debug-session","runId":"preview","hypothesisId":"A","location":"preview_routes.py:117","message":"FileNotFoundError","data":{"cache_path":cache_path,"absolute_path":os.path.abspath(cache_path) if cache_path else None,"cache_dir_exists":os.path.exists(os.path.dirname(cache_path)) if cache_path else False},"timestamp":int(__import__('time').time()*1000)}) + '\n')
        except: pass
        # #endregion
        raise HTTPException(
            status_code=404,
            detail=f"No cache found for node {node_id} in prompt {prompt_id}. Please execute the workflow first. Cache path: {cache_path}"
        )
    except HTTPException:
        # 重新抛出HTTP异常（已经处理过的）
        raise
    except Exception as e:
        # #region agent log
        import traceback
        error_traceback = traceback.format_exc()
        try:
            with open(r'd:\审计数智析v2\.cursor\debug.log', 'a', encoding='utf-8') as f:
                import json
                f.write(json.dumps({"sessionId":"debug-session","runId":"preview","hypothesisId":"A","location":"preview_routes.py:190","message":"Exception in preview","data":{"error":str(e),"error_type":type(e).__name__,"cache_path":cache_path,"traceback":error_traceback},"timestamp":int(__import__('time').time()*1000)}) + '\n')
        except: pass
        # #endregion
        
        # 记录详细错误到控制台
        print(f"[Preview] Error loading preview for node {node_id}: {str(e)}")
        print(f"[Preview] Traceback: {error_traceback}")
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load preview: {str(e)}. Error type: {type(e).__name__}"
        )


@router.get("/project/{project_id}/run/{run_id}/node/{node_id}/{output_index}", response_model=DataPreviewResponse)
async def preview_project_run_output(
    project_id: str,
    run_id: str,
    node_id: str,
    output_index: int = 0,
    current_user: Optional[User] = Depends(get_current_user_optional),
    limit: int = 100
):
    """
    预览项目执行运行的节点输出
    
    Args:
        project_id: 项目 ID
        run_id: 运行 ID
        node_id: 节点 ID
        output_index: 输出索引
        limit: 返回行数限制
    
    Returns:
        数据预览信息
    """
    if limit > 1000:
        limit = 1000
    
    # 使用 project_manager 获取运行目录
    from app.core.project_manager import project_manager
    run_dir = project_manager.get_run_dir(project_id, run_id)
    cache_path = f"{run_dir}/cache/{node_id}_{output_index}.parquet"
    
    try:
        df = pd.read_parquet(cache_path)
        
        if not isinstance(df, pd.DataFrame):
            raise HTTPException(
                status_code=400,
                detail="Output is not a DataFrame"
            )
        
        preview_df = df.head(limit)
        schema = {col: str(df[col].dtype) for col in df.columns}
        
        sample_values = {}
        for col in df.columns:
            if df[col].dtype == 'object' or df[col].nunique() < 20:
                sample_values[col] = df[col].dropna().unique().tolist()[:10]
            else:
                sample_values[col] = [
                    float(df[col].min()) if pd.notnull(df[col].min()) else None,
                    float(df[col].max()) if pd.notnull(df[col].max()) else None
                ]
        
        return DataPreviewResponse(
            rows=preview_df.to_dict(orient="records"),
            total_rows=len(df),
            columns=df.columns.tolist(),
            schema=schema,
            sample_values=sample_values
        )
    
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"No output found for node {node_id} in run {run_id}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load preview: {str(e)}"
        )
