from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer

from api.db import SessionDep
from api.models import User
from api.security import decode_token

COOKIE_NAME = "access_token"

# The FE sends the token as an httpOnly cookie. The Authorization header is also
# accepted so the "Authorize" button in /docs works.
bearer_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_optional_user(
    request: Request,
    session: SessionDep,
    bearer_token: Annotated[str | None, Depends(bearer_scheme)],
) -> User | None:
    token = request.cookies.get(COOKIE_NAME) or bearer_token
    claims = decode_token(token, "access") if token else None
    return session.get(User, claims["sub"]) if claims else None


def get_logged_in_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


LoggedInUser = Annotated[User, Depends(get_logged_in_user)]


def get_current_user(user: LoggedInUser) -> User:
    """A reader who has confirmed their email address, which everything but that needs."""
    if not user.is_email_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Confirm your email address first.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_admin(user: CurrentUser) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can do this")
    return user


AdminUser = Annotated[User, Depends(require_admin)]
