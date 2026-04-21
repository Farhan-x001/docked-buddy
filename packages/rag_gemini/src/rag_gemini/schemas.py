from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part[:1].upper() + part[1:] for part in parts[1:])


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


Role = Literal["admin", "member", "viewer", "guest"]
MessageRole = Literal["user", "assistant"]


class FeatureFlags(ApiModel):
    upload_enabled: bool = True
    admin_only_upload: bool = False
    browser_history_enabled: bool = True
    mongodb_enabled: bool = False
    allow_guest_chat: bool = True
    model_name: str = "gemini-1.5-flash"
    chunk_size: int = 900
    chunk_overlap: int = 180
    max_upload_mb: int = 20


class SessionUser(ApiModel):
    id: str
    name: str
    email: str
    role: Role
    avatar_url: str | None = None


class SourceSnippet(ApiModel):
    title: str
    excerpt: str
    page: int | None = None
    score: float | None = None


class Message(ApiModel):
    id: str
    role: MessageRole
    content: str
    created_at: datetime
    sources: list[SourceSnippet] = Field(default_factory=list)


class Conversation(ApiModel):
    id: str
    title: str
    updated_at: datetime
    messages: list[Message] = Field(default_factory=list)
    document_names: list[str] = Field(default_factory=list)
    owner_email: str | None = None


class StoredDocument(ApiModel):
    id: str
    conversation_id: str
    title: str
    filename: str
    content: str
    chunks: list[str] = Field(default_factory=list)
    uploaded_at: datetime
    uploaded_by: SessionUser


class AuthRequest(ApiModel):
    credential: str


class DemoAuthRequest(ApiModel):
    email: str
    name: str


class ChatRequest(ApiModel):
    conversation_id: str | None = None
    message: str
    session: SessionUser


class ChatResponse(ApiModel):
    conversation_id: str
    reply: Message
    conversation: Conversation


class UploadResponse(ApiModel):
    document_id: str
    title: str
    status: Literal["indexed", "queued", "error"]
    conversation_id: str | None = None
