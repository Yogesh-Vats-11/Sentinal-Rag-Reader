export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  error?: boolean;
  /** how long the answer took, in milliseconds */
  timing?: { firstMs: number | null; totalMs: number };
}

export interface Chat {
  id: string;
  title: string;
  /** true once the user renamed the chat, so the first question no longer overwrites the title */
  customTitle?: boolean;
  createdAt: number;
  messages: ChatMessage[];
}

export interface DocInfo {
  name: string;
  size: number;
}
