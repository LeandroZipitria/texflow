# TeXFlow 0.11.4-figures.1 — manual figure test plan

Use `0.11.3-labels.3` as the fallback baseline if any core regression appears.

## Article/report/book

1. Put the caret in a normal paragraph and choose **Figure → Insert figure…**.
2. Select a PNG or JPG inside the project. Confirm caption, default `fig:` label and `htbp` placement.
3. Verify that the figure appears at the selected structural position, not at `\\end{document}` unless no position was available.
4. Verify visual preview, caption and label.
5. Drag the resize handle and confirm Source changes only the `width=` option.
6. Change alignment, caption, label and placement; inspect Source after each change.
7. Insert `\\ref{...}` through **Ref → Insert reference…** and compile.
8. Select an image outside the project. Confirm TeXFlow copies it into `figures/` and writes a relative path.
9. Test a PDF figure preview.
10. Reopen Visual and confirm all figure metadata round-trips.

## Beamer

1. Insert a figure in a normal frame.
2. Verify preview and drag resizing.
3. Edit caption, label and alignment from the figure card.
4. Compile and reopen Visual.

## Regression gate

1. Multiple semantic paragraphs with Enter.
2. Heading → Enter → normal paragraph.
3. Citation insert/delete/reinsert.
4. Label + cross-reference for a heading and an equation.
5. Compile, return to Visual, continue editing.
6. Inspect Source for stable LaTeX and no duplicated structural commands.
