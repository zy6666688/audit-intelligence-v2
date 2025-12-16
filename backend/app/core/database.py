from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
import os

# 数据库文件路径
DB_PATH = os.path.join(settings.STORAGE_PATH, "audit.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

# 创建引擎，配置连接池
# SQLite doesn't benefit from connection pooling like PostgreSQL/MySQL,
# but we configure it properly for potential future migration
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={
        "check_same_thread": False,  # SQLite 特定配置
        "timeout": 30  # 30 seconds lock timeout for SQLite
    },
    pool_size=5,  # Maximum number of connections to keep in pool
    max_overflow=10,  # Maximum number of connections to create beyond pool_size
    pool_timeout=30,  # Seconds to wait before giving up on getting a connection
    pool_recycle=3600,  # Recycle connections after 1 hour
    pool_pre_ping=True,  # Test connections before using (catches stale connections)
    echo=False  # Set to True for SQL query logging (debug only)
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 声明基类
Base = declarative_base()


def get_db():
    """
    依赖注入：获取数据库会话
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    初始化数据库（创建所有表）
    """
    Base.metadata.create_all(bind=engine)
    print(f"[Database] Initialized at {DB_PATH}")
