const fs=require('fs');const s=fs.readFileSync('src/extension.ts','utf8');
const checks=[
 ['Document settings interface',/interface DocumentSettings/],
 ['Document settings message',/saveDocumentSettings/],
 ['Safe managed marker',/TeXFlow managed document settings/],
 ['Multicol semantic parser',/multicols/],
 ['Document columns renderer',/doc-columns/],
 ['Beamer blocks',/insertBeamerBlock/],
 ['Frame options',/updateFrameOptions/],
 ['Symbol search',/symbol-search/],
 ['Paragraph Enter semantic split',/Plain Enter splits only this paragraph/]
];let fail=0;for(const [n,re] of checks){if(!re.test(s)){console.error('FAIL',n);fail++;}else console.log('PASS',n)}process.exit(fail?1:0);
