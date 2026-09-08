const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const src = fs.readFileSync('src/extension.ts', 'utf8');

const helperStart = src.indexOf('function splitMathRows');
const helperEnd = src.indexOf('function makeAlignRow', helperStart);
assert(helperStart >= 0 && helperEnd > helperStart, 'Math numbering helpers not found');
const sandbox = {};
vm.runInNewContext(
  src.slice(helperStart, helperEnd) + '\nthis.numberDocumentEquationBlock = numberDocumentEquationBlock; this.alignTextUsesNumbering = alignTextUsesNumbering;',
  sandbox
);
const numberBlock = sandbox.numberDocumentEquationBlock;
const alignUsesNumbering = sandbox.alignTextUsesNumbering;

let r = numberBlock({ env: 'equation', text: 'x=y' }, 0);
assert.strictEqual(r.number, 1);
assert.strictEqual(r.next, 1);

r = numberBlock({ env: 'equation*', text: 'x=y' }, 1);
assert.strictEqual(r.number, null, 'equation* must not be numbered');
assert.strictEqual(r.next, 1, 'equation* must not consume an equation number');

r = numberBlock({ env: 'align', text: 'x &= y \\label{eq:1} \\\\\n\\mu &= \\tau \\label{eq:2}' }, 0);
assert.deepStrictEqual(JSON.parse(JSON.stringify(r.rows)), [
  { number: 1, label: 'eq:1' },
  { number: 2, label: 'eq:2' }
]);
assert.strictEqual(r.next, 2);

r = numberBlock({ env: 'align', text: 'x &= y \\notag \\\\\nz &= w \\label{eq:z}' }, 4);
assert.deepStrictEqual(JSON.parse(JSON.stringify(r.rows)), [
  { number: null, label: '' },
  { number: 5, label: 'eq:z' }
]);
assert.strictEqual(r.next, 5);

r = numberBlock({ env: 'gather', text: 'a=b \\\\\nc=d' }, 2);
assert.deepStrictEqual(JSON.parse(JSON.stringify(r.rows)).map(x => x.number), [3, 4]);
assert.strictEqual(r.next, 4);

r = numberBlock({ env: 'multline', text: 'a+b \\\\\n+c=d' }, 4);
assert.strictEqual(r.number, 5);
assert.strictEqual(r.next, 5);

r = numberBlock({ env: 'multline*', text: 'a+b \\\\\n+c=d' }, 5);
assert.strictEqual(r.number, null);
assert.strictEqual(r.next, 5);



assert.strictEqual(alignUsesNumbering(String.raw`x &= y \\
\mu &= \tau`), true, 'aligned rows without notag must select numbered align');
assert.strictEqual(alignUsesNumbering(String.raw`x &= y \notag \\
z &= w \nonumber`), false, 'all unnumbered aligned rows must select align*');
assert.strictEqual(alignUsesNumbering(String.raw`x &= y \notag \\
z &= w`), true, 'mixed aligned rows must select numbered align with notag on unnumbered rows');

for (const marker of [
  "numberWrap.style.display=(numberableEquation||numberableSystem)?'flex':'none'",
  "numbered=structure==='align'?alignTextUsesNumbering(text)",
  "loadAlignBuilder(text,numbered)",
  "rowEls.some(row=>row.querySelector('.math-align-numbered').checked)"
]) assert(src.includes(marker), `Missing aligned numbering control integration: ${marker}`);

for (const marker of [
  "rowNumberTexts=[...el.querySelectorAll('.doc-equation-row-number')]",
  "class=\"doc-equation-numbers\"",
  "rows.find(x=>x&&x.label===key)"
]) assert(src.includes(marker), `Missing visual numbering integration: ${marker}`);


for (const marker of [
  "label.disabled=!numbered",
  "if(numbered&&lab)x+=",
  "numberableSystem=state.object==='system'",
  "labelWrap.style.display=(overallLabelable&&numbered)?'grid':'none'",
  "label=(numbered&&!['align','gather','matrix','inline'].includes(structure))?rawLabel:''"
]) assert(src.includes(marker), `Missing general numbering/label rule: ${marker}`);

console.log('PASS math_numbering_runtime');
