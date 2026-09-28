export interface QueryResponse {
  answer?: string;
  sources?: string[];
  error?: string;
}

export async function askQuestion(question: string): Promise<QueryResponse> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  const data = (await res.json()) as QueryResponse;
  if (!res.ok) {
    return { error: data.error || "Something went wrong." };
  }
  return data;
}
