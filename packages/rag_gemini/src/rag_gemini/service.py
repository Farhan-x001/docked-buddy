from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .documents import chunk_text, extract_text_from_bytes
from .schemas import ChatResponse, Conversation, FeatureFlags, Message, SessionUser, SourceSnippet, StoredDocument, UploadResponse
from .settings import Settings
from .store import ConversationStore, MemoryConversationStore, now_utc


class RagGeminiService:
    def __init__(
        self,
        settings: Settings,
        features: FeatureFlags,
        store: ConversationStore | None = None
    ) -> None:
        self.settings = settings
        self.features = features
        self.store = store or MemoryConversationStore()

    async def ensure_conversation(self, conversation_id: str | None, session: SessionUser, title: str | None = None) -> Conversation:
        if conversation_id:
            existing = await self.store.get_conversation(conversation_id)
            if existing:
                return existing

        conversation = Conversation(
            id=conversation_id or str(uuid.uuid4()),
            title=title or "New conversation",
            updated_at=now_utc(),
            messages=[],
            document_names=[],
            owner_email=session.email
        )
        return await self.store.upsert_conversation(conversation)

    async def ingest_upload(
        self,
        filename: str,
        content: bytes,
        session: SessionUser,
        conversation_id: str | None = None
    ) -> UploadResponse:
        conversation = await self.ensure_conversation(conversation_id, session, title=Path(filename).stem)
        extracted = extract_text_from_bytes(filename, content)
        chunks = chunk_text(extracted, self.features.chunk_size, self.features.chunk_overlap)
        document = StoredDocument(
            id=str(uuid.uuid4()),
            conversation_id=conversation.id,
            title=Path(filename).stem,
            filename=filename,
            content=extracted,
            chunks=chunks,
            uploaded_at=now_utc(),
            uploaded_by=session
        )
        await self.store.save_document(document)
        updated = conversation.model_copy(
            update={
                "document_names": sorted(set([*conversation.document_names, document.title])),
                "updated_at": now_utc()
            }
        )
        await self.store.upsert_conversation(updated)
        return UploadResponse(document_id=document.id, title=document.title, status="indexed", conversation_id=conversation.id)

    def _generate_with_gemini_rest(self, prompt: str) -> str:
        if not self.settings.gemini_api_key:
            raise RuntimeError("Gemini API key is missing")

        model_name = self.features.model_name or "gemini-flash-latest"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ]
        }
        request = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-goog-api-key": self.settings.gemini_api_key,
            },
        )

        try:
            with urlopen(request, timeout=60) as response:
                data = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore") if exc.fp else ""
            raise RuntimeError(
                f"Gemini request failed with HTTP {exc.code}: {body or exc.reason}"
            ) from exc
        except URLError as exc:
            raise RuntimeError(f"Gemini request failed: {exc.reason}") from exc

        candidates = data.get("candidates") or []
        for candidate in candidates:
            content = candidate.get("content") or {}
            parts = content.get("parts") or []
            text = "".join(
                part.get("text", "")
                for part in parts
                if isinstance(part, dict)
            ).strip()
            if text:
                return text

        raise RuntimeError("Gemini response did not contain any text")

    async def answer(self, request_message: str, session: SessionUser, conversation_id: str | None = None) -> ChatResponse:
        conversation = await self.ensure_conversation(conversation_id, session)

        user_message = Message(
            id=str(uuid.uuid4()),
            role="user",
            content=request_message,
            created_at=now_utc(),
            sources=[]
        )

        conversation = conversation.model_copy(
            update={
                "title": conversation.title if conversation.title != "New conversation" else request_message[:48] or conversation.title,
                "messages": [*conversation.messages, user_message],
                "updated_at": now_utc(),
                "owner_email": conversation.owner_email or session.email
            }
        )

        docs = await self.store.list_documents(conversation.id)
        sources = self._retrieve_sources(request_message, docs)
        reply_text = await self._generate_answer(request_message, conversation, sources)
        assistant_message = Message(
            id=str(uuid.uuid4()),
            role="assistant",
            content=reply_text,
            created_at=now_utc(),
            sources=sources
        )

        conversation = conversation.model_copy(
            update={
                "messages": [*conversation.messages, assistant_message],
                "updated_at": now_utc()
            }
        )
        await self.store.upsert_conversation(conversation)
        return ChatResponse(conversation_id=conversation.id, reply=assistant_message, conversation=conversation)

    def _retrieve_sources(self, query: str, documents: list[StoredDocument]) -> list[SourceSnippet]:
        chunk_rows: list[tuple[str, str, int | None, str]] = []
        for doc in documents:
            for index, chunk in enumerate(doc.chunks):
                chunk_rows.append((doc.title, chunk, index + 1, doc.id))

        if not chunk_rows:
            return []

        corpus = [row[1] for row in chunk_rows] + [query]
        vectorizer = TfidfVectorizer(stop_words="english")
        matrix = vectorizer.fit_transform(corpus)
        scores = cosine_similarity(matrix[-1], matrix[:-1]).flatten()

        ranked = sorted(enumerate(scores), key=lambda item: item[1], reverse=True)[:4]
        sources: list[SourceSnippet] = []
        for index, score in ranked:
            title, content, page, _ = chunk_rows[index]
            sources.append(
                SourceSnippet(
                    title=title,
                    excerpt=content[:260],
                    page=page,
                    score=float(round(score, 4))
                )
            )
        return sources

    async def _generate_answer(self, query: str, conversation: Conversation, sources: list[SourceSnippet]) -> str:
        context = "\n\n".join(
            f"[{index + 1}] {source.title} (page {source.page or 'n/a'}): {source.excerpt}"
            for index, source in enumerate(sources)
        )

        if self.settings.gemini_api_key:
            prompt = f"""
You are a careful learning assistant for uploaded documents.
Answer the user's question using only the provided context when possible.
If the context is insufficient, say what is missing.

Conversation title: {conversation.title}
Question: {query}

Context:
{context or 'No retrieved context available.'}

Return a helpful, concise response with bullet points where useful.
""".strip()
            try:
                return await asyncio.to_thread(self._generate_with_gemini_rest, prompt)
            except Exception as exc:
                summary = "\n".join(f"- {source.title}: {source.excerpt[:120]}" for source in sources)
                if not summary:
                    summary = "- No indexed document context found yet. Upload a file to begin grounded answers."
                return (
                    "Gemini is configured, but the current API key could not be used for generation.\n\n"
                    f"Question: {query}\n\n"
                    f"Relevant context:\n{summary}\n\n"
                    f"Gemini error: {exc}\n\n"
                    "Please verify that GEMINI_API_KEY is a valid Google Gemini API key and restart the backend."
                )

        summary = "\n".join(f"- {source.title}: {source.excerpt[:120]}" for source in sources)
        if not summary:
            summary = "- No indexed document context found yet. Upload a file to begin grounded answers."
        return (
            "The backend is running in local fallback mode, so this answer is generated without Gemini.\n\n"
            f"Question: {query}\n\n"
            f"Relevant context:\n{summary}\n\n"
            "Once GEMINI_API_KEY is configured, responses will be generated with Gemini and grounded in your uploaded files."
        )
