"""Outgoing email: printed to the logs locally, sent with Azure Communication Services in
production.
"""

import logging
from functools import lru_cache

from azure.communication.email import EmailClient

from api.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache
def get_email_client() -> EmailClient:
    return EmailClient.from_connection_string(get_settings().azure_communication_connection_string)


def send_email(to: str, subject: str, body: str) -> None:
    settings = get_settings()

    if not settings.is_production:
        print(f"\n----- Email (not sent) -----\nTo: {to}\nSubject: {subject}\n\n{body}----------------------------\n")
        return

    if not (settings.azure_communication_connection_string and settings.email_from):
        logger.error("Email not sent: set AZURE_COMMUNICATION_CONNECTION_STRING and EMAIL_FROM")
        return

    message = {
        "senderAddress": settings.email_from,
        "recipients": {"to": [{"address": to}]},
        "content": {"subject": subject, "plainText": body},
    }
    try:
        get_email_client().begin_send(message).result()  # waits until Azure accepted it
    except Exception:
        # Runs as a background task, so log instead of failing the request.
        logger.exception("Could not send email %r", subject)


def send_verification_email(to: str, name: str, link: str) -> None:
    send_email(
        to,
        "Confirm your email address",
        f"Hi {name},\n\n"
        f"Please confirm your email address to finish creating your OpenRead account:\n\n"
        f"{link}\n\n"
        f"This link is valid for 24 hours. If you didn't sign up, you can ignore this email.\n",
    )


def send_email_change_email(to: str, name: str, link: str) -> None:
    send_email(
        to,
        "Confirm your new email address",
        f"Hi {name},\n\n"
        f"Please confirm this address to use it for your OpenRead account:\n\n"
        f"{link}\n\n"
        f"This link is valid for 24 hours. If you didn't ask for this, you can ignore this email.\n",
    )


def send_email_change_notice(to: str, name: str, new_email: str) -> None:
    send_email(
        to,
        "Your email address is being changed",
        f"Hi {name},\n\n"
        f"Someone asked to change the email address of your OpenRead account to {new_email}. "
        f"It changes once that address is confirmed.\n\n"
        f"If this wasn't you, change your password in Settings.\n",
    )


def send_password_reset_email(to: str, name: str, link: str) -> None:
    send_email(
        to,
        "Reset your password",
        f"Hi {name},\n\n"
        f"Someone asked to reset the password for your OpenRead account. "
        f"Choose a new password here:\n\n"
        f"{link}\n\n"
        f"This link is valid for 1 hour and works once. "
        f"If you didn't ask for this, you can ignore this email.\n",
    )
