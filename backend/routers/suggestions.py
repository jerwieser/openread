"""Works readers suggest, and the admins who review them.

A suggestion is matched by its Open Library work, or by title in any language with the same author
("Misdaad en straf" is Crime and Punishment). A work we only have as a plain record can still be
suggested: approving it promotes that work instead of adding a second one.
"""

from fastapi import APIRouter, HTTPException, status
from sqlmodel import Session, col, select

from backend.clients import openlibrary
from backend.db import SessionDep
from backend.deps import AdminUser, CurrentUser
from backend.models import Expression, Suggestion, SuggestionDecision, SuggestionRead, SuggestionWrite, Work
from backend.serialize import suggestions_read
from backend.services.authors import set_authors, split_names
from backend.services.expressions import UNDETERMINED, cover_edition, expression, set_cover
from backend.services.following import stops_changed, tracks_with_work
from backend.services.works import by_ol_work, same_work, work_from_open_library
from backend.utils import now, slugify

router = APIRouter(prefix="/suggestions", tags=["suggestions"])


def _norm(text: str) -> str:
    """A title or name as compared: no case, accents, punctuation or leading "The"."""
    t = slugify(text)
    return t.removeprefix("the-").removeprefix("a-").removeprefix("an-")


def same_suggestion(title: str, author: str):
    """Matches a suggestion with this title and author, ignoring case and a leading "The"."""
    return lambda s: _norm(s.title) == _norm(title) and _norm(s.author) == _norm(author)


def work_like(session: Session, title: str, author: str, ol_work: str | None) -> Work | None:
    """Return the work on OpenRead this is: the same Open Library work, or the same title and
    authors.
    """
    if ol_work:
        found = by_ol_work(session, ol_work)
        if found:
            return found
    wanted, by = _norm(title), {_norm(name) for name in split_names(author)}
    if not wanted:
        return None
    # its titles: its expressions', in every language
    titles: dict[int, set[str]] = {}
    for work_id, text in session.exec(
        select(Expression.work_id, Expression.title).where(col(Expression.title).is_not(None))
    ):
        titles.setdefault(work_id, set()).add(_norm(text))
    for work in session.exec(select(Work)):
        if wanted in titles.get(work.id, set()) and {_norm(p.name) for p in work.authors} == by:
            return work
    return same_work(session, [title], split_names(author))


@router.post("", response_model=SuggestionRead, status_code=status.HTTP_201_CREATED)
def suggest(payload: SuggestionWrite, user: CurrentUser, session: SessionDep) -> SuggestionRead:
    found = work_like(session, payload.title, payload.author, payload.ol_work)
    if found and found.is_curated:
        raise HTTPException(status.HTTP_409_CONFLICT, "That book is already on OpenRead.")
    pending = session.exec(select(Suggestion).where(Suggestion.status == "pending"))
    matches = same_suggestion(payload.title, payload.author)
    if any(matches(s) or (payload.ol_work and s.ol_work == payload.ol_work) for s in pending):
        raise HTTPException(status.HTTP_409_CONFLICT, "Someone has already suggested that book.")
    suggestion = Suggestion(user_id=user.id, **payload.model_dump())
    session.add(suggestion)
    session.commit()
    session.refresh(suggestion)
    return suggestions_read(session, [suggestion])[0]


@router.get("", response_model=list[SuggestionRead])
def list_suggestions(admin: AdminUser, session: SessionDep) -> list[SuggestionRead]:
    """List all suggestions: waiting ones first, newest first within each."""
    suggestions = session.exec(
        select(Suggestion).order_by(col(Suggestion.status) != "pending", col(Suggestion.created_at).desc())
    )
    return suggestions_read(session, list(suggestions))


@router.patch("/{suggestion_id}", response_model=SuggestionRead)
def decide(suggestion_id: int, payload: SuggestionDecision, admin: AdminUser, session: SessionDep) -> SuggestionRead:
    """Approve, reject or reopen a suggestion. Approving adds the work or promotes our plain record
    of it; reopening an approved one undoes that.
    """
    suggestion = session.get(Suggestion, suggestion_id)
    if suggestion is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Suggestion not found")
    reopening = payload.status == "pending"
    if reopening == (suggestion.status == "pending"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This suggestion has already been reviewed.")
    if payload.difficulty:
        suggestion.difficulty = payload.difficulty
    if payload.status == "approved":
        work = work_like(session, suggestion.title, suggestion.author, suggestion.ol_work)
        if not work and suggestion.ol_work:
            # the work the reader picked, else the work as they described it
            try:
                work = work_from_open_library(session, suggestion.ol_work)
            except openlibrary.Unavailable:
                work = None
        if work and work.is_curated:
            raise HTTPException(status.HTTP_409_CONFLICT, "That book is in the catalogue already.")
        if work:
            # one we have as a plain record: promote it, with readers' statuses and all
            work.is_curated = True
            work.source = "suggestion"
            work.difficulty = suggestion.difficulty
            work.url = work.url or suggestion.url or None
            session.add(work)
            if not cover_edition(session, work):
                set_cover(session, work, suggestion.cover or None)
        else:
            slug = slugify(suggestion.title)
            if session.exec(select(Work).where(Work.slug == slug)).first():
                slug = f"{slug}-{slugify(suggestion.author)}"
            work = Work(
                slug=slug,
                year=suggestion.year,
                url=suggestion.url or None,
                difficulty=suggestion.difficulty,
                is_curated=True,
                source="suggestion",
                ol_work=suggestion.ol_work,
            )
            session.add(work)
            session.flush()
            # the title as the reader gave it, in a language we don't know (an admin can't tell either)
            expression(session, work, UNDETERMINED).title = suggestion.title[:500]
            set_cover(session, work, suggestion.cover or None)
            set_authors(session, work, split_names(suggestion.author))
        session.flush()
        suggestion.work_id = work.id
    # followers move along once the work is gone from these tracks
    on_tracks = tracks_with_work(session, suggestion.work_id) if reopening and suggestion.work_id else []
    if reopening and suggestion.work_id:
        work = session.get(Work, suggestion.work_id)
        if work.ol_work:
            # a work Open Library has stays, as a plain record of it
            work.is_curated = False
            work.source = "openlibrary"
            work.difficulty = None
            session.add(work)
        else:
            session.delete(work)
        suggestion.work_id = None
    suggestion.status = payload.status
    suggestion.reason = None if reopening else payload.reason
    suggestion.decided_at = None if reopening else now()
    session.add(suggestion)
    session.commit()
    for track_id in on_tracks:
        stops_changed(session, track_id)
    session.refresh(suggestion)
    return suggestions_read(session, [suggestion])[0]
