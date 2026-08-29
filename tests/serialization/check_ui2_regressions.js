const fs=require('fs');
const assert=require('assert');
const s=fs.readFileSync('src/extension.ts','utf8');
assert(!s.includes('id="toggle-tools"'), 'Legacy + toggle must be removed');
assert(!s.includes('aria-label="Insert tools"'), 'Legacy insert rail must be removed');
for (const x of [
  "add('Title','title')", "add('Author','author')", "add('Abstract','abstract')", "add('Normal text','paragraph')",
  "add('Bulleted list','bullets')", "add('Numbered list','numbered')",
  "add('Display math','displaymath')", "add('Aligned equations…','alignmath')", "add('Cases / system…','casesmath')", "add('Matrix…','matrixmath')",
  "add('Add / change bibliography…','addbibliography')", "add('Add label to selected object…','label')",
  "add('Figure…','figure')", "add('Table…','table')", "add('Space…','spacing')"
]) assert(s.includes(x), 'Missing migrated Insert command: '+x);
assert(s.includes("[insertTopButton,formatTopButton].filter(Boolean).forEach(btn=>btn.addEventListener('mousedown',e=>{rememberVisualCursor();e.preventDefault();}))"), 'Top Insert/Format must preserve visual cursor/selection');
assert(s.includes("b.onmousedown=e=>{rememberVisualCursor();e.preventDefault();}"), 'Dynamic Insert actions must preserve caret');
assert(/el\.addEventListener\('blur',[^;]+(?:topbar|save\(false\))/.test(s), 'Paragraph blur must save safely without forcing rerender');
assert(!s.includes("if(!['ArrowUp','ArrowDown'].includes(e.key)"), 'Generic cross-block ArrowUp/ArrowDown navigation must remain disabled');
console.log('ui.2 caret/menu regression checks: PASS');
