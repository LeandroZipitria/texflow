#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const extension = fs.readFileSync(path.join(root, 'src', 'extension.ts'), 'utf8');
const blocksSource = fs.readFileSync(path.join(root, 'src', 'latex', 'blocks.ts'), 'utf8');
const typesSource = fs.readFileSync(path.join(root, 'src', 'latex', 'types.ts'), 'utf8');

function extract(startMarker, endMarker) {
  const start = extension.indexOf(startMarker);
  assert(start >= 0, `${startMarker} not found`);
  const end = extension.indexOf(endMarker, start);
  assert(end > start, `${endMarker} not found after ${startMarker}`);
  return extension.slice(start, end);
}

// 1. Included-file paths are project-relative, portable, and generate canonical LaTeX.
{
  let helper = extract('function normalizeIncludedTexPath', 'async function setDocumentCommand');
  helper = helper
    .replace('function normalizeIncludedTexPath(value: string): string | undefined', 'function normalizeIncludedTexPath(value)')
    .replace('function normalizeExistingIncludedTexPath(value: string): string | undefined', 'function normalizeExistingIncludedTexPath(value)')
    .replace('function includedLatexTarget(texPath: string): string', 'function includedLatexTarget(texPath)')
    .replace("function includedFileLatex(command: 'input' | 'include', texPath: string): string", 'function includedFileLatex(command, texPath)');
  const sandbox = {};
  vm.runInNewContext(helper + '\nthis.normalizeIncludedTexPath=normalizeIncludedTexPath;this.normalizeExistingIncludedTexPath=normalizeExistingIncludedTexPath;this.includedFileLatex=includedFileLatex;', sandbox);

  assert.strictEqual(sandbox.normalizeIncludedTexPath('sections/model'), 'sections/model.tex');
  assert.strictEqual(sandbox.normalizeIncludedTexPath('./sections/model.tex'), 'sections/model.tex');
  assert.strictEqual(sandbox.normalizeIncludedTexPath('sections\\model.tex'), 'sections/model.tex');
  assert.strictEqual(sandbox.normalizeIncludedTexPath('sections/'), undefined, 'a folder alone is not an included .tex file');
  assert.strictEqual(sandbox.normalizeIncludedTexPath('../outside.tex'), undefined);
  assert.strictEqual(sandbox.normalizeIncludedTexPath('/tmp/outside.tex'), undefined);
  assert.strictEqual(sandbox.normalizeIncludedTexPath('C:/outside.tex'), undefined);
  assert.strictEqual(sandbox.normalizeIncludedTexPath('sections/{bad}.tex'), undefined);
  assert.strictEqual(sandbox.normalizeExistingIncludedTexPath('../shared/model.tex'), '../shared/model.tex');
  assert.strictEqual(sandbox.includedFileLatex('input', 'sections/model.tex'), String.raw`\input{sections/model}`);
  assert.strictEqual(sandbox.includedFileLatex('include', 'chapters/results.tex'), String.raw`\include{chapters/results}`);
}

// 2. Multi-file creation is exposed only where it is supported and is safe by default.
{
  assert(extension.includes("{label:'Included file…',action:'includedfile',when:!isBeamer}"), 'Insert menu must expose Included file only for standard documents');
  assert(extension.includes("msg.type === 'insertIncludedFile'"), 'included-file host handler missing');
  assert(extension.includes("function openIncludedFileDialog()"), 'Included file must open inside TeXFlow');
  assert(extension.includes("Create new .tex file"), 'create-new included file choice missing');
  assert(extension.includes("Use existing .tex file"), 'use-existing included file choice missing');
  assert(extension.includes("type:'chooseIncludedFile'"), 'existing file should use only the native file chooser');
  assert(extension.includes("The file was not overwritten"), 'existing files must not be overwritten silently');
  assert(extension.includes("Folder (optional)"), 'new-file workflow must separate folder from file name');
  assert(extension.includes("a file cannot include itself"), 'self-include guard missing');
  assert(extension.includes("an included file cannot include the master document"), 'included-file to master cycle guard missing');
  assert(extension.includes("activeUri = opened.uri;"), 'new/existing include must open in Visual after insertion');
  assert(extension.includes("type:'openIncludedSourceText'"), 'include card Source action missing');
  assert(extension.includes('doc-include-actions'), 'include card action layout missing');
  assert(extension.includes("if(node.kind==='include'||node.kind==='toc')return !isDocumentReviewNode(next)&&!nextIsParagraph;"), 'included files and TOC need a writing slot so the document can continue after them');

  const handlerStart = extension.indexOf("if (msg.type === 'insertIncludedFile')");
  const handlerEnd = extension.indexOf("if (msg.type === 'insertFrame')", handlerStart);
  const handler = extension.slice(handlerStart, handlerEnd);
  assert(!handler.includes('showQuickPick'), 'included-file LaTeX decisions must stay inside TeXFlow');
  assert(!handler.includes('showInputBox'), 'included-file names must be entered inside TeXFlow');
  assert(handler.includes('normalizeExistingIncludedTexPath'), 'existing external .tex paths should be representable');
  assert(extension.includes("host.querySelectorAll('.doc-include[data-node-id]').forEach"), 'include cards must use semantic object selection');
  assert(extension.includes("del.title='Remove from document'"), 'include semantic delete must mean Remove from document');
}

// 3. Abstract is a real shared-parser block and round-trips through the Visual serializer.
{
  assert(typesSource.includes("| 'abstract'"), 'ParsedBlock abstract kind missing');
  assert(blocksSource.includes('|abstract|'), 'shared parser does not recognize abstract');
  assert(extension.includes("if(b.kind==='abstract')return '\\\\begin{abstract}"), 'Visual abstract serializer missing');
  assert(extension.includes("if (block.kind === 'abstract')"), 'host abstract serializer missing');
  assert(extension.includes("b.kind==='abstract'?'Abstract'"), 'abstract visual label missing');

  const parserPath = path.join(root, 'out', 'latex', 'blocks.js');
  assert(fs.existsSync(parserPath), 'compiled parser missing; run npm run compile before this test');
  delete require.cache[require.resolve(parserPath)];
  const { parseBlocks } = require(parserPath);
  const parsed = parseBlocks(String.raw`\begin{abstract}
A short abstract with $x$ preserved.
\end{abstract}`);
  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].kind, 'abstract');
  assert.strictEqual(parsed[0].env, 'abstract');
  assert.match(parsed[0].text, /A short abstract/);
  assert.match(parsed[0].raw, /^\\begin\{abstract\}/);

  const serializeSource = extract('function serializeRichDocumentBlock', 'function bindDocumentRichBlock');
  const sandbox = {};
  vm.runInNewContext(serializeSource + '\nthis.serializeRichDocumentBlock=serializeRichDocumentBlock;', sandbox);
  const node = { raw: '', block: { kind: 'abstract', env: 'abstract', text: 'Old' } };
  assert.strictEqual(
    sandbox.serializeRichDocumentBlock(node, 'New abstract'),
    String.raw`\begin{abstract}
New abstract
\end{abstract}`
  );

  const unknown = parseBlocks(String.raw`\begin{madeupenv}
Keep me exactly.
\end{madeupenv}`);
  assert.strictEqual(unknown[0].kind, 'raw', 'unknown environments must remain conservatively preserved');
}

// 4. The table of contents can be created without regressing the v0.20 visual rendering.
{
  assert(extension.includes("{label:'Table of contents',action:'toc',when:!isBeamer}"), 'Structure menu must expose Table of contents');
  assert(extension.includes("type:'insertTableOfContents'"), 'webview TOC action missing');
  assert(extension.includes("msg.type === 'insertTableOfContents'"), 'host TOC handler missing');
  assert(extension.includes(String.raw`[...project.documents.values()].find(candidate => /\\tableofcontents\b/.test(candidate.getText()))`), 'TOC duplicate guard must be project-wide');
  assert(extension.includes("activeUri = existingToc.uri;"), 'existing project TOC should open the file that contains it');
  assert(extension.includes("type: 'focusTableOfContents'"), 'existing TOC should be focused after navigation');
  assert(extension.includes("function documentTocHtml(flow){"), 'TOC must keep the established v0.20 renderer');
  assert(extension.includes("if(x.kind==='toc'){html+=documentTocHtml(flow);"), 'Existing TOC nodes must use the established visual renderer');
  assert(!extension.includes("host.querySelectorAll('.doc-toc[data-node-id]').forEach"), 'TOC must not be converted into a new semantic/delete card in 0.20.1');
  assert(extension.includes(String.raw`'\n\n\\tableofcontents\n\n'`), 'TOC insertion must use canonical LaTeX');
}

// 5. Beamer must not advertise an unsupported visual label action.
{
  assert(extension.includes("{label:'Add label to selected object…',action:'label',when:!isBeamer}"), 'unsupported Beamer Add label action is still visible');
  assert(!extension.includes('TeXFlow 0.11.3'), 'stale version-specific Beamer label warning remains');
}

// 6. A newly-created empty include must still expose an editable Visual paragraph.
{
  assert(extension.includes("if(!out.length)out.push({kind:'block'"), 'empty active files need a synthetic Visual paragraph');
  assert(extension.includes("id:'doc-empty',kind:'paragraph'"), 'empty-file Visual paragraph is missing');
}

// 7. Sidebar resize uses the real sidebar edge and stays below menus.
{
  assert(extension.includes('border-right:1px solid var(--line)'), 'sidebar itself must draw the visible divider');
  assert(extension.includes('.side-resizer{position:fixed;top:48px;bottom:0;left:calc(var(--sidebar) - 4px);width:8px;z-index:55;'), 'resize hitbox must straddle the real sidebar edge');
  assert(!extension.includes('.side-resizer::after{content:""'), 'resize handle must not draw a second divider');
  assert(extension.includes('z-index:420;isolation:isolate'), 'top menus must render above the resize handle');
  assert(extension.includes('sidebar-resizer-hover'), 'sidebar edge should highlight only while resize is discoverable/active');
}

// 8. Document-level creation stays inside the Visual surface.
{
  assert(extension.includes("type:'ensureMetadataField'"), 'Title/Author must be created inline in Visual');
  assert(extension.includes('doc-metadata-edit doc-title-heading'), 'metadata must render as an editable Visual title field');
  assert(!extension.includes("showInputBox({ prompt: label"), 'Title/Author must not invoke the VS Code input box');
  assert(!extension.includes("showInputBox({ prompt: 'Abstract text'"), 'Abstract must not invoke the VS Code input box');
  assert(extension.includes("focusAbstract"), 'new Abstract must focus its Visual editor');
  assert(extension.includes('doc-before-first-slot'), 'documents need a writing point before the first structural object');
}

// 9. Beamer empty-paragraph navigation is explicit and does not reuse Start-typing placeholders.
{
  assert(extension.includes('function removeEmptyBeamerParagraphHost'), 'Beamer empty paragraph caret fix missing');
  assert(extension.includes("edit.classList.contains('trailing-paragraph')||edit.classList.contains('empty-frame-body')"), 'Start typing/trailing placeholders must be protected');
  assert(extension.includes("e.key==='Backspace'||e.key==='Delete'"), 'Backspace/Delete handling missing for empty Beamer prose');
  assert(extension.includes('function removeSemanticBreakAtEmptySegment'), 'empty semantic paragraph breaks must be mergeable');
}



// 10. TOC, title, and typing regressions: preserve validated structure while keeping typing lightweight.
{
  assert(extension.includes("if(node.kind==='include'||node.kind==='toc')return !isDocumentReviewNode(next)&&!nextIsParagraph;"), 'TOC must expose a writing slot before the following structural object');
  assert(extension.includes("if(x.kind==='toc'){html+=documentTocHtml(flow);if(documentNodeNeedsParagraphSlot(flow,i))html+=documentAfterBlockSlotHtml(x);return;}"), 'TOC renderer must actually append its post-object writing slot');
  assert(extension.includes("if(x.kind==='include'){html+=documentIncludeHtml(x);if(documentNodeNeedsParagraphSlot(flow,i))html+=documentAfterBlockSlotHtml(x);return;}"), 'included-file renderer must actually append its post-object writing slot');
  assert(extension.includes("if(!ref&&node.kind==='toc'&&slot.previousElementSibling&&slot.previousElementSibling.classList.contains('doc-toc'))ref=slot.previousElementSibling"), 'TOC post-object writing slot must anchor to the established TOC renderer');
  assert(extension.includes(".doc-include.texflow-semantic-block>.semantic-delete{position:absolute!important;right:-9px!important;top:-11px!important"), 'include remove control must occupy the standard top-right semantic-object position');

  // A Title created from Visual must remain a real LaTeX title, not only metadata
  // visible inside TeXFlow. Standard documents need \maketitle exactly once.
  assert(extension.includes('async function ensureMakeTitle(document: vscode.TextDocument)'), 'standard-document title materialization helper missing');
  assert(extension.includes("await applyReplacement(document, pos, pos, '\\n\\n\\\\maketitle\\n');"), 'Title creation must insert canonical \\maketitle');
  assert(extension.includes("if (needsMakeTitle) await ensureMakeTitle(document);"), 'inline Title creation must ensure compiled title output');
  assert(extension.includes('doc-metadata-edit doc-title-heading'), 'editable title must keep a title-specific visual class');
  assert(extension.includes('.doc-title .doc-title-heading{display:block;width:100%;font-size:2.05em!important;'), 'editable title must preserve the validated large/bold v0.20 presentation');

  // Ordinary prose must keep the exact v0.20.0 typing/save contract. This path
  // has regressed twice, so tests intentionally pin the validated implementation:
  // 500 ms debounce, the original queued host edit path, and no source reopening.
  assert(extension.includes("let activeEditable=null;const saveTimers=new WeakMap();function scheduleSave(el,send){const old=saveTimers.get(el);if(old)clearTimeout(old);document.getElementById('save-status').textContent='Editing…';saveTimers.set(el,setTimeout(()=>send(false),500));}"), 'ordinary Visual typing must preserve the validated v0.20.0 500 ms debounce');
  assert(extension.includes("function flushSave(el,send){const old=saveTimers.get(el);if(old)clearTimeout(old);send(false);}"), 'blur/focus must preserve the validated v0.20.0 non-refreshing save contract');
  const hostEditStart = extension.indexOf("if (msg.type === 'updateDocumentNode') {");
  const hostEditEnd = extension.indexOf("if (msg.type === 'ensureMetadataField') {", hostEditStart);
  const hostEdit = extension.slice(hostEditStart, hostEditEnd);
  assert(hostEditStart >= 0 && hostEditEnd > hostEditStart, 'updateDocumentNode host handler missing');
  assert(hostEdit.includes("postStatus('saving');\n            await beginHistoryStep();\n            await refreshProject();"), 'ordinary document edits must use the validated v0.20.0 queued project path');
  assert(hostEdit.includes("await updateDocumentRange(project.activeDocument, Number(msg.start), Number(msg.end), String(msg.expected ?? ''), String(msg.replacement ?? ''), String(msg.feature || ''));"), 'ordinary document edits must target the validated active TextDocument path');
  assert(!hostEdit.includes('lightweightTextEdit'), 'do not reintroduce the post-v0.20 lightweight autosave branch');
  assert(!hostEdit.includes('openTextDocument(activeUri)'), 'ordinary typing must not reopen Source documents');
  assert(extension.includes('async function applyReplacement(document: vscode.TextDocument, start: number, end: number, value: string)'), 'replacement helper must use the established immediate-save contract');
  assert(extension.includes('else await document.save();'), 'accepted Visual edits must leave the source clean on disk');
  assert(!extension.includes("type:'visualTyping'"), 'typing must not post host messages on every keystroke');
  assert(!extension.includes('pendingDocumentSaves'), 'Visual typing must not leave delayed dirty TextDocuments behind');
  assert(!extension.includes('scheduleDocumentDiskSave'), 'disk saves must not be rescheduled independently of Visual edits');
  assert(extension.includes("if (msg.type === 'compile') {\n          await documentEditQueue;"), 'Compile must wait for queued Visual edits before LaTeX reads the document');

  // Title/Author are new in 0.20.1, but their write path must stay as close as
  // possible to the validated v0.20.0 metadata update: use the already-loaded
  // master TextDocument, do not reopen Source, and do not rebuild the webview.
  assert(extension.includes("await setDocumentCommand(project.masterDocument, field, String(msg.value ?? ''));"), 'inline metadata must write through the already-loaded master document');
  assert(extension.includes("function mirrorMetadataSource(field,value)"), 'metadata typing must mirror source and offsets locally');
  assert(extension.includes("el.addEventListener('blur',()=>flushSave(el,save));"), 'metadata blur must persist without rebuilding the visual DOM');

}


// 11. Title materialization is behavioral: a Visual title must compile exactly once.
{
  let helper = extract('async function ensureMakeTitle', 'async function insertAbstract');
  helper = helper
    .replace('async function ensureMakeTitle(document: vscode.TextDocument)', 'function ensureMakeTitle(document, saveToDisk = true)')
    .replace('await applyReplacement(document, pos, pos,', 'applyReplacement(document, pos, pos,');
  const sandbox = {
    stripLatexCommentsForIncludes: source => source,
    applyReplacement: (document, start, end, value) => {
      document.text = document.text.slice(0, start) + value + document.text.slice(end);
    }
  };
  vm.runInNewContext(helper + '\nthis.ensureMakeTitle=ensureMakeTitle;', sandbox);

  const document = {
    text: String.raw`\documentclass{article}
\title{A title}
\begin{document}
\tableofcontents
\section{One}
Text.
\end{document}`,
    getText() { return this.text; }
  };
  sandbox.ensureMakeTitle(document);
  assert.strictEqual((document.text.match(/\\maketitle\b/g) || []).length, 1, 'Visual title must materialize exactly one \\maketitle');
  assert.match(document.text, /\\begin\{document\}\n\n\\maketitle\n/, '\\maketitle must be placed immediately after document start');

  const once = document.text;
  sandbox.ensureMakeTitle(document);
  assert.strictEqual(document.text, once, 'ensuring a title twice must not duplicate \\maketitle');
}

console.log('PASS build_0201_runtime');

// Performance guard: typing must not force layout on every keystroke.
assert(/function scheduleSlideFit\(slide\)\{if\(!slide\)return;clearTimeout\(slide\.__texflowFitTimer\);slide\.__texflowFitTimer=setTimeout/.test(extension), 'Beamer slide-fit work is debounced');
assert(/function scheduleDocumentCommentMarkerAlignment\(host\)\{\n if\(!host\|\|!host\.querySelector\|\|!host\.querySelector\('\.comment-anchor'\)\)return;/.test(extension), 'comment alignment is skipped when no comment markers exist');
