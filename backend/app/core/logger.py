"""
Structured Logging Configuration with structlog
Provides JSON-formatted logs for production observability
"""

import structlog
import logging
import sys
from typing import Any
from app.core.config import settings


def configure_logging():
    """
    Configure structlog for structured JSON logging.
    
    Features:
    - JSON output for production
    - Human-readable output for development
    - Timestamp in ISO 8601 format
    - Log level filtering
    - Exception formatting with stack traces
    """
    
    # Determine if running in debug mode
    debug_mode = settings.DEBUG
    
    # Shared processors for all loggers
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]
    
    if debug_mode:
        # Development: human-readable colored output
        structlog.configure(
            processors=shared_processors + [
                structlog.dev.ConsoleRenderer()
            ],
            wrapper_class=structlog.stdlib.BoundLogger,
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            cache_logger_on_first_use=True,
        )
    else:
        # Production: JSON output for parsing
        structlog.configure(
            processors=shared_processors + [
                structlog.processors.dict_tracebacks,
                structlog.processors.JSONRenderer()
            ],
            wrapper_class=structlog.stdlib.BoundLogger,
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            cache_logger_on_first_use=True,
        )
    
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.DEBUG if debug_mode else logging.INFO,
    )
    
    # Suppress StatReload warnings from uvicorn (when watchfiles is not installed)
    # This filter will suppress WARNING messages from uvicorn.error logger about StatReload
    class StatReloadFilter(logging.Filter):
        """Filter to suppress StatReload detection warnings"""
        def filter(self, record):
            # Suppress warnings about StatReload detecting changes
            if "StatReload detected changes" in record.getMessage():
                return False
            return True
    
    # Apply filter to uvicorn.error logger
    uvicorn_logger = logging.getLogger("uvicorn.error")
    uvicorn_logger.addFilter(StatReloadFilter())


def get_logger(name: str = None) -> structlog.stdlib.BoundLogger:
    """
    Get a structured logger instance.
    
    Args:
        name: Logger name (typically __name__ of the module)
        
    Returns:
        Configured structlog logger
        
    Example:
        >>> logger = get_logger(__name__)
        >>> logger.info("user_login", user_id="123", username="admin")
        >>> logger.error("database_error", table="users", error=str(e))
    """
    return structlog.get_logger(name)


# Convenience function for quick logging
def log_event(
    level: str,
    event: str,
    **kwargs: Any
) -> None:
    """
    Quick logging helper for one-off events.
    
    Args:
        level: Log level ("debug", "info", "warning", "error", "critical")
        event: Event description
        **kwargs: Additional context fields
        
    Example:
        >>> log_event("info", "workflow_started", workflow_id="abc", user="admin")
        >>> log_event("error", "node_failed", node_id="xyz", error="Division by zero")
    """
    logger = get_logger()
    log_method = getattr(logger, level.lower())
    log_method(event, **kwargs)


# Pre-configured loggers for common modules
app_logger = get_logger("app")
api_logger = get_logger("api")
executor_logger = get_logger("executor")
node_logger = get_logger("nodes")
audit_logger = get_logger("audit")
auth_logger = get_logger("auth")
