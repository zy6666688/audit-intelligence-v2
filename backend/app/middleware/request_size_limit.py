"""
Request Size Limit Middleware - Prevent large payload DoS attacks
"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware to limit request body size to prevent DoS attacks.
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.max_size = settings.MAX_REQUEST_SIZE
    
    async def dispatch(self, request: Request, call_next):
        """Check request body size before processing"""
        
        # Get Content-Length header
        content_length = request.headers.get("content-length")
        
        if content_length:
            content_length = int(content_length)
            
            # Check if request body exceeds limit
            if content_length > self.max_size:
                raise HTTPException(
                    status_code=413,
                    detail=f"Request body too large. Maximum size: {self.max_size / (1024*1024):.1f}MB"
                )
        
        return await call_next(request)
