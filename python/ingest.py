"""
Ingest raw source documents (.txt or .pdf) from RAW_DIR, split them into
fixed-size chunks, and write each chunk out as data_ingest/processed/chunk_NNNNN.txt.

This produces the same processed/chunk_*.txt layout already present in the
uploaded project, so it can be re-run on new source material.
"""

import os
import sys

from config import RAW_DIR, PROCESSED_DIR, CHUNK_SIZE, CHUNK_OVERLAP


def _read_source_text(path: str) -> str:
    if path.lower().endswith(".pdf"):
        try:
            from pypdf import PdfReader
        except ImportError as e:
            raise RuntimeError(
                "Reading PDFs requires the 'pypdf' package (pip install pypdf)."
            ) from e
        reader = PdfReader(path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    if overlap >= chunk_size:
        raise ValueError("CHUNK_OVERLAP must be smaller than CHUNK_SIZE")
    chunks = []
    start = 0
    step = chunk_size - overlap
    while start < len(text):
        chunks.append(text[start:start + chunk_size])
        start += step
    return [c for c in chunks if c.strip()]


def run_ingest(raw_dir: str = RAW_DIR, processed_dir: str = PROCESSED_DIR) -> int:
    if not os.path.isdir(raw_dir):
        raise FileNotFoundError(f"Raw directory '{raw_dir}' not found.")

    os.makedirs(processed_dir, exist_ok=True)

    chunk_index = 0
    for fname in sorted(os.listdir(raw_dir)):
        if not fname.lower().endswith((".txt", ".pdf")):
            continue
        path = os.path.join(raw_dir, fname)
        text = _read_source_text(path)
        for chunk in chunk_text(text, CHUNK_SIZE, CHUNK_OVERLAP):
            out_path = os.path.join(processed_dir, f"chunk_{chunk_index:05d}.txt")
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(chunk)
            chunk_index += 1

    print(f"[ingest] Wrote {chunk_index} chunks to '{processed_dir}'.")
    return chunk_index


if __name__ == "__main__":
    run_ingest()
