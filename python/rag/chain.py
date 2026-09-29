"""
Build the chat model used for both normal chat and document answers.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import (
    LLM_MODEL,
    LLM_BACKEND,
    OLLAMA_BASE_URL,
    LLM_KEEP_ALIVE,
    MAX_TOKENS,
    OLLAMA_NUM_CTX,
    require_api_key,
)


def build_llm(temperature: float = 0.0):
    """Return a chat model matching LLM_BACKEND. Ollama needs no API key and
    talks to a local server; OpenAI needs OPENAI_API_KEY."""
    if LLM_BACKEND == "ollama":
        from langchain_community.chat_models import ChatOllama

        kwargs = dict(
            model=LLM_MODEL,
            base_url=OLLAMA_BASE_URL,
            temperature=temperature,
            keep_alive=LLM_KEEP_ALIVE,
            num_predict=MAX_TOKENS,
        )
        if OLLAMA_NUM_CTX:
            kwargs["num_ctx"] = OLLAMA_NUM_CTX
        return ChatOllama(**kwargs)

    if LLM_BACKEND == "openai":
        from langchain_openai import ChatOpenAI

        api_key = require_api_key()
        return ChatOpenAI(model=LLM_MODEL, api_key=api_key, temperature=temperature, max_tokens=MAX_TOKENS)

    raise ValueError(f"Unknown LLM_BACKEND '{LLM_BACKEND}'. Use 'ollama' or 'openai'.")
