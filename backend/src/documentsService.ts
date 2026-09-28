import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const PYTHON_BIN = process.env.PYTHON_BIN || "python3";
const PYTHON_DIR = path.resolve(__dirname, process.env.PYTHON_DIR || "../../python");

const RAW_DIR = path.join(PYTHON_DIR, "data_ingest", "raw");
const PROCESSED_DIR = path.join(PYTHON_DIR, "data_ingest", "processed");
const VECTORSTORE_DIR = path.join(PYTHON_DIR, "vectorstore");

function ensureDirs() {
  for (const dir of [RAW_DIR, PROCESSED_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
ensureDirs();

function runPython(scriptArgs: string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_BIN, scriptArgs, { cwd: PYTHON_DIR });
    let out = "";
    proc.stdout.on("data", (c) => (out += c.toString()));
    proc.stderr.on("data", (c) => (out += c.toString()));
    proc.on("close", (code) => resolve({ ok: code === 0, output: out.trim() }));
    proc.on("error", (err) => resolve({ ok: false, output: err.message }));
  });
}

/** Re-chunk everything in data_ingest/raw and rebuild the FAISS index from it. */
export async function reingestAndRebuild(): Promise<{ ok: boolean; output: string }> {
  const ingest = await runPython(["ingest.py"]);
  if (!ingest.ok) return ingest;

  const build = await runPython(["build_index.py"]);
  return { ok: build.ok, output: ingest.output + "\n" + build.output };
}

export function rawDestinationDir(): string {
  return RAW_DIR;
}

export function listRawFiles(): string[] {
  ensureDirs();
  return fs
    .readdirSync(RAW_DIR)
    .filter((f) => f.toLowerCase().endsWith(".txt") || f.toLowerCase().endsWith(".pdf"))
    .sort();
}

export function countProcessedChunks(): number {
  ensureDirs();
  return fs.readdirSync(PROCESSED_DIR).filter((f) => f.endsWith(".txt")).length;
}

/** Delete all raw source files, processed chunks, and the built index. */
export function clearAllDocuments(): void {
  for (const dir of [RAW_DIR, PROCESSED_DIR]) {
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        fs.rmSync(path.join(dir, f), { force: true });
      }
    }
  }
  if (fs.existsSync(VECTORSTORE_DIR)) {
    fs.rmSync(VECTORSTORE_DIR, { recursive: true, force: true });
  }
}
