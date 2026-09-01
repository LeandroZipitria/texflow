<p align="center">
  <img src="media/texflow-icon.png" alt="TeXFlow logo" width="160">
</p>

# TeXFlow

## Write LaTeX, without writing LaTeX.

TeXFlow is a visual editor for real LaTeX files inside VS Code. It lets you focus on writing while keeping your `.tex` files intact, editable, and fully accessible.

**Current stable release: 0.16.0.**

TeXFlow does not replace LaTeX with a proprietary format. Your `.tex` file remains the source of truth. When TeXFlow cannot safely edit a complex construct visually, it preserves the underlying LaTeX rather than silently rewriting it.

## Highlights

- Visual editing for `article`, `report`, `book`, and Beamer documents.
- Semantic paragraphs, headings, lists, and document structure.
- Bold, italic, underline, color, and paragraph alignment.
- Inline and display mathematics, equations, `align`, `gather`, `multline`, cases, and matrices.
- Citations, bibliography workflows, labels, and cross-references.
- Figures with captions, labels, resize, rotation, and subfigures.
- Tables with row/column editing, alignment, captions, labels, Booktabs, and CSV/TSV import.
- Document spacing, local columns, document settings, and raw preamble access.
- Beamer frames, blocks, columns, frame options, and improved paragraph persistence.
- Copy, cut, paste, duplicate, and move selected semantic objects.
- Visual, Source, Split, and PDF workflows.
- Local spell checking with English and Spanish dictionaries.
- Automatic, English, and Español language modes for spell checking.
- Conservative preservation of unsupported LaTeX.

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

1. Open a `.tex` file in VS Code.
2. Run **TeXFlow: Open Visual LaTeX Editor**.
3. Edit in Visual mode, or switch between Visual, Source, Split, and PDF.
4. Compile with your local LaTeX toolchain.
5. Return to Source at any time: the `.tex` file remains canonical.

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
npm run compile
```

Run the regression fixtures with:

```bash
bash tests/run_fixtures.sh
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Author and development approach

**Created by Leandro Zipitria.**

TeXFlow was designed and developed through an iterative human–AI collaboration. The product concept, design decisions, testing, and development direction are by Leandro Zipitria. Implementation code was generated with OpenAI's ChatGPT under the creator's direction and testing.

## Repository

https://github.com/LeandroZipitria/texflow

## License

MIT. See [LICENSE](LICENSE).
