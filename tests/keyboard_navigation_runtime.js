#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '..', 'src', 'extension.ts');
if (!fs.existsSync(sourcePath)) {
  console.error(`FAIL keyboard_navigation_runtime: missing ${sourcePath}`);
  process.exit(1);
}
const source = fs.readFileSync(sourcePath, 'utf8');

function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL keyboard_navigation_runtime: ${message}`);
    process.exit(1);
  }
}

ok(source.includes('function focusEditableBoundary(target,dir)'), 'shared editable-boundary focus helper is missing');

ok(source.includes('function visualEditableTargets(origin)'), 'shared visual editable target sequence is missing');
ok(source.includes("querySelectorAll('[contenteditable=true]')"), 'visual navigation does not include embedded editable objects');
ok(source.includes('function relativeVisualEditable(origin,dir,skipContainer=null)'), 'relative visual editable lookup is missing');
ok(source.includes('function bindDocumentTextNavigation(el)'), 'document keyboard navigation binder is missing');
ok(source.includes('bindDocumentTextNavigation(el);'), 'document paragraphs/headings are not using the shared navigation binder');
ok(source.includes("e.key==='ArrowUp'"), 'ArrowUp navigation handling is missing');
ok(source.includes("e.key==='ArrowDown'"), 'ArrowDown navigation handling is missing');

ok(source.includes('function semanticParagraphState(edit)'), 'Beamer semantic paragraph state helper is missing');
ok(source.includes('function moveBeamerProseCaret(edit,dir)'), 'Beamer semantic paragraph arrow navigation is missing');
ok(source.includes("querySelectorAll('.texflow-paragraph-break')"), 'Beamer arrow navigation does not understand semantic Enter markers');
ok(source.includes('moveBeamerProseTarget(edit,dir)'), 'Beamer prose cannot cross separate editable blocks');
ok(source.includes('Do not let the browser reinterpret ArrowUp/ArrowDown as viewport scrolling.'), 'Beamer outer navigation edge can still fall through to viewport scrolling');
ok(source.includes('moveDocumentTextCaret(el,dir);\n   e.preventDefault();e.stopPropagation();'), 'document outer navigation edge can still fall through to viewport scrolling');
ok(source.includes('.main::-webkit-scrollbar-thumb'), 'main Visual scroller has no explicit draggable scrollbar thumb');
ok(source.includes('scrollbar-width:thin'), 'main Visual scroller has no Firefox/Electron scrollbar declaration');

ok(!source.includes('moveParagraphCaret(el,dir)'), 'obsolete paragraph-only navigation helper still exists');

console.log('PASS keyboard_navigation_runtime');

ok(source.includes('function bindVisualNavigationSpine(host)'), 'visual navigation spine is missing');
ok(source.includes("bindVisualNavigationSpine(host);"), 'visual navigation spine is not attached to document/frame views');
ok(source.includes("moveVisualEditableCaret(cell,1,el)"), 'document table cannot return the caret after its last row');
ok(source.includes("moveVisualEditableCaret(cell,-1,el)"), 'document table cannot return the caret before its first row');
ok(source.includes("moveVisualEditableCaret(cell,1,wrap)"), 'Beamer table cannot return the caret after its last row');
ok(source.includes("moveVisualEditableCaret(cell,-1,wrap)"), 'Beamer table cannot return the caret before its first row');
ok(source.includes("moveVisualEditableCaret(el,dir,el)"), 'semantic objects cannot return keyboard focus to editable text');

ok(source.includes('function currentVisualEditable(host)'), 'visual caret guard cannot detect a lost selection');
ok(source.includes('bindDocumentTextNavigation(edit);'), 'document list items are not part of keyboard navigation');

ok(source.includes('function moveVisualSelectionLine(host,edit,dir)'), 'central vertical caret controller is missing');
ok(source.includes("sel.modify('move',dir<0?'backward':'forward','line')"), 'vertical caret movement still relies on native ArrowUp/ArrowDown behavior');
ok(source.includes("e.preventDefault();e.stopPropagation();\n  moveVisualSelectionLine"), 'central controller does not suppress browser viewport scrolling');
ok(source.includes("},true);"), 'vertical controller is not installed in capture phase');
ok(source.includes("const edit=e.target&&e.target.closest?e.target.closest('[contenteditable=true]'):null;"), 'central vertical controller does not cover editable elements such as the Beamer title');
ok(source.includes("if(edit.matches('.doc-table-cell,.table-cell'))return;"), 'table same-column navigation is not preserved');
ok(!source.includes("if((e.key==='ArrowUp'||e.key==='ArrowDown')&&!e.shiftKey)"), 'obsolete Beamer prose vertical handler still competes with the central controller');

ok(
  source.includes('function flushSave(el,send){const old=saveTimers.get(el);if(old)clearTimeout(old);send(false);}'),
  'blur/focus save still requests a webview refresh and can destroy the caret'
);
ok(
  source.includes('Structural actions already request refresh explicitly with save(true).'),
  'caret-preservation rationale for non-refreshing blur saves is missing'
);
