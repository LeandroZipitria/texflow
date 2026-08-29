#!/usr/bin/env bash
set -euo pipefail

SRC="texflow_085/src/extension.ts"
OUT="texflow_085/tests/output/apply_replacement_audit.md"
mkdir -p "$(dirname "$OUT")"

{
  echo "# applyReplacement Audit"
  echo
  echo "| Line | Context | Risk |"
  echo "| --- | --- | --- |"
  while IFS=: read -r line text; do
    case "$text" in
      *"updateFrameTitle"*)
        echo "| $line | frame title update | Can touch the frame header, but replacement is bounded to the begin{frame} match. |"
        ;;
      *"updateBlock"*)
        echo "| $line | block update | Replaces the parsed block span; risk is limited to the block's raw range, but malformed serialization can spill into delimiters if parse offsets drift. |"
        ;;
      *"updateTrailingParagraph"*)
        echo "| $line | trailing paragraph | Inserts or replaces text immediately before \\end{frame}; this is the highest-risk path for accidental delimiter corruption. |"
        ;;
      *"updateEmptyFrameBody"*)
        echo "| $line | empty frame body | Replaces the entire empty body region only; low risk unless body offsets are miscomputed. |"
        ;;
      *"savePreamble"*)
        echo "| $line | preamble save | Replaces a full preamble slice, not the frame body. Can affect \\begin{document} if the slice boundary is wrong. |"
        ;;
      *"saveSource"*)
        echo "| $line | save source | Replaces the entire file contents. This is intentionally full-file overwrite and can invalidate stale Visual ranges immediately after the save. |"
        ;;
      *"setDocumentCommand"*)
        echo "| $line | title/author command | Replaces an isolated command or inserts before \\begin{document}. Low to moderate risk. |"
        ;;
      *"insertFrame"*)
        echo "| $line | insert frame | Inserts before \\end{document} or after current frame. The delimiter risk is bounded, but it edits near structural sentinels. |"
        ;;
      *"insertHeading"*)
        echo "| $line | heading insertion | Inserts before the current frame end or \\end{document}. Can drift if current frame context is stale. |"
        ;;
      *"insertMathInFrame"*)
        echo "| $line | math insertion | Inserts before \\end{frame}; risk is localized unless frame end offsets are stale. |"
        ;;
      *"insertBlockInFrame"*)
        echo "| $line | block insertion | Inserts before \\end{frame}; same structural risk profile as math insertion. |"
        ;;
      *)
        continue
        ;;
    esac
  done < <(rg -n "applyReplacement\\(|saveSource|updateBlock|updateFrameTitle|updateTrailingParagraph|updateEmptyFrameBody|insertFrame|insertHeading|insertMathInFrame|insertBlockInFrame|setDocumentCommand|savePreamble" "$SRC")
} > "$OUT"

cat "$OUT"
