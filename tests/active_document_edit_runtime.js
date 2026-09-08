#!/usr/bin/env node
'use strict';
const fs = require('fs');
const source = fs.readFileSync('src/extension.ts','utf8');
function fail(message) { console.error(`FAIL active_document_edit_runtime: ${message}`); process.exit(1); }
function ok(condition, message) { if (!condition) fail(message); }
ok(source.includes('documentSource: project.activeDocument.getText()'), 'Visual documentSource is not activeDocument');
ok(source.includes('const requestedActive = refreshed.documents.get(activeUri.toString())'), 'refresh does not preserve active document');
ok(source.includes('else activeUri = refreshed.masterDocument.uri;'), 'refresh lacks master fallback');
ok(source.includes("await vscode.commands.executeCommand('texflow.openVisualEditor', uri);"), 'Project Navigator does not open included tex in Visual');
ok(source.includes("const doc = project.activeDocument;"), 'document-mode insertion does not use active document');
ok(source.includes('await applyReplacement(project.activeDocument, 0, expected.length, replacement)'), 'whole-document replacement is not active-targeted');
ok(source.includes('const pdfUri = await getPdfWebviewUri(project.masterDocument, panel.webview);'), 'PDF target is not master');
ok(source.includes('await compileDocument(rootUri, panel);'), 'compile no longer uses durable master URI');
ok(source.includes("const hasDocumentEnvironment = begin >= 0 && explicitEnd >= begin;"), 'find/replace fragment support missing');
ok(source.includes("projectIncludes.find(r=>r.sourceUri===activeUri"), 'include cards are not resolved relative to active document');
console.log('PASS active_document_edit_runtime');
