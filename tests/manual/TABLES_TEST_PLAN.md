# TeXFlow 0.11.5-tables.1 — manual table test plan

1. Open a previously compiling article and place the cursor between two paragraphs.
2. Table → Insert table…; choose 3 rows and 3 columns, caption, label, and `htbp`.
3. Confirm the table appears as editable cells rather than raw LaTeX.
4. Type content in every cell; use Tab/Shift+Tab to move between cells.
5. Change one column L/C/R alignment.
6. Add and remove one row; add and remove one column.
7. Edit caption and label.
8. Insert `\\ref{...}` to the table using Ref and compile.
9. Return to Visual and verify all cell contents/caption/label remain intact.
10. Inspect Source: a standard `table` + `tabular` environment must be present and stable.
11. Open a table containing `\\multicolumn` or other unsupported complex structures and confirm TeXFlow preserves it as raw LaTeX rather than rewriting it.
12. Repeat insertion/edit/compile in a Beamer frame.

Regression gate: paragraphs, headings, citations, labels/references, equations, bibliography and figures must still behave as in the validated baselines.
