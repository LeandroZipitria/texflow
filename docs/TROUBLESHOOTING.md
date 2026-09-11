# TeXFlow troubleshooting

## “Document has been closed”

TeXFlow `0.20.1` re-resolves active/master sources from their URI immediately before asynchronous Visual edits and history snapshots. This protects against VS Code closing a background `TextDocument` object while TeXFlow still retains project state.

If this message still appears:

1. stop editing the affected block;
2. reopen/refresh TeXFlow;
3. note whether the file was an included source, cloud-backed file, or recently closed Source tab;
4. record whether a Source tab opened unexpectedly;
5. report the smallest reproducible sequence.

Ordinary Visual autosave may use `openTextDocument()` internally to obtain a live document, but it must not use `showTextDocument()` or open Source as a side effect.

## “Document changed before the visual edit could be saved”

TeXFlow detected that Source no longer matches the range Visual intended to edit. This guard prevents overwriting unrelated or externally modified LaTeX.

1. Stop editing the affected visual block.
2. Refresh or reopen Visual.
3. Check whether Source was modified externally or by another extension/process.
4. Reproduce the smallest sequence of Visual actions if the conflict came entirely from TeXFlow.

Do not disable the guard as a workaround.

## An edit changed the wrong file in a multi-file project

TeXFlow distinguishes the master document from the active document. Ordinary Visual content edits should target the active `.tex` file; compilation and global project metadata use the master where appropriate.

If a reproducible edit writes to the master instead of the active include, stop and report the smallest project structure and action sequence. Do not manually merge files as a workaround.

## A project file path looks unexpectedly long

In `0.20.0`, Project Files are shown relative to the master-project folder. If a path still appears relative to an unrelated parent workspace, refresh/reopen TeXFlow and confirm which `.tex` file was detected as the master.

## A figure previews but pdfLaTeX rejects it

TeXFlow validates real PDF, PNG, and JPEG signatures. A file can have a `.jpg` filename while actually containing WebP/AVIF data. Such files must be converted outside TeXFlow to a real supported format before insertion.

## TikZ preview fails

TikZ preview requires a working local LaTeX toolchain and the packages used by the picture. TeXFlow first tries the supported local compilation path and expects a PDF result.

Check:

- that `latexmk` or `pdflatex` is available locally;
- that the document's TikZ packages/libraries are installed;
- that the `tikzpicture` source is complete;
- that the same TikZ code compiles in the document itself.

Temporary TikZ previews are session-owned. If a preview PDF is still open in VS Code when TeXFlow closes, TeXFlow preserves it until cleanup is safe.

## “LaTeX preserved” appears

The construct is outside TeXFlow's current safe semantic model. Edit it in Source. This is an intentional preservation state, not a compilation error.

## A reference or citation is marked missing

Open **View → Project Issues**. TeXFlow indexes loaded project files and can report missing references/citation keys, duplicate labels/BibTeX keys, and unused labels/entries.

For a missing reference, verify that the target `\label{...}` is in the current project include graph and that the key matches exactly. For a missing citation, verify the bibliography resource and citation key.

## Bibliography is missing

Check that the `.bib` resource exists, the preamble uses the intended BibTeX/BibLaTeX setup, and the local LaTeX toolchain includes the appropriate backend (`bibtex` or `biber`).

## Index or nomenclature does not appear

TeXFlow can insert supported package/setup commands, but the local build toolchain must also run the required index/nomenclature processors. A simple one-pass PDF build may only create auxiliary files.

## A package is missing

Install it through the user's LaTeX distribution (TeX Live/MiKTeX). TeXFlow may add `\usepackage` declarations, but it does not install system LaTeX packages.

## Removing an included file did not delete the `.tex` file

This is intentional. The remove control on an included-file card removes only the `\input{...}` or `\include{...}` relationship from the active document. TeXFlow does not delete the referenced file from disk.
