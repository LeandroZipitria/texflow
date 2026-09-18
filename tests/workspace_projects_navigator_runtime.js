#!/usr/bin/env node
'use strict';
const fs = require('fs');
const src = fs.readFileSync('src/extension.ts', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
function ok(value, message) { if (!value) { console.error(`FAIL workspace_projects_navigator_runtime: ${message}`); process.exit(1); } }
const views = (((pkg.contributes || {}).views || {}).texflow || []);
const projectView = views.find(v => v.id === 'texflow.projectView');
ok(projectView && projectView.name === 'Projects', 'TeXFlow project view must be workspace-level Projects');
ok(src.includes('private workspaceRoots(): vscode.Uri[]'), 'workspace root discovery missing');
ok(src.includes('private navigatorRoots(): vscode.Uri[]'), 'workspace/project fallback roots missing');
ok(src.includes('vscode.workspace.workspaceFolders ?? []'), 'VS Code workspace folders are not used');
ok(src.includes("item.description = 'active project'"), 'active project marker missing');
ok(src.includes('Folder contents are loaded only when the user expands them'), 'lazy workspace folder navigation missing');
ok(!src.includes("if (!commonResourceFolder && !(await this.folderContainsRelevantFiles(child))) continue;"), 'navigator still recursively filters sibling folders before expansion');
ok(src.includes("await vscode.commands.executeCommand('texflow.openVisualEditor', uri);"), 'tex files in Projects do not open in TeXFlow');
console.log('PASS workspace_projects_navigator_runtime');
