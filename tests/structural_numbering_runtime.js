const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const src = fs.readFileSync('src/extension.ts', 'utf8');
const start = src.indexOf('function createHeadingCounterState');
const end = src.indexOf('function syncAlignRowNumberingUi', start);
assert(start >= 0 && end > start, 'Heading numbering helper not found');

function numberFor(documentClass, flow) {
  const sandbox = { documentClass };
  vm.runInNewContext(
    src.slice(start, end) + '\nthis.numberDocumentHeadings = numberDocumentHeadings; this.buildProjectHeadingNumberMap = buildProjectHeadingNumberMap;',
    sandbox
  );
  return sandbox.numberDocumentHeadings(JSON.parse(JSON.stringify(flow)));
}

let flow = numberFor('article', [
  { kind: 'heading', command: 'section', title: 'One', starred: false },
  { kind: 'heading', command: 'subsection', title: 'One A', starred: false },
  { kind: 'heading', command: 'subsubsection', title: 'One A i', starred: false },
  { kind: 'heading', command: 'section', title: 'Hidden number', starred: true },
  { kind: 'heading', command: 'section', title: 'Two', starred: false },
  { kind: 'heading', command: 'paragraph', title: 'Paragraph', starred: false }
]);
assert.deepStrictEqual(flow.map(x => x.headingNumber), ['1', '1.1', '1.1.1', '', '2', '']);

flow = numberFor('book', [
  { kind: 'matter', matter: 'frontmatter' },
  { kind: 'heading', command: 'chapter', title: 'Preface', starred: false },
  { kind: 'matter', matter: 'mainmatter' },
  { kind: 'heading', command: 'chapter', title: 'First', starred: false },
  { kind: 'heading', command: 'section', title: 'First section', starred: false },
  { kind: 'heading', command: 'subsection', title: 'First subsection', starred: false },
  { kind: 'heading', command: 'chapter', title: 'Second', starred: false },
  { kind: 'heading', command: 'section', title: 'Second section', starred: false },
  { kind: 'matter', matter: 'backmatter' },
  { kind: 'heading', command: 'chapter', title: 'Notes', starred: false }
]);
assert.deepStrictEqual(flow.map(x => x.kind === 'heading' ? x.headingNumber : null), [null, '', null, '1', '1.1', '1.1.1', '2', '2.1', null, '']);


const masterSource = String.raw`\documentclass{article}
\begin{document}
\section{A}
\input{part}
\section{C}
\end{document}`;
const includeSource = String.raw`\section{B}`;
const includeStart = masterSource.indexOf(String.raw`\input{part}`);
const sandboxProject = {
  documentClass: 'article',
  sources: [{ uri: 'master', text: masterSource }, { uri: 'part', text: includeSource }],
  projectIncludes: [{ sourceUri: 'master', targetUri: 'part', start: includeStart, missing: false }],
  masterUri: 'master', activeUri: 'part', documentSource: includeSource,
  documentTokenIsCommented: () => false
};
vm.runInNewContext(
  src.slice(start, end) + '\nthis.buildProjectHeadingNumberMap = buildProjectHeadingNumberMap;',
  sandboxProject
);
const globalMap = sandboxProject.buildProjectHeadingNumberMap();
assert.strictEqual(globalMap.get('master|' + masterSource.indexOf(String.raw`\section{A}`)), '1');
assert.strictEqual(globalMap.get('part|0'), '2');
assert.strictEqual(globalMap.get('master|' + masterSource.lastIndexOf(String.raw`\section{C}`)), '3');

for (const marker of [
  ".doc-heading[data-number]:before{content:attr(data-number) ' '",
  "applyDocumentHeadingNumbers(out)",
  "walk(masterUri||activeUri)",
  "numberAttr=x.headingNumber?' data-number=",
  "row.textContent=(x.headingNumber?x.headingNumber+' '",
  "target.kind==='heading'&&target.headingNumber"
]) assert(src.includes(marker), `Missing heading numbering integration: ${marker}`);

for (const marker of [
  "target.kind==='heading'&&target.starred",
  "This heading is unnumbered. Number the heading before adding a label.",
  "A matrix has no counter of its own.",
  "Enable Numbered in the equation editor before adding a label."
]) assert(src.includes(marker), `Missing counter-aware label guard: ${marker}`);

console.log('PASS structural_numbering_runtime');

const guardStart = src.indexOf('function structuralDelimiterEditAllowed');
const guardEnd = src.indexOf('async function updateDocumentRange', guardStart);
assert(guardStart >= 0 && guardEnd > guardStart, 'Structural delimiter guard helper not found');
// Keep this runtime test independent of the TypeScript compiler API. Node 24 can
// load the project's TypeScript package through different module interop shapes,
// which made ts.ScriptTarget unavailable even though `npm run compile` itself
// succeeds. This helper only contains two TypeScript annotations, so strip those
// annotations and execute the exact implementation source in the VM.
const guardJs = src.slice(guardStart, guardEnd)
  .replace(
    "function structuralDelimiterEditAllowed(beforeStructure: string[], afterStructure: string[], feature = ''): boolean",
    "function structuralDelimiterEditAllowed(beforeStructure, afterStructure, feature = '')"
  )
  .replace('(value: string) =>', '(value) =>');
const guardSandbox = {};
vm.runInNewContext(guardJs + '\nthis.structuralDelimiterEditAllowed = structuralDelimiterEditAllowed;', guardSandbox);
const allowStructural = guardSandbox.structuralDelimiterEditAllowed;
assert.strictEqual(allowStructural([String.raw`\begin{align*}`, String.raw`\end{align*}`], [String.raw`\begin{align}`, String.raw`\end{align}`], 'math-structure'), true, 'explicit math edit must allow align* -> align');
assert.strictEqual(allowStructural([String.raw`\begin{align}`, String.raw`\end{align}`], [String.raw`\begin{align*}`, String.raw`\end{align*}`], 'math-structure'), true, 'explicit math edit must allow align -> align*');
assert.strictEqual(allowStructural([String.raw`\begin{equation*}`, String.raw`\end{equation*}`], [String.raw`\begin{align}`, String.raw`\end{align}`], 'math-structure'), true, 'explicit math editor may change supported equation layout');
assert.strictEqual(allowStructural([String.raw`\begin{align*}`, String.raw`\end{align*}`], [String.raw`\begin{align}`, String.raw`\end{align}`], ''), false, 'ordinary visual edits must not bypass the structural guard');
assert.strictEqual(allowStructural([String.raw`\begin{itemize}`, String.raw`\end{itemize}`], [String.raw`\begin{align}`, String.raw`\end{align}`], 'math-structure'), false, 'math edit must not authorize unrelated structural replacement');

for (const marker of [
  'doc-heading-numbered-toggle',
  "save(true,'heading-numbering')",
  "data-texflow-ui=\"true\"",
  "if(el.dataset&&el.dataset.texflowUi==='true')return '';",
  "updateDocumentNode(node,replacement,true,'math-structure')"
]) assert(src.includes(marker), `Missing numbering transformation UI/safety integration: ${marker}`);

console.log('PASS structural_numbering_transformations');
