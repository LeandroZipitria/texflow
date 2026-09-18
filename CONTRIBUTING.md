# Contributing to TeXFlow

Thanks for helping improve TeXFlow.

## Requirements

- Node.js and npm
- VS Code
- A LaTeX toolchain with `latexmk`

## Local setup

```bash
npm ci
npm run check:fast
```

Run the full regression gate, including LaTeX fixtures, with:

```bash
npm run check
```

## Tests

- Add a reproducible fixture or behavioral regression test for every bug that can be modeled reliably.
- Keep private or manual documents out of `tests/`.
- Prefer small regression fixtures with clear expected behavior.
- Preserve the distinction between `masterDocument` and `activeDocument` in multi-file tests.
- Do not weaken stale-source guards to make a test pass.
- For Visual semantic features, test the lifecycle explicitly: detect/view, create, edit, remove-from-document, and Source navigation. Missing lifecycle operations should be deliberate, not accidental.
- Treat ordinary Visual typing/save and live-`TextDocument` resolution as protected contracts; do not add per-keystroke host work, extra save timers, unsolicited Source navigation, or long-lived assumptions that a retained `TextDocument` is still open.

## Packaging

Start each new release from the current stable baseline in a dedicated version branch. Bump `package.json` and `package-lock.json` to the target release version before producing the first development VSIX.

Do not overwrite a VSIX that has already been used for testing. During development, keep successive packages as distinct artifacts. Reserve the canonical `texflow-X.Y.Z.vsix` filename for the final release candidate after the complete release gate passes.

Use the release gate when preparing a package:

```bash
npm run check:release
```

For packaging only:

```bash
npm run package
```

## Notes

- Keep changes focused and reproducible.
- Do not commit temporary build outputs or TikZ preview files.
- Preserve unsupported LaTeX rather than broadening parsing without a safe serialization model.
- Measure performance before adding caches, bundlers, or broad architectural changes.
