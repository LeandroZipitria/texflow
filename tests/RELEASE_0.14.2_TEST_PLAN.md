# TeXFlow 0.14.2 — clipboard release validation

Use a clean test document containing normal text, one figure and one table. Stop if Source is corrupted or if paste inserts both native clipboard text and a TeXFlow object.

1. Copy any distinctive normal text outside TeXFlow (or copy a paragraph in TeXFlow) so the system clipboard clearly contains text.
2. Select a figure in Visual and press Cmd/Ctrl+C. Move the caret to another valid document position and press Cmd/Ctrl+V once. Exactly one figure must be inserted; the old clipboard text must not appear anywhere.
3. Press Cmd/Ctrl+V a second time. Exactly one additional figure must be inserted.
4. Select a figure and press Cmd/Ctrl+X. It must disappear. Press Cmd/Ctrl+V once. Exactly the cut figure must reappear, with no extra text.
5. Repeat Copy/Paste and Cut/Paste with a table. Each paste must create exactly one semantic table.
6. Select ordinary editable paragraph text and press Cmd/Ctrl+C, then paste it in another paragraph. Only the copied text must paste; no prior figure/table may appear. Repeat with Cmd/Ctrl+X then Cmd/Ctrl+V on ordinary text.
7. Verify Edit → Copy object and Edit → Paste object still work.
8. Compile and inspect Source. There must be no duplicated stale text, no object blocks before `\begin{document}`, and no unexpected duplicated object beyond the number of explicit paste operations.

Release gate: all eight checks PASS.
