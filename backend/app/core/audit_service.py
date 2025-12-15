from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from typing import Optional
import json


class AuditService:
    """
    审计日志服务 - 提供日志记录和查询功能
    """
    
    @staticmethod
    def log(
        db: Session,
        action_type: str,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        method: Optional[str] = None,
        path: Optional[str] = None,
        parameters: Optional[dict] = None,
        status_code: Optional[int] = None,
        result: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        user_id: str = "system"
    ) -> AuditLog:
        """
        记录审计日志
        
        Args:
            db: 数据库会话
            action_type: 操作类型，如 "project.create", "workflow.execute"
            target_type: 目标类型，如 "project", "workflow"
            target_id: 目标 ID
            method: HTTP 方法
            path: 请求路径
            parameters: 参数字典（将被序列化为 JSON）
            status_code: HTTP 状态码
            result: 操作结果描述
            ip_address: 客户端 IP
            user_agent: 客户端 User-Agent
            user_id: 用户 ID（默认 "system"）
        
        Returns:
            创建的 AuditLog 实例
        """
        # 序列化参数
        params_json = None
        if parameters:
            try:
                params_json = json.dumps(parameters, ensure_ascii=False)
            except Exception as e:
                params_json = f"Serialization Error: {str(e)}"
        
        # 创建日志记录
        audit_log = AuditLog(
            user_id=user_id,
            action_type=action_type,
            target_type=target_type,
            target_id=target_id,
            method=method,
            path=path,
            parameters=params_json,
            status_code=status_code,
            result=result,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)
        
        print(f"[AuditLog] {action_type} | Target: {target_type}:{target_id} | User: {user_id}")
        
        return audit_log
    
    @staticmethod
    def query_logs(
        db: Session,
        action_type: Optional[str] = None,
        target_id: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 100
    ):
        """
        查询审计日志
        
        Args:
            db: 数据库会话
            action_type: 筛选操作类型
            target_id: 筛选目标 ID
            user_id: 筛选用户 ID
            limit: 返回记录数量限制
        
        Returns:
            审计日志列表
        """
        query = db.query(AuditLog)
        
        if action_type:
            query = query.filter(AuditLog.action_type == action_type)
        if target_id:
            query = query.filter(AuditLog.target_id == target_id)
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        
        return query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
