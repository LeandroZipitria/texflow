# TeXFlow 0.11.3 — Labels + References manual test plan

## Baseline regression gate

1. Open an article/report/book and type several paragraphs with plain Enter.
2. Press Enter repeatedly in an empty transient paragraph; verify no source garbage or save conflicts.
3. Create/edit a heading, press Enter, and continue in normal body text.
4. Insert, delete, and reinsert a citation; continue typing around it.
5. Compile, return to Visual, continue editing, and inspect Source.

## Existing labels and references

Use `tests/fixtures/article_labels_references.tex`.

1. Open Visual and verify `sec:introduction` is shown as structural metadata on the heading.
2. Verify `eq:model` is shown as structural metadata on the equation.
3. Verify `\ref`, `\eqref`, `\autoref`, and `\pageref` render as atomic reference objects rather than plain text.
4. Edit the Introduction heading; verify `\label{sec:introduction}` remains unchanged in Source.
5. Double-click the equation, edit its expression, save, and verify `\label{eq:model}` remains inside the equation.
6. Edit text immediately before and after every reference and verify the reference commands round-trip exactly.
7. Delete one reference object, continue typing, then use **Ref → Insert reference…** to reinsert it.
8. Compile and verify references resolve in the PDF.

## Insert a label

1. Create a new heading without a label.
2. Click/focus that heading so it is the selected structural target.
3. Choose **Ref → Add label to selected heading/equation…**.
4. Insert `sec:new-section`.
5. Verify Source contains the label immediately after the heading and not inside its editable title.
6. Try `sec:new-section` again on another target; TeXFlow must reject the duplicate.
7. Try an empty key and a key containing spaces/braces/backslashes; TeXFlow must reject them.
8. Repeat on an unlabeled numbered equation; verify the label is inserted before `\end{equation}`.

## Insert a reference

1. Place the caret in a normal paragraph.
2. Choose **Ref → Insert reference…**.
3. Search for `sec:new-section`; insert `ref`.
4. Repeat for `eq:model`; verify the picker defaults to `eqref` for the equation target.
5. Insert a second reference immediately after an existing reference; verify the caret remains after the inserted atomic object.
6. Delete/reinsert and verify surrounding `~`, punctuation, spaces, citations, and inline math are preserved.

## Beamer preservation

1. Open a Beamer file containing an equation with `\label{...}` and inline `\ref`, `\eqref`, `\autoref`, or `\pageref`.
2. Edit the equation in Visual and verify its existing label is retained.
3. Edit text around inline references and verify the commands round-trip exactly.
4. TeXFlow 0.11.3 does not create new Beamer labels from Visual; existing labels must remain untouched.
## Regression: paragraph after heading label

1. Open an article with a normal paragraph containing citations immediately after a labeled section.
2. Add a label to the section from **Ref → Add label…**.
3. Verify the label appears as the heading badge.
4. Verify the following paragraph remains a normal editable paragraph and does **not** render as “LaTeX preserved”.
5. Edit the heading and the following paragraph.
6. Verify Source keeps exactly one `\label{...}` associated with the heading.
7. Compile, return to Visual, and verify the paragraph is still editable.

