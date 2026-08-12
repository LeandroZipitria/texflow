# Regression Case: `list`

## What Failed Before

- A trailing paragraph update could match text inside a list block.
- The resulting replacement could leave `itemize` inconsistent and fail at `\end{frame}`.

## Expected After Fix

- Trailing text updates only operate inside the trailing editable tail after the last parsed block.
- Ambiguous or out-of-tail matches are rejected with a controlled error.
- `\begin{itemize}` and `\end{itemize}` remain intact.

## Reproduction Artifact

- Source case: `./texflow_085/tests/output/forensics/list.tex`
- Log: `./texflow_085/tests/output/forensics/list.compile.log`
- Error before fix: `Something's wrong--perhaps a missing \item.`
