import { DocInfo } from "./types";

export interface QueryResponse {
  answer?: string;
  sources?: string[];
  error?: string;
}

export interface DocumentsState {
  files: DocInfo[];
  chunkCount: number;
  uploaded?: string[];
  skipped?: string[];
  error?: string;
}

/** Parse a JSON body, tolerating non-JSON error pages (e.g. a proxy 502 when the backend is down). */
async function readJson<T>(res: Response): Promise<T & { error?: string }> {
  try {
    return (await res.json()) as T & { error?: string };
  } catch {
    return { error: `Request failed (${res.status}). Is the backend running?` } as T & { error?: string };
  }
}

export async function askQuestion(question: string, chatId: string): Promise<QueryResponse> {
  try {
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, chatId }),
    });
    const data = await readJson<QueryResponse>(res);
    if (!res.ok) return { error: data.error || "Something went wrong." };
    return data;
  } catch {
    return { error: "Couldn't reach the backend. Is it running on port 4000?" };
  }
}

const emptyState = (error: string): DocumentsState => ({ files: [], chunkCount: 0, error });

export async function fetchDocuments(chatId: string): Promise<DocumentsState> {
  try {
    const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/documents`);
    const data = await readJson<DocumentsState>(res);
    if (!res.ok) return emptyState(data.error || "Couldn't load documents.");
    return data;
  } catch {
    return emptyState("Couldn't reach the backend.");
  }
}

export async function uploadDocuments(chatId: string, files: File[]): Promise<DocumentsState> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  try {
    const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/documents`, {
      method: "POST",
      body: form,
    });
    const data = await readJson<DocumentsState>(res);
    if (!res.ok) return emptyState(data.error || "Upload failed.");
    return data;
  } catch {
    return emptyState("Couldn't reach the backend.");
  }
}

export async function deleteDocument(chatId: string, name: string): Promise<DocumentsState> {
  try {
    const res = await fetch(
      `/api/chats/${encodeURIComponent(chatId)}/documents/${encodeURIComponent(name)}`,
      { method: "DELETE" }
    );
    const data = await readJson<DocumentsState>(res);
    if (!res.ok) return emptyState(data.error || "Couldn't delete the document.");
    return data;
  } catch {
    return emptyState("Couldn't reach the backend.");
  }
}

/** Remove everything the backend stores for a chat (used when the chat is deleted). */
export function deleteChatData(chatId: string): void {
  fetch(`/api/chats/${encodeURIComponent(chatId)}`, { method: "DELETE" }).catch(() => undefined);
}
