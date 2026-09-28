"""
Central configuration for the Sentinel RAG pipeline.

All values come from environment variables (see .env.example). Never commit
real API keys — the previous version of this project shipped a hardcoded
OpenAI key as a default value, which is a serious security issue. That key
should be treated as compromised and rotated if it was ever real.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# --- LLM / embeddings -------------------------------------------------------
# LLM_BACKEND selects which chat model backs the QA chain:
#   "ollama" (default) — runs fully locally against a local Ollama server, no API key needed
#   "openai"           — uses OpenAI's hosted API, requires OPENAI_API_KEY
LLM_BACKEND = os.getenv("LLM_BACKEND", "ollama").lower()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")  # only required when LLM_BACKEND=openai
LLM_MODEL = os.getenv("LLM_MODEL", "llama3" if LLM_BACKEND == "ollama" else "gpt-4o-mini")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

# --- Storage / ingestion -----------------------------------------------------
VECTORSTORE_PATH = os.getenv("VECTORSTORE_PATH", "vectorstore")
RAW_DIR = os.getenv("RAW_DIR", "data_ingest/raw")
PROCESSED_DIR = os.getenv("PROCESSED_DIR", "data_ingest/processed")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))
TOP_K = int(os.getenv("TOP_K", "4"))


def require_api_key() -> str:
    """Fail loudly and early if no API key is configured, instead of the
    request silently failing deep inside the LLM call. Only relevant when
    LLM_BACKEND=openai — Ollama needs no key."""
    if not OPENAI_API_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Create a .env file (see .env.example) "
            "or export the variable before running the pipeline, or switch "
            "LLM_BACKEND=ollama to run fully locally with no key."
        )
    return OPENAI_API_KEY
