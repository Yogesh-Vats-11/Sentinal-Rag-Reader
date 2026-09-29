import { DocInfo } from "./types";

export interface QueryResponse {
  answer?: string;
  sources?: string[];
  timing?: { firstMs: number | null; totalMs: number };
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

export interface HistoryItem {
  role: "user" | "assistant";
  content: string;
}

/**
 * Ask a question. The answer arrives as a stream: onToken is called with each piece of
 * text as it is generated, so the reply appears immediately instead of after the full wait.
 */
export async function askQuestion(
  question: string,
  chatId: string,
  history: HistoryItem[] = [],
  onToken?: (text: string) => void
): Promise<QueryResponse> {
  let answer = "";
  try {
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, chatId, history }),
    });

    if (!res.ok || !res.body) {
      const data = await readJson<QueryResponse>(res);
      return { error: data.error || "Something went wrong." };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sources: string[] = [];
    let timing: QueryResponse["timing"];
    let finished = false;
    let error: string | undefined;

    const handleLine = (line: string) => {
      if (!line.trim()) return;
      let ev: { type?: string; text?: string; sources?: string[]; timing?: QueryResponse["timing"]; error?: string };
      try {
        ev = JSON.parse(line);
      } catch {
        return;
      }
      if (ev.type === "token" && ev.text) {
        answer += ev.text;
        onToken?.(ev.text);
      } else if (ev.type === "done") {
        finished = true;
        sources = ev.sources ?? [];
        timing = ev.timing;
      } else if (ev.type === "error") {
        finished = true;
        error = ev.error || "Something went wrong.";
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        handleLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
    }
    handleLine(buffer);

    if (error) return { answer, error };
    if (!finished) return { answer, error: "The connection was lost before the answer finished." };
    return { answer, sources, timing };
  } catch {
    return { answer, error: "Couldn't reach the backend. Is it running on port 4000?" };
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
