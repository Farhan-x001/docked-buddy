from __future__ import annotations

import json
from functools import lru_cache

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .auth import demo_session, verify_google_credential
from .schemas import AuthRequest, ChatRequest, Conversation, DemoAuthRequest, FeatureFlags, SessionUser
from .service import RagGeminiService
from .settings import Settings, load_feature_flags, load_settings
from .store import MemoryConversationStore, MongoConversationStore


@lru_cache(maxsize=1)
def _settings() -> Settings:
    return load_settings()


@lru_cache(maxsize=1)
def _features() -> FeatureFlags:
    return load_feature_flags(_settings().features_file)


@lru_cache(maxsize=1)
def _store():
    settings = _settings()
    features = _features()
    if features.mongodb_enabled and settings.mongodb_uri:
        try:
            return MongoConversationStore(settings.mongodb_uri)
        except Exception:
            return MemoryConversationStore()
    return MemoryConversationStore()


@lru_cache(maxsize=1)
def _service() -> RagGeminiService:
    return RagGeminiService(_settings(), _features(), _store())


def get_service() -> RagGeminiService:
    return _service()


def get_settings() -> Settings:
    return _settings()


def get_features() -> FeatureFlags:
    return _features()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="RAG Gemini Docs Chat API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"]
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/features")
    async def features() -> dict[str, object]:
        return get_features().model_dump(by_alias=True)

    @app.post("/auth/google")
    async def auth_google(payload: AuthRequest) -> dict[str, SessionUser]:
        try:
            session = verify_google_credential(payload.credential, settings)
        except Exception as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
        return {"session": session}

    @app.post("/auth/demo")
    async def auth_demo(payload: DemoAuthRequest) -> dict[str, SessionUser]:
        if not settings.allow_demo_auth:
            raise HTTPException(status_code=403, detail="Demo auth is disabled")
        session = demo_session(payload.email, payload.name, settings)
        return {"session": session}

    @app.post("/documents")
    async def upload_document(
        file: UploadFile = File(...),
        session: str = Form(...),
        conversation_id: str | None = Form(None),
    ):
        if not get_features().upload_enabled:
            raise HTTPException(status_code=403, detail="Uploads are disabled")

        try:
            session_payload = SessionUser.model_validate(json.loads(session))
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid session payload") from exc

        service = get_service()
        result = await service.ingest_upload(
            filename=file.filename or "document",
            content=await file.read(),
            session=session_payload,
            conversation_id=conversation_id,
        )
        return result.model_dump(by_alias=True)

    @app.post("/chat")
    async def chat(request: ChatRequest):
        service = get_service()
        if not request.session and not get_features().allow_guest_chat:
            raise HTTPException(status_code=403, detail="Guest chat is disabled")
        result = await service.answer(request.message, request.session, request.conversation_id)
        return result.model_dump(by_alias=True)

    @app.get("/conversations")
    async def list_conversations(session: str = Query(...)):
        try:
            session_payload = SessionUser.model_validate(json.loads(session))
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid session payload") from exc
        conversations = await get_service().store.list_conversations(session_payload)
        return [conversation.model_dump(by_alias=True) for conversation in conversations]

    @app.get("/conversations/{conversation_id}")
    async def get_conversation(conversation_id: str, session: str = Query(...)):
        try:
            session_payload = SessionUser.model_validate(json.loads(session))
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid session payload") from exc

        conversation = await get_service().store.get_conversation(conversation_id)
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")

        if session_payload.role != "admin" and conversation.owner_email not in {None, session_payload.email}:
            raise HTTPException(status_code=403, detail="Not allowed")

        return conversation.model_dump(by_alias=True)

    return app


app = create_app()
