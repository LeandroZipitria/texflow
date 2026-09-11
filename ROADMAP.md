# TeXFlow — Roadmap

TeXFlow is a visual editor for LaTeX inside VS Code.

The `.tex` file remains the source of truth. TeXFlow provides a visual layer for writing and editing documents, presentations, mathematics, citations, figures, tables, comments, and structure without hiding or replacing the underlying LaTeX.

This document collects possible directions for future development. It is intentionally broader than a release plan: features are grouped by area and are not assigned automatically to specific versions.

---

## Current baseline

Stable release: **v0.20.1**

The current release includes, among other features:

- visual editing of LaTeX documents inside VS Code;
- article/report/book and Beamer workflows;
- project-aware Visual editing across `\input` and `\include` files;
- direct creation/linking/removal of `\input` and `\include` relationships from Visual;
- explicit `masterDocument` / `activeDocument` semantics;
- a project navigator that lists real project files separately from document structure;
- project-relative file labels and a resizable persistent project/document sidebar;
- project-wide labels, references, bibliography indexes, and diagnostics;
- Project Issues for missing, duplicate, and unused references/bibliography items;
- cross-file navigation between Visual targets and project sources;
- structured Equation / Matrix / System editing;
- semantic numbered/unnumbered math and heading transformations;
- figures, subfigures, and tables including CSV/TSV paste;
- TikZ insertion, Figure properties, inline source editing, PDF preview, Source navigation, and bare-picture → Figure promotion;
- Beamer frame duplication, movement, disable/restore, blocks, columns, and frame options;
- comments, TODO, FIXME, Author note, commented-out blocks, and comment navigation;
- inline Visual creation/editing of Title, Author, Abstract, and table of contents;
- Visual ↔ Source location-aware switching;
- local spell checking in English and Spanish;
- Focus mode and simplified menus/presentation;
- conservative custom-environment support;
- source preservation and round-trip editing;
- session-scoped TikZ preview temporaries with conservative cleanup;
- live `TextDocument` re-resolution by URI for robust asynchronous Visual edits without opening Source;
- optimized project-index construction without adding cache complexity.

Validated functionality from the current baseline should not be reopened unless a new feature requires it or a reproducible bug is found.

---

# Writing

## Dictionaries and spell checking

**Status: implemented**

Current support includes:

- local spell checking without sending document text to external services;
- enable/disable spell checking;
- English;
- Spanish;
- automatic/manual language selection;
- underlining of misspelled words;
- spelling suggestions;
- corrections only when explicitly accepted by the user;
- exclusion of mathematics, citations, labels, references, URLs, and other non-prose content where appropriate.

Possible future improvements:

- additional languages;
- improved automatic language inference;
- user dictionaries;
- project-specific dictionaries;
- richer ignore rules.

Grammar and style correction should remain a separate problem.

---

## AI-assisted writing

**Status: future**

AI features should be optional and explicitly invoked by the user.

Possible actions on selected text:

- improve writing;
- shorten;
- expand;
- rewrite;
- translate;
- explain;
- summarize;
- change tone;
- convert prose into structured LaTeX;
- suggest alternatives.

AI should operate primarily on the current selection, paragraph, block, or frame rather than silently processing the entire document.

Any external AI integration should be explicit, configurable, and opt-in.

---

## Comments and notes

**Status: implemented core workflow**

Current support includes:

- ordinary LaTeX `%` source comments;
- Comment, TODO, FIXME, and Author note objects;
- preserved `comment` environments;
- insertion of notes and commented-out blocks;
- conversion of selected Visual text into commented-out content;
- compact source-backed markers outside the document/slide flow;
- a bottom comments inspector;
- previous/next navigation through comments in document order;
- visual previews for commented-out LaTeX;
- visual-only hiding of comment markers;
- explicit source deletion with confirmation;
- Beamer-safe comment handling;
- TODO/FIXME tag preservation during editing.

Possible future improvements:

- richer aggregation when multiple comments share the same location;
- optional comment filtering;
- support for `todonotes`, including `\todo{}`, `\todo[inline]{}`, and `\missingfigure{}`;
- richer review metadata if a clear use case appears.

Comments should remain outside the main visual document flow so they do not crowd pages or change Beamer slide layout.

TeXFlow should not attempt to reproduce a full Word-style track-changes system unless there is a clear use case.

---

# Structure and navigation

## Document outline

**Status: implemented for navigation; structural editing remains partial**

Current standard-document support includes:

- chapters where applicable;
- sections;
- subsections;
- subsubsections;
- click-to-navigate;
- figures;
- tables;
- equations;
- associated labels where available.

Current Beamer support includes:

- source files;
- sections;
- subsections;
- frames;
- frame thumbnails;
- collapsible navigation groups;
- click-to-navigate.

The sidebar also distinguishes real **Project Files** from the structure of the active document. Project paths are displayed relative to the master-project folder and the sidebar width is resizable and persistent.

Possible future improvements:

- independent label entries where useful;
- blocks and other relevant structural elements in Beamer;
- collapse/expand for standard-document hierarchy;
- rename;
- reorder;
- duplicate;
- drag and drop.

Structural editing actions should be introduced incrementally because they modify source ranges and therefore carry more source-preservation risk than read-only navigation.

---

## Search and navigation

**Status: implemented for document search and core source/project navigation**

Current support includes:

- `Cmd+F` / `Ctrl+F` in Visual mode;
- case-insensitive document search;
- highlighting of all matches;
- a distinct active match;
- next/previous navigation;
- Enter / Shift+Enter navigation;
- search across Beamer frames;
- Visual → Source location mapping;
- Source → Visual via **Visual here**;
- explicit **Open in VS Code** source action;
- cross-file Visual navigation within a project;
- reference and citation target navigation.

Possible future improvements:

- project-wide free-text search;
- search headings as a dedicated mode;
- search equations/figures/tables by semantic type;
- optional replace workflow beyond the current conservative literal operation;
- stronger cursor/selection preservation for complex transitions.

---

# Visual ↔ Source ↔ PDF workflow

**Status: Visual ↔ Source implemented; PDF synchronization remains future**

A central long-term objective remains strong synchronization between the three representations of the document:

**Visual ↔ LaTeX source ↔ PDF**

Current support includes:

- visual element → corresponding source;
- source → corresponding visual element where the structure can be mapped safely;
- cross-file source/Visual navigation;
- master-document PDF compilation while editing included files;
- TikZ visual/source/preview workflow.

Possible future improvements:

- visual element → corresponding PDF position;
- PDF → corresponding source;
- improved SyncTeX integration;
- stronger cursor and selection preservation when switching views;
- preserve scroll position where possible.

This could become one of TeXFlow's defining capabilities.

---

# LaTeX intelligence

## Labels and cross-references

**Status: implemented core project-wide workflow**

Current support includes:

- project-wide label index;
- searchable label picker;
- missing-reference detection;
- duplicate-label detection;
- unused-label detection;
- navigation from reference to target;
- navigation to source locations;
- common commands including `\ref`, `\eqref`, `\autoref`, `\cref`, and related preserved variants.

Possible future improvements:

- richer preview of the target associated with a label;
- dedicated target → all references inspector;
- semantic filtering by equation/figure/table/section;
- better display names for unlabeled structural targets.

The interface should simplify references without hiding their underlying LaTeX representation.

---

## Bibliography and citations

**Status: implemented core project-wide workflow**

Current support includes:

- project bibliography indexing;
- search by key, author/editor, title, year/date;
- missing citation-key detection;
- duplicate bibliography-key detection;
- unused-entry detection;
- citation → bibliography navigation;
- bibliography entry → citation usage navigation;
- inline `\bibitem` indexing;
- support for common BibTeX/natbib and BibLaTeX/biber setups.

Possible future improvements:

- richer formatted previews;
- more advanced multiple-citation editing;
- bibliography-entry editing with explicit source-preservation rules;
- optional future Zotero integration.

TeXFlow should avoid becoming a separate reference manager.

---

## Compilation diagnostics

**Status: partially implemented**

Current support includes:

- earlier detection of fatal compilation failures;
- direct handling of common missing-file failures;
- Project Issues for project/index problems;
- technical project diagnostics;
- source navigation for many detected issues.

Possible future improvements:

- associate LaTeX errors/warnings with the relevant visual element;
- simplified explanations of common LaTeX errors;
- stronger warning/error distinction in Visual;
- direct source navigation from compiler diagnostics;
- optional grouping by file/frame/object.

TeXFlow should avoid silently rewriting the source to fix errors automatically.

---

# Mathematics

## Structured equation editor

**Status: implemented core workflow**

Current support includes:

- Equation / Matrix / System entry points;
- inline/display placement;
- numbered/unnumbered forms;
- single equations;
- aligned equations;
- gathered/multiline structures;
- cases;
- common matrices and delimiters;
- labels;
- row-level numbering behavior where applicable;
- common symbols and accents;
- safe `align` ↔ `align*` round trips.

Possible future improvements:

- more direct visual editing of nested fractions/superscripts/subscripts;
- richer matrix grid operations;
- additional symbol groups;
- more structured editing of deeply nested math;
- optional math-to-LaTeX assistance.

The source representation should always remain inspectable and editable.

---

# Tables

## Table editing

**Status: implemented core workflow**

Current support includes:

- add/remove rows;
- add/remove columns;
- cell editing and keyboard navigation;
- column alignment;
- captions;
- labels;
- placement;
- caption position;
- Booktabs;
- CSV/TSV paste/import.

Possible future improvements:

- column width controls;
- `tabularx`;
- `longtable`;
- multirow/multicolumn structures;
- richer preview and formatting controls.

Complex package-specific tables should remain preserved until they have a safe serialization model.

---

# Figures

## Figure editing

**Status: implemented core workflow**

Current support includes:

- unified image selection;
- multiple-image routing to subfigures;
- width;
- rotation;
- placement;
- captions and short captions;
- labels;
- caption position;
- relative project paths;
- visual Figure properties.

Possible future improvements:

- drag and drop images;
- richer subfigure editing after insertion;
- simple multi-panel layout controls;
- stronger figure/PDF synchronization.

---

# TikZ

## TikZ integration

**Status: first source-driven stage implemented**

Current support includes:

- detection of `tikzpicture`;
- **Insert → TikZ figure...**;
- Figure-style properties for wrapped TikZ;
- inline TikZ source editing inside TeXFlow;
- PDF preview beside the editor;
- Source navigation;
- **Make figure** for a bare `tikzpicture`;
- session-scoped temporary preview lifecycle and conservative crash cleanup.

Possible future improvements:

- TikZ snippets;
- templates for common diagrams;
- generated TikZ from structured prompts;
- optional AI-assisted TikZ generation;
- simple parameter controls for known diagram types;
- preview invalidation/caching only if profiling shows a real need and preamble dependencies are modeled correctly.

A complete visual TikZ drawing application should not be an early objective because it would effectively become a separate product.

---

# Templates and reusable components

## Insertable LaTeX components

**Status: partially implemented**

Current Structure/Insert/Beamer menus already cover theorem/proof-style environments, equations, figures, tables, frames, blocks, and columns.

Possible future additions:

- code block;
- algorithm;
- reusable institutional structures;
- richer Beamer frame templates such as figure + text or title + columns.

---

## User-defined snippets

**Status: future**

Allow users to define reusable LaTeX snippets or structures.

Possible uses:

- custom theorem environments;
- institutional templates;
- repeated frame structures;
- custom blocks;
- domain-specific LaTeX.

---

# Extensibility

## Custom LaTeX environments

**Status: conservative first stage implemented**

TeXFlow supports configured simple custom environments through `texflow.customEnvironments` while preserving unsupported/complex instances as raw LaTeX.

Possible future improvements:

- richer environment schemas;
- configurable inline vs block behavior;
- parameter/title mapping;
- project-local environment configuration;
- safer support for environments defined by document classes/packages.

The core should not hard-code every possible LaTeX environment.

---

# Document settings

## Visual document settings

**Status: implemented for common settings**

**File → Document settings...** exposes controlled settings such as:

- common paper, font, spacing, and preamble options;
- language;
- paper size/orientation;
- font size;
- line/paragraph spacing;
- margins;
- alignment;
- columns;
- hyperlinks;
- Beamer aspect/theme;
- raw preamble access.

Advanced or unusual settings remain accessible through Source.

The visual settings panel should never attempt to replace the full LaTeX preamble.

---

# Large documents and projects

## Multi-file LaTeX projects

**Status: core project-aware editing implemented**

Current support includes:

- `\input` and `\include` discovery;
- **Insert → Included file...** to create a new `.tex` file or link an existing file;
- explicit `\input` / `\include` choice;
- removal of the relationship from the document without deleting the physical file;
- nested include graph;
- explicit master document;
- explicit active document;
- missing includes and include cycles;
- real project files kept separate;
- Visual editing of included `.tex` files;
- project-relative file navigation;
- project-wide labels and references;
- project-wide bibliography indexing;
- project-wide diagnostics and Project Issues;
- cross-file navigation;
- master-document compilation while editing an include.

Possible future improvements:

- project-wide outline combining multiple files;
- reorder/move structures across files with explicit source-preservation rules;
- stronger project-wide free-text search;
- richer master-document selection/override controls where automatic identification is ambiguous;
- larger-project performance profiling on real books/theses.

This remains important for theses, books, large papers, course notes, and long Beamer projects.

---

# Beamer

## Advanced presentation workflow

**Status: implemented core frame operations**

Current support includes:

- frame thumbnails;
- section/subsection navigation;
- search across frames;
- duplicate frame;
- move frame up/down;
- disable/restore frame while preserving recoverable source;
- blocks/alert/example blocks;
- columns;
- frame options;
- frame-local text sizes;
- comments that remain outside slide layout;
- source-aware navigation;
- a cleaner slide-like Visual presentation.

Possible future improvements:

- drag-and-drop frame reordering;
- richer frame thumbnail previews;
- presenter notes if a clear source representation is chosen;
- direct slide/PDF synchronization.

---

## Overlays

**Status: future**

Possible later support for:

- `\pause`;
- `<1->`;
- `<2>`;
- `\only`;
- `\uncover`;
- `\visible`.

Overlay editing should be approached carefully because of the complexity of preserving exact Beamer behavior.

---

# AI for LaTeX

**Status: future**

Beyond writing assistance, AI could eventually help with LaTeX-specific tasks.

Possible actions:

- generate an equation from a description;
- explain an equation;
- convert prose to LaTeX;
- generate a table skeleton;
- generate TikZ;
- explain compilation errors;
- suggest LaTeX commands;
- transform selected content into a Beamer frame;
- simplify complex LaTeX while preserving output.

AI should not silently rewrite the document. All modifications should remain reviewable before being applied.

---

# Performance and architecture

## Current position

`0.20.0` introduced a targeted project-index optimization after measurement. `0.20.1` preserves that performance architecture while hardening Visual typing/TextDocument lifecycle behavior. Parser, spellcheck, TikZ caching, activation behavior, and packaging were not broadly reworked where measurements did not justify the additional complexity.

Possible future work:

- profile real very-large projects;
- revisit the project watcher only if workspace-scale measurements show a problem;
- consider bundling only if install/activation/runtime measurements show material benefit;
- continue extracting host/webview domains from `extension.ts` only when extraction has a clear safety or maintainability benefit;
- avoid parallel parsers, speculative caches, and universal-AST rewrites.

---

# Packaging

## Current position

The `0.20.0` pre-release package remains small (about 2.4 MB before final documentation deltas) and includes only the English and Spanish cspell dictionaries.

Possible future work:

- evaluate bundling if measured benefits become material;
- continue checking VSIX size/file count at release time;
- avoid adding language dictionaries or runtime dependencies implicitly.

---

# Possible product pillars

| Area | Examples |
|---|---|
| Writing | spellcheck, comments/notes, optional AI |
| Structure | outline, navigation, structural editing |
| LaTeX intelligence | references, bibliography, diagnostics |
| Content | math, tables, figures, TikZ |
| Workflow | Visual ↔ Source ↔ PDF |
| Extensibility | custom environments, snippets |
| Projects | multi-file editing and project-wide intelligence |
| Beamer | frame operations, navigation, overlays |
| AI | writing, LaTeX, math, TikZ |

---

# Potential differentiators

Several capabilities are becoming particularly distinctive for TeXFlow:

1. **Visual editing across real multi-file LaTeX projects without flattening them**
2. **Visual ↔ Source synchronization with explicit source preservation**
3. **Project-wide labels, references, bibliography, and diagnostics**
4. **TikZ preview/source integration inside a visual LaTeX workflow**
5. **Document and Beamer structure presented without replacing the underlying source**
6. **Optional future contextual AI operating on selected LaTeX content**

The central principle remains:

> TeXFlow does not replace LaTeX. It makes working directly with LaTeX easier.

---

# Development principles

Future features should preserve the following principles:

- the `.tex` file remains canonical;
- avoid source corruption;
- preserve round-trip editing;
- distinguish master-document and active-document scope explicitly;
- prefer local/native capabilities before introducing new dependencies;
- measure before optimizing;
- avoid external services unless explicitly requested and configured;
- do not silently modify source;
- do not build functionality already provided well by VS Code or the operating system;
- prefer incremental features over large architectural rewrites;
- keep advanced LaTeX accessible;
- avoid turning TeXFlow into a replacement for VS Code, LaTeX, Zotero, or a general-purpose graphics editor;
- keep the interface simple, comfortable, clear, and clean;
- require explicit lifecycle parity decisions for visual features: view, create, edit, remove-from-document, and Source navigation;
- keep the document itself as the primary visual surface.

---

# Status

This file is a **future-development roadmap**, not a commitment to specific releases.

Features should be promoted into release plans only after:

1. feasibility analysis;
2. architecture review;
3. source-preservation risk analysis;
4. minimal prototype;
5. automated/manual validation;
6. decision on scope and version.

`1.0.0` remains a separate product decision. Completing `0.20.x` does not automatically trigger a 1.0 release.
