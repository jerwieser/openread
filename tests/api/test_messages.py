"""Messages between readers, and the welcome message nobody can answer."""

import pytest
from fastapi.testclient import TestClient

from backend.models import DirectMessage, User


@pytest.fixture
def other(make_user) -> User:
    return make_user("other@example.com", "Olive Other")


@pytest.fixture
def other_api(client_of, other) -> TestClient:
    return client_of(other)


@pytest.fixture
def from_openread(session, reader):
    message = DirectMessage(recipient_id=reader.id, body="Welcome")
    session.add(message)
    session.commit()
    return message


def test_sending_a_message(api, reader, other):
    response = api.post("/messages", json={"to": other.handle, "text": "  Hello  "})
    assert response.status_code == 201
    message = response.json()
    assert (message["from"], message["to"], message["text"]) == (reader.handle, other.handle, "Hello")
    assert message["readAt"] is None


def test_a_message_of_only_spaces_is_refused(api, other):
    assert api.post("/messages", json={"to": other.handle, "text": "   "}).status_code == 422


def test_reading_marks_only_what_the_other_reader_sent(api, reader, other, other_api):
    api.post("/messages", json={"to": other.handle, "text": "Mine"})
    other_api.post("/messages", json={"to": reader.handle, "text": "Theirs"})

    assert api.post("/me/messages/read", json={"other": other.handle}).status_code == 204

    read = {m["text"]: m["readAt"] for m in api.get("/me/messages").json()}
    assert read["Theirs"] is not None
    assert read["Mine"] is None


def test_openread_cannot_be_answered(api, from_openread):
    assert api.post("/messages", json={"to": "openread", "text": "Thanks!"}).status_code == 404
