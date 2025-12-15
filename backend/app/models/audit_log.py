from sqlalchemy import Column, String, Text, DateTime, Integer
from datetime import datetime
from app.core.database import Base


class AuditLog(Base):
    """
    审计日志表 - 记录所有关键操作
    
    满足 GB/T 24589 审计软件合规要求：
    - 不可删除（通过应用层约束）
    - 记录完整操作上下文
    - 支持数据血缘追溯
    """
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 时间戳
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # 用户信息（后续集成 JWT 认证后填充）
    user_id = Column(String(100), default="system", index=True)
    
    # 操作类型
    action_type = Column(String(50), nullable=False, index=True)
    # 例如: "project.create", "workflow.execute", "file.upload"
    
    # 操作目标
    target_type = Column(String(50))  # 例如: "project", "workflow", "node"
    target_id = Column(String(100), index=True)  # 例如: project_id, run_id
    
    # HTTP 请求信息
    method = Column(String(10))  # GET, POST, PUT, DELETE
    path = Column(String(500))   # 请求路径
    
    # 参数快照（JSON 序列化）
    parameters = Column(Text)  # 请求体或关键参数的 JSON
    
    # 操作结果
    status_code = Column(Integer)  # HTTP 状态码
    result = Column(Text)  # 成功/失败信息
    
    # 客户端信息
    ip_address = Column(String(45))  # IPv4/IPv6
    user_agent = Column(String(500))
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, action={self.action_type}, user={self.user_id}, time={self.timestamp})>"
