# rag-gemini

Reusable Python package for document ingestion, RAG retrieval, Gemini answer generation, Google auth, and a FastAPI service layer.

## Install

```bash
pip install -e .
```

## Run the API

```bash
rag-gemini-api --reload
```

## Environment variables

- `GEMINI_API_KEY` - Gemini API key used for answer generation.
- `GOOGLE_CLIENT_ID` - Google OAuth client id used to verify sign-in tokens.
- `ADMIN_EMAILS` - Comma-separated list of admin email addresses.
- `FEATURES_FILE` - Path to the YAML feature flag file.
- `MONGODB_URI` - Optional MongoDB connection string.
- `ALLOW_DEMO_AUTH` - Enable demo auth for local development.
