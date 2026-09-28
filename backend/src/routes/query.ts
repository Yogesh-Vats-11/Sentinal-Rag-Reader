import { Router, Request, Response } from "express";
import { runQuery } from "../pythonBridge";

const router = Router();

router.post("/query", async (req: Request, res: Response) => {
  const { question } = req.body as { question?: string };

  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Please enter a question about your documents." });
  }

  const result = await runQuery(question.trim());

  if (result.error) {
    return res.status(500).json({ error: result.error });
  }

  return res.json({ answer: result.answer, sources: result.sources ?? [] });
});

export default router;
