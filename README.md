# TeXFlow

TeXFlow is a visual editor for real LaTeX files inside VS Code.

It keeps `.tex` as the source of truth while letting you edit Beamer slides and document-mode content visually, with synced PDF preview and source-aware updates.

![TeXFlow screenshot placeholder](media/texflow-icon.png)

## What it supports today

- Beamer Visual Mode.
- Document Mode for `article`, `report`, and `book`.
- Visual, Source, Split, and PDF workflows.
- Inline and display math editing.
- Lists and common structural content.
- TOC-aware document structure in supported modes.

## Support matrix

| Capability | Beamer | Article | Report | Book |
| --- | --- | --- | --- | --- |
| Visual mode | supported | supported | supported | supported |
| Visual editing | supported | supported | supported | supported |
| Math editing | supported | supported | supported | supported |
| Lists | supported | supported | supported | supported |
| Frames | supported | planned | planned | planned |
| Chapters | planned | supported | supported | supported |
| TOC | supported | supported | supported | supported |
| PDF | supported | supported | supported | supported |
| Bibliography | planned | planned | planned | planned |

## Installation

1. Build or obtain the VSIX.
2. In VS Code, open the Extensions view.
3. Use `Install from VSIX...`.
4. Select the TeXFlow VSIX.

## Requirements

- VS Code
- A working LaTeX installation
- `latexmk` for the bundled fixture checks

## Basic workflow

1. Open a `.tex` file.
2. Choose Visual, Source, Split, or PDF.
3. Edit the document visually or in source.
4. Let TeXFlow sync changes back to the file.
5. Compile and inspect the resulting PDF.

## Beamer Mode

Beamer documents are edited frame by frame. TeXFlow supports visible text, lists, and math in presentation slides.

## Document Mode

TeXFlow supports `article`, `report`, and `book` in a continuous visual layout with structural navigation for headings and TOC-aware content.

## Compilation

TeXFlow does not replace LaTeX compilation. It helps you edit the `.tex` source and inspect the resulting PDF.

## Development and tests

```bash
npm install
npm run compile
bash tests/run_fixtures.sh
```

> Development note: the current `package-lock.json` still references registry tarballs from an internal Artifactory mirror. The public TeXFlow source and fixtures are ready, but a fully reproducible `npm ci` needs registry normalization before it can be treated as a clean public build step.

## Known limitations

- Bibliography support is planned, not complete.
- Advanced visual figure editing is not yet a full replacement for source editing.
- Table editing is not a public promise in this release.

## Roadmap

- Bibliography workflows.
- Better figure editing.
- Stronger document structure tools.
- More regression coverage.
