#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function fail(message) { console.error(`FAIL build_c_runtime: ${message}`); process.exit(1); }
function ok(condition, message) { if (!condition) fail(message); }

const root = path.join(__dirname, '..');
const extension = fs.readFileSync(path.join(root, 'src', 'extension.ts'), 'utf8');
const blocksSource = fs.readFileSync(path.join(root, 'src', 'latex', 'blocks.ts'), 'utf8');
const typesSource = fs.readFileSync(path.join(root, 'src', 'latex', 'types.ts'), 'utf8');
const parserPath = path.join(root, 'out', 'latex', 'blocks.js');

ok(typesSource.includes("| 'tikz'"), 'ParsedBlock does not expose the TikZ semantic kind');
ok(typesSource.includes("commentTag?: 'TODO' | 'FIXME'"), 'TODO/FIXME comment metadata is missing');
ok(blocksSource.includes('tikzpicture'), 'shared parser does not detect tikzpicture');
ok(blocksSource.includes('commentTag'), 'shared parser does not classify TODO/FIXME comments');

ok(extension.includes('async function compileTikzPreview'), 'TikZ preview compiler is missing');
ok(extension.includes("type:'previewTikz'"), 'webview does not request TikZ preview');
ok(extension.includes("type:'openSourceRange'"), 'source-range navigation message is missing');
ok(extension.includes('function tikzCardHtml'), 'TikZ visual card is missing');
ok(extension.includes('function bindTikzCards'), 'TikZ visual actions are not bound');
ok(extension.includes("type:'updateTikzSource'"), 'TikZ inline source save message is missing');
ok(extension.includes('tikz-edit-button'), 'TikZ inline Edit control is missing');
ok(extension.includes('tikz-source-textarea'), 'TikZ inline source editor is missing');
ok(extension.includes('source:sourceText'), 'TikZ preview does not compile the current draft source');
ok(extension.includes("msg.type === 'updateTikzSource'"), 'TikZ host source update handler is missing');
ok(extension.includes("label:'TikZ figure…',action:'tikz'"), 'Insert menu does not expose TikZ figure');
ok(extension.includes("ensurePackage(project, 'tikz')"), 'TikZ insertion does not ensure the tikz package');
ok(extension.includes("type:'insertTikzFigure'"), 'TikZ insertion action is not routed through the dedicated Figure handler');
ok(extension.includes("msg.type === 'insertTikzFigure'"), 'dedicated TikZ Figure host handler is missing');
ok(extension.includes('focusTikzOffset'), 'new TikZ insertion is not focused for immediate editing');

ok(/msg.type === 'insertTikzFigure'[\s\S]{0,900}begin\{figure\}/.test(extension), 'TikZ insertion host handler is not wrapped as a Figure object');
ok(extension.includes("msg.type === 'wrapTikzAsFigure'"), 'bare TikZ pictures cannot be promoted safely to Figure objects');
ok(extension.includes('tikz-make-figure-button'), 'bare TikZ picture fallback does not expose Make figure');
ok(extension.includes("isTikz?'TikZ figure'"), 'TikZ figures do not expose Figure-style visual properties');
ok(/tikzMatch=\/.*tikzpicture/.test(extension), 'Figure rendering does not detect nested TikZ content');
ok(extension.includes("if(match){const existing="), 'Figure serialization still requires includegraphics and cannot preserve TikZ figures');

ok(extension.includes("label:'Note…',action:'note'"), 'Insert menu does not expose one compact Note object');
ok(extension.includes("['comment','Comment']"), 'Note dialog is missing Comment type');
ok(extension.includes("['todo','TODO']"), 'Note dialog is missing TODO type');
ok(extension.includes("['fixme','FIXME']"), 'Note dialog is missing FIXME type');
ok(extension.includes("['author','Author note']"), 'Note dialog is missing Author note type');
ok(extension.includes('id="comment-out-selection"'), 'Comment out selection was not moved to Edit');
ok(!extension.includes("label:'Source comment…'"), 'legacy Source comment menu item still exists');
ok(!extension.includes("label:'Author note…'"), 'legacy Author note menu item still exists');

ok(extension.includes('const duplicateBeamerFrame = async'), 'Beamer duplicate-frame operation is missing');
ok(extension.includes('const moveBeamerFrame = async'), 'Beamer move-frame operation is missing');
ok(extension.includes('const toggleBeamerFrameDisabled = async'), 'Beamer disable/restore operation is missing');
ok(extension.includes('TeXFlow disabled frame begin'), 'disabled-frame source marker is missing');
ok(extension.includes('Disabled frame · excluded from PDF'), 'disabled-frame visual state is missing');

ok(extension.includes('function beamerReviewItems'), 'projected Beamer comment navigation is missing');
ok(extension.includes("b.commentTag==='TODO'"), 'TODO marker rendering is missing');
ok(extension.includes("b.commentTag==='FIXME'"), 'FIXME marker rendering is missing');
ok(extension.includes("id=\"comment-prev\""), 'previous-comment control is missing');
ok(extension.includes("id=\"comment-next\""), 'next-comment control is missing');

ok(extension.includes('function currentVisualSourceLocation'), 'Visual → Source mapping is missing');
ok(extension.includes('function revealVisualSourceLocation'), 'Source → Visual mapping is missing');
ok(extension.includes('function switchViewMode'), 'location-aware view switching is missing');
ok(extension.includes('Visual here'), 'Source → Visual action is missing');
ok(extension.includes('Open in VS Code'), 'explicit source editor action is missing');

if (fs.existsSync(parserPath)) {
  const parser = require(parserPath);
  const tikz = String.raw`Before.\n\n\\begin{tikzpicture}\n\\draw (0,0) -- (1,1);\n\\end{tikzpicture}\n\nAfter.`.replace(/\\n/g, '\n');
  const parsed = parser.parseBlocks(tikz);
  const picture = parsed.find(x => x.kind === 'tikz');
  ok(picture, 'compiled shared parser does not return a TikZ block');
  ok(/\\begin\{tikzpicture\}/.test(picture.raw), 'TikZ raw source is not preserved');

  const review = parser.parseBlocks('% TODO verify this result\n\n% FIXME rewrite this sentence');
  const tags = review.filter(x => x.kind === 'comment').map(x => x.commentTag);
  ok(tags.includes('TODO'), 'TODO source comment is not classified');
  ok(tags.includes('FIXME'), 'FIXME source comment is not classified');
}

console.log('PASS build_c_runtime');
