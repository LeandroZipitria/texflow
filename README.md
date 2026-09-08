<p align="center">
  <img src="media/texflow-icon.png" alt="TeXFlow logo" width="160">
</p>

# TeXFlow

## Write LaTeX, without writing LaTeX.

TeXFlow is a visual editor for real LaTeX files inside VS Code. It lets you focus on writing while keeping your `.tex` files intact, editable, and fully accessible.

**Current stable release: 0.20.0.**

TeXFlow does not replace LaTeX with a proprietary format. Your `.tex` files remain the source of truth. When TeXFlow cannot safely edit a complex construct visually, it preserves the underlying LaTeX rather than silently rewriting it.

## Highlights

- Visual editing for `article`, `report`, `book`, and Beamer documents.
- Project-aware Visual editing across `\input` and `\include` files while preserving every source file separately.
- Explicit master-document and active-document handling for multi-file projects.
- Project navigator with real `.tex`, `.bib`, and supported figure files; project-relative paths; and a resizable persistent sidebar.
- Project-wide labels and cross-references, including navigation, missing references, duplicate labels, and unused labels.
- Project-wide bibliography intelligence with search by citation key, author, title, and year; missing keys; unused entries; and citation/BibTeX navigation.
- **Project Issues** for project-wide reference, bibliography, and include diagnostics.
- Semantic paragraphs, headings, lists, and document structure.
- Bold, italic, underline, color, and paragraph alignment.
- Unified Equation, Matrix, and System workflows with inline/display placement, semantic numbering, aligned equations, cases, matrices, delimiters, and common accents/symbols.
- Numbered/unnumbered structural editing, including safe `align` ↔ `align*` and `section` ↔ `section*` round trips.
- Figures with captions, labels, resize, rotation, subfigures, and unified figure insertion.
- Tables with row/column editing, alignment, captions, labels, Booktabs, and CSV/TSV paste/import.
- TikZ figures with insertion, Figure properties, inline source editing, PDF preview, Source navigation, and promotion of a bare `tikzpicture` to a Figure.
- Beamer frame operations including duplicate, move, disable/restore, blocks, columns, frame options, and frame-local text sizes.
- Comments and notes with Comment, TODO, FIXME, Author note, commented-out blocks, and document-order navigation.
- Visual ↔ Source navigation that preserves the relevant document location, including cross-file navigation.
- Visual, Source, Split, and PDF workflows.
- Local spell checking with English and Spanish dictionaries and automatic/manual language selection.
- Focus mode, a cleaner document/slide presentation, and a simplified top-level menu structure.
- Conservative support for configured custom environments.
- Conservative preservation of unsupported LaTeX.
- Start from TeXFlow — create a standalone `.tex` file or a LaTeX project directly from the TeXFlow sidebar.
- Document search in Visual mode with `Cmd/Ctrl+F`, highlighted matches, and next/previous navigation, including across Beamer frames.

## Installation

### Visual Studio Marketplace

Install **TeXFlow — Visual LaTeX** from the VS Code Extensions view, or use the Marketplace listing:

https://marketplace.visualstudio.com/items?itemName=leandrozipitria.texflow

### Install from VSIX

1. Download the `.vsix` from the GitHub release.
2. In VS Code, open the Extensions view.
3. Choose **Install from VSIX...**.
4. Select the TeXFlow package.

## Requirements

- VS Code 1.90 or newer.
- A working local LaTeX distribution such as TeX Live or MiKTeX.
- The tools required by your document, for example `latexmk`, `bibtex`, or `biber` when applicable.

## Quick start

1. Open **TeXFlow** from the VS Code Activity Bar.
2. Choose **New document** or **Open existing .tex**.
3. For a new document, create either:
   - a standalone `.tex` file; or
   - a LaTeX project with `main.tex`, `preamble.tex`, and `figures/`.
4. Choose `article`, `report`, `book`, or Beamer.
5. Edit in Visual mode, or switch between Visual, Source, Split, and PDF.
6. Compile with your local LaTeX toolchain.

In multi-file projects, opening an included `.tex` file in TeXFlow keeps the master document for project-wide metadata and compilation while making the included file the active Visual editing target.

TeXFlow saves accepted visual edits back to the active `.tex` source immediately, so ordinary Visual editing does not require a separate save step. Standard **Save** and **Save as...** actions remain available when needed.

You can also right-click a folder in the VS Code Explorer to create a TeXFlow document there, or right-click a `.tex` file to open it with TeXFlow.

## Documentation

- [User Manual](docs/USER_MANUAL.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Development and architecture](docs/DEVELOPMENT.md)
- [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md)

## Design principle

TeXFlow is intentionally conservative. Visual editing is used where the source can be parsed and serialized safely. Unsupported or highly customized LaTeX is preserved so that opening a document in TeXFlow does not require converting it to another document format.

LyX is used only as a technical reference for structural-editing problems that mature LaTeX editors have already confronted, such as paragraph semantics, embedded objects, cursor boundaries, and source preservation. TeXFlow's interface and visual editors are independent product decisions.

## Development

```bash
npm ci
npm run check:fast
```

Run the full regression gate, including LaTeX fixtures, with:

```bash
npm run check
```

Create a release package with:

```bash
npm run check:release
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Author and development approach

**Created by Leandro Zipitria.**

TeXFlow was designed and developed through an iterative human–AI collaboration. The product concept, design decisions, testing, and development direction are by Leandro Zipitria. Implementation code was generated with OpenAI's ChatGPT under the creator's direction and testing.

## Repository

https://github.com/LeandroZipitria/texflow

## License

MIT. See [LICENSE](LICENSE).
