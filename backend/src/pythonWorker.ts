import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import readline from "readline";
import { PYTHON_BIN, PYTHON_DIR } from "./pythonConfig";

/**
 * One long-running Python process (python/worker.py) that does all the AI work.
 *
 * Starting a new Python process for every message means re-importing torch and
 * reloading the embedding model each time (many seconds). Keeping one process
 * alive means those load once. Requests and events are JSON lines over stdin/stdout.
 */

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface WorkerResult {
  ok: boolean;
  sources?: string[];
  output?: string;
  error?: string;
}

interface Pending {
  onToken?: (text: string) => void;
  resolve: (r: WorkerResult) => void;
}

let proc: ChildProcessWithoutNullStreams | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
let stderrTail = "";

function failAll(message: string) {
  for (const p of pending.values()) p.resolve({ ok: false, error: message });
  pending.clear();
}

function lastLines(text: string, n = 3): string {
  return text.trim().split(/\r?\n/).filter(Boolean).slice(-n).join(" | ");
}

function onLine(line: string) {
  let ev: { id?: number; type?: string; text?: string; sources?: string[]; output?: string; error?: string };
  try {
    ev = JSON.parse(line);
  } catch {
    return; // not protocol output
  }
  const p = ev.id !== undefined ? pending.get(ev.id) : undefined;
  if (!p) return;

  if (ev.type === "token") {
    p.onToken?.(ev.text ?? "");
  } else if (ev.type === "done") {
    pending.delete(ev.id!);
    p.resolve({ ok: true, sources: ev.sources ?? [] });
  } else if (ev.type === "result") {
    pending.delete(ev.id!);
    p.resolve({ ok: true, output: ev.output ?? "" });
  } else if (ev.type === "error") {
    pending.delete(ev.id!);
    p.resolve({ ok: false, error: ev.error ?? "Unknown error" });
  }
}

function ensureProcess(): ChildProcessWithoutNullStreams {
  if (proc) return proc;

  const child = spawn(PYTHON_BIN, ["-u", "worker.py"], {
    cwd: PYTHON_DIR,
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
  });
  proc = child;
  stderrTail = "";

  readline.createInterface({ input: child.stdout }).on("line", onLine);

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    stderrTail = (stderrTail + text).slice(-2000);
    process.stderr.write(text.replace(/^(?=.)/gm, "[python] "));
  });
  child.stdin.on("error", () => undefined); // process died; 'close' reports it

  child.on("error", (err) => {
    if (proc === child) proc = null;
    failAll(`Failed to launch Python (${PYTHON_BIN}): ${err.message}`);
  });
  child.on("close", (code) => {
    if (proc === child) proc = null;
    const detail = lastLines(stderrTail);
    failAll(`The Python helper stopped (exit code ${code}).${detail ? " " + detail : ""}`);
  });

  return child;
}

/** Start the worker now so models load in the background while you're still opening the app. */
export function startWorker() {
  ensureProcess();
}

/**
 * Send one request to the worker. `result` resolves when it finishes; tokens of an
 * answer are passed to onToken as they are generated. cancel() stops generation
 * (used when the browser goes away mid-answer).
 */
export function startRequest(
  op: "chat" | "ask" | "ingest" | "build",
  payload: Record<string, unknown>,
  onToken?: (text: string) => void
): { result: Promise<WorkerResult>; cancel: () => void } {
  const id = nextId++;
  const child = ensureProcess();

  const result = new Promise<WorkerResult>((resolve) => {
    pending.set(id, { onToken, resolve });
    child.stdin.write(JSON.stringify({ id, op, ...payload }) + "\n");
  });

  const cancel = () => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    p.resolve({ ok: false, error: "cancelled" });
    if (proc) proc.stdin.write(JSON.stringify({ op: "cancel", id }) + "\n");
  };

  return { result, cancel };
}
