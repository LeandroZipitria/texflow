# TeXFlow troubleshooting

## “Document changed before the visual edit could be saved”

TeXFlow detected that the Source no longer matches the range Visual intended to edit. This guard prevents overwriting unrelated or externally modified LaTeX.

1. Stop editing the affected visual block.
2. Refresh/reopen Visual.
3. Check whether Source was modified externally or by another extension/process.
4. Reproduce the smallest sequence of Visual actions if the conflict came entirely from TeXFlow.

Do not disable the guard as a workaround.

## A figure previews but pdfLaTeX rejects it

TeXFlow validates real PDF, PNG and JPEG signatures. A file can have a `.jpg` filename while actually containing WebP/AVIF data. Such files must be converted outside TeXFlow to a real supported format before insertion.

## “LaTeX preserved” appears

The construct is outside TeXFlow's current safe semantic model. Edit it in Source. This is an intentional preservation state, not a compilation error.

## Bibliography is missing

Check that the `.bib` resource exists, the preamble uses the intended BibTeX/BibLaTeX setup, and the local LaTeX toolchain includes the appropriate backend (`bibtex` or `biber`).

## Index or nomenclature does not appear

The packages/setup commands can be inserted by Labs, but the local build toolchain must also run the required index/nomenclature processors. A simple one-pass PDF build may only create auxiliary files.

## A package is missing

Install it through the user's LaTeX distribution (TeX Live/MiKTeX). TeXFlow may add `\usepackage` declarations, but it does not install system LaTeX packages.
