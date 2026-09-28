import { useCallback, useEffect, useRef, useState } from "react";
import { DocInfo } from "./types";
import { fetchDocuments, uploadDocuments, deleteDocument } from "./api";

/** Documents attached to one chat, kept in sync with the backend. */
export function useDocuments(chatId: string) {
  const [documents, setDocuments] = useState<DocInfo[]>([]);
  const [busyChatId, setBusyChatId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // lets async results be ignored if the user has switched to another chat meanwhile
  const currentChat = useRef(chatId);
  currentChat.current = chatId;

  useEffect(() => {
    let cancelled = false;
    setDocuments([]);
    setError("");
    setNotice("");
    fetchDocuments(chatId).then((state) => {
      if (cancelled) return;
      if (state.error) setError(state.error);
      else setDocuments(state.files);
    });
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const id = chatId;
      setBusyChatId(id);
      setError("");
      setNotice("");
      const state = await uploadDocuments(id, files);
      setBusyChatId((cur) => (cur === id ? null : cur));
      if (currentChat.current !== id) return;

      if (state.error) {
        setError(state.error);
        return;
      }
      setDocuments(state.files);
      if (state.skipped && state.skipped.length > 0) {
        setNotice(`No readable text in ${state.skipped.join(", ")} (scanned PDF?), so it was not added.`);
      }
    },
    [chatId]
  );

  const remove = useCallback(
    async (name: string) => {
      const id = chatId;
      setBusyChatId(id);
      setError("");
      setNotice("");
      const state = await deleteDocument(id, name);
      setBusyChatId((cur) => (cur === id ? null : cur));
      if (currentChat.current !== id) return;

      if (state.error) setError(state.error);
      else setDocuments(state.files);
    },
    [chatId]
  );

  return {
    documents,
    busy: busyChatId === chatId,
    error,
    notice,
    upload,
    remove,
    dismissMessages: () => {
      setError("");
      setNotice("");
    },
  };
}
