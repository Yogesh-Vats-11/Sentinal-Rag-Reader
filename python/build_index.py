"""
CLI entrypoint: build the FAISS vector store from data_ingest/processed
and save it to VECTORSTORE_PATH. Run this once (and again whenever the
source documents change) before starting the backend server.

Usage:
    python build_index.py
"""

from rag.vectorstore import build_vectorstore
from config import VECTORSTORE_PATH, PROCESSED_DIR


if __name__ == "__main__":
    print(f"[build_index] Building vector store from '{PROCESSED_DIR}'...")
    build_vectorstore()
    print(f"[build_index] Saved vector store to '{VECTORSTORE_PATH}'.")
