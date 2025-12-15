from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional
from app.core.registry import node_registry
from app.core.executor import executor
from app.api.auth_routes import get_current_user
from app.models.user import User
from app.core.user_database import get_db
import uuid

router = APIRouter()

# 可选认证：预览等接口允许未登录访问，但如果携带 token 则校验
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Optional auth dependency: returns user if token valid; otherwise None.
    """
    if not token:
        return None
    try:
        return await get_current_user(token=token, db=db)  # type: ignore[arg-type]
    except HTTPException as exc:
        # 对 401/403 等认证失败，降级为匿名
        if exc.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN):
            return None
        raise

@router.get("/object_info")
async def get_object_info(current_user: User = Depends(get_current_user)):
    """
    返回所有已注册节点的元数据，供前端动态生成 UI
    """
    return node_registry.get_all_definitions()

@router.post("/prompt")
async def execute_prompt(
    payload: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    提交任务
    """
    client_id = payload.get('client_id')
    graph_data = payload.get('prompt', {})
    prompt_id = str(uuid.uuid4())
    
    print(f"[Prompt Received] ID: {prompt_id}, Client: {client_id}, Nodes: {len(graph_data)}")
    
    # 将执行任务加入后台队列
    background_tasks.add_task(executor.execute_graph, prompt_id, client_id, graph_data)
    
    return {"prompt_id": prompt_id, "status": "queued"}
