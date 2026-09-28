import { useEffect, useRef, useState } from "react";
import { fetchDocuments, uploadDocuments, clearDocuments } from "../api";
import { IconClose, IconUpload, IconFile, IconTrash } from "./Icons";

interface Props {
  open: boolean;
  onClose: () => void;
  onIndexChanged: () => void;
}

export default function DocumentsPanel({ open, onClose, onIndexChanged }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [chunkCount, setChunkCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const state = await fetchDocuments();
    if (state.error) {
      setError(state.error);
      return;
    }
    setFiles(state.files);
    setChunkCount(state.chunkCount);
  }

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  async function handleFilesSelected(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    setBusy(true);
    setError("");
    const result = await uploadDocuments(selected);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    await refresh();
    onIndexChanged();
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleClearAll() {
    if (!confirm("Remove all documents and the built index? This can't be undone.")) return;
    setBusy(true);
    setError("");
    const result = await clearDocuments();
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setFiles([]);
    setChunkCount(0);
    onIndexChanged();
  }

  if (!open) return null;

  return (
    <div className="docs-overlay" onClick={onClose}>
      <div className="docs-panel" onClick={(e) => e.stopPropagation()}>
        <div className="docs-panel-header">
          <div>
            <div className="docs-panel-title">Documents</div>
            <div className="docs-panel-sub">
              {chunkCount > 0 ? `${chunkCount} indexed chunks` : "No documents indexed yet"}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>

        <label className={"upload-dropzone" + (busy ? " upload-dropzone-busy" : "")}>
          <IconUpload />
          <span>{busy ? "Processing…" : "Upload .txt or .pdf files"}</span>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.pdf"
            multiple
            hidden
            disabled={busy}
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
        </label>

        {error && <div className="docs-error">{error}</div>}

        <div className="docs-file-list">
          {files.length === 0 ? (
            <div className="docs-empty">Upload a document to replace the sample data and start asking questions about it.</div>
          ) : (
            files.map((f) => (
              <div key={f} className="docs-file-item">
                <IconFile />
                <span className="docs-file-name">{f}</span>
              </div>
            ))
          )}
        </div>

        {files.length > 0 && (
          <button className="docs-clear-btn" onClick={handleClearAll} disabled={busy}>
            <IconTrash />
            Remove all documents
          </button>
        )}
      </div>
    </div>
  );
}
