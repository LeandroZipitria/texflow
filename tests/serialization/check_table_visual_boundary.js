const fs=require('fs');
const src=fs.readFileSync('src/extension.ts','utf8');
function ok(cond,msg){if(!cond){console.error('FAIL',msg);process.exit(1)}}
ok(src.includes('figure|table|columns'), 'Visual block scanner must recognize table as a structural environment');
ok(src.includes('id="table-modal"'), 'Internal TeXFlow table modal must exist');
ok(src.includes("else if(a==='table')openTableEditor();"), 'Table menu must open the internal editor');
ok(!src.includes("prompt: 'Table rows'"), 'Table insertion must not use VS Code input boxes');
ok(src.includes("const rows = Number(msg.rows);"), 'Extension host must validate modal table payload');
console.log('PASS table visual boundary/internal editor checks');
