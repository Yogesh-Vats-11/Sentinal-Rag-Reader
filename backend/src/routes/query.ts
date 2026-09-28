import { Router, Request, Response } from "express";
import { runQuery } from "../pythonBridge";
import { isValidChatId, hasIndex, ensureIndex, vectorstoreDir, withChatLock } from "../documentsService";

const router = Router();

router.post("/query", async (req: Request, res: Response) => {
  const { question, chatId } = req.body as { question?: string; chatId?: string };

  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Please enter a question about your documents." });
  }
  if (chatId !== undefined && !isValidChatId(chatId)) {
    return res.status(400).json({ error: "Invalid chat id." });
  }

  // If this chat has its own documents, search only those. Otherwise the
  // Python side falls back to the built-in default index.
  const ask = async () => {
    if (chatId) {
      const built = await ensureIndex(chatId);
      if (!built.ok) return { error: `Couldn't index this chat's documents: ${built.output.split("\n").pop()}` };
    }
    return runQuery(question.trim(), chatId && hasIndex(chatId) ? vectorstoreDir(chatId) : undefined);
  };
  const result = chatId ? await withChatLock(chatId, ask) : await ask();

  if (result.error) {
    return res.status(500).json({ error: result.error });
  }

  return res.json({ answer: result.answer, sources: result.sources ?? [] });
});

export default router;
