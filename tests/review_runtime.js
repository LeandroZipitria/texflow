#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const extensionPath = path.join(__dirname, '..', 'src', 'extension.ts');

function fail(message) {
  console.error(`FAIL review_runtime: ${message}`);
  process.exit(1);
}

function ok(condition, message) {
  if (!condition) fail(message);
}

if (!fs.existsSync(extensionPath)) {
  fail(`missing ${extensionPath}`);
}

const source = fs.readFileSync(extensionPath, 'utf8');

function countLiteral(needle) {
  let count = 0;
  let offset = 0;
  while (true) {
    const at = source.indexOf(needle, offset);
    if (at < 0) return count;
    count += 1;
    offset = at + needle.length;
  }
}

function windowsAfter(needle, length = 24000) {
  const windows = [];
  let offset = 0;
  while (true) {
    const at = source.indexOf(needle, offset);
    if (at < 0) return windows;
    windows.push(source.slice(at, at + length));
    offset = at + needle.length;
  }
}

// ---------------------------------------------------------------------------
// Parser parity: TeXFlow currently has one host parser and one webview parser.
// Review support must exist in both. This regression test is intentionally
// explicit because a parser-parity bug previously broke comment environments.
// ---------------------------------------------------------------------------
const parserWindows = windowsAfter('function parseBlocks');
ok(parserWindows.length >= 2, 'expected host and webview parseBlocks implementations');

for (const [index, window] of parserWindows.entries()) {
  ok(
    window.includes('proof|comment') || window.includes('proof|comment)'),
    `parseBlocks #${index + 1} does not tokenize the comment environment`
  );
  ok(
    window.includes("'commentblock'"),
    `parseBlocks #${index + 1} does not emit commentblock nodes`
  );
  ok(
    window.includes("'comment'"),
    `parseBlocks #${index + 1} does not emit source-comment nodes`
  );
}

// Project-wide include discovery must ignore both % comments and content inside
// \begin{comment}...\end{comment}.
const includeMaskAt = source.indexOf('function stripLatexCommentsForIncludes');
ok(includeMaskAt >= 0, 'stripLatexCommentsForIncludes is missing');
const includeMaskWindow = source.slice(includeMaskAt, includeMaskAt + 7000);
ok(
  includeMaskWindow.includes('const envToken = /\\\\(begin|end)\\{comment\\}/g;'),
  'comment environments are not masked before include discovery'
);

// ---------------------------------------------------------------------------
// Creation and conversion.
// ---------------------------------------------------------------------------
ok(source.includes('Comments & notes'), 'Insert → Comments & notes is missing');
ok(source.includes('Comment out selection'), 'Comment out selection command is missing');
ok(source.includes('lastVisualSelection'), 'visual text selection is not persisted across menu focus changes');
ok(source.includes('function commentOutSelectedText()'), 'commentOutSelectedText implementation is missing');
ok(source.includes("editable.__texflowCommit(replacement,'commentenv')"), 'selection conversion is not saved as a comment environment');

// A generated Beamer comment environment must make the frame fragile so the
// comment package remains compilable inside normal frames.
ok(source.includes('async function ensureBeamerFrameFragile'), 'Beamer fragile-frame safeguard is missing');
ok(source.includes("if (feature === 'commentenv')"), 'commentenv host handling is missing');
ok(source.includes('await ensureBeamerFrameFragile(ctx.document, ctx.frame)'), 'Beamer comment insertion does not invoke the fragile-frame safeguard');
ok(source.includes("await ensurePackage(project, 'comment')"), 'comment package auto-insertion is missing');

// ---------------------------------------------------------------------------
// Presentation model: comments are markers, not document/slide content.
// ---------------------------------------------------------------------------
ok(source.includes('.comment-anchor{position:relative;height:0!important'), 'comment anchors can still consume document height');
ok(source.includes('.comment-marker{position:absolute'), 'compact C marker is missing');
ok(source.includes('>C</button>') || source.includes(">C</button>'"), 'C marker rendering is missing');

ok(source.includes('.comment-inspector{position:fixed'), 'comment inspector is not outside document flow');
ok(source.includes('bottom:0'), 'comment inspector is not anchored at the bottom');
ok(source.includes('transform:translateY(102%)'), 'comment inspector is not implemented as a bottom drawer');
ok(source.includes('body.comment-inspector-open .comment-inspector{transform:translateY(0)}'), 'bottom drawer open state is missing');
ok(source.includes('function openDocumentCommentInspector'), 'document comment inspector is missing');
ok(source.includes('function openFrameCommentInspector'), 'Beamer comment inspector is missing');

// View controls belong under View; there should be no top-level Review menu.
ok(source.includes('id="view-source-comments"'), 'View → Show source comments is missing');
ok(source.includes('id="view-author-notes"'), 'View → Show author notes is missing');
ok(source.includes('id="view-comment-blocks"'), 'View → Show commented-out blocks is missing');
ok(!source.includes('id="review-menu"'), 'obsolete top-level Review menu still exists');

// Visual hide and source deletion must remain distinct operations.
ok(source.includes('function inspectorHideComment'), 'visual-only Hide marker action is missing');
const hideAt = source.indexOf('function inspectorHideComment');
const hideWindow = source.slice(hideAt, hideAt + 700);
ok(hideWindow.includes('reviewHiddenItems.add'), 'Hide marker does not use visual-only hidden state');
ok(!hideWindow.includes("type:'deleteReview"), 'Hide marker is incorrectly wired to source deletion');

ok(source.includes("type:'deleteReviewDocumentNode'"), 'document Delete source action is missing');
ok(source.includes("type:'deleteReviewBlock'"), 'Beamer Delete source action is missing');
ok(source.includes('Delete this review item from the LaTeX source?'), 'Delete source confirmation is missing');

// Commented-out blocks should retain their visual preview in the drawer.
ok(source.includes('function commentedBlockPreviewHtml'), 'commented-out visual preview helper is missing');
ok(source.includes('commented-preview'), 'commented-out preview is not rendered in the inspector');

console.log('PASS review_runtime');
