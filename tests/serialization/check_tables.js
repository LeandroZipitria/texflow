const fs=require('fs');
const src=fs.readFileSync('src/extension.ts','utf8');
const must=[
  "msg.type === 'insertTable'",
  'function tableBlockLatex(',
  'function parseTableData(',
  'function tableData(raw)',
  "kind = 'table'",
  'function documentTableHtml(',
  'function serializeDocumentTable(',
  'function bindDocumentTable(',
  'function renderTable(',
  "data-action=\"table\""
];
for(const x of must){if(!src.includes(x)){console.error('Missing table feature:',x);process.exit(1);}}
console.log('table source checks: PASS');
