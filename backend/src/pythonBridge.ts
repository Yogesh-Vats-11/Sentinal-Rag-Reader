import { spawn } from "child_process";
import { PYTHON_BIN, PYTHON_DIR } from "./pythonConfig";

export interface QueryResult {
  answer?: string;
  sources?: string[];
  error?: string;
}

/**
 * Runs python/query.py "<question>" [--store <path>] as a child process and parses its
 * single-line JSON stdout. All RAG logic (embeddings, retrieval, the LLM
 * call) lives entirely in Python; this is just the bridge.
 */
export function runQuery(question: string, storePath?: string): Promise<QueryResult> {
  return new Promise((resolve) => {
    const args = ["query.py", question];
    if (storePath) args.push("--store", storePath);
    const proc = spawn(PYTHON_BIN, args, {
      cwd: PYTHON_DIR,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        resolve({ error: stderr.trim() || `python process exited with code ${code}` });
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim().split("\n").pop() as string);
        resolve(parsed);
      } catch {
        resolve({ error: `Failed to parse python output: ${stdout || stderr}` });
      }
    });

    proc.on("error", (err) => {
      resolve({ error: `Failed to launch python process: ${err.message}` });
    });
  });
}
