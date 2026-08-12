# Trailing continuous typing regression

Regression observed in TeXFlow 0.9.0: after text was first inserted through the trailing "Continue typing…" editor, a later autosave could fail with `TeXFlow could not update the trailing paragraph safely.`

The safe update rule is now: when `previous` is non-empty, it must be the final non-whitespace content immediately before `\\end{frame}`. The replacement range is computed from that suffix only. Earlier identical text (including text inside `itemize`) is never eligible.

This keeps the structural-safety fix while allowing repeated autosaves during continuous typing.
