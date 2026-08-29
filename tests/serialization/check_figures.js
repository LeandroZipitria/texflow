const fs = require('fs');
const assert = require('assert');
const src = fs.readFileSync('src/extension.ts', 'utf8');

assert(src.includes("add('Figure…','figure')"));
assert(src.includes("msg.type === 'insertFigure'"));
assert(src.includes('chooseFigureFile'));
assert(src.includes('figureBlockLatex'));
assert(src.includes('function figureData(raw)'));
assert(src.includes('figureLabel'));
assert(src.includes('figurePlacement'));
assert(src.includes('documentFigureHtml'));
assert(src.includes('bindDocumentFigure'));
assert(src.includes('figure-resize'));
assert(src.includes('figure-caption-input'));
assert(src.includes('figure-label-input'));

console.log('figure source checks: PASS');
