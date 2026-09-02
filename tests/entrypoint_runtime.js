const fs = require('fs');
const path = require('path');

const root = process.cwd();
const pkgPath = path.join(root, 'package.json');
const srcPath = path.join(root, 'src', 'extension.ts');

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function check(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

if (!fs.existsSync(pkgPath)) {
  console.error(`Missing ${pkgPath}`);
  process.exit(1);
}
if (!fs.existsSync(srcPath)) {
  console.error(`Missing ${srcPath}`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const src = fs.readFileSync(srcPath, 'utf8');

const commands = new Set((pkg.contributes?.commands || []).map(x => x.command));
const activity = pkg.contributes?.viewsContainers?.activitybar || [];
const texflowViews = pkg.contributes?.views?.texflow || [];
const explorerMenu = pkg.contributes?.menus?.['explorer/context'] || [];
const viewTitleMenu = pkg.contributes?.menus?.['view/title'] || [];

check(commands.has('texflow.openVisualEditor'), 'Open with TeXFlow command is contributed');
check(commands.has('texflow.openDocument'), 'Open Document command is contributed');
check(commands.has('texflow.newProject'), 'New Document command is contributed');
check(commands.has('texflow.refreshProjectNavigator'), 'Refresh Project command is contributed');

check(activity.some(x => x.id === 'texflow'), 'TeXFlow Activity Bar container exists');
check(texflowViews.some(x => x.id === 'texflow.homeView' && x.type === 'webview'), 'TeXFlow Start webview exists');
check(texflowViews.some(x => x.id === 'texflow.projectView'), 'TeXFlow Project view exists');

check(
  explorerMenu.some(x => x.command === 'texflow.newProject' && String(x.when || '').includes('explorerResourceIsFolder')),
  'Explorer folder context offers New TeXFlow Document'
);
check(
  explorerMenu.some(x => x.command === 'texflow.openVisualEditor' && String(x.when || '').includes('resourceExtname == .tex')),
  'Explorer .tex context offers Open with TeXFlow'
);
check(
  viewTitleMenu.some(x => x.command === 'texflow.refreshProjectNavigator' && String(x.when || '').includes('texflow.projectView')),
  'Project view exposes Refresh'
);

check(src.includes("label: 'Single .tex file'"), 'New Document supports a single .tex file');
check(src.includes("label: 'LaTeX project'"), 'New Document supports a LaTeX project');
check(src.includes("showSaveDialog"), 'Single-file flow uses Save dialog');
check(src.includes("createDirectory(vscode.Uri.joinPath(folder, 'figures'))"), 'Project flow creates figures directory');
check(src.includes("const preambleUri = vscode.Uri.joinPath(folder, 'preamble.tex')"), 'Project flow creates preamble.tex');
check(src.includes("const mainUri = vscode.Uri.joinPath(folder, 'main.tex')"), 'Project flow creates main.tex');
check(src.includes("executeCommand('texflow.openVisualEditor', fileUri)"), 'Created single file opens in TeXFlow');
check(src.includes("executeCommand('texflow.openVisualEditor', mainUri)"), 'Created project main.tex opens in TeXFlow');

const expectedFigureExts = ['.pdf', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];
for (const ext of expectedFigureExts) {
  check(src.includes(`'${ext}'`), `Project Navigator supports ${ext}`);
}

check(src.includes("path.extname(name).toLowerCase()"), 'Project Navigator normalizes file extensions');
check(src.includes("createFileSystemWatcher('**/*')"), 'Project Navigator watcher is extension-case safe');
check(src.includes("projectNavigator.isRelevantResource(uri)"), 'Project Navigator filters watcher events by supported resource type');
check(src.includes("isCompiledDocumentPdf"), 'Compiled root PDF is filtered from figure resources');
check(src.includes("TEXFLOW_IGNORED_PROJECT_DIRS"), 'Project Navigator excludes irrelevant directories');
check(src.includes("registerWebviewViewProvider('texflow.homeView'"), 'Start screen provider is registered');
check(src.includes("createTreeView('texflow.projectView'"), 'Project Navigator tree is registered');

if (process.exitCode) {
  console.error('\nTeXFlow entry point / project navigator checks: FAIL');
  process.exit(process.exitCode);
}

console.log('\nTeXFlow entry point / project navigator checks: PASS');
