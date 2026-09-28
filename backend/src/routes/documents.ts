import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import {
  rawDestinationDir,
  listRawFiles,
  countProcessedChunks,
  clearAllDocuments,
  reingestAndRebuild,
} from "../documentsService";

const router = Router();

const ALLOWED_EXTENSIONS = new Set([".txt", ".pdf"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, rawDestinationDir()),
  filename: (_req, file, cb) => {
    // strip path traversal / odd characters, keep it readable
    const safeName = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB per file
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error("Only .txt and .pdf files are supported."));
      return;
    }
    cb(null, true);
  },
});

// GET current document state
router.get("/documents", (_req: Request, res: Response) => {
  res.json({
    files: listRawFiles(),
    chunkCount: countProcessedChunks(),
  });
});

// POST upload one or more files, then re-ingest + rebuild the index
router.post("/documents", upload.array("files", 10), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No files uploaded." });
  }

  const result = await reingestAndRebuild();
  if (!result.ok) {
    return res.status(500).json({ error: "Indexing failed.", details: result.output });
  }

  res.json({
    uploaded: files.map((f) => f.originalname),
    chunkCount: countProcessedChunks(),
  });
});

// DELETE all documents, chunks, and the built index
router.delete("/documents", (_req: Request, res: Response) => {
  clearAllDocuments();
  res.json({ files: [], chunkCount: 0 });
});

export default router;
