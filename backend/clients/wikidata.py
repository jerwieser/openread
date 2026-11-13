"""Wikidata client: the titles of works in every language. The data is CC0.

Uses the SPARQL query service, which still answers when the entity API is busy. Everything else we
know about a work comes from Open Library.
"""

import http.client
import json
import re
import urllib.parse
import urllib.request
from collections.abc import Callable

from api.clients.openlibrary import USER_AGENT, Unavailable
from api.models.base import LANGUAGE_CODE
from api.services.languages import main_language as main

SPARQL = "https://query.wikidata.org/sparql"

# not real languages: "mul" is the label for every language without its own
NOT_LANGUAGES = {"mul", "und", "zxx"}


def query(text: str, timeout: float = 8) -> list[dict]:
    """Run a SPARQL query, sent as a form so long lists fit."""
    data = urllib.parse.urlencode({"query": text, "format": "json"}).encode()
    request = urllib.request.Request(
        SPARQL, data=data, headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"}
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.load(response)["results"]["bindings"]
    # OSError covers URLError and time-outs; the rest are cut-off or invalid answers
    except (OSError, http.client.HTTPException, json.JSONDecodeError, KeyError) as error:
        raise Unavailable(str(error)) from error


def _item(row: dict) -> str:
    return row["item"]["value"].rsplit("/", 1)[-1]


def item_of_ol_work(ol_id: str, run: Callable[[str], list[dict]] = query) -> str | None:
    """Return the item that names this Open Library work ("OL24767320W") in P648, if any. Wikidata
    knows some links that Open Library's own records lack.
    """
    if not re.fullmatch(r"OL\d+W", ol_id):
        return None
    rows = run(f'SELECT ?item WHERE {{ ?item wdt:P648 "{ol_id}" }} LIMIT 1')
    return _item(rows[0]) if rows else None


# file names that mark a picture as a cover or title page, in the languages of our books
COVERISH = re.compile(
    r"cover|title.?page|titelblad|titelseite|first.?edition|front|jacket|omslag|couverture|umschlag|portada|copertina",
    re.IGNORECASE,
)


def items_of_ol_works(ol_ids: list[str], run: Callable[[str], list[dict]] = query) -> dict[str, str]:
    """Return the items that name these Open Library works in P648, { ol_id: item }, 100 per query:
    item_of_ol_work for many at once.
    """
    ol_ids = [ol for ol in ol_ids if re.fullmatch(r"OL\d+W", ol)]
    found: dict[str, str] = {}
    for start in range(0, len(ol_ids), 100):
        values = " ".join(f'"{ol}"' for ol in ol_ids[start : start + 100])
        for row in run(f"SELECT ?item ?ol WHERE {{ VALUES ?ol {{ {values} }} ?item wdt:P648 ?ol }}"):
            found.setdefault(row["ol"]["value"], _item(row))
    return found


def cover_of(item: str, run: Callable[[str], list[dict]] = query) -> str | None:
    """Return a Wikimedia Commons cover of the work, 500 pixels wide.

    Prefers a picture of an edition (P18), which is nearly always a cover or title page. The work's
    own picture only counts if its file name says so: it's often the author or an illustration ("Bob
    Dylan in November 1963").
    """
    rows = run(
        f"SELECT ?image ?of WHERE {{ {{ wd:{item} wdt:P747 ?edition . ?edition wdt:P18 ?image BIND(1 AS ?of) }}"
        f" UNION {{ wd:{item} wdt:P18 ?image BIND(2 AS ?of) }} }}"
    )
    found = [(int(row["of"]["value"]), urllib.parse.unquote(row["image"]["value"].rsplit("/", 1)[-1])) for row in rows]
    editions = sorted(name for of, name in found if of == 1)
    named = [name for name in editions if COVERISH.search(name)]
    own = [name for of, name in found if of == 2 and COVERISH.search(name)]
    name = next(iter([*named, *editions, *own]), None)
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(name)}?width=500" if name else None


def labels(items: list[str], run: Callable[[str], list[dict]] = query) -> dict[str, dict[str, str]]:
    """Return each item's label per language: { item: { language: label } }, 100 items per query."""
    found: dict[str, dict[str, str]] = {}
    for start in range(0, len(items), 100):
        values = " ".join(f"wd:{item}" for item in items[start : start + 100])
        for row in run(f"SELECT ?item ?label WHERE {{ VALUES ?item {{ {values} }} ?item rdfs:label ?label }}"):
            language = row["label"].get("xml:lang", "").lower()
            # skip codes that aren't ours, like "be-x-old"
            if language and language not in NOT_LANGUAGES and re.fullmatch(LANGUAGE_CODE, language):
                found.setdefault(_item(row), {})[language] = row["label"]["value"]
    return found


def titles(items: list[str], run: Callable[[str], list[dict]] = query) -> dict[str, dict]:
    """Return each item's titles: { item: { language, titles: { language: title }, authors } }.

    authors is a list of (item, English name) pairs, like [("Q7243", "Leo Tolstoy")].

    The language comes from P407 (if several, the one with a P1476 title), else from the P1476
    title, reduced to the main language: "ru" for ru-petr1708. The original title is the label in
    that language, else the P1476 title, because P1476 is sometimes a translation, vandalism, old
    spelling or a whole title page ("Mare Liberum, sive de jure…").
    """
    found: dict[str, dict] = {}
    for start in range(0, len(items), 100):
        values = " ".join(f"wd:{item}" for item in items[start : start + 100])
        originals: dict[str, dict] = {}
        for row in run(
            f"SELECT ?item ?original ?written ?by ?author WHERE {{ VALUES ?item {{ {values} }} "
            "OPTIONAL { ?item wdt:P1476 ?original } "
            'OPTIONAL { ?item wdt:P50 ?by . ?by rdfs:label ?author FILTER(LANG(?author) = "en") } '
            "OPTIONAL { ?item wdt:P407 ?language . "
            "OPTIONAL { ?language wdt:P218 ?one } OPTIONAL { ?language wdt:P219 ?two } BIND(COALESCE(?one, ?two) AS ?written) } }"
        ):
            entry = originals.setdefault(_item(row), {"originals": [], "written": [], "authors": []})
            if "author" in row:
                author = (row["by"]["value"].rsplit("/", 1)[-1], row["author"]["value"])
                if author not in entry["authors"]:
                    entry["authors"].append(author)
            if "original" in row and row["original"].get("xml:lang"):
                pair = (main(row["original"]["xml:lang"]), row["original"]["value"])
                if pair not in entry["originals"]:
                    entry["originals"].append(pair)
            if "written" in row and main(row["written"]["value"]) not in entry["written"]:
                entry["written"].append(main(row["written"]["value"]))
        names_of = labels(items[start : start + 100], run)
        for item in set(originals) | set(names_of):
            entry = originals.get(item, {"originals": [], "written": [], "authors": []})
            names = names_of.get(item, {})
            given = dict(reversed(entry["originals"]))  # { language: its first P1476 title }
            if entry["written"]:
                language = next((w for w in entry["written"] if w in given), entry["written"][0])
            else:
                language = entry["originals"][0][0] if entry["originals"] else None
            # the original title, among the others
            if language and language not in names and given.get(language):
                names[language] = given[language]
            found[item] = {
                "language": language,
                "titles": names,
                "authors": entry["authors"],
            }
    return found
