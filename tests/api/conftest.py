"""What the tests share: a database of their own, a client, and ways to make readers and books.

They run on real Postgres, because the API uses its arrays and regular expressions, in a database
that's made afresh with the migrations on every run. Nothing goes online and no email is sent.
"""

import os
import re
import urllib.error
import urllib.request
from dataclasses import dataclass

os.environ["ENVIRONMENT"] = "local"
os.environ["POSTGRES_DB"] = "openread_test"

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlmodel import Session, SQLModel

from backend.config import get_settings
from backend.db import engine
from backend.main import app
from backend.models import Expression, Track, TrackStop, User, Work
from backend.rate_limit import limiter
from backend.security import create_access_token, hash_password
from backend.services.authors import set_authors
from backend.utils import new_slug, slugify


@dataclass
class Mail:
    to: str
    subject: str
    body: str

    @property
    def token(self) -> str:
        return re.search(r"token=([^\s&]+)", self.body).group(1)


@pytest.fixture(scope="session", autouse=True)
def database():
    name = get_settings().database_url.database
    assert name == "openread_test"
    server = create_engine(get_settings().database_url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with server.connect() as connection:
        connection.execute(text(f"DROP DATABASE IF EXISTS {name} WITH (FORCE)"))
        connection.execute(text(f"CREATE DATABASE {name}"))
    server.dispose()
    command.upgrade(Config("db/alembic.ini"), "head")
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def empty_tables(database):
    yield
    tables = ", ".join(f'"{table.name}"' for table in SQLModel.metadata.sorted_tables)
    with engine.begin() as connection:
        connection.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    """Anything that tries to go online finds Open Library and Wikidata not answering."""

    def refuse(*args, **kwargs):
        raise urllib.error.URLError("the tests don't go online")

    monkeypatch.setattr(urllib.request, "urlopen", refuse)


@pytest.fixture(autouse=True)
def mailbox(monkeypatch) -> list[Mail]:
    """The emails sent during a test, newest last."""
    sent = []
    monkeypatch.setattr("backend.clients.email.send_email", lambda to, subject, body: sent.append(Mail(to, subject, body)))
    return sent


@pytest.fixture(autouse=True)
def no_rate_limits(monkeypatch):
    monkeypatch.setattr(limiter, "enabled", False)


@pytest.fixture
def client() -> TestClient:
    """A visitor who isn't logged in."""
    return TestClient(app)


@pytest.fixture
def session(empty_tables):
    with Session(engine, expire_on_commit=False) as session:
        yield session


@pytest.fixture
def make_user(session):
    def make(
        email: str = "sam@example.com",
        name: str = "Sam Reader",
        password: str | None = None,
        verified: bool = True,
        role: str = "member",
    ) -> User:
        user = User(
            handle=new_slug(name),
            email=email,
            name=name,
            hashed_password=hash_password(password) if password else None,
            is_email_verified=verified,
            role=role,
        )
        session.add(user)
        session.commit()
        return user

    return make


@pytest.fixture
def client_of():
    """A client logged in as this reader."""

    def make(user: User) -> TestClient:
        return TestClient(app, headers={"Authorization": f"Bearer {create_access_token(user.id)}"})

    return make


@pytest.fixture
def reader(make_user) -> User:
    return make_user()


@pytest.fixture
def api(client_of, reader) -> TestClient:
    """The client of the reader above."""
    return client_of(reader)


@pytest.fixture
def admin(make_user) -> User:
    return make_user("admin@example.com", "Ada Admin", role="admin")


@pytest.fixture
def make_work(session):
    def make(title: str = "Moby-Dick", author: str = "Herman Melville", language: str = "en", **fields) -> Work:
        work = Work(slug=fields.pop("slug", slugify(title)), **fields)
        session.add(work)
        session.flush()
        session.add(Expression(work_id=work.id, language=language, title=title))
        set_authors(session, work, [author])
        session.commit()
        return work

    return make


@pytest.fixture
def make_track(session, make_work):
    def make(title: str = "Whales", works: list[Work] | None = None, **fields) -> Track:
        works = works if works is not None else [make_work(f"{title} book {n}", f"Author {n}") for n in (1, 2, 3)]
        track = Track(slug=fields.pop("slug", slugify(title)), title=title, **fields)
        session.add(track)
        session.flush()
        for position, work in enumerate(works):
            session.add(TrackStop(track_id=track.id, position=position, work_id=work.id))
        session.commit()
        return track

    return make
