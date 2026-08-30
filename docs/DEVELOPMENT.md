# TeXFlow development and architecture

## Product rule

TeXFlow is a visual editing layer over real LaTeX. The `.tex` file is always the source of truth.

## Semantic model

TeXFlow separates semantic text, inline objects and block objects. Structural boundaries must never become ordinary editable characters.

Core invariants:

1. A paragraph boundary serializes as one blank LaTeX line.
2. Repeated transient empty paragraphs do not generate repeated source writes.
3. Headings serialize as complete structural commands.
4. `\end{document}` never enters an editable paragraph range.
5. Inline semantic objects round-trip to their LaTeX commands rather than flattening to labels/text.
6. Unsupported LaTeX is preserved conservatively.
7. A no-op visual action does not write Source.
8. The stale-document guard protects genuine external changes; TeXFlow-originated edits must update through serialized edit flows rather than weakening that guard.
9. Character formatting is composable: bold/italic/underline/color are independent marks, not mutually exclusive modes.
10. Native caret behavior is preferred inside prose; special keyboard logic belongs only at semantic boundaries or inside structured widgets such as tables.

## LyX as a technical reference

LyX is useful because it has already confronted many structural-editor problems: paragraph semantics, embedded objects/insets, cursor boundaries, LaTeX preservation and composable character properties. TeXFlow may study those programming/interaction ideas, but it does not use LyX as an interface model. TeXFlow's direct internal editors for figures, tables and math are deliberate product choices.

## Safety boundary

When a construct cannot be round-tripped safely, preserve it as Raw/LaTeX preserved. Do not broaden regex parsing until there is an explicit serialization model and a regression fixture.

## New semantic object gate

Every new semantic object should be tested for:

- open existing source;
- render Visual;
- edit before and after the object;
- insert/delete/reinsert;
- compile;
- return to Visual;
- inspect Source for stable LaTeX;
- verify unknown neighboring LaTeX remains unchanged.

## Versioning

Never overwrite a build that has been given to the tester. Each experiment/fix gets a new version identifier. Stable baselines are promoted only after manual validation.

`0.14.3` is the current stable release baseline. New functionality should be developed in a new version and promoted only after regression and manual validation.
