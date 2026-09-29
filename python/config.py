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

# --- Ingestion ---------------------------------------------------------------
# (Where documents/indexes live is decided per chat by the backend: python/chats/<chatId>/)
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))
TOP_K = int(os.getenv("TOP_K", "3"))  # fewer retrieved chunks = shorter prompt = faster answers

# --- Speed ---------------------------------------------------------------------
# Keep the Ollama model loaded in memory between questions (Ollama's default is 5 minutes).
LLM_KEEP_ALIVE = os.getenv("LLM_KEEP_ALIVE", "30m")
# Upper limit on the length of one answer, in tokens. Stops very long replies on slow machines.
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "600"))
# Optional: Ollama context window. Smaller = less RAM and faster. Leave empty for Ollama's default.
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "0")) or None
# How much of the earlier conversation is sent along in a normal chat. Every message is re-read by
# the model on each question, so long history makes every answer slower.
HISTORY_MESSAGES = int(os.getenv("HISTORY_MESSAGES", "6"))
HISTORY_CHARS = int(os.getenv("HISTORY_CHARS", "800"))
# Load the embedding model and the LLM as soon as the backend starts, so the first question is fast.
WARMUP = os.getenv("WARMUP", "true").lower() != "false"


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
