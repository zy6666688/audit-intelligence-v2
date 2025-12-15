"""
Simple Built-in Rate Limiting - Protect against DoS attacks
No external dependencies required
"""
from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
from datetime import datetime, timedelta
import time
from typing import Dict, Tuple
from app.core.config import settings

class SimpleRateLimiter:
    """
    Simple in-memory rate limiter using token bucket algorithm.
    For production, consider using Redis-based rate limiting.
    """
    
    def __init__(self):
        # Store: {ip_address: {endpoint: (tokens, last_update_time)}}
        self.buckets: Dict[str, Dict[str, Tuple[float, float]]] = defaultdict(dict)
        self.cleanup_interval = 300  # Clean up old entries every 5 minutes
        self.last_cleanup = time.time()
    
    def _cleanup_old_entries(self):
        """Remove old entries to prevent memory leak"""
        current_time = time.time()
        if current_time - self.last_cleanup > self.cleanup_interval:
            # Remove entries older than 1 hour
            cutoff_time = current_time - 3600
            for ip in list(self.buckets.keys()):
                for endpoint in list(self.buckets[ip].keys()):
                    if self.buckets[ip][endpoint][1] < cutoff_time:
                        del self.buckets[ip][endpoint]
                if not self.buckets[ip]:
                    del self.buckets[ip]
            self.last_cleanup = current_time
    
    def check_rate_limit(
        self,
        ip_address: str,
        endpoint: str,
        max_requests: int,
        window_seconds: int
    ) -> Tuple[bool, int]:
        """
        Check if request is within rate limit using token bucket.
        
        Args:
            ip_address: Client IP address
            endpoint: API endpoint path
            max_requests: Maximum requests allowed in window
            window_seconds: Time window in seconds
            
        Returns:
            Tuple of (is_allowed, retry_after_seconds)
        """
        self._cleanup_old_entries()
        
        current_time = time.time()
        refill_rate = max_requests / window_seconds
        
        # Get or create bucket for this IP and endpoint
        if endpoint not in self.buckets[ip_address]:
            self.buckets[ip_address][endpoint] = (max_requests, current_time)
        
        tokens, last_update = self.buckets[ip_address][endpoint]
        
        # Calculate tokens to add based on time passed
        time_passed = current_time - last_update
        new_tokens = min(max_requests, tokens + (time_passed * refill_rate))
        
        # Check if request is allowed
        if new_tokens >= 1.0:
            # Allow request and consume 1 token
            self.buckets[ip_address][endpoint] = (new_tokens - 1.0, current_time)
            return (True, 0)
        else:
            # Deny request and calculate retry after
            retry_after = int((1.0 - new_tokens) / refill_rate)
            return (False, retry_after)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware to apply rate limiting to all requests.
    """
    
    def __init__(self, app, limiter: SimpleRateLimiter):
        super().__init__(app)
        self.limiter = limiter
        
        # Rate limit rules: {path_pattern: (max_requests, window_seconds)}
        self.rules = {
            "/auth/login": (10, 60),  # 10 requests per minute
            "/auth/register": (5, 60),  # 5 requests per minute
            "/auth/refresh": (30, 60),  # 30 refresh requests per minute (more lenient to avoid blocking legitimate refresh)
            "/projects/*/upload": (20, 3600),  # 20 uploads per hour
            "/projects/*/execute": (30, 3600),  # 30 executions per hour
            "/prompt": (30, 3600),  # 30 executions per hour
        }
        
        # Default rate limit for all other endpoints
        self.default_limit = (100, 60)  # 100 requests per minute
    
    async def dispatch(self, request: Request, call_next):
        """Apply rate limiting to requests"""
        
        # Skip rate limiting in debug mode
        if settings.DEBUG:
            return await call_next(request)
        
        # Get client IP
        ip_address = request.client.host if request.client else "unknown"
        
        # Get endpoint path
        path = request.url.path
        
        # Find matching rule
        max_requests, window_seconds = self.default_limit
        for pattern, limit in self.rules.items():
            # Simple pattern matching (can be improved with regex)
            if pattern in path or self._match_pattern(pattern, path):
                max_requests, window_seconds = limit
                break
        
        # #region agent log
        try:
            import json
            import os
            log_path = r'd:\审计数智析v2\.cursor\debug.log'
            with open(log_path, 'a', encoding='utf-8') as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"auth-fix","hypothesisId":"A","location":"rate_limiter.py:128","message":"Checking rate limit","data":{"ip":ip_address,"path":path,"max_requests":max_requests,"window_seconds":window_seconds},"timestamp":int(__import__('time').time()*1000)}) + '\n')
        except: pass
        # #endregion
        
        # Check rate limit
        is_allowed, retry_after = self.limiter.check_rate_limit(
            ip_address, path, max_requests, window_seconds
        )
        
        # #region agent log
        try:
            with open(log_path, 'a', encoding='utf-8') as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"auth-fix","hypothesisId":"A","location":"rate_limiter.py:135","message":"Rate limit check result","data":{"is_allowed":is_allowed,"retry_after":retry_after},"timestamp":int(__import__('time').time()*1000)}) + '\n')
        except: pass
        # #endregion
        
        if not is_allowed:
            # #region agent log
            try:
                with open(log_path, 'a', encoding='utf-8') as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"auth-fix","hypothesisId":"A","location":"rate_limiter.py:140","message":"Rate limit exceeded","data":{"ip":ip_address,"path":path,"retry_after":retry_after},"timestamp":int(__import__('time').time()*1000)}) + '\n')
            except: pass
            # #endregion
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Retry after {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)}
            )
        
        return await call_next(request)
    
    def _match_pattern(self, pattern: str, path: str) -> bool:
        """Simple pattern matching with * wildcard"""
        pattern_parts = pattern.split("*")
        if len(pattern_parts) == 1:
            return pattern == path
        
        # Check if path starts with first part and ends with last part
        if not path.startswith(pattern_parts[0]):
            return False
        if not path.endswith(pattern_parts[-1]):
            return False
        return True


# Global rate limiter instance
rate_limiter = SimpleRateLimiter()


def get_rate_limiter() -> SimpleRateLimiter:
    """Get the global rate limiter instance"""
    return rate_limiter
