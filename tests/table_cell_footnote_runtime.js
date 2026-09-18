const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'extension.ts'), 'utf8');

const hook = "cell.__texflowCommit=(text,feature='')=>{setEditableLatex(cell,text);save(false);}";
assert((src.split(hook).length - 1) >= 2, 'Document and Beamer table cells must expose semantic inline commit hooks');
assert((src.match(/cell\.__texflowSaveNow=\(\)=>save\(false\)/g) || []).length >= 2, 'table cells must preserve a save-now hook');
assert(src.includes('function tableCellCursorState(editable,range)'), 'semantic table-cell cursor snapshot missing');
assert(src.includes('lastTableCellCursor'), 'table-cell cursor state is not retained across Insert menu focus changes');
assert(src.includes('function insertLatexAtTableCellCursor(code,tableCtx)'), 'semantic table-cell insertion path missing');
assert(src.includes("tableCtx.mode==='document'"), 'Document table-cell insertion path missing');
assert(src.includes("type:'updateBlock'"), 'Beamer table-cell insertion path missing');
assert(src.includes("labsInsertInline('\\\\footnote{"), 'Insert Footnote no longer uses the inline insertion path');
assert(src.includes("footnoteParts=/^\\\\footnote(?:\\[[^\\]]+\\])?\\{([\\s\\S]*)\\}$/"), 'caret restoration does not recognize inserted footnotes');
assert(src.includes("tableCtx.mode==='beamer'&&/^\\\\footnote\\{/"), 'Beamer table footnotes are not promoted to frame footnotes');
assert(src.includes("'\\\\footnote[frame]'"), 'Beamer table footnote frame option missing');
assert(src.includes('data-footnote-option'), 'Visual footnote atom does not preserve Beamer footnote options');

console.log('PASS table_cell_footnote_runtime');
