from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import os
from dotenv import load_dotenv

from .schemas import FeatureFlags


@dataclass(slots=True)
class Settings:
    gemini_api_key: str | None
    google_client_id: str | None
    admin_emails: set[str]
    features_file: Path
    mongodb_uri: str | None
    allow_demo_auth: bool
    host: str = "127.0.0.1"
    port: int = 8000
    reload: bool = False


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_emails(value: str | None) -> set[str]:
    if not value:
        return set()
    return {item.strip().lower() for item in value.split(",") if item.strip()}


def load_settings() -> Settings:
    load_dotenv()
    features_file = Path(os.getenv("FEATURES_FILE", "config/features.yaml"))
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY"),
        google_client_id=os.getenv("GOOGLE_CLIENT_ID"),
        admin_emails=_parse_emails(os.getenv("ADMIN_EMAILS")),
        features_file=features_file,
        mongodb_uri=os.getenv("MONGODB_URI"),
        allow_demo_auth=_parse_bool(os.getenv("ALLOW_DEMO_AUTH"), True),
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        reload=_parse_bool(os.getenv("RELOAD"), False)
    )


def load_feature_flags(path: Path) -> FeatureFlags:
    import yaml

    if not path.exists():
        return FeatureFlags()

    with path.open("r", encoding="utf-8") as handle:
        payload = yaml.safe_load(handle) or {}

    return FeatureFlags(**payload)
