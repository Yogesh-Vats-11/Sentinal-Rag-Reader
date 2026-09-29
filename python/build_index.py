"""
CLI entrypoint: build a FAISS vector store from a folder of processed chunks.
The backend runs this for a chat every time its documents change.

Usage:
    python build_index.py --processed DIR --store DIR
"""

import argparse

from rag.vectorstore import build_vectorstore


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--processed", required=True)
    parser.add_argument("--store", required=True)
    args = parser.parse_args()

    print(f"[build_index] Building vector store from '{args.processed}'...")
    build_vectorstore(args.processed, args.store)
    print(f"[build_index] Saved vector store to '{args.store}'.")
