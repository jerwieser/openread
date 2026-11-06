"""Our small set of book categories, for the shelves on the books page.

Open Library's subjects are noisy, since they're gathered from all editions: Pride and Prejudice is
"History" and A Tale of Two Cities "Juvenile fiction". So a work is history, biography, philosophy
or self-help only when no subject says it's fiction, and when a subject is about the whole book
("History / Europe", not "Power (Philosophy)"). Classics stay off the genre shelves, and philosophy
isn't history.
"""

import re

# ours, in the order the books page shows them
CATEGORIES = {
    "classics": "Classics",
    "thrillers": "Thrillers & mystery",
    "fantasy": "Fantasy & science fiction",
    "romance": "Romance",
    "history": "History",
    "biography": "Biography & memoir",
    "sports": "Sports",
    "philosophy": "Philosophy",
    "self-help": "Self-help & business",
}

# (not "Nonfiction")
FICTION = re.compile(r"(?<!non)(?<!non-)fiction|\bnovel")
# subjects that give a category: for any work, and for non-fiction only
OF_ANY = {
    # sports, for fiction too ("The Rider"): "Cycling", "Bicycle racing", "Sports / Cycling"
    "sports": re.compile(
        r"^(sports?|cycling|bicycle racing|tour de france|football|soccer|baseball|basketball|tennis|golf|"
        r"running|marathon|boxing|mountaineering|rock climbing|olympics?)\b"
    ),
    "classics": re.compile(r"\bclassics\b|classic literature"),
    "thrillers": re.compile(r"thriller|suspense|myster|detective|crime fiction|espionage|horror"),
    "fantasy": re.compile(r"fantasy|science fiction|dystopia"),
    # (in Portuguese a "romance" is any novel: "Romance brasileiro")
    "romance": re.compile(
        r"^(fiction, )?romance(, (general|contemporary|historical)|$)|love stories|romance fiction|romantic (comedy|suspense|fiction)"
    ),
}
OF_NONFICTION = {
    "history": re.compile(r"^(world )?history($|\s*[,/])"),
    "biography": re.compile(r"^(biography|autobiography|memoirs?)\b"),
    "philosophy": re.compile(r"^philosophy\b"),
    "self-help": re.compile(
        r"^(self-help|self-improvement|personal growth|success|business|leadership|motivational)\b"
    ),
}


def ordered(found: set[str]) -> list[str]:
    return [c for c in CATEGORIES if c in found]


def from_subjects(subjects: list[str]) -> list[str]:
    """Return our categories for a work with these Open Library subjects."""
    plain = [s.strip().lower() for s in subjects]
    found = {c for c, words in OF_ANY.items() if any(words.search(s) for s in plain)}
    if not any(FICTION.search(s) for s in plain):
        found |= {c for c, words in OF_NONFICTION.items() if any(words.search(s) for s in plain)}
    # Classics are filed under every genre an edition was sold as (one Moby-Dick under "Science
    # fiction & fantasy"), and philosophy often under "History".
    if "classics" in found:
        found -= {"thrillers", "fantasy", "romance"}
    if "philosophy" in found:
        found.discard("history")
    return ordered(found)
