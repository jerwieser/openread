"""Open Library client: searches and work records. The data is CC0.

Open Library asks for a User-Agent and not to be hammered, so searches are cached for ten minutes.
"""

import http.client
import json
import re
import time
import urllib.parse
import urllib.request

BASE = "https://openlibrary.org"
COVERS = "https://covers.openlibrary.org"
USER_AGENT = "OpenRead/1.0 (+https://github.com/jerwieser/openread)"


class Unavailable(Exception):
    """Open Library didn't answer, or not in time."""


def get_json(url: str, params: dict | None = None, timeout: float = 8) -> dict:
    full = url + (f"?{urllib.parse.urlencode(params)}" if params else "")
    request = urllib.request.Request(full, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.load(response)
    # OSError covers URLError and time-outs; the rest are cut-off or invalid answers
    except (OSError, http.client.HTTPException, json.JSONDecodeError) as error:
        raise Unavailable(str(error)) from error


def isbn13(value: str) -> str | None:
    """Convert an ISBN-10 or ISBN-13 to ISBN-13."""
    digits = value.replace("-", "").upper()
    if re.fullmatch(r"97[89]\d{10}", digits):
        return digits
    if re.fullmatch(r"\d{9}[\dX]", digits):
        core = "978" + digits[:9]
        check = (10 - sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(core)) % 10) % 10
        return core + str(check)
    return None


def cover_url(cover_id: int | None) -> str | None:
    """Return the URL of a cover by its id (cover_i)."""
    return f"{COVERS}/b/id/{cover_id}-M.jpg" if cover_id else None


SEARCH_FIELDS = "key,title,author_name,author_key,first_publish_year,cover_i,edition_count,language"
_searches: dict[str, tuple[float, list[dict]]] = {}


def search(query: str, limit: int = 10) -> list[dict]:
    """Search works in any language, best match first. Cached for ten minutes."""
    key = query.strip().lower()
    cached = _searches.get(key)
    if cached and time.monotonic() - cached[0] < 600:
        return cached[1]
    docs = get_json(f"{BASE}/search.json", {"q": query, "fields": SEARCH_FIELDS, "limit": limit}).get("docs", [])
    if len(_searches) > 500:
        _searches.clear()
    _searches[key] = (time.monotonic(), docs)
    return docs


def search_by(title: str, author: str, limit: int = 20) -> list[dict]:
    """Find works by title and author, best match first. Matches any of the author's names and any
    edition's title.
    """
    params = {"title": title, "author": author, "fields": SEARCH_FIELDS, "limit": limit}
    return get_json(f"{BASE}/search.json", params, timeout=20).get("docs", [])


def work_record(ol_id: str) -> dict | None:
    """Return the search record of a work ("OL450063W")."""
    docs = get_json(f"{BASE}/search.json", {"q": f"key:/works/{ol_id}", "fields": f"{SEARCH_FIELDS},isbn,subject"}).get(
        "docs"
    )
    return docs[0] if docs else None


def works_of(author_key: str) -> list[dict]:
    """Return an author's works ("OL5161851A"), most editions first, at most 100."""
    params = {"q": f"author_key:{author_key}", "fields": SEARCH_FIELDS, "sort": "editions", "limit": 100}
    return get_json(f"{BASE}/search.json", params).get("docs", [])


def editions(ol_id: str) -> list[dict]:
    """Return all edition records of a work, 1000 per request."""
    entries: list[dict] = []
    while True:
        page = get_json(f"{BASE}/works/{ol_id}/editions.json", {"limit": 1000, "offset": len(entries)}, timeout=30)
        entries += page.get("entries", [])
        if not page.get("links", {}).get("next") or not page.get("entries"):
            return entries


def wikidata_of(ol_id: str) -> str | None:
    """Return the Wikidata item named in the work's record, if any."""
    return (get_json(f"{BASE}/works/{ol_id}.json").get("identifiers", {}).get("wikidata") or [None])[0]
