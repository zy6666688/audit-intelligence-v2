import os
import json
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path
from pydantic import BaseModel
from app.core.config import settings


class ProjectMetadata(BaseModel):
    """项目元数据模型"""
    id: str
    name: str
    description: str = ""
    created_at: str
    updated_at: str
    workflow_count: int = 0


class Project(BaseModel):
    """项目完整信息"""
    metadata: ProjectMetadata
    workflow: Optional[Dict[str, Any]] = None


class ProjectManager:
    """
    项目管理器：负责项目的 CRUD 操作和文件组织
    """
    
    def __init__(self):
        self.projects_root = os.path.join(settings.STORAGE_PATH, "projects")
        os.makedirs(self.projects_root, exist_ok=True)
    
    def create_project(self, name: str, description: str = "") -> ProjectMetadata:
        """创建新项目"""
        project_id = str(uuid.uuid4())
        project_dir = self._get_project_dir(project_id)
        
        # 创建项目目录结构
        os.makedirs(project_dir, exist_ok=True)
        os.makedirs(os.path.join(project_dir, "data"), exist_ok=True)
        os.makedirs(os.path.join(project_dir, "runs"), exist_ok=True)
        
        # 创建元数据
        now = datetime.now().isoformat()
        metadata = ProjectMetadata(
            id=project_id,
            name=name,
            description=description,
            created_at=now,
            updated_at=now
        )
        
        # 保存元数据
        self._save_metadata(project_id, metadata)
        
        print(f"[ProjectManager] Created project: {project_id} - {name}")
        return metadata
    
    def list_projects(self) -> List[ProjectMetadata]:
        """列出所有项目"""
        projects = []
        
        if not os.path.exists(self.projects_root):
            return projects
        
        for project_id in os.listdir(self.projects_root):
            project_dir = self._get_project_dir(project_id)
            if os.path.isdir(project_dir):
                try:
                    metadata = self._load_metadata(project_id)
                    projects.append(metadata)
                except Exception as e:
                    print(f"[ProjectManager] Failed to load project {project_id}: {e}")
        
        # 按创建时间倒序排序
        projects.sort(key=lambda p: p.created_at, reverse=True)
        return projects
    
    def get_project(self, project_id: str) -> Optional[Project]:
        """获取项目详情"""
        if not self._project_exists(project_id):
            return None
        
        metadata = self._load_metadata(project_id)
        workflow = self._load_workflow(project_id)
        
        return Project(metadata=metadata, workflow=workflow)
    
    def save_workflow(self, project_id: str, workflow: Dict[str, Any]) -> bool:
        """保存工作流到项目"""
        if not self._project_exists(project_id):
            return False
        
        workflow_path = os.path.join(self._get_project_dir(project_id), "workflow.json")
        
        try:
            with open(workflow_path, "w", encoding="utf-8") as f:
                json.dump(workflow, f, ensure_ascii=False, indent=2)
            
            # 更新 updated_at
            metadata = self._load_metadata(project_id)
            metadata.updated_at = datetime.now().isoformat()
            self._save_metadata(project_id, metadata)
            
            print(f"[ProjectManager] Saved workflow for project: {project_id}")
            return True
        except Exception as e:
            print(f"[ProjectManager] Failed to save workflow: {e}")
            return False
    
    def delete_project(self, project_id: str) -> bool:
        """删除项目（谨慎使用）"""
        if not self._project_exists(project_id):
            return False
        
        import shutil
        project_dir = self._get_project_dir(project_id)
        
        try:
            shutil.rmtree(project_dir)
            print(f"[ProjectManager] Deleted project: {project_id}")
            return True
        except Exception as e:
            print(f"[ProjectManager] Failed to delete project: {e}")
            return False
    
    def get_data_dir(self, project_id: str) -> str:
        """获取项目数据目录"""
        return os.path.join(self._get_project_dir(project_id), "data")
    
    def get_run_dir(self, project_id: str, run_id: str) -> str:
        """获取执行运行目录"""
        run_dir = os.path.join(self._get_project_dir(project_id), "runs", run_id)
        os.makedirs(run_dir, exist_ok=True)
        os.makedirs(os.path.join(run_dir, "outputs"), exist_ok=True)
        os.makedirs(os.path.join(run_dir, "cache"), exist_ok=True)
        return run_dir
    
    # Private methods
    
    def _get_project_dir(self, project_id: str) -> str:
        """获取项目根目录"""
        return os.path.join(self.projects_root, project_id)
    
    def _project_exists(self, project_id: str) -> bool:
        """检查项目是否存在"""
        return os.path.isdir(self._get_project_dir(project_id))
    
    def _save_metadata(self, project_id: str, metadata: ProjectMetadata):
        """保存元数据"""
        metadata_path = os.path.join(self._get_project_dir(project_id), "metadata.json")
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata.model_dump(), f, ensure_ascii=False, indent=2)
    
    def _load_metadata(self, project_id: str) -> ProjectMetadata:
        """加载元数据"""
        metadata_path = os.path.join(self._get_project_dir(project_id), "metadata.json")
        with open(metadata_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ProjectMetadata(**data)
    
    def _load_workflow(self, project_id: str) -> Optional[Dict[str, Any]]:
        """加载工作流"""
        workflow_path = os.path.join(self._get_project_dir(project_id), "workflow.json")
        
        if not os.path.exists(workflow_path):
            return None
        
        with open(workflow_path, "r", encoding="utf-8") as f:
            return json.load(f)


# Global instance
project_manager = ProjectManager()
