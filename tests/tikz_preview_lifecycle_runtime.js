#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function fail(message) { console.error(`FAIL tikz_preview_lifecycle_runtime: ${message}`); process.exit(1); }
function ok(condition, message) { if (!condition) fail(message); }

const root = path.join(__dirname, '..');
const extension = fs.readFileSync(path.join(root, 'src', 'extension.ts'), 'utf8');
const lifecycle = fs.readFileSync(path.join(root, 'src', 'tikzPreviewSession.ts'), 'utf8');

ok(extension.includes('const tikzPreviewSession = new TikzPreviewSession();'), 'Visual sessions do not own a TikZ preview session');
ok(extension.includes('compileTikzPreview(project, source, tikzPreviewSession)'), 'TikZ preview compiler does not use the current session');
ok(extension.includes('tikzPreviewSession.trackPdf(pdf)'), 'compiled preview PDF is not tracked by its session');
ok(extension.includes('tikzPreviewSession.disposeWhenSafe()'), 'panel disposal does not request temporary cleanup');
ok(extension.includes('cleanupAbandonedTikzPreviewSessions(output)'), 'activation does not clean abandoned TeXFlow preview directories');

ok(lifecycle.includes("owner: 'texflow-tikz-preview'"), 'temporary directories do not carry a TeXFlow ownership marker');
ok(lifecycle.includes("/^session-\\d+-\\d+-[0-9a-f-]+$/i"), 'session cleanup is not restricted to the TeXFlow session naming scheme');
ok(lifecycle.includes("/^[0-9a-f]{16}$/i"), 'legacy Build C cleanup is not restricted to the historical digest naming scheme');
ok(lifecycle.includes('isProcessRunning(marker.pid)'), 'startup cleanup does not preserve live extension-host sessions');
ok(lifecycle.includes('tabReferencesUri'), 'cleanup does not inspect open VS Code tabs');
ok(lifecycle.includes('tabReferencesDirectory'), 'startup cleanup does not protect restored preview tabs');
ok(lifecycle.includes('this.hasOpenPreviewPdf()'), 'session cleanup does not defer while a preview PDF remains open');
ok(lifecycle.includes('this.activeOperations > 0'), 'session cleanup can race an active preview operation');

console.log('PASS tikz_preview_lifecycle_runtime');
