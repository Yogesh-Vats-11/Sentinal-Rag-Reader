import { useEffect, useRef, useState } from "react";
import { Chat, DocInfo } from "../types";
import { IconPlus, IconTrash, IconScroll, IconPencil, IconFile, IconClose } from "./Icons";

interface Props {
  chats: Chat[];
  activeId: string;
  documents: DocInfo[]; // documents of the active chat
  docsBusy: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDeleteDoc: (name: string) => void;
}

export default function Sidebar({
  chats,
  activeId,
  documents,
  docsBusy,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onDeleteDoc,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingId]);

  function startEdit(chat: Chat) {
    setEditingId(chat.id);
    setDraft(chat.title);
  }

  function commitEdit() {
    if (editingId) onRename(editingId, draft);
    setEditingId(null);
  }

  function handleDeleteDoc(name: string) {
    if (!confirm(`Remove "${name}" from this chat?`)) return;
    onDeleteDoc(name);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <IconScroll />
        <div>
          <div className="sidebar-brand-title">Sentinel</div>
          <div className="sidebar-brand-sub">Document assistant</div>
        </div>
      </div>

      <button className="new-chat-btn" onClick={onNew}>
        <IconPlus />
        New chat
      </button>

      <div className="chat-list">
        {chats.map((chat) => {
          const active = chat.id === activeId;
          const editing = chat.id === editingId;
          return (
            <div key={chat.id} className="chat-group">
              <div
                className={"chat-item" + (active ? " chat-item-active" : "")}
                onClick={() => !editing && onSelect(chat.id)}
              >
                {editing ? (
                  <input
                    ref={inputRef}
                    className="chat-item-input"
                    value={draft}
                    maxLength={60}
                    aria-label="Chat name"
                    onChange={(e) => setDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <span
                    className="chat-item-title"
                    title="Double-click to rename"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startEdit(chat);
                    }}
                  >
                    {chat.title}
                  </span>
                )}

                {!editing && (
                  <span className="chat-item-actions">
                    <button
                      className="chat-item-btn"
                      aria-label="Rename chat"
                      title="Rename"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(chat);
                      }}
                    >
                      <IconPencil />
                    </button>
                    <button
                      className="chat-item-btn"
                      aria-label="Delete chat"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(chat.id);
                      }}
                    >
                      <IconTrash />
                    </button>
                  </span>
                )}
              </div>

              {active && (documents.length > 0 || docsBusy) && (
                <div className="chat-docs">
                  {documents.map((d) => (
                    <div key={d.name} className="chat-doc" title={d.name}>
                      <IconFile />
                      <span className="chat-doc-name">{d.name}</span>
                      <button
                        className="chat-doc-remove"
                        aria-label={`Remove ${d.name}`}
                        title="Remove document"
                        disabled={docsBusy}
                        onClick={() => handleDeleteDoc(d.name)}
                      >
                        <IconClose />
                      </button>
                    </div>
                  ))}
                  {docsBusy && <div className="chat-doc-status">Indexing…</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">AI can make mistakes — check important information.</div>
    </aside>
  );
}
