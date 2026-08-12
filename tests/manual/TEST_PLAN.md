# Manual Test Plan

## Shared Baseline

- Baseline file: `./test_presentaciones/prueba_minima.tex`
- Expected checksum: `35af47e60468ae77807f8f8a968f748763d68790be6dad16ca4e88768b1a72bc`
- Baseline structure:
  - `\documentclass{beamer}`
  - `\begin{document}`
  - two frames
  - itemize in the second frame
  - `\end{document}`

## `prueba_texto.tex`

- Operations: write text, `Enter`, `Shift+Enter`, bold, italic, key, alert, Undo, Redo
- Expected `.tex`:
  - only text inside the current frame body changes
  - `\begin{document}`, `\end{document}`, `\begin{frame}`, `\end{frame}` stay intact
  - no list or math delimiters should appear unless explicitly inserted
- Compile command: `latexmk -pdf -interaction=nonstopmode -halt-on-error -file-line-error ./test_presentaciones/prueba_texto.tex`

## `prueba_math.tex`

- Operations: inline math mid-sentence, display math, equation, edit equation, write before and after equation
- Expected `.tex`:
  - math delimiters stay balanced
  - frame delimiters stay intact
  - no accidental removal of leading `\`
- Compile command: `latexmk -pdf -interaction=nonstopmode -halt-on-error -file-line-error ./test_presentaciones/prueba_math.tex`

## `prueba_listas.tex`

- Operations: `itemize`, `enumerate`, `Enter` for new item, `Shift+Enter` inside same item, empty item, nested list
- Expected `.tex`:
  - list environments remain balanced
  - `\item` boundaries remain scoped to the list
  - frame delimiters stay intact
- Compile command: `latexmk -pdf -interaction=nonstopmode -halt-on-error -file-line-error ./test_presentaciones/prueba_listas.tex`

## `prueba_frames.tex`

- Operations: New frame, edit title, move to body, add content, section, subsection, switch frames, compile
- Expected `.tex`:
  - new frame insertion must not corrupt existing `\end{frame}`
  - title edits must remain inside the frame header
  - section/subsection insertions must occur outside frame bodies
- Compile command: `latexmk -pdf -interaction=nonstopmode -halt-on-error -file-line-error ./test_presentaciones/prueba_frames.tex`

## `prueba_source_sync.tex`

- Operations: modify Visual, save, modify Source internal editor, modify `.tex` in native editor, return to Visual, compile
- Expected `.tex`:
  - edits made externally survive Visual refresh
  - no revert of external changes on compile
  - source and visual remain in sync after save
- Compile command: `latexmk -pdf -interaction=nonstopmode -halt-on-error -file-line-error ./test_presentaciones/prueba_source_sync.tex`

## Structural Invariants

- `\begin{document}` and `\end{document}` must remain byte-for-byte intact.
- `\begin{frame}` and `\end{frame}` must remain byte-for-byte intact.
- `itemize`, `enumerate`, `equation`, and `align` environments must stay balanced.
