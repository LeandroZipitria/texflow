const fs=require('fs');
const src=fs.readFileSync('src/extension.ts','utf8');
const must=[
  "filters: { Figures: ['png','jpg','jpeg','pdf'] }",
  "const isPdf = head.length >= 5",
  "const isPng = head.length >= 8",
  "const isJpeg = head.length >= 3",
  'Unsupported image format',
  'PDF, PNG, and JPEG files compatible with pdfLaTeX'
];
for(const x of must){if(!src.includes(x)){console.error('Missing format validation:',x);process.exit(1);}}
console.log('figure format checks: PASS');
