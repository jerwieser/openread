"""Writing reflections: drafts only their author sees, until they publish them."""

from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from api.db import SessionDep
from api.deps import CurrentUser
from api.models import Reflection, ReflectionRead, ReflectionWrite, User
from api.serialize import reflections_read, work_by_slug
from api.utils import new_slug, now

router = APIRouter(prefix="/reflections", tags=["reflections"])


def own_reflection_or_404(session: SessionDep, slug: str, user: User) -> Reflection:
    reflection = session.exec(select(Reflection).where(Reflection.slug == slug)).first()
    if reflection is None or reflection.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reflection not found")
    return reflection


@router.post("", response_model=ReflectionRead, status_code=status.HTTP_201_CREATED)
def create_reflection(payload: ReflectionWrite, user: CurrentUser, session: SessionDep) -> ReflectionRead:
    reflection = Reflection(
        slug=new_slug(payload.title),
        user_id=user.id,
        work_id=work_by_slug(session, payload.work_slug).id,
        title=payload.title,
        body=payload.text,
        status=payload.status,
        written_on=now().date(),
    )
    session.add(reflection)
    session.commit()
    session.refresh(reflection)
    return reflections_read(session, [reflection])[0]


@router.put("/{slug}", response_model=ReflectionRead)
def update_reflection(slug: str, payload: ReflectionWrite, user: CurrentUser, session: SessionDep) -> ReflectionRead:
    reflection = own_reflection_or_404(session, slug, user)
    reflection.work_id = work_by_slug(session, payload.work_slug).id
    reflection.title = payload.title
    reflection.body = payload.text
    # publishing dates it today; a draft keeps the day it was started
    if payload.status == "published" and reflection.status != "published":
        reflection.written_on = now().date()
    reflection.status = payload.status
    session.add(reflection)
    session.commit()
    session.refresh(reflection)
    return reflections_read(session, [reflection])[0]


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reflection(slug: str, user: CurrentUser, session: SessionDep) -> None:
    session.delete(own_reflection_or_404(session, slug, user))
    session.commit()
