import fs from "fs";
import path from "path";

/** The backend folder (parent of src/ and dist/). PYTHON_DIR in .env is relative to this. */
const BACKEND_DIR = path.resolve(__dirname, "..");

export const PYTHON_DIR = path.resolve(BACKEND_DIR, process.env.PYTHON_DIR || "../python");

/** Look for a virtualenv inside the python/ folder (venv, .venv, venv310, ...). */
function findVenvPython(): string | undefined {
  const rel = process.platform === "win32" ? path.join("Scripts", "python.exe") : path.join("bin", "python");
  let folders: string[] = [];
  try {
    folders = fs
      .readdirSync(PYTHON_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\.?venv/i.test(d.name))
      .map((d) => d.name);
  } catch {
    return undefined;
  }
  for (const folder of folders) {
    const candidate = path.join(PYTHON_DIR, folder, rel);
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function resolvePythonBin(): string {
  const configured = process.env.PYTHON_BIN?.trim();

  // A full path in .env is always respected.
  if (configured && /[\\/]/.test(configured)) return configured;

  // Unset, or just a bare command like "python3": prefer the project's own virtualenv,
  // because a bare "python3" on Windows is often the Microsoft Store stub that does nothing.
  const venv = findVenvPython();
  if (venv) return venv;

  return configured || (process.platform === "win32" ? "python" : "python3");
}

export const PYTHON_BIN = resolvePythonBin();
