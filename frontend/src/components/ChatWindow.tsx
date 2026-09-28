import { FormEvent, useEffect, useRef, useState } from "react";
import { ChatMessage, DocInfo } from "../types";
import { IconBook, IconSend, IconPaperclip, IconFile, IconClose, IconScroll } from "./Icons";

const CONSTITUTION_SUGGESTIONS = [
  "What does Article 21 guarantee?",
  "What are the Fundamental Rights?",
  "Explain the Directive Principles of State Policy",
];

const DOC_SUGGESTIONS = [
  "Summarise this document in a few points",
  "What are the key takeaways?",
  "List any important dates, names or numbers mentioned",
];

interface Props {
  title: string;
  messages: ChatMessage[];
  loading: boolean;
  activeSourcesId: string | null;
  documents: DocInfo[];
  docsBusy: boolean;
  docsError: string;
  docsNotice: string;
  onAsk: (question: string) => void;
  onOpenSources: (message: ChatMessage) => void;
  onUpload: (files: File[]) => void;
  onDeleteDoc: (name: string) => void;
  onDismissDocsMessage: () => void;
}

export default function ChatWindow({
  title,
  messages,
  loading,
  activeSourcesId,
  documents,
  docsBusy,
  docsError,
  docsNotice,
  onAsk,
  onOpenSources,
  onUpload,
  onDeleteDoc,
  onDismissDocsMessage,
}: Props) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasDocs = documents.length > 0;

  function handleFilesPicked(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (fileInputRef.current) fileInputRef.current.value = ""; // allow re-picking the same file
    if (files.length > 0) onUpload(files);
  }

  function handleDelete(name: string) {
    if (!confirm(`Remove "${name}" from this chat?`)) return;
    onDeleteDoc(name);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = draft.trim();
    if (!q || loading) return;
    onAsk(q);
    setDraft("");
  }

  return (
    <main className="chat-window">
      <header className="chat-header">
        <h1>{title}</h1>
        <p>
          {hasDocs
            ? "Answers come only from the documents attached to this chat."
            : "No documents attached — using the built-in Constitution of India."}
        </p>
      </header>

      <div className="message-list">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              <IconScroll />
            </div>
            <h2 className="empty-title">{hasDocs ? "Ask your documents" : "What would you like to know?"}</h2>
            <p className="empty-sub">
              {hasDocs
                ? `Every answer is drawn from ${documents.length === 1 ? documents[0].name : "the documents in this chat"} and shows exactly which passages it used.`
                : "Ask about the Constitution of India, or attach your own .txt or .pdf and ask questions about it. Every answer shows the passages it came from."}
            </p>

            <div className="suggestions">
              {(hasDocs ? DOC_SUGGESTIONS : CONSTITUTION_SUGGESTIONS).map((q) => (
                <button key={q} type="button" className="suggestion-btn" disabled={loading} onClick={() => onAsk(q)}>
                  {q}
                </button>
              ))}
            </div>

            {!hasDocs && (
              <button
                type="button"
                className="empty-attach"
                disabled={docsBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                Attach a document
              </button>
            )}
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={"message message-" + m.role}>
            <div className="message-role">{m.role === "user" ? "You" : "Sentinel"}</div>
            <div className={"message-bubble" + (m.error ? " message-bubble-error" : "")}>
              {m.content}
              {m.role === "assistant" && !m.error && (
                <button
                  className={"book-btn" + (activeSourcesId === m.id ? " book-btn-active" : "")}
                  onClick={() => onOpenSources(m)}
                  aria-label="View sources"
                  title="View sources"
                >
                  <IconBook active={activeSourcesId === m.id} />
                  {m.sources && m.sources.length > 0 && <span className="book-count">{m.sources.length}</span>}
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="message message-assistant">
            <div className="message-role">Sentinel</div>
            <div className="message-bubble message-bubble-loading">Consulting the indexed text…</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {(hasDocs || docsBusy || docsError || docsNotice) && (
        <div className="docs-bar">
          {hasDocs && (
            <div className="docs-chips">
              {documents.map((d) => (
                <span key={d.name} className="doc-chip" title={d.name}>
                  <IconFile />
                  <span className="doc-chip-name">{d.name}</span>
                  <button
                    type="button"
                    className="doc-chip-remove"
                    aria-label={`Remove ${d.name}`}
                    title="Remove document"
                    disabled={docsBusy}
                    onClick={() => handleDelete(d.name)}
                  >
                    <IconClose />
                  </button>
                </span>
              ))}
            </div>
          )}
          {docsBusy && <div className="docs-status">Reading and indexing…</div>}
          {docsError && (
            <div className="docs-message docs-message-error" role="alert">
              <span>{docsError}</span>
              <button type="button" onClick={onDismissDocsMessage} aria-label="Dismiss">
                <IconClose />
              </button>
            </div>
          )}
          {docsNotice && (
            <div className="docs-message" role="status">
              <span>{docsNotice}</span>
              <button type="button" onClick={onDismissDocsMessage} aria-label="Dismiss">
                <IconClose />
              </button>
            </div>
          )}
        </div>
      )}

      <form className="composer" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf"
          multiple
          hidden
          onChange={(e) => handleFilesPicked(e.target.files)}
        />
        <button
          type="button"
          className="attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={docsBusy}
          aria-label="Add document"
          title="Add a .txt or .pdf document to this chat"
        >
          <IconPaperclip />
        </button>
        <textarea
          rows={2}
          placeholder={hasDocs ? "Ask about your documents..." : "Ask a question, or attach a document..."}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as FormEvent);
            }
          }}
        />
        <button type="submit" disabled={loading || !draft.trim()} aria-label="Send">
          <IconSend />
        </button>
      </form>
    </main>
  );
}
