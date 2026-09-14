#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const extension = fs.readFileSync(path.join(root, 'src', 'extension.ts'), 'utf8');
const parserPath = path.join(root, 'out', 'latex', 'blocks.js');
assert(fs.existsSync(parserPath), 'compiled parser missing; run npm run compile first');
const { parseBlocks, figureData } = require(parserPath);

const sample = String.raw`\begin{figure}[htbp]
\centering
\caption{Evolución ingreso total del hogar}
\begin{subfigure}[t]{0.48\textwidth}
\includegraphics[width=0.6\linewidth]{figures/household_total_income_percentiles_1984_2024_es-2.png}
\end{subfigure}\hfill
\begin{subfigure}[t]{0.48\textwidth}
\includegraphics[width=\linewidth]{figures/household_pc_income_percentiles_1984_2024_es-2.png}
\end{subfigure}
\label{fig:evolucion_ingreso}
\end{figure}`;

const parsed = figureData(sample);
assert.strictEqual(parsed.items.length, 2, 'both subfigures must be parsed');
assert.strictEqual(parsed.layout, 'side-by-side');
assert.strictEqual(parsed.items[0].path, 'figures/household_total_income_percentiles_1984_2024_es-2.png');
assert.strictEqual(parsed.items[0].containerWidth, 0.48);
assert.strictEqual(parsed.items[0].containerWidthUnit, String.raw`\textwidth`);
assert.strictEqual(parsed.items[0].width, 0.6);
assert.strictEqual(parsed.items[0].widthUnit, String.raw`\linewidth`);
assert.strictEqual(parsed.items[1].width, 1);
assert.strictEqual(parsed.caption, 'Evolución ingreso total del hogar');
assert.strictEqual(parsed.label, 'fig:evolucion_ingreso');

const blocks = parseBlocks(sample);
assert.strictEqual(blocks.length, 1);
assert.strictEqual(blocks[0].kind, 'figure');
assert.strictEqual(blocks[0].figureItems.length, 2);
assert.strictEqual(blocks[0].figureLayout, 'side-by-side');

const withSubcaptions = String.raw`\begin{figure}
\centering
\begin{subfigure}{0.48\textwidth}
\includegraphics[width=\linewidth]{figures/a.png}
\caption{Left panel}
\label{fig:left}
\end{subfigure}\hfill
\begin{subfigure}{0.48\textwidth}
\includegraphics[width=\linewidth]{figures/b.png}
\caption{Right panel}
\label{fig:right}
\end{subfigure}
\caption{Main caption}
\label{fig:main}
\end{figure}`;
const withSubParsed = figureData(withSubcaptions);
assert.strictEqual(withSubParsed.caption, 'Main caption', 'subfigure captions must not replace the main figure caption');
assert.strictEqual(withSubParsed.label, 'fig:main', 'subfigure labels must not replace the main figure label');
assert.strictEqual(withSubParsed.items[0].caption, 'Left panel', 'first subfigure caption must be parsed');
assert.strictEqual(withSubParsed.items[1].caption, 'Right panel', 'second subfigure caption must be parsed');

const stacked = sample.replace('\\end{subfigure}\\hfill\n\\begin{subfigure}', '\\end{subfigure}\\par\\medskip\n\\begin{subfigure}');
assert.strictEqual(figureData(stacked).layout, 'stacked', 'stacked separator must be detected');

assert(extension.includes("Layout <select class=\"figure-layout-input\""), 'multi-figure layout control missing');
assert(extension.includes("class=\"multi-figure-replace\""), 'per-image replace control missing');
assert(extension.includes("class=\"figure-resize multi-figure-resize\""), 'per-image drag resize handle missing');
assert(extension.includes("class=\"multi-figure-caption\""), 'per-image subcaption editor missing');
assert(extension.includes("querySelectorAll('.multi-figure-resize')"), 'per-image drag resize binding missing');
assert(extension.includes("querySelectorAll('.multi-figure-caption')"), 'per-image subcaption binding missing');
assert(extension.includes("msg.type === 'replaceFigureItem'"), 'host replace-image handler missing');
assert(extension.includes("payload.items=multiPayload();payload.layout="), 'multi-figure edits must serialize through updateBlock');
assert(extension.includes('.slide .multi-figure-grid'), 'compact Beamer multi-figure styling missing');
assert(extension.includes('protectedSubfigures'), 'float-level edits must protect nested subfigure contents');
assert(extension.includes('input.multi-figure-width{width:60px;min-width:60px}'), 'multi-figure width control must remain readable');

console.log('PASS multi_figure_runtime');
