"""
The answering logic, shared by the long-running worker (worker.py) and the
one-shot command line tool (query.py).

Everything expensive is loaded once and kept: the embedding model, each chat's
FAISS index, and the LLM client. That is what makes answers fast — starting a
fresh Python process for every message re-imports torch and reloads the
embedding model each time.
"""

import os
import threading

from config import TOP_K, HISTORY_MESSAGES, HISTORY_CHARS

CHAT_SYSTEM_PROMPT = "You are a helpful, friendly assistant. Answer clearly and concisely."

DOC_SYSTEM_PROMPT = (
    "You answer questions using only the context taken from the user's document. "
    "If the answer is not in the context, say you couldn't find it in the document — do not guess. "
    "Be concise: short paragraphs or a brief list."
)

_embed_lock = threading.Lock()
_llm_lock = threading.Lock()
_embeddings = None
_llms: dict = {}
_stores: dict = {}  # store path -> ((mtime_ns, size), FAISS)


def display_source(source: str) -> str:
    """Per-document chunks are named '<file>__chunk_NNNNN.txt'; show just the file."""
    return source.rsplit("__chunk_", 1)[0] if "__chunk_" in source else source


def get_embeddings():
    global _embeddings
    with _embed_lock:
        if _embeddings is None:
            from rag.vectorstore import get_embeddings as make_embeddings

            _embeddings = make_embeddings()
        return _embeddings


def get_llm(temperature: float):
    with _llm_lock:
        if temperature not in _llms:
            from rag.chain import build_llm

            _llms[temperature] = build_llm(temperature)
        return _llms[temperature]


def get_store(store_path: str):
    """Load a chat's index, reusing the in-memory copy until the index file changes."""
    index_file = os.path.join(store_path, "index.faiss")
    try:
        stat = os.stat(index_file)
    except FileNotFoundError:
        _stores.pop(store_path, None)
        raise FileNotFoundError("This chat's documents are not indexed yet.")
    stamp = (stat.st_mtime_ns, stat.st_size)

    cached = _stores.get(store_path)
    if cached and cached[0] == stamp:
        return cached[1]

    from langchain_community.vectorstores import FAISS

    db = FAISS.load_local(store_path, get_embeddings(), allow_dangerous_deserialization=True)
    _stores[store_path] = (stamp, db)
    return db


def forget_store(store_path: str):
    _stores.pop(store_path, None)


def stream_chat(question: str, history: list[dict]):
    """Normal conversation, no documents. Yields text pieces as they are generated."""
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

    messages = [SystemMessage(content=CHAT_SYSTEM_PROMPT)]
    for m in history[-HISTORY_MESSAGES:]:
        content = str(m.get("content", ""))[:HISTORY_CHARS]
        if not content.strip():
            continue
        messages.append(HumanMessage(content=content) if m.get("role") == "user" else AIMessage(content=content))
    messages.append(HumanMessage(content=question))

    for chunk in get_llm(0.7).stream(messages):
        if chunk.content:
            yield chunk.content


def stream_docs(question: str, store_path: str):
    """Answer from a chat's own documents. Returns (sources, generator of text pieces)."""
    from langchain_core.messages import HumanMessage, SystemMessage

    db = get_store(store_path)
    docs = db.similarity_search(question, k=TOP_K)
    context = "\n\n".join(d.page_content for d in docs)
    sources = sorted({display_source(d.metadata.get("source", "unknown")) for d in docs})

    messages = [
        SystemMessage(content=DOC_SYSTEM_PROMPT),
        HumanMessage(content=f"Context:\n{context}\n\nQuestion: {question}"),
    ]

    def pieces():
        for chunk in get_llm(0.0).stream(messages):
            if chunk.content:
                yield chunk.content

    return sources, pieces()


def warm_up(load_llm: bool = True):
    """Load the heavy things now so the first real question doesn't pay for them."""
    import sys

    import time

    t = time.time()
    try:
        import langchain_core.messages  # noqa: F401  (imported here so the first question doesn't pay for it)

        get_llm(0.0)
        get_llm(0.7)
        print(f"[warmup] chat libraries ready ({time.time() - t:.1f}s)", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"[warmup] chat libraries failed: {e}", file=sys.stderr, flush=True)

    t = time.time()
    try:
        get_embeddings()
        print(f"[warmup] embedding model ready ({time.time() - t:.1f}s)", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"[warmup] embedding model failed: {e}", file=sys.stderr, flush=True)

    if not load_llm:
        return
    try:
        from config import LLM_BACKEND, LLM_MODEL, OLLAMA_BASE_URL, LLM_KEEP_ALIVE

        if LLM_BACKEND == "ollama":
            import requests

            # A generate call with no prompt just loads the model into memory.
            requests.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={"model": LLM_MODEL, "keep_alive": LLM_KEEP_ALIVE},
                timeout=300,
            )
            print(f"[warmup] {LLM_MODEL} loaded in Ollama", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"[warmup] LLM preload skipped: {e}", file=sys.stderr, flush=True)
