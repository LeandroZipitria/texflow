import * as vscode from 'vscode';

interface FrameInfo {
  index: number;
  start: number;
  end: number;
  title: string;
  options: string;
  raw: string;
  body: string;
  section: string;
  subsection: string;
  sourceUri: string;
  sourceFile: string;
}

interface ParsedBlock {
  id: string;
  kind: 'paragraph' | 'itemize' | 'block' | 'equation' | 'figure' | 'columns' | 'raw';
  start: number;
  end: number;
  raw: string;
  title?: string;
  env?: string;
  text?: string;
  items?: string[];
  figurePath?: string;
  figureOptions?: string;
  figureWidth?: number;
  figureWidthUnit?: string;
  figureHeight?: number;
  figureHeightUnit?: string;
  figureCaption?: string;
  figureAlign?: 'left' | 'center' | 'right';
}

interface PreambleInfo {
  id: string;
  label: string;
  uri: string;
  text: string;
  start: number;
  end: number;
  kind: 'root' | 'file';
}

interface PresentationStyle {
  aspectWidth: number;
  aspectHeight: number;
  aspectLabel: string;
  baseFontPt: number;
  bodyFontPx: number;
  titleFontPx: number;
  lineHeight: number;
}

interface ProjectModel {
  root: vscode.TextDocument;
  documents: Map<string, vscode.TextDocument>;
  frames: FrameInfo[];
  isBeamer: boolean;
  documentClass: string;
  metadata: ReturnType<typeof getMetadata>;
  presentationStyle: PresentationStyle;
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('TeXFlow');
  context.subscriptions.push(output);

  context.subscriptions.push(vscode.commands.registerCommand('texflow.newProject', async () => {
    const kind = await vscode.window.showQuickPick([
      { label: 'Beamer presentation', description: 'Slides organized in frames', value: 'beamer' },
      { label: 'LaTeX article', description: 'Sections and subsections', value: 'article' },
      { label: 'LaTeX report', description: 'Chapters, sections and subsections', value: 'report' },
      { label: 'LaTeX book', description: 'Chapters, sections and subsections', value: 'book' }
    ], { placeHolder: 'Choose the document class' });
    if (!kind) return;

    const selected = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: 'Choose parent folder'
    });
    if (!selected?.[0]) return;

    const projectName = await vscode.window.showInputBox({
      prompt: 'Project folder name',
      value: kind.value === 'beamer' ? 'my-presentation' : kind.value === 'article' ? 'my-article' : kind.value === 'report' ? 'my-report' : 'my-book',
      validateInput: value => /^[^\\/:*?"<>|]+$/.test(value.trim()) ? undefined : 'Use a valid folder name.'
    });
    if (!projectName?.trim()) return;

    const folder = vscode.Uri.joinPath(selected[0], projectName.trim());
    try {
      await vscode.workspace.fs.createDirectory(folder);
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folder, 'figures'));
      const preambleUri = vscode.Uri.joinPath(folder, 'preamble.tex');
      const mainUri = vscode.Uri.joinPath(folder, 'main.tex');
      const preamble = kind.value === 'beamer'
        ? `\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{amsmath,amssymb}\n\\usepackage{graphicx}\n\\usetheme{default}\n`
        : `\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{amsmath,amssymb}\n\\usepackage{graphicx}\n\\usepackage{booktabs}\n`;
      const className = kind.value;
      const main = className === 'beamer'
        ? `\\documentclass[aspectratio=43]{beamer}\n\\input{preamble}\n\n\\title{Presentation title}\n\\author{Author}\n\\date{\\today}\n\n\\begin{document}\n\n\\begin{frame}\n  \\titlepage\n\\end{frame}\n\n\\begin{frame}{First frame}\n  Start writing here.\n\\end{frame}\n\n\\end{document}\n`
        : className === 'article'
          ? `\\documentclass[12pt]{article}\n\\input{preamble}\n\n\\title{Article title}\n\\author{Author}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\n\\section{Introduction}\nStart writing here.\n\n\\end{document}\n`
          : `\\documentclass[12pt]{${className}}\n\\input{preamble}\n\n\\title{${className === 'book' ? 'Book' : 'Report'} title}\n\\author{Author}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\n\\chapter{Introduction}\nStart writing here.\n\n\\end{document}\n`;
      await vscode.workspace.fs.writeFile(preambleUri, new TextEncoder().encode(preamble));
      await vscode.workspace.fs.writeFile(mainUri, new TextEncoder().encode(main));
      const document = await vscode.workspace.openTextDocument(mainUri);
      await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
      vscode.window.showInformationMessage(`TeXFlow created ${projectName.trim()}.`);
      await vscode.commands.executeCommand('texflow.openVisualEditor', mainUri);
    } catch (error) {
      vscode.window.showErrorMessage(`TeXFlow could not create the project: ${String(error)}`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('texflow.projectCheck', async (uri?: vscode.Uri) => {
    const active = uri ? await vscode.workspace.openTextDocument(uri) : vscode.window.activeTextEditor?.document;
    if (!active || active.languageId !== 'latex') {
      vscode.window.showErrorMessage('Open a LaTeX .tex file first.');
      return;
    }
    const project = await loadProject(active, output);
    const rawBlocks = project.frames.reduce((n, frame) => n + parseBlocks(frame.body).filter(b => b.kind === 'raw').length, 0);
    const equations = project.frames.reduce((n, frame) => n + parseBlocks(frame.body).filter(b => b.kind === 'equation').length, 0);
    const lists = project.frames.reduce((n, frame) => n + parseBlocks(frame.body).filter(b => b.kind === 'itemize').length, 0);
    output.clear();
    output.appendLine('TeXFlow project check');
    output.appendLine('====================');
    output.appendLine(`Root: ${project.root.uri.fsPath}`);
    output.appendLine(`Files loaded: ${project.documents.size}`);
    output.appendLine(`Frames: ${project.frames.length}`);
    output.appendLine(`Lists: ${lists}`);
    output.appendLine(`Equations: ${equations}`);
    output.appendLine(`Preserved raw blocks: ${rawBlocks}`);
    output.appendLine('');
    for (const doc of project.documents.values()) output.appendLine(`- ${doc.uri.fsPath}`);
    output.show(true);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('texflow.openVisualEditor', async (uri?: vscode.Uri) => {
    let initialDocument: vscode.TextDocument | undefined;
    if (uri) initialDocument = await vscode.workspace.openTextDocument(uri);
    else initialDocument = vscode.window.activeTextEditor?.document;

    if (!initialDocument || initialDocument.languageId !== 'latex') {
      vscode.window.showErrorMessage('Open a LaTeX .tex file first.');
      return;
    }

    let project = await loadProject(initialDocument, output);
    let rootUri = project.root.uri;
    const panel = vscode.window.createWebviewPanel(
      'texflowVisualEditor',
      `TeXFlow: ${project.root.fileName.split(/[\\/]/).pop()}`,
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media'), vscode.Uri.joinPath(project.root.uri, '..'), ...(vscode.workspace.workspaceFolders ?? []).map(f => f.uri)] }
    );

    const nonce = String(Date.now());
    const katexJs = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'katex.min.js'));
    const katexCss = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'katex.min.css'));
    panel.webview.html = getHtml(nonce, katexJs, katexCss, panel.webview.cspSource);

    let updatingFromWebview = false;
    let documentEditQueue: Promise<void> = Promise.resolve();
    type Snapshot = { files: { uri: string; text: string }[] };
    const undoStack: Snapshot[] = [];
    const redoStack: Snapshot[] = [];
    const captureSnapshot = async (): Promise<Snapshot> => {
      await refreshProject();
      return { files: [...project.documents.values()].map(d => ({ uri: d.uri.toString(), text: d.getText() })) };
    };
    const restoreSnapshot = async (snapshot: Snapshot) => {
      updatingFromWebview = true;
      try {
        for (const file of snapshot.files) {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(file.uri));
          await applyReplacement(doc, 0, doc.getText().length, file.text);
        }
      } finally { updatingFromWebview = false; }
      await sendDocument();
    };
    const beginHistoryStep = async () => {
      undoStack.push(await captureSnapshot());
      if (undoStack.length > 100) undoStack.shift();
      redoStack.length = 0;
    };
    const postStatus = (state: 'saving' | 'saved' | 'error', message = '') => panel.webview.postMessage({ type: 'saveStatus', state, message });
    const refreshProject = async () => {
      // TextDocument instances become unusable after their editor is closed.
      // Keep the root URI as the durable project identity and reopen a fresh
      // document on every refresh. This lets TeXFlow remain fully functional
      // even when no .tex tab is open.
      const rootDocument = await vscode.workspace.openTextDocument(rootUri);
      project = await loadProject(rootDocument, output);
      return project;
    };
    const sendDocument = async (selectedFrame?: number, focusFrameTitle = false, focusNewMath = false) => {
      await refreshProject();
      const pdfUri = await getPdfWebviewUri(project.root, panel.webview);
      panel.webview.postMessage({
        type: 'document',
        frames: project.frames,
        fileName: project.root.fileName,
        isBeamer: project.isBeamer,
        documentClass: project.documentClass,
        metadata: project.metadata,
        presentationStyle: project.presentationStyle,
        projectFiles: [...project.documents.values()].map(d => d.uri.fsPath),
        sources: [...project.documents.values()].map(d => ({ uri: d.uri.toString(), label: vscode.workspace.asRelativePath(d.uri, false), text: d.getText() })),
        rootUri: project.root.uri.toString(),
        pdfUri,
        preambles: getPreambleInfos(project),
        figureResources: await getFigureResources(project, panel.webview),
        documentSource: project.root.getText(),
        selectedFrame,
        focusFrameTitle,
        focusNewMath
      });
    };
    const getFrameContext = async (frameIndex: number) => {
      await refreshProject();
      const frame = project.frames[frameIndex];
      if (!frame) return undefined;
      const document = project.documents.get(frame.sourceUri) ?? await vscode.workspace.openTextDocument(vscode.Uri.parse(frame.sourceUri));
      return { frame, document };
    };

    panel.webview.onDidReceiveMessage(async msg => {
      try {
        if (msg.type === 'ready') await sendDocument();
        if (msg.type === 'reveal') {
          const ctx = await getFrameContext(msg.frameIndex);
          if (!ctx) return;
          const editor = await vscode.window.showTextDocument(ctx.document, vscode.ViewColumn.One, true);
          const pos = ctx.document.positionAt(ctx.frame.start);
          editor.selection = new vscode.Selection(pos, pos);
          editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        }
        if (msg.type === 'updateFrameTitle') {
          postStatus('saving');
          await beginHistoryStep();
          const ctx = await getFrameContext(msg.frameIndex);
          if (!ctx) return;
          const beginMatch = /^\\begin\{frame\}(\[[^\]]*\])?(?:\{([^}]*)\})?/m.exec(ctx.frame.raw);
          if (!beginMatch) return;
          const absoluteStart = ctx.frame.start + (beginMatch.index ?? 0);
          const replacement = `\\begin{frame}${beginMatch[1] ?? ''}{${escapeTitle(msg.title)}}`;
          await applyReplacement(ctx.document, absoluteStart, absoluteStart + beginMatch[0].length, replacement);
          postStatus('saved');
          if (msg.refresh) await sendDocument();
        }
        if (msg.type === 'updateBlock') {
          postStatus('saving');
          await beginHistoryStep();
          const ctx = await getFrameContext(msg.frameIndex);
          if (!ctx) return;
          const blocks = parseBlocks(ctx.frame.body);
          const block = blocks.find(b => b.id === msg.blockId);
          if (!block) return;
          const frameBodyOffset = ctx.frame.raw.indexOf(ctx.frame.body);
          const absStart = ctx.frame.start + frameBodyOffset + block.start;
          const absEnd = ctx.frame.start + frameBodyOffset + block.end;
          updatingFromWebview = true;
          await applyReplacement(ctx.document, absStart, absEnd, serializeBlock(block, msg.payload));
          updatingFromWebview = false;
          postStatus('saved');
          if (msg.refresh) await sendDocument();
        }
        if (msg.type === 'updateTrailingParagraph') {
          postStatus('saving');
          const ctx = await getFrameContext(msg.frameIndex);
          if (!ctx) return;
          const previous = String(msg.previous ?? '').trim();
          const text = String(msg.text ?? '').trim();
          const endToken = '\\end{frame}';
          const insertPos = ctx.frame.end - endToken.length;
          updatingFromWebview = true;
          try {
            if (!previous) {
              if (text) {
                await beginHistoryStep();
                await applyReplacement(ctx.document, insertPos, insertPos, `\n\n${text}\n`);
              }
            } else {
              const source = ctx.document.getText();
              const frameBodyOffset = ctx.frame.raw.indexOf(ctx.frame.body);
              if (frameBodyOffset < 0) throw new Error('TeXFlow could not locate the trailing paragraph body.');
              const frameBodyStart = ctx.frame.start + frameBodyOffset;
              const bodyBeforeEnd = source.slice(frameBodyStart, insertPos);
              const withoutTrailingWhitespace = bodyBeforeEnd.replace(/\s+$/u, '');

              // The trailing editor only appends after the existing frame body. On each
              // autosave, require the previously saved value to still be the final
              // non-whitespace content of the frame. This is both safer and more stable
              // than searching for the same text anywhere in a list or earlier paragraph.
              if (!withoutTrailingWhitespace.endsWith(previous)) {
                throw new Error('TeXFlow could not update the trailing paragraph safely.');
              }

              const absEnd = frameBodyStart + withoutTrailingWhitespace.length;
              const absStart = absEnd - previous.length;
              if (absStart < frameBodyStart || absEnd > insertPos || source.slice(absStart, absEnd) !== previous) {
                throw new Error('TeXFlow refused to edit outside the trailing paragraph.');
              }
              await beginHistoryStep();
              await applyReplacement(ctx.document, absStart, absEnd, text);
            }
          } finally {
            updatingFromWebview = false;
          }
          postStatus('saved');
          if (msg.refresh) await sendDocument(msg.frameIndex, false);
        }
        if (msg.type === 'updateEmptyFrameBody') {
          postStatus('saving');
          await beginHistoryStep();
          const ctx = await getFrameContext(msg.frameIndex);
          if (!ctx) return;
          const frameBodyOffset = ctx.frame.raw.indexOf(ctx.frame.body);
          const absStart = ctx.frame.start + frameBodyOffset;
          const absEnd = absStart + ctx.frame.body.length;
          const text = String(msg.text ?? '').trim();
          updatingFromWebview = true;
          await applyReplacement(ctx.document, absStart, absEnd, text ? `\n${text}\n` : '\n\n');
          updatingFromWebview = false;
          postStatus('saved');
          if (msg.refresh) await sendDocument(msg.frameIndex, false);
        }
        if (msg.type === 'updateDocumentNode') {
          if (project.isBeamer) return;
          // Visual document edits can arrive faster than WorkspaceEdit + save finishes
          // (especially when Enter follows a debounced text autosave). Serialize them
          // so edit N+1 always validates against the document produced by edit N.
          // Without this queue, the optimistic webview model can legitimately send
          // the next expected value while VS Code still contains the previous one.
          const runDocumentEdit = async () => {
            postStatus('saving');
            await beginHistoryStep();
            await refreshProject();
            updatingFromWebview = true;
            try {
              await updateDocumentRange(project.root, Number(msg.start), Number(msg.end), String(msg.expected ?? ''), String(msg.replacement ?? ''));
              postStatus('saved');
              if (msg.refresh !== false) await sendDocument();
            } catch (error) {
              updatingFromWebview = false;
              // Keep the visual DOM and caret intact on a rejected autosave.
              // The user can explicitly refresh/source-sync if the document
              // really changed externally.
              throw error;
            } finally {
              updatingFromWebview = false;
            }
          };
          const queued = documentEditQueue.then(runDocumentEdit, runDocumentEdit);
          documentEditQueue = queued.then(() => undefined, () => undefined);
          await queued;
        }
        if (msg.type === 'setMetadata') {
          const label = msg.field === 'title' ? 'Document title' : 'Author';
          const current = getCommandValue(project.root.getText(), msg.field);
          const value = await vscode.window.showInputBox({ prompt: label, value: current });
          if (value !== undefined) await setDocumentCommand(project.root, msg.field, value);
        }
        if (msg.type === 'insertAbstract') {
          const value = await vscode.window.showInputBox({ prompt: 'Abstract text' });
          if (value !== undefined) await insertAbstract(project.root, value);
        }
        if (msg.type === 'insertFrame') {
          if (!project.isBeamer) {
            vscode.window.showWarningMessage('Insert Frame is available only for Beamer documents.');
            return;
          }
          // Create immediately, then select the new frame and put its title
          // into edit mode. No command-palette-style confirmation is needed.
          const ctx = await getFrameContext(msg.frameIndex);
          await beginHistoryStep();
          await insertFrame(ctx?.document ?? project.root, ctx?.frame, 'New frame');
          await sendDocument(Math.max(0, Number(msg.frameIndex ?? -1) + 1), true);
        }
        if (msg.type === 'insertChapter' || msg.type === 'insertSection' || msg.type === 'insertSubsection' || msg.type === 'insertSubsubsection' || msg.type === 'insertParagraphHeading') {
          const level: 'chapter' | 'section' | 'subsection' | 'subsubsection' | 'paragraph' = msg.type === 'insertChapter' ? 'chapter' : msg.type === 'insertSection' ? 'section' : msg.type === 'insertSubsection' ? 'subsection' : msg.type === 'insertSubsubsection' ? 'subsubsection' : 'paragraph';
          const allowed = level === 'chapter' ? ['book', 'report'].includes(project.documentClass) : true;
          if (!allowed) {
            vscode.window.showWarningMessage(`\${level} is not available for the ${project.documentClass || 'current'} document class.`);
            return;
          }
          const label = level === 'chapter' ? 'Chapter title' : level === 'section' ? 'Section title' : level === 'subsection' ? 'Subsection title' : level === 'subsubsection' ? 'Subsubsection title' : 'Paragraph heading';
          const value = await vscode.window.showInputBox({ prompt: label, value: `New ${level}` });
          const ctx = await getFrameContext(msg.frameIndex);
          if (value !== undefined) await insertHeading(ctx?.document ?? project.root, ctx?.frame, level, value);
        }
        if (msg.type === 'insertMath') {
          postStatus('saving');
          await beginHistoryStep();
          const ctx = await getFrameContext(msg.frameIndex);
          if (ctx) {
            await insertMathInFrame(ctx.document, ctx.frame, String(msg.kind || 'displaymath'), String(msg.text || ''));
            await sendDocument(msg.frameIndex, false, false);
          } else if (!project.isBeamer) {
            await refreshProject();
            await insertBlockInDocument(project.root, String(msg.kind || 'displaymath'), String(msg.text || ''));
            await sendDocument();
          }
          postStatus('saved');
        }
        if (msg.type === 'insertBlock') {
          postStatus('saving');
          await beginHistoryStep();
          const ctx = await getFrameContext(msg.frameIndex);
          if (ctx) {
            await insertBlockInFrame(ctx.document, ctx.frame, msg.kind);
            await sendDocument(msg.frameIndex, false, false);
          } else if (!project.isBeamer) {
            await refreshProject();
            await insertBlockInDocument(project.root, String(msg.kind || 'paragraph'));
            await sendDocument();
          }
          postStatus('saved');
        }
        if (msg.type === 'savePreamble') {
          await refreshProject();
          const info = getPreambleInfos(project).find(x => x.id === msg.preambleId);
          if (!info) throw new Error('Preamble source not found.');
          const document = project.documents.get(info.uri) ?? await vscode.workspace.openTextDocument(vscode.Uri.parse(info.uri));
          updatingFromWebview = true;
          await applyReplacement(document, info.start, info.end, String(msg.text ?? ''));
          updatingFromWebview = false;
          await sendDocument();
          vscode.window.showInformationMessage('Preamble saved.');
        }
        if (msg.type === 'revealPreamble') {
          await refreshProject();
          const info = getPreambleInfos(project).find(x => x.id === msg.preambleId);
          if (!info) return;
          const document = project.documents.get(info.uri) ?? await vscode.workspace.openTextDocument(vscode.Uri.parse(info.uri));
          const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One, true);
          const pos = document.positionAt(info.start);
          editor.selection = new vscode.Selection(pos, pos);
          editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        }
        if (msg.type === 'saveSource') {
          await refreshProject();
          const document = project.documents.get(String(msg.uri)) ?? await vscode.workspace.openTextDocument(vscode.Uri.parse(String(msg.uri)));
          updatingFromWebview = true;
          await applyReplacement(document, 0, document.getText().length, String(msg.text ?? ''));
          updatingFromWebview = false;
          await sendDocument();
          vscode.window.showInformationMessage(`Saved ${vscode.workspace.asRelativePath(document.uri, false)}.`);
        }
        if (msg.type === 'undo') {
          if (!undoStack.length) return;
          redoStack.push(await captureSnapshot());
          await restoreSnapshot(undoStack.pop()!);
          postStatus('saved', 'Undo');
        }
        if (msg.type === 'redo') {
          if (!redoStack.length) return;
          undoStack.push(await captureSnapshot());
          await restoreSnapshot(redoStack.pop()!);
          postStatus('saved', 'Redo');
        }
        if (msg.type === 'save') {
          postStatus('saving');
          await refreshProject();
          for (const doc of project.documents.values()) if (doc.isDirty) await doc.save();
          postStatus('saved');
        }
        if (msg.type === 'newDocument') {
          panel.dispose();
          await vscode.commands.executeCommand('texflow.newProject');
        }
        if (msg.type === 'open') {
          const selected = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: false, filters: { LaTeX: ['tex'] }, openLabel: 'Open in TeXFlow' });
          if (!selected?.[0]) return;
          // Open the selected file in a new TeXFlow panel. The current project
          // remains open, matching normal VS Code tab behavior.
          await vscode.commands.executeCommand('texflow.openVisualEditor', selected[0]);
        }
        if (msg.type === 'saveAs') {
          await refreshProject();
          const target = await vscode.window.showSaveDialog({ defaultUri: project.root.uri, filters: { LaTeX: ['tex'] }, saveLabel: 'Save TeX file as' });
          if (!target) return;
          postStatus('saving');
          await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(project.root.getText()));
          postStatus('saved');
          panel.dispose();
          await vscode.commands.executeCommand('texflow.openVisualEditor', target);
        }
        if (msg.type === 'compile') {
          panel.webview.postMessage({ type: 'compileStarted' });
          const pdfUri = vscode.Uri.file(rootUri.fsPath.replace(/\.tex$/i, '.pdf'));
          let previousMtime = -1;
          try { previousMtime = (await vscode.workspace.fs.stat(pdfUri)).mtime; } catch { /* no previous PDF */ }
          await compileDocument(rootUri, panel);
          let ready = false;
          for (let attempt = 0; attempt < 60; attempt++) {
            try {
              const stat = await vscode.workspace.fs.stat(pdfUri);
              if (stat.size > 0 && (stat.mtime !== previousMtime || attempt >= 2)) {
                ready = true;
                break;
              }
            } catch { /* build still running */ }
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          await sendDocument();
          if (ready) {
            panel.webview.postMessage({ type: 'compileFinished' });
            await openPdfInVsCode(pdfUri, panel);
          } else {
            panel.webview.postMessage({ type: 'compileFailed', message: 'The PDF was not updated. Check the LaTeX build log.' });
          }
        }
        if (msg.type === 'refreshPdf') await sendDocument();
        if (msg.type === 'openPdf') {
          const pdfUri = vscode.Uri.file(rootUri.fsPath.replace(/\.tex$/i, '.pdf'));
          try {
            const stat = await vscode.workspace.fs.stat(pdfUri);
            if (stat.size <= 0) throw new Error('empty PDF');
            await openPdfInVsCode(pdfUri, panel);
          } catch {
            vscode.window.showWarningMessage('TeXFlow: No compiled PDF is available yet.');
          }
        }
      } catch (error) {
        postStatus('error', String(error));
        output.appendLine(`[error] ${String(error)}`);
        vscode.window.showErrorMessage(`TeXFlow: ${String(error)}`);
      }
    });

    const changeSub = vscode.workspace.onDidChangeTextDocument(async e => {
      if (updatingFromWebview) return;
      if (project.documents.has(e.document.uri.toString())) await sendDocument();
    });
    panel.onDidDispose(() => changeSub.dispose());
  }));
}


async function findRootDocument(document: vscode.TextDocument): Promise<vscode.TextDocument> {
  const source = document.getText();
  if (/\\documentclass/.test(source)) return document;
  const magic = /^%\s*!TEX\s+root\s*=\s*(.+)$/mi.exec(source);
  if (magic) {
    const rootUri = vscode.Uri.joinPath(document.uri, '..', magic[1].trim());
    try { return await vscode.workspace.openTextDocument(rootUri); } catch { /* continue */ }
  }
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!folder) return document;
  const candidates = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, '**/*.tex'), '**/{node_modules,.git}/**', 250);
  const base = document.uri.fsPath.replace(/\\/g, '/');
  for (const uri of candidates) {
    try {
      const candidate = await vscode.workspace.openTextDocument(uri);
      const text = candidate.getText();
      if (!/\\documentclass/.test(text)) continue;
      const includes = extractIncludeTargets(candidate);
      if (includes.some(x => x.fsPath.replace(/\\/g, '/') === base)) return candidate;
    } catch { /* ignore unreadable candidate */ }
  }
  return document;
}

function extractIncludeTargets(document: vscode.TextDocument): vscode.Uri[] {
  const result: vscode.Uri[] = [];
  const re = /\\(?:input|include)\s*\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(document.getText()))) {
    let target = m[1].trim();
    if (!target || /[\\#$]/.test(target)) continue;
    if (!/\.[A-Za-z0-9]+$/.test(target)) target += '.tex';
    result.push(vscode.Uri.joinPath(document.uri, '..', target));
  }
  return result;
}

async function loadProject(initial: vscode.TextDocument, output: vscode.OutputChannel): Promise<ProjectModel> {
  const root = await findRootDocument(initial);
  const documents = new Map<string, vscode.TextDocument>();
  const ordered: vscode.TextDocument[] = [];
  const visit = async (document: vscode.TextDocument, depth: number) => {
    const key = document.uri.toString();
    if (documents.has(key) || depth > 12) return;
    documents.set(key, document);
    ordered.push(document);
    for (const target of extractIncludeTargets(document)) {
      try { await visit(await vscode.workspace.openTextDocument(target), depth + 1); }
      catch { output.appendLine(`[warning] Included file not found: ${target.fsPath}`); }
    }
  };
  await visit(root, 0);
  const frames: FrameInfo[] = [];
  for (const document of ordered) {
    for (const frame of parseFrames(document.getText(), document.uri.toString(), vscode.workspace.asRelativePath(document.uri, false))) {
      frame.index = frames.length;
      frames.push(frame);
    }
  }
  return { root, documents, frames, isBeamer: isBeamerDocument(root.getText()), documentClass: getDocumentClass(root.getText()), metadata: getMetadata(root.getText()), presentationStyle: getPresentationStyle(root.getText()) };
}

function getPreambleInfos(project: ProjectModel): PreambleInfo[] {
  const result: PreambleInfo[] = [];
  const rootText = project.root.getText();
  const begin = rootText.indexOf('\\begin{document}');
  const rootEnd = begin >= 0 ? begin : rootText.length;
  result.push({
    id: 'root-preamble',
    label: `${project.root.fileName.split(/[\\/]/).pop()} — root preamble`,
    uri: project.root.uri.toString(),
    text: rootText.slice(0, rootEnd),
    start: 0,
    end: rootEnd,
    kind: 'root'
  });

  const prefix = rootText.slice(0, rootEnd);
  const re = /\\(?:input|include)\s*\{([^}]+)\}/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(prefix))) {
    let target = m[1].trim();
    if (!target || /[\\#$]/.test(target)) continue;
    if (!/\.[A-Za-z0-9]+$/.test(target)) target += '.tex';
    const uri = vscode.Uri.joinPath(project.root.uri, '..', target);
    const key = uri.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    const document = project.documents.get(key);
    if (!document) continue;
    result.push({
      id: `preamble-${result.length}`,
      label: vscode.workspace.asRelativePath(document.uri, false),
      uri: key,
      text: document.getText(),
      start: 0,
      end: document.getText().length,
      kind: 'file'
    });
  }
  return result;
}

function getDocumentClass(source: string): string {
  return /\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/.exec(source)?.[1]?.trim().toLowerCase() ?? '';
}

function isBeamerDocument(source: string): boolean {
  return getDocumentClass(source) === 'beamer';
}

function getPresentationStyle(source: string): PresentationStyle {
  const classMatch = /\\documentclass(?:\[([^\]]*)\])?\{beamer\}/i.exec(source);
  const options = classMatch?.[1] ?? '';
  const aspectCode = /(?:^|,)\s*aspectratio\s*=\s*(\d+)\s*(?:,|$)/i.exec(options)?.[1] ?? '43';
  const aspects: Record<string, [number, number, string]> = {
    '169': [16, 9, '16:9'],
    '1610': [16, 10, '16:10'],
    '149': [14, 9, '14:9'],
    '141': [14, 10, '14:10'],
    '54': [5, 4, '5:4'],
    '43': [4, 3, '4:3'],
    '32': [3, 2, '3:2']
  };
  const [aspectWidth, aspectHeight, aspectLabel] = aspects[aspectCode] ?? aspects['43'];
  const ptMatch = /(?:^|,)\s*(8|9|10|11|12|14|17|20)pt\s*(?:,|$)/i.exec(options);
  const baseFontPt = ptMatch ? Number(ptMatch[1]) : 11;
  // Calibrated to Beamer's default Computer Modern/Sans density. This is an
  // editing approximation; the compiled PDF remains the final authority.
  const bodyFontPx = Math.max(12, Math.min(23, 16 * baseFontPt / 11));
  const titleFontPx = Math.max(20, Math.min(34, bodyFontPx * 1.55));
  const lineHeight = 1.28;
  return { aspectWidth, aspectHeight, aspectLabel, baseFontPt, bodyFontPx, titleFontPx, lineHeight };
}

function getCommandValue(source: string, command: string): string {
  const re = new RegExp('\\\\' + command + '\\{([^}]*)\\}');
  return re.exec(source)?.[1] ?? '';
}


function getMetadata(source: string) {
  return {
    title: getCommandValue(source, 'title'),
    subtitle: getCommandValue(source, 'subtitle'),
    author: getCommandValue(source, 'author'),
    institute: getCommandValue(source, 'institute'),
    date: getCommandValue(source, 'date')
  };
}


function parseGraphicPaths(source: string): string[] {
  const out: string[] = [];
  const re = /\\graphicspath\s*\{((?:\{[^{}]*\})+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const inner = m[1] ?? '';
    const pathRe = /\{([^{}]+)\}/g;
    let p: RegExpExecArray | null;
    while ((p = pathRe.exec(inner))) out.push(p[1].trim());
  }
  return out;
}

async function getFigureResources(project: ProjectModel, webview: vscode.Webview): Promise<Record<string, { uri: string; isPdf: boolean; extension: string }>> {
  const resources: Record<string, { uri: string; isPdf: boolean; extension: string }> = {};
  const rootDir = vscode.Uri.joinPath(project.root.uri, '..');
  const graphicPaths = [...project.documents.values()].flatMap(d => parseGraphicPaths(d.getText()));
  const extensions = ['', '.pdf', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];

  for (const document of project.documents.values()) {
    const re = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(document.getText()))) {
      const rawPath = m[1].trim();
      if (!rawPath || /[\\#$]/.test(rawPath)) continue;
      const bases = [vscode.Uri.joinPath(document.uri, '..'), rootDir];
      for (const gp of graphicPaths) {
        bases.push(vscode.Uri.joinPath(rootDir, gp));
        bases.push(vscode.Uri.joinPath(document.uri, '..', gp));
      }
      let found: vscode.Uri | undefined;
      for (const base of bases) {
        for (const ext of extensions) {
          const candidate = vscode.Uri.joinPath(base, rawPath + (/[.][A-Za-z0-9]+$/.test(rawPath) ? '' : ext));
          try { await vscode.workspace.fs.stat(candidate); found = candidate; break; } catch { /* try next */ }
        }
        if (found) break;
      }
      if (!found) continue;
      const extension = (/[.]([A-Za-z0-9]+)$/.exec(found.path)?.[1] ?? '').toLowerCase();
      const value = { uri: webview.asWebviewUri(found).toString(), isPdf: extension === 'pdf', extension };
      resources[`${document.uri.toString()}|${rawPath}`] = value;
      if (!resources[`*|${rawPath}`]) resources[`*|${rawPath}`] = value;
    }
  }
  return resources;
}

async function getPdfWebviewUri(document: vscode.TextDocument, webview: vscode.Webview): Promise<string> {
  const fsPath = document.uri.fsPath.replace(/\.tex$/i, '.pdf');
  const uri = vscode.Uri.file(fsPath);
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    return webview.asWebviewUri(uri).toString() + `?v=${stat.mtime}`;
  } catch {
    return '';
  }
}

async function openPdfInVsCode(pdfUri: vscode.Uri, panel?: vscode.WebviewPanel) {
  // Chromium's built-in PDF plugin is not reliable inside a VS Code webview
  // (it can render as a blank grey surface). Use VS Code's native PDF editor,
  // the same path used when a PDF is opened from Explorer, and keep TeXFlow
  // visible beside it.
  await vscode.commands.executeCommand('vscode.open', pdfUri, {
    viewColumn: vscode.ViewColumn.Beside,
    preserveFocus: false,
    preview: true
  });
  if (panel) panel.reveal(panel.viewColumn ?? vscode.ViewColumn.One, true);
}

async function compileDocument(rootUri: vscode.Uri, panel?: vscode.WebviewPanel) {
  // Always reopen the document from its URI. A TextDocument object retained by
  // the webview can be closed by VS Code when its source tab is closed.
  const document = await vscode.workspace.openTextDocument(rootUri);
  if (document.isDirty) await document.save();
  try {
    const lw = vscode.extensions.getExtension('James-Yu.latex-workshop');
    if (lw) {
      if (!lw.isActive) await lw.activate();
      // LaTeX Workshop resolves the build target from the active text editor.
      // Activate the root document even when the user has closed its editor tab,
      // then return focus to TeXFlow after the build command has been dispatched.
      await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.One, preserveFocus: false, preview: true });
      await vscode.commands.executeCommand('latex-workshop.build');
      // LaTeX Workshop only needs the root editor to resolve the build target when
      // the command is dispatched. Close that temporary preview again so Compile
      // does not leave a source tab beside TeXFlow; the build continues normally.
      if (vscode.window.activeTextEditor?.document.uri.toString() === document.uri.toString()) {
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      }
      if (panel) panel.reveal(panel.viewColumn ?? vscode.ViewColumn.Beside, true);
      return;
    }
  } catch (err) {
    console.error('TeXFlow LaTeX Workshop build failed', err);
  }

  const cwd = PathDir(document.uri.fsPath);
  const terminal = vscode.window.createTerminal({ name: 'TeXFlow: latexmk', cwd });
  terminal.show(true);
  const quoted = '"' + document.uri.fsPath.replace(/"/g, '\\"') + '"';
  terminal.sendText(`latexmk -pdf -interaction=nonstopmode -synctex=1 ${quoted}`);
  vscode.window.showInformationMessage('LaTeX Workshop was unavailable; TeXFlow started latexmk in the terminal.');
}

function PathDir(filePath: string): string {
  const slash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\\\'));
  return slash >= 0 ? filePath.slice(0, slash) : filePath;
}

async function setDocumentCommand(document: vscode.TextDocument, command: 'title' | 'author', value: string) {
  const source = document.getText();
  const re = new RegExp('\\\\' + command + '\\{[^}]*\\}');
  const match = re.exec(source);
  const replacement = `\\${command}{${value.replace(/[{}]/g, '')}}`;
  if (match) await applyReplacement(document, match.index, match.index + match[0].length, replacement);
  else {
    const begin = source.indexOf('\\begin{document}');
    const pos = begin >= 0 ? begin : 0;
    await applyReplacement(document, pos, pos, replacement + '\n');
  }
}

async function insertAbstract(document: vscode.TextDocument, value: string) {
  const source = document.getText();
  const existing = /\\begin\{abstract\}[\s\S]*?\\end\{abstract\}/.exec(source);
  const replacement = `\\begin{abstract}\n${value}\n\\end{abstract}`;
  if (existing) await applyReplacement(document, existing.index, existing.index + existing[0].length, replacement);
  else {
    const beginToken = '\\begin{document}';
    const begin = source.indexOf(beginToken);
    const pos = begin >= 0 ? begin + beginToken.length : source.length;
    await applyReplacement(document, pos, pos, `\n\n${replacement}\n`);
  }
}

async function insertFrame(document: vscode.TextDocument, current: FrameInfo | undefined, title: string) {
  const source = document.getText();
  const endDocument = source.indexOf('\\end{document}');
  let start: number;
  let end: number;

  if (current) {
    start = current.end;
    end = start;
    while (end < source.length && /\s/.test(source[end])) end++;
  } else if (endDocument >= 0) {
    end = endDocument;
    start = end;
    while (start > 0 && /\s/.test(source[start - 1])) start--;
  } else {
    start = source.length;
    end = source.length;
  }

  const frame = `\n\n\\begin{frame}{${escapeTitle(title)}}\n\n\\end{frame}\n\n`;
  await applyReplacement(document, start, end, frame);
}

async function insertHeading(document: vscode.TextDocument, current: FrameInfo | undefined, level: 'chapter' | 'section' | 'subsection' | 'subsubsection' | 'paragraph', title: string) {
  const source = document.getText();
  let pos = current ? current.end : source.indexOf('\\end{document}');
  if (pos < 0) pos = source.length;
  const command = level;
  await applyReplacement(document, pos, pos, `\n\n\\${command}{${escapeTitle(title)}}`);
}

async function insertMathInFrame(document: vscode.TextDocument, frame: FrameInfo, kind: string, text: string) {
  if (!frame) return;
  const clean = String(text ?? '').trim();
  if (!clean) return;
  const endToken = '\\end{frame}';
  const pos = frame.end - endToken.length;
  let block = '';
  if (kind === 'inlinemath') block = `$${clean}$`;
  else if (kind === 'equation') block = `\\begin{equation}\n${clean}\n\\end{equation}`;
  else block = `$$\n${clean}\n$$`;
  await applyReplacement(document, pos, pos, `\n\n${block}\n`);
}

async function insertBlockInFrame(document: vscode.TextDocument, frame: FrameInfo, kind: string) {
  if (!frame) return;
  const endToken = '\\end{frame}';
  const pos = frame.end - endToken.length;
  let block = '';
  if (kind === 'paragraph') block = 'Normal text';
  else if (kind === 'itemize') block = '\\begin{itemize}\n    \\item New item\n\\end{itemize}';
  else if (kind === 'enumerate') block = '\\begin{enumerate}\n    \\item New item\n\\end{enumerate}';
  else if (kind === 'inlinemath') block = '$\\;$';
  else if (kind === 'displaymath') block = '$$\n\\;\n$$';
  else if (kind === 'equation') block = '\\begin{equation}\n\\;\n\\end{equation}';
  if (!block) return;
  await applyReplacement(document, pos, pos, `\n\n${block}\n`);
}

async function updateDocumentRange(document: vscode.TextDocument, start: number, end: number, expected: string, replacement: string) {
  const source = document.getText();
  if (start < 0 || end < start || start > source.length) throw new Error('TeXFlow refused an invalid document edit range.');

  let actualStart = start;
  let actualEnd = Math.min(end, source.length);

  // Fast path: the optimistic range still points at exactly the text that the
  // webview edited.
  if (source.slice(actualStart, actualEnd) !== expected) {
    // Document Mode keeps the visual DOM alive while autosave runs. A previous
    // TeXFlow edit can therefore shift later absolute offsets before the next
    // debounced edit reaches the extension host. Relocate only the exact old
    // text, in a small window around the optimistic position, and require the
    // match to be unique. This preserves protection against overwriting an
    // unrelated paragraph while avoiding false "document changed" errors.
    if (!expected) {
      throw new Error('TeXFlow could not relocate an empty visual edit safely.');
    }
    const radius = 4096;
    const windowStart = Math.max(0, start - radius);
    const windowEnd = Math.min(source.length, Math.max(end, start) + radius + expected.length);
    const windowText = source.slice(windowStart, windowEnd);
    const first = windowText.indexOf(expected);
    const second = first >= 0 ? windowText.indexOf(expected, first + Math.max(1, expected.length)) : -1;
    if (first < 0 || second >= 0) {
      throw new Error('TeXFlow document changed before the visual edit could be saved. Refresh and try again.');
    }
    actualStart = windowStart + first;
    actualEnd = actualStart + expected.length;
  }

  // Never let a content edit eat a structural document delimiter even after a
  // successful relocation.
  const target = source.slice(actualStart, actualEnd);
  if (/\\(?:begin|end)\{(?:document|frame|itemize|enumerate|equation|align\*?)\}/.test(target)) {
    throw new Error('TeXFlow refused to overwrite a structural LaTeX delimiter.');
  }

  await applyReplacement(document, actualStart, actualEnd, replacement);
}

async function insertBlockInDocument(document: vscode.TextDocument, kind: string, text = '') {
  const source = document.getText();
  let pos = source.lastIndexOf('\\end{document}');
  if (pos < 0) pos = source.length;
  const clean = String(text ?? '').trim();
  let block = '';
  if (kind === 'paragraph') block = clean || 'Normal text';
  else if (kind === 'itemize') block = '\\begin{itemize}\n    \\item New item\n\\end{itemize}';
  else if (kind === 'enumerate') block = '\\begin{enumerate}\n    \\item New item\n\\end{enumerate}';
  else if (kind === 'inlinemath') block = `$${clean || '\\;'}$`;
  else if (kind === 'displaymath') block = `\\[\n${clean || '\\;'}\n\\]`;
  else if (kind === 'equation') block = `\\begin{equation}\n${clean || '\\;'}\n\\end{equation}`;
  if (!block) return;
  await applyReplacement(document, pos, pos, `\n\n${block}\n\n`);
}

async function applyReplacement(document: vscode.TextDocument, start: number, end: number, value: string) {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(document.positionAt(start), document.positionAt(end)), value);
  const ok = await vscode.workspace.applyEdit(edit);
  if (!ok) vscode.window.showErrorMessage('TeXFlow could not apply the edit.');
  else await document.save();
}

function escapeTitle(s: string): string {
  return String(s).replace(/[{}]/g, '');
}

function parseFrames(source: string, sourceUri = '', sourceFile = ''): FrameInfo[] {
  const frames: FrameInfo[] = [];
  const headings: { pos: number; level: 'chapter' | 'section' | 'subsection'; title: string }[] = [];
  const headingRe = /\\(section|subsection)\*?\{([^}]*)\}/g;
  let hm: RegExpExecArray | null;
  while ((hm = headingRe.exec(source))) headings.push({ pos: hm.index, level: hm[1] as 'section' | 'subsection', title: hm[2] });

  const startRe = /\\begin\{frame\}(\[[^\]]*\])?(?:\{([^}]*)\})?/g;
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(source))) {
    const start = m.index;
    const close = source.indexOf('\\end{frame}', startRe.lastIndex);
    if (close < 0) break;
    const end = close + '\\end{frame}'.length;
    const raw = source.slice(start, end);
    const bodyStart = m[0].length;
    const bodyEnd = raw.lastIndexOf('\\end{frame}');
    const body = raw.slice(bodyStart, bodyEnd).replace(/^\s*\n/, '').replace(/\n\s*$/, '');
    let section = '';
    let subsection = '';
    for (const h of headings) {
      if (h.pos >= start) break;
      if (h.level === 'section') { section = h.title; subsection = ''; }
      else subsection = h.title;
    }
    frames.push({ index: frames.length, start, end, title: m[2] ?? '(untitled frame)', options: m[1] ?? '', raw, body, section, subsection, sourceUri, sourceFile });
    startRe.lastIndex = end;
  }
  return frames;
}

function parseFigureData(raw: string) {
  const graphic = /\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}/.exec(raw);
  const options = graphic?.[1] ?? '';
  const path = graphic?.[2]?.trim() ?? '';
  const optionParts = options.split(',').map(x => x.trim()).filter(Boolean);
  const getDimension = (name: string): { value?: number; unit?: string } => {
    const token = optionParts.find(x => new RegExp('^' + name + '\\s*=').test(x));
    if (!token) return {};
    const value = token.slice(token.indexOf('=') + 1).trim();
    const m = /^([0-9]*\.?[0-9]+)\s*(\\(?:textwidth|linewidth|columnwidth|paperwidth|textheight)|[a-zA-Z]+)$/.exec(value);
    return m ? { value: Number(m[1]), unit: m[2] } : {};
  };
  const width = getDimension('width');
  const height = getDimension('height');
  const caption = /\\caption(?:\[[^\]]*\])?\{([^}]*)\}/.exec(raw)?.[1] ?? '';
  const align: 'left' | 'center' | 'right' = /\\raggedleft|\\begin\{flushright\}/.test(raw)
    ? 'right'
    : /\\centering|\\begin\{center\}/.test(raw)
      ? 'center'
      : 'left';
  return { path, options, width, height, caption, align };
}

function parseBlocks(body: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const tokenRe = /\\begin\{(itemize|enumerate|block|alertblock|exampleblock|equation\*?|align\*?|gather\*?|figure|columns)\}(?:\{([^}]*)\})?|\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}|\$\$/g;
  let cursor = 0;
  let count = 0;
  let m: RegExpExecArray | null;

  const pushText = (s: number, e: number) => {
    const raw = body.slice(s, e);
    if (!raw.trim()) return;
    const kind = isSafeParagraph(raw) ? 'paragraph' : 'raw';
    blocks.push({ id: `b${count++}`, kind, start: s, end: e, raw, text: raw.trim() });
  };

  while ((m = tokenRe.exec(body))) {
    pushText(cursor, m.index);
    if (m[0] === '$$') {
      const endPos = body.indexOf('$$', tokenRe.lastIndex);
      if (endPos < 0) break;
      const end = endPos + 2;
      const raw = body.slice(m.index, end);
      const inner = body.slice(tokenRe.lastIndex, endPos).trim();
      blocks.push({ id: `b${count++}`, kind: 'equation', start: m.index, end, raw, env: '$$', text: inner });
      cursor = end;
      tokenRe.lastIndex = end;
      continue;
    }
    if (m[4] !== undefined) {
      const raw = m[0];
      const data = parseFigureData(raw);
      blocks.push({
        id: `b${count++}`, kind: 'figure', start: m.index, end: tokenRe.lastIndex, raw, env: 'includegraphics', text: raw,
        figurePath: data.path, figureOptions: data.options, figureWidth: data.width.value, figureWidthUnit: data.width.unit,
        figureHeight: data.height.value, figureHeightUnit: data.height.unit, figureCaption: data.caption, figureAlign: data.align
      });
      cursor = tokenRe.lastIndex;
      continue;
    }
    const env = m[1];
    const match = findEnvironmentEnd(body, env, tokenRe.lastIndex);
    if (!match) break;
    const end = match.end;
    const raw = body.slice(m.index, end);
    const endToken = `\\end{${env}}`;
    const innerStart = m[0].length;
    const inner = raw.slice(innerStart, raw.length - endToken.length).trim();
    let kind: ParsedBlock['kind'] = 'raw';
    if (env === 'itemize' || env === 'enumerate') kind = 'itemize';
    else if (['block', 'alertblock', 'exampleblock'].includes(env)) kind = 'block';
    else if (/^(equation|align|gather)/.test(env)) kind = 'equation';
    else if (env === 'figure') kind = 'figure';
    else if (env === 'columns') kind = 'columns';
    const block: ParsedBlock = { id: `b${count++}`, kind, start: m.index, end, raw, env, title: m[2] ?? '', text: inner };
    if (kind === 'itemize') block.items = parseItems(inner);
    if (kind === 'figure') {
      const data = parseFigureData(raw);
      block.figurePath = data.path;
      block.figureOptions = data.options;
      block.figureWidth = data.width.value;
      block.figureWidthUnit = data.width.unit;
      block.figureHeight = data.height.value;
      block.figureHeightUnit = data.height.unit;
      block.figureCaption = data.caption;
      block.figureAlign = data.align;
    }
    blocks.push(block);
    cursor = end;
    tokenRe.lastIndex = end;
  }
  pushText(cursor, body.length);
  return blocks;
}

function isSafeParagraph(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (/\\(begin|end|input|include|hypertarget|label|only|visible|uncover|pause|vspace|hspace|centering|includegraphics|tikz)/.test(t)) return false;
  return true;
}

function findEnvironmentEnd(source: string, env: string, from: number): { start: number; end: number } | undefined {
  const escaped = env.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('\\\\(begin|end)\\{' + escaped + '\\}', 'g');
  re.lastIndex = from;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    if (m[1] === 'begin') depth++;
    else depth--;
    if (depth === 0) return { start: m.index, end: m.index + m[0].length };
  }
  return undefined;
}

function parseItems(inner: string): string[] {
  const starts: number[] = [];
  const token = /\\begin\{[^}]+\}|\\end\{[^}]+\}|\\item(?:<[^>]*>)?(?:\[[^\]]*\])?/g;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = token.exec(inner))) {
    if (m[0].startsWith('\\begin')) depth++;
    else if (m[0].startsWith('\\end')) depth = Math.max(0, depth - 1);
    else if (depth === 0) starts.push(m.index);
  }
  return starts.map((pos, i) => inner.slice(pos, starts[i + 1] ?? inner.length)
    .replace(/^\\item(?:<[^>]*>)?(?:\[[^\]]*\])?\s*/, '').trim());
}

function normalizeEditableText(value: unknown): string {
  let text = String(value ?? '').replace(/\r\n?/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/^(?:[ \t]*\\\\[ \t]*\n?)+/, '');
  text = text.replace(/(?:\n?[ \t]*\\\\[ \t]*)+$/, '');
  return text.trim();
}

function serializeBlock(block: ParsedBlock, payload: any): string {
  if (block.kind === 'paragraph') return normalizeEditableText(payload.text) + '\n';
  if (block.kind === 'itemize') {
    const env = block.env || 'itemize';
    const items = (payload.items || []).map((x: string) => `    \\item ${x}`).join('\n');
    return `\\begin{${env}}\n${items}\n\\end{${env}}`;
  }
  if (block.kind === 'block') {
    const env = block.env || 'block';
    return `\\begin{${env}}{${escapeTitle(payload.title || '')}}\n${normalizeEditableText(payload.text)}\n\\end{${env}}`;
  }
  if (block.kind === 'equation') {
    const text = String(payload.text ?? block.text ?? '').trim();
    const env = block.env || 'equation';
    if (env === '$$') return `$$\n${text}\n$$`;
    return `\\begin{${env}}\n${text}\n\\end{${env}}`;
  }
  if (block.kind === 'figure') {
    const raw = block.raw;
    const match = /\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}/.exec(raw);
    if (!match) return raw;
    const existing = (match[1] ?? '').split(',').map(x => x.trim()).filter(Boolean);
    const preserved = existing.filter(x => !/^(?:width|height|keepaspectratio)\s*(?:=|$)/.test(x));
    const width = Math.max(0.05, Math.min(2, Number(payload.width ?? block.figureWidth ?? 1)));
    const widthUnit = String(payload.widthUnit ?? block.figureWidthUnit ?? '\\linewidth');
    preserved.push(`width=${Number(width.toFixed(3))}${widthUnit}`);
    const heightValue = Number(payload.height ?? 0);
    if (heightValue > 0) {
      const height = Math.max(0.05, Math.min(2, heightValue));
      const heightUnit = String(payload.heightUnit ?? block.figureHeightUnit ?? '\\textheight');
      preserved.push(`height=${Number(height.toFixed(3))}${heightUnit}`);
      if (payload.keepAspect !== false) preserved.push('keepaspectratio');
    }
    const command = `\\includegraphics[${preserved.join(',')}]{${match[2]}}`;
    return raw.slice(0, match.index) + command + raw.slice((match.index ?? 0) + match[0].length);
  }
  return block.raw;
}

function getHtml(nonce: string, katexJs: vscode.Uri, katexCss: vscode.Uri, cspSource: string): string {
  return String.raw`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${cspSource}; script-src 'nonce-${nonce}' ${cspSource}; font-src ${cspSource}; img-src ${cspSource} data: blob:; frame-src ${cspSource}; object-src ${cspSource};">
<link rel="stylesheet" href="${katexCss}">
<style>
:root{
  --sidebar:252px;
  --toolrail:64px;
    --line:color-mix(in srgb,var(--vscode-foreground) 14%,transparent);
  --line-strong:color-mix(in srgb,var(--vscode-foreground) 24%,transparent);
  --muted:var(--vscode-descriptionForeground);
  --panel:var(--vscode-sideBar-background,var(--vscode-editor-background));
  --canvas:color-mix(in srgb,var(--vscode-editor-background) 94%,var(--vscode-sideBar-background));
  --paper:color-mix(in srgb,var(--vscode-editor-background) 97%,white 3%);
  --hover:var(--vscode-toolbar-hoverBackground,var(--vscode-list-hoverBackground));
  --slide-aspect:4 / 3;
  --slide-aspect-number:1.333333;
  --slide-body-size:16px;
  --slide-title-size:24.8px;
  --slide-line-height:1.28;
  --active:var(--vscode-list-activeSelectionBackground);
  --active-fg:var(--vscode-list-activeSelectionForeground);
}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--canvas);color:var(--vscode-editor-foreground);font-family:var(--vscode-font-family);font-size:13px;overflow:hidden}
#app{display:grid;grid-template-columns:var(--sidebar) minmax(0,1fr);height:100vh;transition:grid-template-columns .16s ease}
body.nav-open #app{grid-template-columns:var(--sidebar) minmax(0,1fr)}
body.nav-closed #app{grid-template-columns:0 minmax(0,1fr)}
.side{transition:transform .16s ease,opacity .16s ease}
body.nav-closed .side{transform:translateX(-100%);opacity:0;pointer-events:none}
body.focus-mode .topbar{display:none}
body.focus-mode #app{height:100vh;grid-template-columns:0 minmax(0,1fr)}
body.focus-mode .side{display:none}
body.focus-mode .main{padding-top:24px}
body.focus-mode .floating-actions{top:12px}
body.focus-mode .focus-exit{display:grid}
.side{grid-column:1;background:color-mix(in srgb,var(--panel) 96%,var(--vscode-editor-background));border-right:1px solid var(--line);overflow:auto;padding:0 10px 18px}
.brand{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:9px;padding:14px 10px 11px;background:var(--panel);border-bottom:1px solid var(--line);font-size:13px;font-weight:650;letter-spacing:.2px}
.brand-mark{width:25px;height:25px;display:grid;place-items:center;border:1px solid var(--line-strong);border-radius:7px;background:color-mix(in srgb,var(--vscode-button-background) 20%,transparent);font-family:Georgia,serif;font-size:16px}
.main{grid-column:2;min-width:0;width:100%;overflow:auto;padding:40px clamp(28px,6vw,96px) 100px;scroll-behavior:smooth;background:radial-gradient(circle at 50% 18%,color-mix(in srgb,var(--vscode-focusBorder) 4%,transparent),transparent 34%)}
.toolbar{position:fixed;left:calc(var(--sidebar) + 10px);top:58px;width:64px;max-height:calc(100vh - 76px);background:var(--panel);z-index:80;padding:9px 7px;display:flex;flex-direction:column;align-items:center;gap:6px;border:1px solid var(--line-strong);border-radius:11px;overflow:visible;box-shadow:0 14px 34px rgba(0,0,0,.28);transform:translateX(-12px);opacity:0;pointer-events:none;transition:transform .14s ease,opacity .14s ease,left .16s ease}
body.tools-open .toolbar{transform:translateX(0);opacity:1;pointer-events:auto}
body.nav-closed .toolbar{left:10px}
body.focus-mode .toolbar{left:10px;top:58px}
.floating-actions{position:fixed;left:calc(var(--sidebar) + 10px);top:56px;z-index:90;display:flex;gap:6px;transition:left .16s ease}
body.nav-closed .floating-actions,body.focus-mode .floating-actions{left:10px}
.floating-btn{width:34px;height:34px;border-radius:8px;border:1px solid var(--line-strong);background:var(--panel);color:var(--vscode-foreground);cursor:pointer;display:grid;place-items:center;box-shadow:0 5px 15px rgba(0,0,0,.18)}
.floating-btn:hover{background:var(--hover)}
.focus-exit{display:none}
.menu{position:relative;width:100%}
.menu-trigger,.rail-action{appearance:none;background:transparent;color:var(--vscode-foreground);width:100%;height:52px;padding:5px 2px;border:1px solid transparent;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer}
.menu-trigger:hover,.rail-action:hover{background:var(--hover);border-color:var(--line)}
.menu-trigger.open{background:var(--active);color:var(--active-fg);border-color:var(--vscode-focusBorder)}
.tool-icon{display:grid;place-items:center;width:23px;height:23px;font-size:18px;line-height:1;font-weight:600}
.tool-label{font-size:9px;line-height:1;text-transform:uppercase;letter-spacing:.55px;opacity:.82}
.menu-panel{display:none;position:absolute;top:0;left:calc(100% + 10px);min-width:225px;padding:7px;background:var(--vscode-menu-background,var(--vscode-editorWidget-background));border:1px solid var(--vscode-menu-border,var(--line-strong));border-radius:9px;box-shadow:0 12px 34px rgba(0,0,0,.32);z-index:30}
.menu-panel::before{content:"";position:absolute;left:-6px;top:19px;width:10px;height:10px;background:inherit;border-left:1px solid var(--line-strong);border-bottom:1px solid var(--line-strong);transform:rotate(45deg)}
.menu-panel.open{display:grid;grid-template-columns:1fr;gap:2px}
.menu-panel button{position:relative;text-align:left;width:100%;background:transparent;color:var(--vscode-menu-foreground,var(--vscode-foreground));border:0;border-radius:6px;padding:9px 10px;cursor:pointer;font:inherit}
.menu-panel button:hover{background:var(--vscode-menu-selectionBackground,var(--hover));color:var(--vscode-menu-selectionForeground,var(--vscode-foreground))}
.menu-panel .menu-title{padding:5px 10px 7px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.7px;border-bottom:1px solid var(--line);margin-bottom:3px}
.toolbar .spacer{flex:1}
.toolbar .divider{height:1px;width:38px;background:var(--line);margin:5px 0}
.beamer-only.hidden{display:none}
.inline-key{font-weight:650;color:var(--vscode-textLink-foreground)}
.inline-alert{font-weight:650;color:var(--vscode-errorForeground)}
.inline-math{display:inline-block;vertical-align:baseline;padding:0 .08em;cursor:default}.inline-math .katex{font-size:1.04em}
.section{font-size:10px;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin:18px 8px 5px}
.frame-link{position:relative;margin:3px 0;padding:9px 9px 9px 12px;border:1px solid transparent;border-radius:8px;cursor:pointer;font-size:12px;line-height:1.35;color:var(--vscode-sideBar-foreground,var(--vscode-foreground));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .12s ease,border-color .12s ease,transform .12s ease}
.frame-link::before{content:"";position:absolute;left:2px;top:10px;bottom:10px;width:2px;border-radius:2px;background:transparent}
.frame-link:hover{background:var(--hover);border-color:var(--line);transform:translateX(1px)}
.frame-link.active{background:color-mix(in srgb,var(--vscode-list-inactiveSelectionBackground,var(--hover)) 88%,transparent);border-color:color-mix(in srgb,var(--vscode-focusBorder) 45%,transparent);font-weight:600}
.frame-link.active::before{background:var(--vscode-focusBorder)}
.nav-group{margin:7px 0 3px}.nav-group-title{display:flex;align-items:center;gap:6px;margin:12px 5px 5px;padding:5px 6px;border-radius:6px;color:var(--vscode-sideBar-foreground,var(--vscode-foreground));font-size:11px;font-weight:650;cursor:pointer;user-select:none}.nav-group-title:hover{background:var(--hover)}.nav-group-title .chev{width:12px;color:var(--muted);font-size:10px}.nav-group.collapsed>.nav-group-body{display:none}.nav-subgroup-title{display:flex;align-items:center;gap:5px;margin:7px 7px 4px 13px;padding:4px 5px;border-radius:5px;color:var(--muted);font-size:10px;font-weight:600;cursor:pointer}.nav-subgroup-title:hover{background:var(--hover);color:var(--vscode-foreground)}.nav-subgroup.collapsed>.nav-subgroup-body{display:none}
.thumb-card{position:relative;margin:7px 3px 10px;padding:6px 6px 7px;border:1px solid transparent;border-radius:9px;cursor:pointer;transition:background .12s ease,border-color .12s ease,transform .12s ease}.thumb-card:hover{background:var(--hover);border-color:var(--line);transform:translateX(1px)}.thumb-card.active{background:color-mix(in srgb,var(--vscode-list-inactiveSelectionBackground,var(--hover)) 88%,transparent);border-color:color-mix(in srgb,var(--vscode-focusBorder) 65%,transparent)}.thumb-slide{position:relative;width:100%;aspect-ratio:var(--slide-aspect);overflow:hidden;background:var(--paper);border:1px solid var(--line-strong);border-radius:5px;box-shadow:0 3px 10px rgba(0,0,0,.10);padding:9px 10px;color:var(--vscode-editor-foreground)}.thumb-title{font-size:9px;line-height:1.1;font-weight:700;margin:0 0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.thumb-body{font-size:5.7px;line-height:1.25;opacity:.86;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap}.thumb-body ul,.thumb-body ol{margin:2px 0 0 9px;padding:0}.thumb-body li{margin:1px 0}.thumb-math{font-family:serif;font-style:italic;text-align:center;margin:3px 0}.thumb-label{display:flex;align-items:center;gap:6px;padding:5px 2px 0;font-size:10.5px;color:var(--vscode-sideBar-foreground,var(--vscode-foreground))}.thumb-number{color:var(--muted);font-variant-numeric:tabular-nums;min-width:16px}.thumb-title-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.thumb-card.active .thumb-label{font-weight:650}.thumb-card.active::before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:2px;border-radius:2px;background:var(--vscode-focusBorder)}
.slide{width:min(960px,calc((100vh - 170px) * var(--slide-aspect-number)),100%);aspect-ratio:var(--slide-aspect);min-height:0;margin:8px auto;padding:2.65em 3.15em 2.7em;background:var(--paper);border:1px solid color-mix(in srgb,var(--line-strong) 78%,transparent);border-radius:10px;box-shadow:0 26px 70px rgba(0,0,0,.18),0 4px 14px rgba(0,0,0,.10);position:relative;overflow:hidden;display:flex;flex-direction:column;font-size:var(--slide-body-size);line-height:var(--slide-line-height)}
.slide::after{content:"";position:absolute;inset:0;pointer-events:none;border-radius:10px;box-shadow:inset 0 1px 0 color-mix(in srgb,white 10%,transparent)}
.title{font-size:var(--slide-title-size);font-weight:650;line-height:1.15;margin:0 0 1.05em;outline:none;border-bottom:1px solid transparent;padding:.12em .2em .22em;text-align:left;letter-spacing:-.2px;flex:0 0 auto}
.title:hover{background:color-mix(in srgb,var(--hover) 55%,transparent);border-radius:5px}
.title:focus{border-color:var(--vscode-focusBorder);background:color-mix(in srgb,var(--hover) 70%,transparent);border-radius:5px}
.block{margin:15px 0;position:relative;border-radius:7px;transition:background .12s ease,box-shadow .12s ease}
.block:hover{background:color-mix(in srgb,var(--hover) 35%,transparent);box-shadow:0 0 0 5px color-mix(in srgb,var(--hover) 25%,transparent)}
.editable{outline:none;border:1px solid transparent;border-radius:5px;padding:.28em .35em;white-space:pre-wrap;line-height:var(--slide-line-height);min-height:1.55em;font-size:1em}
.editable:hover{border-color:var(--line)}
.editable:focus{border-color:var(--vscode-focusBorder);background:var(--vscode-input-background);box-shadow:0 0 0 1px color-mix(in srgb,var(--vscode-focusBorder) 45%,transparent)}
.list-editor{padding-left:1.85em;text-align:left;line-height:var(--slide-line-height);font-size:1em}
.list-editor .list-editor{margin-top:6px;padding-left:25px}
.list-item{margin:.42em 0;padding-left:.08em}
.item-text{display:inline-block;width:calc(100% - 2px);vertical-align:top}
.align-left{text-align:left}.align-center{text-align:center}.align-right{text-align:right}.align-justify{text-align:justify;text-justify:inter-word}
.align-center.list-editor,.align-right.list-editor{display:inline-block;min-width:55%;vertical-align:top}.align-center.list-editor{margin-left:22%;margin-right:22%}.align-right.list-editor{margin-left:45%}
.beamer-block{border:1px solid var(--line-strong);border-radius:8px;overflow:hidden;background:color-mix(in srgb,var(--paper) 96%,var(--vscode-editorWidget-background));box-shadow:0 3px 12px rgba(0,0,0,.08)}
.beamer-block:hover{box-shadow:0 5px 18px rgba(0,0,0,.13)}
.beamer-block .head{padding:8px 12px;font-weight:650;background:var(--vscode-editorWidget-background);border-bottom:1px solid var(--line)}
.beamer-block.alert .head{background:color-mix(in srgb,var(--vscode-inputValidation-errorBackground) 82%,var(--paper));color:var(--vscode-inputValidation-errorForeground,var(--vscode-foreground))}
.beamer-block.example .head{background:color-mix(in srgb,var(--vscode-testing-iconPassed) 20%,var(--paper))}
.beamer-block .body{padding:12px}
.math,.raw,.figure,.columns{border:1px solid var(--line);border-radius:8px;padding:13px 15px;margin:15px 0;background:color-mix(in srgb,var(--paper) 96%,var(--vscode-editorWidget-background))}
.math{text-align:center;overflow:auto;padding-top:16px;padding-bottom:16px}
.math .render{font-size:1.04em;padding:.35em 0}
.figure-card{padding:10px 12px 12px!important;background:color-mix(in srgb,var(--paper) 98%,var(--vscode-editorWidget-background))!important}
.figure-head{display:flex;align-items:center;gap:8px;margin-bottom:9px;color:var(--muted);font-size:11px}
.figure-head .figure-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--vscode-editor-font-family,monospace)}
.figure-head label{display:flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap}
.figure-stage{position:relative;min-height:130px;padding:14px;border:1px dashed var(--line-strong);border-radius:8px;background:color-mix(in srgb,var(--vscode-editor-background) 75%,transparent);overflow:visible}
.figure-stage.align-center{display:flex;justify-content:center}.figure-stage.align-right{display:flex;justify-content:flex-end}.figure-stage.align-left{display:flex;justify-content:flex-start}
.figure-visual{position:relative;display:inline-block;max-width:100%;min-width:60px;user-select:none;vertical-align:top}
.figure-visual img,.figure-visual object,.figure-visual embed{display:block;width:100%;height:100%;max-width:100%;border:0;background:transparent;object-fit:contain;pointer-events:none}
.figure-visual.pdf{min-height:260px}.figure-visual.pdf object,.figure-visual.pdf embed{min-height:260px}
.figure-placeholder{display:grid;place-items:center;min-height:150px;padding:20px;border:1px solid var(--line);border-radius:6px;color:var(--muted);text-align:center;background:var(--paper)}
.figure-resize{position:absolute;right:-7px;bottom:-7px;width:15px;height:15px;border-radius:4px;background:var(--vscode-button-background);border:2px solid var(--paper);box-shadow:0 1px 5px rgba(0,0,0,.35);cursor:nwse-resize;pointer-events:auto}
.figure-size{position:absolute;right:9px;top:9px;padding:3px 6px;border-radius:5px;background:color-mix(in srgb,var(--panel) 90%,transparent);border:1px solid var(--line);font-size:10px;color:var(--muted);pointer-events:none}
.figure-caption{margin-top:9px;text-align:center;color:var(--muted);font-size:11px}
.figure-controls{display:flex;gap:7px;align-items:center}.figure-controls input[type=number]{width:54px;padding:3px 4px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,var(--line));border-radius:4px;font:inherit}
body.figure-resizing{cursor:nwse-resize!important}body.figure-resizing *{user-select:none!important}
.raw pre{white-space:pre-wrap;color:var(--muted);font-size:12px;line-height:1.45;margin:6px 0 0}
.tag{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.65px;margin-bottom:7px}
.preamble-link{margin:10px 0 6px;padding:9px 10px;border:1px solid var(--line);border-radius:7px;cursor:pointer;font-weight:600}
.preamble-link:hover{background:var(--hover)}
.preamble-link.active{background:var(--vscode-list-inactiveSelectionBackground,var(--hover));border-color:var(--vscode-focusBorder)}
.preamble-editor{width:min(1080px,100%);margin:0 auto;background:var(--paper);border:1px solid var(--line-strong);border-radius:10px;box-shadow:0 16px 40px rgba(0,0,0,.14);overflow:hidden}
.preamble-head{display:flex;gap:10px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--line);background:var(--vscode-editorWidget-background)}
.preamble-head select{flex:1;min-width:0;background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground);border:1px solid var(--vscode-dropdown-border,var(--line));padding:7px 9px;border-radius:5px}
.preamble-head button{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:0;border-radius:5px;padding:8px 12px;cursor:pointer}
.preamble-head button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
.preamble-code{display:block;width:100%;min-height:620px;resize:vertical;border:0;outline:none;padding:18px 20px;background:var(--vscode-editor-background);color:var(--vscode-editor-foreground);font-family:var(--vscode-editor-font-family,monospace);font-size:var(--vscode-editor-font-size,13px);line-height:1.55;tab-size:2}
.empty{color:var(--muted);padding:54px;text-align:center}
.title-page{display:flex;flex-direction:column;justify-content:center}
body{display:flex;flex-direction:column}
.topbar{height:48px;flex:0 0 48px;display:flex;align-items:center;gap:12px;padding:0 14px;background:var(--panel);border-bottom:1px solid var(--line-strong);z-index:60}
.topbar-brand{display:flex;align-items:center;gap:8px;font-weight:650;min-width:170px}.topbar-brand .brand-mark{width:24px;height:24px}
.mode-tabs{display:flex;gap:3px;background:color-mix(in srgb,var(--vscode-editor-background) 75%,transparent);border:1px solid var(--line);padding:3px;border-radius:8px}
.mode-tab,.top-action{appearance:none;border:0;background:transparent;color:var(--vscode-foreground);font:inherit;padding:6px 11px;border-radius:6px;cursor:pointer}
.mode-tab:hover,.top-action:hover{background:var(--hover)}.mode-tab.active{background:var(--active);color:var(--active-fg)}
.top-separator{width:1px;height:22px;background:var(--line-strong);margin:0 5px;flex:0 0 auto}.save-status{min-width:92px;text-align:right;color:var(--muted);font-size:11px;white-space:nowrap}.save-status.error{color:var(--vscode-errorForeground)}
.topbar-spacer{flex:1}.top-action.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
#app{height:calc(100vh - 48px)}
.workspace{height:100%;min-height:0}.split-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,.85fr);height:100%;gap:1px;background:var(--line-strong)}
.split-pane{min-width:0;overflow:auto;background:var(--canvas);padding:26px}.split-pane.source-pane{padding:0;background:var(--vscode-editor-background)}
.source-shell{width:min(1180px,100%);margin:0 auto;background:var(--vscode-editor-background);border:1px solid var(--line-strong);border-radius:10px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.14)}
.source-head{height:46px;display:flex;align-items:center;gap:10px;padding:0 12px;border-bottom:1px solid var(--line);background:var(--vscode-editorWidget-background)}
.source-head select{flex:1;min-width:0;background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground);border:1px solid var(--vscode-dropdown-border,var(--line));padding:6px 8px;border-radius:5px}
.source-head button{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:0;border-radius:5px;padding:7px 11px;cursor:pointer}
.source-code{display:block;width:100%;height:calc(100vh - 145px);min-height:520px;resize:none;border:0;outline:none;padding:18px 20px;background:var(--vscode-editor-background);color:var(--vscode-editor-foreground);font-family:var(--vscode-editor-font-family,monospace);font-size:var(--vscode-editor-font-size,13px);line-height:1.55;tab-size:2}
.pdf-shell{height:100%;display:flex;flex-direction:column;background:var(--vscode-editor-background)}.pdf-head{height:44px;display:flex;align-items:center;padding:0 12px;border-bottom:1px solid var(--line);gap:10px}.pdf-head span{flex:1;color:var(--muted)}
.pdf-frame{width:100%;flex:1;border:0;background:#777}.pdf-empty{display:grid;place-items:center;height:100%;padding:40px;color:var(--muted);text-align:center}
@media(max-width:1100px){.topbar-brand{min-width:auto}.topbar-brand span:last-child{display:none}.split-workspace{grid-template-columns:1fr}.split-pane.source-pane{display:none}}

.document-continuous-wrap{display:flex;justify-content:center;padding:18px 0 82px}.document-continuous{box-sizing:border-box;width:min(900px,calc(100% - 24px));min-height:520px;margin:0 auto;background:var(--paper);border:1px solid color-mix(in srgb,var(--line-strong) 62%,transparent);border-radius:5px;box-shadow:0 14px 42px rgba(0,0,0,.14);padding:58px 72px 72px;font-size:16px;line-height:1.58;color:var(--fg);position:relative}.document-continuous .doc-editable{outline:none;border-radius:4px;transition:background .12s,box-shadow .12s}.document-continuous .doc-editable:hover{background:color-mix(in srgb,var(--paper) 96%,var(--fg) 4%)}.document-continuous .doc-editable:focus{background:color-mix(in srgb,var(--paper) 94%,var(--accent) 6%);box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 45%,transparent)}
.document-pages{--doc-page-ratio:.7071;--doc-page-pad-x:72px;--doc-page-pad-top:64px;--doc-page-pad-bottom:70px;display:flex;flex-direction:column;align-items:center;gap:34px;padding:10px 0 82px}.document-sheet{box-sizing:border-box;width:min(794px,calc(100% - 24px));aspect-ratio:var(--doc-page-ratio);margin:0 auto;background:var(--paper);border:1px solid color-mix(in srgb,var(--line-strong) 76%,transparent);border-radius:5px;box-shadow:0 18px 52px rgba(0,0,0,.18);padding:var(--doc-page-pad-top) var(--doc-page-pad-x) var(--doc-page-pad-bottom);font-size:16px;line-height:1.58;color:var(--fg);overflow:hidden;position:relative}.document-page-content{height:100%;overflow:hidden}.document-page-number{position:absolute;bottom:18px;left:0;right:0;text-align:center;color:var(--muted);font-size:11px;opacity:.68;pointer-events:none}.document-sheet.page-overflow{box-shadow:0 0 0 1px color-mix(in srgb,var(--vscode-errorForeground) 55%,transparent),0 18px 52px rgba(0,0,0,.18)}.document-sheet.page-overflow:after{content:'Approx. page overflow';position:absolute;right:14px;bottom:15px;padding:3px 6px;border-radius:5px;background:var(--vscode-inputValidation-errorBackground,color-mix(in srgb,var(--vscode-errorForeground) 16%,var(--paper)));color:var(--vscode-inputValidation-errorForeground,var(--vscode-errorForeground));font-size:10px;font-weight:650}.doc-page-break-note{position:absolute;left:14px;bottom:16px;color:var(--muted);font-size:10px;opacity:.55;pointer-events:none}
.doc-title{text-align:center;margin:18px 0 58px}.doc-title h1{font-size:2.05em;margin:0 0 12px;font-weight:650}.doc-title>div{color:var(--muted);margin-top:5px}.doc-heading{scroll-margin-top:72px;color:var(--fg);font-weight:650}.doc-heading.level-1{font-size:1.85em;margin:46px 0 22px}.doc-heading.level-2{font-size:1.55em;margin:38px 0 18px}.doc-heading.level-3{font-size:1.27em;margin:30px 0 14px}.doc-heading.level-4{font-size:1.1em;margin:24px 0 12px}.doc-paragraph{margin:0 0 18px;white-space:pre-wrap}.doc-list{margin:10px 0 22px;padding-left:2.1em}.doc-list li{margin:6px 0}.doc-math{position:relative;margin:24px 0;text-align:center;overflow-x:auto;padding:0 2.2em}.doc-equation-number{position:absolute;right:.2em;top:50%;transform:translateY(-50%);font-size:.9em;color:var(--muted)}.doc-code{font-family:var(--vscode-editor-font-family,monospace);font-size:.92em;background:color-mix(in srgb,var(--paper) 88%,var(--fg) 12%);padding:.08em .28em;border-radius:4px}.doc-latex-block{margin:22px 0;padding:14px 18px;border-left:3px solid var(--accent);background:color-mix(in srgb,var(--paper) 92%,var(--accent) 8%)}.doc-block-title{font-weight:650;margin-bottom:8px}.doc-figure-placeholder{margin:24px auto;padding:32px;border:1px dashed var(--line-strong);text-align:center;color:var(--muted);border-radius:8px}.doc-raw{margin:20px 0;padding:12px 14px;border:1px solid var(--line);border-radius:6px;color:var(--muted);font-size:.9em}.doc-raw pre{white-space:pre-wrap;margin:8px 0 0}.doc-mode-note{text-align:right;color:var(--muted);font-size:11px;margin-top:54px}.doc-outline{padding:7px 10px;border-radius:6px;cursor:pointer;color:var(--muted);line-height:1.25}.doc-outline:hover{background:var(--hover);color:var(--fg)}.doc-outline.level-1{font-weight:700;color:var(--fg);margin-top:9px}.doc-outline.level-2{font-weight:600;color:var(--fg);margin-top:7px}.doc-outline.level-3{padding-left:20px;font-size:.94em}.doc-outline.level-4{padding-left:30px;font-size:.9em}.doc-outline-empty{padding:12px 10px;color:var(--muted);font-size:.9em}.doc-outline-matter{margin:14px 8px 5px;padding-top:8px;border-top:1px solid var(--line);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.doc-heading.starred:before{content:'◇ ';color:var(--muted);font-size:.72em;vertical-align:.15em}.doc-toc{margin:28px 0 44px;padding:24px 26px;border:1px solid var(--line);border-radius:9px;background:color-mix(in srgb,var(--paper) 98%,var(--fg) 2%)}.doc-toc h2{font-size:1.45em;margin:0 0 16px}.doc-toc-row{display:grid;grid-template-columns:4.7em 1fr;width:100%;border:0;background:transparent;color:var(--fg);font:inherit;text-align:left;padding:5px 4px;border-radius:4px;cursor:pointer}.doc-toc-row:hover{background:var(--hover)}.doc-toc-row.level-2{padding-left:14px}.doc-toc-row.level-3{padding-left:28px}.doc-toc-row.level-4{padding-left:42px;font-size:.94em}.doc-toc-number{font-variant-numeric:tabular-nums;color:var(--muted)}.doc-toc-note,.doc-toc-empty{margin-top:13px;font-size:.82em;color:var(--muted)}.document-pane{overflow:auto;padding:0 18px}.document-pane .document-pages{padding-top:10px}.document-pane .document-continuous-wrap{padding-top:10px}.document-pane .document-continuous{padding:44px 48px 54px}.document-pane .document-sheet{--doc-page-pad-x:48px;--doc-page-pad-top:44px;--doc-page-pad-bottom:54px}.workspace>.document-pages{padding-top:18px}.document-sheet .doc-editable{outline:none;border-radius:4px;transition:background .12s,box-shadow .12s}.document-sheet .doc-editable:hover{background:color-mix(in srgb,var(--paper) 96%,var(--fg) 4%)}.document-sheet .doc-editable:focus{background:color-mix(in srgb,var(--paper) 94%,var(--accent) 6%);box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 45%,transparent)}.doc-item-editable{min-height:1.4em;padding:1px 3px}.doc-math{cursor:default}.doc-math:hover{background:color-mix(in srgb,var(--paper) 96%,var(--accent) 4%);border-radius:6px}

@media(max-width:900px){:root{--sidebar:190px;--toolrail:58px}.main{padding:22px}.slide{padding:30px 34px;min-height:480px}.tool-label{display:none}.menu-trigger,.rail-action{height:45px}.topbar-brand span:last-child{display:none}.mode-tab{padding:6px 8px}}

.math{cursor:pointer;position:relative;transition:border-color .12s ease,box-shadow .12s ease}
.math:hover{border-color:var(--vscode-focusBorder);box-shadow:0 0 0 1px color-mix(in srgb,var(--vscode-focusBorder) 35%,transparent)}
.math:after{content:'Double-click to edit';position:absolute;right:10px;top:8px;font-size:10px;color:var(--muted);opacity:0;transition:opacity .12s ease}
.math:hover:after{opacity:1}
.trailing-paragraph{min-height:1.7em;margin-top:8px;padding:5px 7px;border-radius:5px;outline:none;color:var(--vscode-editor-foreground);border:1px solid transparent}
.trailing-paragraph:empty:before{content:attr(data-placeholder);color:var(--muted);opacity:.55;pointer-events:none}
.trailing-paragraph:hover{border-color:color-mix(in srgb,var(--line-strong) 55%,transparent)}
.trailing-paragraph:focus{border-color:var(--vscode-focusBorder);background:color-mix(in srgb,var(--paper) 97%,var(--vscode-editorWidget-background))}
.blocks-host{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;position:relative}.slide.v-top .blocks-host{justify-content:flex-start}.slide.v-bottom .blocks-host{justify-content:flex-end}.slide-fit{position:absolute;right:12px;bottom:9px;z-index:4;font-size:10px;line-height:1;padding:4px 6px;border-radius:5px;color:var(--muted);background:color-mix(in srgb,var(--paper) 78%,transparent);opacity:.32;pointer-events:none;transition:opacity .15s ease,background .15s ease,color .15s ease}.slide:hover .slide-fit{opacity:.7}.slide-fit.overflow{opacity:1;color:var(--vscode-inputValidation-errorForeground,var(--vscode-errorForeground));background:var(--vscode-inputValidation-errorBackground,color-mix(in srgb,var(--vscode-errorForeground) 18%,var(--paper)));font-weight:650}.slide.overflowing{box-shadow:0 0 0 1px color-mix(in srgb,var(--vscode-errorForeground) 65%,transparent),0 26px 70px rgba(0,0,0,.18)}
.math-caret-anchor{display:inline;min-width:1px}
.math-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.44);display:none;align-items:center;justify-content:center;z-index:500;padding:24px}
.math-modal-backdrop.open{display:flex}
.math-modal{width:min(920px,96vw);max-height:92vh;display:flex;flex-direction:column;background:var(--vscode-editorWidget-background);border:1px solid var(--line-strong);border-radius:12px;box-shadow:0 28px 80px rgba(0,0,0,.42);overflow:hidden}
.math-modal-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);font-weight:650}
.math-modal-head .spacer{flex:1}.math-modal-head button{border:0;background:transparent;color:var(--vscode-foreground);font:inherit;cursor:pointer;border-radius:5px;padding:5px 8px}.math-modal-head button:hover{background:var(--hover)}
.math-editor-body{overflow:auto;padding:14px;display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:14px}
.math-main{min-width:0}.math-preview{min-height:130px;display:grid;place-items:center;overflow:auto;border:1px solid var(--line);border-radius:8px;background:var(--vscode-editor-background);padding:18px;margin-bottom:10px;font-size:1.12em}
.math-code{width:100%;min-height:150px;resize:vertical;border:1px solid var(--line-strong);border-radius:7px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);font-family:var(--vscode-editor-font-family,monospace);font-size:14px;line-height:1.55;padding:11px 12px;outline:none}.math-code:focus{border-color:var(--vscode-focusBorder)}
.math-help{font-size:11px;color:var(--muted);padding-top:7px}
.symbol-panel{border-left:1px solid var(--line);padding-left:14px;min-width:0}.symbol-tabs{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}.symbol-tab{border:1px solid var(--line);background:transparent;color:var(--vscode-foreground);border-radius:5px;padding:5px 7px;cursor:pointer;font-size:11px}.symbol-tab.active,.symbol-tab:hover{background:var(--active);color:var(--active-fg)}
.symbol-grid{display:grid;grid-template-columns:repeat(5,minmax(34px,1fr));gap:6px}.symbol-btn{height:36px;border:1px solid var(--line);background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border-radius:6px;cursor:pointer;font-size:16px}.symbol-btn:hover{border-color:var(--vscode-focusBorder);background:var(--hover)}
.math-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:11px 14px;border-top:1px solid var(--line)}.math-modal-foot button{border:0;border-radius:6px;padding:8px 14px;cursor:pointer;font:inherit}.math-cancel{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}.math-save{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
@media(max-width:760px){.math-editor-body{grid-template-columns:1fr}.symbol-panel{border-left:0;border-top:1px solid var(--line);padding-left:0;padding-top:12px}.symbol-grid{grid-template-columns:repeat(8,minmax(32px,1fr))}}

.topbar{height:48px;display:flex;align-items:center;gap:7px;padding:0 10px;border-bottom:1px solid var(--line);background:var(--panel);position:relative;z-index:100}
.topbar-brand{display:flex;align-items:center;gap:8px;font-weight:650;margin-right:8px}
.topbar-spacer{flex:1}
.top-action{appearance:none;border:0;background:transparent;color:var(--vscode-foreground);padding:7px 9px;border-radius:6px;cursor:pointer;font:inherit;white-space:nowrap}
.top-action:hover{background:var(--hover)}
.top-action.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.top-separator{width:1px;height:22px;background:var(--line-strong);margin:0 3px}
.top-menu{position:relative}
.top-menu-panel{display:none;position:absolute;left:0;right:auto;top:calc(100% + 7px);min-width:190px;padding:6px;background:var(--vscode-menu-background,var(--vscode-editorWidget-background));border:1px solid var(--line-strong);border-radius:8px;box-shadow:0 12px 28px rgba(0,0,0,.32)}
.top-menu.open .top-menu-panel{display:block}.menu-label{font-weight:600}
.top-menu-panel button{display:block;width:100%;text-align:left;border:0;background:transparent;color:var(--vscode-foreground);padding:8px 10px;border-radius:5px;cursor:pointer;font:inherit}
.top-menu-panel .menu-divider{display:block;height:1px;background:var(--border);margin:5px 6px}.top-menu-panel button:hover{background:var(--hover)}
.nav-section{margin:14px 5px 4px;padding:4px 5px;font-size:11px;font-weight:700;color:var(--vscode-foreground)}
.nav-subsection{margin:8px 5px 3px 14px;padding:3px 5px;font-size:10px;font-weight:650;color:var(--muted)}
.nav-subsection + .frame-link,.nav-section + .frame-link{margin-top:2px}

@media(max-width:1050px){#app,body.nav-open #app,body.nav-closed #app{grid-template-columns:0 minmax(0,1fr)}.side{position:fixed;left:0;top:48px;bottom:0;width:min(240px,82vw);z-index:120;box-shadow:12px 0 30px rgba(0,0,0,.32);transform:translateX(-105%);opacity:0;pointer-events:none}.side::-webkit-scrollbar{width:8px}body.nav-open .side{transform:translateX(0);opacity:1;pointer-events:auto}body.nav-closed .side{transform:translateX(-105%);opacity:0;pointer-events:none}.main{min-width:0;width:100%;padding:12px 10px 70px}.slide{width:100%;margin:0;padding:2.15em 2.5em 2.25em;border-radius:8px}.floating-actions,body.nav-open .floating-actions,body.nav-closed .floating-actions{left:10px}.toolbar,body.nav-open .toolbar,body.nav-closed .toolbar{left:10px}}
[contenteditable="true"][data-placeholder]:empty:before{content:attr(data-placeholder);color:var(--muted);pointer-events:none;font-style:italic;}
/* TeXFlow 0.8 visual refresh */
.side #nav{padding-top:6px}.section{margin-top:16px;opacity:.75}.nav-section{border-top:1px solid var(--line);padding-top:10px;margin-top:14px}.nav-subsection{opacity:.82}.preamble-link{margin-top:8px;background:color-mix(in srgb,var(--vscode-editor-background) 45%,transparent)}
.topbar{backdrop-filter:blur(12px);box-shadow:0 1px 0 rgba(0,0,0,.08)}.topbar-brand{letter-spacing:.1px}.mode-tabs{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--line) 35%,transparent)}.mode-tab.active{box-shadow:0 1px 4px rgba(0,0,0,.16)}.save-status{padding:4px 7px;border-radius:999px;background:color-mix(in srgb,var(--vscode-testing-iconPassed) 9%,transparent)}
.slide:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:color-mix(in srgb,var(--vscode-focusBorder) 55%,transparent);opacity:.55}.slide .blocks-host{position:relative;z-index:1}.title{position:relative;z-index:1}.block{margin:12px 0}.block:hover{box-shadow:0 0 0 4px color-mix(in srgb,var(--hover) 18%,transparent)}
.floating-btn{border-radius:10px;backdrop-filter:blur(10px)}.toolbar{border-radius:12px;backdrop-filter:blur(14px)}

</style></head><body class="nav-open"><header class="topbar"><div class="topbar-brand"><span class="brand-mark">T</span><span>TeXFlow</span></div><div class="top-menu" id="file-menu"><button class="top-action menu-label" id="file-menu-button">File ▾</button><div class="top-menu-panel"><button id="new-document">New document…</button><span class="menu-divider"></span><button id="open-file" title="Open (Ctrl/Cmd+O)">Open…</button><button id="save-file" title="Save (Ctrl/Cmd+S)">Save</button><button id="save-as" title="Save as (Ctrl/Cmd+Shift+S)">Save as…</button></div></div><div class="top-menu" id="edit-menu"><button class="top-action menu-label" id="edit-menu-button">Edit ▾</button><div class="top-menu-panel"><button id="undo" title="Undo">↶ Undo</button><button id="redo" title="Redo">↷ Redo</button></div></div><div class="top-menu" id="new-menu"><button class="top-action menu-label" id="new-menu-button">New ▾</button><div class="top-menu-panel" id="new-menu-panel"></div></div><div class="top-menu document-only hidden" id="view-menu"><button class="top-action menu-label" id="view-menu-button">View ▾</button><div class="top-menu-panel"><button id="view-continuous">✓ Continuous</button><button id="view-pages">Pages</button></div></div><span class="top-separator"></span><nav class="mode-tabs"><button class="mode-tab active" data-view="visual">Visual</button><button class="mode-tab" data-view="source">Source</button><button class="mode-tab" data-view="split">Split</button><button class="mode-tab" data-view="pdf">PDF</button></nav><span class="top-spacer topbar-spacer"></span><button class="top-action" id="toggle-nav" title="Show or hide index">Index</button><button class="top-action" id="focus-mode" title="Focus mode">⛶</button><span class="top-separator"></span><button class="top-action primary" id="top-compile">▶ Compile</button><span class="save-status" id="save-status">Saved</span></header><div class="floating-actions"><button class="floating-btn" id="toggle-tools" title="Tools">＋</button><button class="floating-btn focus-exit" id="exit-focus" title="Exit focus mode">⛶</button></div><div id="app"><aside class="side"><div class="brand"><span class="brand-mark">T</span><span>Project</span></div><div id="nav"></div></aside><aside class="toolbar" aria-label="TeXFlow tools">
<div class="menu"><button class="menu-trigger" data-menu="page" title="Page"><span class="tool-icon">▱</span><span class="tool-label">Page</span></button><div class="menu-panel" id="menu-page"><div class="menu-title">Page</div><button class="insert" data-action="title">Title</button><button class="insert" data-action="author">Author</button><button class="insert" data-action="abstract">Abstract</button><button class="insert" data-action="paragraph">Normal text</button><button class="insert beamer-only" data-action="frame">New frame</button><button class="insert beamer-only" data-action="section">New section</button><button class="insert beamer-only" data-action="subsection">New subsection</button></div></div>
<div class="menu"><button class="menu-trigger" data-menu="text" title="Text"><span class="tool-icon">T</span><span class="tool-label">Text</span></button><div class="menu-panel" id="menu-text"><div class="menu-title">Text</div><button class="format" data-format="bold"><b>B</b>&nbsp;&nbsp;Bold</button><button class="format" data-format="italic"><i>I</i>&nbsp;&nbsp;Italic</button><button class="format" data-format="key">K&nbsp;&nbsp;Key</button><button class="format" data-format="alert">!&nbsp;&nbsp;Alert</button></div></div>
<div class="menu"><button class="menu-trigger" data-menu="list" title="Lists"><span class="tool-icon">•</span><span class="tool-label">List</span></button><div class="menu-panel" id="menu-list"><div class="menu-title">Lists</div><button class="insert" data-action="bullets">•&nbsp;&nbsp;Bulleted list</button><button class="insert" data-action="numbered">1.&nbsp;&nbsp;Numbered list</button></div></div>
<div class="menu"><button class="menu-trigger" data-menu="math" title="Math"><span class="tool-icon">∑</span><span class="tool-label">Math</span></button><div class="menu-panel" id="menu-math"><div class="menu-title">Math</div><button class="insert" data-action="inlinemath">Inline math&nbsp;&nbsp;$…$</button><button class="insert" data-action="displaymath">Display math&nbsp;&nbsp;$$…$$</button><button class="insert" data-action="equation">Numbered equation</button></div></div>
<span class="spacer"></span><div class="divider"></div><button class="rail-action" id="source" title="Open LaTeX source"><span class="tool-icon">&lt;/&gt;</span><span class="tool-label">Source</span></button><button class="rail-action" id="compile" title="Compile PDF"><span class="tool-icon">▶</span><span class="tool-label">Compile</span></button></aside><main class="main"><div id="content" class="empty">Loading…</div></main></div>
<div class="math-modal-backdrop" id="math-modal" aria-hidden="true">
  <section class="math-modal" role="dialog" aria-modal="true" aria-labelledby="math-modal-title">
    <header class="math-modal-head">
      <span id="math-modal-title">Edit equation</span><span class="spacer"></span>
      <button id="math-close" type="button" title="Close">✕</button>
    </header>
    <div class="math-editor-body">
      <div class="math-main">
        <div class="math-preview" id="math-preview"></div>
        <textarea class="math-code" id="math-code" spellcheck="false" aria-label="LaTeX equation"></textarea>
        <div class="math-help">Double-click an equation to edit it. Press ⌘/Ctrl+Enter to save.</div>
      </div>
      <aside class="symbol-panel">
        <div class="symbol-tabs" id="symbol-tabs"></div>
        <div class="symbol-grid" id="symbol-grid"></div>
      </aside>
    </div>
    <footer class="math-modal-foot">
      <button class="math-cancel" id="math-cancel" type="button">Cancel</button>
      <button class="math-save" id="math-save" type="button">Save</button>
    </footer>
  </section>
</div>
<script nonce="${nonce}" src="${katexJs}"></script>
<script nonce="${nonce}">
const vscode=acquireVsCodeApi();let frames=[],current=0,isBeamer=false,documentClass='',documentSource='',metadata={},documentLayoutMode='continuous',presentationStyle={aspectWidth:4,aspectHeight:3,aspectLabel:'4:3',baseFontPt:11,bodyFontPx:16,titleFontPx:24.8,lineHeight:1.28},preambles=[],currentPreamble='root-preamble',mode='frames',viewMode='visual',sources=[],rootUri='',pdfUri='',figureResources={};
window.addEventListener('error',e=>{const c=document.getElementById('content');if(c)c.innerHTML='<div class="empty">TeXFlow error: '+esc(e.message||'unknown error')+'</div>';});
let pdfBuildState='idle',pdfBuildMessage='';window.addEventListener('message',e=>{if(e.data.type==='compileStarted'){pdfBuildState='building';pdfBuildMessage='Compiling…';viewMode='pdf';renderWorkspace();return;}if(e.data.type==='compileFinished'){pdfBuildState='ready';pdfBuildMessage='PDF compiled and opened in the VS Code PDF viewer.';viewMode='pdf';renderWorkspace();return;}if(e.data.type==='compileFailed'){pdfBuildState='error';pdfBuildMessage=e.data.message||'Compilation failed.';viewMode='pdf';renderWorkspace();return;}if(e.data.type==='saveStatus'){const el=document.getElementById('save-status');el.textContent=e.data.state==='saving'?'Saving…':e.data.state==='error'?'Save error':(e.data.message||'Saved');el.classList.toggle('error',e.data.state==='error');if(e.data.state==='saved'){clearTimeout(window.__texflowStatusTimer);window.__texflowStatusTimer=setTimeout(()=>{el.textContent='Saved';},1600);}return;}if(e.data.type==='document'){frames=e.data.frames;isBeamer=!!e.data.isBeamer;documentClass=e.data.documentClass||'';documentSource=e.data.documentSource||'';metadata=e.data.metadata||{};presentationStyle=e.data.presentationStyle||presentationStyle;applyPresentationStyle();preambles=e.data.preambles||[];sources=e.data.sources||[];rootUri=e.data.rootUri||'';pdfUri=e.data.pdfUri||'';figureResources=e.data.figureResources||{};if(Number.isInteger(e.data.selectedFrame))current=Math.max(0,Math.min(e.data.selectedFrame,frames.length-1));if(!preambles.some(x=>x.id===currentPreamble)&&preambles[0])currentPreamble=preambles[0].id;document.querySelectorAll('.beamer-only').forEach(x=>x.classList.toggle('hidden',!isBeamer));document.querySelectorAll('.document-only').forEach(x=>x.classList.toggle('hidden',isBeamer));updateDocumentViewMenu();renderNewMenu();renderNav();if(mode==='preamble')renderPreamble(currentPreamble);else renderWorkspace();if(e.data.focusFrameTitle){requestAnimationFrame(()=>{const t=document.querySelector('.workspace .slide .title[contenteditable=true]');if(t){t.focus();const r=document.createRange();r.selectNodeContents(t);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);}});}if(e.data.focusNewMath){requestAnimationFrame(()=>{const f=frames[current];if(!f)return;const maths=parseBlocks(f.body).filter(b=>b.kind==='equation');const b=maths[maths.length-1];if(b)openMathEditor(b,current);});}}});
function esc(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
let activeEditable=null;const saveTimers=new WeakMap();function scheduleSave(el,send){const old=saveTimers.get(el);if(old)clearTimeout(old);document.getElementById('save-status').textContent='Editing…';saveTimers.set(el,setTimeout(()=>send(false),500));}function flushSave(el,send){const old=saveTimers.get(el);if(old)clearTimeout(old);send(true);}
function markdownToLatex(text){
 let x=String(text??'').replace(/\u200B/g,'');
 x=x.replace(/\*\*([^*\n]+)\*\*/g,'\\textbf{$1}');
 x=x.replace(/(^|[^*])\*([^*\n]+)\*/g,'$1\\textit{$2}');
 x=x.replace(/==([^=\n]+)==/g,'\\alert{$1}');
 return x;
}
function latexToHtml(text){
 let source=String(text??'');
 const inlineMath=[];
 source=source.replace(/\$([^$\n]+)\$/g,(_,expr)=>{const i=inlineMath.push(expr)-1;return '@@TEXFLOW_INLINE_MATH_'+i+'@@';});
 source=source.replace(/\\\(([\s\S]*?)\\\)/g,(_,expr)=>{const i=inlineMath.push(expr)-1;return '@@TEXFLOW_INLINE_MATH_'+i+'@@';});
 source=source.replace(/\\eqref\{([^}]+)\}/g,(_,label)=>'('+(documentRefs[label]??'?')+')');
 source=source.replace(/\\ref\{([^}]+)\}/g,(_,label)=>String(documentRefs[label]??'?'));
 source=source.replace(/\\today\b/g,()=>new Intl.DateTimeFormat(undefined,{day:'numeric',month:'long',year:'numeric'}).format(new Date()));
 let x=esc(source);
 x=x.replace(/\\\\(?:[ \t]*\n)?/g,'<br>');
 let prev='';
 for(let i=0;i<6&&x!==prev;i++){
  prev=x;
  x=x.replace(/\\textbf\{([^{}]*)\}/g,'<strong>$1</strong>')
     .replace(/\\(?:textit|emph)\{([^{}]*)\}/g,'<em>$1</em>')
     .replace(/\\texttt\{([^{}]*)\}/g,'<code class="doc-code">$1</code>')
     .replace(/\\key\{([^{}]*)\}/g,'<span class="inline-key" data-tex-command="key">$1</span>')
     .replace(/\\alert\{([^{}]*)\}/g,'<span class="inline-alert" data-tex-command="alert">$1</span>');
 }
 x=x.replace(/@@TEXFLOW_INLINE_MATH_(\d+)@@/g,(_,idx)=>'<span class="inline-math" contenteditable="false" data-math="'+encodeURIComponent(inlineMath[Number(idx)]||'')+'"></span><span class="math-caret-anchor">&#8203;</span>');
 return x;
}
function renderInlineMaths(root){
 if(!root)return;
 root.querySelectorAll('.inline-math').forEach(node=>{
  const tex=decodeURIComponent(node.dataset.math||'');
  node.title='Inline math: '+tex;
  try{katex.render(tex,node,{displayMode:false,throwOnError:false})}catch{node.textContent='$'+tex+'$'}
 });
}
const TEX_LINE_BREAK=String.fromCharCode(92,92,10);
const TEX_PARAGRAPH_BREAK='\n\n';
function nodeToLatex(node){
 if(node.nodeType===Node.TEXT_NODE)return markdownToLatex(node.nodeValue||'');
 if(node.nodeType!==Node.ELEMENT_NODE)return '';
 const el=node,inner=[...el.childNodes].map(nodeToLatex).join('');
 if(el.tagName==='STRONG'||el.tagName==='B')return '\\textbf{'+inner+'}';
 if(el.tagName==='EM'||el.tagName==='I')return '\\textit{'+inner+'}';
 if(el.dataset&&el.dataset.texCommand==='key')return '\\key{'+inner+'}';
 if(el.dataset&&el.dataset.texCommand==='alert')return '\\alert{'+inner+'}';
 if(el.classList&&el.classList.contains('inline-math'))return '$'+decodeURIComponent(el.dataset.math||'')+'$';
 if(el.classList&&el.classList.contains('math-caret-anchor'))return '';
 if(el.tagName==='BR')return TEX_LINE_BREAK;
 // Plain Enter creates a DIV in Chromium: serialize it as a paragraph break.
 if(el.tagName==='DIV')return (node.previousSibling?TEX_PARAGRAPH_BREAK:'')+inner;
 return inner;
}
function normalizeEditorLatex(value){
 let x=String(value||'').replace(/\r\n?/g,'\n');
 x=x.replace(/\n{3,}/g,'\n\n');
 const slash2=String.fromCharCode(92,92);
 while(x.startsWith(slash2))x=x.slice(2).replace(/^[ \t]*\n?/,'');
 while(x.trimEnd().endsWith(slash2))x=x.trimEnd().slice(0,-2);
 return x.trim();
}
function editorToLatex(el){return normalizeEditorLatex([...el.childNodes].map(nodeToLatex).join(''));}
function placeCaretEnd(el){const r=document.createRange();r.selectNodeContents(el);r.collapse(false);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);}
function attachEditor(el){
 renderInlineMaths(el);
 el.addEventListener('focus',()=>activeEditable=el);
 el.addEventListener('input',()=>{
  if(el.children.length===0&&/(\*\*[^*]+\*\*|(^|[^*])\*[^*]+\*|==[^=]+==)/.test(el.textContent||'')){
   const latex=markdownToLatex(el.textContent||'');
   if(latex!==(el.textContent||'')){el.innerHTML=latexToHtml(latex);placeCaretEnd(el);}
  }
 });
}
function editableLatex(el){return normalizeEditorLatex(editorToLatex(el));}
function insertSoftBreak(){document.execCommand('insertLineBreak');}
function caretSplit(el){
 const sel=getSelection();if(!sel||!sel.rangeCount||!el.contains(sel.anchorNode))return{text:editableLatex(el),tail:''};
 const range=sel.getRangeAt(0),before=document.createRange(),after=document.createRange();
 before.selectNodeContents(el);before.setEnd(range.startContainer,range.startOffset);
 after.selectNodeContents(el);after.setStart(range.endContainer,range.endOffset);
 const box1=document.createElement('div'),box2=document.createElement('div');box1.appendChild(before.cloneContents());box2.appendChild(after.cloneContents());
 return{text:editableLatex(box1),tail:editableLatex(box2)};
}
function setEditableLatex(el,text){el.innerHTML=latexToHtml(text||'');renderInlineMaths(el);}

function splitTopItems(inner){
 const source=String(inner||'');
 const items=[];let depth=0,start=-1,i=0;
 while(i<source.length){
  if(source.startsWith('\\begin{',i)){depth++;i+=7;continue;}
  if(source.startsWith('\\end{',i)){depth=Math.max(0,depth-1);i+=5;continue;}
  if(depth===0&&source.startsWith('\\item',i)){
   if(start>=0)items.push(source.slice(start,i).trim());
   i+=5;while(i<source.length&&/\s/.test(source[i]))i++;start=i;continue;
  }
  i++;
 }
 if(start>=0)items.push(source.slice(start).trim());
 if(!items.length&&source.trim())items.push(source.trim());
 return items;
}
function createVisualList(env,items){
 const list=document.createElement(env==='enumerate'?'ol':'ul');
 list.className='visual-list';
 (items||[]).forEach(raw=>{
  const li=document.createElement('li');li.className='list-item';
  const edit=document.createElement('div');edit.className='item-text editable';edit.contentEditable='true';
  setEditableLatex(edit,String(raw||''));attachEditor(edit);li.appendChild(edit);list.appendChild(li);
 });
 if(!list.children.length){const li=document.createElement('li');li.className='list-item';const edit=document.createElement('div');edit.className='item-text editable';edit.contentEditable='true';attachEditor(edit);li.appendChild(edit);list.appendChild(li);}
 return list;
}
function listElementToLatex(list){
 const env=list.tagName==='OL'?'enumerate':'itemize';
 const items=[...list.children].map(li=>{const text=editableLatex(li.querySelector(':scope > .item-text'));const child=li.querySelector(':scope > ul, :scope > ol');return '    \item '+text+(child?'\n'+listElementToLatex(child):'')}).join('\n');
 return '\begin{'+env+'}\n'+items+'\n\end{'+env+'}';
}
function listItemsPayload(list){return [...list.children].map(li=>{const text=editableLatex(li.querySelector(':scope > .item-text'));const child=li.querySelector(':scope > ul, :scope > ol');return text+(child?'\n'+listElementToLatex(child):'')});}
function bindListEditing(list,save){
 list.addEventListener('input',()=>scheduleSave(list,save));
 list.addEventListener('focusout',e=>{if(!list.contains(e.relatedTarget))flushSave(list,save)});
 list.addEventListener('keydown',e=>{
  const text=e.target.closest&&e.target.closest('.item-text');if(!text||!list.contains(text))return;
  const li=text.closest('li');
  if(e.key==='Enter'){
   e.preventDefault();
   if(e.shiftKey){insertSoftBreak();text.dispatchEvent(new Event('input',{bubbles:true}));return;}
   const parts=caretSplit(text);setEditableLatex(text,parts.text);
   const next=document.createElement('li');next.className='list-item';const edit=document.createElement('div');edit.className='item-text editable';edit.contentEditable='true';setEditableLatex(edit,parts.tail);attachEditor(edit);next.appendChild(edit);li.after(next);placeCaretEnd(edit);scheduleSave(list,save);return;
  }
  if(e.key==='Backspace'&&!editableLatex(text).trim()){
   const prev=li.previousElementSibling;
   if(prev){e.preventDefault();li.remove();const target=prev.querySelector(':scope > .item-text');placeCaretEnd(target);scheduleSave(list,save);}
  }
 });
}
function wrapSelection(command){
 const sel=getSelection();if(!activeEditable||!sel||sel.rangeCount===0)return;
 const range=sel.getRangeAt(0);if(!activeEditable.contains(range.commonAncestorContainer))return;
 let wrapper;
 if(command==='bold')wrapper=document.createElement('strong');
 else if(command==='italic')wrapper=document.createElement('em');
 else{wrapper=document.createElement('span');wrapper.dataset.texCommand=command;wrapper.className=command==='key'?'inline-key':'inline-alert';}
 if(range.collapsed){
  const placeholder=document.createTextNode('');wrapper.appendChild(placeholder);range.insertNode(wrapper);
  const r=document.createRange();r.setStart(wrapper,0);r.collapse(true);sel.removeAllRanges();sel.addRange(r);
 }else{
  try{range.surroundContents(wrapper)}catch{wrapper.appendChild(range.extractContents());range.insertNode(wrapper)}
  const r=document.createRange();r.selectNodeContents(wrapper);r.collapse(false);sel.removeAllRanges();sel.addRange(r);
 }
 activeEditable.focus();activeEditable.dispatchEvent(new Event('input',{bubbles:true}));
}
function navPlainText(raw){
 const tmp=document.createElement('div');tmp.innerHTML=latexToHtml(String(raw||''));return (tmp.textContent||tmp.innerText||'').replace(/\s+/g,' ').trim();
}
function thumbBodyHtml(frame){
 const blocks=parseBlocks(frame.body||'');
 if(!blocks.length)return '<div class="thumb-body"></div>';
 let html='';
 blocks.slice(0,5).forEach(b=>{
  if(b.kind==='itemize'){
   const tag=b.env==='enumerate'?'ol':'ul';const items=(b.items||[]).slice(0,4).map(it=>'<li>'+esc(navPlainText(it.text||it.raw||''))+'</li>').join('');html+='<div class="thumb-body"><'+tag+'>'+items+'</'+tag+'></div>';
  }else if(b.kind==='equation')html+='<div class="thumb-body thumb-math">'+esc((b.text||'').replace(/\\[a-zA-Z]+/g,'∑').slice(0,70))+'</div>';
  else if(b.kind==='figure')html+='<div class="thumb-body" style="text-align:center;opacity:.55">▧ Figure</div>';
  else html+='<div class="thumb-body">'+esc(navPlainText(b.text||b.raw||'').slice(0,180))+'</div>';
 });
 return html;
}
function makeThumb(f,i){
 const card=document.createElement('div');card.className='thumb-card'+(mode==='frames'&&i===current?' active':'');card.title=(f.sourceFile?f.sourceFile+' — ':'')+f.title;
 card.innerHTML='<div class="thumb-slide"><div class="thumb-title">'+esc(f.title||'Untitled')+'</div>'+thumbBodyHtml(f)+'</div><div class="thumb-label"><span class="thumb-number">'+(i+1)+'</span><span class="thumb-title-text">'+esc(f.title||'Untitled')+'</span></div>';
 card.onclick=()=>renderFrame(i);return card;
}
function collapsibleGroup(label,cls,key){
 const group=document.createElement('div');group.className=cls;const title=document.createElement('div');title.className=cls==='nav-group'?'nav-group-title':'nav-subgroup-title';const store='texflow-collapse-'+key;const collapsed=localStorage.getItem(store)==='1';if(collapsed)group.classList.add('collapsed');title.innerHTML='<span class="chev">'+(collapsed?'▸':'▾')+'</span><span>'+esc(label)+'</span>';title.onclick=()=>{group.classList.toggle('collapsed');const c=group.classList.contains('collapsed');title.querySelector('.chev').textContent=c?'▸':'▾';localStorage.setItem(store,c?'1':'0')};const body=document.createElement('div');body.className=cls==='nav-group'?'nav-group-body':'nav-subgroup-body';group.append(title,body);return{group,body};
}
function renderNav(){
 const nav=document.getElementById('nav');nav.innerHTML='';
 const p=document.createElement('div');p.className='preamble-link'+(mode==='preamble'?' active':'');p.textContent='⌘  Preamble';p.title='Edit the preamble as plain LaTeX';p.onclick=()=>renderPreamble(currentPreamble);nav.appendChild(p);
 if(!isBeamer){renderDocumentOutline(nav);return;}
 let fileBody=nav,sectionBody=null,subBody=null,lastFile='__',lastSection='__',lastSub='__';
 frames.forEach((f,i)=>{
  const file=f.sourceFile||'';
  if(file!==lastFile){lastFile=file;lastSection='__';lastSub='__';sectionBody=null;subBody=null;if(file){const h=document.createElement('div');h.className='section';h.textContent=file;nav.appendChild(h)}fileBody=nav;}
  const sec=f.section||'';
  if(sec!==lastSection){lastSection=sec;lastSub='__';subBody=null;if(sec){const g=collapsibleGroup(sec,'nav-group','sec-'+file+'-'+sec);fileBody.appendChild(g.group);sectionBody=g.body}else sectionBody=fileBody;}
  const targetSection=sectionBody||fileBody;
  const sub=f.subsection||'';
  if(sub!==lastSub){lastSub=sub;if(sub){const g=collapsibleGroup(sub,'nav-subgroup','sub-'+file+'-'+sec+'-'+sub);targetSection.appendChild(g.group);subBody=g.body}else subBody=targetSection;}
  (subBody||targetSection).appendChild(makeThumb(f,i));
 });
}


function documentBodyInfo(){
 const src=String(documentSource||''),beginToken='\\begin{document}',endToken='\\end{document}';
 const b=src.indexOf(beginToken),e=src.lastIndexOf(endToken),start=b>=0?b+beginToken.length:0,end=e>=start?e:src.length;
 return{source:src.slice(start,end),start,end};
}
function documentBodySource(){return documentBodyInfo().source;}
let documentRefs={},documentFlowById={};
function parseDocumentChunk(raw,base,out,nextId){
 const source=String(raw||'');
 function parseSegment(a,b){
  if(b<=a)return;let cur=a;const display=/\\\[([\s\S]*?)\\\]/g;display.lastIndex=a;let m;
  function pushPlain(x,y){
   if(y<=x)return;const part=source.slice(x,y);if(!part.trim())return;
   parseBlocks(part).forEach(block=>{
    const node={kind:'block',id:'doc-b'+nextId(),start:base+x+block.start,end:base+x+block.end,raw:block.raw,block};
    out.push(node);
   });
  }
  while((m=display.exec(source))&&m.index<b){if(display.lastIndex>b)break;pushPlain(cur,m.index);const rawEq=m[0];out.push({kind:'block',id:'doc-b'+nextId(),start:base+m.index,end:base+display.lastIndex,raw:rawEq,block:{id:'doc-eq',kind:'equation',raw:rawEq,env:'display',text:String(m[1]||'').trim(),align:'center'}});cur=display.lastIndex;}
  pushPlain(cur,b);
 }
 let cur=0,m;const title=/\\maketitle\b/g;
 while((m=title.exec(source))){parseSegment(cur,m.index);cur=title.lastIndex;}
 parseSegment(cur,source.length);
}
function parseDocumentFlow(){
 const info=documentBodyInfo(),body=info.source,out=[];let cur=0,n=0;const nextId=()=>n++;
 // Structural tokens are parsed in document order. Matter switches are preserved in Source
 // but are intentionally invisible in the visual body. TOC is rendered from the same
 // heading tree used by the document navigator.
 const tokenRe=/\\(chapter|section|subsection|subsubsection|paragraph)(\*)?\{([^}]*)\}|\\(tableofcontents|frontmatter|mainmatter|backmatter)\b/g;let m;
 function pushChunk(a,b){const raw=body.slice(a,b);if(!raw.trim())return;parseDocumentChunk(raw,info.start+a,out,nextId);}
 while((m=tokenRe.exec(body))){
  pushChunk(cur,m.index);
  if(m[1]){
   const command=m[1],starred=!!m[2],title=m[3]||'';
   const level=command==='chapter'?1:command==='section'?(documentClass==='article'?1:2):command==='subsection'?(documentClass==='article'?2:3):command==='subsubsection'?(documentClass==='article'?3:4):5;
   out.push({kind:'heading',id:'doc-h'+nextId(),level,title,command,starred,start:info.start+m.index,end:info.start+tokenRe.lastIndex,raw:m[0]});
  }else if(m[4]==='tableofcontents'){
   out.push({kind:'toc',id:'doc-toc'+nextId(),start:info.start+m.index,end:info.start+tokenRe.lastIndex,raw:m[0]});
  }else{
   out.push({kind:'matter',id:'doc-matter'+nextId(),matter:m[4],start:info.start+m.index,end:info.start+tokenRe.lastIndex,raw:m[0]});
  }
  cur=tokenRe.lastIndex;
 }
 pushChunk(cur,body.length);
 documentRefs={};documentFlowById={};let equationNumber=0;
 out.forEach(x=>{documentFlowById[x.id]=x;if(x.kind!=='block'||!x.block||x.block.kind!=='equation')return;const b=x.block;if(/^equation/.test(String(b.env||''))){equationNumber+=1;b.eqNumber=equationNumber;}const label=/\\label\{([^}]+)\}/.exec(String(b.text||b.raw||''));if(label&&b.eqNumber)documentRefs[label[1]]=b.eqNumber;});
 return out;
}
function renderDocumentOutline(nav){
 const title=document.createElement('div');title.className='section';title.textContent=(documentClass||'document').toUpperCase();nav.appendChild(title);
 const flow=parseDocumentFlow();let found=false;
 flow.forEach(x=>{
  if(x.kind==='matter'){
   const row=document.createElement('div');row.className='doc-outline-matter';row.textContent=x.matter==='frontmatter'?'Front matter':x.matter==='mainmatter'?'Main matter':'Back matter';nav.appendChild(row);return;
  }
  if(x.kind!=='heading')return;found=true;const row=document.createElement('div');row.className='doc-outline level-'+x.level;row.textContent=(x.starred?'◇ ':'')+(x.title||('Untitled '+x.command));row.onclick=()=>{const el=document.getElementById(x.id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});};nav.appendChild(row);
 });
 if(!found){const empty=document.createElement('div');empty.className='doc-outline-empty';empty.textContent='No sections found';nav.appendChild(empty);}
}
function documentBlockHtml(node){
 const b=node.block;
 if(b.kind==='paragraph')return '<div class="doc-paragraph doc-editable '+alignClass(b.align,'justify')+'" data-node-id="'+node.id+'" contenteditable="true">'+latexToHtml(b.text||'')+'</div>';
 if(b.kind==='itemize'){const tag=b.env==='enumerate'?'ol':'ul';const items=(b.items||[]).map(it=>'<li><div class="doc-item-editable doc-editable" contenteditable="true">'+latexToHtml(typeof it==='string'?it:(it&&it.text)||'')+'</div></li>').join('');return '<'+tag+' class="doc-list" data-node-id="'+node.id+'">'+items+'</'+tag+'>';}
 if(b.kind==='equation'){const clean=String(b.text||'').replace(/\\label\{[^}]+\}/g,'').trim();const number=b.eqNumber?'<span class="doc-equation-number">('+b.eqNumber+')</span>':'';return '<div class="doc-math" data-node-id="'+node.id+'" data-tex="'+esc(clean)+'">'+number+'</div>';}
 if(b.kind==='block')return '<div class="doc-latex-block" data-node-id="'+node.id+'"><div class="doc-block-title">'+latexToHtml(b.title||'')+'</div><div>'+latexToHtml(b.text||'')+'</div></div>';
 if(b.kind==='figure')return '<div class="doc-figure-placeholder" data-node-id="'+node.id+'">▧ '+esc(b.figurePath||'Figure')+'</div>';
 return '<div class="doc-raw" data-node-id="'+node.id+'"><span>LaTeX preserved</span><pre>'+esc(b.raw||'')+'</pre></div>';
}
function documentPageProfile(){
 const src=String(documentSource||'');let ratio=.7071,label='A4';
 if(/\bletterpaper\b/i.test(src)){ratio=8.5/11;label='Letter';}
 else if(/\blegalpaper\b/i.test(src)){ratio=8.5/14;label='Legal';}
 else if(/\ba5paper\b/i.test(src)){ratio=148/210;label='A5';}
 const gm=/\\geometry\s*\{([^}]*)\}/.exec(src);let margin='';if(gm){const mm=/\bmargin\s*=\s*([^,}]+)/.exec(gm[1]);if(mm)margin=mm[1].trim();}
 return{ratio,label,margin};
}
function documentTocHtml(flow){
 const headings=flow.filter(x=>x.kind==='heading'&&!x.starred&&x.command!=='paragraph');
 if(!headings.length)return '<section class="doc-toc"><h2>Contents</h2><div class="doc-toc-empty">No numbered headings yet.</div></section>';
 let chapter=0,section=0,subsection=0,subsubsection=0;
 const rows=headings.map(x=>{
  let number='';
  if(documentClass==='article'){
   if(x.command==='section'){section++;subsection=0;subsubsection=0;number=String(section);}
   else if(x.command==='subsection'){subsection++;subsubsection=0;number=section+'.'+subsection;}
   else if(x.command==='subsubsection'){subsubsection++;number=section+'.'+subsection+'.'+subsubsection;}
  }else{
   if(x.command==='chapter'){chapter++;section=0;subsection=0;subsubsection=0;number=String(chapter);}
   else if(x.command==='section'){section++;subsection=0;subsubsection=0;number=chapter+'.'+section;}
   else if(x.command==='subsection'){subsection++;subsubsection=0;number=chapter+'.'+section+'.'+subsection;}
   else if(x.command==='subsubsection'){subsubsection++;number=chapter+'.'+section+'.'+subsection+'.'+subsubsection;}
  }
  return '<button class="doc-toc-row level-'+x.level+'" data-target="'+x.id+'"><span class="doc-toc-number">'+esc(number)+'</span><span>'+latexToHtml(x.title||'')+'</span></button>';
 }).join('');
 return '<section class="doc-toc"><h2>Contents</h2>'+rows+'<div class="doc-toc-note">Page numbers are shown in the compiled PDF.</div></section>';
}
function documentFlowInnerHtml(){
 const flow=parseDocumentFlow();let html='';
 if(metadata.title||metadata.author){html+='<header class="doc-title"><h1>'+latexToHtml(metadata.title||'Untitled document')+'</h1>'+(metadata.author?'<div>'+latexToHtml(metadata.author)+'</div>':'')+(metadata.date?'<div class="doc-date">'+latexToHtml(metadata.date)+'</div>':'')+'</header>';}
 flow.forEach(x=>{
  if(x.kind==='matter')return;
  if(x.kind==='toc'){html+=documentTocHtml(flow);return;}
  if(x.kind==='heading'){const tag=x.level<=1?'h1':x.level===2?'h2':x.level===3?'h3':'h4';html+='<'+tag+' id="'+x.id+'" data-node-id="'+x.id+'" contenteditable="true" class="doc-heading doc-editable level-'+x.level+(x.starred?' starred':'')+'">'+latexToHtml(x.title||'')+'</'+tag+'>';return;}
  html+=documentBlockHtml(x);
 });
 return html;
}
function visualDocumentHtml(){
 const prof=documentPageProfile();const inner=documentFlowInnerHtml();
 if(documentLayoutMode!=='pages')return '<div class="document-continuous-wrap" data-paper="'+esc(prof.label)+'"><article class="document-continuous">'+inner+'<div class="doc-mode-note">Document mode · continuous · '+esc(prof.label)+(prof.margin?' · margin '+esc(prof.margin):'')+'</div></article></div>';
 return '<div class="document-pages" data-paper="'+esc(prof.label)+'" style="--doc-page-ratio:'+prof.ratio+'"><article class="document-sheet"><div class="document-page-content">'+inner+'<div class="doc-mode-note">Document mode · pages (approx.) · '+esc(prof.label)+(prof.margin?' · margin '+esc(prof.margin):'')+'</div></div><div class="document-page-number">1</div></article></div>';
}
function paginateDocumentPages(host){
 const pagesRoot=host.querySelector('.document-pages');if(!pagesRoot)return;const currentPages=[...pagesRoot.querySelectorAll(':scope > .document-sheet')];if(!currentPages.length)return;
 const nodes=[];currentPages.forEach(page=>{const content=page.querySelector('.document-page-content');if(content)nodes.push(...[...content.children]);});
 pagesRoot.innerHTML='';const prof=documentPageProfile();pagesRoot.style.setProperty('--doc-page-ratio',String(prof.ratio));
 function newPage(){const page=document.createElement('article');page.className='document-sheet';page.innerHTML='<div class="document-page-content"></div><div class="document-page-number"></div><div class="doc-page-break-note">'+prof.label+' · approximate</div>';pagesRoot.appendChild(page);return page;}
 let page=newPage(),content=page.querySelector('.document-page-content');
 nodes.forEach(node=>{content.appendChild(node);if(content.scrollHeight>content.clientHeight+3&&content.children.length>1){content.removeChild(node);page=newPage();content=page.querySelector('.document-page-content');content.appendChild(node);}if(content.scrollHeight>content.clientHeight+3&&content.children.length===1)page.classList.add('page-overflow');});
 [...pagesRoot.querySelectorAll(':scope > .document-sheet')].forEach((p,i)=>{const n=p.querySelector('.document-page-number');if(n)n.textContent=String(i+1);});
}
function scheduleDocumentPagination(host){clearTimeout(window.__texflowPageTimer);window.__texflowPageTimer=setTimeout(()=>paginateDocumentPages(host),90);}
function updateDocumentNode(node,replacement,refresh=true){
 if(!node)return;
 const start=node.start,end=node.end,expected=node.raw;
 vscode.postMessage({type:'updateDocumentNode',start,end,expected,replacement,refresh});
 // Keep the local document-flow ranges synchronized with TeXFlow's own edit.
 // Without this, the second autosave still sends the original raw text/range
 // and is rejected as if the document had changed externally.
 const delta=String(replacement).length-(end-start);
 node.raw=String(replacement);node.end=start+String(replacement).length;
 Object.values(documentFlowById||{}).forEach(other=>{
  if(!other||other===node)return;
  if(other.start>=end){other.start+=delta;other.end+=delta;}
 });
}
function serializeDocumentList(node,list){const env=node.block.env==='enumerate'?'enumerate':'itemize';const items=[...list.querySelectorAll(':scope > li > .doc-item-editable')].map(el=>editableLatex(el)).filter((x,i,a)=>x||a.length===1);return '\\begin{'+env+'}\n'+items.map(x=>'    \\item '+x).join('\n')+'\n\\end{'+env+'}';}
function bindDocumentParagraph(el,node){attachEditor(el);el.__texflowCommit=text=>updateDocumentNode(node,text,true);const save=refresh=>updateDocumentNode(node,editableLatex(el),refresh);el.addEventListener('input',()=>scheduleSave(el,save));el.addEventListener('blur',()=>flushSave(el,save));}
function bindDocumentList(list,node){
 const save=refresh=>updateDocumentNode(node,serializeDocumentList(node,list),refresh);
 list.querySelectorAll('.doc-item-editable').forEach(edit=>{attachEditor(edit);edit.__texflowCommit=text=>{setEditableLatex(edit,text);updateDocumentNode(node,serializeDocumentList(node,list),true);};});
 list.addEventListener('keydown',e=>{const edit=e.target.closest('.doc-item-editable');if(!edit)return;if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();const parts=caretSplit(edit),li=edit.closest('li');setEditableLatex(edit,parts.text);const next=document.createElement('li');next.innerHTML='<div class="doc-item-editable doc-editable" contenteditable="true"></div>';li.after(next);const ne=next.firstChild;setEditableLatex(ne,parts.tail);attachEditor(ne);ne.__texflowCommit=text=>{setEditableLatex(ne,text);updateDocumentNode(node,serializeDocumentList(node,list),true);};placeCaretEnd(ne);save(true);}else if(e.key==='Enter'&&e.shiftKey){e.preventDefault();insertSoftBreak();scheduleSave(list,save);}else if(e.key==='Backspace'&&!editableLatex(edit).trim()){const li=edit.closest('li'),prev=li.previousElementSibling;if(prev){e.preventDefault();li.remove();const target=prev.querySelector('.doc-item-editable');placeCaretEnd(target);save(true);}}});
 list.addEventListener('input',()=>scheduleSave(list,save));list.addEventListener('focusout',()=>flushSave(list,save));
}
function openDocumentMathEditor(node){mathEditing={mode:'doc-edit',node};const modal=document.getElementById('math-modal'),ta=document.getElementById('math-code');document.getElementById('math-modal-title').textContent='Edit equation';ta.value=String(node.block.text||'').replace(/\\label\{[^}]+\}/g,'').trim();modal.classList.add('open');modal.setAttribute('aria-hidden','false');renderMathPalette();updateMathPreview();setTimeout(()=>{ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length)},0);}
function bindVisualDocument(host){
 const flow=parseDocumentFlow();const byId={};flow.forEach(x=>byId[x.id]=x);
 host.querySelectorAll('.doc-heading[contenteditable=true]').forEach(el=>{const node=byId[el.dataset.nodeId];attachEditor(el);const save=refresh=>{const text=editableLatex(el);updateDocumentNode(node,'\\'+node.command+'{'+text+'}',refresh);};el.addEventListener('input',()=>scheduleSave(el,save));el.addEventListener('blur',()=>flushSave(el,save));});
 host.querySelectorAll('.doc-paragraph[contenteditable=true]').forEach(el=>bindDocumentParagraph(el,byId[el.dataset.nodeId]));host.querySelectorAll('.doc-toc-row[data-target]').forEach(el=>el.addEventListener('click',()=>{const target=host.querySelector('#'+el.dataset.target)||document.getElementById(el.dataset.target);if(target)target.scrollIntoView({behavior:'smooth',block:'start'});}));
 host.querySelectorAll('.doc-list').forEach(list=>bindDocumentList(list,byId[list.dataset.nodeId]));
 host.querySelectorAll('.doc-math').forEach(el=>{const node=byId[el.dataset.nodeId],numberText=el.querySelector('.doc-equation-number')?.textContent||'';try{katex.render(el.dataset.tex||'',el,{displayMode:true,throwOnError:false});if(numberText){const n=document.createElement('span');n.className='doc-equation-number';n.textContent=numberText;el.appendChild(n);}}catch{el.textContent=el.dataset.tex||'';}el.title='Double-click to edit equation';el.addEventListener('dblclick',()=>openDocumentMathEditor(node));});
 renderInlineMaths(host);if(documentLayoutMode==='pages'){requestAnimationFrame(()=>paginateDocumentPages(host));host.addEventListener('input',()=>scheduleDocumentPagination(host));window.addEventListener('resize',()=>scheduleDocumentPagination(host),{passive:true});}
}

function alignmentFromDirective(raw,current='justify'){
 const text=String(raw||'');
 // Last directive wins, matching normal LaTeX scoping inside the current block.
 const matches=[...text.matchAll(/\\(centering|raggedright|raggedleft|justifying)\b/g)];
 if(!matches.length)return current||'justify';
 const cmd=matches[matches.length-1][1];
 if(cmd==='centering')return 'center';
 if(cmd==='raggedright')return 'left';
 if(cmd==='raggedleft')return 'right';
 return 'justify';
}
function isOnlyAlignmentDirective(raw){
 return /^(?:\s|%[^\n]*(?:\n|$))*\\(?:centering|raggedright|raggedleft|justifying)\b\s*(?:%[^\n]*)?\s*$/.test(String(raw||''));
}
function alignClass(value,fallback='justify'){
 const align=['left','center','right','justify'].includes(value)?value:fallback;
 return 'align-'+align;
}

function parseBlocks(body){
 function findMatchingEnvEnd(source,env,from){
  // Use literal scanning instead of a dynamically-built RegExp. This avoids
  // webview escaping bugs and correctly handles nested copies of the same env.
  const open='\\begin{'+String(env)+'}';
  const close='\\end{'+String(env)+'}';
  let depth=1,pos=from;
  while(pos<source.length){
   const nextOpen=source.indexOf(open,pos);
   const nextClose=source.indexOf(close,pos);
   if(nextClose<0)return null;
   if(nextOpen>=0&&nextOpen<nextClose){depth+=1;pos=nextOpen+open.length;continue;}
   depth-=1;
   if(depth===0)return{start:nextClose,end:nextClose+close.length};
   pos=nextClose+close.length;
  }
  return null;
 }
 const out=[];const re=/\\begin\{(itemize|enumerate|block|alertblock|exampleblock|equation\*?|align\*?|gather\*?|figure|columns)\}(?:\{([^}]*)\})?|\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}|\$\$/g;let cur=0,m,n=0,currentAlign='justify';
 function text(s,e){
  const raw=body.slice(s,e);if(!raw.trim())return;
  const nextAlign=alignmentFromDirective(raw,currentAlign);
  if(isOnlyAlignmentDirective(raw)){out.push({id:'b'+n++,kind:'raw',raw,text:raw.trim(),hidden:true,align:nextAlign});currentAlign=nextAlign;return;}
  const unsafe=/\\(begin|end|input|include|hypertarget|label|only|visible|uncover|pause|vspace|hspace|includegraphics|tikz)/.test(raw);
  out.push({id:'b'+n++,kind:unsafe?'raw':'paragraph',raw,text:raw.trim(),align:nextAlign});currentAlign=nextAlign;
 }
 while((m=re.exec(body))){text(cur,m.index);
  if(m[0]==='$$'){const ep=body.indexOf('$$',re.lastIndex);if(ep<0)break;const end=ep+2,raw=body.slice(m.index,end),inner=body.slice(re.lastIndex,ep).trim();out.push({id:'b'+n++,kind:'equation',raw,env:'$$',text:inner,align:'center'});cur=end;re.lastIndex=end;continue;}
  if(m[4]!==undefined){const raw=m[0],d=figureData(raw);out.push({id:'b'+n++,kind:'figure',raw,env:'includegraphics',text:raw,align:d.align,figurePath:d.path,figureOptions:d.options,figureWidth:d.width.value,figureWidthUnit:d.width.unit,figureHeight:d.height.value,figureHeightUnit:d.height.unit,figureCaption:d.caption});cur=re.lastIndex;continue;}
  const env=m[1],token='\\end{'+env+'}',match=findMatchingEnvEnd(body,env,re.lastIndex);if(!match)break;const end=match.end,raw=body.slice(m.index,end),inner=raw.slice(m[0].length,raw.length-token.length).trim();let kind='raw';if(env==='itemize'||env==='enumerate')kind='itemize';else if(['block','alertblock','exampleblock'].includes(env))kind='block';else if(/^(equation|align|gather)/.test(env))kind='equation';else if(env==='figure')kind='figure';else if(env==='columns')kind='columns';const effectiveAlign=kind==='equation'?'center':kind==='itemize'?(currentAlign==='justify'?'left':currentAlign):currentAlign;const b={id:'b'+n++,kind,raw,env,title:m[2]||'',text:inner,align:effectiveAlign};if(kind==='itemize')b.items=splitTopItems(inner);if(kind==='figure'){const d=figureData(raw);Object.assign(b,{align:d.align,figurePath:d.path,figureOptions:d.options,figureWidth:d.width.value,figureWidthUnit:d.width.unit,figureHeight:d.height.value,figureHeightUnit:d.height.unit,figureCaption:d.caption})}out.push(b);cur=end;re.lastIndex=end}text(cur,body.length);return out;
}
function applyPresentationStyle(){
 const st=presentationStyle||{};const w=Number(st.aspectWidth)||4,h=Number(st.aspectHeight)||3;
 const root=document.documentElement;root.style.setProperty('--slide-aspect',w+' / '+h);root.style.setProperty('--slide-aspect-number',String(w/h));root.style.setProperty('--slide-body-size',(Number(st.bodyFontPx)||16)+'px');root.style.setProperty('--slide-title-size',(Number(st.titleFontPx)||24.8)+'px');root.style.setProperty('--slide-line-height',String(Number(st.lineHeight)||1.28));
}
function frameVerticalClass(f){const o=String((f&&f.options)||'');if(/(?:^|[\[,])\s*t(?:\s|,|\]|$)/.test(o))return' v-top';if(/(?:^|[\[,])\s*b(?:\s|,|\]|$)/.test(o))return' v-bottom';return' v-center';}
function updateSlideFit(slide){
 if(!slide)return;let badge=slide.querySelector('.slide-fit');if(!badge){badge=document.createElement('div');badge.className='slide-fit';slide.appendChild(badge);}
 const overflowing=slide.scrollHeight>slide.clientHeight+3;slide.classList.toggle('overflowing',overflowing);badge.classList.toggle('overflow',overflowing);
 badge.textContent=overflowing?'Content overflow':((presentationStyle&&presentationStyle.aspectLabel)||'4:3')+' · '+((presentationStyle&&presentationStyle.baseFontPt)||11)+'pt';
}
function scheduleSlideFit(slide){requestAnimationFrame(()=>requestAnimationFrame(()=>updateSlideFit(slide)));}
function renderPreamble(id){
 mode='preamble';currentPreamble=id||currentPreamble;renderNav();const info=preambles.find(x=>x.id===currentPreamble)||preambles[0];const c=document.getElementById('content');if(!info){c.innerHTML='<div class="empty">No preamble source found.</div>';return;}currentPreamble=info.id;const options=preambles.map(x=>'<option value="'+esc(x.id)+'"'+(x.id===info.id?' selected':'')+'>'+esc(x.label)+'</option>').join('');c.innerHTML='<section class="preamble-editor"><div class="preamble-head"><select id="preamble-select">'+options+'</select><button class="secondary" id="preamble-source">Open source</button><button id="preamble-save">Save preamble</button></div><textarea id="preamble-code" class="preamble-code" spellcheck="false"></textarea></section>';const ta=document.getElementById('preamble-code');ta.value=info.text;document.getElementById('preamble-select').onchange=e=>renderPreamble(e.target.value);document.getElementById('preamble-save').onclick=()=>vscode.postMessage({type:'savePreamble',preambleId:currentPreamble,text:ta.value});document.getElementById('preamble-source').onclick=()=>vscode.postMessage({type:'revealPreamble',preambleId:currentPreamble});if(window.innerWidth<900&&typeof setNav==='function')setNav(false);}
function currentSource(){const f=frames[current];return sources.find(x=>x.uri===(f&&f.sourceUri))||sources.find(x=>x.uri===rootUri)||sources[0];}
function sourceEditorHtml(compact=false){const src=currentSource();if(!src)return'<div class="empty">No LaTeX source loaded.</div>';const options=sources.map(x=>'<option value="'+esc(x.uri)+'"'+(x.uri===src.uri?' selected':'')+'>'+esc(x.label)+'</option>').join('');return'<section class="source-shell"><div class="source-head"><select class="source-select">'+options+'</select><button class="source-save">Save source</button></div><textarea class="source-code" spellcheck="false"></textarea></section>';}
function bindSourceEditor(host){const src=currentSource();if(!src)return;const ta=host.querySelector('.source-code');if(!ta)return;ta.value=src.text;host.querySelector('.source-select').onchange=e=>{const target=sources.find(x=>x.uri===e.target.value);if(target){const fIndex=frames.findIndex(f=>f.sourceUri===target.uri);if(fIndex>=0)current=fIndex;renderWorkspace();}};host.querySelector('.source-save').onclick=()=>vscode.postMessage({type:'saveSource',uri:src.uri,text:ta.value});}
function visualFrameHtml(f){if(!f)return'<div class="empty">No Beamer frames found.</div>';const v=frameVerticalClass(f);if(/\\(?:titlepage|maketitle)\b/.test(f.body))return'<article class="slide title-page align-center'+v+'"><div class="blocks-host"><div class="title align-center">'+latexToHtml(metadata.title||'Untitled presentation')+'</div>'+(metadata.subtitle?'<div style="font-size:1.25em;margin:.5em 0 1.6em">'+latexToHtml(metadata.subtitle)+'</div>':'')+'<div style="font-size:1.08em;margin-top:2.5em">'+latexToHtml(metadata.author||'')+'</div>'+(metadata.institute?'<div style="margin-top:.75em;color:var(--muted)">'+latexToHtml(metadata.institute)+'</div>':'')+(metadata.date?'<div style="margin-top:2em">'+latexToHtml(metadata.date)+'</div>':'')+'</div></article>';return'<article class="slide'+v+'"><div class="title" contenteditable="true">'+esc(f.title)+'</div><div class="blocks-host"></div></article>';}
function bindVisualFrame(host,i){const f=frames[i];if(!f||/\\(?:titlepage|maketitle)\b/.test(f.body))return;const title=host.querySelector('.title');attachEditor(title);const saveTitle=refresh=>vscode.postMessage({type:'updateFrameTitle',frameIndex:i,title:editorToLatex(title),refresh});title.addEventListener('input',()=>scheduleSave(title,saveTitle));title.addEventListener('blur',()=>flushSave(title,saveTitle));const blockHost=host.querySelector('.blocks-host');const parsed=parseBlocks(f.body);parsed.forEach(b=>blockHost.appendChild(renderBlock(b,i)));if(!parsed.length){const empty=document.createElement('div');empty.className='block paragraph empty-frame-body';empty.contentEditable='true';empty.dataset.placeholder='Start typing slide content…';attachEditor(empty);const saveEmpty=refresh=>vscode.postMessage({type:'updateEmptyFrameBody',frameIndex:i,text:editorToLatex(empty),refresh});empty.__texflowCommit=(text)=>vscode.postMessage({type:'updateEmptyFrameBody',frameIndex:i,text,refresh:true});empty.addEventListener('input',()=>scheduleSave(empty,saveEmpty));empty.addEventListener('blur',()=>flushSave(empty,saveEmpty));blockHost.appendChild(empty);}else{const trailing=document.createElement('div');trailing.className='trailing-paragraph editable';trailing.contentEditable='true';trailing.dataset.placeholder='Continue typing…';attachEditor(trailing);let saved='';const saveTrailing=refresh=>{const text=editableLatex(trailing);vscode.postMessage({type:'updateTrailingParagraph',frameIndex:i,previous:saved,text,refresh});saved=text;};trailing.__texflowCommit=(text)=>{setEditableLatex(trailing,text);vscode.postMessage({type:'updateTrailingParagraph',frameIndex:i,previous:saved,text,refresh:true});saved=text;};trailing.addEventListener('input',()=>scheduleSave(trailing,saveTrailing));trailing.addEventListener('blur',()=>flushSave(trailing,saveTrailing));blockHost.appendChild(trailing);}title.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();flushSave(title,saveTitle);const target=blockHost.querySelector('[contenteditable=true]');if(target){target.focus();const r=document.createRange();r.selectNodeContents(target);r.collapse(true);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);}}});;const slide=host.querySelector('.slide');if(slide){scheduleSlideFit(slide);slide.addEventListener('input',()=>scheduleSlideFit(slide));}}
function renderWorkspace(){mode='frames';current=Math.max(0,Math.min(current,frames.length-1));renderNav();document.querySelectorAll('.mode-tab').forEach(x=>x.classList.toggle('active',x.dataset.view===viewMode));const c=document.getElementById('content');c.className='workspace';if(viewMode==='source'){c.innerHTML=sourceEditorHtml();bindSourceEditor(c);return;}if(viewMode==='pdf'){const hasPdf=!!pdfUri;const status=pdfBuildState==='building'?'Compiling…':pdfBuildState==='error'?pdfBuildMessage:(hasPdf?(pdfBuildMessage||'PDF ready.'):'No compiled PDF found.');c.innerHTML='<section class="pdf-shell"><div class="pdf-head"><span>Compiled PDF</span><button class="top-action" id="pdf-refresh">Refresh</button>'+(hasPdf?'<button class="top-action" id="pdf-open">Open PDF</button>':'')+'<button class="top-action primary" id="pdf-compile">Compile</button></div><div class="pdf-empty"><div><div style="font-size:28px;margin-bottom:12px">'+(pdfBuildState==='building'?'⏳':pdfBuildState==='error'?'⚠':'✓')+'</div><div>'+esc(status)+'</div>'+(hasPdf?'<div style="margin-top:8px;font-size:12px">TeXFlow uses the native VS Code PDF viewer to avoid the blank grey embedded-PDF bug.</div>':'')+'</div></div></section>';document.getElementById('pdf-refresh').onclick=()=>vscode.postMessage({type:'refreshPdf'});const open=document.getElementById('pdf-open');if(open)open.onclick=()=>vscode.postMessage({type:'openPdf'});document.getElementById('pdf-compile').onclick=()=>vscode.postMessage({type:'compile'});return;}if(!isBeamer){if(viewMode==='split'){c.innerHTML='<div class="split-workspace"><div class="split-pane visual-pane document-pane">'+visualDocumentHtml()+'</div><div class="split-pane source-pane">'+sourceEditorHtml(true)+'</div></div>';bindVisualDocument(c.querySelector('.visual-pane'));bindSourceEditor(c.querySelector('.source-pane'));return;}c.innerHTML=visualDocumentHtml();bindVisualDocument(c);return;}if(viewMode==='split'){c.innerHTML='<div class="split-workspace"><div class="split-pane visual-pane">'+visualFrameHtml(frames[current])+'</div><div class="split-pane source-pane">'+sourceEditorHtml(true)+'</div></div>';bindVisualFrame(c.querySelector('.visual-pane'),current);scheduleSlideFit(c.querySelector('.visual-pane .slide'));bindSourceEditor(c.querySelector('.source-pane'));return;}c.innerHTML=visualFrameHtml(frames[current]);bindVisualFrame(c,current);scheduleSlideFit(c.querySelector('.slide'));}
function renderFrame(i){current=i;renderWorkspace();if(window.innerWidth<900&&typeof setNav==='function')setNav(false);}
function renderBlock(b,fi){const wrap=document.createElement('div');wrap.className='block '+alignClass(b.align,b.kind==='itemize'?'left':'justify');if(b.hidden){wrap.style.display='none';return wrap;}
 if(b.kind==='paragraph'){wrap.innerHTML='<div class="editable '+alignClass(b.align,'justify')+'" contenteditable="true">'+latexToHtml(b.text)+'</div>';const e=wrap.firstChild;attachEditor(e);const saveParagraph=refresh=>vscode.postMessage({type:'updateBlock',frameIndex:fi,blockId:b.id,payload:{text:editableLatex(e)},refresh});e.__texflowCommit=(text)=>vscode.postMessage({type:'updateBlock',frameIndex:fi,blockId:b.id,payload:{text},refresh:true});e.addEventListener('input',()=>scheduleSave(e,saveParagraph));e.addEventListener('blur',()=>flushSave(e,saveParagraph));}
 else if(b.kind==='itemize'){const list=createVisualList(b.env,b.items||[]);list.classList.add(alignClass(b.align,'left'));const saveList=refresh=>vscode.postMessage({type:'updateBlock',frameIndex:fi,blockId:b.id,payload:{items:listItemsPayload(list)},refresh});list.querySelectorAll('.item-text').forEach(edit=>{edit.__texflowCommit=(text)=>{setEditableLatex(edit,text);vscode.postMessage({type:'updateBlock',frameIndex:fi,blockId:b.id,payload:{items:listItemsPayload(list)},refresh:true});};});bindListEditing(list,saveList);wrap.appendChild(list)}
 else if(b.kind==='block'){wrap.className+=' beamer-block '+(b.env==='alertblock'?'alert':b.env==='exampleblock'?'example':'');wrap.innerHTML='<div class="head" contenteditable="true">'+latexToHtml(b.title)+'</div><div class="body editable '+alignClass(b.align,'justify')+'" contenteditable="true">'+latexToHtml(b.text)+'</div>';attachEditor(wrap.querySelector('.head'));attachEditor(wrap.querySelector('.body'));const blockBody=wrap.querySelector('.body');blockBody.__texflowCommit=(text)=>vscode.postMessage({type:'updateBlock',frameIndex:fi,blockId:b.id,payload:{title:editorToLatex(wrap.querySelector('.head')),text},refresh:true});wrap.addEventListener('focusout',()=>vscode.postMessage({type:'updateBlock',frameIndex:fi,blockId:b.id,payload:{title:editorToLatex(wrap.querySelector('.head')),text:editableLatex(blockBody)}}));}
 else if(b.kind==='equation'){wrap.className+=' math';wrap.innerHTML='<div class="render"></div>';try{katex.render(b.text,wrap.querySelector('.render'),{displayMode:true,throwOnError:false})}catch{}wrap.title='Double-click to edit equation';wrap.addEventListener('dblclick',()=>openMathEditor(b,fi));}
 else if(b.kind==='figure'){renderFigure(b,fi,wrap);}
 else {wrap.className+=' '+b.kind;wrap.innerHTML='<div class="tag">'+esc(b.kind)+' — preserved as LaTeX</div><pre>'+esc(b.raw)+'</pre>'}return wrap;}

function figureResource(block,frameIndex){const frame=frames[frameIndex]||{},key=(frame.sourceUri||'')+'|'+(block.figurePath||'');return figureResources[key]||figureResources['*|'+(block.figurePath||'')]||null;}
function relativeWidth(block){const unit=block.figureWidthUnit||'\\linewidth',value=Number(block.figureWidth);if(['\\linewidth','\\textwidth','\\columnwidth','\\paperwidth'].includes(unit)&&value>0)return Math.max(8,Math.min(100,value*100));return 70;}
function relativeHeight(block){const unit=block.figureHeightUnit||'\\textheight',value=Number(block.figureHeight);if(unit==='\\textheight'&&value>0)return Math.max(8,Math.min(100,value*100));return 0;}
function renderFigure(block,frameIndex,wrap){
 wrap.className+=' figure figure-card';const res=figureResource(block,frameIndex),width=relativeWidth(block),height=relativeHeight(block),caption=block.figureCaption||'',align=block.figureAlign||block.align||'center';
 wrap.innerHTML='<div class="figure-head"><span class="tag">Figure</span><span class="figure-name">'+esc(block.figurePath||'image')+'</span><div class="figure-controls"><label><input class="figure-lock" type="checkbox" checked> lock</label><label>W <input class="figure-width-input" type="number" min="5" max="100" step="1" value="'+Math.round(width)+'">%</label><label class="height-control" style="display:none">H <input class="figure-height-input" type="number" min="5" max="100" step="1" value="'+Math.round(height||40)+'">%</label></div></div><div class="figure-stage '+alignClass(align,'center')+'"><div class="figure-visual'+(res&&res.isPdf?' pdf':'')+'" style="width:'+width+'%"><div class="figure-media"></div><span class="figure-size">'+Math.round(width)+'%</span><span class="figure-resize" title="Drag to resize"></span></div></div>'+(caption?'<div class="figure-caption">'+latexToHtml(caption)+'</div>':'');
 const visual=wrap.querySelector('.figure-visual'),media=wrap.querySelector('.figure-media'),stage=wrap.querySelector('.figure-stage'),lock=wrap.querySelector('.figure-lock'),wi=wrap.querySelector('.figure-width-input'),hi=wrap.querySelector('.figure-height-input'),hc=wrap.querySelector('.height-control'),label=wrap.querySelector('.figure-size');
 const slide=wrap.closest('.slide');function heightPixels(percent){return Math.max(55,(slide?slide.clientHeight:620)*percent/100)}if(height)visual.style.height=heightPixels(height)+'px';
 if(res){if(res.isPdf)media.innerHTML='<object data="'+esc(res.uri)+'#toolbar=0&navpanes=0" type="application/pdf" aria-label="'+esc(block.figurePath)+'"><div class="figure-placeholder">PDF figure<br>'+esc(block.figurePath)+'</div></object>';else if(['png','jpg','jpeg','svg','webp','gif'].includes(res.extension))media.innerHTML='<img src="'+esc(res.uri)+'" alt="'+esc(block.figurePath)+'">';else media.innerHTML='<div class="figure-placeholder">Preview unavailable<br>'+esc(block.figurePath)+'</div>';}else media.innerHTML='<div class="figure-placeholder">Figure not found<br>'+esc(block.figurePath||'')+'</div>';
 function save(){const w=Math.max(5,Math.min(100,Number(wi.value)||70))/100,h=lock.checked?0:Math.max(5,Math.min(100,Number(hi.value)||40))/100;vscode.postMessage({type:'updateBlock',frameIndex,blockId:block.id,payload:{width:w,widthUnit:block.figureWidthUnit||'\\linewidth',height:h,heightUnit:block.figureHeightUnit||'\\textheight',keepAspect:lock.checked}})}
 function applyInputs(){const w=Math.max(5,Math.min(100,Number(wi.value)||70));visual.style.width=w+'%';label.textContent=Math.round(w)+'%';if(!lock.checked){const h=Math.max(5,Math.min(100,Number(hi.value)||40));visual.style.height=heightPixels(h)+'px'}else visual.style.height='';}
 lock.onchange=()=>{hc.style.display=lock.checked?'none':'flex';applyInputs();save()};wi.onchange=()=>{applyInputs();save()};hi.onchange=()=>{applyInputs();save()};
 const handle=wrap.querySelector('.figure-resize');handle.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();handle.setPointerCapture(e.pointerId);document.body.classList.add('figure-resizing');const sr=stage.getBoundingClientRect(),vr=visual.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,sw=vr.width,sh=vr.height;function move(ev){const nw=Math.max(sr.width*.08,Math.min(sr.width,sw+(ev.clientX-sx))),wp=nw/sr.width*100;wi.value=String(Math.round(wp));visual.style.width=wp+'%';label.textContent=Math.round(wp)+'%';if(!lock.checked){const nh=Math.max(55,sh+(ev.clientY-sy)),hp=Math.min(100,nh/Math.max(1,(slide?slide.clientHeight:620))*100);hi.value=String(Math.round(hp));visual.style.height=hp+'%'}}function up(ev){handle.releasePointerCapture(ev.pointerId);handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',up);document.body.classList.remove('figure-resizing');save()}handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',up)});
}

const mathSymbols={
 Greek:[['α','\\alpha'],['β','\\beta'],['γ','\\gamma'],['δ','\\delta'],['ε','\\epsilon'],['ζ','\\zeta'],['η','\\eta'],['θ','\\theta'],['ι','\\iota'],['κ','\\kappa'],['λ','\\lambda'],['μ','\\mu'],['ν','\\nu'],['ξ','\\xi'],['π','\\pi'],['ρ','\\rho'],['σ','\\sigma'],['τ','\\tau'],['φ','\\phi'],['χ','\\chi'],['ψ','\\psi'],['ω','\\omega'],['Γ','\\Gamma'],['Δ','\\Delta'],['Θ','\\Theta'],['Λ','\\Lambda'],['Ξ','\\Xi'],['Π','\\Pi'],['Σ','\\Sigma'],['Φ','\\Phi'],['Ψ','\\Psi'],['Ω','\\Omega']],
 Relations:[['=','='],['≠','\\neq'],['<','<'],['>','>'],['≤','\\leq'],['≥','\\geq'],['≈','\\approx'],['≡','\\equiv'],['∼','\\sim'],['≃','\\simeq'],['∝','\\propto'],['∈','\\in'],['∉','\\notin'],['⊂','\\subset'],['⊆','\\subseteq'],['⊃','\\supset'],['⊇','\\supseteq'],['≪','\\ll'],['≫','\\gg'],['⊥','\\perp']],
 Operators:[['±','\\pm'],['∓','\\mp'],['×','\\times'],['÷','\\div'],['·','\\cdot'],['∑','\\sum'],['∏','\\prod'],['∫','\\int'],['∮','\\oint'],['∞','\\infty'],['∂','\\partial'],['∇','\\nabla'],['√','\\sqrt{}'],['|x|','\\left|  \\right|'],['⌈ ⌉','\\left\\lceil  \\right\\rceil'],['⌊ ⌋','\\left\\lfloor  \\right\\rfloor'],['min','\\min'],['max','\\max'],['lim','\\lim'],['log','\\log']],
 Structures:[['a/b','\\frac{}{}'],['x²','^{}'],['xᵢ','_{}'],['( )','\\left(  \\right)'],['[ ]','\\left[  \\right]'],['{ }','\\left\\{  \\right\\}'],['Σ','\\sum_{}^{}'],['∫','\\int_{}^{}'],['lim','\\lim_{}'],['2×2','\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'],['cases','\\begin{cases}  &  \\\\  &  \\end{cases}'],['text','\\text{}']],
 Arrows:[['→','\\rightarrow'],['←','\\leftarrow'],['↔','\\leftrightarrow'],['⇒','\\Rightarrow'],['⇐','\\Leftarrow'],['⇔','\\Leftrightarrow'],['↦','\\mapsto'],['↑','\\uparrow'],['↓','\\downarrow'],['↗','\\nearrow'],['↘','\\searrow']],
 Sets:[['∅','\\emptyset'],['ℝ','\\mathbb{R}'],['ℕ','\\mathbb{N}'],['ℤ','\\mathbb{Z}'],['ℚ','\\mathbb{Q}'],['ℂ','\\mathbb{C}'],['∪','\\cup'],['∩','\\cap'],['\\','\\setminus'],['∀','\\forall'],['∃','\\exists'],['¬','\\neg'],['∧','\\land'],['∨','\\lor']]
};
let mathEditing=null,mathCategory='Greek',lastVisualCursor=null;
function rememberVisualCursor(){
 const sel=window.getSelection();if(!sel||!sel.rangeCount)return;
 const range=sel.getRangeAt(0);let node=range.startContainer.nodeType===Node.ELEMENT_NODE?range.startContainer:range.startContainer.parentElement;
 const editable=node&&node.closest?node.closest('.slide .editable[contenteditable=true], .slide .empty-frame-body[contenteditable=true], .document-sheet .doc-editable[contenteditable=true], .document-continuous .doc-editable[contenteditable=true]'):null;
 if(!editable||!editable.__texflowCommit)return;
 try{lastVisualCursor={editable,range:range.cloneRange(),frameIndex:current};}catch{}
}
document.addEventListener('selectionchange',rememberVisualCursor);
function insertMathAtRememberedCursor(kind,text,anchor){
 const ctx=anchor||lastVisualCursor;if(!ctx||!ctx.editable||!ctx.editable.isConnected||!ctx.editable.__texflowCommit)return false;
 const editable=ctx.editable,range=ctx.range.cloneRange();
 if(!editable.contains(range.startContainer))return false;
 const marker='@@TEXFLOW_CURSOR_MATH_'+Date.now()+'@@';
 const markerNode=document.createTextNode(marker);range.deleteContents();range.insertNode(markerNode);
 const latex=editableLatex(editable);
 markerNode.remove();
 let code='';
 if(kind==='inlinemath')code='$'+text+'$';
 else if(kind==='equation')code='\\n\\n\\begin{equation}\\n'+text+'\\n\\end{equation}\\n\\n';
 else code='\\n\\n$$\\n'+text+'\\n$$\\n\\n';
 if(!latex.includes(marker))return false;
 editable.__texflowCommit(latex.replace(marker,code));
 return true;
}
function renderMathPalette(){const tabs=document.getElementById('symbol-tabs'),grid=document.getElementById('symbol-grid');tabs.innerHTML='';Object.keys(mathSymbols).forEach(name=>{const b=document.createElement('button');b.className='symbol-tab'+(name===mathCategory?' active':'');b.textContent=name;b.onclick=()=>{mathCategory=name;renderMathPalette()};tabs.appendChild(b)});grid.innerHTML='';mathSymbols[mathCategory].forEach(([label,code])=>{const b=document.createElement('button');b.className='symbol-btn';b.textContent=label;b.title=code;b.onclick=()=>insertMathCode(code);grid.appendChild(b)});}
function insertMathCode(code){const ta=document.getElementById('math-code'),start=ta.selectionStart,end=ta.selectionEnd;ta.setRangeText(code,start,end,'end');ta.focus();const firstEmpty=code.indexOf('{}');if(firstEmpty>=0){const p=start+firstEmpty+1;ta.setSelectionRange(p,p)}updateMathPreview();}
function updateMathPreview(){const ta=document.getElementById('math-code'),preview=document.getElementById('math-preview');const inline=mathEditing&&mathEditing.mode==='insert'&&mathEditing.kind==='inlinemath';try{katex.render(ta.value||'\\;',preview,{displayMode:!inline,throwOnError:false})}catch{preview.textContent=ta.value}}
function openMathEditor(block,frameIndex){mathEditing={mode:'edit',block,frameIndex};const modal=document.getElementById('math-modal'),ta=document.getElementById('math-code');document.getElementById('math-modal-title').textContent='Edit equation';ta.value=block.text||'';modal.classList.add('open');modal.setAttribute('aria-hidden','false');renderMathPalette();updateMathPreview();setTimeout(()=>{ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length)},0)}
function openMathInsert(kind,frameIndex){mathEditing={mode:'insert',kind,frameIndex,anchor:lastVisualCursor};const modal=document.getElementById('math-modal'),ta=document.getElementById('math-code');document.getElementById('math-modal-title').textContent=kind==='inlinemath'?'Insert inline math':kind==='equation'?'Insert numbered equation':'Insert display math';ta.value='';modal.classList.add('open');modal.setAttribute('aria-hidden','false');renderMathPalette();updateMathPreview();setTimeout(()=>ta.focus(),0)}
function closeMathEditor(){const modal=document.getElementById('math-modal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');mathEditing=null}
function saveMathEditor(){if(!mathEditing)return;const text=document.getElementById('math-code').value.trim();if(mathEditing.mode==='insert'){if(text&&!insertMathAtRememberedCursor(mathEditing.kind,text,mathEditing.anchor))vscode.postMessage({type:'insertMath',frameIndex:mathEditing.frameIndex,kind:mathEditing.kind,text});closeMathEditor();return;}if(mathEditing.mode==='doc-edit'){const node=mathEditing.node,b=node.block;let replacement='';if(b.env==='display')replacement='\\[\n'+text+'\n\\]';else if(b.env==='$$')replacement='$$\n'+text+'\n$$';else replacement='\\begin{'+b.env+'}\n'+text+'\n\\end{'+b.env+'}';updateDocumentNode(node,replacement,true);closeMathEditor();return;}vscode.postMessage({type:'updateBlock',frameIndex:mathEditing.frameIndex,blockId:mathEditing.block.id,payload:{text}});closeMathEditor()}
document.getElementById('math-code').addEventListener('input',updateMathPreview);document.getElementById('math-close').onclick=closeMathEditor;document.getElementById('math-cancel').onclick=closeMathEditor;document.getElementById('math-save').onclick=saveMathEditor;document.getElementById('math-modal').addEventListener('mousedown',e=>{if(e.target.id==='math-modal')closeMathEditor()});document.getElementById('math-code').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();saveMathEditor()}});

function closeMenus(){document.querySelectorAll('.menu-panel').forEach(x=>x.classList.remove('open'));document.querySelectorAll('.menu-trigger').forEach(x=>x.classList.remove('open'));}
document.querySelectorAll('.menu-trigger').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const panel=document.getElementById('menu-'+btn.dataset.menu);const open=panel.classList.contains('open');closeMenus();if(!open){panel.classList.add('open');btn.classList.add('open')}}));
document.addEventListener('click',e=>{if(!e.target.closest('.menu'))closeMenus()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(document.getElementById('math-modal').classList.contains('open'))closeMathEditor();else closeMenus();}});
document.querySelectorAll('.menu-panel button').forEach(btn=>btn.addEventListener('click',()=>setTimeout(closeMenus,0)));
document.querySelectorAll('.format').forEach(btn=>{btn.addEventListener('mousedown',e=>{e.preventDefault();wrapSelection(btn.dataset.format)})});
document.querySelectorAll('.insert').forEach(btn=>btn.addEventListener('click',()=>{
 const a=btn.dataset.action;
 if(a==='title'||a==='author')vscode.postMessage({type:'setMetadata',field:a});
 else if(a==='abstract')vscode.postMessage({type:'insertAbstract'});
 else if(a==='frame')vscode.postMessage({type:'insertFrame',frameIndex:current});
 else if(a==='section')vscode.postMessage({type:'insertSection',frameIndex:current});
 else if(a==='subsection')vscode.postMessage({type:'insertSubsection',frameIndex:current});
 else if(a==='paragraph')vscode.postMessage({type:'insertBlock',frameIndex:current,kind:'paragraph'});
 else if(a==='bullets')vscode.postMessage({type:'insertBlock',frameIndex:current,kind:'itemize'});
 else if(a==='numbered')vscode.postMessage({type:'insertBlock',frameIndex:current,kind:'enumerate'});
 else if(a==='inlinemath')openMathInsert('inlinemath',current);
 else if(a==='displaymath')openMathInsert('displaymath',current);
 else if(a==='equation')openMathInsert('equation',current);
}));
window.addEventListener('keydown',e=>{
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='m'){
  e.preventDefault();
  openMathInsert(e.shiftKey?'equation':'displaymath',current);
 }
});
function updateDocumentViewMenu(){
 const continuous=document.getElementById('view-continuous'),pages=document.getElementById('view-pages');if(!continuous||!pages)return;
 continuous.textContent=(documentLayoutMode==='continuous'?'✓ ':'')+'Continuous';pages.textContent=(documentLayoutMode==='pages'?'✓ ':'')+'Pages';
}
const topMenus=[...document.querySelectorAll('.top-menu')];function closeTopMenus(except){topMenus.forEach(m=>{if(m!==except)m.classList.remove('open')})}topMenus.forEach(menu=>{const trigger=menu.querySelector(':scope > .top-action');trigger.onclick=e=>{e.stopPropagation();const wasOpen=menu.classList.contains('open');closeTopMenus();menu.classList.toggle('open',!wasOpen);};});function renderNewMenu(){const panel=document.getElementById('new-menu-panel');if(!panel)return;const actions=documentClass==='beamer'?[['frame','New frame'],['section','New section'],['subsection','New subsection']]:['book','report'].includes(documentClass)?[['chapter','New chapter'],['section','New section'],['subsection','New subsection'],['subsubsection','New subsubsection'],['paragraphHeading','New paragraph heading']]:[['section','New section'],['subsection','New subsection'],['subsubsection','New subsubsection'],['paragraphHeading','New paragraph heading']];panel.innerHTML='';actions.forEach(([kind,label])=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>{closeTopMenus();if(kind==='frame')vscode.postMessage({type:'insertFrame',frameIndex:current});else if(kind==='chapter')vscode.postMessage({type:'insertChapter',frameIndex:current});else if(kind==='section')vscode.postMessage({type:'insertSection',frameIndex:current});else if(kind==='subsection')vscode.postMessage({type:'insertSubsection',frameIndex:current});else if(kind==='subsubsection')vscode.postMessage({type:'insertSubsubsection',frameIndex:current});else vscode.postMessage({type:'insertParagraphHeading',frameIndex:current});};panel.appendChild(b)});}document.getElementById('view-continuous').onclick=()=>{documentLayoutMode='continuous';updateDocumentViewMenu();closeTopMenus();renderWorkspace();};document.getElementById('view-pages').onclick=()=>{documentLayoutMode='pages';updateDocumentViewMenu();closeTopMenus();renderWorkspace();};document.addEventListener('click',e=>{if(!e.target.closest('.top-menu'))closeTopMenus();});document.querySelectorAll('.mode-tab').forEach(btn=>btn.onclick=()=>{viewMode=btn.dataset.view;renderWorkspace();});document.getElementById('new-document').onclick=()=>{closeTopMenus();vscode.postMessage({type:'newDocument'});};document.getElementById('open-file').onclick=()=>{closeTopMenus();vscode.postMessage({type:'open'});};document.getElementById('save-file').onclick=()=>{closeTopMenus();const el=document.getElementById('save-status');el.textContent='Saving…';vscode.postMessage({type:'save'});};document.getElementById('save-as').onclick=()=>{closeTopMenus();vscode.postMessage({type:'saveAs'});};document.getElementById('undo').onclick=()=>vscode.postMessage({type:'undo'});document.getElementById('redo').onclick=()=>vscode.postMessage({type:'redo'});document.getElementById('top-compile').onclick=()=>vscode.postMessage({type:'compile'});document.getElementById('source').onclick=()=>{viewMode='source';renderWorkspace();};document.getElementById('compile').onclick=()=>vscode.postMessage({type:'compile'});const body=document.body;const toggleNav=document.getElementById('toggle-nav');const toggleTools=document.getElementById('toggle-tools');const focusBtn=document.getElementById('focus-mode');const exitFocus=document.getElementById('exit-focus');function setNav(open){body.classList.toggle('nav-open',open);body.classList.toggle('nav-closed',!open);localStorage.setItem('texflow-nav',open?'open':'closed');}function setTools(open){body.classList.toggle('tools-open',open);}function setFocus(on){body.classList.toggle('focus-mode',on);if(on){setTools(false);}localStorage.setItem('texflow-focus',on?'on':'off');}// Every TeXFlow document starts with its navigator visible on desktop.
// On narrow panes it starts closed and the Index button opens it as an overlay.
setNav(window.innerWidth>=900);setFocus(localStorage.getItem('texflow-focus')==='on');toggleNav.onclick=()=>setNav(body.classList.contains('nav-closed'));toggleTools.onclick=e=>{e.stopPropagation();setTools(!body.classList.contains('tools-open'));};focusBtn.onclick=()=>setFocus(!body.classList.contains('focus-mode'));exitFocus.onclick=()=>setFocus(false);document.addEventListener('click',e=>{if(body.classList.contains('tools-open')&&!e.target.closest('.toolbar')&&!e.target.closest('#toggle-tools'))setTools(false);if(window.innerWidth<900&&body.classList.contains('nav-open')&&!e.target.closest('.side')&&!e.target.closest('#toggle-nav'))setNav(false);});window.addEventListener('resize',()=>{if(window.innerWidth<900&&body.classList.contains('nav-open'))setNav(false);});document.addEventListener('keydown',e=>{if(e.key==='Escape'){setTools(false);if(body.classList.contains('focus-mode'))setFocus(false);}if(e.ctrlKey||e.metaKey){const k=e.key.toLowerCase();if(k==='s'){e.preventDefault();vscode.postMessage({type:e.shiftKey?'saveAs':'save'});}else if(k==='o'){e.preventDefault();vscode.postMessage({type:'open'});}else if(k==='z'){e.preventDefault();vscode.postMessage({type:e.shiftKey?'redo':'undo'});}}});vscode.postMessage({type:'ready'});
</script></body></html>`;
}

export function deactivate() {}
