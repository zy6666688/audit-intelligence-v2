from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from app.core.database import SessionLocal
from app.core.audit_service import AuditService
import time
import json


class AuditMiddleware(BaseHTTPMiddleware):
    """
    审计中间件 - 自动记录所有 HTTP 请求
    
    仅记录关键操作：
    - POST /projects/ (创建项目)
    - POST /prompt (执行工作流 - 旧接口)
    - POST /projects/{id}/execute (执行项目工作流)
    - PUT /projects/{id}/workflow (保存工作流)
    - POST /projects/{id}/upload (上传文件)
    """
    
    # 需要审计的路径模式
    AUDIT_PATTERNS = [
        ("/projects", "POST"),      # 创建项目
        ("/prompt", "POST"),        # 执行工作流（旧）
        ("/execute", "POST"),       # 执行项目工作流
        ("/workflow", "PUT"),       # 保存工作流
        ("/upload", "POST"),        # 上传文件
    ]
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
    
    async def dispatch(self, request: Request, call_next):
        """
        处理每个 HTTP 请求
        """
        # 记录开始时间
        start_time = time.time()
        
        # 检查是否需要审计此请求
        should_audit = self._should_audit(request)
        
        # 提取请求信息
        method = request.method
        path = str(request.url.path)
        ip_address = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "")
        
        # 尝试读取请求体（仅用于 POST/PUT）
        body_params = None
        if should_audit and method in ["POST", "PUT"]:
            try:
                body = await request.body()
                # 重新包装 request 以便后续处理
                async def receive():
                    return {"type": "http.request", "body": body}
                request._receive = receive
                
                # 解析 JSON
                if body:
                    try:
                        body_params = json.loads(body.decode())
                        # 过滤敏感字段
                        if isinstance(body_params, dict):
                            body_params = self._filter_sensitive(body_params)
                    except:
                        body_params = {"raw": body.decode()[:500]}  # 截断
            except Exception as e:
                body_params = {"error": str(e)}
        
        # 执行请求
        response: Response = await call_next(request)
        
        # 计算耗时
        duration = time.time() - start_time
        
        # 如果需要审计，记录日志
        if should_audit:
            self._log_request(
                method=method,
                path=path,
                parameters=body_params,
                status_code=response.status_code,
                duration=duration,
                ip_address=ip_address,
                user_agent=user_agent
            )
        
        return response
    
    def _should_audit(self, request: Request) -> bool:
        """
        判断请求是否需要审计
        """
        path = str(request.url.path)
        method = request.method
        
        for pattern_path, pattern_method in self.AUDIT_PATTERNS:
            if pattern_path in path and method == pattern_method:
                return True
        
        return False
    
    def _filter_sensitive(self, params: dict) -> dict:
        """
        过滤敏感字段（如密码、token），支持嵌套字典
        """
        if not isinstance(params, dict):
            return params
        
        filtered = {}
        sensitive_keys = [
            "password", "token", "secret", "api_key", "apikey",
            "access_token", "refresh_token", "jwt", "authorization",
            "passwd", "pwd", "creditcard", "credit_card", "ssn",
            "private_key", "secret_key"
        ]
        
        for key, value in params.items():
            # Check if key is sensitive (case-insensitive)
            key_lower = key.lower()
            is_sensitive = any(sensitive in key_lower for sensitive in sensitive_keys)
            
            if is_sensitive:
                filtered[key] = "***REDACTED***"
            elif isinstance(value, dict):
                # Recursively filter nested dictionaries
                filtered[key] = self._filter_sensitive(value)
            elif isinstance(value, list):
                # Filter lists of dictionaries
                filtered[key] = [
                    self._filter_sensitive(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                filtered[key] = value
        
        return filtered
    
    def _log_request(
        self,
        method: str,
        path: str,
        parameters: dict,
        status_code: int,
        duration: float,
        ip_address: str,
        user_agent: str
    ):
        """
        记录审计日志到数据库
        """
        db = SessionLocal()
        
        try:
            # 确定操作类型
            action_type = self._determine_action_type(method, path)
            
            # 提取目标信息
            target_type, target_id = self._extract_target(path)
            
            # 记录日志
            AuditService.log(
                db=db,
                action_type=action_type,
                target_type=target_type,
                target_id=target_id,
                method=method,
                path=path,
                parameters=parameters,
                status_code=status_code,
                result=f"Completed in {duration:.3f}s",
                ip_address=ip_address,
                user_agent=user_agent
            )
        except Exception as e:
            print(f"[AuditMiddleware] Failed to log: {e}")
        finally:
            db.close()
    
    def _determine_action_type(self, method: str, path: str) -> str:
        """
        根据请求确定操作类型
        """
        if "/projects" in path and method == "POST" and path.count("/") == 2:
            return "project.create"
        elif "/execute" in path:
            return "workflow.execute"
        elif "/workflow" in path:
            return "workflow.save"
        elif "/upload" in path:
            return "file.upload"
        elif "/prompt" in path:
            return "workflow.execute.legacy"
        else:
            return f"{method.lower()}.{path.replace('/', '.')}"
    
    def _extract_target(self, path: str) -> tuple:
        """
        从路径中提取目标类型和 ID
        """
        parts = path.strip("/").split("/")
        
        if "projects" in parts:
            idx = parts.index("projects")
            if len(parts) > idx + 1:
                return ("project", parts[idx + 1])
        
        return (None, None)
