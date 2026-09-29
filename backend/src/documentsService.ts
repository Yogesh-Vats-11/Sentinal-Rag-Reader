import fs from "fs";
import path from "path";

import { PYTHON_DIR } from "./pythonConfig";
import { startRequest } from "./pythonWorker";

/**
 * Every chat gets its own folder so its documents and index never mix with
 * another chat's:
 *
 *   python/chats/<chatId>/raw          uploaded .txt / .pdf files
 *   python/chats/<chatId>/processed    chunk files written by ingest.py
 *   python/chats/<chatId>/vectorstore  FAISS index built from those chunks
 */
const CHATS_DIR = path.join(PYTHON_DIR, "chats");

export interface DocInfo {
  name: string;
  size: number;
}

/** chat ids come from the browser; only allow what crypto.randomUUID() produces (plus safe variants). */
export function isValidChatId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

function chatDir(chatId: string) {
  return path.join(CHATS_DIR, chatId);
}
export function rawDir(chatId: string) {
  return path.join(chatDir(chatId), "raw");
}
function processedDir(chatId: string) {
  return path.join(chatDir(chatId), "processed");
}
export function vectorstoreDir(chatId: string) {
  return path.join(chatDir(chatId), "vectorstore");
}

export function ensureChatDirs(chatId: string) {
  fs.mkdirSync(rawDir(chatId), { recursive: true });
  fs.mkdirSync(processedDir(chatId), { recursive: true });
}

// ---------------------------------------------------------------------------
// Per-chat lock: uploads, deletes and questions for one chat run one at a time,
// so a question never hits an index that is half-way through being rebuilt.
// ---------------------------------------------------------------------------
const locks = new Map<string, Promise<unknown>>();

export function withChatLock<T>(chatId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(chatId) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  locks.set(chatId, next);
  next
    .finally(() => {
      if (locks.get(chatId) === next) locks.delete(chatId);
    })
    .catch(() => undefined);
  return next;
}

// ---------------------------------------------------------------------------

export function listDocuments(chatId: string): DocInfo[] {
  const dir = rawDir(chatId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(txt|pdf)$/i.test(f))
    .sort()
    .map((name) => ({ name, size: fs.statSync(path.join(dir, name)).size }));
}

function processedChunkFiles(chatId: string): string[] {
  const dir = processedDir(chatId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".txt"));
}

export function countChunks(chatId: string): number {
  return processedChunkFiles(chatId).length;
}

export function chunksForDocument(chatId: string, name: string): number {
  const prefix = `${name}__chunk_`;
  return processedChunkFiles(chatId).filter((f) => f.startsWith(prefix)).length;
}

/** True when this chat has its own documents and a built index to search. */
export function hasIndex(chatId: string): boolean {
  return (
    listDocuments(chatId).length > 0 &&
    fs.existsSync(path.join(vectorstoreDir(chatId), "index.faiss"))
  );
}

/**
 * If a chat has documents but no index (e.g. an earlier build failed because Python
 * wasn't set up yet), build it now. Call inside withChatLock.
 */
export async function ensureIndex(chatId: string): Promise<{ ok: boolean; output: string }> {
  if (listDocuments(chatId).length === 0 || fs.existsSync(path.join(vectorstoreDir(chatId), "index.faiss"))) {
    return { ok: true, output: "" };
  }
  return indexChat(chatId);
}

function clearIndex(chatId: string) {
  fs.rmSync(vectorstoreDir(chatId), { recursive: true, force: true });
  for (const f of processedChunkFiles(chatId)) {
    fs.rmSync(path.join(processedDir(chatId), f), { force: true });
  }
}

/**
 * Re-chunk every document in the chat and rebuild its index. Call inside
 * withChatLock. With no documents (or none with readable text) the index is
 * simply removed, and the chat falls back to the built-in text.
 */
export async function indexChat(chatId: string): Promise<{ ok: boolean; output: string }> {
  ensureChatDirs(chatId);

  const ingest = await startRequest("ingest", {
    raw: rawDir(chatId),
    processed: processedDir(chatId),
    clean: true,
  }).result;
  if (!ingest.ok) return { ok: false, output: ingest.error ?? "" };

  if (countChunks(chatId) === 0) {
    fs.rmSync(vectorstoreDir(chatId), { recursive: true, force: true });
    return { ok: true, output: ingest.output ?? "" };
  }

  const build = await startRequest("build", {
    processed: processedDir(chatId),
    store: vectorstoreDir(chatId),
  }).result;
  return build.ok
    ? { ok: true, output: (ingest.output ?? "") + "\n" + (build.output ?? "") }
    : { ok: false, output: build.error ?? "" };
}

/** Delete one document from a chat and rebuild (or drop) its index. Call inside withChatLock. */
export async function removeDocument(chatId: string, name: string): Promise<{ ok: boolean; output: string }> {
  fs.rmSync(path.join(rawDir(chatId), name), { force: true });

  if (listDocuments(chatId).length === 0) {
    clearIndex(chatId);
    return { ok: true, output: "" };
  }
  return indexChat(chatId);
}

/** Remove everything stored for a chat (used when the chat itself is deleted). */
export function deleteChatData(chatId: string) {
  fs.rmSync(chatDir(chatId), { recursive: true, force: true });
}

/** Pick a file name that doesn't collide with an existing document in this chat. */
export function uniqueName(chatId: string, safeName: string): string {
  const dir = rawDir(chatId);
  if (!fs.existsSync(path.join(dir, safeName))) return safeName;
  const ext = path.extname(safeName);
  const stem = safeName.slice(0, safeName.length - ext.length);
  for (let i = 2; i < 1000; i++) {
    const candidate = `${stem}_${i}${ext}`;
    if (!fs.existsSync(path.join(dir, candidate))) return candidate;
  }
  return `${stem}_${Date.now()}${ext}`;
}
