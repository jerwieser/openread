"""Rate limiting with slowapi, per client IP. uvicorn's --proxy-headers gives the real IP behind the
Vite proxy and Azure's front end.
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from backend.config import get_settings


def client_ip(request: Request) -> str:
    # Azure App Service forwards the address with its port ("203.0.113.7:51234"), which would give
    # every connection its own limit
    address = get_remote_address(request)
    if address.startswith("[") and "]" in address:  # "[2001:db8::1]:51234"
        return address[1 : address.index("]")]
    host, colon, port = address.rpartition(":")
    return host if colon and port.isdigit() and ":" not in host else address


limiter = Limiter(key_func=client_ip, storage_uri=get_settings().rate_limit_storage_uri)


def rate_limit_exceeded(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    # Same {"detail": ...} shape as every other API error.
    return JSONResponse(
        {"detail": "Too many attempts. Please wait a minute and try again."},
        status_code=429,
    )
