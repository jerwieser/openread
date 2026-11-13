"""Our reading tracks, and the ones readers make for themselves."""

import pytest


@pytest.fixture
def books(make_work):
    return [make_work(f"Book {n}", f"Author {n}") for n in (1, 2, 3)]


def own_track(api, books, title="My track"):
    payload = {"title": title, "description": "Mine", "slugs": [b.slug for b in books]}
    return api.post("/tracks", json=payload).json()


def test_our_tracks_are_listed_in_our_order(client, make_track):
    make_track("Second", position=2)
    make_track("First", position=1)
    assert [t["title"] for t in client.get("/tracks").json()] == ["First", "Second"]


def test_readers_own_tracks_are_not_listed(client, reader, make_track):
    make_track("Own", owner_id=reader.id)
    assert client.get("/tracks").json() == []


def test_making_a_track(api, books):
    track = own_track(api, books)
    assert track["title"] == "My track"
    assert track["slugs"] == [b.slug for b in books]
    assert api.get("/me/tracks").json() == [track]


def test_a_track_needs_a_title(api, books):
    assert api.post("/tracks", json={"title": "   ", "slugs": [books[0].slug]}).status_code == 422


def test_another_readers_track_cannot_be_touched(api, books, make_user, client_of):
    track = own_track(api, books)
    other = client_of(make_user("other@example.com"))
    payload = {"title": "Mine now", "slugs": [books[0].slug]}
    assert other.put(f"/tracks/{track['id']}", json=payload).status_code == 404
    assert other.delete(f"/tracks/{track['id']}").status_code == 404
    assert other.get("/me/tracks").json() == []
