"""Small helpers: the time and slugs."""

import re
import secrets
import unicodedata
from datetime import UTC, datetime


def now() -> datetime:
    return datetime.now(UTC)


def slugify(text: str) -> str:
    """Turn text into a slug: "Père Goriot" becomes "pere-goriot". Must match the FE's slugify."""
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    plain = re.sub(r"['’]", "", plain.lower())
    return re.sub(r"[^a-z0-9]+", "-", plain).strip("-")


def new_slug(base: str) -> str:
    """Return a slug that reads well and won't clash: "summer-of-the-brontes-3f9a"."""
    return f"{slugify(base)[:60] or 'x'}-{secrets.token_hex(2)}"
