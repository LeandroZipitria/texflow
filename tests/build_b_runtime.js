const fs = require('fs');
const assert = require('assert');

const src = fs.readFileSync('src/extension.ts', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Build B exposes a small semantic Insert surface. LaTeX variants live inside
// the object editor instead of becoming separate top-level commands.
for (const marker of [
  "label:'Equation…',action:'mathEquation'",
  "label:'Matrix…',action:'mathMatrix'",
  "label:'System…',action:'mathSystem'",
  "label:'Figure…',action:'figure'",
  "label:'Table…',action:'table'",
  "label:'Quote…',action:'quote'",
  "label:'Columns…',action:'columns'",
]) assert(src.includes(marker), 'Missing compact Build B menu marker: ' + marker);

const topMenu = src.slice(src.indexOf('function renderTopMenus()'), src.indexOf("document.getElementById('view-continuous')"));
for (const oldLabel of [
  'Inline math', 'Display math', 'Numbered equation…', 'Aligned equations…',
  'Gathered equations…', 'Multiline equation…', 'Cases / system…',
  'Subfigures…', 'Table from CSV / TSV…', 'Two-column block…', 'Three-column block…',
  'Quotation…'
]) assert(!topMenu.includes(oldLabel), 'Old top-level variant still exposed: ' + oldLabel);

// Equation is one object with placement/layout/numbering properties.
for (const id of ['math-object','math-placement','math-layout','math-numbered','math-label']) {
  assert(src.includes(`id="${id}"`), 'Missing equation property control: ' + id);
}
assert(src.includes('<option value="inline">Inline</option><option value="display">Display</option>'), 'Equation placement selector missing');
assert(src.includes('<option value="single">Single</option><option value="align">Aligned</option><option value="gather">Gathered</option><option value="multline">Multiline</option>'), 'Equation layout selector missing');

// Matrix/system remain semantic objects backed by structured editors.
for (const id of ['math-matrix-builder','math-cases-builder','math-matrix-grid','math-cases-rows']) {
  assert(src.includes(`id="${id}"`), 'Missing structured math editor: ' + id);
}

// Math palette must include delimiters and general mathematical accents.
for (const marker of [
  'Delimiters:[', 'Accents:[', "['x̂','\\\\hat{}']", "['x̄','\\\\bar{}']",
  "['x̃','\\\\tilde{}']", "['x⃗','\\\\vec{}']", "['ẋ','\\\\dot{}']",
  "['ẍ','\\\\ddot{}']", "['( )','\\\\left(  \\\\right)']"
]) assert(src.includes(marker), 'Missing Build B math palette marker: ' + marker);

// The desired LyX-style shortcut convention: Ctrl+M inline, Ctrl+Shift+M display.
assert(src.includes("if(e.ctrlKey&&!e.metaKey&&e.key.toLowerCase()==='m')"), 'Ctrl+M shortcut guard missing');
assert(src.includes("openMathInsert(e.shiftKey?'mathEquationDisplay':'mathEquationInline',current)"), 'Ctrl+M shortcut convention missing');

// One Table action; CSV/TSV is a property/workflow inside the table dialog.
assert(src.includes('id="table-paste-data"'), 'Table paste-data action missing');
assert(src.includes("document.getElementById('table-paste-data').onclick"), 'Table paste-data handler missing');

// One Figure action can select one or many images.
assert(src.includes("const chosen = await chooseMultipleFigureFiles(targetDocument);"), 'Unified figure picker missing');
assert(src.includes("if (chosen.length > 1)"), 'Unified figure picker must route multiple images to subfigures');

// Custom environments are opt-in and conservative: only configured simple
// environments become visual, while everything else remains raw.
const properties = pkg.contributes && pkg.contributes.configuration && pkg.contributes.configuration.properties;
assert(properties && properties['texflow.customEnvironments'], 'texflow.customEnvironments setting missing');
for (const marker of [
  'function getCustomEnvironmentSpecs()',
  'function configuredCustomEnvironmentBlock(block)',
  "kind:'customenv'",
  "if(b.kind==='customenv')",
  'function openLabsCustomEnvironment()'
]) assert(src.includes(marker), 'Missing custom environment marker: ' + marker);

console.log('PASS build_b_runtime');
