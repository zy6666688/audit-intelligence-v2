from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.core.database import get_db
from app.core.audit_service import AuditService
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/audit", tags=["audit"])


class AuditLogResponse(BaseModel):
    """审计日志响应模型"""
    id: int
    timestamp: datetime
    user_id: str
    action_type: str
    target_type: Optional[str]
    target_id: Optional[str]
    method: Optional[str]
    path: Optional[str]
    status_code: Optional[int]
    result: Optional[str]
    ip_address: Optional[str]
    
    class Config:
        from_attributes = True


@router.get("/logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    action_type: Optional[str] = None,
    target_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    查询审计日志
    
    Args:
        action_type: 筛选操作类型
        target_id: 筛选目标 ID（如 project_id）
        user_id: 筛选用户 ID
        limit: 返回记录数量（最大 1000）
    
    Returns:
        审计日志列表（按时间倒序）
    """
    if limit > 1000:
        limit = 1000
    
    logs = AuditService.query_logs(
        db=db,
        action_type=action_type,
        target_id=target_id,
        user_id=user_id,
        limit=limit
    )
    
    return logs


@router.get("/logs/{log_id}", response_model=AuditLogResponse)
async def get_audit_log_detail(
    log_id: int,
    db: Session = Depends(get_db)
):
    """
    获取单条审计日志详情（包含完整参数）
    """
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    
    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    
    return log


@router.get("/stats")
async def get_audit_stats(db: Session = Depends(get_db)):
    """
    获取审计统计信息
    """
    total_logs = db.query(AuditLog).count()
    
    # 按操作类型统计
    action_counts = db.query(
        AuditLog.action_type,
        db.func.count(AuditLog.id)
    ).group_by(AuditLog.action_type).all()
    
    return {
        "total_logs": total_logs,
        "action_counts": {action: count for action, count in action_counts}
    }
