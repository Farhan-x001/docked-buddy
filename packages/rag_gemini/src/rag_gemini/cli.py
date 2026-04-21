from __future__ import annotations

import argparse

import uvicorn

from .api import get_settings


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the RAG Gemini FastAPI app")
    parser.add_argument("--host", default=None)
    parser.add_argument("--port", type=int, default=None)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()

    settings = get_settings()
    uvicorn.run(
        "rag_gemini.api:app",
        host=args.host or settings.host,
        port=args.port or settings.port,
        reload=args.reload or settings.reload
    )


if __name__ == "__main__":
    main()
