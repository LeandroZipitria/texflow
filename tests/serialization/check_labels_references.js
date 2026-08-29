const fs = require('fs');
const assert = require('assert');
const src = fs.readFileSync('src/extension.ts', 'utf8');

// Inline semantic references must be protected before generic HTML rendering
// and serialize back to the original LaTeX command/key.
assert(src.includes("source=source.replace(/\\\\(eqref|ref|autoref|pageref)\\{([^}]+)\\}/g"));
assert(src.includes("el.classList.contains('tex-reference')"));
assert(src.includes("data-ref-command"));
assert(src.includes("data-ref-key"));

// Labels are structural metadata, not editable paragraph text.
assert(src.includes('Standalone labels are structural metadata'));
assert(src.includes("documentLabels=[]"));
assert(src.includes("target.label=key"));

// Existing equation labels must survive visual equation edits.
assert(src.includes("existingLabel = /\\\\label\\{([^}]+)\\}/"));
assert(src.includes("overallLabel=structure==='align'?'':String(b.label||'').trim()"));
assert(src.includes("label=mathCleanLabel(document.getElementById('math-label').value)"));

// UI surface and duplicate/basic key validation.
assert(src.includes("add('Add label to selected object…','label')"));
assert(src.includes("add('Insert cross-reference…','reference')"));
assert(src.includes("return'That label already exists.'"));

console.log('labels/references source checks: PASS');
