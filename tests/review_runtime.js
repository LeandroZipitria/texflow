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
// Parser architecture: Review now relies on one shared parser source used by
// the Extension Host and injected into the webview runtime.
// ---------------------------------------------------------------------------
ok(source.includes("from './latex/blocks'"), 'shared parser import is missing');
ok(source.includes('${webviewParserRuntimeSource()}'), 'shared parser is not injected into the webview');
ok(!source.includes('function parseBlocks(body){'), 'legacy webview parseBlocks still exists');
ok(!source.includes('function parseBlocks(body: string)'), 'legacy host parseBlocks still exists');

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


// Beamer prose editors must support comment-out selection immediately, including
// the initially empty frame body and the trailing "Continue typing" editor.
// They must also forward the semantic feature so the host can prepare the
// comment package / fragile frame before writing a comment environment.
ok(source.includes("empty.__texflowCommentOutSupported=true"), 'empty Beamer frame body cannot be commented out before blur');
ok(source.includes("trailing.__texflowCommentOutSupported=true"), 'trailing Beamer paragraph cannot be commented out before blur');
ok(source.includes("type:'updateEmptyFrameBody',frameIndex:i,text,refresh:true,feature"), 'empty-frame comment conversion does not forward the feature');
ok(source.includes("type:'updateTrailingParagraph',frameIndex:i,previous:saved,text,refresh:true,feature"), 'trailing-paragraph comment conversion does not forward the feature');
ok(source.includes('prepareBeamerCommentEnvironment'), 'shared Beamer comment-environment preparation helper is missing');

// Plain Enter in Beamer prose must be handled semantically rather than allowing
// Chromium to accumulate transient DIV paragraph nodes that can temporarily
// create blank lines and false slide overflow.
ok(source.includes('function bindBeamerProseEnter'), 'semantic Beamer Enter handler is missing');
ok(source.includes("if(e.key!=='Enter')return;"), 'Beamer Enter is not intercepted');
ok(source.includes('bindBeamerProseEnter(empty,i)'), 'empty Beamer body does not use semantic Enter handling');
ok(source.includes('bindBeamerProseEnter(trailing,i)'), 'trailing Beamer paragraph does not use semantic Enter handling');
ok(source.includes('bindBeamerProseEnter(e,fi,b.id)'), 'regular Beamer paragraphs do not use semantic Enter handling');
ok(source.includes('function insertSemanticParagraphBreak(edit)'), 'Beamer prose Enter lacks an in-place semantic paragraph break');
ok(source.includes("className='texflow-paragraph-break'"), 'semantic paragraph marker is missing');
ok(source.includes("contains('texflow-paragraph-break'))return TEX_PARAGRAPH_BREAK"), 'semantic paragraph marker does not serialize to a LaTeX paragraph break');
ok(source.includes("if(insertSemanticParagraphBreak(edit))edit.dispatchEvent(new Event('input',{bubbles:true}))"), 'Beamer Enter does not keep editing local before autosave');
ok(source.includes('.slide .block.paragraph>.editable:focus'), 'plain Beamer paragraph focus is not scoped for minimal UI');
ok(source.includes("wrap.classList.add('paragraph')"), 'parsed Beamer paragraphs are not tagged for minimal prose focus styling');
ok(source.includes('.slide .trailing-paragraph:focus'), 'trailing Beamer paragraph focus is not minimal');
ok(source.includes('.slide .empty-frame-body:focus'), 'empty Beamer frame focus is not minimal');
ok(source.includes('background:transparent;'), 'minimal Beamer prose focus does not remove field-style background');
ok(!source.includes('pendingBeamerEnterFocus'), 'obsolete post-render Beamer caret workaround still exists');


// ---------------------------------------------------------------------------
// Presentation model: comments are markers, not document/slide content.
// ---------------------------------------------------------------------------
ok(source.includes('.comment-anchor{position:relative;height:0!important'), 'comment anchors can still consume document height');
ok(source.includes('.comment-marker{position:absolute'), 'compact C marker is missing');
ok(source.includes("const glyph=kind==='todo'?'T':kind==='fixme'?'F':'C'"), 'C/T/F marker rendering is missing');

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
