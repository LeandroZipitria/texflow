const fs = require('fs');
const path = require('path');

const extensionPath = path.join(__dirname, '..', 'src', 'extension.ts');
const source = fs.readFileSync(extensionPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL figure_external_overwrite_poll_runtime: ${message}`);
    process.exit(1);
  }
}

assert(
  source.includes("import { watchFile, unwatchFile, type Stats } from 'fs';"),
  'Node stat polling support is not imported'
);
assert(
  source.includes('const figureFilePollers = new Map<string, { uri: vscode.Uri; listener: (current: Stats, previous: Stats) => void }>();'),
  'per-panel figure pollers are missing'
);
assert(
  source.includes("watchFile(uri.fsPath, { interval: 500, persistent: false }, listener);"),
  'physical figure files are not polled independently of VS Code workspace events'
);
assert(
  source.includes('current.mtimeMs !== previous.mtimeMs') &&
  source.includes('current.ctimeMs !== previous.ctimeMs') &&
  source.includes('current.size !== previous.size') &&
  source.includes('current.ino !== previous.ino'),
  'same-path overwrite detection does not compare enough stat identity fields'
);
assert(
  source.includes('if (changed) scheduleFigurePreviewRefresh(uri);'),
  'polling changes are not routed through the preview refresh path'
);
assert(
  source.includes('unwatchFile(poller.uri.fsPath, poller.listener);'),
  'figure pollers are not cleaned up'
);
assert(
  source.includes('figurePreviewRevision++;') &&
  source.includes('query: `v=${stat.mtime}-${stat.size}-${revision}`'),
  'cache-busting revision remains required after detecting an external overwrite'
);

console.log('PASS figure_external_overwrite_poll_runtime');
