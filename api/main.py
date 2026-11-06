import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.exc import DataError

from api.clients.storage import MEDIA_DIR, blob_service
from api.config import get_settings
from api.db import SessionDep
from api.rate_limit import limiter, rate_limit_exceeded
from api.routers import auth, catalogue, me, messages, reflections, suggestions, tracks

logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title="OpenRead",
    docs_url="/docs" if settings.show_docs else None,
    redoc_url="/redoc" if settings.show_docs else None,
    openapi_url="/openapi.json" if settings.show_docs else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded)


@app.exception_handler(DataError)
def value_postgres_refused(request: Request, exc: DataError) -> JSONResponse:
    """A value from the request that Postgres can't take: a NUL character, a number out of range."""
    logger.warning("Refused a value on %s %s: %s", request.method, request.url.path, exc.orig)
    return JSONResponse({"detail": "That isn't something OpenRead can work with."}, status_code=422)


# In production the FE calls the API from another address, with the login cookie. Locally the Vite
# proxy puts both on one address.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.fe_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# /works is about 180 KB of JSON, 30 KB gzipped
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(auth.router)
app.include_router(catalogue.router)
app.include_router(me.router)
app.include_router(tracks.router)
app.include_router(reflections.router)
app.include_router(messages.router)
app.include_router(suggestions.router)


# In production pictures are in Azure Blob Storage; locally the API serves them.
if blob_service() is None:
    MEDIA_DIR.mkdir(exist_ok=True)
    app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")


@app.get("/health", tags=["meta"])
def health(session: SessionDep) -> dict[str, str]:
    """Report that the API and database are up. The deploy workflow uses version to see when the new
    image is serving.
    """
    session.execute(text("SELECT 1"))
    return {"status": "ok", "environment": settings.environment, "version": settings.image_tag}
