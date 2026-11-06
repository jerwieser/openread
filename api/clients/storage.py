"""Pictures, in Azure's media container, in one folder per kind: user_profiles, book_covers and
track_covers.

The database keeps each picture's name, like "user_profiles/3f2a.jpg". Locally there's no Azure:
they're in media/, the API serves them at /media, and the browser reaches that through the Vite
proxy at /api.
"""

import base64
import binascii
import logging
import mimetypes
import uuid
from functools import lru_cache
from pathlib import Path

from azure.storage.blob import BlobServiceClient, ContentSettings
from fastapi import HTTPException, status

from api.config import get_settings

logger = logging.getLogger(__name__)

MEDIA_DIR = Path(__file__).parents[2] / "media"
# the Vite proxy's path to the API
LOCAL_URL = "/api"

NOT_A_PICTURE = "Upload a picture: a JPEG, PNG or WebP image."


@lru_cache
def blob_service() -> BlobServiceClient | None:
    connection_string = get_settings().azure_storage_connection_string
    return BlobServiceClient.from_connection_string(connection_string) if connection_string else None


def media_url() -> str:
    """Return the base URL of the pictures: the container, or the API itself locally."""
    service = blob_service()
    if service:
        return f"{service.url.rstrip('/')}/{get_settings().azure_storage_container_media}"
    return f"{LOCAL_URL}/media"


def is_upload(value: str | None) -> bool:
    return bool(value) and not value.startswith(("data:", "http://", "https://"))


def public_url(value: str | None) -> str | None:
    """Return the URL the browser loads a stored picture from. A data: URL, from before uploads went
    to storage, is returned as it is.
    """
    if not value or value.startswith(("data:", "http://", "https://")):
        return value
    return f"{media_url()}/{value}"


def picture_type(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "webp"
    return None


def decode_picture(value: str) -> tuple[bytes, str]:
    header, comma, payload = value.partition(",")
    if not (comma and header.startswith("data:image/") and header.endswith(";base64")):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, NOT_A_PICTURE)
    try:
        data = base64.b64decode(payload, validate=True)
    except binascii.Error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, NOT_A_PICTURE) from None
    # check the first bytes, not what the data: URL claims, so an SVG with a script can't get in
    extension = picture_type(data)
    if extension is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, NOT_A_PICTURE)
    return data, extension


def save_upload(value: str | None, current: str | None, folder: str) -> str | None:
    """Return what to store for a picture a reader sent: the existing one, a new upload (a data:
    URL), or None. A replaced or removed picture is deleted.
    """
    if value is not None and value in (current, public_url(current)):
        return current
    if value is None:
        delete_upload(current)
        return None

    data, extension = decode_picture(value)
    name = store_picture(data, extension, folder)
    delete_upload(current)
    return name


def store_picture(data: bytes, extension: str, folder: str) -> str:
    """Store a picture in the media folder under a new name, and return that name."""
    name = f"{folder}/{uuid.uuid4().hex}.{extension}"
    content_type = mimetypes.types_map[f".{extension}"]
    service = blob_service()
    if service:
        # a new name for every upload, so browsers can cache it forever
        service.get_container_client(get_settings().azure_storage_container_media).upload_blob(
            name,
            data,
            content_settings=ContentSettings(
                content_type=content_type, cache_control="public, max-age=31536000, immutable"
            ),
        )
    else:
        path = MEDIA_DIR / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return name


def delete_upload(value: str | None) -> None:
    """Delete an uploaded picture. A failure is only logged: a leftover file does no harm."""
    if not is_upload(value):
        return
    try:
        service = blob_service()
        if service:
            service.get_container_client(get_settings().azure_storage_container_media).delete_blob(value)
        else:
            (MEDIA_DIR / value).unlink(missing_ok=True)
    except Exception:
        logger.exception("Could not delete the uploaded picture %s", value)
