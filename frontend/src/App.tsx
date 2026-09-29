import { useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import SourcesPanel from "./components/SourcesPanel";
import { useChats } from "./useChats";
import { useDocuments } from "./useDocuments";
import { askQuestion, deleteChatData } from "./api";
import { Chat, ChatMessage } from "./types";

function titleFromQuestion(q: string): string {
  const trimmed = q.trim().replace(/\s+/g, " ");
  return trimmed.length > 42 ? trimmed.slice(0, 42) + "…" : trimmed;
}

export default function App() {
  const { chats, activeChat, activeId, setActiveId, newChat, deleteChat, renameChat, updateChat } = useChats();
  const [loading, setLoading] = useState(false);
  const [sourcesFor, setSourcesFor] = useState<ChatMessage | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const docs = useDocuments(activeChat.id);

  async function handleAsk(question: string) {
    const chatId = activeChat.id;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: question };

    updateChat(chatId, (chat) => ({
      ...chat,
      title: chat.messages.length === 0 && !chat.customTitle ? titleFromQuestion(question) : chat.title,
      messages: [...chat.messages, userMsg],
    }));

    // earlier messages (errors excluded) so a normal chat can follow the conversation
    const history = activeChat.messages
      .filter((m) => !m.error && m.content.trim())
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    // The reply is created on the first token and grows as more text arrives.
    // Tokens are buffered briefly so the screen isn't redrawn for every single one.
    // (State updates below are pure: they look at the chat itself, never at outside flags,
    // because React may run an update function more than once.)
    const assistantId = crypto.randomUUID();
    let buffered = "";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const upsert = (chat: Chat, msg: ChatMessage): Chat =>
      chat.messages.some((m) => m.id === assistantId)
        ? { ...chat, messages: chat.messages.map((m) => (m.id === assistantId ? msg : m)) }
        : { ...chat, messages: [...chat.messages, msg] };

    const flush = () => {
      timer = null;
      if (!buffered) return;
      const text = buffered;
      buffered = "";
      updateChat(chatId, (chat) => {
        const existing = chat.messages.find((m) => m.id === assistantId);
        return upsert(chat, { id: assistantId, role: "assistant", content: (existing?.content ?? "") + text });
      });
    };

    setLoading(true);
    const result = await askQuestion(question, chatId, history, (token) => {
      buffered += token;
      if (!timer) timer = setTimeout(flush, 60);
    });
    if (timer) clearTimeout(timer);
    buffered = "";
    setLoading(false);

    // final state of the reply: sources on success, or an error (keeping any partial text)
    const partial = result.answer ?? "";
    const finalMsg: ChatMessage = result.error
      ? partial
        ? { id: assistantId, role: "assistant", content: partial + "\n\n— stopped: " + result.error }
        : { id: assistantId, role: "assistant", content: result.error, error: true }
      : { id: assistantId, role: "assistant", content: partial, sources: result.sources ?? [], timing: result.timing };

    updateChat(chatId, (chat) => upsert(chat, finalMsg));

    if (!result.error) {
      setSourcesFor(finalMsg);
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
        documents={docs.documents}
        docsBusy={docs.busy}
        onRename={renameChat}
        onDeleteDoc={docs.remove}
        onSelect={(id) => {
          setActiveId(id);
          setPanelOpen(false);
        }}
        onNew={() => {
          newChat();
          setPanelOpen(false);
        }}
        onDelete={(id) => {
          deleteChat(id);
          deleteChatData(id); // also removes that chat's uploaded documents and index
        }}
      />

      <ChatWindow
        title={activeChat.title}
        messages={activeChat.messages}
        loading={loading}
        activeSourcesId={panelOpen ? sourcesFor?.id ?? null : null}
        documents={docs.documents}
        docsBusy={docs.busy}
        docsError={docs.error}
        docsNotice={docs.notice}
        onAsk={handleAsk}
        onOpenSources={handleOpenSources}
        onUpload={docs.upload}
        onDismissDocsMessage={docs.dismissMessages}
      />

      {panelOpen && <SourcesPanel message={sourcesFor} onClose={() => setPanelOpen(false)} />}
    </div>
  );
}
