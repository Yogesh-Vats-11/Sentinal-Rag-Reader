"""
CLI entrypoint: build the FAISS vector store from a folder of processed
chunks and save it. Run once (and again whenever the source documents change).

Usage:
    python build_index.py                                   # global defaults from config.py
    python build_index.py --processed DIR --store DIR       # used by the backend, one index per chat
"""

import argparse

from rag.vectorstore import build_vectorstore
from config import VECTORSTORE_PATH, PROCESSED_DIR


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--processed", default=PROCESSED_DIR)
    parser.add_argument("--store", default=VECTORSTORE_PATH)
    args = parser.parse_args()

    print(f"[build_index] Building vector store from '{args.processed}'...")
    build_vectorstore(args.processed, args.store)
    print(f"[build_index] Saved vector store to '{args.store}'.")
