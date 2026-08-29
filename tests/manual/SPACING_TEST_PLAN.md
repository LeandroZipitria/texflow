# TeXFlow spacing manual test plan

1. Put the cursor between two ordinary paragraphs and choose Space -> Insert space.
2. Insert vertical `6pt`; verify a semantic spacer appears between blocks and Source contains `\vspace{6pt}`.
3. Select the spacer and delete it with Delete/Backspace; verify adjacent paragraphs remain intact.
4. Put the caret inside a paragraph, insert horizontal `1em`, continue typing immediately after it, and verify Source contains `\hspace{1em}` at the caret position.
5. Reopen Visual and verify the horizontal space is shown as an atomic inline object rather than raw LaTeX.
6. Repeat with starred vertical/horizontal spacing and compile.
7. Regression gate: paragraphs, headings, citations, references, equations, figures, tables, save, compile, return to Visual.
