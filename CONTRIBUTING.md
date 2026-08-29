# Contributing to TeXFlow

Thanks for helping improve TeXFlow.

## Requirements

- Node.js and npm
- VS Code
- A LaTeX toolchain with `latexmk`

## Local setup

```bash
npm ci
npm run compile
bash tests/run_fixtures.sh
```

## Tests

- Add a reproducible fixture for every bug that can be modeled with a `.tex` file.
- Keep private or manual documents out of `tests/`.
- Prefer small regression fixtures with clear expected behavior.

## Packaging

```bash
npm run package
```

## Notes

- Do not commit temporary build outputs.
- Keep changes focused and reproducible.

