"""Sending messages between readers."""

from fastapi import APIRouter, HTTPException, status

from backend.db import SessionDep
from backend.deps import CurrentUser
from backend.models import DirectMessage, MessageRead, MessageWrite
from backend.serialize import messages_read, reader_by_handle

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("", response_model=MessageRead, status_code=status.HTTP_201_CREATED)
def send_message(payload: MessageWrite, user: CurrentUser, session: SessionDep) -> MessageRead:
    to = reader_by_handle(session, payload.to)
    if to.id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't send a message to yourself.")
    message = DirectMessage(sender_id=user.id, recipient_id=to.id, body=payload.text)
    session.add(message)
    session.commit()
    session.refresh(message)
    return messages_read(session, [message])[0]
