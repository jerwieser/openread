"""Messages between readers, plain text only, and from OpenRead itself."""

from datetime import datetime

from sqlalchemy import DateTime, Text
from sqlmodel import Field, SQLModel

from api.models.base import ApiModel, Stripped, created_at_field

# Who a message without a sender is from, in the API. Readers' handles always end in a suffix, so
# this can't be one of theirs.
OPENREAD = "openread"


class DirectMessage(SQLModel, table=True):
    """A message between two readers. Without a sender it's from OpenRead itself, like the welcome
    message, and can't be answered.
    """

    __tablename__ = "messages"

    id: int | None = Field(default=None, primary_key=True)
    sender_id: int | None = Field(default=None, foreign_key="users.id", ondelete="CASCADE", index=True)
    recipient_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    body: str = Field(sa_type=Text)
    created_at: datetime | None = created_at_field()
    read_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))


class MessageRead(ApiModel):
    id: int
    from_: str = Field(alias="from")
    to: str
    text: str
    created_at: datetime
    read_at: datetime | None


class MessageWrite(ApiModel):
    to: str
    text: Stripped = Field(min_length=1, max_length=2000)


class MarkRead(ApiModel):
    other: str
