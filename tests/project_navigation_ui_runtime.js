#!/usr/bin/env node
'use strict';
const fs = require('fs');
const source = fs.readFileSync('src/extension.ts', 'utf8');
function fail(message) { console.error(`FAIL project_navigation_ui_runtime: ${message}`); process.exit(1); }
function ok(condition, message) { if (!condition) fail(message); }

ok(source.includes('function renderProjectFileLinks(nav)'), 'Visual sidebar project-file renderer missing');
ok(source.includes("type:'openProjectDocument'"), 'project-file links do not request Visual document switching');
ok(source.includes("if (msg.type === 'openProjectDocument')"), 'host does not handle Visual project document switching');
ok(source.includes('project-file-link'), 'project file navigation styling missing');
ok(source.includes('Open in Visual</button>'), 'include card still describes Visual navigation as source navigation');
ok(source.includes("if(ref.classList.contains('missing')){openProjectIssues();return;}"), 'missing references still attempt navigation');
ok(source.includes("if(cite.classList.contains('missing')){openProjectIssues();return;}"), 'missing citations still attempt navigation');
ok(source.includes('Missing reference target: '), 'missing-reference tooltip missing');
ok(source.includes('Missing bibliography entry: '), 'missing-citation tooltip missing');
ok(source.includes('function inertLatexHtml(raw)'), 'commented-out block preview does not neutralize project links');
ok(source.includes('commented-source-token'), 'commented-out source tokens are not preserved as inert preview content');
console.log('PASS project_navigation_ui_runtime');
