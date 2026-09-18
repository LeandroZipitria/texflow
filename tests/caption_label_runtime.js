const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const parserPath = path.join(root, 'out', 'latex', 'blocks.js');
assert(fs.existsSync(parserPath), 'compiled parser missing; run npm run compile first');
delete require.cache[require.resolve(parserPath)];
const { parseBlocks, tableData, figureData } = require(parserPath);

const figure = String.raw`\begin{figure}[htbp]
\centering
\includegraphics[width=.7\linewidth]{figures/trend.jpeg}
\caption{\label{fig:dispersion-trend} Price Dispersion over Time.}
\end{figure}`;
const fd = figureData(figure);
assert.strictEqual(fd.caption, 'Price Dispersion over Time.');
assert.strictEqual(fd.label, 'fig:dispersion-trend');
const fb = parseBlocks(figure)[0];
assert.strictEqual(fb.kind, 'figure');
assert.strictEqual(fb.figureCaption, 'Price Dispersion over Time.');
assert.strictEqual(fb.figureLabel, 'fig:dispersion-trend');

const table = String.raw`\begin{table}[ht!]
\caption{\label{tab:summary} Summary Statistics.}
\centering
\begin{tabular}{lr}
A & 1 \\
B & 2 \\
\end{tabular}
\end{table}`;
const td = tableData(table);
assert.strictEqual(td.caption, 'Summary Statistics.');
assert.strictEqual(td.label, 'tab:summary');

console.log('PASS caption_label_runtime');
