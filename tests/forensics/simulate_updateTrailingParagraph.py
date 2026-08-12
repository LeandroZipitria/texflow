#!/usr/bin/env python3
from __future__ import annotations

import argparse
import dataclasses
import hashlib
from pathlib import Path


END_TOKEN = "\\end{frame}"


@dataclasses.dataclass
class Case:
    name: str
    previous: str
    text: str
    mutate: str = ""


def apply_logic(source: str, frame_start: int, frame_raw: str, previous: str, text: str) -> tuple[str, dict[str, int]]:
    end_pos = source.index(END_TOKEN, frame_start)
    insert_pos = end_pos
    search_start = max(frame_start, insert_pos - max(len(frame_raw), len(previous) + 128))
    before_end = source[search_start:insert_pos]
    rel = before_end.rfind(previous)
    meta = {
        "frame_start": frame_start,
        "insert_pos": insert_pos,
        "search_start": search_start,
        "rel": rel,
    }
    if rel < 0:
        return source, meta
    abs_start = search_start + rel
    abs_end = abs_start + len(previous)
    meta["abs_start"] = abs_start
    meta["abs_end"] = abs_end
    return source[:abs_start] + text + source[abs_end:], meta


def check_invariants(before: str, after: str) -> dict[str, bool]:
    tokens = ["\\begin{document}", "\\end{document}", "\\begin{frame}", "\\end{frame}"]
    return {tok: before.count(tok) == after.count(tok) and tok in before and tok in after for tok in tokens}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--outdir", required=True)
    args = parser.parse_args()
    baseline = Path(args.baseline)
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    source = baseline.read_text(encoding="utf-8")
    frame_start = source.index("\\begin{frame}")
    frame_end = source.index(END_TOKEN, frame_start) + len(END_TOKEN)
    frame_raw = source[frame_start:frame_end]
    cases = [
        Case("once", "Texto inicial.", "EDIT"),
        Case("multiple", "Texto", "EDIT"),
        Case("empty", "", "EDIT"),
        Case("spaces", "   ", "EDIT"),
        Case("newlines", "Texto\ninicial.", "EDIT"),
        Case("math", "$a+b$", "EDIT"),
        Case("list", "\\item Uno", "EDIT"),
        Case("before_end", "inicial.", "EDIT"),
        Case("substring", "Texto", "EDIT"),
    ]
    report = []
    for case in cases:
        mutated = source
        if case.name == "multiple":
            mutated = mutated.replace("Texto inicial.", "Texto inicial. Texto inicial.", 1)
        if case.name == "math":
            mutated = mutated.replace("Texto inicial.", "Inline $a+b$ Texto inicial.", 1)
        if case.name == "list":
            mutated = mutated.replace("Texto inicial.", "\\begin{itemize}\n\\item Uno\n\\end{itemize}\nTexto inicial.", 1)
        if case.name == "before_end":
            mutated = mutated.replace("Texto inicial.", "Texto inicial. ", 1)
        if case.name == "substring":
            mutated = mutated.replace("Texto inicial.", "Texton inicial.", 1)
        after, meta = apply_logic(mutated, frame_start, frame_raw, case.previous, case.text)
        invariants = check_invariants(mutated, after)
        path = outdir / f"{case.name}.tex"
        path.write_text(after, encoding="utf-8")
        report.append({
            "case": case.name,
            "previous": case.previous,
            "meta": meta,
            "invariants": invariants,
            "sha256": hashlib.sha256(after.encode("utf-8")).hexdigest(),
            "path": str(path),
        })
    (outdir / "report.txt").write_text("\n".join(str(item) for item in report), encoding="utf-8")
    print((outdir / "report.txt").read_text(encoding="utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
