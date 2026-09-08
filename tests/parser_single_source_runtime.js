#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const extensionPath = path.join(repoRoot, 'src', 'extension.ts');
const blocksSourcePath = path.join(repoRoot, 'src', 'latex', 'blocks.ts');
const blocksOutPath = path.join(repoRoot, 'out', 'latex', 'blocks.js');

function fail(message) { console.error(`FAIL parser_single_source_runtime: ${message}`); process.exit(1); }
function ok(condition, message) { if (!condition) fail(message); }

ok(fs.existsSync(extensionPath), 'src/extension.ts missing');
ok(fs.existsSync(blocksSourcePath), 'src/latex/blocks.ts missing');
ok(fs.existsSync(blocksOutPath), 'out/latex/blocks.js missing; run compile first');

const extension = fs.readFileSync(extensionPath, 'utf8');
const blocksSource = fs.readFileSync(blocksSourcePath, 'utf8');
const parser = require(blocksOutPath);

ok(extension.includes("import { parseBlocks, webviewParserRuntimeSource } from './latex/blocks';"), 'shared parser import missing');
ok(extension.includes('${webviewParserRuntimeSource()}'), 'shared parser webview injection missing');
ok(!extension.includes('function parseFigureData('), 'old host figure parser remains in extension.ts');
ok(!extension.includes('function parseTableData('), 'old host table parser remains in extension.ts');
ok(!extension.includes('function figureData(raw){'), 'old webview figure parser remains in extension.ts');
ok(!extension.includes('function tableData(raw){'), 'old webview table parser remains in extension.ts');
ok(!extension.includes('function parseBlocks(body){'), 'old webview parseBlocks remains in extension.ts');
ok(blocksSource.includes('export function parseBlocks'), 'shared parseBlocks export missing');
ok(blocksSource.includes('export function webviewParserRuntimeSource'), 'runtime generator missing');

const fakeComment = '\\begin{comment}\n\\label{fake:label}\n\\input{fake-file}\n\\end{comment}\n\nVisible text.';
const blocks = parser.parseBlocks(fakeComment);
ok(blocks.length === 2, 'comment block + visible paragraph should produce two blocks');
ok(blocks[0].kind === 'commentblock', 'comment environment must remain one semantic comment block');
ok(blocks[1].kind === 'paragraph', 'visible text after comment block must remain a paragraph');

const sourceComments = parser.parseBlocks('% divider\n% TeXFlow note: note text\n\nVisible.');
ok(sourceComments.some(x => x.kind === 'comment'), 'source comment parsing missing');
ok(sourceComments.some(x => x.kind === 'paragraph'), 'prose after source comments missing');

const taggedComments = parser.parseBlocks('% TODO verify estimate\n\n% FIXME rewrite paragraph');
ok(taggedComments.some(x => x.kind === 'comment' && x.commentTag === 'TODO'), 'TODO comment classification missing');
ok(taggedComments.some(x => x.kind === 'comment' && x.commentTag === 'FIXME'), 'FIXME comment classification missing');

const tikzSource = '\\begin{tikzpicture}\n\\draw (0,0) -- (1,1);\n\\end{tikzpicture}';
const tikzBlocks = parser.parseBlocks(tikzSource);
ok(tikzBlocks.length === 1 && tikzBlocks[0].kind === 'tikz', 'tikzpicture must remain one semantic TikZ block');
ok(tikzBlocks[0].raw === tikzSource, 'TikZ source must round-trip exactly through the parser');

console.log('PASS parser_single_source_runtime');
