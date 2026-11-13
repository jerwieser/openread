"""Accounts: signing up, logging in and out, confirming an email address and resetting a password.

Signing up logs you in, but the site only opens once you've confirmed your email address. Passwords
and email addresses change through a link in an email, never directly.
"""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import select

from api.clients.email import (
    send_email_change_email,
    send_email_change_notice,
    send_password_reset_email,
    send_verification_email,
)
from api.config import get_settings
from api.db import SessionDep
from api.deps import COOKIE_NAME, LoggedInUser
from api.models import (
    DirectMessage,
    EmailRequest,
    MeRead,
    Message,
    PasswordReset,
    Token,
    TokenRequest,
    User,
    UserRegister,
)
from api.rate_limit import limiter
from api.security import (
    create_access_token,
    create_token,
    decode_token,
    hash_password,
    password_fingerprint,
    verify_password,
)
from api.serialize import me_read
from api.utils import new_slug

router = APIRouter(prefix="/auth", tags=["auth"])

VERIFY_EMAIL_MINUTES = 60 * 24
RESET_PASSWORD_MINUTES = 60


def set_auth_cookie(response: Response, user: User) -> str:
    settings = get_settings()
    token = create_access_token(user.id)
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,  # not readable from JavaScript
        samesite="lax",  # not sent on cross-site POST/PATCH/DELETE (CSRF protection)
        secure=settings.is_production,  # HTTPS only in production
    )
    return token


def queue_verification_email(tasks: BackgroundTasks, user: User) -> None:
    # The email is in the token, so the link stops working if the email changes.
    token = create_token(user.id, "verify_email", VERIFY_EMAIL_MINUTES, email=user.email)
    link = f"{get_settings().fe_url}/verify-email?token={token}"
    tasks.add_task(send_verification_email, user.email, user.name, link)


def queue_email_change(tasks: BackgroundTasks, user: User, new_email: str) -> None:
    # The link goes to the new address, so it's only changed once they've shown they can read it.
    token = create_token(user.id, "verify_email", VERIFY_EMAIL_MINUTES, email=user.email, new_email=new_email)
    link = f"{get_settings().fe_url}/verify-email?token={token}&next=/account"
    tasks.add_task(send_email_change_email, new_email, user.name, link)
    if user.is_email_verified:
        tasks.add_task(send_email_change_notice, user.email, user.name, new_email)


def find_user_by_email(session: SessionDep, email: str) -> User | None:
    return session.exec(select(User).where(User.email == email.lower())).first()


def name_from_email(email: str) -> str:
    """A first name to show until the reader sets their own: "sam.test@…" → "Sam"."""
    first = email.split("@")[0].replace(".", " ").replace("_", " ").replace("-", " ").split()[0]
    return first.capitalize()


def welcome_message(user: User) -> str:
    return (
        f"Welcome to OpenRead, {user.name}!\n\n"
        "Put the books you're reading on your bookshelf, follow a reading track, and ask other readers "
        "when you get stuck in a book. Their messages will show up here."
    )


@router.post("/register", response_model=MeRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
def register(
    request: Request, payload: UserRegister, response: Response, tasks: BackgroundTasks, session: SessionDep
) -> MeRead:
    email = payload.email.lower()
    if find_user_by_email(session, email):
        raise HTTPException(status.HTTP_409_CONFLICT, "There's already an account for that email address.")
    name = payload.name or name_from_email(email)
    user = User(handle=new_slug(name), email=email, name=name, hashed_password=hash_password(payload.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    session.add(DirectMessage(recipient_id=user.id, body=welcome_message(user)))
    session.commit()
    queue_verification_email(tasks, user)
    set_auth_cookie(response, user)
    return me_read(user)


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(
    request: Request,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    response: Response,
    session: SessionDep,
) -> Token:
    # OAuth2's standard form calls the field "username"; we use the email.
    user = find_user_by_email(session, form.username)
    if not verify_password(form.password, user.hashed_password if user else None):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    return Token(access_token=set_auth_cookie(response, user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME)


@router.get("/me", response_model=MeRead)
def me(user: LoggedInUser) -> MeRead:
    return me_read(user)


# Email verification


@router.post("/verify-email", response_model=MeRead)
@limiter.limit("10/minute")
def verify_email(request: Request, payload: TokenRequest, response: Response, session: SessionDep) -> MeRead:
    claims = decode_token(payload.token, "verify_email")
    user = session.get(User, claims["sub"]) if claims else None
    if user is None or user.email != claims["email"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This link is invalid or has expired.")
    if new_email := claims.get("new_email"):
        if find_user_by_email(session, new_email):
            raise HTTPException(status.HTTP_409_CONFLICT, "There's already an account for that email address.")
        user.email = new_email
    user.is_email_verified = True
    session.add(user)
    session.commit()
    session.refresh(user)
    set_auth_cookie(response, user)  # confirming the email also logs you in
    return me_read(user)


@router.post("/resend-verification", response_model=Message, status_code=202)
@limiter.limit("5/hour")
def resend_verification(request: Request, user: LoggedInUser, tasks: BackgroundTasks) -> Message:
    if not user.is_email_verified:
        queue_verification_email(tasks, user)
    return Message(detail=f"We sent the link to {user.email} again.")


@router.post("/change-email", response_model=Message, status_code=202)
@limiter.limit("5/hour")
def change_email(
    request: Request, payload: EmailRequest, user: LoggedInUser, tasks: BackgroundTasks, session: SessionDep
) -> Message:
    email = payload.email.lower()
    if email == user.email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That's already your email address.")
    if find_user_by_email(session, email):
        raise HTTPException(status.HTTP_409_CONFLICT, "There's already an account for that email address.")
    queue_email_change(tasks, user, email)
    return Message(detail=f"We sent a link to {email}.")


# Password reset


@router.post("/forgot-password", response_model=Message, status_code=202)
@limiter.limit("5/hour")
def forgot_password(request: Request, payload: EmailRequest, tasks: BackgroundTasks, session: SessionDep) -> Message:
    user = find_user_by_email(session, payload.email)
    if user:
        token = create_token(
            user.id, "reset_password", RESET_PASSWORD_MINUTES, pwd=password_fingerprint(user.hashed_password)
        )
        link = f"{get_settings().fe_url}/reset-password?token={token}"
        tasks.add_task(send_password_reset_email, user.email, user.name, link)
    # Same answer either way, so this can't be used to find out who has an account.
    return Message(detail="If an account exists for that email, we've sent a reset link.")


@router.post("/reset-password", response_model=MeRead)
@limiter.limit("10/minute")
def reset_password(request: Request, payload: PasswordReset, response: Response, session: SessionDep) -> MeRead:
    claims = decode_token(payload.token, "reset_password")
    user = session.get(User, claims["sub"]) if claims else None
    # The fingerprint no longer matches once the password changed: single use.
    if user is None or claims["pwd"] != password_fingerprint(user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This link is invalid or has expired.")
    user.hashed_password = hash_password(payload.password)
    user.is_email_verified = True  # they proved they can read this inbox
    session.add(user)
    session.commit()
    session.refresh(user)
    set_auth_cookie(response, user)
    return me_read(user)
