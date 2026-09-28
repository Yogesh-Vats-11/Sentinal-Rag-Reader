import { Chat } from "../types";
import { IconPlus, IconTrash, IconScroll } from "./Icons";

interface Props {
  chats: Chat[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export default function Sidebar({ chats, activeId, onSelect, onNew, onDelete }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <IconScroll />
        <div>
          <div className="sidebar-brand-title">Sentinel</div>
          <div className="sidebar-brand-sub">Constitutional research</div>
        </div>
      </div>

      <button className="new-chat-btn" onClick={onNew}>
        <IconPlus />
        New chat
      </button>

      <div className="chat-list">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={"chat-item" + (chat.id === activeId ? " chat-item-active" : "")}
            onClick={() => onSelect(chat.id)}
          >
            <span className="chat-item-title">{chat.title}</span>
            <button
              className="chat-item-delete"
              aria-label="Delete chat"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(chat.id);
              }}
            >
              <IconTrash />
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">Answers are generated from indexed documents — verify against the source text.</div>
    </aside>
  );
}
