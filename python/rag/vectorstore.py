"""
Build and load the FAISS vector store from the processed document chunks.

This mirrors the role of the original `rag/vectorstore.py` referenced by
app/ui.py but that was missing from the uploaded project.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from config import EMBEDDING_MODEL, CHUNK_SIZE, CHUNK_OVERLAP


def get_embeddings() -> HuggingFaceEmbeddings:
    # Use the copy already on disk without contacting huggingface.co (slow or hanging on a poor
    # connection). Only the very first run needs the download.
    try:
        return HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL, model_kwargs={"local_files_only": True})
    except Exception:
        return HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)


def _load_processed_documents(processed_dir: str) -> list[Document]:
    """Read every chunk_*.txt file in the processed directory into
    LangChain Document objects, tagged with their source filename."""
    if not os.path.isdir(processed_dir):
        raise FileNotFoundError(
            f"Processed directory '{processed_dir}' not found. Upload a document first."
        )

    docs: list[Document] = []
    for fname in sorted(os.listdir(processed_dir)):
        if not fname.endswith(".txt"):
            continue
        path = os.path.join(processed_dir, fname)
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
        if text.strip():
            docs.append(Document(page_content=text, metadata={"source": fname}))
    return docs


def build_vectorstore(processed_dir: str, save_path: str) -> FAISS:
    """Chunk the processed documents, embed them, and persist a FAISS index
    to disk at save_path."""
    raw_docs = _load_processed_documents(processed_dir)
    if not raw_docs:
        raise ValueError(f"No .txt chunks found in '{processed_dir}'.")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )
    split_docs = splitter.split_documents(raw_docs)

    embeddings = get_embeddings()
    db = FAISS.from_documents(split_docs, embeddings)

    os.makedirs(save_path, exist_ok=True)
    db.save_local(save_path)
    return db


def load_vectorstore(save_path: str) -> FAISS:
    """Load a previously built FAISS index from disk."""
    if not os.path.exists(save_path):
        raise FileNotFoundError(
            f"Vectorstore not found at '{save_path}'. Upload a document first."
        )
    embeddings = get_embeddings()
    return FAISS.load_local(
        save_path, embeddings, allow_dangerous_deserialization=True
    )
