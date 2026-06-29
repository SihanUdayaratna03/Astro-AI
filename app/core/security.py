import logging
import jwt
from contextvars import ContextVar
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import re

logger = logging.getLogger("uvicorn")

current_tenant_id: ContextVar[str] = ContextVar("current_tenant_id", default="default")

def get_tenant_id() -> str:
    return current_tenant_id.get()

class MultiTenantSecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Allow preflight and public auth endpoints
        if request.method == "OPTIONS" or request.url.path in ["/api/login", "/api/register"]:
            return await call_next(request)

        # For protected routes, require Bearer token
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Missing or invalid Authorization header"})

        token = auth_header.split(" ")[1]
        
        try:
            from app.core.auth import SECRET_KEY, ALGORITHM
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            tenant_id = payload.get("tenant_id")
            if not tenant_id:
                raise ValueError("Missing tenant_id in token")
        except Exception as e:
            logger.warning(f"Invalid token: {e}")
            return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})

        # Sanitize tenant ID (alphanumeric and underscores only)
        tenant_id = re.sub(r'[^a-zA-Z0-9_]', '_', tenant_id)

        # Set the context variable
        token_ctx = current_tenant_id.set(tenant_id)
        request.state.tenant_id = tenant_id

        try:
            response = await call_next(request)
            return response
        finally:
            current_tenant_id.reset(token_ctx)
