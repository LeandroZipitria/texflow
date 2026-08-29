# TeXFlow 0.14.2 Release Validation

## Status

**PASS — release candidate validated for publication.**

The functional runtime in `0.14.2` is the same runtime that passed the final manual stabilization tests. Publication preparation changes only metadata, public documentation, package contents, and Marketplace publisher information.

## Automated fixture validation

- 37 LaTeX fixture documents compiled successfully.
- Coverage includes article, report, book, and Beamer documents.
- Fixtures cover text structure, mathematics, citations/bibliography, labels/references, figures, tables, spacing/layout, TOC, and integrated cases.
- `out/extension.js` passed a JavaScript syntax check.

## Final manual validation

The final manual validation covered:

- composable Bold / Italic / Underline formatting and toggle behavior;
- multi-paragraph selection in both drag directions;
- automatic closing of the Format menu after applying a format;
- inline, display, numbered, and multiline mathematics;
- figures and visual figure editing;
- manual tables and CSV/TSV table import;
- active-row and active-column deletion in tables;
- LaTeX escaping in captions, including `_` and `&`;
- local columns;
- cursor navigation between paragraphs;
- persistent `Start typing…` insertion point after a final semantic object;
- selected-object Copy, Cut, Paste, Duplicate, Move up, and Move down;
- Cmd/Ctrl+C, X, V, and D behavior for semantic objects without leaking stale native clipboard text;
- final PDF compilation and source round-trip checks.

## Release fixes immediately preceding 0.14.2

- `0.14.0`: stabilized table insertion anchors, reverse multi-paragraph selection, Format-menu closing, final-block insertion points, and object keyboard shortcuts.
- `0.14.1`: fixed object paste after Copy/Cut when the selected source object no longer existed.
- `0.14.2`: prevented the native system clipboard from pasting stale text in addition to the TeXFlow semantic object.

## Known non-blocking limitations

- Whole figures/tables are moved with the selected-object commands rather than mouse drag-and-drop.
- Creating a new paragraph between existing paragraphs is done through normal caret navigation and `Enter`; there is no separate click-only insertion hotspot between every paragraph.
- Complex unsupported LaTeX remains preserved rather than being rewritten into a visual model.

## Release rule

Any future change to document serialization, caret boundaries, tables, figures, or semantic-object clipboard behavior requires a new version and regression validation. `0.14.2` is frozen for publication.
