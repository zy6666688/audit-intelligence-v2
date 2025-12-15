"""
Security utilities for JWT authentication and password hashing
Based on FastAPI best practices with python-jose and passlib
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

# Password hashing context
# Migrated to Argon2 (Winner of Password Hashing Competition)
# bcrypt is kept for backward compatibility but marked as deprecated
pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    deprecated=["bcrypt"],
    
    # Argon2 configuration (balanced for security/performance)
    argon2__time_cost=2,
    argon2__memory_cost=102400, # 100MB
    argon2__parallelism=8,
)

# JWT settings
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # 30 minutes default


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against its hash.
    
    Args:
        plain_password: Plain text password
        hashed_password: Bcrypt hashed password
        
    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Args:
        password: Plain text password
        
    Returns:
        Bcrypt hashed password
    """
    return pwd_context.hash(password)


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Payload data to encode (should include 'sub' claim)
        expires_delta: Token expiration time (defaults to 30 minutes)
        
    Returns:
        Encoded JWT token string
        
    Example:
        >>> token = create_access_token(data={"sub": "username"})
        >>> # Returns: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    """
    to_encode = data.copy()
    
    # Set expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    
    # Encode JWT
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET or "dev-secret-key-change-in-production",
        algorithm=ALGORITHM
    )
    
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and verify a JWT access token.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded payload dict if valid, None if invalid
        
    Example:
        >>> payload = decode_access_token(token)
        >>> if payload:
        >>>     username = payload.get("sub")
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET or "dev-secret-key-change-in-production",
            algorithms=[ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def create_refresh_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT refresh token (longer expiration).
    
    Args:
        data: Payload data to encode
        expires_delta: Token expiration time (defaults to 7 days)
        
    Returns:
        Encoded JWT refresh token
    """
    to_encode = data.copy()
    
    # Refresh tokens typically have longer expiration
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=7)
    
    to_encode.update({
        "exp": expire,
        "type": "refresh"  # Mark as refresh token
    })
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET or "dev-secret-key-change-in-production",
        algorithm=ALGORITHM
    )
    
    return encoded_jwt


def validate_token_type(payload: dict, expected_type: str = "access") -> bool:
    """
    Validate token type from payload.
    
    Args:
        payload: Decoded JWT payload
        expected_type: Expected token type ("access" or "refresh")
        
    Returns:
        True if token type matches, False otherwise
    """
    token_type = payload.get("type", "access")
    return token_type == expected_type
