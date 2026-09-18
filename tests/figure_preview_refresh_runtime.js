#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const extension = fs.readFileSync(path.join(root, 'src', 'extension.ts'), 'utf8');

assert(extension.includes('const initialWebviewResourceRoots = ['), 'webview resource roots must be explicit');
assert(extension.includes('let figurePreviewRevision = 0;'), 'figure preview revision counter missing');
assert(extension.includes('figurePreviewRevision++;'), 'Replace must invalidate the figure preview revision');
assert(extension.includes('function uriWithinWebviewRoots(resource: vscode.Uri, roots: vscode.Uri[]): boolean'), 'resource-root containment helper missing');
assert(extension.includes('async function figurePreviewUri('), 'figure preview URI resolver missing');
assert(extension.includes("return `data:${figureMimeType(extension)};base64,${Buffer.from(bytes).toString('base64')}`;"), 'external figures must use an embedded preview instead of a runtime root mutation');
assert(extension.includes('query: `v=${stat.mtime}-${stat.size}-${revision}`'), 'workspace figure previews must include metadata plus Replace revision');
assert(extension.includes('await panel.webview.postMessage({\n        type: \'document\','), 'document refresh must await webview delivery');
assert(extension.includes('object-src ${cspSource} data: blob:'), 'CSP must permit embedded PDF figure previews');
assert(!extension.includes('const registerWebviewResourceRoot = (resource: vscode.Uri) => {'), 'runtime localResourceRoots mutation must not be used');
assert(!extension.includes('localResourceRoots: [...webviewResourceRoots.values()]'), 'runtime localResourceRoots mutation must not be used');
assert(!extension.includes('workspace.fs.copy(original, target'), 'preview refresh must not reintroduce figure copying');

console.log('PASS figure_preview_refresh_runtime');
