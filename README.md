# Sentinel RAG Assistant

A chat app with two modes:

- **No document attached** — a normal conversation with the LLM, like any other AI assistant.
- **Document attached** — click the paperclip to add `.txt` / `.pdf` files to that chat. From then on,
  answers in that chat come *only* from its documents and show which passages they used.

Each chat has its own documents; nothing is shared between chats. Deleting a chat deletes its documents.

## Project layout

- **`python/`** — the AI logic: chunking, embeddings (FAISS + sentence-transformers), document answers and
  plain chat (LangChain + Ollama/OpenAI). `worker.py` is started once by the backend and stays running, so the
  models load once instead of on every message. Nothing here talks HTTP.
- **`backend/`** — TypeScript/Express API (`/api/query`, `/api/chats/:chatId/documents`, ...).
- **`frontend/`** — React chat UI (Vite).

Uploaded files, their chunks and their indexes are stored per chat in `python/chats/<chatId>/`
(`raw/`, `processed/`, `vectorstore/`). This folder is created automatically and is git-ignored.

## Setup

### 0. Ollama (default LLM backend, local, no API key)
```bash
# install from https://ollama.com, then pull a model that fits your RAM
ollama pull llama3.2:3b
ollama serve   # usually already running after install
```

### 1. Python
```bash
cd python
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
python -m pip install -r requirements.txt
cp .env.example .env    # set LLM_MODEL to the model you pulled
```
To use OpenAI instead, set `LLM_BACKEND=openai` and `OPENAI_API_KEY=...` in `python/.env`.
There is nothing to "build" up front — indexes are created when you upload a document.

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
npm run dev             # http://localhost:4000
```
The backend automatically uses a virtualenv found inside `python/` (`venv`, `.venv`, `venv310`, ...).
Or set `PYTHON_BIN` in `backend/.env` to a full path to `python`. On start it prints which Python it uses.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

## Speed

- **Answers stream** — text appears as it is generated instead of after the whole wait.
- **One long-running Python helper** keeps the embedding model, each chat's index and the LLM client loaded. It
  starts with the backend and warms up in the background (watch for `[python] [warmup] ...` in the backend log).
- **Ollama keeps the model in memory** between questions (`LLM_KEEP_ALIVE`, default 30 minutes).
- **Less text per question** — `TOP_K=3` retrieved chunks and a `MAX_TOKENS=600` cap on answer length.
- A slow **upload** is almost always the PDF reader, not the model — an illustrated or scanned PDF can take
  much longer to read than a plain-text one. `pypdfium2` (used by default) reads these far faster than the
  older `pypdf`; if you see a slow `ingest:` line in the timing log, make sure `pip install -r requirements.txt`
  has installed `pypdfium2`.
- If chatting itself is still slow, the model is the limit: use a smaller one (`llama3.2:1b`), lower `OLLAMA_NUM_CTX`,
  close other programs to free RAM, or use OpenAI (`LLM_BACKEND=openai`). All settings live in `python/.env`.
- Under every answer the app shows how long you waited (`First word 1.4s · total 4.9s`), and "Thinking…" shows
  a running seconds counter.
- `python speedtest.py` (in `python/`, venv active) measures your machine and says what is slow. The backend
  also prints a `[python] [timing] ...` line after every answer showing where the time went.
- `python query.py "hello"` is a one-shot tool for trying the model by hand (the backend doesn't use it).

## Documents

- Add: paperclip button (up to 10 files at a time, 25 MB each; `.txt` and `.pdf`).
- Remove: the **×** on a document chip.
- Scanned / image-only PDFs have no text to read and are rejected with a message.

API (under `/api`): `POST /query` with `{ question, chatId, history }` (streams one JSON object per line), `GET|POST /chats/:chatId/documents`,
`DELETE /chats/:chatId/documents/:name`, `DELETE /chats/:chatId`.

## Git

`.gitignore` excludes `.env` files, `node_modules`, virtualenvs and `python/chats/`. Never commit real
API keys — copy `.env.example` to `.env` locally.
