#!/usr/bin/env node
'use strict';
const fs = require('fs');
const src = fs.readFileSync('src/extension.ts', 'utf8');
function ok(value, message) { if (!value) { console.error(`FAIL block_insert_anchor_runtime: ${message}`); process.exit(1); } }
ok(src.includes('const insertDocumentBlockAtAnchor = async'), 'host structural insertion helper missing');
ok(src.includes('await documentEditQueue;'), 'block insertion does not wait for pending Visual autosaves');
ok(src.includes('const replacement = [before, block, after]'), 'paragraph split insertion missing');
ok(src.includes('place the cursor where you want to insert the object and try again'), 'lost anchors still fall back silently');
ok(src.includes('function captureBlockInsertionAnchor('), 'webview block-anchor capture missing');
ok(src.includes("rangePartLatex(editable,range,'before')"), 'paragraph prefix is not captured');
ok(src.includes("rangePartLatex(editable,range,'after')"), 'paragraph suffix is not captured');
ok(src.includes('expected=paragraphSource(node,editableLatex(editable))'), 'block anchor does not track the latest queued paragraph source');
ok(src.includes('insertAnchor:state.insertAnchor'), 'configured figures do not retain their insertion anchor');
ok(src.includes("insertAnchor:a&&a.blockInsertAnchor||captureBlockInsertionAnchor(a)"), 'table/raw dialog insertion anchor missing');
ok(src.includes("insertAnchor:captureBlockInsertionAnchor(anchor),latex:raw"), 'direct table paste insertion anchor missing');
ok(src.includes("insertAnchor:captureBlockInsertionAnchor(anchor)});}"), 'direct figure/TikZ insertion anchor missing');
console.log('PASS block_insert_anchor_runtime');
