"""Request and response bodies of the auth routes."""

from pydantic import EmailStr
from sqlmodel import Field

from backend.models.base import ApiModel, Stripped


class UserRegister(ApiModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: Stripped | None = Field(default=None, max_length=100)


class Token(ApiModel):
    access_token: str
    token_type: str = "bearer"


class EmailRequest(ApiModel):
    email: EmailStr


class TokenRequest(ApiModel):
    token: str


class PasswordReset(ApiModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class Message(ApiModel):
    detail: str
