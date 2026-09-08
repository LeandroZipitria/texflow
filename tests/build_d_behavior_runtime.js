#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const src = fs.readFileSync('src/extension.ts', 'utf8');

function extractFunction(name, nextName) {
  const start = src.indexOf(`function ${name}`);
  assert(start >= 0, `${name} not found`);
  const end = nextName ? src.indexOf(`function ${nextName}`, start) : -1;
  assert(end > start, `${name} end marker not found`);
  return src.slice(start, end);
}

function runFunction(source, name, sandbox = {}) {
  vm.runInNewContext(source + `\nthis.__fn = ${name};`, sandbox);
  return sandbox.__fn;
}

// 1. Numbered aligned math must round-trip between align* and align without
// changing the body chosen by the equation editor.
{
  const helperSource = src.slice(
    src.indexOf('function mathCleanLabel'),
    src.indexOf('function syncAlignRowNumberingUi')
  );
  // saveMathEditor appears after closeMathEditor in the webview source, so use
  // the next stable statement instead of relying on function order.
  const saveStart = src.indexOf('function saveMathEditor(){');
  const saveEnd = src.indexOf("document.getElementById('math-modal').addEventListener", saveStart);
  assert(saveStart >= 0 && saveEnd > saveStart, 'saveMathEditor source not found');

  const state = { text: String.raw`x &= y \\
z &= w \notag`, structure: 'align' };
  const replacements = [];
  const sandbox = {
    document: {
      getElementById(id) {
        if (id === 'math-code') return { value: state.text };
        if (id === 'math-numbered') return { checked: true };
        if (id === 'math-label') return { value: '' };
        throw new Error(`unexpected element ${id}`);
      }
    },
    mathEditing: { mode: 'doc-edit', node: { block: { label: '' } } },
    mathStructure: () => state.structure,
    availableLabels: () => [],
    insertMathAtRememberedCursor: () => false,
    vscode: { postMessage() {} },
    closeMathEditor() {},
    updateDocumentNode(_node, replacement, refresh, feature) {
      replacements.push({ replacement, refresh, feature });
    }
  };
  vm.runInNewContext(
    helperSource + '\n' + src.slice(saveStart, saveEnd) + '\nthis.saveMathEditor = saveMathEditor;',
    sandbox
  );

  sandbox.saveMathEditor();
  assert.match(replacements.at(-1).replacement, /^\\begin\{align\}\n/, 'numbered rows must serialize as align');
  assert.strictEqual(replacements.at(-1).feature, 'math-structure');

  state.text = String.raw`x &= y \notag \\
z &= w \nonumber`;
  sandbox.saveMathEditor();
  assert.match(replacements.at(-1).replacement, /^\\begin\{align\*\}\n/, 'all unnumbered rows must serialize as align*');
  assert(!/\\(?:notag|nonumber)\b/.test(replacements.at(-1).replacement), 'align* source must not retain redundant row suppressors');

  state.text = String.raw`x &= y \\
z &= w`;
  sandbox.saveMathEditor();
  assert.match(replacements.at(-1).replacement, /^\\begin\{align\}\n/, 'align* must be able to return to align');
}

// 2. Heading numbering must serialize the exact section <-> section* round trip.
{
  const fn = runFunction(extractFunction('headingLatex', 'bindVisualDocument'), 'headingLatex', {});
  assert.strictEqual(fn('section', false, 'Results'), String.raw`\section{Results}`);
  assert.strictEqual(fn('section', true, 'Results'), String.raw`\section*{Results}`);
  assert.strictEqual(fn('section', false, 'Results'), String.raw`\section{Results}`);
  assert(src.includes('updateDocumentNode(node,headingLatex(node.command,node.starred,text),refresh,feature)'), 'heading editor must use the tested serializer');
}

// 3. Promoting a bare tikzpicture must preserve it byte-for-byte inside one
// Figure wrapper, with article and Beamer placement semantics.
{
  let helper = extractFunction('tikzPictureFigureLatex', 'figureBlockLatex');
  helper = helper
    .replace('function tikzPictureFigureLatex(source: string, beamer: boolean): string', 'function tikzPictureFigureLatex(source, beamer)')
    .replace("String(source ?? '')", "String(source == null ? '' : source)");
  const fn = runFunction(helper, 'tikzPictureFigureLatex', {});
  const picture = String.raw`\begin{tikzpicture}
\draw (0,0) -- (1,1);
\end{tikzpicture}`;
  const article = fn(picture, false);
  const beamer = fn(picture, true);
  assert.strictEqual(article, String.raw`\begin{figure}[htbp]
\centering
\begin{tikzpicture}
\draw (0,0) -- (1,1);
\end{tikzpicture}
\end{figure}`);
  assert.strictEqual(beamer, String.raw`\begin{figure}
\centering
\begin{tikzpicture}
\draw (0,0) -- (1,1);
\end{tikzpicture}
\end{figure}`);
  assert.strictEqual((article.match(/\\begin\{tikzpicture\}/g) || []).length, 1);
  assert(src.includes('const replacement = tikzPictureFigureLatex(expected, project.isBeamer);'), 'Make figure handler must use the tested wrapper');
}

// 4. TODO/FIXME are semantic source markers: editing their text must not turn
// them into generic comments, and insertion remains canonical.
{
  const noteFn = runFunction(extractFunction('labsNoteLatex', 'openLabsNote'), 'labsNoteLatex', {});
  assert.strictEqual(noteFn('check estimate', 'todo'), '% TODO check estimate');
  assert.strictEqual(noteFn('rewrite paragraph', 'fixme'), '% FIXME rewrite paragraph');

  let hostHelper = extractFunction('serializeCommentSource', 'serializeBlock');
  hostHelper = hostHelper
    .replace("function serializeCommentSource(value: unknown, commentNote = false, commentTag?: 'TODO' | 'FIXME'): string", "function serializeCommentSource(value, commentNote = false, commentTag)")
    .replace("String(value ?? '')", "String(value == null ? '' : value)");
  const hostSerialize = runFunction(hostHelper, 'serializeCommentSource', {});
  assert.strictEqual(hostSerialize('updated text', false, 'TODO'), '% TODO updated text');
  assert.strictEqual(hostSerialize('TODO updated text', false, 'TODO'), '% TODO updated text');
  assert.strictEqual(hostSerialize('updated text', false, 'FIXME'), '% FIXME updated text');
  assert.strictEqual(hostSerialize('FIXME updated text', false, 'FIXME'), '% FIXME updated text');
  const parserPath = require.resolve('../out/latex/blocks.js');
  const { parseBlocks } = require(parserPath);
  assert.strictEqual(parseBlocks(hostSerialize('updated text', false, 'TODO'))[0].commentTag, 'TODO');
  assert.strictEqual(parseBlocks(hostSerialize('updated text', false, 'FIXME'))[0].commentTag, 'FIXME');
  assert(src.includes('return serializeCommentSource(payload.text ?? block.commentText ?? block.text ??'), 'Beamer review edits must use the tested comment serializer');

  const serializeFn = runFunction(extractFunction('serializeRichDocumentBlock', 'bindDocumentRichBlock'), 'serializeRichDocumentBlock', {});
  const todoNode = { raw: '% TODO old text', block: { kind: 'comment', commentTag: 'TODO', commentNote: false } };
  const fixmeNode = { raw: '% FIXME old text', block: { kind: 'comment', commentTag: 'FIXME', commentNote: false } };
  assert.strictEqual(serializeFn(todoNode, 'updated text'), '% TODO updated text');
  assert.strictEqual(serializeFn(todoNode, 'TODO updated text'), '% TODO updated text', 'existing TODO prefix must not duplicate');
  assert.strictEqual(serializeFn(fixmeNode, 'updated text'), '% FIXME updated text');
  assert.strictEqual(serializeFn(fixmeNode, 'FIXME updated text'), '% FIXME updated text', 'existing FIXME prefix must not duplicate');
}

// 5. When the active document is an include, the webview mirror must mutate
// that include only. The host route is separately required to target
// project.activeDocument, not masterDocument.
{
  const updateFnSource = extractFunction('updateDocumentNode', 'serializeDocumentList');
  const messages = [];
  const node = { start: 0, end: 5, raw: 'alpha', synthetic: false, block: { kind: 'paragraph', raw: 'alpha', text: 'alpha' } };
  const sandbox = {
    documentSource: 'alpha beta',
    activeUri: 'file:///project/sections/part.tex',
    rootUri: 'file:///project/main.tex',
    sources: [
      { uri: 'file:///project/main.tex', text: String.raw`\input{sections/part}` },
      { uri: 'file:///project/sections/part.tex', text: 'alpha beta' }
    ],
    documentFlowById: { node },
    vscode: { postMessage(message) { messages.push(message); } },
    refreshBibliographyPreviews() {}
  };
  const fn = runFunction(updateFnSource, 'updateDocumentNode', sandbox);
  fn(node, 'gamma', false);
  assert.strictEqual(sandbox.sources[0].text, String.raw`\input{sections/part}`, 'master source must remain untouched');
  assert.strictEqual(sandbox.sources[1].text, 'gamma beta', 'active include source must receive the visual edit');
  assert.strictEqual(messages[0].type, 'updateDocumentNode');
  assert(src.includes('await updateDocumentRange(project.activeDocument,'), 'host update route must target project.activeDocument');
  assert(!src.includes('await updateDocumentRange(project.masterDocument,'), 'host update route must not target masterDocument');
}


// 6. Article comments/notes are visual overlays, not ordinary atomic document
// objects. Their marker must not consume vertical space and is aligned to the
// last visual line of the preceding paragraph/heading. A separate insertion
// affordance may appear after a trailing note so writing can continue below it.
{
  const atomicFn = runFunction(
    extractFunction('isAtomicDocumentBlockNode', 'documentAfterBlockSlotHtml'),
    'isAtomicDocumentBlockNode'
  );
  assert.strictEqual(atomicFn({ kind: 'block', block: { kind: 'comment' } }), false, 'source comments must not become ordinary atomic visual blocks');
  assert.strictEqual(atomicFn({ kind: 'block', block: { kind: 'commentblock' } }), false, 'comment environments must not become ordinary atomic visual blocks');
  assert.strictEqual(atomicFn({ kind: 'block', block: { kind: 'figure' } }), true, 'real atomic visual objects must keep their insertion slot');
  assert(src.includes('function alignDocumentCommentMarkers(host)'), 'article comments must have visual-line alignment logic');
  assert(src.includes("target.matches('.doc-paragraph,.doc-heading')"), 'comment alignment must measure the preceding paragraph/heading text line');
  assert(src.includes("targetCenter-anchorRect.top-markerHeight/2"), 'comment marker must be vertically centered on the measured visual line');
}


// 7. Notes/comments keep an explicit source-node anchor. Creating a new
// paragraph must neither retarget the marker to that paragraph nor insert the
// visual paragraph before the trailing review node.
{
  const helperSource = src.slice(
    src.indexOf('function isDocumentReviewNode'),
    src.indexOf('function documentAfterBlockSlotHtml')
  );
  const sandbox = { documentFlowOrder: [] };
  vm.runInNewContext(
    helperSource + '\nthis.isDocumentReviewNode=isDocumentReviewNode;this.documentReviewAnchorNode=documentReviewAnchorNode;this.documentNodeNeedsParagraphSlot=documentNodeNeedsParagraphSlot;',
    sandbox
  );
  const p = { kind: 'block', id: 'p', start: 0, end: 4, block: { kind: 'paragraph' } };
  const note = { kind: 'block', id: 'n', start: 6, end: 18, block: { kind: 'comment', commentTag: 'FIXME' } };
  const heading = { kind: 'heading', id: 'h', start: 20, end: 34 };
  const nextParagraph = { kind: 'block', id: 'p2', start: 20, end: 24, block: { kind: 'paragraph' } };
  sandbox.documentFlowOrder = [p, note, heading];
  assert.strictEqual(sandbox.isDocumentReviewNode(note), true);
  assert.strictEqual(sandbox.documentReviewAnchorNode(note).id, 'p', 'note must retain the preceding source node as its visual anchor');
  assert.strictEqual(sandbox.documentNodeNeedsParagraphSlot([p, note, heading], 1), true, 'trailing note before a heading needs a writing slot');
  assert.strictEqual(sandbox.documentNodeNeedsParagraphSlot([p, note], 1), true, 'trailing note at document end needs a writing slot');
  assert.strictEqual(sandbox.documentNodeNeedsParagraphSlot([p, note, nextParagraph], 1), false, 'existing paragraph after a note already provides the writing target');
  assert(src.includes("const anchorAttr=anchorNodeId?' data-anchor-node-id=\"'+esc(anchorNodeId)+'\"':'';"), 'rendered article review markers must carry their explicit anchor node id');

  // Regression for the observed UI failure: even if a newly-created synthetic
  // paragraph becomes the marker's immediate previous DOM sibling, the marker
  // must still resolve to the original paragraph by node id.
  const paragraphEl = { id: 'paragraph' };
  const syntheticEl = {
    classList: { contains(name) { return name === 'doc-paragraph'; } },
    previousElementSibling: null
  };
  const root = {
    querySelector(selector) {
      return selector === '[data-node-id="p"]' ? paragraphEl : null;
    }
  };
  const anchorEl = {
    dataset: { anchorNodeId: 'p' },
    previousElementSibling: syntheticEl,
    closest(selector) { return selector === '#content' ? root : null; }
  };
  const targetSandbox = {
    document: root,
    CSS: { escape(value) { return String(value); } }
  };
  const targetFn = runFunction(extractFunction('documentCommentAnchorTarget', 'documentCommentTargetRect'), 'documentCommentAnchorTarget', targetSandbox);
  assert.strictEqual(targetFn(anchorEl), paragraphEl, 'marker must not jump to a new synthetic paragraph');

  // Source order is authoritative for DOM insertion too. The trailing review
  // element is found by its node id rather than by fragile sibling adjacency.
  const source = 'Text\n\n% FIXME note\n\n\\section{Next}';
  const pEnd = source.indexOf('\n');
  const noteStart = source.indexOf('% FIXME');
  const noteEnd = noteStart + '% FIXME note'.length;
  const hStart = source.indexOf('\\section');
  const pNode = { kind: 'block', id: 'p', start: 0, end: pEnd, block: { kind: 'paragraph' } };
  const nNode = { kind: 'block', id: 'n', start: noteStart, end: noteEnd, block: { kind: 'comment' } };
  const hNode = { kind: 'heading', id: 'h', start: hStart, end: source.length };
  const commentEl = { id: 'comment' };
  const domRoot = {
    querySelector(selector) {
      return selector === '.comment-anchor[data-node-id="n"]' ? commentEl : null;
    }
  };
  const referenceEl = {
    nextElementSibling: syntheticEl,
    closest(selector) { return selector === '#content' ? domRoot : null; }
  };
  const tailSandbox = {
    documentSource: source,
    documentFlowOrder: [pNode, nNode, hNode],
    isDocumentReviewNode: sandbox.isDocumentReviewNode,
    document: domRoot,
    CSS: { escape(value) { return String(value); } },
    documentBodyInfo() { return { source, start: 0, end: source.length }; }
  };
  const tailHelpers =
    src.slice(src.indexOf('function paragraphInsertionPoint'), src.indexOf('function focusParagraphStart')) + '\n' +
    src.slice(src.indexOf('function documentReviewTailNode'), src.indexOf('function createSyntheticParagraphAfter'));
  vm.runInNewContext(tailHelpers + '\nthis.documentReviewTailNode=documentReviewTailNode;this.documentReviewTailElement=documentReviewTailElement;this.paragraphInsertionPoint=paragraphInsertionPoint;', tailSandbox);
  const tail = tailSandbox.documentReviewTailNode(pNode);
  assert.strictEqual(tail.id, 'n', 'paragraph insertion must advance past its trailing note in source order');
  assert.strictEqual(tailSandbox.documentReviewTailElement(referenceEl, pNode), commentEl, 'visual insertion must target the actual trailing note node, not the immediate sibling');
  const point = tailSandbox.paragraphInsertionPoint(tail);
  assert(point.anchor >= noteEnd, 'new paragraph source anchor must be after the note');
  assert.strictEqual(point.anchor, hStart, 'existing blank separator after the note should be reused before the next heading');
  assert(src.includes('documentReviewTailElement(referenceEl,node)'), 'synthetic paragraph creation must use review-aware DOM placement');
  assert(src.includes('scheduleDocumentCommentMarkerAlignment(content)'), 'marker alignment must be refreshed after a synthetic paragraph is created');
}

console.log('PASS build_d_behavior_runtime');
