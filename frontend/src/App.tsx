import { useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import SourcesPanel from "./components/SourcesPanel";
import { useChats } from "./useChats";
import { askQuestion } from "./api";
import { ChatMessage } from "./types";

function titleFromQuestion(q: string): string {
  const trimmed = q.trim().replace(/\s+/g, " ");
  return trimmed.length > 42 ? trimmed.slice(0, 42) + "…" : trimmed;
}

export default function App() {
  const { chats, activeChat, activeId, setActiveId, newChat, deleteChat, updateChat } = useChats();
  const [loading, setLoading] = useState(false);
  const [sourcesFor, setSourcesFor] = useState<ChatMessage | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  async function handleAsk(question: string) {
    const chatId = activeChat.id;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: question };

    updateChat(chatId, (chat) => ({
      ...chat,
      title: chat.messages.length === 0 ? titleFromQuestion(question) : chat.title,
      messages: [...chat.messages, userMsg],
    }));

    setLoading(true);
    const result = await askQuestion(question);
    setLoading(false);

    const assistantMsg: ChatMessage = result.error
      ? { id: crypto.randomUUID(), role: "assistant", content: result.error, error: true }
      : { id: crypto.randomUUID(), role: "assistant", content: result.answer ?? "", sources: result.sources ?? [] };

    updateChat(chatId, (chat) => ({ ...chat, messages: [...chat.messages, assistantMsg] }));

    if (!result.error) {
      setSourcesFor(assistantMsg);
    }
  }

  function handleOpenSources(message: ChatMessage) {
    setSourcesFor(message);
    setPanelOpen(true);
  }

  return (
    <div className={"app-shell" + (panelOpen ? " app-shell-with-panel" : "")}>
      <Sidebar
        chats={chats}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id);
          setPanelOpen(false);
        }}
        onNew={() => {
          newChat();
          setPanelOpen(false);
        }}
        onDelete={deleteChat}
      />

      <ChatWindow
        title={activeChat.title}
        messages={activeChat.messages}
        loading={loading}
        activeSourcesId={panelOpen ? sourcesFor?.id ?? null : null}
        onAsk={handleAsk}
        onOpenSources={handleOpenSources}
      />

      {panelOpen && <SourcesPanel message={sourcesFor} onClose={() => setPanelOpen(false)} />}
    </div>
  );
}
