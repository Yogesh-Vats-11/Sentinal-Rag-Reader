import { Router, Request, Response } from "express";
import { startRequest, HistoryMessage } from "../pythonWorker";
import { isValidChatId, hasIndex, ensureIndex, vectorstoreDir, withChatLock } from "../documentsService";

const router = Router();

/** Keep only well-formed recent messages from the browser. */
function cleanHistory(raw: unknown): HistoryMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is HistoryMessage =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
}

/**
 * Answers are streamed to the browser as they are generated: one JSON object per line,
 *   {"type":"token","text":"..."}  ...  then {"type":"done","sources":[...]} or {"type":"error","error":"..."}
 * Problems found before any text is produced are returned as a normal JSON error response.
 */
router.post("/query", async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const { question, chatId, history } = req.body as { question?: string; chatId?: string; history?: unknown };

  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Please enter a message." });
  }
  if (chatId !== undefined && !isValidChatId(chatId)) {
    return res.status(400).json({ error: "Invalid chat id." });
  }

  // A chat with uploaded documents answers only from them. A chat without any
  // documents is a normal conversation with the model.
  const run = async () => {
    if (chatId) {
      const built = await ensureIndex(chatId);
      if (!built.ok) {
        res.status(500).json({ error: `Couldn't index this chat's documents: ${built.output.split("\n").pop()}` });
        return;
      }
    }

    const store = chatId && hasIndex(chatId) ? vectorstoreDir(chatId) : undefined;

    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const write = (obj: unknown) => res.write(JSON.stringify(obj) + "\n");
    let firstTokenAt: number | null = null;

    const { result, cancel } = startRequest(
      store ? "ask" : "chat",
      { question: question.trim(), store, history: store ? [] : cleanHistory(history) },
      (text) => {
        if (firstTokenAt === null) firstTokenAt = Date.now();
        write({ type: "token", text });
      }
    );

    // browser closed or reloaded mid-answer: stop generating instead of burning CPU
    res.on("close", () => {
      if (!res.writableFinished) cancel();
    });

    const outcome = await result;
    if (res.writableEnded || res.destroyed) return;
    write(
      outcome.ok
        ? {
            type: "done",
            sources: outcome.sources ?? [],
            // what the user actually waited: from sending the question to the first word / the end
            timing: { firstMs: firstTokenAt === null ? null : firstTokenAt - startedAt, totalMs: Date.now() - startedAt },
          }
        : { type: "error", error: outcome.error }
    );
    res.end();
  };

  try {
    await (chatId ? withChatLock(chatId, run) : run());
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: (e as Error).message });
    else res.end();
  }
});

export default router;
