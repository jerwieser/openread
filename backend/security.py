"""Password hashing and signed tokens, as recommended by the FastAPI docs (pwdlib + PyJWT).

All tokens are JWTs with a "purpose" claim, so e.g. a password reset token can
never be used as a login token.
"""

import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from pwdlib import PasswordHash

from backend.config import get_settings

ALGORITHM = "HS256"
password_hash = PasswordHash.recommended()  # Argon2

# Verified against when the email doesn't exist, so a failed login takes the
# same time whether or not the account exists.
DUMMY_HASH = password_hash.hash("dummy-password")

Purpose = Literal["access", "verify_email", "reset_password"]


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str | None) -> bool:
    if hashed is None:
        password_hash.verify(password, DUMMY_HASH)
        return False
    return password_hash.verify(password, hashed)


def password_fingerprint(hashed: str | None) -> str:
    """Return a short digest of the password hash, put in reset tokens so they stop working once it
    changes.
    """
    return hashlib.sha256((hashed or "").encode()).hexdigest()[:16]


def create_token(user_id: int, purpose: Purpose, minutes: int, **claims: Any) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=minutes)
    payload = {"sub": str(user_id), "purpose": purpose, "exp": expire, **claims}
    return jwt.encode(payload, get_settings().secret_key, ALGORITHM)


def decode_token(token: str, purpose: Purpose) -> dict[str, Any] | None:
    """Return the token's claims if it's valid, unexpired and for this purpose."""
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=[ALGORITHM])
        payload["sub"] = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        return None
    return payload if payload.get("purpose") == purpose else None


def create_access_token(user_id: int) -> str:
    return create_token(user_id, "access", get_settings().access_token_expire_minutes)
