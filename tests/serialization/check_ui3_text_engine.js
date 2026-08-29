const fs = require('fs');
const src = fs.readFileSync('src/extension.ts','utf8');
const required = [
  'function toggleSelectionFormat(',
  'function commitInlineFormatting(',
  '__texflowSaveNow',
  "replace(/\\u200B/g,'')",
  "e.inputType!=='insertText'||e.data!==' '",
  "if(node.synthetic&&!editableLatex(el).trim())return;"
];
for (const token of required) {
  if (!src.includes(token)) throw new Error('Missing ui.3 text-engine invariant: '+token);
}
if (!src.includes("selectionSingleExistingFormat")) throw new Error('Format toggling support missing');
console.log('ui.3 text engine checks: PASS');
