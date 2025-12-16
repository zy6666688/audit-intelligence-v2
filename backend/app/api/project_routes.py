from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends
from fastapi.responses import FileResponse
from typing import List
from pydantic import BaseModel
import os
import uuid
from app.core.project_manager import project_manager, ProjectMetadata, Project
from app.core.executor import executor
from app.api.auth_routes import get_current_user
from app.models.user import User
import mimetypes

router = APIRouter(prefix="/projects", tags=["projects"])


class CreateProjectRequest(BaseModel):
    name: str
    description: str = ""


class SaveWorkflowRequest(BaseModel):
    workflow: dict


@router.post("/", response_model=ProjectMetadata)
async def create_project(
    request: CreateProjectRequest,
    current_user: User = Depends(get_current_user)
):
    """创建新项目"""
    try:
        metadata = project_manager.create_project(
            name=request.name,
            description=request.description
        )
        return metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")


@router.get("/", response_model=List[ProjectMetadata])
async def list_projects(current_user: User = Depends(get_current_user)):
    """列出所有项目"""
    try:
        projects = project_manager.list_projects()
        return projects
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list projects: {str(e)}")


@router.get("/{project_id}", response_model=Project)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user)
):
    """获取项目详情"""
    project = project_manager.get_project(project_id)
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return project


@router.put("/{project_id}/workflow")
async def save_workflow(
    project_id: str,
    request: SaveWorkflowRequest,
    current_user: User = Depends(get_current_user)
):
    """保存工作流到项目"""
    success = project_manager.save_workflow(project_id, request.workflow)
    
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"status": "success", "message": "Workflow saved"}


@router.post("/{project_id}/upload")
async def upload_file(
    project_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    上传文件到项目数据目录
    仅允许 Excel 文件 (.xlsx, .xls)
    """
    project = project_manager.get_project(project_id)
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 安全检查：文件类型
    allowed_extensions = [".xlsx", ".xls", ".csv"]
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # 安全检查：防止路径遍历攻击
    # 只允许简单的文件名，不允许路径分隔符
    safe_filename = os.path.basename(file.filename)
    if safe_filename != file.filename or ".." in file.filename:
        raise HTTPException(
            status_code=400,
            detail="Invalid filename. Path traversal attempt detected."
        )
    
    # 读取文件内容
    content = await file.read()
    
    # 安全检查：MIME类型验证（验证文件实际内容）
    # 检查文件头部魔数（magic bytes）
    allowed_mime_types = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
        "application/vnd.ms-excel",  # .xls
        "text/csv",  # .csv
        "application/zip"  # .xlsx实际上是zip格式
    ]
    
    # 检查文件魔数签名
    is_valid = False
    if len(content) > 4:
        # ZIP signature (xlsx files are actually ZIP archives)
        if content[:4] == b'PK\x03\x04':
            is_valid = True
        # CSV files (check for common CSV patterns)
        elif file_ext == '.csv':
            try:
                # Try to decode as text
                content.decode('utf-8')
                is_valid = True
            except:
                pass
        # Old Excel format (.xls) - starts with 0xD0CF11E0A1B11AE1
        elif content[:8] == b'\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1':
            is_valid = True
    
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail="File content does not match expected format. Possible malicious file."
        )
    
    # 保存文件
    data_dir = project_manager.get_data_dir(project_id)
    file_path = os.path.join(data_dir, safe_filename)
    
    try:
        with open(file_path, "wb") as f:
            f.write(content)
        
        return {
            "status": "success",
            "filename": file.filename,
            "path": file_path,
            "size": len(content)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")


@router.post("/{project_id}/execute")
async def execute_project_workflow(
    project_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    client_id: str = "default"
):
    """
    执行项目的工作流
    """
    project = project_manager.get_project(project_id)
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not project.workflow:
        raise HTTPException(status_code=400, detail="Project has no workflow")
    
    # 生成运行 ID
    run_id = str(uuid.uuid4())
    
    # 提交后台任务
    background_tasks.add_task(
        executor.execute_graph,
        prompt_id=run_id,
        client_id=client_id,
        graph_data=project.workflow,
        project_id=project_id  # 传递 project_id
    )
    
    return {
        "status": "submitted",
        "project_id": project_id,
        "run_id": run_id
    }


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user)
):
    """删除项目（危险操作）"""
    success = project_manager.delete_project(project_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"status": "success", "message": "Project deleted"}


@router.get("/{project_id}/runs/{run_id}/outputs/{filename}")
async def download_run_output(
    project_id: str,
    run_id: str,
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """
    下载项目执行运行的输出文件
    """
    # 安全检查：防止路径遍历攻击
    safe_filename = os.path.basename(filename)
    if safe_filename != filename or ".." in filename:
        raise HTTPException(
            status_code=400,
            detail="Invalid filename. Path traversal attempt detected."
        )
    
    run_dir = project_manager.get_run_dir(project_id, run_id)
    file_path = os.path.join(run_dir, "outputs", safe_filename)
    
    # 验证文件路径在允许的目录内
    real_file_path = os.path.realpath(file_path)
    real_output_dir = os.path.realpath(os.path.join(run_dir, "outputs"))
    if not real_file_path.startswith(real_output_dir):
        raise HTTPException(
            status_code=403,
            detail="Access denied. Path traversal attempt detected."
        )
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
