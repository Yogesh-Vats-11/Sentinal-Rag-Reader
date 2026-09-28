export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  error?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
}

export interface DocInfo {
  name: string;
  size: number;
}
