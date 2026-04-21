from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Protocol

from .schemas import Conversation, SessionUser, StoredDocument


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class ConversationStore(Protocol):
    async def upsert_conversation(self, conversation: Conversation) -> Conversation: ...
    async def get_conversation(self, conversation_id: str) -> Conversation | None: ...
    async def list_conversations(self, session: SessionUser) -> list[Conversation]: ...
    async def save_document(self, document: StoredDocument) -> StoredDocument: ...
    async def list_documents(self, conversation_id: str) -> list[StoredDocument]: ...


@dataclass
class MemoryConversationStore:
    conversations: dict[str, Conversation] = field(default_factory=dict)
    documents: dict[str, StoredDocument] = field(default_factory=dict)

    async def upsert_conversation(self, conversation: Conversation) -> Conversation:
        self.conversations[conversation.id] = conversation
        return conversation

    async def get_conversation(self, conversation_id: str) -> Conversation | None:
        return self.conversations.get(conversation_id)

    async def list_conversations(self, session: SessionUser) -> list[Conversation]:
        items = list(self.conversations.values())
        if session.role == "admin":
            return sorted(items, key=lambda item: item.updated_at, reverse=True)
        return sorted(
            [item for item in items if item.owner_email in {None, session.email}],
            key=lambda item: item.updated_at,
            reverse=True
        )

    async def save_document(self, document: StoredDocument) -> StoredDocument:
        self.documents[document.id] = document
        return document

    async def list_documents(self, conversation_id: str) -> list[StoredDocument]:
        return sorted(
            [item for item in self.documents.values() if item.conversation_id == conversation_id],
            key=lambda item: item.uploaded_at,
            reverse=True
        )


class MongoConversationStore:
    def __init__(self, uri: str, database_name: str = "rag_gemini"):
        from motor.motor_asyncio import AsyncIOMotorClient

        self.client = AsyncIOMotorClient(uri)
        self.db = self.client[database_name]
        self.conversations = self.db["conversations"]
        self.documents = self.db["documents"]

    async def upsert_conversation(self, conversation: Conversation) -> Conversation:
        await self.conversations.update_one(
            {"id": conversation.id},
            {"$set": conversation.model_dump(mode="json", by_alias=True)},
            upsert=True
        )
        return conversation

    async def get_conversation(self, conversation_id: str) -> Conversation | None:
        payload = await self.conversations.find_one({"id": conversation_id})
        return Conversation.model_validate(payload) if payload else None

    async def list_conversations(self, session: SessionUser) -> list[Conversation]:
        query = {} if session.role == "admin" else {"$or": [{"ownerEmail": None}, {"ownerEmail": session.email}]}
        cursor = self.conversations.find(query).sort("updatedAt", -1)
        return [Conversation.model_validate(item) async for item in cursor]

    async def save_document(self, document: StoredDocument) -> StoredDocument:
        await self.documents.update_one(
            {"id": document.id},
            {"$set": document.model_dump(mode="json", by_alias=True)},
            upsert=True
        )
        return document

    async def list_documents(self, conversation_id: str) -> list[StoredDocument]:
        cursor = self.documents.find({"conversationId": conversation_id}).sort("uploadedAt", -1)
        return [StoredDocument.model_validate(item) async for item in cursor]
