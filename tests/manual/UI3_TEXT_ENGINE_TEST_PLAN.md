# TeXFlow 0.12.0-ui.3 — text editing engine stabilization

Use a clean article and also the integration-test article.

## 1. Natural caret

1. Click at the beginning, middle, and final character of a paragraph.
2. Type immediately at each position.
3. Use Left/Right and native Up/Down navigation inside prose.
4. Confirm no object is inserted and no paragraph is split unless Enter is pressed.

Expected: the caret behaves like a normal text editor inside a paragraph.

## 2. Semantic Enter

1. Put the caret in the middle of a paragraph and press Enter once.
2. Confirm the paragraph is split exactly at the live caret.
3. Press Enter repeatedly in the new empty paragraph.
4. Use Shift+Enter once.

Expected: Enter creates one semantic paragraph; repeated Enter on an empty transient paragraph is a no-op; Shift+Enter creates an explicit line break.

## 3. Semantic spaces

1. Type several spaces rapidly between two words.
2. Try adding a space immediately before/after an existing space.
3. Insert explicit horizontal spacing through Insert > Space.

Expected: accidental repeated ordinary spaces are neutralized; explicit spacing remains available as a semantic object.

## 4. Composable inline formatting

Start with: `comprobar escritura normal`.

1. Underline `escritura `.
2. Bold `comprobar `.
3. Select both formatted runs and apply Italic.
4. Select `comprobar ` and add Underline too.
5. Apply Bold + Italic + Underline to the same word in different orders.
6. Toggle one complete format run off and confirm the other marks remain.
7. Repeat at least 20 formatting operations across several paragraphs, mixing Bold, Italic, Underline, color and typing.

Expected: formats compose; one mark never destroys another; no duplicate source corruption; no stale-document/save error.

## 5. Formatting transaction / save race

1. Apply Underline.
2. Immediately apply Bold to adjacent text.
3. Immediately apply Italic across both.
4. Type immediately after the formatted text.
5. Repeat quickly without waiting for the Saved indicator.

Expected: no `TeXFlow document changed before the visual edit could be saved` message, no lost characters, and source remains valid.

## 6. Objects around prose

Insert an equation, figure and columns block from Insert while the caret is:

- at the end of a paragraph;
- in the middle of a sentence;
- immediately after a formatted run.

Expected: TeXFlow never reuses an old cursor position and never leaves fragments such as `párr` / `afo.` around an inserted object.
