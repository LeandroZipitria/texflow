# TeXFlow 0.13.0-labs.1 manual test plan

Use disposable Article and Beamer files under Git/version control.

## Gate A — regression

1. Write and edit several paragraphs rapidly.
2. Apply Bold + Italic + Underline to overlapping selections; remove one mark.
3. Create headings and exit them with Enter.
4. Insert/delete/reinsert citation and reference objects.
5. Insert/edit/delete equations, figure and table.
6. Compile, return to Visual and continue typing.
7. Inspect Source for duplicate/corrupted boundaries.

## Gate B — Labs inline objects

1. Insert a footnote, type around it, double-click and edit it.
2. Insert an href and a raw URL; double-click/edit.
3. Insert an index entry and nomenclature entry; edit both.
4. Insert Today and Jobname fields.
5. Insert escaped special characters.

## Gate C — structures

1. Insert newpage and clearpage; type before/after.
2. Insert quote and quotation; edit content.
3. Insert minipage; edit and delete it.
4. Insert theorem, lemma and proof; compile.
5. Insert source comment and author note; verify neither appears in PDF.

## Gate D — Advanced Math 2

1. Insert gather and gather*.
2. Insert multline and multline*.
3. Convert/edit structures through the existing math editor.
4. Use symbol search and Tab placeholder movement.
5. Add labels/references where supported.

## Gate E — figures/tables

1. Insert figure with short caption and rotation; compile.
2. Insert two subfigures and compile.
3. Insert a Booktabs table and edit cells afterward.
4. Paste a 3x3 table from spreadsheet data.
5. Confirm a complex `multirow`/`longtable` source is preserved rather than rewritten.

## Gate F — productivity/project

1. Undo/Redo several semantic actions.
2. Copy/paste/duplicate/move selected Document Mode blocks.
3. Use literal Find/Replace on prose.
4. Open Project diagnostics in a multi-file project using input/include.
5. Verify root/source files remain correct.

## Gate G — final round trip

Compile the complete Article and Beamer tests, return to Visual, edit again, then inspect Source. Any source corruption or stale-save conflict is a stop condition; revert to `0.12.0-ui.3` and isolate the regression.
