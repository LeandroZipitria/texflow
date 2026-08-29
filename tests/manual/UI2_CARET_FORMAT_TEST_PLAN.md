# TeXFlow 0.12.0-ui.2 — caret / format regression test

1. Open a clean article in Visual.
2. Type a full paragraph continuously; click at its final character and continue typing without Enter.
3. Press Enter once in the middle of a paragraph: verify left and right text become two consecutive paragraphs, with no text moved around neighboring objects.
4. At the end of a paragraph press Enter, type immediately, and insert an equation from the top Insert menu. Verify the equation is inserted at the current position and no word is split.
5. Repeat with Figure, Table, Space and Columns.
6. Select words and apply Bold, Italic, Underline, color, then type between operations. Repeat at least 20 operations. No stale-document warning should appear.
7. Verify Insert contains Structure, Lists, Math, Citations/Bibliography, Labels/References and Objects. Verify the legacy + toolbox is absent.
8. Compile, return to Visual, continue typing, then inspect Source for intact paragraphs and stable blank-line boundaries.
