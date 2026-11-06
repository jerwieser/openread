"""Essays readers write about books: drafts, publishing, and who can change them."""

import pytest


@pytest.fixture
def book(make_work):
    return make_work()


def write(api, book, title="On whales", text="  A long book. ", status="draft"):
    return api.post("/reflections", json={"workSlug": book.slug, "title": title, "text": text, "status": status})


def test_writing_a_reflection(api, reader, book):
    response = write(api, book)
    assert response.status_code == 201
    reflection = response.json()
    assert reflection["workSlug"] == book.slug
    assert reflection["text"] == "A long book."
    assert reflection["status"] == "draft"
    assert (reflection["author"], reflection["reader"]) == (reader.name, reader.handle)


def test_a_draft_is_only_for_its_author(client, api, book):
    write(api, book)
    assert client.get("/reflections").json() == []
    assert len(api.get("/me/reflections").json()) == 1


def test_a_published_reflection_is_public(client, api, book):
    write(api, book, status="published")
    assert [r["title"] for r in client.get("/reflections").json()] == ["On whales"]


def test_another_readers_reflection_cannot_be_touched(api, book, make_user, client_of):
    reflection = write(api, book, status="published").json()
    other = client_of(make_user("other@example.com"))
    payload = {"workSlug": book.slug, "title": "Mine now", "text": "Mine", "status": "published"}
    assert other.put(f"/reflections/{reflection['id']}", json=payload).status_code == 404
    assert other.delete(f"/reflections/{reflection['id']}").status_code == 404
