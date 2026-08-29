const fs = require('fs');
const src = fs.readFileSync('src/extension.ts','utf8');
const must = [
  "add('Aligned equations…','alignmath')",
  "add('Cases / system…','casesmath')",
  "add('Matrix…','matrixmath')",
  'id="math-align-builder"',
  'id="math-cases-builder"',
  'id="math-matrix-builder"',
  "structure==='align'?(numbered?'align':'align*')",
  "if (/^align\\*?$/.test(env))",
  "\\\\begin{cases}",
  "pmatrix",
  "bmatrix",
  "vmatrix"
];
for (const x of must) {
  if (!src.includes(x)) throw new Error('Missing advanced math source invariant: '+x);
}
console.log('advanced math source checks: PASS');
