import { useEffect, useState } from "react";
import { Chat } from "./types";

const STORAGE_KEY = "sentinel.chats.v1";

function makeChat(title = "New chat"): Chat {
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: Date.now(),
    messages: [],
  };
}

export function useChats() {
  const [chats, setChats] = useState<Chat[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Chat[];
        if (parsed.length > 0) return parsed;
      }
    } catch {
      // ignore corrupt storage, fall through to a fresh chat
    }
    return [makeChat()];
  });

  const [activeId, setActiveId] = useState<string>(chats[0].id);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  function newChat() {
    const chat = makeChat();
    setChats((prev) => [chat, ...prev]);
    setActiveId(chat.id);
  }

  function deleteChat(id: string) {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh = makeChat();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) {
        setActiveId(next[0].id);
      }
      return next;
    });
  }

  function renameChat(id: string, title: string) {
    const clean = title.trim().slice(0, 60);
    if (!clean) return; // ignore an empty name, keep the old one
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title: clean, customTitle: true } : c)));
  }

  function updateChat(id: string, updater: (chat: Chat) => Chat) {
    setChats((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }

  const activeChat = chats.find((c) => c.id === activeId) ?? chats[0];

  return { chats, activeChat, activeId, setActiveId, newChat, deleteChat, renameChat, updateChat };
}
