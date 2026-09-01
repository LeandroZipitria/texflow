const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, 'src', 'extension.ts');
const compiledPath = path.join(repoRoot, 'out', 'extension.js');

if (!fs.existsSync(sourcePath)) {
  console.error(`TeXFlow parser parity: missing ${sourcePath}`);
  process.exit(1);
}
if (!fs.existsSync(compiledPath)) {
  console.error('TeXFlow parser parity: out/extension.js not found.');
  console.error('Run "npm run compile" first.');
  process.exit(1);
}

const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = fs.readFileSync(compiledPath, 'utf8');

function sliceBetween(src, startSignature, nextSignature) {
  const start = src.indexOf(startSignature);
  if (start < 0) throw new Error(`Could not find ${startSignature}`);
  const end = src.indexOf(nextSignature, start + startSignature.length);
  if (end < 0) throw new Error(`Could not find ${nextSignature} after ${startSignature}`);
  return src.slice(start, end).trim();
}

function buildHostParser() {
  // Extract complete top-level functions from the already compiled JS.
  // We deliberately use known successor function names instead of trying
  // to lex regular expressions/braces ourselves.
  const parts = [
    sliceBetween(compiled, 'function parseFigureData(', 'function parseTableData('),
    sliceBetween(compiled, 'function parseTableData(', 'function parseBlocks('),
    sliceBetween(compiled, 'function parseBlocks(', 'function isSafeParagraph('),
    sliceBetween(compiled, 'function isSafeParagraph(', 'function findEnvironmentEnd('),
    sliceBetween(compiled, 'function findEnvironmentEnd(', 'function parseItems('),
    sliceBetween(compiled, 'function parseItems(', 'function normalizeEditableText(')
  ];

  const context = vm.createContext({ console });
  vm.runInContext(
    parts.join('\n\n') + '\n;globalThis.__parseBlocks = parseBlocks;',
    context,
    { filename: 'host-parser.js' }
  );
  return context.__parseBlocks;
}

function buildWebviewParser() {
  // These are JavaScript functions embedded in the webview template.
  const parts = [
    sliceBetween(source, 'function splitTopItems(', 'function createVisualList('),
    sliceBetween(source, 'function alignmentFromDirective(', 'function isOnlyAlignmentDirective('),
    sliceBetween(source, 'function isOnlyAlignmentDirective(', 'function alignClass('),
    sliceBetween(source, 'function figureData(', 'function tableData('),
    sliceBetween(source, 'function tableData(', 'function parseBlocks(body){'),
    sliceBetween(source, 'function parseBlocks(body){', 'function applyPresentationStyle(')
  ];

  const context = vm.createContext({ console });
  vm.runInContext(
    parts.join('\n\n') + '\n;globalThis.__parseBlocks = parseBlocks;',
    context,
    { filename: 'webview-parser.js' }
  );
  return context.__parseBlocks;
}

function projection(block) {
  const out = {
    id: block.id,
    kind: block.kind,
    start: block.start,
    end: block.end
  };

  if (block.kind === 'paragraph') out.align = block.align || 'justify';
  if (block.env) out.env = block.env;

  if (block.kind === 'columns') {
    out.columnCount = block.columnCount;
    out.columnTexts = block.columnTexts;
  }

  if (block.kind === 'itemize' || block.kind === 'enumerate') {
    out.items = block.items;
  }

  return out;
}

const cases = [
  ['plain paragraphs', 'First paragraph.\n\nSecond paragraph.'],
  ['small', '\\small\nFirst paragraph.\n\nSecond paragraph.'],
  ['footnotesize', '\\footnotesize\nFirst paragraph.\n\nSecond paragraph.'],
  ['centering', '\\centering\nCentered one.\n\nCentered two.'],
  ['raggedright', '\\raggedright\nLeft one.\n\nLeft two.'],
  ['raggedleft', '\\raggedleft\nRight one.\n\nRight two.'],
  ['justifying', '\\justifying\nJustified one with enough text.\n\nJustified two.'],
  ['alignment change mid-frame', '\\raggedright\nLeft paragraph.\n\n\\justifying\nJustified paragraph.'],
  ['inline commands', 'Text with \\footnote{note}, \\href{https://example.com}{link}, and \\url{https://example.com}.'],
  ['citation and ref', 'See \\cite{smith2024} and Figure~\\ref{fig:test}.'],
  ['itemize', '\\begin{itemize}\n\\item One\n\\item Two\n\\end{itemize}'],
  ['enumerate', '\\begin{enumerate}\n\\item One\n\\item Two\n\\end{enumerate}'],
  ['multicols', '\\begin{multicols}{2}\nFirst column.\n\\columnbreak\nSecond column.\n\\end{multicols}'],
  ['beamer columns', '\\begin{columns}[T]\n\\column{0.48\\textwidth}\nLeft\n\\column{0.48\\textwidth}\nRight\n\\end{columns}'],
  ['equation', '\\begin{equation}\nx=1\n\\end{equation}'],
  ['comment + prose', '% comment\n\nNormal paragraph.']
];

let hostParse;
let webParse;

try {
  hostParse = buildHostParser();
  webParse = buildWebviewParser();
} catch (err) {
  console.error('TeXFlow parser parity setup failed:');
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
}

let failures = 0;

for (const [name, body] of cases) {
  let host;
  let web;

  try {
    host = hostParse(body).map(projection);
    web = webParse(body).map(projection);
  } catch (err) {
    failures++;
    console.error(`FAIL ${name} (parser threw)`);
    console.error(err && err.stack ? err.stack : err);
    continue;
  }

  if (JSON.stringify(host) !== JSON.stringify(web)) {
    failures++;
    console.error(`FAIL ${name}`);
    console.error('  host:', JSON.stringify(host, null, 2));
    console.error('  web :', JSON.stringify(web, null, 2));
  } else {
    console.log(`PASS ${name}`);
  }
}

if (failures) {
  console.error(`\nBeamer parser parity: ${failures} case(s) failed.`);
  process.exit(1);
}

console.log(`\nBeamer parser parity: PASS (${cases.length} cases)`);
