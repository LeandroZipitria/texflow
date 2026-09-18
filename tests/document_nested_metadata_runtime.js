const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const extensionPath = path.join(root, 'src', 'extension.ts');
const blocksOutPath = path.join(root, 'out', 'latex', 'blocks.js');
const fixturePath = path.join(__dirname, 'fixtures', 'document_nested_metadata.tex');
const extension = fs.readFileSync(extensionPath, 'utf8');
const fixture = fs.readFileSync(fixturePath, 'utf8');

function between(startMarker, endMarker) {
  const start = extension.indexOf(startMarker);
  const end = extension.indexOf(endMarker, start + startMarker.length);
  assert(start >= 0 && end > start, `Could not extract ${startMarker}`);
  return extension.slice(start, end);
}

// The visual renderer must treat nested thanks as one semantic object rather than
// exposing the full command text in title/author fields.
const inlineSource = between('function replaceBalancedInlineCommand', 'function splitBeamerMetadataSegments');
const inlineContext = {
  Intl,
  encodeURIComponent,
  decodeURIComponent,
  documentRefs: {},
  availableLabels: () => [],
  citationLabel: () => ({ html: '', missing: false }),
  esc: value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
};
vm.createContext(inlineContext);
vm.runInContext(`${inlineSource};this.__latexToHtml=latexToHtml;`, inlineContext);
const title = 'Nested Metadata Test\\thanks{A title note with \\protect\\href{https://example.com}{a link}.}';
const titleHtml = inlineContext.__latexToHtml(title);
assert(titleHtml.includes('class="tex-thanks"'), 'thanks semantic chip missing');
assert(!titleHtml.includes('\\thanks{'), 'raw thanks command leaked into visual title');
const authorHtml = inlineContext.__latexToHtml('First\\thanks{One.} ~and Second\\thanks{Two.}');
assert.strictEqual((authorHtml.match(/class="tex-thanks"/g) || []).length, 2, 'author thanks notes not preserved separately');
assert(authorHtml.includes('\u00a0and') || authorHtml.includes('\u00A0and') || authorHtml.includes('\u00a0'.replace('\\u00a0', '\u00a0')), 'nonbreaking author separator was not rendered as space');

// Exercise the actual webview heading parser with minimal host stubs. Labels nested
// inside headings and labels immediately following headings must attach to the heading.
const tokenSource = between('function documentTokenIsCommented', 'function focusDocumentSourceOffset');
const bodyStart = fixture.indexOf('\\begin{document}') + '\\begin{document}'.length;
const bodyEnd = fixture.lastIndexOf('\\end{document}');
const body = fixture.slice(bodyStart, bodyEnd);
const flowContext = {
  documentSource: body,
  documentClass: 'article',
  projectIncludes: [],
  activeUri: 'fixture.tex',
  documentRefs: {},
  documentFlowById: {},
  documentFlowOrder: [],
  documentLabels: [],
  documentBodyInfo: () => ({ source: body, start: 0, end: body.length }),
  parseDocumentChunk: () => {},
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
vm.createContext(flowContext);
vm.runInContext(`${tokenSource};this.__parseDocumentFlow=parseDocumentFlow;`, flowContext);
const flow = flowContext.__parseDocumentFlow();
const headings = flow.filter(node => node.kind === 'heading');
assert.deepStrictEqual(Array.from(headings, h => h.title), ['Introduction', 'Related work', 'Data'], 'heading titles still contain label source');
assert.deepStrictEqual(Array.from(headings, h => h.label), ['sec:introduction', 'sec:related', 'sec:data'], 'heading labels were not captured');
assert.deepStrictEqual(Array.from(headings, h => h.headingLabelPlacement), ['inside', 'after', 'inside'], 'label placement was not preserved');
assert.strictEqual(flowContext.documentRefs['sec:introduction'], '1', 'nested heading label did not become a reference target');
assert.strictEqual(flowContext.documentRefs['sec:related'], '1.1', 'post-heading label did not become a reference target');

// Run the actual shared block parser compiled by `npm run compile` before runtime checks.
// Do not depend on TypeScript's JavaScript compiler API here: TypeScript 7 can expose
// a different runtime surface even though `tsc` itself compiles the extension correctly.
assert(fs.existsSync(blocksOutPath), 'out/latex/blocks.js missing; run compile first');
delete require.cache[require.resolve(blocksOutPath)];
const { parseBlocks } = require(blocksOutPath);

// Metadata commands are valid inside the document body before \maketitle. They are
// represented by the editable document header and must not be emitted a second time as
// ordinary/raw body blocks.
const chunkSource = between('function parseDocumentChunk', 'function parseDocumentFlow');
const chunkContext = {
  activeUri: 'fixture.tex',
  masterUri: 'fixture.tex',
  parseBlocks,
  configuredCustomEnvironmentBlock: block => block
};
vm.createContext(chunkContext);
vm.runInContext(`${chunkSource};this.__parseDocumentChunk=parseDocumentChunk;`, chunkContext);
const abstractAt = body.indexOf('\\begin{abstract}');
const metadataPrefix = abstractAt >= 0 ? body.slice(0, abstractAt) : body;
const metadataNodes = [];
let metadataNodeId = 0;
chunkContext.__parseDocumentChunk(metadataPrefix, 0, metadataNodes, () => metadataNodeId++);
assert.strictEqual(metadataNodes.length, 0, 'title/author/date/maketitle leaked into document body flow');

const parsedAbstract = parseBlocks('\\begin{abstract}\n\\setstretch{1.25}\nAbstract text.\n\\end{abstract}');
const abstractBlock = parsedAbstract.find(b => b.kind === 'abstract');
assert(abstractBlock, 'abstract block missing');
assert.strictEqual(abstractBlock.abstractStretch, '1.25', 'abstract setstretch value was not parsed');
assert(!/\\setstretch/.test(abstractBlock.text || ''), 'setstretch command leaked into editable abstract text');
assert(/Abstract text/.test(abstractBlock.text || ''), 'abstract text was lost while extracting setstretch');

const parsed = parseBlocks('\\pagebreak{}\n\n\\medskip{}\n\\noindent \\textbf{Setting.} Text.\n\n\\bigskip{}\n');
assert(parsed.some(b => b.kind === 'break' && b.breakCommand === 'pagebreak' && b.raw === '\\pagebreak{}'), 'pagebreak{} not consumed atomically');
assert(parsed.some(b => b.kind === 'vspace' && b.spaceAmount === 'medskip'), 'medskip not parsed semantically');
assert(parsed.some(b => b.kind === 'vspace' && b.spaceAmount === 'bigskip'), 'bigskip not parsed semantically');
assert(parsed.some(b => b.kind === 'raw' && b.hidden && /\\noindent/.test(b.raw)), 'noindent not preserved as hidden source directive');
assert(parsed.some(b => b.kind === 'paragraph' && /Setting/.test(b.text || '')), 'text after noindent was lost');

// Static UI contracts: headings expose editable label metadata and thanks is editable.
assert(extension.includes('doc-heading-label-input'), 'editable heading label input missing');
assert(extension.includes("el.__texflowCommit=()=>"), 'metadata semantic commit hook missing');
assert(extension.includes("e.target.closest('.tex-thanks,.tex-footnote"), 'thanks object is not wired to inline editing');
assert(extension.includes("doc-vspace-named"), 'named spacing visual class missing');
assert(extension.includes('doc-abstract-stretch-input'), 'editable abstract line-spacing control missing');
assert(extension.includes("\\setstretch{'+stretch+'}"), 'abstract serializer does not preserve setstretch');
assert(extension.includes('doc-title-date'), 'empty date metadata is no longer editable after metadata deduplication');
assert(extension.includes("if(b&&b.hidden)return ''"), 'hidden directives can still leak into Visual');

console.log('PASS document_nested_metadata_runtime');
