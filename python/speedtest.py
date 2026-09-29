"""
Find out what is making answers slow. Run from the python folder with the venv active:

    python speedtest.py

It measures your machine directly (no app involved): Python start-up, the embedding model,
and how fast Ollama loads the model, reads a prompt and writes an answer.
"""

import time

t_start = time.time()

import requests

from config import LLM_BACKEND, LLM_MODEL, OLLAMA_BASE_URL, EMBEDDING_MODEL, OLLAMA_NUM_CTX

print(f"Model: {LLM_MODEL} (backend: {LLM_BACKEND})\n")


def generate(prompt: str, n_predict: int):
    options = {"num_predict": n_predict}
    if OLLAMA_NUM_CTX:
        options["num_ctx"] = OLLAMA_NUM_CTX
    r = requests.post(
        f"{OLLAMA_BASE_URL}/api/generate",
        json={"model": LLM_MODEL, "prompt": prompt, "stream": False, "keep_alive": "30m", "options": options},
        timeout=600,
    )
    r.raise_for_status()
    return r.json()


def sec(ns):
    return (ns or 0) / 1e9


if LLM_BACKEND == "ollama":
    print("1) Ollama")
    try:
        d = generate("Say hi.", 5)
        print(f"   loading the model into memory: {sec(d.get('load_duration')):.1f}s  (only slow the first time / after idle)")

        d = generate("Explain in one paragraph what a neural network is.", 80)
        tps = d["eval_count"] / max(sec(d["eval_duration"]), 1e-6)
        print(f"   writing speed: {tps:.1f} words-pieces/second  ({d['eval_count']} tokens)")

        filler = "The quick brown fox jumps over the lazy dog. " * 70  # ~ what 3 document chunks look like
        d = generate(filler + "\n\nIn one short sentence, what animal is mentioned?", 30)
        ptps = d["prompt_eval_count"] / max(sec(d["prompt_eval_duration"]), 1e-6)
        print(f"   reading a {d['prompt_eval_count']}-token prompt: {sec(d['prompt_eval_duration']):.1f}s  ({ptps:.0f} tokens/second)")

        ps = requests.get(f"{OLLAMA_BASE_URL}/api/ps", timeout=10).json().get("models", [])
        for m in ps:
            size, vram = m.get("size", 0), m.get("size_vram", 0)
            where = "GPU" if vram and vram >= size * 0.9 else ("partly GPU" if vram else "CPU only")
            print(f"   running on: {where}  (model uses {size / 1e9:.1f} GB)")

        print()
        if tps < 5:
            print("   -> The model itself is slow on this computer (under 5/s). Use a smaller model, close other")
            print("      programs to free RAM, or switch to OpenAI (LLM_BACKEND=openai).")
        elif ptps < 60:
            print("   -> Reading the prompt is the slow part. Lower TOP_K, CHUNK_SIZE and OLLAMA_NUM_CTX.")
        else:
            print("   -> Ollama looks healthy. If the app is still slow, run it and send me the [timing] lines.")
    except Exception as e:
        print(f"   couldn't talk to Ollama at {OLLAMA_BASE_URL}: {e}")

print("\n2) Embedding model (used to search your documents)")
t = time.time()
from sentence_transformers import SentenceTransformer

print(f"   importing libraries: {time.time() - t:.1f}s  (paid once, when the backend starts)")
t = time.time()
try:
    model = SentenceTransformer(EMBEDDING_MODEL, local_files_only=True)
except Exception:
    model = SentenceTransformer(EMBEDDING_MODEL)
print(f"   loading the model: {time.time() - t:.1f}s  (paid once, when the backend starts)")
t = time.time()
model.encode(["a test question"])
print(f"   searching with one question: {time.time() - t:.2f}s  (paid on every question)")

print(f"\nTotal: {time.time() - t_start:.0f}s")
