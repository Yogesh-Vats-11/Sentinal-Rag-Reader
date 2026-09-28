import { FormEvent, useEffect, useRef, useState } from "react";
import { ChatMessage } from "../types";
import { IconBook, IconSend } from "./Icons";

interface Props {
  title: string;
  messages: ChatMessage[];
  loading: boolean;
  activeSourcesId: string | null;
  onAsk: (question: string) => void;
  onOpenSources: (message: ChatMessage) => void;
}

export default function ChatWindow({ title, messages, loading, activeSourcesId, onAsk, onOpenSources }: Props) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

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
        <p>Ask questions about your indexed documents. Answers cite the source chunks they draw from.</p>
      </header>

      <div className="message-list">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>No messages yet. Ask something like:</p>
            <p className="empty-example">"What does Article 21 guarantee?"</p>
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

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          rows={2}
          placeholder="Ask about your docs..."
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
