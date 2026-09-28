"""
CLI entrypoint used by the TypeScript backend to answer a single question.

The backend spawns this as a subprocess:
    python query.py "What does Article 21 say?" [--store PATH_TO_VECTORSTORE]

--store selects which index to search (the backend passes a per-chat index when
the chat has uploaded documents; otherwise the built-in default is used).

It prints a single JSON object to stdout:
    {"answer": "...", "sources": ["chunk_00012.txt", ...]}
or, on failure:
    {"error": "..."}

Kept as a one-shot CLI (rather than a long-running Python server) to match
the "python code = pure logic" split the project asked for — the TypeScript
backend owns the HTTP layer.
"""

import argparse
import json
import sys

from rag.vectorstore import load_vectorstore
from rag.chain import build_qa_chain
from config import VECTORSTORE_PATH


def _display_source(source: str) -> str:
    """Per-document chunks are named '<file>__chunk_NNNNN.txt'; show just the file."""
    return source.rsplit("__chunk_", 1)[0] if "__chunk_" in source else source


def answer_question(query: str, store_path: str = VECTORSTORE_PATH) -> dict:
    if not query or not query.strip():
        return {"error": "Please enter a question about your documents."}

    db = load_vectorstore(store_path)
    qa = build_qa_chain(db)

    result = qa.invoke({"query": query})
    sources = sorted({
        _display_source(doc.metadata.get("source", "unknown"))
        for doc in result.get("source_documents", [])
    })
    return {"answer": result["result"], "sources": sources}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No question provided."}))
        sys.exit(1)

    question = sys.argv[1]
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=VECTORSTORE_PATH)
    args = parser.parse_args(sys.argv[2:])
    try:
        output = answer_question(question, args.store)
    except Exception as e:  # surface any failure as JSON, not a stack trace
        output = {"error": str(e)}

    print(json.dumps(output))
