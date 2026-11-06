"""A work's expressions: finding and creating them, setting titles from Wikidata, its cover, and
reading titles back.
"""

from sqlmodel import Session, col, select

from api.clients.storage import delete_upload
from api.models import Edition, Expression, Work

# an edition that's a work's cover picture, not a publication
PICTURE = col(Edition.isbn).is_(None) & col(Edition.ol_edition).is_(None) & col(Edition.cover_source).is_not(None)

# BCP 47's "undetermined": what an Open Library work gets when Wikidata says nothing
UNDETERMINED = "und"


def expression(session: Session, work: Work, language: str) -> Expression:
    """Return the work's expression in this language, creating it if needed."""
    found = session.exec(
        select(Expression).where(Expression.work_id == work.id, Expression.language == language)
    ).first()
    if found:
        return found
    made = Expression(work_id=work.id, language=language)
    session.add(made)
    session.flush()
    return made


def original(session: Session, work: Work) -> Expression | None:
    return session.exec(select(Expression).where(Expression.work_id == work.id, Expression.is_original)).first()


def set_original(
    session: Session, work: Work, language: str, title: str | None, keep_title: bool = False
) -> Expression:
    """Make this language the work's original, with this title (unless it has one and keep_title).
    Any other stops being the original.
    """
    for other in session.exec(select(Expression).where(Expression.work_id == work.id, Expression.is_original)):
        if other.language != language:
            other.is_original = False
            session.add(other)
    session.flush()
    found = expression(session, work, language)
    found.is_original = True
    if title and not (keep_title and found.title):
        found.title = title[:500]
    found.year = found.year or work.year
    session.add(found)
    session.flush()
    return found


def set_titles(
    session: Session, work: Work, language: str | None, titles: dict[str, str], keep: bool | None = None
) -> None:
    """Set the work's original and titles from Wikidata ({ language: title }), creating expressions
    as needed. A curated work, or one with keep, keeps its titles; Wikidata fills in the rest.
    """
    keep = work.is_curated if keep is None else keep
    if language:
        set_original(session, work, language, titles.get(language), keep_title=keep)
    for lang, title in titles.items():
        if lang == language:
            continue
        found = expression(session, work, lang)
        if not (keep and found.title):
            found.title = title[:500]
            session.add(found)
    session.flush()


def set_cover(session: Session, work: Work, source: str | None) -> None:
    """Set the work's cover from a source URL, as an edition without an ISBN of its original, else
    its English or first expression. Our copy of a replaced picture is deleted; the covers command
    makes the new one.
    """
    if not source:
        return
    expressions = list(session.exec(select(Expression).where(Expression.work_id == work.id).order_by(Expression.id)))
    target = next((x for x in expressions if x.is_original), None) or next(
        (x for x in expressions if x.language == "en"), expressions[0] if expressions else None
    )
    if target is None:
        return
    pictured = cover_edition(session, work)
    if pictured is None:
        session.add(Edition(expression_id=target.id, cover_source=source))
    elif pictured.cover_source != source:
        delete_upload(pictured.cover)
        pictured.cover, pictured.cover_source = None, source
        session.add(pictured)
    session.flush()


def cover_edition(session: Session, work: Work) -> Edition | None:
    """Return the edition that's the work's cover picture: no ISBN or Open Library edition, with a
    cover.
    """
    return session.exec(
        select(Edition)
        .join(Expression, Expression.id == Edition.expression_id)
        .where(Expression.work_id == work.id, PICTURE)
        .order_by(Edition.id)
    ).first()


def titles_of(session: Session, work_ids: list[int]) -> dict[int, dict]:
    """Return each work's titles: { work id: { "original": (language, title) or None, "titles": {
    language: title } } }.
    """
    out: dict[int, dict] = {wid: {"original": None, "titles": {}} for wid in work_ids}
    for found in session.exec(
        select(Expression).where(col(Expression.work_id).in_(work_ids), col(Expression.title).is_not(None))
    ):
        entry = out[found.work_id]
        entry["titles"][found.language] = found.title
        if found.is_original:
            entry["original"] = (found.language, found.title)
    return out


def shown_title(entry: dict) -> str:
    """Return the title to show when no reader language decides: the original, else English, else
    any.
    """
    if entry["original"]:
        return entry["original"][1]
    titles = entry["titles"]
    return titles.get("en") or next(iter(titles.values()), "")
