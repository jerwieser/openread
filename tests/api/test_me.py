"""The reader's own things: their profile, account, statuses and the tracks they keep."""

import pytest
from sqlmodel import select

from backend.models import Reading, Track, User


def statuses(api) -> dict[str, str]:
    return api.get("/me/statuses").json()


def follow_of(api, track) -> dict | None:
    return next((f for f in api.get("/me/follows").json() if f["track"] == track.slug), None)


@pytest.fixture
def books(make_work):
    return [make_work(f"Book {n}", f"Author {n}") for n in (1, 2, 3)]


@pytest.fixture
def track(make_track, books):
    return make_track("Whales", books)


def test_changing_the_profile(api):
    changes = {"name": "Samuel", "tagline": "Slow reader", "location": "Leiden", "bio": "Hello", "fields": ["History"]}
    me = api.patch("/me", json=changes).json()
    assert {key: me[key] for key in changes} == changes


def test_something_that_is_no_site_language_is_refused(api):
    assert api.patch("/me", json={"siteLanguage": "NOT VALID"}).status_code == 422


def test_deleting_an_account_removes_everything_of_theirs(session, reader, api, make_work, make_track):
    work = make_work()
    track = make_track("Mine", [work], owner_id=reader.id)
    reader_id, track_id = reader.id, track.id
    api.put(f"/me/statuses/{work.slug}", json={"status": "finished"})

    assert api.delete("/me").status_code == 204

    session.expire_all()
    assert session.get(User, reader_id) is None
    assert session.get(Track, track_id) is None
    assert session.exec(select(Reading)).all() == []
    assert api.get("/auth/me").status_code == 401


def test_setting_and_changing_a_status(api, make_work):
    work = make_work()
    assert api.put(f"/me/statuses/{work.slug}", json={"status": "want"}).json() == {work.slug: "want"}
    assert api.put(f"/me/statuses/{work.slug}", json={"status": "reading"}).json() == {work.slug: "reading"}


def test_following_puts_the_first_book_on_want_to_read(api, track, books):
    follows = api.put(f"/me/follows/{track.slug}", json={"state": "following"}).json()
    assert follows[0]["startedAt"] is not None
    assert statuses(api) == {books[0].slug: "want"}


def test_finishing_a_book_puts_the_next_on_want_to_read(api, track, books):
    api.put(f"/me/follows/{track.slug}", json={"state": "following"})
    result = api.put(f"/me/statuses/{books[0].slug}", json={"status": "finished"}).json()
    assert result == {books[0].slug: "finished", books[1].slug: "want"}


def test_finishing_the_last_book_completes_the_track(api, track, books):
    api.put(f"/me/follows/{track.slug}", json={"state": "following"})
    for book in books:
        api.put(f"/me/statuses/{book.slug}", json={"status": "finished"})
    follow = follow_of(api, track)
    assert follow["state"] == "completed"
    assert follow["completedAt"] is not None


def test_skipping_a_book_brings_up_the_next(api, track, books):
    api.put(f"/me/follows/{track.slug}", json={"state": "following"})
    follows = api.put(f"/me/follows/{track.slug}/skips/{books[0].slug}", json={"reason": "no-copy"}).json()
    assert follows[0]["skips"] == [books[0].slug]
    assert statuses(api) == {books[1].slug: "want"}
