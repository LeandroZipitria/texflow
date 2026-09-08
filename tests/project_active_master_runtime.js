#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const sourcePath = path.join(process.cwd(), 'src', 'extension.ts');

function fail(message) { console.error(`FAIL project_active_master_runtime: ${message}`); process.exit(1); }
function ok(condition, message) { if (!condition) fail(message); }

if (!fs.existsSync(sourcePath)) fail('src/extension.ts missing');
const source = fs.readFileSync(sourcePath, 'utf8');

ok(source.includes('masterDocument: vscode.TextDocument;'), 'ProjectModel.masterDocument missing');
ok(source.includes('activeDocument: vscode.TextDocument;'), 'ProjectModel.activeDocument missing');
ok(source.includes('const masterDocument = await findRootDocument(initial);'), 'loadProject does not resolve masterDocument explicitly');
ok(source.includes('const graph = await buildProjectIncludeGraph(masterDocument);'), 'include graph is not rooted at masterDocument');
ok(source.includes('const activeDocument = graph.documents.get(initial.uri.toString()) ?? initial;'), 'loadProject does not preserve the initially opened active document');
ok(!source.includes('root: vscode.TextDocument;'), 'deprecated ProjectModel.root property still exists');
ok(!source.includes('project.root'), 'deprecated project.root references still exist');
ok(source.includes('masterUri: project.masterDocument.uri.toString()'), 'webview payload lacks masterUri');
ok(source.includes('activeUri: project.activeDocument.uri.toString()'), 'webview payload lacks activeUri');

// Build A promotes activeDocument to the Visual document source while keeping
// masterDocument as the durable project/compile identity.
ok(source.includes('documentSource: project.activeDocument.getText()'), 'Build A Visual source is not activeDocument');
ok(source.includes('const requestedActive = refreshed.documents.get(activeUri.toString())'), 'refreshProject does not preserve activeDocument');
ok(source.includes('const pdfUri = await getPdfWebviewUri(project.masterDocument, panel.webview);'), 'PDF target is not masterDocument');

console.log('PASS project_active_master_runtime');
