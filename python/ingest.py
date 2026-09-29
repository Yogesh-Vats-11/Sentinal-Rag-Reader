"""
Ingest raw source documents (.txt or .pdf) from a folder, split them into
fixed-size chunks, and write each chunk out as
    <processed>/<source file name>__chunk_NNNNN.txt

Prefixing chunks with the source file name means every chunk can be traced
back to the document it came from (used for per-document citations and for
per-chat document deletion).

Usage:
    python ingest.py --raw DIR --processed DIR --clean   # run by the backend, one folder per chat
"""

import argparse
import os

from config import CHUNK_SIZE, CHUNK_OVERLAP


def _read_pdf_text(path: str) -> str:
    # pypdfium2 is much faster than pypdf on image/drawing-heavy PDFs (illustrated books, scans with
    # a text layer) -- tens of seconds vs. minutes on a large file -- and extracts the same text.
    try:
        import pypdfium2 as pdfium

        doc = pdfium.PdfDocument(path)
        try:
            pages = []
            for page in doc:
                textpage = page.get_textpage()
                try:
                    pages.append(textpage.get_text_bounded())
                finally:
                    textpage.close()
                    page.close()
            return "\n".join(pages)
        finally:
            doc.close()
    except ImportError:
        pass

    try:
        from pypdf import PdfReader
    except ImportError as e:
        raise RuntimeError(
            "Reading PDFs requires 'pypdfium2' or 'pypdf' (pip install -r requirements.txt)."
        ) from e
    reader = PdfReader(path)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _read_source_text(path: str) -> str:
    if path.lower().endswith(".pdf"):
        return _read_pdf_text(path)

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


def run_ingest(raw_dir: str, processed_dir: str, clean: bool = False) -> int:
    """Chunk every .txt/.pdf in raw_dir. If clean=True, existing chunk files in
    processed_dir are removed first so deleted documents don't leave stale chunks.

    A file that can't be read (corrupt/encrypted PDF) or has no extractable text
    (scanned PDF) is skipped with a warning and simply produces zero chunks."""
    if not os.path.isdir(raw_dir):
        raise FileNotFoundError(f"Raw directory '{raw_dir}' not found.")

    os.makedirs(processed_dir, exist_ok=True)

    if clean:
        for f in os.listdir(processed_dir):
            if f.endswith(".txt"):
                os.remove(os.path.join(processed_dir, f))

    total = 0
    for fname in sorted(os.listdir(raw_dir)):
        if not fname.lower().endswith((".txt", ".pdf")):
            continue
        path = os.path.join(raw_dir, fname)
        try:
            text = _read_source_text(path)
        except Exception as e:  # keep going; the backend reports docs with 0 chunks
            print(f"[ingest] Skipped '{fname}': {e}")
            continue

        for i, chunk in enumerate(chunk_text(text, CHUNK_SIZE, CHUNK_OVERLAP)):
            out_path = os.path.join(processed_dir, f"{fname}__chunk_{i:05d}.txt")
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(chunk)
            total += 1

    print(f"[ingest] Wrote {total} chunks to '{processed_dir}'.")
    return total


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", required=True)
    parser.add_argument("--processed", required=True)
    parser.add_argument("--clean", action="store_true")
    args = parser.parse_args()
    run_ingest(args.raw, args.processed, args.clean)
