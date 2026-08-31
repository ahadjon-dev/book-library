from fastapi import Request
from slowapi import Limiter


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Client IP is the first address in the chain
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


# Initialize Limiter using proxy-aware IP resolution
limiter = Limiter(key_func=get_client_ip)
