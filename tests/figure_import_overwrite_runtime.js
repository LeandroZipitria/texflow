#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const extension = fs.readFileSync(path.join(root, 'src', 'extension.ts'), 'utf8');

assert(extension.includes('async function copyExternalFigureIntoProject'), 'shared external-figure import helper missing');
assert(extension.includes("path.join(rootDir, 'figures')"), 'external figures must still be copied into the project figures folder');
assert(extension.includes('path.basename(original.fsPath)'), 'import target must keep the original file name');
assert(extension.includes('await vscode.workspace.fs.stat(target);'), 're-import must detect an existing project copy');
assert(extension.includes("await vscode.workspace.fs.delete(target, { recursive: false, useTrash: false });"), 'existing project copy must be removed before copying');
assert(extension.includes("error.code !== 'FileNotFound'"), 'missing target must be the only ignored delete/stat condition');
assert(extension.includes('vscode.workspace.fs.copy(original, target, { overwrite: true })'), 'copy should retain overwrite semantics after explicit replacement');
assert(!extension.includes('{ overwrite: false }'), 'figure import must not preserve the old non-overwrite behavior');
assert(!extension.includes('`${parsed.name}-${i++}${parsed.ext}`'), 'figure import must not create -2/-3 suffixed duplicates');
assert(extension.includes('return copyExternalFigureIntoProject(rootDir, original);'), 'single-figure import must use shared replacement semantics');
assert(extension.includes('out.push(await copyExternalFigureIntoProject(rootDir,original));continue;'), 'multi-figure import must use shared replacement semantics');

console.log('PASS figure_import_overwrite_runtime');
