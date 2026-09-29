"""
One-shot command line tool for trying the model by hand. (The backend does not
use this; it talks to the long-running worker.py instead.)

    python query.py "Hello"                              # normal chat
    python query.py "What is this about?" --store DIR    # answer from an index

Prints one JSON object: {"answer": "...", "sources": [...]} or {"error": "..."}.
"""

import argparse
import json
import sys


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No question provided."}))
        sys.exit(1)

    question = sys.argv[1]
    parser = argparse.ArgumentParser()
    parser.add_argument("--store")
    args = parser.parse_args(sys.argv[2:])

    import engine

    try:
        if args.store:
            sources, pieces = engine.stream_docs(question, args.store)
        else:
            sources, pieces = [], engine.stream_chat(question, [])
        output = {"answer": "".join(pieces), "sources": sources}
    except Exception as e:
        output = {"error": str(e)}
    print(json.dumps(output))


if __name__ == "__main__":
    main()
