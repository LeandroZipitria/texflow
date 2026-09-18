const fs = require('fs');
const path = require('path');

const extensionPath = path.join(__dirname, '..', 'src', 'extension.ts');
const source = fs.readFileSync(extensionPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL figure_external_overwrite_refresh_runtime: ${message}`);
    process.exit(1);
  }
}

assert(
  source.includes('const figureFileWatchers = new Map<string, vscode.FileSystemWatcher>();'),
  'per-panel figure file watchers are missing'
);
assert(
  source.includes('new vscode.RelativePattern(path.dirname(uri.fsPath), path.basename(uri.fsPath))'),
  'figure watcher is not bound to the resolved physical file path'
);
assert(
  source.includes('watcher.onDidChange(changed => scheduleFigurePreviewRefresh(changed));') &&
  source.includes('watcher.onDidCreate(changed => scheduleFigurePreviewRefresh(changed));') &&
  source.includes('watcher.onDidDelete(changed => scheduleFigurePreviewRefresh(changed));'),
  'figure watcher does not cover overwrite/create/delete events'
);
assert(
  source.includes('figurePreviewRevision++;') &&
  source.includes('query: `v=${stat.mtime}-${stat.size}-${revision}`'),
  'preview cache busting is missing'
);
assert(
  source.includes('onResolvedFigure?.(found);'),
  'resolved figure files are not exposed to the watcher synchronizer'
);
assert(
  source.includes('syncFigureFileWatchers([...resolvedFigureFiles.values()]);'),
  'resolved figure watchers are not synchronized during Visual refresh'
);
assert(
  source.includes('for (const watcher of figureFileWatchers.values()) watcher.dispose();'),
  'figure watchers are not disposed with the panel'
);

console.log('PASS figure_external_overwrite_refresh_runtime');
