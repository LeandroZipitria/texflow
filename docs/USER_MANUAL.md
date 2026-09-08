# TeXFlow User Manual

## 1. What TeXFlow is

**TeXFlow — Write LaTeX, without writing LaTeX.**

TeXFlow is a visual editor for LaTeX and Beamer inside VS Code. It is designed to let you work on text, mathematics, citations, figures, tables, comments, and document structure without continuously manipulating LaTeX commands. The `.tex` and `.bib` files remain the canonical source of truth and can always be opened and edited directly.

TeXFlow follows a conservative rule: structures it understands are shown as semantic visual objects; structures it does not understand are preserved as LaTeX rather than silently rewritten.

> This manual documents TeXFlow `0.20.0`.

## 2. Installation and requirements

TeXFlow runs as a VS Code extension. Install it from the Visual Studio Marketplace or install a supplied `.vsix` from VS Code's extension installer.

A working local LaTeX installation is still required for PDF compilation. Typical installations are TeX Live or MiKTeX. Documents may also require `latexmk`, `bibtex`, `biber`, or other tools/packages used by their source.

Open TeXFlow from the VS Code Activity Bar, use **TeXFlow: Open with TeXFlow**, or right-click a `.tex` file in the Explorer.

## 3. Projects, master document, and active document

TeXFlow can work with a standalone `.tex` file or with a multi-file project using `\input` and `\include`.

For a multi-file project TeXFlow distinguishes:

- **master document**: the root `.tex` file used for compilation, project-wide metadata, packages, bibliography setup, and the root PDF;
- **active document**: the `.tex` file currently being edited in Visual mode;
- **project**: the include graph plus project-wide labels, references, bibliography information, and diagnostics.

Opening an included source file does not merge it into the master. The active file remains a real independent `.tex` file and accepted Visual edits are written to that file.

The **Project Files** section of the sidebar lists real project files. The **Article** or Beamer outline below it represents the internal structure of the active document. These are deliberately separate concepts.

Project file paths are displayed relative to the master-project folder. The sidebar can be resized by dragging its right edge; the width is remembered between sessions. Double-clicking the resize area restores the default width.

## 4. Saving and source ownership

TeXFlow does not maintain a second document format. Accepted Visual edits are applied to the active `.tex` source and saved through VS Code as part of the editing flow. This means ordinary text, mathematics, notes, and supported object edits persist without requiring a separate manual Save after every change.

The **File** menu still provides **Save** and **Save as...** for explicit file workflows.

If Source changes externally while a Visual edit is pending, TeXFlow's stale-document guard can refuse the edit rather than overwrite unrelated changes.

## 5. Main interface

The top-level menus are:

- **File**: new/open/save actions and Document settings;
- **Edit**: undo/redo, find/replace, selected-object operations, and comment-out selection;
- **Structure**: document structure, lists, blocks, columns, minipages, theorem/proof structures, and configured custom environments;
- **Insert**: comments/notes, mathematics, figures, TikZ, tables, inline objects, spacing, and page breaks;
- **Format**: character formatting, paragraph alignment, text color, language, and spell checking;
- **References**: citations, bibliography, cross-references, index, and nomenclature;
- **View**: document presentation, outline, Focus mode, comments, Project Issues, and project diagnostics;
- **Beamer**: Beamer-only frame and block actions when the document class is Beamer.

The view switcher provides **Visual**, **Source**, **Split**, and **PDF**. **Compile** is a single global action.

The former separate Layout and Language top-level menus are not used in `0.20.0`: their functions are placed with File, Insert, and Format where they are needed.

## 6. Text editing

### Paragraphs

Ordinary prose behaves as prose. The caret moves naturally inside a paragraph. `Enter` creates a semantic paragraph boundary; `Shift+Enter` inserts an explicit line break. Repeated ordinary spaces are neutralized so accidental multiple spaces do not accumulate in the LaTeX source.

For intentional horizontal or vertical space, use **Insert → Spacing...**.

### Character formatting

Bold, italic, underline, color, and other supported character formats are independent and can be combined. Applying Bold to text that is already italic or underlined preserves the existing marks. Removing one mark does not remove the others.

### Paragraph alignment

Use **Format** to set left, center, right, or justified/default alignment for the current paragraph or supported text block.

### Spell checking

Local spell checking is available under **Format → Language**. Current choices are Automatic, English, and Español, plus spell checking on/off.

Spell checking runs locally. Mathematics, citations, labels, references, URLs, and other non-prose structures are excluded where appropriate. Corrections are applied only when explicitly selected.

## 7. Structure and headings

Use **Structure** for title, author, abstract, normal text, chapter/section/subsection commands, lists, and supported containers.

Headings are semantic objects. Pressing `Enter` from a heading exits the heading and creates or enters normal body text.

Supported headings can be toggled between numbered and unnumbered forms while preserving their structural meaning, for example `\section{...}` ↔ `\section*{...}`.

Configured simple custom environments can be exposed through **Structure → Environment...**. TeXFlow remains conservative: unsupported or complex instances stay as preserved LaTeX.

## 8. Lists and containers

Use **Structure** for bulleted and numbered lists. Within supported visual lists:

- `Enter` creates the next item;
- `Shift+Enter` creates an explicit line break;
- `Tab` indents an item when possible;
- `Shift+Tab` outdents it.

Supported containers include quote/quotation, columns, minipage, and theorem/proof-style environments. Complex custom layouts remain preserved rather than normalized.

## 9. Mathematics

TeXFlow provides compact **Equation...**, **Matrix...**, and **System...** workflows under **Insert → Math**.

The equation editor supports:

- inline and display placement;
- numbered and unnumbered equations;
- single equations;
- `align` / `align*`;
- `gather` / `gather*`;
- `multline` / `multline*`;
- row-level numbering where applicable;
- labels for supported numbered structures;
- common delimiters, symbols, and accents.

The Matrix and System editors provide structured entry rather than requiring manual environment syntax. Cases and common matrix delimiters are supported.

Numbering is semantic. For example, switching all rows of an aligned equation to unnumbered produces `align*`, and returning to numbered rows produces `align` without leaving redundant `\notag`/`\nonumber` commands behind.

## 10. Citations and bibliography

TeXFlow detects common BibTeX/natbib and BibLaTeX/biber setups and builds bibliography information across the project.

The citation picker can search by:

- citation key;
- author/editor;
- title;
- year/date.

TeXFlow can report missing citation keys, duplicate bibliography keys, and bibliography entries that are not currently cited. Double-clicking supported citations can navigate to the corresponding bibliography entry, and bibliography usage navigation can return to citations.

Bibliography placement is structural and independent of citation insertion. Existing unknown bibliography configuration is preserved.

## 11. Labels and cross-references

Labels and references are indexed project-wide across loaded project files.

TeXFlow can:

- add labels to supported headings, equations, figures, and tables;
- search labels when inserting a cross-reference;
- insert common reference commands including `\ref`, `\eqref`, `\autoref`, and `\cref` families where supported;
- navigate from a visual reference to its target;
- identify missing references;
- identify duplicate labels;
- identify unused labels.

A reference to a missing target can open **Project Issues** instead of navigating to a nonexistent location.

## 12. Academic inline objects

### Footnotes

Use **Insert → Footnote...**. The footnote appears as an atomic inline object in Visual and serializes to `\footnote{...}`. Double-click it to edit its text.

### Links and URLs

Use **Insert → Link / URL...**. TeXFlow adds `hyperref` when needed. A display label creates `\href{...}{...}`; an empty label creates `\url{...}`. Double-click a link object to edit it.

### Index and nomenclature

Use **References** to insert index or nomenclature entries and their print commands. TeXFlow can add required package/setup commands where supported.

### Fields

TeXFlow supports `\today` and `\jobname` as field-like inline objects.

### Special characters

Use **Insert → Special character...** for characters such as `%`, `&`, `#`, `_`, `$`, braces, tilde, and caret without remembering the corresponding LaTeX escape.

## 13. Figures

Use **Insert → Figure...** and choose a real supported image file. TeXFlow validates the actual file signature rather than trusting only the filename extension.

The figure editor supports:

- caption and short caption;
- label;
- placement;
- caption above/below;
- alignment;
- width;
- rotation.

Selecting several images in the unified figure workflow can create subfigures. Existing supported figures remain visually editable through their properties.

## 14. TikZ figures

Use **Insert → TikZ figure...** to create a TikZ figure. TeXFlow ensures the `tikz` package when needed and inserts the new source as a Figure object.

A TikZ card provides:

- **Edit** for the `tikzpicture` source inside TeXFlow;
- **Preview** to compile a temporary PDF and open it beside the editor;
- **Source** to navigate to the corresponding LaTeX;
- Figure-style properties for a TikZ picture already wrapped in a `figure` environment.

If TeXFlow finds a bare `tikzpicture`, **Make figure** can wrap that picture conservatively as a Figure without rewriting the TikZ body.

TikZ preview files are temporary and session-scoped. TeXFlow cleans its own abandoned preview files conservatively and does not delete unrelated files. If a temporary preview PDF is still open in VS Code, cleanup waits until it is safe.

TikZ remains source-driven graphics; TeXFlow is not a full visual drawing application.

## 15. Tables

Use **Insert → Table...** for a semantic table. The visual table editor supports cell editing, keyboard cell navigation, row/column insertion/removal, column alignment, caption, label, placement, and caption position.

TeXFlow includes an optional **Booktabs** style. Selecting it adds `booktabs` when required and serializes top/mid/bottom rules.

### Paste CSV / TSV

The table dialog includes **Paste CSV / TSV...**. Paste tab-, comma-, or semicolon-separated data and TeXFlow creates a normal semantic table that can subsequently be edited with the standard table UI.

Complex tables using multirow, longtable, or package-specific layouts remain preserved LaTeX.

## 16. Spacing, breaks, columns, and document settings

Use **Insert → Spacing...** for explicit horizontal or vertical LaTeX space. Common presets are available, and custom LaTeX lengths can be entered.

Use **Insert → Page break** or **Insert → Clear page** for explicit document breaks.

Local document columns are inserted from **Structure → Columns...**. Beamer columns are handled as Beamer structures.

**File → Document settings...** provides visual controls for commonly used document settings while preserving a Raw Preamble view.

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

TeXFlow only rewrites settings it explicitly manages. Unknown packages, macros, and custom preamble code remain intact.

## 17. Comments, TODOs, FIXMEs, and notes

Use **Insert → Note...** to create one of four source-backed note types:

- Comment;
- TODO;
- FIXME;
- Author note.

Use **Insert → Commented-out block...** for preserved inactive LaTeX, or **Edit → Comment out selection** to turn selected Visual content into commented-out source.

Comments are represented with compact markers and a bottom inspector outside the page/slide layout, so they do not consume document or Beamer slide height.

The inspector supports previous/next navigation in document order. TODO and FIXME identity is preserved when their text is edited; for example editing the body of `% TODO ...` keeps the source as a TODO.

Hiding a marker is visual-only. Deleting source is a separate explicit action with confirmation.

## 18. Beamer

Beamer documents expose a dedicated **Beamer** menu. Supported features include:

- new frame;
- duplicate frame;
- move frame up/down;
- disable frame / restore frame;
- blocks, alert blocks, and example blocks;
- columns;
- frame-local text sizes (`Normal`, `Small`, `Footnotesize`, `Scriptsize`, `Tiny`);
- vertical frame alignment;
- `fragile`;
- `allowframebreaks`.

A disabled frame remains recoverable in source using TeXFlow markers but is excluded from the PDF. Restore the frame before editing its contents.

The Beamer visual presentation is designed to read more like a slide than a document card, while overflow information remains available when content exceeds the slide area.

## 19. Visual, Source, Split, and PDF

TeXFlow provides four main views:

- **Visual** for semantic editing;
- **Source** for direct LaTeX editing;
- **Split** for Visual and Source together;
- **PDF** for the compiled master PDF.

Switching Visual → Source/Split preserves the relevant source location where possible. Source includes **Visual here** to return to the corresponding visual element and **Open in VS Code** for the normal source editor.

Cross-file navigation can activate the appropriate included `.tex` file in Visual while retaining the same project master.

PDF compilation targets the master document, not necessarily the currently active include.

## 20. Document outline, Focus mode, and navigation

**View → Document outline** shows or hides the left document navigator. Standard documents can show headings and supported structural objects; Beamer uses sections/subsections and frames.

The navigator's **Project Files** are actual files, while **Article** or the Beamer structure represents source structure inside the active document.

**View → Focus mode** removes nonessential chrome so the document becomes the primary surface. `Esc` exits Focus mode. The View menu shows a check mark for active outline and Focus states.

Visual search uses `Cmd+F` / `Ctrl+F`. Matches are highlighted, Enter advances, Shift+Enter goes backward, and Beamer search can move across frames.

## 21. Project Issues and diagnostics

**View → Project Issues** collects actionable project-wide issues such as:

- missing references;
- duplicate labels;
- unused labels;
- missing citation keys;
- duplicate bibliography keys;
- unused bibliography entries;
- project/include issues where applicable.

Items can navigate to the relevant source location when one is available.

**View → Project diagnostics** provides lower-level information about the detected project, loaded sources, bibliography resources, figures, frames, and preserved structures. Project Issues is the user-facing problem list; diagnostics is the technical inspection view.

## 22. Productivity and object operations

The **Edit** menu includes:

- Undo / Redo using TeXFlow history snapshots;
- Find and conservative Find / Replace;
- copy selected object;
- paste object;
- duplicate object;
- move selected object up/down;
- comment out selection.

Object movement is intentionally conservative. Find / Replace refuses command-oriented searches where a literal structural rewrite would be unsafe.

## 23. Preserved LaTeX

A **LaTeX preserved** block means TeXFlow found source it does not currently know how to edit safely as a semantic object. This is not an error. It is a safety boundary designed to prevent destructive rewrites.

Use Source when you need to edit that construct directly. After editing, return to Visual and confirm neighboring supported blocks still render normally.

## 24. Compilation and troubleshooting

If a document fails to compile, inspect the LaTeX log first. TeXFlow cannot make an unsupported image format compilable merely because VS Code can preview it. Bibliography, index, nomenclature, and TikZ workflows may require external LaTeX tools/packages installed locally.

If Visual reports that the document changed before an edit could be saved, refresh Visual and identify whether the source changed externally. Do not disable the stale-document guard as a workaround.

See `TROUBLESHOOTING.md` for common cases.

## 25. Working safely

- Keep important projects under Git or another version-control/backup system.
- Treat `.tex` and `.bib` files as authoritative.
- Unsupported LaTeX should remain preserved rather than being forced through a visual editor.
- Validate major new TeXFlow versions on representative documents before using them for critical work.
- If a regression appears, return to the last manually validated baseline rather than stacking emergency fixes on top of an uncertain state.
