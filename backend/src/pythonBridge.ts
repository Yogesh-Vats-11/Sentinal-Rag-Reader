import { spawn } from "child_process";
import { PYTHON_BIN, PYTHON_DIR } from "./pythonConfig";

export interface QueryResult {
  answer?: string;
  sources?: string[];
  error?: string;
}

/**
 * Runs python/query.py "<question>" [--store <path>] [--history] as a child process and parses its
 * single-line JSON stdout. All RAG logic (embeddings, retrieval, the LLM
 * call) lives entirely in Python; this is just the bridge.
 */
export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export function runQuery(question: string, storePath?: string, history: HistoryMessage[] = []): Promise<QueryResult> {
  return new Promise((resolve) => {
    const args = ["query.py", question];
    if (storePath) args.push("--store", storePath);
    // earlier messages only matter for a normal chat (no documents); they go over stdin
    // so long conversations can't hit the Windows command-line length limit
    const sendHistory = !storePath && history.length > 0;
    if (sendHistory) args.push("--history");
    const proc = spawn(PYTHON_BIN, args, {
      cwd: PYTHON_DIR,
    });
    if (sendHistory) proc.stdin.write(JSON.stringify(history));
    proc.stdin.on("error", () => undefined);
    proc.stdin.end();

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
