from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token

from .schemas import Role, SessionUser
from .settings import Settings


@dataclass(slots=True)
class ResolvedSession:
    session: SessionUser


@lru_cache(maxsize=256)
def _admin_email_set(emails: tuple[str, ...]) -> set[str]:
    return {email.lower() for email in emails}


def resolve_role(email: str, admin_emails: set[str]) -> Role:
    if email.lower() in admin_emails:
        return "admin"
    return "member"


def make_session(user_id: str, name: str, email: str, admin_emails: set[str], avatar_url: str | None = None) -> SessionUser:
    return SessionUser(
        id=user_id,
        name=name,
        email=email,
        role=resolve_role(email, admin_emails),
        avatar_url=avatar_url
    )


def verify_google_credential(credential: str, settings: Settings) -> SessionUser:
    if not settings.google_client_id:
        raise ValueError("GOOGLE_CLIENT_ID is not configured")

    claims = id_token.verify_oauth2_token(
        credential,
        GoogleRequest(),
        settings.google_client_id
    )

    email = str(claims.get("email", "")).lower()
    name = str(claims.get("name") or claims.get("email") or "Member")
    picture = claims.get("picture")
    subject = str(claims.get("sub") or email or name)
    return make_session(subject, name, email, settings.admin_emails, str(picture) if picture else None)


def demo_session(email: str, name: str, settings: Settings) -> SessionUser:
    return make_session(f"demo:{email}", name, email.lower(), settings.admin_emails)
