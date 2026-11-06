"""Signing up, logging in, confirming an email address, changing it, and passwords."""

import pytest

from api.models import User
from api.security import create_token, verify_password

PASSWORD = "correct-horse"


def sign_up(client, email="new@example.com", password=PASSWORD):
    return client.post("/auth/register", json={"email": email, "password": password})


def stored(session, user: User) -> User:
    session.expire_all()
    return session.get(User, user.id)


NEEDS_A_CONFIRMED_ADDRESS = [
    ("GET", "/me/statuses", None),
    ("PATCH", "/me", {"name": "New name"}),
    ("POST", "/messages", {"to": "someone", "text": "Hello"}),
]


def test_signing_up_creates_an_unconfirmed_account_and_logs_in(client):
    response = sign_up(client)
    assert response.status_code == 201
    assert response.json()["emailVerified"] is False
    assert client.get("/auth/me").json()["email"] == "new@example.com"


def test_an_address_can_only_sign_up_once_whatever_its_case(client):
    sign_up(client)
    assert sign_up(client, "NEW@example.com").status_code == 409


def test_a_new_reader_gets_an_unread_welcome_message_from_openread(client, mailbox):
    sign_up(client)
    client.post("/auth/verify-email", json={"token": mailbox[0].token})
    (message,) = client.get("/me/messages").json()
    assert message["from"] == "openread"
    assert message["readAt"] is None
    assert message["text"].startswith("Welcome to OpenRead, New!")


def test_logging_in_sets_a_cookie_javascript_cannot_read(client, make_user):
    make_user(password=PASSWORD)
    response = client.post("/auth/login", data={"username": "sam@example.com", "password": PASSWORD})
    assert response.status_code == 200
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert client.get("/auth/me").json()["email"] == "sam@example.com"


@pytest.mark.parametrize("email, password", [("sam@example.com", "wrong-password"), ("nobody@example.com", PASSWORD)])
def test_logging_in_fails_the_same_way_for_a_wrong_password_and_an_unknown_address(client, make_user, email, password):
    make_user(password=PASSWORD)
    response = client.post("/auth/login", data={"username": email, "password": password})
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password."


@pytest.mark.parametrize("method, path, body", NEEDS_A_CONFIRMED_ADDRESS)
def test_an_unconfirmed_reader_cannot_use_the_app(make_user, client_of, method, path, body):
    response = client_of(make_user(verified=False)).request(method, path, json=body)
    assert response.status_code == 403
    assert response.json()["detail"] == "Confirm your email address first."


@pytest.mark.parametrize("method, path, body", NEEDS_A_CONFIRMED_ADDRESS)
def test_a_visitor_cannot_use_the_app(client, method, path, body):
    assert client.request(method, path, json=body).status_code == 401


def test_the_link_confirms_the_address_and_logs_in_on_any_device(client, session, make_user):
    user = make_user(verified=False)
    token = create_token(user.id, "verify_email", 60, email=user.email)
    response = client.post("/auth/verify-email", json={"token": token})
    assert response.status_code == 200
    assert response.json()["emailVerified"] is True
    assert stored(session, user).is_email_verified
    assert client.get("/me/statuses").status_code == 200


def test_the_address_only_changes_once_the_link_to_the_new_one_is_opened(client, session, reader, api, mailbox):
    assert api.post("/auth/change-email", json={"email": "New@Example.com"}).status_code == 202
    assert stored(session, reader).email == "sam@example.com"

    link = next(m for m in mailbox if m.subject == "Confirm your new email address")
    assert link.to == "new@example.com"
    assert "next=/account" in link.body

    assert client.post("/auth/verify-email", json={"token": link.token}).json()["email"] == "new@example.com"
    assert stored(session, reader).email == "new@example.com"


def test_the_emailed_link_sets_a_new_password_and_logs_in(client, session, make_user, mailbox):
    user = make_user(password=PASSWORD)
    assert client.post("/auth/forgot-password", json={"email": user.email}).status_code == 202
    assert verify_password(PASSWORD, stored(session, user).hashed_password)

    response = client.post("/auth/reset-password", json={"token": mailbox[0].token, "password": "a-new-password"})
    assert response.status_code == 200
    assert client.get("/auth/me").status_code == 200
    assert verify_password("a-new-password", stored(session, user).hashed_password)
    assert not verify_password(PASSWORD, stored(session, user).hashed_password)


def test_a_password_link_works_once(client, make_user, mailbox):
    user = make_user(password=PASSWORD)
    client.post("/auth/forgot-password", json={"email": user.email})
    token = mailbox[0].token
    assert client.post("/auth/reset-password", json={"token": token, "password": "a-new-password"}).status_code == 200
    assert client.post("/auth/reset-password", json={"token": token, "password": "another-one"}).status_code == 400


def test_asking_for_a_link_does_not_tell_who_has_an_account(client, make_user, mailbox):
    user = make_user()
    known = client.post("/auth/forgot-password", json={"email": user.email})
    unknown = client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
    assert (known.status_code, known.json()) == (unknown.status_code, unknown.json())
    assert [m.to for m in mailbox] == [user.email]
