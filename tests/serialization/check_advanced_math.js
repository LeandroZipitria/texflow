const fs = require('fs');
const src = fs.readFileSync('src/extension.ts','utf8');
const must = [
  "label:'Equation…',action:'mathEquation'",
  "label:'Matrix…',action:'mathMatrix'",
  "label:'System…',action:'mathSystem'",
  'id="math-placement"',
  'id="math-layout"',
  'id="math-align-builder"',
  'id="math-cases-builder"',
  'id="math-matrix-builder"',
  'Delimiters:[',
  'Accents:[',
  "structure==='align'?(numbered?'align':'align*')",
  "if (/^align\\*?$/.test(env))",
  "\\\\begin{cases}",
  "pmatrix",
  "bmatrix",
  "Bmatrix",
  "vmatrix"
];
for (const x of must) {
  if (!src.includes(x)) throw new Error('Missing advanced math source invariant: '+x);
}
console.log('advanced math source checks: PASS');
