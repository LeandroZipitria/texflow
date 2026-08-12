# Document Mode continuous typing regression

Regression for TeXFlow 0.10.2.

## Symptom

The first autosave from a Visual paragraph succeeds, but subsequent typing fails with:

`TeXFlow document changed before the visual edit could be saved. Refresh and try again.`

## Cause

The webview node retained its original `raw`, `start`, and `end` after a successful non-refresh autosave. The next autosave therefore compared the current `.tex` against stale expected text created by TeXFlow itself.

## Fix

`updateDocumentNode` now updates the edited node optimistically and shifts following node ranges by the replacement length delta. A genuine stale-range error triggers a full document refresh.
