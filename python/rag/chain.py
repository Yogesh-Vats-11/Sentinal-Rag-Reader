"""
Build the retrieval-augmented QA chain on top of a loaded vector store.

Mirrors the original `rag/chain.py` referenced by app/ui.py.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langchain.chains import RetrievalQA
from langchain_community.vectorstores import FAISS

from config import LLM_MODEL, LLM_BACKEND, OLLAMA_BASE_URL, TOP_K, require_api_key


def _build_llm():
    """Return a chat model matching LLM_BACKEND. Ollama needs no API key and
    talks to a local server; OpenAI needs OPENAI_API_KEY."""
    if LLM_BACKEND == "ollama":
        from langchain_community.chat_models import ChatOllama

        return ChatOllama(
            model=LLM_MODEL,
            base_url=OLLAMA_BASE_URL,
            temperature=0,
        )

    if LLM_BACKEND == "openai":
        from langchain_openai import ChatOpenAI

        api_key = require_api_key()
        return ChatOpenAI(model=LLM_MODEL, api_key=api_key, temperature=0)

    raise ValueError(f"Unknown LLM_BACKEND '{LLM_BACKEND}'. Use 'ollama' or 'openai'.")


def build_qa_chain(db: FAISS) -> RetrievalQA:
    """Wire a retriever from the vector store into a RetrievalQA chain
    backed by the configured chat model."""
    llm = _build_llm()

    retriever = db.as_retriever(search_kwargs={"k": TOP_K})

    qa = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=retriever,
        return_source_documents=True,
    )
    return qa
