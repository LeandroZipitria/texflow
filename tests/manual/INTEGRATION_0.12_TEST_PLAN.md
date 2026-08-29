# TeXFlow 0.12.0-integration.1 — Manual integration test plan

This is an integration candidate. Do not promote it to the stable baseline until the checks below pass in VS Code on real documents.

## 1. Core regression gate

1. Open an article/report/book file in Visual.
2. Type several paragraphs with `Enter`; repeated `Enter` on an empty transient paragraph must not write source garbage.
3. Create/edit a heading, press `Enter`, and continue in normal text.
4. Insert, delete, and reinsert a citation.
5. Insert a label and a cross-reference.
6. Insert/delete an equation, figure, table, vertical spacer, and continue typing below each block.
7. Compile, return to Visual, continue editing, then inspect Source.

## 2. Advanced Math

1. Insert `align` with at least three rows.
2. Give two rows different labels; set one row to unnumbered.
3. Reopen and edit the align block.
4. Insert and edit `cases`.
5. Insert a 3x3 `pmatrix`, add/remove a row and column, and edit cells.
6. Use Math symbol search to find a Greek letter and an operator.
7. Compile and verify labels/references.

## 3. Document Settings / Preamble

Use **Layout → Document settings / preamble**.

1. Change font size and paper size.
2. Change language and line spacing.
3. Set a margin and default alignment.
4. Add one recognized/additive package and verify existing unknown packages are untouched.
5. In Beamer, change aspect ratio and theme.
6. Open Raw Preamble and verify custom commands/packages are still present.
7. Compile after each material settings change.

## 4. Paragraph alignment and document columns

1. Select/edit a normal paragraph and apply Left, Center, Right, then Justify/normal.
2. Verify adjacent paragraphs remain normal editable text.
3. Insert a 2-column document block; type in both columns.
4. Repeat with 3 columns.
5. Edit, delete, and continue typing after the columns block.
6. Compile and inspect Source for `multicols` / `columnbreak`.

## 5. Advanced Beamer

1. Insert Block, Alert block, and Example block.
2. Edit their titles and bodies.
3. Insert 2- and 3-column layouts and edit each column.
4. Change current frame options: Top/Center/Bottom, Fragile, Allow frame breaks.
5. Add normal content before and after these structures.
6. Compile and inspect Source.

## 6. UX cleanup

1. Use Up/Down at the beginning/end of editable text to move between semantic blocks.
2. Confirm arrow keys still move normally inside text/cells when not at a boundary.
3. Compile from Visual and confirm TeXFlow remains the working context rather than leaving the source editor active.
4. Verify object selection/delete still works with equation, figure, table, and vertical spacer.

## Stop conditions

Stop testing and keep the prior build if any action causes source corruption, loss of unknown preamble content, save conflicts, disappearance of labels/citations, or a reproducible compile regression.
