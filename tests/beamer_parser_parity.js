#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, 'src', 'extension.ts');
const parserPath = path.join(repoRoot, 'out', 'latex', 'blocks.js');

function fail(message, error) {
  console.error(`FAIL beamer_parser_parity: ${message}`);
  if (error) console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
function ok(condition, message) { if (!condition) fail(message); }

ok(fs.existsSync(sourcePath), `missing ${sourcePath}`);
ok(fs.existsSync(parserPath), 'compiled shared parser missing; run "npm run compile" first');

const extensionSource = fs.readFileSync(sourcePath, 'utf8');
const shared = require(parserPath);

ok(typeof shared.parseBlocks === 'function', 'shared parseBlocks export is missing');
ok(typeof shared.webviewParserRuntimeSource === 'function', 'webview parser runtime generator is missing');
ok(extensionSource.includes("from './latex/blocks'"), 'extension host does not import the shared parser');
ok(extensionSource.includes('${webviewParserRuntimeSource()}'), 'webview does not inject the shared parser runtime');
ok(!extensionSource.includes('function parseBlocks(body){'), 'hand-maintained webview parseBlocks still exists');
ok(!extensionSource.includes('function parseBlocks(body: string)'), 'hand-maintained host parseBlocks still exists');

let browserParse;
try {
  const context = vm.createContext({ console });
  vm.runInContext(
    shared.webviewParserRuntimeSource() + '\n;globalThis.__parseBlocks = parseBlocks;',
    context,
    { filename: 'shared-webview-parser.js' }
  );
  browserParse = context.__parseBlocks;
} catch (error) {
  fail('generated webview parser runtime did not evaluate', error);
}

function projection(block) {
  const out = {
    id: block.id,
    kind: block.kind,
    start: block.start,
    end: block.end,
    align: block.align || ''
  };
  if (block.env) out.env = block.env;
  if (block.hidden) out.hidden = true;
  if (block.kind === 'columns') {
    out.columnCount = block.columnCount;
    out.columnTexts = block.columnTexts;
  }
  if (block.kind === 'itemize') out.items = block.items;
  if (block.kind === 'comment') {
    out.commentText = block.commentText;
    out.commentNote = !!block.commentNote;
    if (block.commentTag) out.commentTag = block.commentTag;
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
  ['justifying', '\\justifying\nJustified one.\n\nJustified two.'],
  ['alignment change mid-frame', '\\raggedright\nLeft paragraph.\n\n\\justifying\nJustified paragraph.'],
  ['inline commands', 'Text with \\footnote{note}, \\href{https://example.com}{link}, and \\url{https://example.com}.'],
  ['citation and ref', 'See \\cite{smith2024} and Figure~\\ref{fig:test}.'],
  ['itemize', '\\begin{itemize}\n\\item One\n\\item Two\n\\end{itemize}'],
  ['enumerate', '\\begin{enumerate}\n\\item One\n\\item Two\n\\end{enumerate}'],
  ['multicols', '\\begin{multicols}{2}\nFirst column.\n\\columnbreak\nSecond column.\n\\end{multicols}'],
  ['beamer columns', '\\begin{columns}[T]\n\\column{0.48\\textwidth}\nLeft\n\\column{0.48\\textwidth}\nRight\n\\end{columns}'],
  ['equation', '\\begin{equation}\nx=1\n\\end{equation}'],
  ['comment + prose', '% TeXFlow note: check result\n\nNormal paragraph.'],
  ['TODO comment', '% TODO verify result\n\nNormal paragraph.'],
  ['comment environment', '\\begin{comment}\nOld paragraph.\n\\begin{equation}\nx=y\n\\end{equation}\n\\end{comment}\n\nVisible paragraph.'],
  ['simple table', '\\begin{table}\n\\begin{tabular}{lc}\nA & B \\\\\n1 & 2\n\\end{tabular}\n\\end{table}'],
  ['figure', '\\begin{figure}\n\\centering\n\\includegraphics[width=0.5\\textwidth]{figure.png}\n\\caption{Caption}\n\\label{fig:test}\n\\end{figure}'],
  ['tikz picture', '\\begin{tikzpicture}\n\\draw (0,0) -- (1,1);\n\\end{tikzpicture}']
];

let failures = 0;
for (const [name, body] of cases) {
  try {
    const host = shared.parseBlocks(body).map(projection);
    const web = browserParse(body).map(projection);
    if (JSON.stringify(host) !== JSON.stringify(web)) {
      failures++;
      console.error(`FAIL ${name}`);
      console.error('  host:', JSON.stringify(host, null, 2));
      console.error('  web :', JSON.stringify(web, null, 2));
    } else {
      console.log(`PASS ${name}`);
    }
  } catch (error) {
    failures++;
    console.error(`FAIL ${name} (parser threw)`);
    console.error(error && error.stack ? error.stack : error);
  }
}

if (failures) fail(`${failures} case(s) failed`);
console.log(`\nShared Beamer/document parser: PASS (${cases.length} cases)`);
