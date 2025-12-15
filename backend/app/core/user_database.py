"""
User Database Management
Handles SQLAlchemy engine creation and user CRUD operations
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Optional
from app.models.user import Base, User, UserCreate, UserUpdate
from app.core.security import get_password_hash, verify_password
from app.core.config import settings
from app.core.logger import get_logger
import os

logger = get_logger(__name__)

# Database file path
DB_PATH = os.path.join(settings.STORAGE_PATH, "users.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite specific
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
    logger.info("user_database_initialized", db_path=DB_PATH)


def get_db():
    """
    Dependency for getting database session.
    Use with FastAPI Depends.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# User CRUD operations
def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Get user by username"""
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Get user by email"""
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    """Get user by ID"""
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user: UserCreate) -> User:
    """
    Create a new user with hashed password.
    
    Args:
        db: Database session
        user: UserCreate schema with plain password
        
    Returns:
        Created User object
        
    Raises:
        ValueError: If username or email already exists
    """
    # Check if user already exists
    if get_user_by_username(db, user.username):
        raise ValueError(f"Username '{user.username}' already exists")
    
    if get_user_by_email(db, user.email):
        raise ValueError(f"Email '{user.email}' already registered")
    
    # Create user with hashed password
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=get_password_hash(user.password),
        full_name=user.full_name
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """
    Authenticate user with username and password.
    
    Args:
        db: Database session
        username: Username
        password: Plain text password
        
    Returns:
        User object if authentication successful, None otherwise
    """
    user = get_user_by_username(db, username)
    
    if not user:
        return None
    
    if not verify_password(password, user.hashed_password):
        return None
    
    if not user.is_active:
        return None
    
    return user


def update_user(db: Session, user_id: str, user_update: UserUpdate) -> Optional[User]:
    """
    Update user information.
    
    Args:
        db: Database session
        user_id: User ID
        user_update: UserUpdate schema with fields to update
        
    Returns:
        Updated User object or None if not found
    """
    user = get_user_by_id(db, user_id)
    
    if not user:
        return None
    
    # Update fields
    if user_update.email is not None:
        user.email = user_update.email
    
    if user_update.full_name is not None:
        user.full_name = user_update.full_name
    
    if user_update.password is not None:
        user.hashed_password = get_password_hash(user_update.password)
    
    if user_update.is_active is not None:
        user.is_active = user_update.is_active
    
    db.commit()
    db.refresh(user)
    
    return user


def delete_user(db: Session, user_id: str) -> bool:
    """
    Delete user by ID.
    
    Args:
        db: Database session
        user_id: User ID
        
    Returns:
        True if deleted, False if not found
    """
    user = get_user_by_id(db, user_id)
    
    if not user:
        return False
    
    db.delete(user)
    db.commit()
    
    return True


def create_default_admin(db: Session):
    """
    Create default admin user if no users exist.
    Should be called on application startup.
    """
    # Check if any users exist
    user_count = db.query(User).count()
    
    if user_count == 0:
        admin_user = User(
            username="admin",
            email="admin@example.com",
            hashed_password=get_password_hash("0000"),
            full_name="System Administrator",
            is_superuser=True,
            is_active=True
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        logger.warning("default_admin_created",
                      username="admin",
                      password="0000",
                      message="⚠️  CHANGE THIS PASSWORD IMMEDIATELY!")
        
        return admin_user
    
    return None
