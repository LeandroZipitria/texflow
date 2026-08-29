# Changelog

## 0.14.2 — 2026-08-29

- Fixed Cmd/Ctrl+V for copied/cut semantic objects so native system-clipboard text cannot be pasted in addition to the TeXFlow object.
- Object Copy/Cut now also replaces the VS Code system clipboard with the object's LaTeX source, eliminating stale clipboard contents.
- Object paste is handled at the actual `paste` event and remains repeatable; normal editable-text Copy/Cut still returns paste behavior to the native text clipboard.
- No changes to table/figure serialization, formatting, math, columns, or paragraph navigation.


## 0.14.1

- Fixed object keyboard paste after Copy/Cut: Ctrl/Cmd+V now uses TeXFlow's internal object clipboard even after the source object has been removed.
- Copying or cutting normal editable text returns Ctrl/Cmd+V to the native text clipboard, avoiding stale-object paste behavior.
- No changes to table parsing/insertion, figure handling, formatting toggles, or paragraph navigation.


## 0.14.0

- Promoted the stabilized Labs 6 feature set to a release build.
- Fixed manual and CSV/TSV table insertion so the remembered Visual anchor is used and tables cannot be inserted before `\documentclass` by losing modal focus.
- Fixed cross-paragraph mouse selection in both drag directions by preserving selection anchor/focus direction.
- Format and text-color actions now close the Format menu after application.
- Kept the editable insertion point after a final figure/table/atomic block available after focus leaves an empty `Start typing…` paragraph.
- Added selected-object keyboard shortcuts: Ctrl/Cmd+C, Ctrl/Cmd+V, Ctrl/Cmd+X and Ctrl/Cmd+D, while preserving normal text-input shortcuts.
- Retains Labs 6 table active-row/active-column deletion, CSV/TSV file selection, caption escaping, advanced math, subfigure rendering and flowing local columns.

## 0.13.0-labs.6

- Fixed inline-format toggling so applying the same format again removes it instead of nesting identical LaTeX wrappers.
- Improved paragraph flow: Enter splitting, Backspace/Delete joins, cross-paragraph navigation/selection, and transient empty paragraphs no longer create source whitespace noise.
- Fixed Display Math serialization to use real display math.
- Improved advanced math UX with a Text helper, Align/Cases row controls below the rows, and an explicit multiline editor.
- Rendered all subfigures in the Visual preview.
- Made table row/column removal act on the active cell and added CSV/TSV file selection in addition to paste.
- Escaped LaTeX-special characters in figure/table captions.
- Redesigned local article columns as continuous multicolumn text flow, respecting the caret or wrapping the current selection without automatic column breaks.

## 0.13.0-labs.5

- Removed the dedicated top-level **Columns** menu.
- Kept document-wide one/two-column configuration in **Layout → Document settings / preamble**.
- Moved local column regions into **Structure → Blocks & containers** as two- and three-column blocks.
- Refined responsive branding: **TeXFlow** in a compact capsule on wide layouts, **TF** on medium widths, and no brand capsule on narrow widths.
- Preserved the rest of the Labs 0.13 editing behavior unchanged.

## 0.13.0-labs.4

- Restyled the TeXFlow brand as a compact capsule in the top bar.
- Promoted Columns to its own top-level menu, positioned before View and separated from the main editing menus.
- Removed the duplicate Columns section from Layout.
- Added responsive top-bar tightening so Columns, view modes, and Compile remain visible longer on narrower windows.
- Hides the non-essential Saved status first when horizontal space becomes tight.
- No document-editing or serialization behavior changed.

## 0.13.0-labs.3

- Reorganized the top menu into `Structure`, `Insert`, `Format`, `References`, `Layout`, and contextual `Beamer`.
- Moved headings, lists, quotes, theorem/proof, minipage, comments, and author notes to `Structure`.
- Reduced `Insert` to math, figures, tables, links, special characters, and fields.
- Added a dedicated academic `References` menu for citations, bibliography, labels, cross-references, footnotes, index, and nomenclature.
- Consolidated document settings, columns, spacing, and breaks under `Layout`.
- Preserved the cursor on all new top-menu entry points.
- Keeps the Labs 2 equation newline fix.

## 0.13.0-labs.2

- Fixed Advanced Math insertion at a remembered Visual cursor: block equations now serialize real line breaks instead of literal `\n` text.
- No other feature or save-pipeline behavior changed from `0.13.0-labs.1`.

## 0.13.0-labs.1 — experimental integration

Based on `0.12.0-ui.3`.

Added experimental academic inline objects (footnotes, links, index/nomenclature entries, fields), rich structural blocks, page breaks, source comments/author notes, gather/multline math, subfigure insertion, figure short captions/rotation, booktabs tables, CSV/TSV table paste, list indent/outdent, richer document settings, selected-object productivity tools and project diagnostics.

This build deliberately preserves complex table/float/custom-environment source that cannot yet be round-tripped safely.

## 0.12.0-ui.3

Text-engine stabilization: composable formatting, semantic Enter/whitespace behavior and transactional visual formatting.
