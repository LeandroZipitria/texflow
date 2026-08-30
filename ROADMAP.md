# TeXFlow — Readmap

TeXFlow is a visual editor for LaTeX inside VS Code.

The `.tex` file remains the source of truth. TeXFlow provides a visual layer for writing and editing documents, presentations, mathematics, citations, figures, tables, and structure without hiding or replacing the underlying LaTeX.

This document collects possible directions for future development. It is intentionally broader than a release plan: features are grouped by area and are not yet assigned to specific versions.

---

## Current baseline

Stable baseline: **v0.14.3**

The current release includes, among other features:

- visual editing of LaTeX documents inside VS Code;
- Beamer support;
- blocks and columns;
- display math inside blocks;
- frame-level text sizes;
- citations;
- labels and references;
- figures;
- tables;
- mathematics editing;
- source preservation and round-trip editing.

Validated functionality from v0.14.3 should not be reopened unless a new feature requires it.

---

# Writing

## Dictionaries and spell checking

Add local spell checking without sending document text to external services.

Possible features:

- enable/disable spell checking;
- configurable language;
- English;
- Spanish;
- automatic language inference from LaTeX when possible;
- manual language override;
- underline misspelled words;
- spelling suggestions;
- corrections only when explicitly accepted by the user.

Spell checking should ignore:

- LaTeX commands;
- mathematics;
- citations;
- labels;
- references;
- URLs;
- code;
- other non-prose elements.

The first implementation should prefer local or native capabilities already available through VS Code, Electron, Chromium, or the operating system.

Grammar and style correction should be treated as a separate problem.

---

## AI-assisted writing

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

## Comments and review

Possible review tools:

- visual comments;
- highlights;
- TODO and FIXME navigation;
- support for `\todo{}`;
- show/hide LaTeX `%` comments;
- navigation between comments;
- lightweight review mode.

TeXFlow should not attempt to reproduce a full Word-style track-changes system unless there is a clear use case.

---

# Structure and navigation

## Document outline

Provide a visual outline of the document.

For standard documents:

- sections;
- subsections;
- subsubsections;
- figures;
- tables;
- equations;
- labels.

For Beamer:

- sections;
- frames;
- blocks;
- relevant structural elements.

Possible actions:

- click to navigate;
- rename;
- reorder;
- duplicate;
- collapse/expand;
- drag and drop.

Example:

```text
Introduction
  Motivation
  Literature
Model
  Assumptions
  Equilibrium
Results
Conclusion
```

For Beamer:

```text
Introduction
  Frame 1
  Frame 2
Model
  Frame 3
  Frame 4
Results
  Frame 5
```

---

## Search and navigation

Possible improvements:

- search inside the visual document;
- search headings;
- search labels;
- search citations;
- search equations;
- navigate between figures and tables;
- jump directly from a visual element to its LaTeX source.

---

# Visual ↔ Source ↔ PDF workflow

A central long-term objective should be strong synchronization between the three representations of the document:

**Visual ↔ LaTeX source ↔ PDF**

Possible improvements:

- visual element → corresponding source;
- source → corresponding visual element;
- visual element → corresponding PDF position;
- PDF → corresponding source;
- improved SyncTeX integration;
- preserve cursor and selection when switching views;
- preserve scroll position where possible.

This could become one of TeXFlow's defining capabilities.

---

# LaTeX intelligence

## Labels and cross-references

Improve handling of labels and references.

Possible features:

- autocomplete existing labels;
- preview the target associated with a label;
- detect missing references;
- detect duplicate labels;
- navigate from `\ref` to target;
- navigate from target to references;
- support different reference commands:
  - `\ref`;
  - `\eqref`;
  - `\autoref`;
  - `\cref`.

The interface should simplify references without hiding their underlying LaTeX representation.

---

## Bibliography and citations

Expand bibliography support while avoiding the creation of a separate reference manager.

Possible features:

- search bibliography entries;
- preview author, year, title, and journal;
- insert multiple citations;
- support common citation commands;
- detect missing citation keys;
- identify bibliography entries not currently cited;
- navigate citation → BibTeX entry;
- navigate BibTeX entry → citations;
- optional future Zotero integration.

---

## Compilation diagnostics

Improve how LaTeX errors and warnings are presented.

Possible features:

- errors associated with the relevant visual element;
- warnings associated with a frame, paragraph, equation, table, or figure;
- simplified explanation of common LaTeX errors;
- "Open source" action;
- navigate directly to the problematic source location;
- distinguish errors from warnings.

TeXFlow should avoid silently rewriting the source to fix errors automatically.

---

# Mathematics

## Advanced equation editor

Extend the current mathematics editor.

Possible additions:

- fractions;
- superscripts and subscripts;
- integrals;
- sums;
- products;
- limits;
- delimiters;
- cases;
- matrices;
- aligned equations;
- numbered and unnumbered equations;
- common mathematical symbols.

Matrices could eventually have a small grid-based visual editor.

---

## Equation structure

Possible support for:

- `equation`;
- `equation*`;
- `align`;
- `align*`;
- `gather`;
- `cases`;
- matrix environments.

The source representation should always remain inspectable and editable.

---

# Tables

## More powerful table editing

Possible improvements:

- add/remove rows;
- add/remove columns;
- column alignment;
- column width;
- `booktabs`;
- `tabularx`;
- captions;
- labels;
- table positioning;
- more robust preview.

---

## Paste tables from spreadsheets

A particularly useful workflow:

**Excel / Google Sheets / CSV → copy → paste → LaTeX table**

Possible behavior:

- detect tabular clipboard data;
- preview the resulting table;
- allow basic formatting choices;
- generate the corresponding LaTeX;
- preserve source transparency.

---

# Figures

## Improved figure editing

Possible improvements:

- drag and drop images;
- visual width selector;
- placement options;
- captions;
- labels;
- preview;
- relative paths;
- subfigures;
- `subcaption`;
- multiple-panel figures.

---

# TikZ

## TikZ integration

TikZ should initially be treated as source-driven graphics rather than as a full graphical editor.

First possible stage:

- detect `tikzpicture`;
- display a rendered preview;
- open/edit TikZ source easily;
- refresh preview after source changes.

Later possibilities:

- TikZ snippets;
- templates for common diagrams;
- generated TikZ from structured prompts;
- AI-assisted TikZ generation;
- simple parameter controls for known diagram types.

A complete visual TikZ drawing application should not be an early objective because it would effectively become a separate product.

---

# Templates and reusable components

## Insertable LaTeX components

Possible menu:

```text
Insert
  Theorem
  Definition
  Example
  Proof
  Equation
  Figure
  Table
  Algorithm
  Code block
```

For Beamer:

```text
Frame
  Title + text
  Two columns
  Figure + text
  Block
  Alert block
  Equation
```

---

## User-defined snippets

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

Allow TeXFlow to understand selected user-defined environments without hard-coding all of them into the core application.

Example:

```latex
\begin{theorem}
...
\end{theorem}
```

or a custom environment defined by a document class or package.

Possible future configuration:

```json
{
  "mytheorem": {
    "type": "block",
    "title": "Theorem"
  }
}
```

This would make TeXFlow useful across a much wider range of LaTeX workflows.

---

# Document settings

## Visual document settings

Expose common document options in a controlled interface.

Possible settings:

```text
Document class   article
Language         Spanish
Paper size       A4
Font size        11pt
Bibliography     biblatex
```

Advanced or unusual settings should remain accessible through the source.

The visual settings panel should never attempt to replace the full LaTeX preamble.

---

# Large documents and projects

## Multi-file LaTeX projects

Support larger projects using:

- `\input`;
- `\include`;
- master documents;
- multiple `.tex` files;
- shared bibliography files;
- cross-file labels and references.

Possible features:

- project-wide outline;
- navigate between files;
- identify the master document;
- visual editing while preserving the original project structure.

This would be important for:

- theses;
- books;
- large papers;
- course notes;
- long Beamer projects.

---

# Beamer

## Advanced presentation workflow

Possible improvements:

- frame thumbnails;
- reorder frames by drag and drop;
- duplicate frame;
- comment/uncomment frame;
- section navigation;
- frame preview;
- presenter notes.

---

## Overlays

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

AI should not silently rewrite the document.

All modifications should remain reviewable before being applied.

---

# Possible product pillars

The roadmap can be summarized into several broad areas:

| Area | Examples |
|---|---|
| Writing | dictionaries, spellcheck, AI, comments |
| Structure | outline, navigation, drag and drop |
| LaTeX intelligence | references, bibliography, diagnostics |
| Content | math, tables, figures, TikZ |
| Workflow | Visual ↔ Source ↔ PDF |
| Extensibility | custom environments, snippets |
| Projects | multi-file documents |
| Beamer | thumbnails, reordering, overlays |
| AI | writing, LaTeX, math, TikZ |

---

# Potential differentiators

Several features could become particularly distinctive for TeXFlow:

1. **Visual ↔ Source ↔ PDF synchronization**
2. **Document outline and structural editing**
3. **Intelligent labels and cross-references**
4. **TikZ preview and source integration**
5. **Contextual AI operating on selected LaTeX content**
6. **Visual editing while preserving `.tex` as the canonical source**

The central principle should remain:

> TeXFlow does not replace LaTeX. It makes working directly with LaTeX easier.

---

# Development principles

Future features should preserve the following principles:

- the `.tex` file remains canonical;
- avoid source corruption;
- preserve round-trip editing;
- prefer local/native capabilities before introducing new dependencies;
- avoid external services unless explicitly requested and configured;
- do not silently modify source;
- do not build functionality already provided well by VS Code or the operating system;
- prefer incremental features over large architectural rewrites;
- keep advanced LaTeX accessible;
- avoid turning TeXFlow into a replacement for VS Code, LaTeX, Zotero, or a general-purpose graphics editor.

---

# Status

This file is a **future-development readmap**, not a commitment to specific releases.

Features should be promoted into release plans only after:

1. feasibility analysis;
2. architecture review;
3. source-preservation risk analysis;
4. minimal prototype;
5. manual or automated validation;
6. decision on scope and version.
