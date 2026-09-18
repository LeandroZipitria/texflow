#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const extension = fs.readFileSync(path.join(root, 'src', 'extension.ts'), 'utf8');

assert(extension.includes('function figureLatexPathFromDocument'), 'shared figure-path helper missing');
assert(extension.includes('path.relative(rootDir, original.fsPath)'), 'figure path must be computed relative to the active .tex file');
assert(extension.includes("return value.replace(/\\\\/g, '/');"), 'figure path must be normalized for LaTeX');
assert(extension.includes('return { uri: original, latexPath: figureLatexPathFromDocument(rootDocument, original) };'), 'single-figure selection must preserve the chosen file location');
assert(extension.includes('out.push({uri:original,latexPath:figureLatexPathFromDocument(rootDocument,original)});'), 'multi-figure selection must preserve each chosen file location');
assert(!extension.includes('async function copyExternalFigureIntoProject'), 'figure selection must not copy external files into a project figures folder');
assert(!extension.includes("path.join(rootDir, 'figures')"), 'figure selection must not force a figures/ destination');
assert(!extension.includes('workspace.fs.copy(original, target'), 'figure selection must not silently copy the chosen image');
assert(!extension.includes('`${parsed.name}-${i++}${parsed.ext}`'), 'figure selection must not create suffixed duplicates');

console.log('PASS figure_import_path_runtime');
