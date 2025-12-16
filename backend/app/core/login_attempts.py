"""
Login Attempts Tracker - Prevent brute force attacks
Implements account lockout after failed login attempts
"""
from datetime import datetime, timedelta
from typing import Dict, Tuple
from collections import defaultdict
import time


class LoginAttemptsTracker:
    """
    Track failed login attempts and implement account lockout.
    In-memory implementation (consider Redis for production multi-instance deployment).
    """
    
    def __init__(
        self,
        max_attempts: int = 5,
        lockout_duration_minutes: int = 15,
        cleanup_interval_seconds: int = 300
    ):
        """
        Initialize the login attempts tracker.
        
        Args:
            max_attempts: Maximum failed attempts before lockout
            lockout_duration_minutes: How long to lock the account (minutes)
            cleanup_interval_seconds: Interval to clean up old entries
        """
        self.max_attempts = max_attempts
        self.lockout_duration = timedelta(minutes=lockout_duration_minutes)
        self.cleanup_interval = cleanup_interval_seconds
        
        # Store: {username: [(timestamp, success), ...]}
        self.attempts: Dict[str, list] = defaultdict(list)
        
        # Store: {username: lockout_until_timestamp}
        self.lockouts: Dict[str, float] = {}
        
        self.last_cleanup = time.time()
    
    def _cleanup_old_entries(self):
        """Remove old entries to prevent memory leak"""
        current_time = time.time()
        
        if current_time - self.last_cleanup > self.cleanup_interval:
            cutoff_time = current_time - (self.lockout_duration.total_seconds() * 2)
            
            # Clean up old attempts
            for username in list(self.attempts.keys()):
                self.attempts[username] = [
                    (ts, success) for ts, success in self.attempts[username]
                    if ts > cutoff_time
                ]
                if not self.attempts[username]:
                    del self.attempts[username]
            
            # Clean up expired lockouts
            for username in list(self.lockouts.keys()):
                if self.lockouts[username] < current_time:
                    del self.lockouts[username]
            
            self.last_cleanup = current_time
    
    def is_locked_out(self, username: str) -> Tuple[bool, int]:
        """
        Check if account is currently locked out.
        
        Args:
            username: Username to check
            
        Returns:
            Tuple of (is_locked, seconds_remaining)
        """
        self._cleanup_old_entries()
        
        if username in self.lockouts:
            lockout_until = self.lockouts[username]
            current_time = time.time()
            
            if current_time < lockout_until:
                seconds_remaining = int(lockout_until - current_time)
                return (True, seconds_remaining)
            else:
                # Lockout expired
                del self.lockouts[username]
                # Clear failed attempts
                if username in self.attempts:
                    del self.attempts[username]
        
        return (False, 0)
    
    def record_failed_attempt(self, username: str) -> Tuple[bool, int, int]:
        """
        Record a failed login attempt.
        
        Args:
            username: Username that failed to log in
            
        Returns:
            Tuple of (should_lockout, remaining_attempts, lockout_seconds)
        """
        self._cleanup_old_entries()
        
        current_time = time.time()
        cutoff_time = current_time - self.lockout_duration.total_seconds()
        
        # Add failed attempt
        self.attempts[username].append((current_time, False))
        
        # Count recent failed attempts
        recent_failures = sum(
            1 for ts, success in self.attempts[username]
            if ts > cutoff_time and not success
        )
        
        remaining_attempts = self.max_attempts - recent_failures
        
        # Check if should lockout
        if recent_failures >= self.max_attempts:
            lockout_until = current_time + self.lockout_duration.total_seconds()
            self.lockouts[username] = lockout_until
            lockout_seconds = int(self.lockout_duration.total_seconds())
            return (True, 0, lockout_seconds)
        
        return (False, max(0, remaining_attempts), 0)
    
    def record_successful_attempt(self, username: str):
        """
        Record a successful login attempt and clear any lockout.
        
        Args:
            username: Username that successfully logged in
        """
        # Clear lockout
        if username in self.lockouts:
            del self.lockouts[username]
        
        # Clear failed attempts
        if username in self.attempts:
            del self.attempts[username]
    
    def get_attempt_count(self, username: str) -> int:
        """
        Get the number of recent failed attempts for a username.
        
        Args:
            username: Username to check
            
        Returns:
            Number of recent failed attempts
        """
        if username not in self.attempts:
            return 0
        
        current_time = time.time()
        cutoff_time = current_time - self.lockout_duration.total_seconds()
        
        return sum(
            1 for ts, success in self.attempts[username]
            if ts > cutoff_time and not success
        )


# Global login attempts tracker instance
login_tracker = LoginAttemptsTracker(
    max_attempts=5,  # 5 failed attempts
    lockout_duration_minutes=15,  # 15 minute lockout
    cleanup_interval_seconds=300  # Cleanup every 5 minutes
)


def get_login_tracker() -> LoginAttemptsTracker:
    """Get the global login attempts tracker instance"""
    return login_tracker
