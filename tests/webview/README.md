# Webview Battery Pending

This battery is intentionally not implemented in this environment.

Blocked prerequisites:
- A working `node` runtime for a VS Code Extension Host test harness.
- A reproducible way to drive the TeXFlow webview and inspect live editor state.

Deferred cases:
- Visual editing with cursor movement
- Undo/Redo in the webview
- Source <-> Visual synchronization
- External edits while the panel is open
- Autosave timing and compile-after-edit behavior
- Close-tab and compile flows

Expected future runner:
- Extension-host integration tests under `tests/webview/`
- The runner should operate only on copies of fixtures
- The runner should record `PASS`, `FAIL`, and `NOT RUN` separately

Nothing in this directory modifies production code.
