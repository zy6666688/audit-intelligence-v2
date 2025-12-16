from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os


class Settings(BaseSettings):
    """
    Centralized configuration management using pydantic-settings.
    Reads from environment variables and .env file.
    """
    
    # API Configuration
    API_BASE_URL: str = "http://localhost:8000"
    
    # Storage Configuration
    STORAGE_PATH: str = "./storage"
    DATA_RETENTION_DAYS: int = 7
    
    # Concurrency Configuration
    MAX_CONCURRENT_TASKS: int = 4
    TASK_TIMEOUT_SECONDS: int = 300
    
    # Request Limits (防止DoS攻击)
    MAX_REQUEST_SIZE: int = 10 * 1024 * 1024  # 10MB max request body size
    REQUEST_TIMEOUT_SECONDS: int = 60  # Maximum request processing time
    
    # Security Configuration
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]
    JWT_SECRET: str = "CHANGE_THIS_IN_PRODUCTION"  # CRITICAL: Must be set via environment variable
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60
    
    # Development/Production Mode
    # 默认在开发环境启用DEBUG模式（可以通过环境变量覆盖）
    DEBUG: bool = os.getenv("DEBUG", "true").lower() in ("true", "1", "yes")
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Security check: Warn if using default JWT secret
        if self.JWT_SECRET == "CHANGE_THIS_IN_PRODUCTION":
            import warnings
            warnings.warn(
                "⚠️  SECURITY WARNING: Using default JWT_SECRET! "
                "Set JWT_SECRET environment variable in production!",
                UserWarning
            )
        
        # Ensure storage directories exist
        os.makedirs(self.STORAGE_PATH, exist_ok=True)
        os.makedirs(os.path.join(self.STORAGE_PATH, "cache"), exist_ok=True)
        os.makedirs(os.path.join(self.STORAGE_PATH, "projects"), exist_ok=True)
        os.makedirs("output", exist_ok=True)


# Global settings instance
settings = Settings()
