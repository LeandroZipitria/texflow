# TeXFlow development and architecture

## Product rule

TeXFlow is a visual editing layer over real LaTeX. The `.tex` and `.bib` files are always the source of truth.

The product priorities are, in order: simple, comfortable, clear, and clean. The document should remain the primary surface; new controls should earn their place rather than expanding chrome by default.

## Semantic model

TeXFlow separates semantic text, inline objects, and block objects. Structural boundaries must never become ordinary editable characters.

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
11. Numbering is semantic: starred/unstarred structures must round-trip without accumulating redundant suppression commands.
12. Active-document edits must never be redirected silently to the master document.

## Project model

Project-aware editing uses three explicit scopes:

- **master document**: the root document used for global metadata, packages, bibliography configuration, compilation, and the root PDF;
- **active document**: the `.tex` source currently being edited visually;
- **project**: the include graph plus project-wide indexes and diagnostics.

`ProjectModel.root` has been removed. New code must use `masterDocument` or `activeDocument` according to the intended scope.

Project-wide operations may inspect multiple documents, but source writes remain document-specific. Included `.tex` files are never flattened into a synthetic master source.

## Project index

The project index is intentionally conservative and regex-based. It is not a universal LaTeX AST and should not become one without a separate architecture decision.

Current project-wide intelligence includes:

- labels and references;
- bibliography entries and citation usage;
- duplicate/missing/unused diagnostics;
- source locations for navigation;
- include relationships.

Performance work should preserve identical index semantics. In `0.20.0`, contextual label classification was changed from repeated backward searches to a single document-order context pass, with behavioral equivalence tests.

Do not introduce caches unless profiling shows a real bottleneck and invalidation rules are explicit.

## Parser rule

The Extension Host and the webview must use **one parser source of truth** for semantic LaTeX blocks. Do not reintroduce a second hand-maintained `parseBlocks` implementation inside the webview.

Pure LaTeX parsing code should live outside `extension.ts` and avoid VS Code APIs whenever practical so it can be exercised directly by Node regression tests and injected into the webview runtime from the same compiled functions.

Do not replace the conservative parser with a universal AST as incidental cleanup. Parser expansion requires a concrete editing/serialization need, a source-preservation model, and regression coverage.

## Source mutation rule

All semantic writes must use the established serialized replacement/update paths and retain stale-source validation.

Before adding a new write path, determine explicitly whether the target is:

- `project.activeDocument`;
- `project.masterDocument`;
- another project document identified by URI.

Global metadata such as packages or bibliography configuration normally belongs to the master document. Visual content edits normally belong to the active document.

## Visual ↔ Source navigation

Location-aware view switching is part of the source-preservation architecture, not only UI polish.

Visual → Source should retain a meaningful source offset. Source → Visual should resolve the closest supported semantic location without rewriting source. Cross-file navigation may change `activeDocument` while retaining the same `masterDocument`.

PDF navigation remains a separate SyncTeX-level problem.

## TikZ preview lifecycle

TikZ previews use session-owned temporary directories.

Rules:

- each TeXFlow panel/session owns its preview temporaries;
- temporary files are recognizable as TeXFlow-owned before deletion;
- cleanup waits for in-flight compilation;
- a preview PDF that is still open in VS Code is not removed prematurely;
- startup cleanup may remove abandoned TeXFlow preview directories conservatively;
- unrelated temporary files must never be deleted;
- preview caching should not be added without correct invalidation for TikZ source and relevant preamble state.

TikZ remains source-driven. TeXFlow may provide editing, preview, Figure properties, and safe wrappers without becoming a graphical TikZ editor.

## Comments and review objects

Source comments, TODO, FIXME, Author note, and commented-out blocks remain source-backed constructs. Their visual markers/inspector must stay outside the page or slide flow so review UI cannot create false document/Beamer overflow.

Editing a tagged comment must preserve its tag semantically. A TODO or FIXME must not silently degrade into an ordinary comment when its visible body is changed.

## LyX as a technical reference

LyX is useful because it has already confronted many structural-editor problems: paragraph semantics, embedded objects/insets, cursor boundaries, LaTeX preservation, and composable character properties. TeXFlow may study those programming/interaction ideas, but it does not use LyX as an interface model. TeXFlow's direct internal editors for figures, tables, and math are deliberate product choices.

## Safety boundary

When a construct cannot be round-tripped safely, preserve it as Raw/LaTeX preserved. Do not broaden parsing until there is an explicit serialization model and a regression fixture.

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

For multi-file behavior, also verify that edits target the intended active source and do not mutate the master unintentionally.

## Automated gates

`npm run check:fast` is the fast development gate. It compiles the extension and runs the Node runtime regression suite.

`npm run check` additionally runs the LaTeX fixtures.

`npm run check:release` runs the full regression gate and packages the VSIX. It is the preferred pre-release command.

A new feature is not considered integrated merely because TypeScript compiles.

High-value behavioral coverage in `0.20.0` includes:

- `align*` → `align` → `align*` numbering behavior;
- `section` → `section*` → `section` serialization;
- bare `tikzpicture` → Figure wrapping;
- TODO/FIXME serialization and editing;
- `masterDocument != activeDocument` during Visual editing;
- TikZ temporary lifecycle;
- project-wide references, bibliography, diagnostics, and navigation.

## Performance rule

Measure before optimizing.

Profile parser, project index, spellcheck, TikZ preview, activation, and memory separately. Prefer local algorithmic improvements with regression equivalence over speculative caches or broad rewrites.

The `0.20.0` Build D profiling found a real project-index hotspot and optimized that path. Parser, spellcheck, TikZ caching, activation, and bundling were deliberately left unchanged where evidence did not justify additional complexity.

## Packaging

The `0.20.0` pre-release packaging baseline is approximately:

- 2.4 MB VSIX;
- 1174 packaged files before final documentation/version deltas;
- only `@cspell/dict-en_us` and `@cspell/dict-es-es` packaged;
- `cspell-lib` remains unbundled.

The generic `vsce` bundling warning is not by itself a reason to introduce webpack/esbuild. Bundle only if measured activation/install/runtime benefits justify the added build complexity.

## Versioning and release baselines

Never overwrite a build that has been given to the tester. Each experiment/fix gets a new version identifier or isolated commit. Stable baselines are promoted only after automated and manual validation.

`0.19.0` is the public baseline immediately before the project-aware/structured-editing expansion.

`0.20.0` is the target release after Foundation plus Builds A–D. It should remain reproducible once released and should not be reopened unless a reproducible bug requires it.

A future `1.0.0` should be an explicit product/release decision, not an automatic consequence of feature count.
