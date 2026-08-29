# Bibliography and citation semantic QA

Baseline: `0.11.2-semantic.3` paragraph/heading semantics.
Target: `0.11.2-semantic.5` bibliography reintegration.

## Invariants

1. Existing paragraph/Enter/heading behavior must not change.
2. A citation is inline content inside the current semantic paragraph.
3. Bibliography is a document-level structural object, not paragraph text.
4. Selecting or opening a `.bib` file may leave TeXFlow only for the native VS Code file picker; simple bibliography actions stay in TeXFlow.
5. BibTeX/natbib and BibLaTeX are detected and preserved; TeXFlow does not convert one system into the other.
6. Visual bibliography preview shows cited entries only, except `\\nocite{*}`.
7. `.bib` contents are read-only from TeXFlow; editing entries remains a VS Code source task.

## Manual sequence

### A. Existing BibLaTeX article
1. Open `article_bibliography.tex`.
2. Add a normal paragraph with Enter; confirm Saved and Source.
3. Place the cursor in that paragraph and use Cite → Insert citation.
4. Search by author/title/key and insert Parenthetical.
5. Continue typing after the citation; Enter; insert a Textual citation in the next paragraph.
6. Confirm Source contains `\\parencite{...}` / `\\textcite{...}` and paragraph separators remain blank lines.
7. Confirm bibliography preview lists only cited keys.
8. Compile.

### B. No bibliography connected
1. Open a clean article without bibliography commands.
2. Place the cursor in a paragraph → Cite → Insert citation → Add bibliography.
3. Choose BibLaTeX or BibTeX/natbib and select/create a `.bib`.
4. Confirm TeXFlow returns to the citation picker without losing the paragraph cursor.
5. Insert a citation.

### C. Bibliography placement
For BibLaTeX use Cite → Insert bibliography… and test:
- At end of document.
- At current position (after current semantic block).
- Before appendices when `\\appendix` is present.

For BibTeX/natbib the placement is selected when the bibliography file/style is connected, because `\\bibliography{...}` is also the print command.

### D. Citation formats
BibLaTeX: Parenthetical (`\\parencite`), Textual (`\\textcite`), Standard (`\\cite`), Automatic (`\\autocite`).
Natbib: Parenthetical (`\\citep`), Textual (`\\citet`), Standard (`\\cite`).
Plain BibTeX: Standard (`\\cite`).

The selector must show a human-readable preview before the LaTeX command.

### E. Regression
Repeat: type → Enter → type → citation → Enter → type → New Section → Enter → type → citation → Compile → return to Visual → continue typing.
There must be no `document changed` error and no lost text.

## Citation cursor regression (semantic.6)

1. Place the caret in a paragraph and insert a citation.
2. Without typing, immediately insert a second citation.
3. Type text after the citation, move the caret elsewhere in the same paragraph, and insert a third citation.
4. Reinsert the same citation key that already appears in the paragraph.
5. Put the caret directly beside/on the visual citation chip and insert another citation.
6. Confirm every insertion updates Source, survives Compile, and leaves a live caret in Visual.
7. Press Space repeatedly at a normal word boundary; only one semantic space should remain and no extra save churn should occur.
