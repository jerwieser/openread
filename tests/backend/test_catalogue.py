"""The public catalogue: works, searching, and readers' profiles."""

import pytest

from backend.clients.storage import delete_upload, store_picture
from backend.services.expressions import cover_edition, expression, set_cover

# a one-pixel JPEG, enough for the cover endpoint to recognise a picture
JPEG = bytes.fromhex(
    "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda00080001000100003f00fbffd9"
)


def slugs(response) -> list[str]:
    return [w["slug"] for w in response.json()]


def test_a_work_has_its_title_and_authors(client, make_work):
    make_work("Moby-Dick", "Herman Melville", year=1851)
    (work,) = client.get("/works").json()
    assert (work["slug"], work["title"], work["year"]) == ("moby-dick", "Moby-Dick", 1851)
    assert [a["name"] for a in work["authors"]] == ["Herman Melville"]


def test_filtering_by_difficulty(client, make_work):
    make_work("Easy", difficulty="approachable")
    make_work("Hard", difficulty="demanding")
    assert slugs(client.get("/works?difficulty=demanding")) == ["hard"]


def test_the_most_recently_added_first(client, make_work):
    make_work("Moby-Dick", year=1851)
    make_work("Zeik", "Herman Brusselmans", year=2014)
    make_work("Beowulf", "Anonymous", year=1000)
    assert slugs(client.get("/works?sort=added")) == ["beowulf", "zeik", "moby-dick"]


def test_searching_by_title_in_any_language(client, session, make_work):
    work = make_work("Crime and Punishment", "Fyodor Dostoevsky")
    expression(session, work, "nl").title = "Misdaad en straf"
    session.commit()
    assert slugs(client.get("/works?q=misdaad")) == [work.slug]


def test_a_stored_cover_can_be_drawn_into_a_post(client, session, make_work):
    work = make_work("Pride and Prejudice", "Jane Austen")
    set_cover(session, work, "https://example.com/pride.jpg")
    edition = cover_edition(session, work)
    edition.cover = store_picture(JPEG, "jpg", "book_covers")
    session.commit()
    response = client.get(f"/works/{work.slug}/cover")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert response.content == JPEG
    delete_upload(edition.cover)


def test_a_book_without_a_cover_has_none_to_draw(client, make_work):
    work = make_work()
    assert client.get(f"/works/{work.slug}/cover").status_code == 404


def test_a_cover_kept_on_this_machine_is_not_fetched(client, session, make_work):
    work = make_work("Local")
    set_cover(session, work, "http://127.0.0.1/secret.jpg")
    session.commit()
    assert client.get(f"/works/{work.slug}/cover").status_code == 404


def test_an_unknown_work_has_no_details(client):
    assert client.get("/works/no-such-book/expressions").status_code == 404


@pytest.mark.parametrize("path", ["/works?q=a%00b", "/works?offset=99999999999999999999"])
def test_a_value_postgres_cannot_take_is_refused_and_the_api_carries_on(client, make_work, path):
    make_work()
    response = client.get(path)
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)
    assert slugs(client.get("/works")) == ["moby-dick"]


def test_only_confirmed_readers_are_listed(client, make_user):
    confirmed = make_user("one@example.com", "Confirmed Reader")
    make_user("two@example.com", "Unconfirmed Reader", verified=False)
    assert [r["id"] for r in client.get("/readers").json()] == [confirmed.handle]


def test_a_profile_never_shows_an_email_address(client, reader):
    assert reader.email not in client.get("/readers").text
