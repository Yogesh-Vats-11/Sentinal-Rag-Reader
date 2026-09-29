"""
Long-running helper process started once by the TypeScript backend.

Protocol: one JSON object per line on stdin (requests) and stdout (events).
Keeping this process alive means the embedding model, each chat's index and the
LLM client stay loaded between questions instead of being reloaded every time.

Requests:  {"id": 1, "op": "chat",   "question": "...", "history": [...]}
           {"id": 2, "op": "ask",    "question": "...", "store": "<index dir>"}
           {"id": 3, "op": "ingest", "raw": "<dir>", "processed": "<dir>", "clean": true}
           {"id": 4, "op": "build",  "processed": "<dir>", "store": "<index dir>"}
           {"op": "cancel", "id": 1}
Events:    {"id": 1, "type": "token", "text": "..."}
           {"id": 1, "type": "done", "sources": ["file.pdf"]}      (chat / ask)
           {"id": 3, "type": "result", "output": "..."}            (ingest / build)
           {"id": 1, "type": "error", "error": "..."}
"""

import contextlib
import io
import json
import queue
import sys
import threading
import time

# Anything a library prints to stdout would corrupt the protocol, so send it to stderr.
_protocol_out = sys.stdout
sys.stdout = sys.stderr

_out_lock = threading.Lock()
_requests: "queue.Queue[dict | None]" = queue.Queue()
_cancelled: set = set()


def send(event: dict) -> None:
    line = json.dumps(event, ensure_ascii=True) + "\n"
    with _out_lock:
        _protocol_out.write(line)
        _protocol_out.flush()


def _read_stdin() -> None:
    """Runs in its own thread so a cancel can arrive while an answer is streaming."""
    for raw in sys.stdin.buffer:
        try:
            msg = json.loads(raw.decode("utf-8"))
        except Exception:
            continue
        if msg.get("op") == "cancel":
            _cancelled.add(msg.get("id"))
        else:
            _requests.put(msg)
    _requests.put(None)  # stdin closed: the backend is gone


def _log(text: str) -> None:
    print(f"[timing] {text}", file=sys.stderr, flush=True)


def _stream(req_id, pieces, sources, label: str, started: float, prepared: float) -> None:
    """Send tokens as they arrive and log where the time went."""
    first = None
    count = 0
    for text in pieces:
        if req_id in _cancelled:
            _log(f"{label}: cancelled after {time.time() - started:.1f}s")
            return
        if first is None:
            first = time.time()
        count += 1
        send({"id": req_id, "type": "token", "text": text})
    send({"id": req_id, "type": "done", "sources": sources})

    end = time.time()
    if first is None:
        _log(f"{label}: no text produced in {end - started:.1f}s")
        return
    gen = max(end - first, 1e-6)
    _log(
        f"{label}: prepare {prepared - started:.1f}s | model wait before first word {first - prepared:.1f}s | "
        f"writing {count} pieces in {gen:.1f}s ({count / gen:.1f}/s) | total {end - started:.1f}s"
    )


def handle(msg: dict) -> None:
    import engine

    req_id = msg.get("id")
    op = msg.get("op")

    if req_id in _cancelled:
        return

    started = time.time()

    if op == "chat":
        pieces = engine.stream_chat(msg["question"], msg.get("history") or [])
        _stream(req_id, pieces, [], "chat", started, time.time())

    elif op == "ask":
        sources, pieces = engine.stream_docs(msg["question"], msg["store"])
        _stream(req_id, pieces, sources, "document answer", started, time.time())

    elif op == "ingest":
        from ingest import run_ingest

        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            run_ingest(msg["raw"], msg["processed"], bool(msg.get("clean")))
        _log(f"ingest: {time.time() - started:.1f}s")
        send({"id": req_id, "type": "result", "output": buf.getvalue().strip()})

    elif op == "build":
        from rag.vectorstore import build_vectorstore

        build_vectorstore(msg["processed"], msg["store"])
        engine.forget_store(msg["store"])
        _log(f"build index: {time.time() - started:.1f}s")
        send({"id": req_id, "type": "result", "output": "built"})

    elif op == "ping":
        send({"id": req_id, "type": "result", "output": "pong"})

    else:
        send({"id": req_id, "type": "error", "error": f"Unknown operation '{op}'."})


def main() -> None:
    from config import WARMUP

    threading.Thread(target=_read_stdin, daemon=True).start()

    if WARMUP:
        import engine

        threading.Thread(target=engine.warm_up, daemon=True).start()

    while True:
        msg = _requests.get()
        if msg is None:
            break
        try:
            handle(msg)
        except Exception as e:  # report and stay alive for the next request
            send({"id": msg.get("id"), "type": "error", "error": str(e) or e.__class__.__name__})
        finally:
            _cancelled.discard(msg.get("id"))


if __name__ == "__main__":
    main()
