# TeXFlow User Manual

## 1. What TeXFlow is

**TeXFlow — Write LaTeX, without writing LaTeX.**

TeXFlow is a visual editor for LaTeX and Beamer inside VS Code. It is designed to let you work on text, mathematics, citations and document structure without continuously manipulating LaTeX commands. The `.tex` file remains the canonical source of truth and can always be opened and edited directly.

TeXFlow follows a conservative rule: structures it understands are shown as semantic visual objects; structures it does not understand are preserved as LaTeX rather than silently rewritten.

> This manual documents the stable `0.14.3` release. TeXFlow remains conservative: unsupported complex constructs are preserved as LaTeX rather than rewritten.

## 2. Installation and requirements

TeXFlow runs as a VS Code extension. Install the supplied `.vsix` from VS Code's extension installer. A working LaTeX installation is still required for PDF compilation. Typical installations are TeX Live or MiKTeX.

Open a `.tex` file and run **TeXFlow: Open Visual LaTeX Editor**. TeXFlow detects the document class and switches between document and Beamer behavior where appropriate.

## 3. Main interface

The top-level organization is intentionally conventional:

- **File**: project/file operations.
- **Edit**: undo/redo, search and selected-object productivity operations.
- **Insert**: create content at the current position.
- **Format**: modify the current text selection or paragraph.
- **Layout**: document settings, columns and spacing.
- **View**: visual modes and diagnostics.
- **Beamer**: Beamer-only structural actions when the document class is Beamer.

The view switcher provides **Visual**, **Source**, **Split** and **PDF**. **Compile** is a single global action. The left **Document** panel is an outline of the current document rather than a second insert toolbar.

## 4. Text editing

### Paragraphs

Ordinary prose behaves as prose. The caret moves naturally inside a paragraph. `Enter` creates a semantic paragraph boundary; `Shift+Enter` inserts an explicit line break. Repeated ordinary spaces are neutralized so accidental multiple spaces do not accumulate in the LaTeX source.

If intentional horizontal or vertical space is required, use **Insert → Space**.

### Character formatting

Bold, italic, underline, color and other supported character formats are independent and can be combined. Applying Bold to text that is already italic or underlined must preserve the existing marks. Removing one mark must not remove the others.

### Paragraph alignment

Use **Format** to set left, center, right or justified/default alignment for the current paragraph or supported text block.

## 5. Structure

Use **Insert → Structure** for title, author, abstract, normal text, chapter/section/subsection commands and related structural elements that are valid for the document class.

Headings are semantic objects. Pressing `Enter` from a heading exits the heading and creates/enters normal body text.

## 6. Lists

Use **Insert → Lists** for bulleted or numbered lists. Within supported visual lists:

- `Enter` creates the next item;
- `Shift+Enter` creates an explicit line break;
- `Tab` indents an item when possible;
- `Shift+Tab` outdents it.

Complex custom list definitions are preserved rather than normalized.

## 7. Mathematics

TeXFlow provides one integrated math editor rather than separate dialog systems.

Supported structures include:

- inline math;
- display math;
- numbered/unnumbered equation;
- `align` / `align*`;
- `gather` / `gather*`;
- `multline` / `multline*`;
- cases;
- matrices including common delimiters.

The editor includes a symbol palette/search and a preview. `Tab` can move to the next `{}` placeholder in the source field. Labels can be attached to supported numbered equations and referenced later with the reference tools.

## 8. Citations and bibliography

TeXFlow detects common BibTeX/natbib and BibLaTeX/biber setups, reads `.bib` files for search/preview, and inserts citation commands without taking ownership of bibliography entries.

Bibliography placement is structural and independent of citation insertion. Existing unknown bibliography configuration is preserved.

## 9. Labels and cross-references

Labels are structural metadata rather than ordinary text. TeXFlow can create labels for supported headings, equations, figures and tables, and insert references such as `\ref` and `\eqref` as atomic inline objects. Existing `\autoref` and `\pageref` are preserved.

## 10. Academic inline objects

### Footnotes

Use **Insert → Academic inline → Footnote**. The footnote appears as an atomic inline object in Visual and serializes to `\footnote{...}`. Double-click it to edit its text.

### Links and URLs

Use **Insert → Academic inline → Link/URL**. TeXFlow adds `hyperref` when needed. A display label creates `\href{...}{...}`; an empty label creates `\url{...}`. Double-click a link object to edit it.

### Index and nomenclature

Insert index or nomenclature entries from the same menu. TeXFlow can add the required package/setup commands and can insert print commands. Double-click entries to edit them.

### Fields

TeXFlow supports `\today` and `\jobname` as field-like inline objects.

### Special characters

Use the special-character insertion tool for characters such as `%`, `&`, `#`, `_`, `$`, braces, tilde and caret without remembering the corresponding LaTeX escape.

## 11. Figures

Use **Insert → Figure** and choose a real PDF, PNG or JPEG file. TeXFlow validates the actual file signature rather than trusting the filename extension.

The internal figure editor supports:

- caption and short caption;
- label;
- placement;
- caption above/below;
- alignment;
- width;
- rotation.

After insertion, supported figures remain visually editable and resizable.

### Subfigures

**Insert → Subfigures** accepts multiple validated image files and creates a standard `subcaption` structure. This is intentionally more conservative than the ordinary figure editor: nested subfigure source may later be shown as preserved LaTeX rather than a fully reconstructed visual grid.

## 12. Tables

Use **Insert → Table** for a semantic table. The visual table editor supports cell editing, keyboard cell navigation, row/column insertion/removal, column alignment, caption, label, placement and caption position.

TeXFlow includes an optional **Booktabs** style. Selecting it adds `booktabs` when required and serializes top/mid/bottom rules.

### Paste from spreadsheet / CSV

Use **Insert → Table from CSV / TSV** and paste tab-, comma- or semicolon-separated data. TeXFlow creates a normal semantic table so it can subsequently be edited with the standard table UI.

Complex tables using multirow, longtable or package-specific layouts remain preserved LaTeX in this build.

## 13. Spacing and layout

Use **Insert → Space** for explicit horizontal/vertical LaTeX space. Common presets are available, and custom LaTeX lengths can be entered.

Use **Layout** for document columns and broader document settings. Document-mode multi-column blocks and Beamer columns are distinct semantic structures.

## 14. Document Settings and preamble

**Layout → Document Settings / Preamble** provides visual controls for commonly used settings while preserving a Raw Preamble view.

Managed settings include, depending on document class:

- base font size;
- page/paper settings;
- orientation;
- language;
- line spacing;
- paragraph indentation and paragraph spacing;
- margins;
- default alignment;
- global columns;
- optional hyperlink support;
- extra packages/options;
- Beamer aspect ratio/theme.

TeXFlow only rewrites settings it explicitly manages. Unknown packages, macros and custom preamble code must remain intact.

## 15. Rich structures

**Insert → Structure & containers** includes:

- page break and clear page;
- quote / quotation;
- simple minipage;
- theorem/lemma/proposition/corollary/definition/proof;
- source comments;
- TeXFlow author notes.

Author notes are encoded as marked source comments and never appear in the PDF.

## 16. Beamer

Beamer documents expose a dedicated **Beamer** menu. Supported features include frames, blocks, alert/example blocks, columns, frame-local text size (`Normal`, `Small`, `Footnotesize`, `Scriptsize`, `Tiny`), and frame options such as vertical alignment, `fragile` and `allowframebreaks`.

Math, figures, tables, citations and other shared objects reuse the same visual concepts where possible.

## 17. Productivity

The Edit menu includes:

- Undo / Redo using TeXFlow history snapshots;
- literal Find / Replace;
- copy, paste and duplicate selected document objects;
- move selected document objects up/down.

Object movement is intentionally conservative and strongest in Document Mode. Find/Replace refuses command-oriented searches to avoid unsafe structural rewrites.

## 18. Project awareness and diagnostics

TeXFlow already follows `\input` / `\include` relationships when building its project model. **View → Project diagnostics** reports the detected root, loaded `.tex` files, frame count, bibliography resources, figure commands and preserved raw Beamer blocks.

This is diagnostic rather than a full project manager: Source remains canonical and complex multi-file workflows should be version-controlled.

## 19. Preserved LaTeX

A **LaTeX preserved** block means TeXFlow found source it does not currently know how to edit safely as a semantic object. This is not an error. It is a safety boundary designed to prevent destructive rewrites.

Use Source when you need to edit that construct directly. After editing, return to Visual and confirm neighboring supported blocks still render normally.

## 20. Compilation and troubleshooting

If a document fails to compile, inspect the LaTeX log first. TeXFlow cannot make an unsupported image format compilable merely because VS Code can preview it. Likewise, bibliography, index and nomenclature workflows may need external LaTeX tools/packages installed locally.

If Visual reports that the document changed before an edit could be saved, do not repeatedly retry against a changing Source document. Refresh Visual and identify whether the source changed externally. TeXFlow's stale-document guard exists to prevent overwriting external changes.

See `TROUBLESHOOTING.md` for common cases.

## 21. Working safely

- Keep important projects under Git or another version-control/backup system.
- Treat `.tex` and `.bib` files as authoritative.
- Use Labs on copies until the build is manually validated for your workflow.
- If a Labs regression appears, return to the last manually validated baseline rather than stacking emergency fixes on top of an uncertain state.
