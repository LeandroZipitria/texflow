# TeXFlow semantic block selection/delete — manual test plan

Version target: `0.11.5-tables.2`

## Document mode

1. Open an article containing an equation, figure and simple table.
2. Single-click the body of each object.
   - PASS: a visible selection outline appears around the whole object.
   - PASS: a circular `×` delete control appears at the top-right.
3. With the object selected, press `Delete`.
   - PASS: the entire LaTeX object is removed and surrounding prose remains intact.
4. Undo, select again and press `Backspace`.
   - PASS: the entire object is removed.
5. Undo, select again and click `×`.
   - PASS: the entire object is removed.
6. Click into a figure/table input or editable table cell and press Backspace/Delete while editing text.
   - PASS: only the field/cell text is edited; the semantic object is not removed.
7. Double-click an equation.
   - PASS: the math editor still opens.
8. Insert a label/reference and compile.
   - PASS: existing labels/references and compilation behavior are unchanged.

## Beamer

1. Open a frame containing equation, figure and simple table blocks.
2. Repeat selection, `×`, Delete and Backspace checks.
3. Confirm editable table cells and figure controls do not trigger whole-block deletion.
4. Compile and reopen Visual.
