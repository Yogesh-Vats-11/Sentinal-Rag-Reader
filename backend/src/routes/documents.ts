import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  isValidChatId,
  ensureChatDirs,
  rawDir,
  listDocuments,
  countChunks,
  chunksForDocument,
  uniqueName,
  indexChat,
  removeDocument,
  deleteChatData,
  withChatLock,
} from "../documentsService";

const router = Router();

const ALLOWED_EXTENSIONS = new Set([".txt", ".pdf"]);

// Reject bad chat ids before they ever touch the filesystem (path traversal).
router.param("chatId", (_req, res, next, chatId) => {
  if (!isValidChatId(chatId)) {
    res.status(400).json({ error: "Invalid chat id." });
    return;
  }
  next();
});

/** Keep readable (including non-English) names, drop anything path-like or odd. */
function sanitizeFilename(original: string): string {
  // multer decodes multipart filenames as latin1; restore UTF-8 names
  const decoded = Buffer.from(original, "latin1").toString("utf8");
  const base = path.basename(decoded.replace(/\\/g, "/"));
  const cleaned = base
    .replace(/[^\p{L}\p{N}._-]/gu, "_")
    .replace(/^\.+/, "")
    .slice(-120);
  return cleaned || "document";
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const chatId = req.params.chatId;
      ensureChatDirs(chatId);
      cb(null, rawDir(chatId));
    },
    filename: (req, file, cb) => {
      cb(null, uniqueName(req.params.chatId, sanitizeFilename(file.originalname)));
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 }, // 25MB per file
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(sanitizeFilename(file.originalname)).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error("Only .txt and .pdf files are supported."));
      return;
    }
    cb(null, true);
  },
});

function state(chatId: string) {
  return { files: listDocuments(chatId), chunkCount: countChunks(chatId) };
}

// List this chat's documents
router.get("/chats/:chatId/documents", (req: Request, res: Response) => {
  res.json(state(req.params.chatId));
});

// Upload one or more documents to this chat, then (re)index them
router.post("/chats/:chatId/documents", (req: Request, res: Response, _next: NextFunction) => {
  const chatId = req.params.chatId;

  upload.array("files", 10)(req, res, async (err) => {
    if (err) {
      const message =
        err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
          ? "That file is too large (25 MB max)."
          : err.message || "Upload failed.";
      res.status(400).json({ error: message });
      return;
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "No files uploaded." });
      return;
    }

    try {
      const result = await withChatLock(chatId, async () => {
        const indexed = await indexChat(chatId);
        if (!indexed.ok) {
          // don't leave un-indexed files listed in the chat
          for (const f of files) fs.rmSync(path.join(rawDir(chatId), f.filename), { force: true });
          return { ok: false as const, details: indexed.output };
        }

        // A file with no chunks had no extractable text (scanned/image-only or unreadable PDF).
        const unreadable = files.map((f) => f.filename).filter((name) => chunksForDocument(chatId, name) === 0);
        if (unreadable.length > 0) {
          for (const name of unreadable) fs.rmSync(path.join(rawDir(chatId), name), { force: true });
          const reindexed = await indexChat(chatId);
          if (!reindexed.ok) return { ok: false as const, details: reindexed.output };
        }
        return { ok: true as const, unreadable };
      });

      if (!result.ok) {
        const reason = result.details.split("\n").filter(Boolean).pop() ?? "";
        res.status(500).json({ error: `Indexing failed: ${reason}`.slice(0, 400), details: result.details });
        return;
      }

      const rejected = new Set(result.unreadable);
      const accepted = files.map((f) => f.filename).filter((n) => !rejected.has(n));

      if (accepted.length === 0) {
        res.status(422).json({
          error: `Couldn't read any text from ${result.unreadable.join(", ")}. It may be a scanned/image-only PDF or corrupted.`,
        });
        return;
      }

      res.json({
        uploaded: accepted,
        skipped: result.unreadable,
        ...state(chatId),
      });
    } catch (e) {
      res.status(500).json({ error: "Upload failed.", details: (e as Error).message });
    }
  });
});

// Delete a single document from this chat and rebuild its index
router.delete("/chats/:chatId/documents/:name", async (req: Request, res: Response) => {
  const { chatId, name } = req.params;

  // only names that actually exist in this chat's listing are accepted
  if (!listDocuments(chatId).some((d) => d.name === name)) {
    res.status(404).json({ error: "Document not found in this chat." });
    return;
  }

  try {
    const result = await withChatLock(chatId, () => removeDocument(chatId, name));
    if (!result.ok) {
      res.status(500).json({ error: "Re-indexing failed.", details: result.output });
      return;
    }
    res.json(state(chatId));
  } catch (e) {
    res.status(500).json({ error: "Delete failed.", details: (e as Error).message });
  }
});

// Delete a whole chat's stored documents and index (called when the chat is deleted)
router.delete("/chats/:chatId", async (req: Request, res: Response) => {
  const chatId = req.params.chatId;
  await withChatLock(chatId, async () => deleteChatData(chatId));
  res.json({ files: [], chunkCount: 0 });
});

export default router;
