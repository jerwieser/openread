"""Books readers suggest, and the admins who review them."""

import pytest
from sqlmodel import select

from api.models import Work


def suggest(api, title="A New Book", author="Ann Author", **fields):
    return api.post("/suggestions", json={"title": title, "author": author, **fields})


@pytest.fixture
def admin_api(client_of, admin):
    return client_of(admin)


@pytest.fixture
def suggestion(api):
    return suggest(api, year=1999, url="https://example.com/book").json()


def work_of(session, slug):
    session.expire_all()
    return session.exec(select(Work).where(Work.slug == slug)).first()


def test_suggesting_a_book(api, reader):
    response = suggest(api, note="Worth reading")
    assert response.status_code == 201
    suggestion = response.json()
    assert (suggestion["status"], suggestion["note"]) == ("pending", "Worth reading")
    assert suggestion["name"] == reader.name


def test_a_book_in_the_catalogue_cannot_be_suggested(api, make_work):
    make_work("Moby-Dick", "Herman Melville", is_curated=True)
    assert suggest(api, "Moby-Dick", "Herman Melville").status_code == 409


def test_only_admins_decide(api, suggestion):
    assert api.patch(f"/suggestions/{suggestion['id']}", json={"status": "approved"}).status_code == 403


def test_approving_adds_the_book_to_the_catalogue(client, session, admin_api, suggestion):
    response = admin_api.patch(
        f"/suggestions/{suggestion['id']}", json={"status": "approved", "difficulty": "demanding"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "approved"
    assert response.json()["decidedAt"] is not None

    work = work_of(session, "a-new-book")
    assert (work.is_curated, work.source, work.difficulty, work.year) == (True, "suggestion", "demanding", 1999)
    assert response.json()["work"] == "a-new-book"

    (listed,) = client.get("/works?curated=true").json()
    assert listed["title"] == "A New Book"
    assert [a["name"] for a in listed["authors"]] == ["Ann Author"]


def test_rejecting_gives_a_reason_and_adds_nothing(session, admin_api, suggestion):
    response = admin_api.patch(f"/suggestions/{suggestion['id']}", json={"status": "rejected", "reason": "Not yet out"})
    assert (response.json()["status"], response.json()["reason"]) == ("rejected", "Not yet out")
    assert session.exec(select(Work)).all() == []
