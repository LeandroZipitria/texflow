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

const none = String.raw`\begin{table}
\begin{tabular}{lr}
A & 1 \\
B & 2 \\
\end{tabular}
\end{table}`;
const noneParsed = tableData(none);
assert.strictEqual(noneParsed.simple, true);
assert.strictEqual(noneParsed.tableStyle, 'plain');
assert.deepStrictEqual(noneParsed.verticalBorders, [false, false, false]);
assert.deepStrictEqual(noneParsed.horizontalBorders, [false, false, false]);

const formal = String.raw`\begin{table}
\begin{tabular}{lr}
\toprule
A & 1 \\
\midrule
B & 2 \\
\bottomrule
\end{tabular}
\end{table}`;
const formalParsed = tableData(formal);
assert.strictEqual(formalParsed.simple, true);
assert.strictEqual(formalParsed.tableStyle, 'booktabs');
assert.deepStrictEqual(formalParsed.verticalBorders, [false, false, false]);
assert.deepStrictEqual(formalParsed.horizontalBorders, [false, false, false]);

const grid = String.raw`\begin{table}
\begin{tabular}{|l|r|}
\hline
A & 1 \\
\hline
B & 2 \\
\hline
\end{tabular}
\end{table}`;
const gridParsed = tableData(grid);
assert.strictEqual(gridParsed.simple, true);
assert.strictEqual(gridParsed.tableStyle, 'grid');
assert.deepStrictEqual(gridParsed.verticalBorders, [true, true, true]);
assert.deepStrictEqual(gridParsed.horizontalBorders, [true, true, true]);
assert(pastedTableData(grid), 'grid table must be accepted by LaTeX paste');

const custom = String.raw`\begin{table}
\begin{tabular}{|l|r}
\hline
A & 1 \\
B & 2 \\
\hline
\end{tabular}
\end{table}`;
const customParsed = tableData(custom);
assert.strictEqual(customParsed.simple, true);
assert.strictEqual(customParsed.tableStyle, 'custom');
assert.deepStrictEqual(customParsed.verticalBorders, [true, true, false]);
assert.deepStrictEqual(customParsed.horizontalBorders, [true, false, true]);
const customBlock = parseBlocks(custom)[0];
assert.strictEqual(customBlock.kind, 'table');
assert.deepStrictEqual(customBlock.tableVerticalBorders, [true, true, false]);
assert.deepStrictEqual(customBlock.tableHorizontalBorders, [true, false, true]);

assert.strictEqual(tableData(String.raw`\begin{table}
\begin{tabular}{||lr}
A & 1 \\
\end{tabular}
\end{table}`).simple, false, 'double vertical rules are intentionally outside the first border editor scope');
assert.strictEqual(tableData(String.raw`\begin{table}
\begin{tabular}{|lr|}
\toprule
A & 1 \\
\bottomrule
\end{tabular}
\end{table}`).simple, false, 'mixed booktabs and vertical rules must remain conservative');
assert.strictEqual(tableData(String.raw`\begin{table}
\begin{tabular}{lr}
A & 1 \\
\cline{1-2}
B & 2 \\
\end{tabular}
\end{table}`).simple, false, 'partial rules remain outside the first border editor scope');

assert(extension.includes("type TableVisualStyle = 'plain' | 'booktabs' | 'grid' | 'custom';"), 'host table style model missing');
assert(extension.includes('tableVerticalBorders?: boolean[];') || fs.readFileSync(path.join(root, 'src', 'latex', 'types.ts'), 'utf8').includes('tableVerticalBorders?: boolean[];'), 'table border fields missing');
assert(extension.includes('>None</option>') && extension.includes('>Formal</option>') && extension.includes('>Grid</option>') && extension.includes('>Custom</option>'), 'table border style choices missing');
assert(extension.includes('data-border-edge="top"') && extension.includes('data-border-edge="right"'), 'custom border edge controls missing');
assert(extension.includes("--table-guide:color-mix(in srgb,var(--vscode-editor-foreground) 16%,transparent)"), 'theme-aware edit guide token missing');
assert(extension.includes("--table-rule:color-mix(in srgb,var(--vscode-editor-foreground) 66%,transparent)"), 'theme-aware printed rule token missing');
assert(extension.includes('--table-rule-focus:var(--vscode-focusBorder,var(--vscode-textLink-foreground))'), 'theme-aware focus token missing');
assert(!/--table-(?:guide|rule|rule-heavy)\s*:\s*(?:#|rgb\(|rgba\(|black\b|white\b)/i.test(extension), 'table rule colors must not be hard-coded');
assert(extension.includes("lines.push('\\\\hline')"), 'grid/custom serializer must emit hline');
assert(extension.includes("if (borders[i]) spec += '|';") || extension.includes("if(borders[i])spec+='|';"), 'grid/custom serializer must emit vertical rules');
assert(extension.includes('<label>Borders <select class="table-style-input">'), 'Visual table border selector missing');
assert(extension.includes("if(tableStyle==='custom')return;save(true)"), 'entering Custom must not immediately normalize back to None/Grid before an edge is changed');
assert(extension.includes('<option value="grid">Grid</option>'), 'Insert Table grid style missing');

console.log('PASS table_borders_runtime');
