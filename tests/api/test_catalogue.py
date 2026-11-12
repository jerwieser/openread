"""The public catalogue: works, searching, and readers' profiles."""

import pytest

from api.services.expressions import expression


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
