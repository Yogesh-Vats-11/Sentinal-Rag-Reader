import { FormEvent, useEffect, useRef, useState } from "react";
import { ChatMessage, DocInfo } from "../types";
import { IconBook, IconSend, IconPaperclip, IconClose, IconScroll } from "./Icons";

function subtitleForDocs(docs: DocInfo[]): string {
  const names = docs.map((d) => d.name).join(", ");
  return "Answering from " + (names.length > 80 ? names.slice(0, 80) + "…" : names);
}

/** "Thinking…" with a running seconds counter, so a slow start is visible rather than a mystery. */
function Thinking() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <>Thinking…{seconds >= 2 ? ` ${seconds}s` : ""}</>;
}

function formatTiming(t: NonNullable<ChatMessage["timing"]>): string {
  const secs = (ms: number) => (ms / 1000).toFixed(1) + "s";
  return (t.firstMs === null ? "" : `First word ${secs(t.firstMs)} · `) + `total ${secs(t.totalMs)}`;
}

const GENERAL_SUGGESTIONS = [
  "Explain how a neural network learns, in simple words",
  "Help me write a polite follow-up email",
  "Give me a 4-week plan to learn Python",
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
            ? subtitleForDocs(documents)
            : "Upload a document to ask questions about it."}
        </p>
      </header>

      <div className="message-list">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              <IconScroll />
            </div>
            <h2 className="empty-title">{hasDocs ? "Ask your documents" : "How can I help?"}</h2>
            <p className="empty-sub">
              {hasDocs
                ? `Every answer is drawn from ${documents.length === 1 ? documents[0].name : "the documents in this chat"} and shows exactly which passages it used.`
                : "Chat about anything, or attach a .txt or .pdf and ask questions about it. Answers about a document show the passages they came from."}
            </p>

            <div className="suggestions">
              {(hasDocs ? DOC_SUGGESTIONS : GENERAL_SUGGESTIONS).map((q) => (
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
              {m.role === "assistant" && !m.error && m.sources && m.sources.length > 0 && (
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
            {m.role === "assistant" && m.timing && <div className="message-timing">{formatTiming(m.timing)}</div>}
          </div>
        ))}

        {loading && (messages.length === 0 || messages[messages.length - 1].role === "user") && (
          <div className="message message-assistant">
            <div className="message-role">Sentinel</div>
            <div className="message-bubble message-bubble-loading">
              <Thinking />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {(docsBusy || docsError || docsNotice) && (
        <div className="docs-bar">
          {docsBusy && <div className="docs-status">Reading and indexing your document…</div>}
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
          placeholder={hasDocs ? "Ask about your documents..." : "Message Sentinel, or attach a document..."}
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
