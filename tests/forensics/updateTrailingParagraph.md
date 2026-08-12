# `updateTrailingParagraph` Forensics

## Call Site

Source: `src/extension.ts`

Relevant code path:

- `msg.type === 'updateTrailingParagraph'`
- `previous = String(msg.previous ?? '').trim()`
- `text = String(msg.text ?? '').trim()`
- `endToken = '\\end{frame}'`
- `insertPos = ctx.frame.end - endToken.length`
- `source = ctx.document.getText()`
- `searchStart = Math.max(ctx.frame.start, insertPos - Math.max(ctx.frame.raw.length, previous.length + 128))`
- `beforeEnd = source.slice(searchStart, insertPos)`
- `rel = beforeEnd.lastIndexOf(previous)`
- if `rel >= 0`, replace `source[searchStart + rel : searchStart + rel + previous.length]` with `text`

## Risk Summary

- The search window is anchored to `insertPos`, which is derived from the current parsed frame end.
- `previous` is trimmed before use, so leading and trailing whitespace from the UI is discarded.
- The replacement target is found by `lastIndexOf(previous)` on a substring of the current document, not on a parsed token boundary.
- If the document is stale, `searchStart` and `insertPos` can point to the wrong slice.
- If `previous` appears multiple times, the last match in the window is replaced.
- If `previous` is empty after trim, no replacement occurs in this branch.

## Sensitive Outcomes

- A stale frame end can cause replacement near `\end{frame}`.
- A substring match can replace text preceding `\end{frame}` rather than the intended editable content.
- A repeated phrase in the trailing area can be replaced at the last occurrence, not necessarily the intended one.

## Structural Delimiters at Risk

- `\end{frame}`
- `\begin{frame}`
- `\begin{document}`
- `\end{document}`

## Deterministic Case Matrix

- `previous` occurs once
- `previous` occurs multiple times
- `previous` trims to empty
- `previous` trims to spaces only
- `previous` contains newlines
- `previous` appears after math
- `previous` appears after a list
- `previous` is immediately before `\end{frame}`
- `previous` is a substring of another token
- stale document state between range capture and replacement
