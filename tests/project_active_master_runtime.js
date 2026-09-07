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
ok(source.includes('root = masterDocument'), 'temporary root compatibility alias is not explicit');
ok(source.includes('masterUri: project.masterDocument.uri.toString()'), 'webview payload lacks masterUri');
ok(source.includes('activeUri: project.activeDocument.uri.toString()'), 'webview payload lacks activeUri');

// Foundation deliberately keeps legacy root reads/writes in place until Build A.
// This makes the migration explicit rather than silently changing edit targets.
ok(source.includes('documentSource: project.root.getText()'), 'Foundation unexpectedly changed document-mode source semantics');

console.log('PASS project_active_master_runtime');
