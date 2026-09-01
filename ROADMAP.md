# TeXFlow — Roadmap

TeXFlow is a visual editor for LaTeX inside VS Code.

The `.tex` file remains the source of truth. TeXFlow provides a visual layer for writing and editing documents, presentations, mathematics, citations, figures, tables, and structure without hiding or replacing the underlying LaTeX.

This document collects possible directions for future development. It is intentionally broader than a release plan: features are grouped by area and are not yet assigned to specific versions.

---

## Current baseline

Stable release: **v0.16.0**

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
- source preservation and round-trip editing;
- local spell checking in English and Spanish;
- automatic/manual language selection for spell checking;
- Beamer frame thumbnails and section/subsection navigation;
- visual document outline for standard documents;
- click-to-navigate document structure;
- figures, tables, and equations in the standard-document outline.

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

**Status: partially implemented**

Current support for standard documents includes:

- chapters where applicable;
- sections;
- subsections;
- subsubsections;
- click-to-navigate;
- figures;
- tables;
- equations;
- associated labels where available.

Current support for Beamer includes:

- source files;
- sections;
- subsections;
- frames;
- frame thumbnails;
- collapsible navigation groups;
- click-to-navigate.

Possible future improvements:

- independent label entries where useful;
- blocks and other relevant structural elements in Beamer;
- collapse/expand for standard-document hierarchy;
- rename;
- reorder;
- duplicate;
- drag and drop.

Example:

```text
Introduction
  Motivation
  Literature
Model
  Assumptions
  Equilibrium
  Equation: eq:model
Results
  Figure: Price dispersion
  Table: Main estimates
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

Structural editing actions should be introduced incrementally because they modify source ranges and therefore carry more source-preservation risk than read-only navigation.

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

Current support already includes several structured mathematics workflows.

Possible further improvements around:

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

Current support already includes frame thumbnails and section/subsection navigation.

Possible improvements:

- reorder frames by drag and drop;
- duplicate frame;
- comment/uncomment frame;
- frame preview refinements;
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
| Writing | spellcheck, AI, comments |
| Structure | outline, navigation, structural editing |
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

This file is a **future-development roadmap**, not a commitment to specific releases.

Features should be promoted into release plans only after:

1. feasibility analysis;
2. architecture review;
3. source-preservation risk analysis;
4. minimal prototype;
5. manual or automated validation;
6. decision on scope and version.
