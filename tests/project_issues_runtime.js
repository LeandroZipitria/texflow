#!/usr/bin/env node
'use strict';
const fs = require('fs');
const source = fs.readFileSync('src/extension.ts','utf8');
function fail(message) { console.error(`FAIL project_issues_runtime: ${message}`); process.exit(1); }
function ok(condition, message) { if (!condition) fail(message); }
ok(source.includes('id="project-issues-button">Project Issues</button>'), 'View → Project Issues missing');
ok(source.includes('function renderProjectIssues()'), 'Project Issues renderer missing');
ok(source.includes("type:'navigateProjectLocation'"), 'Project Issues navigation missing');
ok(source.includes('projectIssues: intelligence.issues'), 'webview payload lacks typed project issues');
console.log('PASS project_issues_runtime');
