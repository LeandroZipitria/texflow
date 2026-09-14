#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const extension = fs.readFileSync(path.join(root, 'src', 'extension.ts'), 'utf8');

assert(extension.includes('class="figure-replace-action single-figure-replace"'), 'single Beamer figure Replace button missing');
assert(extension.includes("if(singleReplace)singleReplace.onclick=()=>vscode.postMessage({type:'replaceFigureItem',frameIndex,blockId:block.id,itemIndex:0})"), 'single Beamer figure Replace binding missing');
assert(extension.includes('class="figure-replace-action document-figure-replace"'), 'single document figure Replace button missing');
assert(extension.includes("type:'replaceDocumentFigure'"), 'document figure replacement message missing');
assert(extension.includes("if (msg.type === 'replaceDocumentFigure')"), 'document figure replacement host handler missing');
assert(extension.includes("const match = /\\\\includegraphics"), 'document figure replacement must locate includegraphics safely');
assert(extension.includes("activeDocument.getText().slice(start, end) !== expected"), 'document figure replacement must validate the expected source range');
assert(extension.includes("chosen.latexPath"), 'figure replacement must use the selected project-relative LaTeX path');

assert(extension.includes('class="figure-replace-action multi-figure-replace"'), 'multi-figure Replace button must share the compact style');
assert((extension.match(/title="Replace"/g) || []).length >= 3, 'figure Replace controls need a full Replace tooltip');
assert((extension.match(/>Rep…<\/button>/g) || []).length >= 3, 'figure Replace controls should use the compact Rep… label');
assert(extension.includes('<label>W(%) <input class="figure-width-input"'), 'single-figure width label must keep the percent unit visible');
assert(extension.includes('.figure-replace-action{'), 'shared figure Replace style missing');
assert(extension.includes('background:var(--vscode-editor-foreground)!important'), 'figure Replace action must stay high-contrast and theme-aware');
assert(extension.includes('.slide .figure-card:not(.multi-figure-card) .figure-visual img'), 'single Beamer figure needs its own compact preview rule');
assert(extension.includes('max-height:14.75em'), 'single Beamer figure preview should use the compact max height');

console.log('PASS single_figure_replace_runtime');
