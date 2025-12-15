from datetime import timedelta, datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User, Token
from app.core.user_database import authenticate_user
from app.core.security import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from app.core.login_attempts import get_login_tracker
from app.core.logger import get_logger

logger = get_logger(__name__)

class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.login_tracker = get_login_tracker()

    def login_user(self, username: str, password: str) -> Token:
        """
        Authenticate user and return JWT token.
        Handles account lockout logic.
        """
        # 1. Check lockout status
        is_locked, seconds_remaining = self.login_tracker.is_locked_out(username)
        if is_locked:
            logger.warning("login_blocked_lockout",
                          username=username,
                          seconds_remaining=seconds_remaining)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account locked. Try again in {seconds_remaining} seconds.",
                headers={"Retry-After": str(seconds_remaining)}
            )
        
        # 2. Authenticate
        user = authenticate_user(self.db, username, password)
        
        if not user:
            # Handle failed attempt
            should_lockout, remaining, lockout_secs = self.login_tracker.record_failed_attempt(username)
            
            if should_lockout:
                logger.warning("login_failed_account_locked",
                              username=username,
                              lockout_seconds=lockout_secs)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many failed attempts. Locked for {lockout_secs // 60} minutes.",
                    headers={"Retry-After": str(lockout_secs)}
                )
            else:
                logger.warning("login_failed",
                              username=username,
                              remaining=remaining)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid credentials. {remaining} attempts remaining.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        
        # 3. Successful login
        self.login_tracker.record_successful_attempt(username)
        
        # Update last login
        user.last_login = datetime.utcnow()
        self.db.commit()
        
        # Create token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username, "user_id": user.id},
            expires_delta=access_token_expires
        )
        
        logger.info("user_logged_in", user_id=user.id, username=user.username)
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
