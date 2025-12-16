"""
Health Check Routes - Monitoring and status endpoints
Provides health, readiness, and liveness checks for orchestration systems
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import os
import psutil

from app.core.user_database import get_db
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """
    Basic health check endpoint.
    Returns 200 OK if service is running.
    Used by load balancers and monitoring systems.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "Audit Intelligence v2",
        "version": "2.0"
    }


@router.get("/health/ready")
async def readiness_check(db: Session = Depends(get_db)):
    """
    Readiness check endpoint.
    Verifies that the service is ready to accept traffic.
    Checks database connectivity and critical dependencies.
    """
    checks = {
        "database": "unknown",
        "storage": "unknown"
    }
    
    # Check database connectivity
    try:
        # Simple query to verify DB connection
        # Use text() to explicitly declare textual SQL expression (required by SQLAlchemy 2.0+)
        db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        logger.error("readiness_check_database_failed", error=str(e))
        checks["database"] = "failed"
    
    # Check storage directory accessibility
    try:
        storage_path = settings.STORAGE_PATH
        if os.path.exists(storage_path) and os.access(storage_path, os.W_OK):
            checks["storage"] = "ok"
        else:
            checks["storage"] = "not_writable"
    except Exception as e:
        logger.error("readiness_check_storage_failed", error=str(e))
        checks["storage"] = "failed"
    
    # Determine overall readiness
    all_ok = all(status == "ok" for status in checks.values())
    
    return {
        "ready": all_ok,
        "checks": checks,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health/live")
async def liveness_check():
    """
    Liveness check endpoint.
    Indicates if the service is alive (not deadlocked).
    Should be very lightweight.
    """
    return {
        "alive": True,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health/metrics")
async def metrics_endpoint():
    """
    Basic metrics endpoint for monitoring.
    Returns system resource usage.
    Note: For production, consider using Prometheus with proper exporters.
    """
    try:
        # Get system metrics
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage(settings.STORAGE_PATH)
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "system": {
                "cpu_percent": cpu_percent,
                "memory": {
                    "total_mb": memory.total / (1024 * 1024),
                    "used_mb": memory.used / (1024 * 1024),
                    "percent": memory.percent
                },
                "disk": {
                    "total_gb": disk.total / (1024 * 1024 * 1024),
                    "used_gb": disk.used / (1024 * 1024 * 1024),
                    "percent": disk.percent
                }
            },
            "config": {
                "debug_mode": settings.DEBUG,
                "max_concurrent_tasks": settings.MAX_CONCURRENT_TASKS,
                "task_timeout_seconds": settings.TASK_TIMEOUT_SECONDS
            }
        }
    except Exception as e:
        logger.error("metrics_collection_failed", error=str(e))
        return {
            "error": "Metrics collection failed",
            "timestamp": datetime.utcnow().isoformat()
        }
