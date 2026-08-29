const fs=require('fs');
const src=fs.readFileSync('src/extension.ts','utf8');
const must=[
  "data-action=\"spacing\"",
  "id=\"spacing-modal\"",
  "msg.type === 'insertVerticalSpace'",
  "class=\"tex-hspace\"",
  "kind: 'vspace'",
  "\\\\hspace",
  "\\\\vspace"
];
for(const token of must){if(!src.includes(token)){console.error('Missing spacing token:',token);process.exit(1)}}
console.log('spacing source checks: PASS');
