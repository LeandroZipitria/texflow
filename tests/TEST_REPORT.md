# TeXFlow Audit Report

## Scope

This report covers static auditing plus reproducible fixture compilation for TeXFlow 0.8.5 without modifying production code.

## Status

- PASS: 16 runnable items completed
- FAIL: 1 historical forensics case (`list`) failed before the fix
- NOT RUN: live webview regression rerun after the fix, requiring Node/Extension Host automation
- MANUAL PENDING: all direct Visual/webview interactions

## Executed Fixtures

- `beamer_frame_text.tex`
- `beamer_two_frames.tex`
- `beamer_itemize.tex`
- `beamer_enumerate.tex`
- `beamer_math_inline.tex`
- `beamer_math_display.tex`
- `beamer_section_subsection.tex`
- `beamer_combination.tex`

## Additional Runnable Checks

- Baseline `./test_presentaciones/prueba_minima.tex` compiled cleanly and preserved checksum
- Five shared copies in `./test_presentaciones/` compiled cleanly:
  - `prueba_texto.tex`
  - `prueba_math.tex`
  - `prueba_listas.tex`
  - `prueba_frames.tex`
  - `prueba_source_sync.tex`
- Forensics cases compiled cleanly:
  - `before_end`
  - `empty`
- Forensics case documented as regression:
  - `list`

## Notes on `applyReplacement`

The highest-risk path is `saveSource`, because it overwrites the full file contents. The next highest-risk path is `updateTrailingParagraph`, because it writes immediately before `\end{frame}` and depends on a stale `previous` substring search.

## Static Audit Summary

The audit identified these especially sensitive write sites:

- `updateTrailingParagraph`
- `updateEmptyFrameBody`
- `saveSource`
- `savePreamble`
- `updateBlock`

`saveSource` is a full-file replacement by design. `updateTrailingParagraph` is the most plausible source of `\end{frame}` corruption because it searches backward from the frame end and can replace a substring adjacent to structural delimiters.

## Forensic Failure

`list` failed with:

- `LaTeX Error: Something's wrong--perhaps a missing \item.`
- Failure point: `list.tex:10` at `\end{frame}`

This is consistent with a stale trailing-paragraph replacement landing in list content and breaking list structure before the frame sentinel.

## Regression Artifact

- Added: `./texflow_085/tests/forensics/list_regression.md`
- The fix now limits trailing replacements to the trailing editable tail of the frame and rejects ambiguous matches.

## Recommended first production correction

Before any feature work, add boundary checks around `updateTrailingParagraph` and `saveSource` so the replacement target is validated against the current file contents before editing. That is the most plausible source of `\end{frame}` corruption.
