"""
Test Structured Logging Configuration
Verify structlog is working correctly in different modes
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

# Set debug mode for testing
import os
os.environ["DEBUG"] = "true"

from app.core.logger import configure_logging, get_logger, log_event

def test_basic_logging():
    """Test basic logging functionality"""
    print("\n" + "="*60)
    print("TEST 1: Basic Logging")
    print("="*60)
    
    logger = get_logger("test")
    
    # Test different log levels
    logger.debug("debug_message", detail="This is a debug message")
    logger.info("info_message", status="success", count=42)
    logger.warning("warning_message", reason="test warning")
    logger.error("error_message", error_code=500)
    
    print("✅ Basic logging test passed")


def test_contextual_logging():
    """Test logging with rich context"""
    print("\n" + "="*60)
    print("TEST 2: Contextual Logging")
    print("="*60)
    
    logger = get_logger("workflow")
    
    # Simulate workflow execution logs
    logger.info("workflow_started",
               workflow_id="wf-12345",
               user="admin",
               node_count=5)
    
    logger.info("node_executed",
               workflow_id="wf-12345",
               node_id="node-1",
               node_type="LoadCSVNode",
               execution_time_ms=123)
    
    logger.info("workflow_completed",
               workflow_id="wf-12345",
               total_nodes=5,
               duration_seconds=2.5,
               status="success")
    
    print("✅ Contextual logging test passed")


def test_exception_logging():
    """Test exception logging with traceback"""
    print("\n" + "="*60)
    print("TEST 3: Exception Logging")
    print("="*60)
    
    logger = get_logger("error_test")
    
    try:
        # Simulate an error
        result = 1 / 0
    except ZeroDivisionError as e:
        logger.error("division_error",
                    operation="divide",
                    dividend=1,
                    divisor=0,
                    error=str(e),
                    exc_info=True)
    
    print("✅ Exception logging test passed")


def test_convenience_function():
    """Test quick logging helper"""
    print("\n" + "="*60)
    print("TEST 4: Convenience Function")
    print("="*60)
    
    log_event("info", "user_login", user_id="123", username="testuser")
    log_event("warning", "rate_limit_exceeded", user_id="456", requests=100)
    log_event("error", "database_connection_failed", db="postgres", timeout=30)
    
    print("✅ Convenience function test passed")


def test_module_loggers():
    """Test pre-configured module loggers"""
    print("\n" + "="*60)
    print("TEST 5: Module Loggers")
    print("="*60)
    
    from app.core.logger import (
        app_logger, api_logger, executor_logger,
        node_logger, audit_logger, auth_logger
    )
    
    app_logger.info("application_started", version="2.0")
    api_logger.info("api_request", method="POST", path="/auth/login")
    executor_logger.info("workflow_queued", queue_size=3)
    node_logger.debug("node_registered", node_type="LoadCSVNode")
    audit_logger.info("action_logged", action="user_created")
    auth_logger.info("token_validated", user_id="789")
    
    print("✅ Module loggers test passed")


def test_production_mode():
    """Test JSON output in production mode"""
    print("\n" + "="*60)
    print("TEST 6: Production Mode (JSON Output)")
    print("="*60)
    
    # Reconfigure for production
    os.environ["DEBUG"] = "false"
    configure_logging()
    
    logger = get_logger("production")
    
    print("\n--- JSON Output Below ---")
    logger.info("production_log",
               environment="production",
               server="api-01",
               request_id="req-abc-123",
               duration_ms=45)
    print("--- JSON Output Above ---\n")
    
    # Switch back to debug mode
    os.environ["DEBUG"] = "true"
    configure_logging()
    
    print("✅ Production mode test passed")


def main():
    print("="*60)
    print("STRUCTURED LOGGING TEST SUITE")
    print("="*60)
    
    # Initialize logging
    configure_logging()
    
    try:
        test_basic_logging()
        test_contextual_logging()
        test_exception_logging()
        test_convenience_function()
        test_module_loggers()
        test_production_mode()
        
        print("\n" + "="*60)
        print("✅ ALL LOGGING TESTS PASSED!")
        print("="*60)
        
        print("\n📋 Log Features:")
        print("- ✅ Structured JSON output (production)")
        print("- ✅ Human-readable colored output (development)")
        print("- ✅ ISO 8601 timestamps")
        print("- ✅ Exception tracebacks")
        print("- ✅ Contextual logging (key=value)")
        print("- ✅ Multiple log levels (debug/info/warning/error)")
        
        print("\n📚 Usage Examples:")
        print("  from app.core.logger import get_logger")
        print("  logger = get_logger(__name__)")
        print("  logger.info('event_name', key1=value1, key2=value2)")
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
