# TeXFlow 0.14.0 — release validation

Run these checks on clean copies of the Labs 6 fixtures. Stop if Source is corrupted or an inserted block lands before `\begin{document}`.

1. `01_text_flow.tex`: drag a selection across PÁRRAFO C/D top→bottom and bottom→top; both must remain visibly selected. Apply Bold once and confirm the Format menu closes. Reopen it and toggle Bold off.
2. `03_figures_tables.tex`: place the caret after `ANTES DE TABLA.` and insert a 3×2 table. It must appear in Visual at that position. Source must keep the table between `\begin{document}` and `\end{document}`.
3. Fill distinct values, focus row 2 and use `− Row`; focus an interior column and use `− Column`. The active row/column must be removed.
4. Insert Table from CSV / TSV using the file picker. The data must preview before insertion and the resulting table must appear in Visual at the remembered caret.
5. Use caption `tabla_2 & test`; Source must contain compilable escaping (`tabla\_2 \& test`).
6. Insert a figure as the final object. Press ArrowDown/Enter to create `Start typing…`, click elsewhere while it is still empty, then click the same area again and type. The insertion point must still be available without Undo/Redo.
7. Select a figure. Verify Edit → Copy/Paste/Duplicate/Move up/Move down. Then verify Cmd/Ctrl+C, Cmd/Ctrl+V, Cmd/Ctrl+X and Cmd/Ctrl+D on a selected object. Normal Cmd/Ctrl+C/V inside editable text must remain normal text clipboard behavior.
8. Compile `03_figures_tables.tex` and `05_release_smoke.tex`, reopen Visual, and compare against Source. No duplicate text, lost text, literal `\n`, broken labels, nested identical formatting wrappers, or blocks before `\documentclass`.

Release gate: all eight checks PASS.

## 0.14.1 keyboard clipboard regression

1. Select a figure and press Ctrl/Cmd+X. The figure must disappear.
2. Immediately press Ctrl/Cmd+V. The same figure must reappear; no stale system-clipboard text may be inserted.
3. Select a figure and press Ctrl/Cmd+C, place the caret at another document position, then press Ctrl/Cmd+V. The figure must paste as a semantic object.
4. Copy ordinary text in an editable paragraph and press Ctrl/Cmd+V. Native text copy/paste must still work and must not paste the previous TeXFlow object.
