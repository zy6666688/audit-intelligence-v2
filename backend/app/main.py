from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from app.api.routes import router as api_router
from app.api.websocket import router as ws_router
from app.api.project_routes import router as project_router
from app.api.audit_routes import router as audit_router
from app.api.preview_routes import router as preview_router
from app.api.auth_routes import router as auth_router
from app.api.health_routes import router as health_router
from app.middleware.audit_middleware import AuditMiddleware
from app.middleware.rate_limiter import RateLimitMiddleware, rate_limiter
from app.middleware.request_size_limit import RequestSizeLimitMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.core.user_database import init_db as init_user_db, create_default_admin, get_db
from app.core.logger import configure_logging, get_logger
import app.nodes # 触发节点注册逻辑
import os

# Initialize structured logging
configure_logging()
logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 初始化审计日志数据库
    init_db()
    logger.info("database_initialized", db_type="audit_logs")
    
    # 初始化用户数据库
    init_user_db()
    logger.info("database_initialized", db_type="users")
    
    # 创建默认管理员（如果没有用户）
    db = next(get_db())
    admin_created = create_default_admin(db)
    db.close()
    if admin_created:
        logger.warning("default_admin_created", username="admin", 
                      message="Change password immediately!")
    
    from app.core.registry import node_registry
    logger.info("startup_complete", 
               nodes_loaded=len(node_registry.node_mappings),
               storage_path=settings.STORAGE_PATH,
               max_concurrent_tasks=settings.MAX_CONCURRENT_TASKS,
               audit_enabled=True,
               jwt_enabled=True,
               debug_mode=settings.DEBUG)
    
    yield
    
    # Shutdown: Clean up resources
    logger.info("shutdown_started")
    from app.core.executor import executor
    executor.shutdown()
    logger.info("shutdown_completed")

app = FastAPI(
    title="Audit Intelligence v2 Backend",
    lifespan=lifespan,
    # Disable API documentation in production for security
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None
)

# ============================================================================
# Global Exception Handlers (防止敏感信息泄漏)
# ============================================================================

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions with proper logging"""
    logger.warning("http_exception",
                  path=request.url.path,
                  status_code=exc.status_code,
                  detail=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors"""
    logger.warning("validation_error",
                  path=request.url.path,
                  errors=exc.errors())
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": exc.errors()}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Catch-all handler for unhandled exceptions.
    Prevents stack trace leakage in production.
    """
    logger.error("unhandled_exception",
                path=request.url.path,
                error=str(exc),
                exc_info=True)
    
    # In debug mode, return detailed error; in production, return generic error
    if settings.DEBUG:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Internal server error",
                "error": str(exc),
                "type": type(exc).__name__
            }
        )
    else:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"}
        )

# ============================================================================
# Middleware Stack (按执行顺序排列)
# ============================================================================

# Security headers middleware (添加安全响应头)
app.add_middleware(SecurityHeadersMiddleware)

# Request size limit middleware (防止大payload DoS攻击)
app.add_middleware(RequestSizeLimitMiddleware)

# Rate limiting middleware (防止DoS攻击)
app.add_middleware(RateLimitMiddleware, limiter=rate_limiter)

# 审计中间件（在 CORS 之后添加，确保审计所有请求）
app.add_middleware(AuditMiddleware)

# CORS 设置 (使用配置文件)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Specific methods only
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "User-Agent",
        "DNT",
        "Cache-Control",
        "X-Requested-With"
    ],  # Specific headers only
    max_age=600,  # Cache preflight requests for 10 minutes
)

# 挂载静态文件目录 (用于下载结果)
app.mount("/output", StaticFiles(directory="output"), name="output")

# 注册路由
app.include_router(health_router)  # 健康检查路由（无需认证）
app.include_router(auth_router)  # 认证路由（JWT）
app.include_router(api_router)
app.include_router(ws_router)
app.include_router(project_router)
app.include_router(audit_router)
app.include_router(preview_router)

@app.get("/")
async def root():
    return {"message": "Audit Intelligence v2 Backend is running"}
