#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const extension = fs.readFileSync(path.join(root, 'src', 'extension.ts'), 'utf8');
const parserPath = path.join(root, 'out', 'latex', 'blocks.js');
assert(fs.existsSync(parserPath), 'compiled parser missing; run npm run compile first');
const { tableData, pastedTableData, parseBlocks } = require(parserPath);

const sample = String.raw`\begin{table}
\centering
\small
\begin{tabular}{lr}
\toprule
\textbf{Indicador} & \textbf{Valor} \\
\midrule
Período & 1984--2025 \\
Período de ingreso comparable & 1984--2024 \\
Observaciones-persona & 1.556.146 \\
Hogares & 555.813 \\
Barrios & 62 \\
Cobertura año $\times$ barrio & 99,92\% \\
Observaciones con ingreso comparable & 1.535.082 \\
\bottomrule
\end{tabular}
\end{table}`;

const parsed = tableData(sample);
assert.strictEqual(parsed.simple, true, 'example table must be editable as a simple semantic table');
assert.deepStrictEqual(parsed.columns, ['l', 'r']);
assert.strictEqual(parsed.rows.length, 8);
assert.strictEqual(parsed.rows[0][0], String.raw`\textbf{Indicador}`);
assert.strictEqual(parsed.rows[6][0], String.raw`Cobertura año $\times$ barrio`);
assert.strictEqual(parsed.rows[6][1], String.raw`99,92\%`);
assert.strictEqual(parsed.tableStyle, 'booktabs');
assert.strictEqual(parsed.tableSize, 'small');

const pasted = pastedTableData(sample);
assert(pasted, 'full table environment must be recognized on paste');
assert.strictEqual(pasted.wrapped, false);
assert.strictEqual(pasted.latex, sample);
assert.strictEqual(pasted.tableStyle, 'booktabs');
assert.strictEqual(pasted.tableSize, 'small');

const bare = String.raw`\begin{tabular}{lr}
A & 1 \\
B & 2 \\
\end{tabular}`;
const bareParsed = pastedTableData(bare);
assert(bareParsed, 'bare tabular must be recognized on paste');
assert.strictEqual(bareParsed.wrapped, true);
assert.match(bareParsed.latex, /^\\begin\{table\}\n\\centering\n/);
assert.match(bareParsed.latex, /\\end\{table\}$/);


const captioned = String.raw`\begin{table}[htbp]
\centering
\caption{Summary results}
\label{tab:summary}
\begin{tabular}{lc}
Name & Value \\
A & 1 \\
\end{tabular}
\end{table}`;
const captionedParsed = pastedTableData(captioned);
assert(captionedParsed, 'captioned table must be recognized');
assert.strictEqual(captionedParsed.caption, 'Summary results');
assert.strictEqual(captionedParsed.label, 'tab:summary');
assert.strictEqual(captionedParsed.placement, 'htbp');
assert.strictEqual(captionedParsed.captionPosition, 'above');

assert.strictEqual(pastedTableData(String.raw`\begin{table}[H]
\begin{tabular}{cc}
A & B \\
\end{tabular}
\end{table}`), null, 'unsupported float placement must fall back to ordinary paste');
assert.strictEqual(pastedTableData(String.raw`\begin{table}
\caption[Short]{Long caption}
\begin{tabular}{cc}
A & B \\
\end{tabular}
\end{table}`), null, 'short-caption metadata is not safely editable and must fall back');
assert.strictEqual(pastedTableData('ordinary text'), null, 'ordinary paste must not be intercepted');
assert.strictEqual(pastedTableData(String.raw`\begin{tabular}{cc}
\multicolumn{2}{c}{Title} \\
\end{tabular}`), null, 'complex unsupported tables must fall back to ordinary paste');

const blocks = parseBlocks(sample);
assert.strictEqual(blocks.length, 1);
assert.strictEqual(blocks[0].kind, 'table');
assert.strictEqual(blocks[0].tableSize, 'small');
assert.strictEqual(blocks[0].tableStyle, 'booktabs');

assert(extension.includes("if (msg.type === 'insertLatexTable')"), 'host paste handler missing');
assert(extension.includes("if (parsedTable.tableStyle === 'booktabs') await ensurePackage(project, 'booktabs');"), 'pasted booktabs tables must ensure the package');
assert(extension.includes('function tryPasteLatexTable(e)'), 'Visual paste detector missing');
assert(extension.includes("const parsed=pastedTableData(raw);if(!parsed)return false;"), 'Visual paste must use the shared table parser');
assert(extension.includes("if(editable.matches('.title,.head,.beamer-metadata-edit,.doc-metadata-edit'))return null;"), 'metadata/title fields must not accept structural table paste');
assert(extension.includes("if (tableSize) lines.push(`\\\\${tableSize}`);"), 'host table serializer must preserve table-local size');
assert(extension.includes("if(tableSize)lines.push('\\\\'+tableSize)"), 'document Visual table serializer must preserve table-local size');
assert(extension.includes('Paste LaTeX / CSV / TSV…'), 'Insert Table must expose discoverable LaTeX/CSV/TSV paste');
assert(extension.includes("openLabsDialog('Table from LaTeX / CSV / TSV'"), 'table paste dialog must accept LaTeX explicitly');
assert(extension.includes("const parsedLatex=pastedTableData(raw);if(parsedLatex)"), 'table dialog must use the shared LaTeX table parser');
assert(extension.includes('.slide .semantic-table{width:auto;max-width:100%;min-width:0'), 'Beamer Visual tables must use compact slide sizing');

console.log('PASS table_paste_runtime');
