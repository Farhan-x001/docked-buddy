# RAG + Gemini Docs Chat Monorepo

A hybrid monorepo for a NotebookLM-style document chat experience with a polished React UI, reusable frontend packages, and a reusable Python RAG backend built around Gemini.

## What is included

- **`apps/web`** - React chat app with local browser history, uploads, login UI, and a clean white docs-first interface.
- **`packages/ui`** - Reusable React UI primitives for cards, buttons, badges, and branded layout elements.
- **`packages/sdk`** - Typed browser/API client for talking to the backend from any React project.
- **`packages/rag_gemini`** - Importable Python package with file ingestion, retrieval, Gemini prompting, Google auth, and a FastAPI app.
- **`config/features.yaml`** - YAML feature flags for enabling/disabling uploads, MongoDB, guest chat, and other behaviors.

## Frontend

The React app stores chat history in the browser first and can sync to the backend when configured. If Google OAuth is configured, users can sign in and roles are resolved on the backend. The upload button can be restricted to admins by toggling the YAML config.

## Backend

The Python package exposes a reusable service layer and a FastAPI app. It supports PDF, DOCX, and TXT ingestion, chunked retrieval, Gemini answer generation, optional MongoDB persistence, and Google ID token verification.

## Getting started

1. Install JavaScript dependencies from the repo root.
2. Install the Python package in editable mode from `packages/rag_gemini`.
3. Set the environment variables in `.env.example`.
4. Start the backend and the React app.

### Example commands

```bash
npm install
npm run dev
```

In a separate shell for the Python service:

```bash
python -m pip install -e packages/rag_gemini
rag-gemini-api --reload
```

## Notes

- Real Gemini and Google auth require API keys / client IDs.
- MongoDB persistence is optional and controlled through environment variables and YAML feature flags.
- The local browser store keeps the experience usable even before backend persistence is configured.
