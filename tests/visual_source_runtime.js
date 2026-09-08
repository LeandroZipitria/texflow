#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function fail(message) { console.error(`FAIL visual_source_runtime: ${message}`); process.exit(1); }
function ok(condition, message) { if (!condition) fail(message); }

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'extension.ts'), 'utf8');

ok(source.includes("let sourceFocus={uri:'',offset:0,end:0,target:''}"), 'source focus state is missing');
ok(source.includes('function currentVisualSourceLocation'), 'Visual source-location resolver is missing');
ok(source.includes('function frameBodySourceStart'), 'Beamer body offset mapping is missing');
ok(source.includes('function currentSourceCaretLocation'), 'Source caret resolver is missing');
ok(source.includes('function focusSourceTextarea'), 'Source caret focus helper is missing');
ok(source.includes('function revealVisualSourceLocation'), 'Visual reveal helper is missing');
ok(source.includes('function switchViewMode'), 'view mode switch does not preserve source location');
ok(source.includes('source-visual-here'), 'Visual here source action is missing');
ok(source.includes('source-open-vscode'), 'Open in VS Code source action is missing');
ok(source.includes("data.dirty==='1'" ) || source.includes("dataset.dirty==='1'"), 'unsaved Source guard is missing');
ok(source.includes("preferVisual:true"), 'cross-file Visual navigation is missing');
ok(source.includes("focusDocumentSourceOffset(start)"), 'document source-to-visual mapping is missing');
ok(source.includes("parseBlocks(f.body||'').find"), 'Beamer source-to-block mapping is missing');

console.log('PASS visual_source_runtime');
