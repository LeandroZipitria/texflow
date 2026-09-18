const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const extension = fs.readFileSync(path.join(root, 'src', 'extension.ts'), 'utf8');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'document_nested_metadata.tex'), 'utf8');
const parserPath = path.join(root, 'out', 'latex', 'blocks.js');
assert(fs.existsSync(parserPath), 'compiled parser missing; run npm run compile first');
delete require.cache[require.resolve(parserPath)];
const { parseBlocks } = require(parserPath);

function between(startMarker, endMarker) {
  const start = extension.indexOf(startMarker);
  const end = extension.indexOf(endMarker, start + startMarker.length);
  assert(start >= 0 && end > start, `Could not extract ${startMarker}`);
  return extension.slice(start, end);
}

const bodyStart = fixture.indexOf('\\begin{document}') + '\\begin{document}'.length;
const bodyEnd = fixture.lastIndexOf('\\end{document}');
const body = fixture.slice(bodyStart, bodyEnd);
const context = {
  documentSource: body,
  documentClass: 'article',
  projectIncludes: [],
  activeUri: 'fixture.tex',
  documentRefs: {},
  documentFlowById: {},
  documentFlowOrder: [],
  documentLabels: [],
  parseBlocks,
  configuredCustomEnvironmentBlock: block => block,
  documentBodyInfo: () => ({ source: body, start: 0, end: body.length }),
  applyDocumentHeadingNumbers: out => {
    let section = 0, subsection = 0;
    for (const node of out) {
      if (node.kind !== 'heading' || node.starred) continue;
      if (node.command === 'section') { section += 1; subsection = 0; node.headingNumber = String(section); }
      else if (node.command === 'subsection') { subsection += 1; node.headingNumber = `${section}.${subsection}`; }
    }
  },
  numberDocumentEquationBlock: (_block, current) => ({ next: current, rows: [] })
};
vm.createContext(context);
vm.runInContext(
  between('function parseDocumentChunk', 'function focusDocumentSourceOffset') +
  '\nthis.__parseDocumentFlow=parseDocumentFlow;',
  context
);
const flow = context.__parseDocumentFlow();

const leakedMetadata = flow.filter(node => /\\(?:title|author|date|maketitle)\b/.test(String(node.raw || '')));
assert.strictEqual(leakedMetadata.length, 0, 'title/author/date/maketitle leaked into the visual body flow');

const abstractNode = flow.find(node => node.kind === 'block' && node.block && node.block.kind === 'abstract');
assert(abstractNode, 'abstract missing from full document flow');
assert.strictEqual(abstractNode.block.abstractStretch, '1.25', 'abstract line spacing was not retained as metadata');
assert(!/\\setstretch/.test(String(abstractNode.block.text || '')), 'setstretch leaked into editable abstract text');

const headings = flow.filter(node => node.kind === 'heading');
assert.deepStrictEqual(Array.from(headings, h => h.title), ['Introduction', 'Related work', 'Data']);
assert.deepStrictEqual(Array.from(headings, h => h.label), ['sec:introduction', 'sec:related', 'sec:data']);

assert(flow.some(node => node.kind === 'block' && node.block && node.block.kind === 'vspace' && node.block.spaceAmount === 'medskip'), 'medskip missing from document flow');
assert(flow.some(node => node.kind === 'block' && node.block && node.block.kind === 'vspace' && node.block.spaceAmount === 'bigskip'), 'bigskip missing from document flow');
assert(flow.some(node => node.kind === 'block' && node.block && node.block.kind === 'break' && node.block.breakCommand === 'pagebreak'), 'pagebreak{} missing from document flow');
assert(flow.some(node => node.kind === 'block' && node.block && node.block.hidden && /\\noindent/.test(node.block.raw || '')), 'noindent must remain preserved but hidden');
assert(!flow.some(node => String(node.raw || '').trim() === '{}'), 'stray braces from pagebreak{} leaked into document flow');

console.log('PASS document_flow_integration_runtime');
