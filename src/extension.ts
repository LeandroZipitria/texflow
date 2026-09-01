import * as vscode from 'vscode';
import * as path from 'path';
import { spellcheckBlocks, type SpellcheckLanguage, type SpellcheckResultBlock } from './spellcheck';

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
  kind: 'paragraph' | 'itemize' | 'block' | 'equation' | 'figure' | 'table' | 'vspace' | 'columns' | 'quote' | 'container' | 'break' | 'theorem' | 'comment' | 'raw';
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
  figureShortCaption?: string;
  figureAngle?: number;
  figureLabel?: string;
  figurePlacement?: string;
  figureCaptionPosition?: 'above' | 'below';
  figureAlign?: 'left' | 'center' | 'right';
  tableColumns?: string[];
  tableRows?: string[][];
  tableCaption?: string;
  tableLabel?: string;
  tablePlacement?: string;
  tableCaptionPosition?: 'above' | 'below';
  tableSimple?: boolean;
  tableStyle?: 'plain' | 'booktabs';
  spaceAmount?: string;
  spaceStarred?: boolean;
  columnCount?: number;
  columnTexts?: string[];
  breakCommand?: string;
  theoremEnv?: string;
  commentText?: string;
  commentNote?: boolean;
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

interface DocumentSettings {
  fontSize: string;
  paper: string;
  orientation: 'portrait' | 'landscape';
  globalColumns: 'one' | 'two';
  language: string;
  lineSpacing: string;
  defaultAlignment: 'justify' | 'left' | 'center' | 'right';
  margin: string;
  paragraphIndent: string;
  paragraphSkip: string;
  hyperlinks: boolean;
  beamerAspect: string;
  beamerTheme: string;
  extraPackages: string;
}

interface SpellCheckSettings {
  enabled: boolean;
  language: 'auto' | 'en' | 'es';
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

interface BibliographyEntry {
  key: string;
  type: string;
  fields: Record<string, string>;
  source: string;
}

interface BibliographyResource {
  name: string;
  uri: string;
  label: string;
}

type BibliographySystem = 'biblatex' | 'natbib' | 'bibtex' | 'none';

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
    const sendDocument = async (selectedFrame?: number, focusFrameTitle = false, focusNewMath = false, focusDocumentHeadingStart?: number) => {
      await refreshProject();
      const pdfUri = await getPdfWebviewUri(project.root, panel.webview);
      const spellCheckSettings = getSpellCheckSettings(project);
      panel.webview.postMessage({
        type: 'document',
        frames: project.frames,
        fileName: project.root.fileName,
        isBeamer: project.isBeamer,
        documentClass: project.documentClass,
        metadata: project.metadata,
        presentationStyle: project.presentationStyle,
        documentSettings: getDocumentSettings(project),
        projectFiles: [...project.documents.values()].map(d => d.uri.fsPath),
        sources: [...project.documents.values()].map(d => ({ uri: d.uri.toString(), label: vscode.workspace.asRelativePath(d.uri, false), text: d.getText() })),
        rootUri: project.root.uri.toString(),
        pdfUri,
        preambles: getPreambleInfos(project),
        figureResources: await getFigureResources(project, panel.webview),
        bibliographyEntries: await getBibliographyEntries(project),
        bibliographyResources: await getBibliographyResources(project),
        documentSource: project.root.getText(),
        spellCheckSettings,
        selectedFrame,
        focusFrameTitle,
        focusNewMath,
        focusDocumentHeadingStart
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
        if (msg.type === 'spellcheckRequest') {
          const language = String(msg.language || 'en') === 'es' ? 'es' : 'en';
          const blocks = Array.isArray(msg.blocks) ? msg.blocks.map((block: any) => ({ id: String(block.id || ''), text: String(block.text || '') })).filter((block: { id: string; text: string }) => block.id) : [];
          const result = await spellcheckBlocks({ language, blocks });
          panel.webview.postMessage({ type: 'spellcheckResult', requestId: String(msg.requestId || ''), issuesById: result.reduce((acc, item) => { acc[item.id] = item.issues; return acc; }, {} as Record<string, SpellcheckResultBlock['issues']>) });
        }
        if (msg.type === 'updateSpellcheckSetting') {
          const cfg = vscode.workspace.getConfiguration('texflow');
          if (msg.key === 'enabled') await cfg.update('spellCheck.enabled', !!msg.value, vscode.ConfigurationTarget.Workspace);
          if (msg.key === 'language') await cfg.update('spellCheck.language', ['auto', 'en', 'es'].includes(String(msg.value)) ? String(msg.value) : 'auto', vscode.ConfigurationTarget.Workspace);
          await sendDocument();
        }
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
          const replacement = serializeBlock(block, msg.payload);
          updatingFromWebview = true;
          await applyReplacement(ctx.document, absStart, absEnd, replacement);
          updatingFromWebview = false;
          postStatus('saved');
          if (msg.refresh) await sendDocument();
        }
        if (msg.type === 'deleteBlock') {
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
          await applyReplacement(ctx.document, absStart, absEnd, '');
          updatingFromWebview = false;
          postStatus('saved');
          await sendDocument(msg.frameIndex, false);
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
              if (String(msg.feature || '') === 'multicol') {
                await refreshProject();
                await ensurePackage(project, 'multicol');
                await refreshProject();
              }
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
          // Headings are created inline in the visual document. TeXFlow inserts a
          // structurally valid placeholder immediately, then focuses/selects it so the
          // user can type without leaving the editor. Enter commits the heading and
          // moves to the normal paragraph below, matching the semantic model used by LyX.
          const ctx = await getFrameContext(msg.frameIndex);
          const placeholder = level === 'paragraph' ? 'New paragraph heading' : `New ${level}`;
          const headingStart = await insertHeading(ctx?.document ?? project.root, ctx?.frame, level, placeholder);
          await sendDocument(undefined, false, false, headingStart);
        }
        if (msg.type === 'addBibliography') {
          await refreshProject();
          const rootDir = vscode.Uri.joinPath(project.root.uri, '..');
          let system = bibliographySystem(project);
          if (system === 'none') {
            const pickedSystem = await vscode.window.showQuickPick([
              { label: 'BibTeX / natbib', description: 'Classic BibTeX: .bst style + \\bibliography, citations with \\citep / \\citet', value: 'natbib' },
              { label: 'BibLaTeX / biber', description: 'BibLaTeX: \\addbibresource + \\printbibliography', value: 'biblatex' }
            ], { placeHolder: 'Choose the bibliography system' });
            if (!pickedSystem) return;
            system = pickedSystem.value as BibliographySystem;
          }

          const choice = await vscode.window.showQuickPick([
            { label: 'Create references.bib', description: 'Create a new .bib file in this project', value: 'create' },
            { label: 'Use existing .bib file', description: 'Connect an existing bibliography file', value: 'existing' }
          ], { placeHolder: 'Bibliography file' });
          if (!choice) return;

          let bibUri: vscode.Uri | undefined;
          if (choice.value === 'create') {
            bibUri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.joinPath(rootDir, 'references.bib'), filters: { BibTeX: ['bib'] }, saveLabel: 'Create bibliography' });
            if (!bibUri) return;
            try { await vscode.workspace.fs.stat(bibUri); }
            catch { await vscode.workspace.fs.writeFile(bibUri, new TextEncoder().encode('% Bibliography file for this document\n')); }
          } else {
            const selected = await vscode.window.showOpenDialog({ defaultUri: rootDir, canSelectFiles: true, canSelectFolders: false, canSelectMany: false, filters: { BibTeX: ['bib'] }, openLabel: 'Use bibliography' });
            bibUri = selected?.[0];
            if (!bibUri) return;
          }

          let resourceName = path.relative(rootDir.fsPath, bibUri.fsPath).replace(/\\/g, '/');
          if (!resourceName || resourceName === '.') resourceName = path.basename(bibUri.fsPath);
          if (path.isAbsolute(resourceName)) resourceName = bibUri.fsPath.replace(/\\/g, '/');
          const preambleText = [...project.documents.values()].map(d => { const t=d.getText(); const b=t.indexOf('\\begin{document}'); return b>=0?t.slice(0,b):t; }).join('\n');

          if (system === 'biblatex') {
            const existing = bibliographyResourceNames(project).map(x=>x.replace(/\\/g,'/'));
            const additions: string[] = [];
            if (!/\\usepackage(?:\[[^\]]*\])?\{[^}]*\bbiblatex\b[^}]*\}/i.test(preambleText)) additions.push('\\usepackage[backend=biber,style=authoryear]{biblatex}');
            if (!existing.some(x=>x.replace(/^\.\//,'')===resourceName.replace(/^\.\//,''))) additions.push(`\\addbibresource{${resourceName}}`);
            if (additions.length) {
              await beginHistoryStep();
              const source=project.root.getText(); const at=Math.max(0,source.indexOf('\\begin{document}'));
              await applyReplacement(project.root, at, at, `${at>0&&!/\n\s*$/u.test(source.slice(0,at))?'\n':''}${additions.join('\n')}\n\n`);
            }
          } else {
            if (system === 'natbib' && !/\\usepackage(?:\[[^\]]*\])?\{[^}]*\bnatbib\b[^}]*\}/i.test(preambleText)) {
              await beginHistoryStep();
              const source=project.root.getText(); const at=Math.max(0,source.indexOf('\\begin{document}'));
              await applyReplacement(project.root, at, at, '\\usepackage{natbib}\n\n');
            }
            await refreshProject();
            const style = await vscode.window.showInputBox({ prompt: 'BibTeX bibliography style (.bst name, without extension)', value: bibliographyStyle(project) || 'plainnat', placeHolder: 'e.g. econometrica, plainnat, apalike' });
            if (style === undefined) return;
            const cleanStyle=style.trim()||'plainnat';
            const bibName=resourceName.replace(/\.bib$/i,'');
            const source=project.root.getText();
            const placement=await chooseBibliographyPlacement(source, Number(msg.cursorPos));
            if (placement === undefined) return;
            const commands:string[]=[];
            if (!/\\bibliographystyle\{[^}]+\}/i.test(source)) commands.push(`\\bibliographystyle{${cleanStyle}}`);
            if (!/\\bibliography\{[^}]+\}/i.test(source)) commands.push(`\\bibliography{${bibName}}`);
            if (commands.length) {
              await beginHistoryStep();
              const block=project.isBeamer?`\n\\begin{frame}[allowframebreaks]{Bibliography}\n${commands.join('\n')}\n\\end{frame}\n\n`:`\n${commands.join('\n')}\n\n`;
              await applyReplacement(project.root, placement, placement, block);
            }
          }
          await refreshProject();
          panel.webview.postMessage({type:'bibliographyUpdated', bibliographyEntries:await getBibliographyEntries(project), bibliographyResources:await getBibliographyResources(project), documentSource:project.root.getText()});
          if (msg.resumeCitation) panel.webview.postMessage({type:'bibliographyReady',openPicker:true});
          else await sendDocument();
          vscode.window.showInformationMessage(`Bibliography connected: ${vscode.workspace.asRelativePath(bibUri,false)}`);
        }
        if (msg.type === 'openBibliography') {
          await refreshProject(); const resources=await getBibliographyResources(project);
          if (!resources.length) { vscode.window.showWarningMessage('TeXFlow: No bibliography resource is connected yet.'); return; }
          let resource=resources[0];
          if (resources.length>1) { const selected=await vscode.window.showQuickPick(resources.map(r=>({label:r.label,description:r.name,resource:r})),{placeHolder:'Open bibliography'}); if(!selected)return; resource=selected.resource; }
          const document=await vscode.workspace.openTextDocument(vscode.Uri.parse(resource.uri));
          await vscode.window.showTextDocument(document,vscode.ViewColumn.Beside,false);
        }
        if (msg.type === 'addReferencesSection') {
          await refreshProject();
          const system=bibliographySystem(project),source=project.root.getText();
          if(system==='none'){vscode.window.showWarningMessage('TeXFlow: No bibliography is connected yet. Use Add bibliography first.');return;}
          if(system==='natbib'||system==='bibtex'){
            if(/\\bibliography\{[^}]+\}/i.test(source)) vscode.window.showInformationMessage('The BibTeX bibliography is already inserted.');
            else vscode.window.showWarningMessage('TeXFlow: Connect the BibTeX bibliography first.');
            return;
          }
          if(/\\printbibliography(?:\[[^\]]*\])?/i.test(source)){vscode.window.showInformationMessage('This document already contains \\printbibliography.');return;}
          const placement=await chooseBibliographyPlacement(source,Number(msg.cursorPos));
          if(placement===undefined)return;
          await beginHistoryStep();
          const block=project.isBeamer?'\n\\begin{frame}[allowframebreaks]{Bibliography}\n\\printbibliography\n\\end{frame}\n\n':'\n\\printbibliography\n\n';
          await applyReplacement(project.root,placement,placement,block);
          await sendDocument();
        }
        if (msg.type === 'showProjectDiagnostics') {
          await refreshProject();
          const frameBlocks=project.frames.flatMap(f=>parseBlocks(f.body));
          const rawBlocks=frameBlocks.filter(b=>b.kind==='raw').length;
          const bibs=(await getBibliographyResources(project)).length;
          const figures=[...project.documents.values()].reduce((n,d)=>n+(d.getText().match(/\\includegraphics\b/g)||[]).length,0);
          output.clear();output.appendLine('TeXFlow project diagnostics');output.appendLine('===========================');output.appendLine(`Root: ${project.root.uri.fsPath}`);output.appendLine(`Loaded .tex files: ${project.documents.size}`);output.appendLine(`Frames: ${project.frames.length}`);output.appendLine(`Bibliography resources: ${bibs}`);output.appendLine(`Figure commands: ${figures}`);output.appendLine(`Preserved raw blocks in Beamer frames: ${rawBlocks}`);output.appendLine('');for(const doc of project.documents.values())output.appendLine(`- ${doc.uri.fsPath}`);output.show(true);
        }
        if (msg.type === 'chooseSubfigures') {
          postStatus('saving');
          await refreshProject();
          const ctx = project.isBeamer ? await getFrameContext(msg.frameIndex) : undefined;
          const targetDocument = ctx?.document ?? project.root;
          const chosen = await chooseMultipleFigureFiles(targetDocument);
          if (!chosen.length) { postStatus('saved'); return; }
          panel.webview.postMessage({ type:'subfiguresChosen', paths:chosen.map(x=>x.latexPath), frameIndex:Number(msg.frameIndex), cursorPos:Number(msg.cursorPos) });
          postStatus('saved');
        }
        if (msg.type === 'insertFigure') {
          postStatus('saving');
          await refreshProject();
          const ctx = project.isBeamer ? await getFrameContext(msg.frameIndex) : undefined;
          const targetDocument = ctx?.document ?? project.root;
          const chosen = await chooseFigureFile(targetDocument);
          if (!chosen) { postStatus('saved'); return; }
          const stem = path.parse(chosen.latexPath).name.replace(/[^A-Za-z0-9:_-]+/g, '-');
          panel.webview.postMessage({
            type: 'figureFileChosen',
            latexPath: chosen.latexPath,
            defaultLabel: `fig:${stem}`,
            frameIndex: Number(msg.frameIndex),
            cursorPos: Number(msg.cursorPos)
          });
          postStatus('saved');
        }
        if (msg.type === 'insertFigureConfigured') {
          postStatus('saving');
          await refreshProject();
          const latexPath = String(msg.latexPath || '').trim();
          const caption = String(msg.caption || '').trim();
          const shortCaption = String(msg.shortCaption || '').trim();
          const angle = Math.max(-360, Math.min(360, Number(msg.angle) || 0));
          const label = String(msg.label || '').trim();
          const placement = project.isBeamer ? '' : String(msg.placement || '').trim();
          const captionPosition = String(msg.captionPosition || 'below') === 'above' ? 'above' : 'below';
          const align = ['left','center','right'].includes(String(msg.align || 'center')) ? String(msg.align || 'center') : 'center';
          const widthPercent = Math.max(5, Math.min(100, Number(msg.widthPercent) || 70));
          if (!latexPath) { vscode.window.showWarningMessage('TeXFlow: Choose a figure file first.'); postStatus('saved'); return; }
          if (label && !/^[^{}\\\s]+$/.test(label)) { vscode.window.showWarningMessage('TeXFlow: Labels cannot contain spaces, braces, or backslashes.'); postStatus('saved'); return; }
          if (label && [...project.documents.values()].some(d => d.getText().includes(`\\label{${label}}`))) { vscode.window.showWarningMessage(`TeXFlow: label ${label} already exists.`); postStatus('saved'); return; }
          await beginHistoryStep();
          const rootLengthBeforePackage = project.root.getText().length;
          const hasGraphicx = [...project.documents.values()].some(d => /\\usepackage(?:\[[^\]]*\])?\{[^}]*\bgraphicx\b[^}]*\}/.test(d.getText()));
          if (!hasGraphicx) await ensureGraphicx(project.root);
          await refreshProject();
          const packageDelta = project.root.getText().length - rootLengthBeforePackage;
          const block = figureBlockLatex(latexPath, caption, label, placement, project.isBeamer, captionPosition, align, widthPercent, shortCaption, angle);
          if (project.isBeamer) {
            const insertCtx = await getFrameContext(Number(msg.frameIndex));
            if (!insertCtx) throw new Error('TeXFlow could not relocate the target frame after preparing the figure.');
            const pos = insertCtx.frame.end - '\\end{frame}'.length;
            await applyReplacement(insertCtx.document, pos, pos, `\n\n${block}\n`);
            await sendDocument(Number(msg.frameIndex), false, false);
          } else {
            const source = project.root.getText();
            const end = source.lastIndexOf('\\end{document}');
            let requested = Number(msg.cursorPos);
            if (Number.isFinite(requested) && packageDelta > 0) requested += packageDelta;
            const pos = Number.isFinite(requested) && requested >= 0 && requested <= (end >= 0 ? end : source.length)
              ? Math.trunc(requested) : (end >= 0 ? end : source.length);
            await applyReplacement(project.root, pos, pos, `\n\n${block}\n\n`);
            await sendDocument();
          }
          postStatus('saved');
        }
        if (msg.type === 'insertTable') {
          postStatus('saving');
          await refreshProject();
          const rows = Number(msg.rows);
          const cols = Number(msg.cols);
          const caption = String(msg.caption || '').trim();
          const label = String(msg.label || '').trim();
          const placement = project.isBeamer ? '' : String(msg.placement || '').trim();
          const tableStyle: 'plain' | 'booktabs' = String(msg.tableStyle || 'plain') === 'booktabs' ? 'booktabs' : 'plain';
          const alignments = Array.isArray(msg.alignments) ? msg.alignments.map((x: unknown) => String(x || 'c')) : [];
          if (!Number.isInteger(rows) || rows < 1 || rows > 30 || !Number.isInteger(cols) || cols < 1 || cols > 12) {
            vscode.window.showWarningMessage('TeXFlow: tables support 1–30 rows and 1–12 columns.'); postStatus('saved'); return;
          }
          if (label && !/^[^{}\\\s]+$/.test(label)) {
            vscode.window.showWarningMessage('TeXFlow: labels cannot contain spaces, braces, or backslashes.'); postStatus('saved'); return;
          }
          if (label && [...project.documents.values()].some(d => d.getText().includes(`\\label{${label}}`))) {
            vscode.window.showWarningMessage(`TeXFlow: label ${label} already exists.`); postStatus('saved'); return;
          }
          if (!project.isBeamer && placement && !['htbp','h','t','b','p'].includes(placement)) {
            vscode.window.showWarningMessage('TeXFlow: unsupported table placement.'); postStatus('saved'); return;
          }
          await beginHistoryStep();
          if (tableStyle === 'booktabs') await ensurePackage(project, 'booktabs');
          await refreshProject();
          const block = tableBlockLatex(rows, cols, caption, label, placement, project.isBeamer, alignments, tableStyle);
          if (project.isBeamer) {
            const insertCtx = await getFrameContext(msg.frameIndex);
            if (!insertCtx) throw new Error('TeXFlow could not locate the target frame for the table.');
            const pos = insertCtx.frame.end - '\\end{frame}'.length;
            await applyReplacement(insertCtx.document, pos, pos, `\n\n${block}\n`);
            await sendDocument(msg.frameIndex, false, false);
          } else {
            const source = project.root.getText();
            const docEnd = source.lastIndexOf('\\end{document}');
            const requested = Number(msg.cursorPos);
            const pos = Number.isFinite(requested) && requested >= 0 && requested <= (docEnd >= 0 ? docEnd : source.length) ? Math.trunc(requested) : (docEnd >= 0 ? docEnd : source.length);
            await applyReplacement(project.root, pos, pos, `\n\n${block}\n\n`);
            await sendDocument();
          }
          postStatus('saved');
        }
        if (msg.type === 'insertVerticalSpace') {
          postStatus('saving');
          await refreshProject();
          const amount = String(msg.amount || '').trim();
          const starred = !!msg.starred;
          if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*(?:pt|mm|cm|in|em|ex|pc|bp|dd|cc|sp|\\baselineskip|\\parskip|\\textheight|\\linewidth)$/.test(amount)) {
            vscode.window.showWarningMessage('TeXFlow: enter a LaTeX length such as 6pt, 0.5cm, 1em, or \baselineskip.'); postStatus('saved'); return;
          }
          await beginHistoryStep();
          const code = `\\vspace${starred ? '*' : ''}{${amount}}`;
          if (project.isBeamer) {
            const insertCtx = await getFrameContext(msg.frameIndex);
            if (!insertCtx) { postStatus('saved'); return; }
            const pos = insertCtx.frame.end - '\\end{frame}'.length;
            await applyReplacement(insertCtx.document, pos, pos, `\n\n${code}\n`);
            await sendDocument(msg.frameIndex, false, false);
          } else {
            const source = project.root.getText();
            const docEnd = source.lastIndexOf('\\end{document}');
            const requested = Number(msg.cursorPos);
            const pos = Number.isFinite(requested) && requested >= 0 && requested <= (docEnd >= 0 ? docEnd : source.length) ? Math.trunc(requested) : (docEnd >= 0 ? docEnd : source.length);
            await applyReplacement(project.root, pos, pos, `\n\n${code}\n\n`);
            await sendDocument();
          }
          postStatus('saved');
        }
        if (msg.type === 'showWarning') {
          vscode.window.showWarningMessage(String(msg.message || 'TeXFlow warning'));
        }
        if (msg.type === 'writeClipboardText') {
          await vscode.env.clipboard.writeText(String(msg.text ?? ''));
        }
        if (msg.type === 'chooseTableDataFile') {
          const picked = await vscode.window.showOpenDialog({
            canSelectFiles: true, canSelectFolders: false, canSelectMany: false,
            filters: { 'CSV / TSV / text': ['csv','tsv','txt'] },
            openLabel: 'Use table data file'
          });
          if (picked?.[0]) {
            const bytes = await vscode.workspace.fs.readFile(picked[0]);
            panel.webview.postMessage({ type:'tableDataFileChosen', name:path.basename(picked[0].fsPath), text:new TextDecoder().decode(bytes) });
          }
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
        if (msg.type === 'ensureFeaturePackage') {
          // Keep package management in the same serialized edit queue as visual
          // document writes so a TeXFlow-originated preamble edit cannot race a
          // formatting/inline-object save and trigger the stale-document guard.
          const feature = String(msg.feature || '');
          documentEditQueue = documentEditQueue.then(async () => {
            await refreshProject();
            if (feature === 'link') await ensurePackage(project, 'hyperref');
            if (feature === 'index') { await ensurePackage(project, 'makeidx'); await ensurePreambleCommand(project.root, '\\makeindex'); }
            if (feature === 'nomenclature') { await ensurePackage(project, 'nomencl'); await ensurePreambleCommand(project.root, '\\makenomenclature'); }
            if (feature === 'booktabs') await ensurePackage(project, 'booktabs');
            if (feature === 'multicol') await ensurePackage(project, 'multicol');
            await refreshProject();
            await sendDocument();
          });
          await documentEditQueue;
        }
        if (msg.type === 'insertRawLatex') {
          postStatus('saving');
          await refreshProject();
          let code = String(msg.latex || '').trim();
          if (!code) { postStatus('saved'); return; }
          const feature = String(msg.feature || '');
          await beginHistoryStep();
          if (feature === 'link') await ensurePackage(project, 'hyperref');
          if (feature === 'box') await ensurePackage(project, 'graphicx');
          if (feature === 'subfigure') { await ensurePackage(project,'graphicx'); await ensurePackage(project,'subcaption'); }
          if (feature === 'theorem') {
            await ensurePackage(project, 'amsthm');
            await ensureTheoremDefinitions(project.root);
          }
          if (feature === 'index') {
            await ensurePackage(project, 'makeidx');
            await ensurePreambleCommand(project.root, '\\makeindex');
          }
          if (feature === 'nomenclature') {
            await ensurePackage(project, 'nomencl');
            await ensurePreambleCommand(project.root, '\\makenomenclature');
          }
          await refreshProject();
          if (project.isBeamer) {
            const ctx = await getFrameContext(Number(msg.frameIndex));
            if (!ctx) { postStatus('saved'); return; }
            const pos = ctx.frame.end - '\\end{frame}'.length;
            await applyReplacement(ctx.document, pos, pos, `\n\n${code}\n`);
            await sendDocument(ctx.frame.index);
          } else {
            const doc = await vscode.workspace.openTextDocument(rootUri);
            const source = doc.getText(); const docEnd = source.lastIndexOf('\\end{document}');
            const requested = Number(msg.cursorPos);
            const max = docEnd >= 0 ? docEnd : source.length;
            const pos = Number.isFinite(requested) && requested >= 0 && requested <= max ? Math.trunc(requested) : max;
            await applyReplacement(doc, pos, pos, `\n\n${code}\n\n`);
            await sendDocument();
          }
          postStatus('saved');
        }
        if (msg.type === 'replaceWholeDocumentExpected') {
          if (project.isBeamer) return;
          postStatus('saving'); await beginHistoryStep(); await refreshProject();
          const expected = String(msg.expected ?? ''), replacement = String(msg.replacement ?? '');
          if (project.root.getText() !== expected) throw new Error('TeXFlow document changed before the structural operation could be saved. Refresh and try again.');
          updatingFromWebview = true;
          try { await applyReplacement(project.root, 0, expected.length, replacement); } finally { updatingFromWebview = false; }
          await sendDocument(); postStatus('saved');
        }
        if (msg.type === 'findReplaceText') {
          if (project.isBeamer) { vscode.window.showWarningMessage('TeXFlow Labs: Find/Replace currently operates on document-mode files only.'); return; }
          const find = String(msg.find ?? ''); if (!find) return;
          const replace = String(msg.replace ?? '');
          await refreshProject(); const src = project.root.getText();
          const begin = src.indexOf('\\begin{document}'), end = src.lastIndexOf('\\end{document}');
          if (begin < 0 || end < begin) return;
          const bodyStart = begin + '\\begin{document}'.length, body = src.slice(bodyStart, end);
          // Labs implementation: literal replacements only outside command names. It deliberately
          // refuses replacements containing a backslash so it cannot mutate LaTeX commands.
          if (find.includes('\\')) { vscode.window.showWarningMessage('TeXFlow Labs: Find/Replace does not modify LaTeX commands.'); return; }
          const replacementBody = body.split(find).join(replace);
          if (replacementBody === body) { vscode.window.showInformationMessage('TeXFlow: no matches found.'); return; }
          await beginHistoryStep(); updatingFromWebview = true;
          try { await applyReplacement(project.root, bodyStart, end, replacementBody); } finally { updatingFromWebview = false; }
          await sendDocument(); postStatus('saved');
        }
        if (msg.type === 'saveDocumentSettings') {
          postStatus('saving');
          await beginHistoryStep();
          await refreshProject();
          await applyDocumentSettings(project, msg.settings || {}, output);
          await sendDocument();
          postStatus('saved');
        }
        if (msg.type === 'insertLayoutColumns') {
          postStatus('saving');
          await beginHistoryStep();
          await refreshProject();
          const count = Math.max(2, Math.min(4, Number(msg.count) || 2));
          if (project.isBeamer) {
            const ctx = await getFrameContext(Number(msg.frameIndex));
            if (ctx) {
              const widths = Array.from({ length: count }, () => Number((0.96 / count).toFixed(3)));
              const parts = widths.map((w, i) => `\\column{${w}\\textwidth}\nColumn ${i + 1}`).join('\n');
              const block = `\\begin{columns}[T]\n${parts}\n\\end{columns}`;
              const pos = ctx.frame.end - '\\end{frame}'.length;
              await applyReplacement(ctx.document, pos, pos, `\n\n${block}\n`);
              await sendDocument(ctx.frame.index);
            }
          } else {
            const rootLengthBeforePackage = project.root.getText().length;
            await ensurePackage(project, 'multicol');
            const doc = await vscode.workspace.openTextDocument(rootUri);
            const src = doc.getText();
            const packageDelta = src.length - rootLengthBeforePackage;
            const docEnd = src.lastIndexOf('\\end{document}');
            let requested = Number(msg.cursorPos);
            if (Number.isFinite(requested) && packageDelta > 0) requested += packageDelta;
            const max = docEnd >= 0 ? docEnd : src.length;
            const pos = Number.isFinite(requested) && requested >= 0 && requested <= max ? Math.trunc(requested) : max;
            await applyReplacement(doc, pos, pos, `\n\n\\begin{multicols}{${count}}\n\n\\end{multicols}\n\n`);
            await sendDocument();
          }
          postStatus('saved');
        }
        if (msg.type === 'insertBeamerBlock') {
          if (!project.isBeamer) return;
          postStatus('saving'); await beginHistoryStep();
          const ctx = await getFrameContext(Number(msg.frameIndex));
          if (ctx) {
            const env = ['block','alertblock','exampleblock'].includes(String(msg.env)) ? String(msg.env) : 'block';
            const title = escapeTitle(String(msg.title || 'Block title'));
            const pos = ctx.frame.end - '\\end{frame}'.length;
            await applyReplacement(ctx.document, pos, pos, `\n\n\\begin{${env}}{${title}}\nBlock content\n\\end{${env}}\n`);
            await sendDocument(ctx.frame.index);
          }
          postStatus('saved');
        }
        if (msg.type === 'updateFrameOptions') {
          if (!project.isBeamer) return;
          postStatus('saving'); await beginHistoryStep();
          const ctx = await getFrameContext(Number(msg.frameIndex));
          if (ctx) {
            const current = ctx.document.getText().slice(ctx.frame.start, ctx.frame.end);
            const begin = /^\\begin\{frame\}(?:\[[^\]]*\])?/.exec(current);
            if (begin) {
              const opts: string[] = [];
              const vertical = String(msg.vertical || 'center'); if (vertical === 'top') opts.push('t'); else if (vertical === 'bottom') opts.push('b');
              if (msg.fragile) opts.push('fragile'); if (msg.allowFrameBreaks) opts.push('allowframebreaks');
              const replacement = `\\begin{frame}${opts.length ? `[${opts.join(',')}]` : ''}`;
              await applyReplacement(ctx.document, ctx.frame.start, ctx.frame.start + begin[0].length, replacement);
              await sendDocument(ctx.frame.index);
            }
          }
          postStatus('saved');
        }
        if (msg.type === 'updateFrameFontSize') {
          if (!project.isBeamer) return;
          postStatus('saving'); await beginHistoryStep();
          const ctx = await getFrameContext(Number(msg.frameIndex));
          if (ctx) {
            const requested = ['normal', 'small', 'footnotesize', 'scriptsize', 'tiny'].includes(String(msg.size)) ? String(msg.size) : 'normal';
            const current = ctx.document.getText().slice(ctx.frame.start, ctx.frame.end);
            const begin = /^\\begin\{frame\}(?:\[[^\]]*\])?(?:\{[^}]*\})?/.exec(current);
            if (begin) {
              const bodyStart = begin[0].length;
              const bodyEnd = current.lastIndexOf('\\end{frame}');
              const body = current.slice(bodyStart, bodyEnd < 0 ? current.length : bodyEnd);
              const sizeMatch = /^((?:(?:[ \t\r\n]+)|(?:[ \t]*%[^\n]*(?:\r?\n|$)))*)\\(normalsize|small|footnotesize|scriptsize|tiny)\b[ \t]*(?:%[^\n]*)?(?:\r?\n)?/.exec(body);
              if (sizeMatch) {
                const newline = sizeMatch[0].includes('\r\n') ? '\r\n' : '\n';
                const replacement = sizeMatch[1] + (requested === 'normal' ? '' : `\\${requested}${newline}`);
                await applyReplacement(ctx.document, ctx.frame.start + bodyStart, ctx.frame.start + bodyStart + sizeMatch[0].length, replacement);
                await sendDocument(ctx.frame.index);
              } else if (requested !== 'normal') {
                const newline = body.includes('\r\n') ? '\r\n' : '\n';
                const insertion = body.startsWith(newline) ? `${newline}\\${requested}` : `${newline}\\${requested}${newline}`;
                await applyReplacement(ctx.document, ctx.frame.start + bodyStart, ctx.frame.start + bodyStart, insertion);
                await sendDocument(ctx.frame.index);
              }
            }
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

function packageCommand(project: ProjectModel, packageName: string): { document: vscode.TextDocument; start: number; end: number; options: string } | undefined {
  const re = new RegExp('\\\\usepackage(?:\\[([^\\]]*)\\])?\\{([^}]*)\\}', 'g');
  for (const doc of project.documents.values()) {
    const text = doc.getText(); const begin = text.indexOf('\\begin{document}'); const prefix = begin >= 0 ? text.slice(0, begin) : text;
    let m: RegExpExecArray | null;
    while ((m = re.exec(prefix))) {
      const names = String(m[2] || '').split(',').map(x => x.trim());
      if (names.includes(packageName)) return { document: doc, start: m.index, end: m.index + m[0].length, options: String(m[1] || '') };
    }
  }
  return undefined;
}

async function ensurePackage(project: ProjectModel, packageName: string, options = '') {
  const found = packageCommand(project, packageName); if (found) return;
  const root = await vscode.workspace.openTextDocument(project.root.uri); const text = root.getText(); const begin = text.indexOf('\\begin{document}'); if (begin < 0) return;
  await applyReplacement(root, begin, begin, `\\usepackage${options ? `[${options}]` : ''}{${packageName}}\n`);
}

async function ensurePreambleCommand(document: vscode.TextDocument, command: string) {
  const fresh = await vscode.workspace.openTextDocument(document.uri); const src = fresh.getText();
  const begin = src.indexOf('\\begin{document}'); if (begin < 0 || src.slice(0, begin).includes(command)) return;
  await applyReplacement(fresh, begin, begin, `${command}\n`);
}

async function ensureTheoremDefinitions(document: vscode.TextDocument) {
  const fresh = await vscode.workspace.openTextDocument(document.uri); const src = fresh.getText(); const begin = src.indexOf('\\begin{document}'); if (begin < 0) return;
  const prefix = src.slice(0, begin); if (/\\newtheorem\{theorem\}/.test(prefix)) return;
  const defs = `% TeXFlow Labs theorem environments\n\\newtheorem{theorem}{Theorem}\n\\newtheorem{lemma}[theorem]{Lemma}\n\\newtheorem{proposition}[theorem]{Proposition}\n\\newtheorem{corollary}[theorem]{Corollary}\n\\theoremstyle{definition}\n\\newtheorem{definition}[theorem]{Definition}\n`;
  await applyReplacement(fresh, begin, begin, defs);
}

function getDocumentSettings(project: ProjectModel): DocumentSettings {
  const root = project.root.getText();
  const cls = /\\documentclass(?:\[([^\]]*)\])?\{[^}]+\}/.exec(root); const opts = String(cls?.[1] || '').split(',').map(x=>x.trim()).filter(Boolean);
  const all = [...project.documents.values()].map(d=>d.getText()).join('\n');
  const fontSize = opts.find(x=>/^(?:9|10|11|12|14|17|20)pt$/.test(x)) || (project.isBeamer ? '11pt' : '12pt');
  const paper = opts.find(x=>/^(?:a4paper|a5paper|letterpaper|legalpaper)$/.test(x)) || 'a4paper';
  const language = /\\usepackage(?:\[([^\]]+)\])?\{babel\}/.exec(all)?.[1]?.split(',')[0]?.trim() || '';
  const lineSpread = /\\linespread\{([^}]+)\}/.exec(all)?.[1] || '1';
  const lineSpacing = Math.abs(Number(lineSpread)-1.6)<.08?'double':Math.abs(Number(lineSpread)-1.3)<.08?'onehalf':'single';
  const gm = /\\(?:usepackage\[([^\]]*)\]\{geometry\}|geometry\{([^}]*)\})/.exec(all); const gopts=String(gm?.[1]||gm?.[2]||''); const margin=/\bmargin\s*=\s*([^,}]+)/.exec(gopts)?.[1]?.trim() || '';
  const alignment: DocumentSettings['defaultAlignment'] = /\\raggedright\b/.test(all)?'left':/\\raggedleft\b/.test(all)?'right':/\\centering\b/.test(all)?'center':'justify';
  const aspect = /\\documentclass(?:\[([^\]]*)\])?\{beamer\}/.exec(root)?.[1]?.match(/aspectratio\s*=\s*(\d+)/)?.[1] || '43';
  const theme = /\\usetheme(?:\[[^\]]*\])?\{([^}]+)\}/.exec(all)?.[1] || 'default';
  const known = new Set(['babel','geometry','setspace','amsmath','amssymb','graphicx','booktabs','multicol']); const extras:string[]=[]; const re=/\\usepackage(?:\[([^\]]*)\])?\{([^}]+)\}/g; let m:RegExpExecArray|null;
  while((m=re.exec(all))){for(const name of String(m[2]).split(',').map(x=>x.trim())) if(name&&!known.has(name)) extras.push(name+(m[1]?`[${m[1]}]`:''));}
  const paragraphIndent = /\\setlength\{\\parindent\}\{([^}]+)\}/.exec(all)?.[1]?.trim() || '';
  const paragraphSkip = /\\setlength\{\\parskip\}\{([^}]+)\}/.exec(all)?.[1]?.trim() || '';
  const hyperlinks = /\\usepackage(?:\[[^\]]*\])?\{hyperref\}/.test(all);
  return { fontSize, paper, orientation: opts.includes('landscape')?'landscape':'portrait', globalColumns: opts.includes('twocolumn')?'two':'one', language, lineSpacing, defaultAlignment: alignment, margin, paragraphIndent, paragraphSkip, hyperlinks, beamerAspect: aspect, beamerTheme: theme, extraPackages:[...new Set(extras)].join(', ') };
}

function getSpellCheckSettings(project: ProjectModel): SpellCheckSettings {
  const cfg = vscode.workspace.getConfiguration('texflow');
  const enabled = cfg.get<boolean>('spellCheck.enabled', true);
  const language = cfg.get<'auto' | 'en' | 'es'>('spellCheck.language', 'auto');
  return { enabled, language };
}

function resolveSpellCheckLanguage(project: ProjectModel): SpellcheckLanguage {
  const setting = getSpellCheckSettings(project).language;
  if (setting === 'en' || setting === 'es') return setting;
  const raw = String(getDocumentSettings(project).language || '').toLowerCase().replace(/_/g, '-');
  if (/^(spanish|es|es-es|es-mx|es-ar|es-cl|es-co|es-pe|es-419)$/.test(raw)) return 'es';
  if (/^(english|american|british|en|en-us|en-gb|en-au|en-ca|en-nz)$/.test(raw)) return 'en';
  return 'en';
}

async function applyDocumentSettings(project: ProjectModel, raw: any, output: vscode.OutputChannel) {
  const settings: DocumentSettings = {
    fontSize: /^(?:9|10|11|12|14|17|20)pt$/.test(String(raw.fontSize||''))?String(raw.fontSize):(project.isBeamer?'11pt':'12pt'),
    paper: /^(?:a4paper|a5paper|letterpaper|legalpaper)$/.test(String(raw.paper||''))?String(raw.paper):'a4paper',
    orientation: raw.orientation==='landscape'?'landscape':'portrait', globalColumns: raw.globalColumns==='two'?'two':'one', language:String(raw.language||'').replace(/[^A-Za-z-]/g,''),
    lineSpacing:['single','onehalf','double'].includes(String(raw.lineSpacing))?raw.lineSpacing:'single', defaultAlignment:['justify','left','center','right'].includes(String(raw.defaultAlignment))?raw.defaultAlignment:'justify',
    margin:/^\d+(?:\.\d+)?(?:mm|cm|in|pt)$/.test(String(raw.margin||''))?String(raw.margin):'',
    paragraphIndent:/^\d+(?:\.\d+)?(?:mm|cm|in|pt|em|ex)$/.test(String(raw.paragraphIndent||''))?String(raw.paragraphIndent):'',
    paragraphSkip:/^\d+(?:\.\d+)?(?:mm|cm|in|pt|em|ex)$/.test(String(raw.paragraphSkip||''))?String(raw.paragraphSkip):'',
    hyperlinks:!!raw.hyperlinks, beamerAspect:/^(?:43|169|1610|149|54|32)$/.test(String(raw.beamerAspect||''))?String(raw.beamerAspect):'43', beamerTheme:String(raw.beamerTheme||'default').replace(/[^A-Za-z0-9_-]/g,''), extraPackages:String(raw.extraPackages||'')
  };
  let root = await vscode.workspace.openTextDocument(project.root.uri); let text=root.getText(); const cm=/\\documentclass(?:\[([^\]]*)\])?\{([^}]+)\}/.exec(text);
  if(cm){const old=String(cm[1]||'').split(',').map(x=>x.trim()).filter(Boolean).filter(x=>!/^(?:9|10|11|12|14|17|20)pt$/.test(x)&&!/^(?:a4paper|a5paper|letterpaper|legalpaper)$/.test(x)&&x!=='landscape'&&x!=='twocolumn'&&!/^aspectratio\s*=/.test(x)); old.unshift(settings.fontSize); if(!project.isBeamer) old.push(settings.paper); if(settings.orientation==='landscape')old.push('landscape'); if(!project.isBeamer&&settings.globalColumns==='two')old.push('twocolumn'); if(project.isBeamer)old.push(`aspectratio=${settings.beamerAspect}`); const rep=`\\documentclass[${[...new Set(old)].join(',')}]{${cm[2]}}`; await applyReplacement(root,cm.index,cm.index+cm[0].length,rep);}
  // Reopen after the class edit so offsets are current.
  project = await loadProject(await vscode.workspace.openTextDocument(project.root.uri), output);
  const updatePkg=async(name:string, options:string)=>{const found=packageCommand(project,name); if(found){await applyReplacement(found.document,found.start,found.end,`\\usepackage${options?`[${options}]`:''}{${name}}`);} else if(options||name!=='babel') await ensurePackage(project,name,options);};
  if(settings.language) await updatePkg('babel',settings.language);
  if(settings.margin) await updatePkg('geometry',`margin=${settings.margin}`);
  if(settings.hyperlinks) await ensurePackage(project,'hyperref');
  root=await vscode.workspace.openTextDocument(project.root.uri); text=root.getText(); const begin=text.indexOf('\\begin{document}'); if(begin>=0){const startMark='% TeXFlow managed document settings'; const endMark='% End TeXFlow managed document settings'; const existingStart=text.indexOf(startMark),existingEnd=text.indexOf(endMark); let managed=`${startMark}\n`;
    managed += settings.lineSpacing==='double'?'\\linespread{1.6}\n':settings.lineSpacing==='onehalf'?'\\linespread{1.3}\n':'\\linespread{1}\n';
    if(settings.paragraphIndent) managed += `\\setlength{\\parindent}{${settings.paragraphIndent}}\n`;
    if(settings.paragraphSkip) managed += `\\setlength{\\parskip}{${settings.paragraphSkip}}\n`;
    managed += settings.defaultAlignment==='left'?'\\AtBeginDocument{\\raggedright}\n':settings.defaultAlignment==='right'?'\\AtBeginDocument{\\raggedleft}\n':settings.defaultAlignment==='center'?'\\AtBeginDocument{\\centering}\n':'';
    if(project.isBeamer&&settings.beamerTheme) managed += `\\usetheme{${settings.beamerTheme}}\n`; managed += `${endMark}\n`;
    if(existingStart>=0&&existingEnd>=existingStart) await applyReplacement(root,existingStart,existingEnd+endMark.length+(text[existingEnd+endMark.length]==='\n'?1:0),managed); else await applyReplacement(root,begin,begin,managed+'\n');
  }
  // Extra packages are additive only; unknown existing package declarations are never removed.
  project = await loadProject(await vscode.workspace.openTextDocument(project.root.uri), output);
  for(const token of settings.extraPackages.split(',').map(x=>x.trim()).filter(Boolean)){const mm=/^([A-Za-z0-9_-]+)(?:\[([^\]]*)\])?$/.exec(token); if(mm) await ensurePackage(project,mm[1],mm[2]||'');}
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

function cleanBibValue(value: string): string {
  let out = String(value ?? '').trim();
  if ((out.startsWith('{') && out.endsWith('}')) || (out.startsWith('"') && out.endsWith('"'))) out = out.slice(1, -1);
  return out.replace(/\s+/g, ' ').trim();
}

function splitTopLevelBibFields(source: string): string[] {
  const out: string[] = [];
  let start = 0, brace = 0, quote = false, escape = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"' && brace === 0) { quote = !quote; continue; }
    if (quote) continue;
    if (ch === '{') brace++;
    else if (ch === '}') brace = Math.max(0, brace - 1);
    else if (ch === ',' && brace === 0) { out.push(source.slice(start, i)); start = i + 1; }
  }
  out.push(source.slice(start));
  return out.map(x => x.trim()).filter(Boolean);
}

function parseBibText(source: string, sourceLabel: string): BibliographyEntry[] {
  const entries: BibliographyEntry[] = [];
  const text = String(source ?? '');
  const head = /@([A-Za-z]+)\s*([\{(])\s*([^,\s]+)\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = head.exec(text))) {
    const type = m[1].toLowerCase();
    if (type === 'comment' || type === 'preamble' || type === 'string') continue;
    const open = m[2], close = open === '{' ? '}' : ')';
    let depth = 1, quote = false, escape = false, i = head.lastIndex;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"' && depth === 1) { quote = !quote; continue; }
      if (quote) continue;
      if (ch === open) depth++;
      else if (ch === close) { depth--; if (depth === 0) break; }
    }
    if (depth !== 0) break;
    const body = text.slice(head.lastIndex, i);
    const fields: Record<string, string> = {};
    for (const part of splitTopLevelBibFields(body)) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const name = part.slice(0, eq).trim().toLowerCase();
      if (!/^[a-z][a-z0-9_-]*$/i.test(name)) continue;
      fields[name] = cleanBibValue(part.slice(eq + 1));
    }
    entries.push({ key: m[3].trim(), type, fields, source: sourceLabel });
    head.lastIndex = i + 1;
  }
  return entries;
}

function bibliographySystem(project: ProjectModel): BibliographySystem {
  const source = [...project.documents.values()].map(d => d.getText()).join('\n');
  if (/\\addbibresource(?:\[[^\]]*\])?\{[^}]+\}/i.test(source) || /\\usepackage(?:\[[^\]]*\])?\{[^}]*\bbiblatex\b[^}]*\}/i.test(source)) return 'biblatex';
  if (/\\bibliography\{[^}]+\}/i.test(source)) {
    if (/\\usepackage(?:\[[^\]]*\])?\{[^}]*\bnatbib\b[^}]*\}/i.test(source) || /\\(?:citep|citet)\b/.test(source)) return 'natbib';
    return 'bibtex';
  }
  return 'none';
}

function bibliographyStyle(project: ProjectModel): string {
  const source = [...project.documents.values()].map(d => d.getText()).join('\n');
  return /\\bibliographystyle\{([^}]+)\}/i.exec(source)?.[1]?.trim() || '';
}

async function chooseBibliographyPlacement(source: string, cursorPos: number): Promise<number | undefined> {
  const endPos = source.lastIndexOf('\\end{document}');
  if (endPos < 0) throw new Error('TeXFlow could not locate \\end{document}.');
  const appendix = /(^|\n)\s*\\appendix\b/m.exec(source.slice(0,endPos));
  const options: {label:string;description:string;value:'end'|'cursor'|'beforeAppendix'}[] = [
    {label:'At end of document',description:'Insert immediately before \\end{document}',value:'end'}
  ];
  if (Number.isFinite(cursorPos) && cursorPos >= 0 && cursorPos <= endPos) options.push({label:'At current position',description:'Insert after the current visual block',value:'cursor'});
  if (appendix) options.push({label:'Before appendices',description:'Insert immediately before \\appendix',value:'beforeAppendix'});
  const pick = await vscode.window.showQuickPick(options,{placeHolder:appendix?'Where should the bibliography be inserted?':'Bibliography placement'});
  if (!pick) return undefined;
  if (pick.value === 'cursor') return Math.min(Math.max(0,Math.trunc(cursorPos)),endPos);
  if (pick.value === 'beforeAppendix' && appendix) return appendix.index + appendix[1].length;
  return endPos;
}

function bibliographyResourceNames(project: ProjectModel): string[] {
  const names: string[] = [];
  for (const document of project.documents.values()) {
    const source = document.getText();
    let m: RegExpExecArray | null;
    const add = /\\addbibresource(?:\[[^\]]*\])?\{([^}]+)\}/g;
    while ((m = add.exec(source))) names.push(m[1].trim());
    const legacy = /\\bibliography\{([^}]+)\}/g;
    while ((m = legacy.exec(source))) m[1].split(',').map(x => x.trim()).filter(Boolean).forEach(x => names.push(/\.bib$/i.test(x) ? x : x + '.bib'));
  }
  return [...new Set(names.filter(Boolean))];
}

async function getBibliographyResources(project: ProjectModel): Promise<BibliographyResource[]> {
  const rootDir = vscode.Uri.joinPath(project.root.uri, '..');
  const seen = new Set<string>();
  const resources: BibliographyResource[] = [];
  for (let rawName of bibliographyResourceNames(project)) {
    if (!/\.bib$/i.test(rawName)) rawName += '.bib';
    const absolute = path.isAbsolute(rawName) || /^[A-Za-z]:[\\/]/.test(rawName);
    const candidates: vscode.Uri[] = absolute ? [vscode.Uri.file(rawName)] : [vscode.Uri.joinPath(rootDir, rawName)];
    if (!absolute) for (const document of project.documents.values()) candidates.push(vscode.Uri.joinPath(document.uri, '..', rawName));
    let found: vscode.Uri | undefined;
    for (const candidate of candidates) { try { await vscode.workspace.fs.stat(candidate); found = candidate; break; } catch { /* next */ } }
    if (!found || seen.has(found.toString())) continue;
    seen.add(found.toString());
    resources.push({name:rawName,uri:found.toString(),label:vscode.workspace.asRelativePath(found,false)});
  }
  return resources;
}

async function getBibliographyEntries(project: ProjectModel): Promise<BibliographyEntry[]> {
  const entries: BibliographyEntry[] = [];
  for (const resource of await getBibliographyResources(project)) {
    try {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.parse(resource.uri));
      entries.push(...parseBibText(new TextDecoder('utf-8').decode(bytes), resource.label));
    } catch { /* keep editor usable when a .bib file is unreadable */ }
  }
  return entries;
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
  let pos = current ? current.end : source.lastIndexOf('\\end{document}');
  if (pos < 0) pos = source.length;
  // Structural headings are standalone units in TeXFlow. Always surround a
  // newly inserted heading with paragraph separators so editable text can
  // never become part of the command argument.
  const command = level;
  const before = source.slice(0, pos);
  const after = source.slice(pos);
  const prefix = before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const suffix = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const inserted = `${prefix}\\${command}{${escapeTitle(title)}}${suffix}`;
  const headingStart = pos + prefix.length;
  await applyReplacement(document, pos, pos, inserted);
  return headingStart;
}
async function insertMathInFrame(document: vscode.TextDocument, frame: FrameInfo, kind: string, text: string) {
  if (!frame) return;
  const clean = String(text ?? '').trim();
  if (!clean) return;
  const endToken = '\\end{frame}';
  const pos = frame.end - endToken.length;
  let block = '';
  if (kind === 'inlinemath') block = `$${clean}$`;
  else if (kind === 'equation' || kind === 'equation*' || kind === 'align' || kind === 'align*' || kind === 'gather' || kind === 'gather*' || kind === 'multline' || kind === 'multline*') block = `\\begin{${kind}}\n${clean}\n\\end{${kind}}`;
  else if (kind === 'cases' || kind === 'cases*' || kind === 'matrix' || kind === 'matrix*') {
    const env = kind.endsWith('*') ? 'equation*' : 'equation';
    block = `\\begin{${env}}\n${clean}\n\\end{${env}}`;
  } else block = `\\[\n${clean}\n\\]`;
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
  else if (kind === 'displaymath') block = '\\[\n\\;\n\\]';
  else if (kind === 'equation') block = '\\begin{equation}\n\\;\n\\end{equation}';
  if (!block) return;
  await applyReplacement(document, pos, pos, `\n\n${block}\n`);
}


async function ensureGraphicx(document: vscode.TextDocument) {
  const source = document.getText();
  if (/\\usepackage(?:\[[^\]]*\])?\{[^}]*\bgraphicx\b[^}]*\}/.test(source)) return;
  const begin = source.indexOf('\\begin{document}');
  if (begin < 0) return;
  await applyReplacement(document, begin, begin, '\\usepackage{graphicx}\n\n');
}

async function chooseFigureFile(rootDocument: vscode.TextDocument): Promise<{ uri: vscode.Uri; latexPath: string } | undefined> {
  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: { Figures: ['png','jpg','jpeg','pdf'] },
    openLabel: 'Insert figure'
  });
  const original = picked?.[0];
  if (!original) return undefined;

  const bytes = await vscode.workspace.fs.readFile(original);
  const head = bytes.slice(0, 16);
  const ext = path.extname(original.fsPath).toLowerCase();
  const isPdf = head.length >= 5 && String.fromCharCode(...head.slice(0, 5)) === '%PDF-';
  const isPng = head.length >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 && head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a;
  const isJpeg = head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const actual = isPdf ? 'pdf' : isPng ? 'png' : isJpeg ? 'jpeg' : 'unsupported';
  const expected = ext === '.pdf' ? 'pdf' : ext === '.png' ? 'png' : (ext === '.jpg' || ext === '.jpeg') ? 'jpeg' : 'unsupported';
  if (actual === 'unsupported' || expected === 'unsupported' || actual !== expected) {
    const detail = actual === 'unsupported' ? 'Its contents are not a supported PDF, PNG, or JPEG image.' : `Its extension says ${expected.toUpperCase()}, but its contents are ${actual.toUpperCase()}.`;
    vscode.window.showErrorMessage(`TeXFlow: Unsupported image format. ${detail} TeXFlow currently inserts only PDF, PNG, and JPEG files compatible with pdfLaTeX.`);
    return undefined;
  }

  const rootDir = path.dirname(rootDocument.uri.fsPath);
  let target = original;
  let relative = path.relative(rootDir, original.fsPath);
  const outside = relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
  if (outside) {
    const figuresDir = vscode.Uri.file(path.join(rootDir, 'figures'));
    await vscode.workspace.fs.createDirectory(figuresDir);
    const parsed = path.parse(original.fsPath);
    let candidate = vscode.Uri.file(path.join(figuresDir.fsPath, parsed.base));
    let i = 2;
    while (true) {
      try {
        await vscode.workspace.fs.stat(candidate);
        candidate = vscode.Uri.file(path.join(figuresDir.fsPath, `${parsed.name}-${i++}${parsed.ext}`));
      } catch { break; }
    }
    await vscode.workspace.fs.copy(original, candidate, { overwrite: false });
    target = candidate;
    relative = path.relative(rootDir, target.fsPath);
  }
  return { uri: target, latexPath: relative.replace(/\\/g, '/') };
}


async function chooseMultipleFigureFiles(rootDocument: vscode.TextDocument): Promise<{ uri: vscode.Uri; latexPath: string }[]> {
  const picked = await vscode.window.showOpenDialog({canSelectFiles:true,canSelectFolders:false,canSelectMany:true,filters:{Figures:['png','jpg','jpeg','pdf']},openLabel:'Insert subfigures'});
  if(!picked?.length) return [];
  const rootDir=path.dirname(rootDocument.uri.fsPath),out:{uri:vscode.Uri;latexPath:string}[]=[];
  for(const original of picked.slice(0,6)){
    const bytes=await vscode.workspace.fs.readFile(original),head=bytes.slice(0,16),ext=path.extname(original.fsPath).toLowerCase();
    const isPdf=head.length>=5&&String.fromCharCode(...head.slice(0,5))==='%PDF-';
    const isPng=head.length>=8&&head[0]===0x89&&head[1]===0x50&&head[2]===0x4e&&head[3]===0x47&&head[4]===0x0d&&head[5]===0x0a&&head[6]===0x1a&&head[7]===0x0a;
    const isJpeg=head.length>=3&&head[0]===0xff&&head[1]===0xd8&&head[2]===0xff;
    const actual=isPdf?'pdf':isPng?'png':isJpeg?'jpeg':'unsupported',expected=ext==='.pdf'?'pdf':ext==='.png'?'png':(ext==='.jpg'||ext==='.jpeg')?'jpeg':'unsupported';
    if(actual==='unsupported'||expected==='unsupported'||actual!==expected){vscode.window.showErrorMessage(`TeXFlow: ${path.basename(original.fsPath)} is not a valid PDF, PNG, or JPEG for pdfLaTeX.`);continue;}
    let target=original,relative=path.relative(rootDir,original.fsPath);const outside=relative.startsWith('..'+path.sep)||path.isAbsolute(relative);
    if(outside){const figuresDir=vscode.Uri.file(path.join(rootDir,'figures'));await vscode.workspace.fs.createDirectory(figuresDir);const parsed=path.parse(original.fsPath);let candidate=vscode.Uri.file(path.join(figuresDir.fsPath,parsed.base)),i=2;while(true){try{await vscode.workspace.fs.stat(candidate);candidate=vscode.Uri.file(path.join(figuresDir.fsPath,`${parsed.name}-${i++}${parsed.ext}`));}catch{break;}}await vscode.workspace.fs.copy(original,candidate,{overwrite:false});target=candidate;relative=path.relative(rootDir,target.fsPath);}
    out.push({uri:target,latexPath:relative.replace(/\\/g,'/')});
  }
  return out;
}

function figureBlockLatex(latexPath: string, caption: string, label: string, placement: string, beamer: boolean, captionPosition: 'above' | 'below' = 'below', align: string = 'center', widthPercent: number = 70, shortCaption: string = '', angle: number = 0): string {
  const begin = beamer ? '\\begin{figure}' : `\\begin{figure}${placement ? `[${placement}]` : ''}`;
  const directive = align === 'left' ? '\\raggedright' : align === 'right' ? '\\raggedleft' : '\\centering';
  const width = Math.max(5, Math.min(100, Number(widthPercent) || 70)) / 100;
  const lines = [begin, directive];
  const safeCaption = escapeLatexPlainField(caption.replace(/[{}]/g, ''));
  const safeShort = escapeLatexPlainField(shortCaption.replace(/[{}\[\]]/g, ''));
  const cap = caption ? `\\caption${safeShort ? `[${safeShort}]` : ''}{${safeCaption}}` : '';
  if (cap && captionPosition === 'above') lines.push(cap);
  const graphicsOpts = [`width=${width.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')}\\linewidth`];
  if (angle) graphicsOpts.push(`angle=${Math.max(-360,Math.min(360,Number(angle)||0))}`, 'origin=c');
  lines.push(`\\includegraphics[${graphicsOpts.join(',')}]{${latexPath}}`);
  if (cap && captionPosition !== 'above') lines.push(cap);
  if (label) lines.push(`\\label{${label.replace(/[{}\\\s]/g, '')}}`);
  lines.push('\\end{figure}');
  return lines.join('\n');
}

function tableBlockLatex(rows: number, cols: number, caption: string, label: string, placement: string, beamer: boolean, alignments?: string[], tableStyle: 'plain' | 'booktabs' = 'plain'): string {
  const begin = beamer ? '\\begin{table}' : `\\begin{table}${placement ? `[${placement}]` : ''}`;
  const safeAlignments = Array.from({ length: cols }, (_, i) => ['l','c','r'].includes(String(alignments?.[i] || 'c')) ? String(alignments?.[i] || 'c') : 'c');
  const spec = safeAlignments.join('');
  const rowLines = Array.from({ length: rows }, () => Array.from({ length: cols }, () => '').join(' & ') + ' \\\\');
  const lines = [begin, '\\centering', `\\begin{tabular}{${spec}}`];
  if (tableStyle === 'booktabs') lines.push('\\toprule');
  rowLines.forEach((row, i) => { lines.push(row); if (tableStyle === 'booktabs' && i === 0 && rows > 1) lines.push('\\midrule'); });
  if (tableStyle === 'booktabs') lines.push('\\bottomrule');
  lines.push('\\end{tabular}');
  if (caption) lines.push(`\\caption{${escapeLatexPlainField(caption.replace(/[{}]/g, ''))}}`);
  if (label) lines.push(`\\label{${label.replace(/[{}\\\s]/g, '')}}`);
  lines.push('\\end{table}');
  return lines.join('\n');
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

  // Structured visual nodes (for example an entire itemize/enumerate block)
  // legitimately include LaTeX delimiters in their replacement range. Allow those
  // edits only when the replacement preserves the exact delimiter sequence. This
  // keeps formatting/list edits safe without treating the node's own structure as
  // something the user is trying to overwrite.
  const target = source.slice(actualStart, actualEnd);
  const structuralToken = /\\(?:begin|end)\{(?:document|frame|itemize|enumerate|equation\*?|align\*?)\}/g;
  const beforeStructure = target.match(structuralToken) ?? [];
  const afterStructure = String(replacement).match(structuralToken) ?? [];
  if (beforeStructure.length > 0 && (beforeStructure.length !== afterStructure.length || beforeStructure.some((token, i) => token !== afterStructure[i]))) {
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
  else if (kind === 'equation' || kind === 'equation*' || kind === 'align' || kind === 'align*' || kind === 'gather' || kind === 'gather*' || kind === 'multline' || kind === 'multline*') block = `\\begin{${kind}}\n${clean || '\\;'}\n\\end{${kind}}`;
  else if (kind === 'cases' || kind === 'cases*' || kind === 'matrix' || kind === 'matrix*') {
    const env = kind.endsWith('*') ? 'equation*' : 'equation';
    block = `\\begin{${env}}\n${clean || '\\;'}\n\\end{${env}}`;
  }
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

function escapeLatexPlainField(s: string): string {
  const text = String(s ?? '');
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const prev = i ? text[i - 1] : '';
    if ('#$%&_'.includes(ch) && prev !== '\\') out += '\\' + ch;
    else out += ch;
  }
  return out;
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
  const width = getDimension('width'), height = getDimension('height');
  const captionMatch = /\\caption(?:\[([^\]]*)\])?\{([^}]*)\}/.exec(raw);
  const shortCaption = captionMatch?.[1] ?? '', caption = captionMatch?.[2] ?? '';
  const graphicIndex = graphic?.index ?? -1;
  const captionPosition: 'above' | 'below' = captionMatch && graphicIndex >= 0 && captionMatch.index < graphicIndex ? 'above' : 'below';
  const label = /\\label\{([^}]+)\}/.exec(raw)?.[1] ?? '';
  const placement = /\\begin\{figure\}(?:\[([^\]]*)\])?/.exec(raw)?.[1] ?? '';
  const angleToken=optionParts.find(x=>/^angle\s*=/.test(x));const angle=angleToken?Number(angleToken.slice(angleToken.indexOf('=')+1).trim())||0:0;
  const align: 'left' | 'center' | 'right' = /\\raggedleft|\\begin\{flushright\}/.test(raw) ? 'right' : /\\centering|\\begin\{center\}/.test(raw) ? 'center' : 'left';
  return { path, options, width, height, caption, shortCaption, angle, label, placement, captionPosition, align };
}

function parseTableData(raw: string) {
  const tab = /\\begin\{tabular\}\{([^}]*)\}([\s\S]*?)\\end\{tabular\}/.exec(raw);
  const captionMatch = /\\caption(?:\[[^\]]*\])?\{([^}]*)\}/.exec(raw);
  const caption = captionMatch?.[1] ?? '';
  const tabularIndex = tab?.index ?? -1;
  const captionPosition: 'above' | 'below' = captionMatch && tabularIndex >= 0 && captionMatch.index < tabularIndex ? 'above' : 'below';
  const label = /\\label\{([^}]+)\}/.exec(raw)?.[1] ?? '';
  const placement = /\\begin\{table\}(?:\[([^\]]*)\])?/.exec(raw)?.[1] ?? '';
  if (!tab) return { simple:false, columns:[] as string[], rows:[] as string[][], caption,label,placement,captionPosition,tableStyle:'plain' as const };
  const spec=tab[1].trim(),tableStyle=/\\(?:toprule|midrule|bottomrule)\b/.test(tab[2])?'booktabs' as const:'plain' as const;
  const unsupported=/\\(?:multicolumn|multirow|cline|cmidrule|begin\{|end\{)/.test(tab[2]);const columnTokens=[...spec.matchAll(/[lcr]/g)].map(m=>m[0]);
  if(!columnTokens.length||unsupported||spec.replace(/[lcr|\s]/g,'')!=='')return{simple:false,columns:columnTokens,rows:[] as string[][],caption,label,placement,captionPosition,tableStyle};
  let body=tab[2].replace(/^[\s\n]+|[\s\n]+$/g,'').replace(/(^|\n)\s*\\(?:hline|toprule|midrule|bottomrule)\s*(?=\n|$)/g,'$1');
  const rawRows=body.split(/\\\\(?:\s*\[[^\]]*\])?/).map(x=>x.trim()).filter(Boolean),rows=rawRows.map(r=>r.split(/(?<!\\)&/).map(c=>c.trim()));
  if(!rows.length||rows.some(r=>r.length!==columnTokens.length))return{simple:false,columns:columnTokens,rows,caption,label,placement,captionPosition,tableStyle};
  return{simple:true,columns:columnTokens,rows,caption,label,placement,captionPosition,tableStyle};
}

function parseBlocks(body: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const tokenRe = /\\begin\{(itemize|enumerate|block|alertblock|exampleblock|equation\*?|align\*?|gather\*?|multline\*?|figure|table|columns|multicols|flushleft|center|flushright|quote|quotation|minipage|theorem|lemma|proposition|corollary|definition|proof)\}(?:\[[^\]]*\])?(?:\{([^}]*)\})?|\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}|\\vspace(\*)?\{([^}]+)\}|\\(newpage|clearpage|pagebreak)\b|\$\$/g;
  let cursor = 0;
  let count = 0;
  let m: RegExpExecArray | null;
  let currentAlign: 'left' | 'center' | 'right' | 'justify' = 'justify';

  const alignmentFromDirective = (
    raw: string,
    current: 'left' | 'center' | 'right' | 'justify' = 'justify'
  ): 'left' | 'center' | 'right' | 'justify' => {
    const matches = [...String(raw || '').matchAll(/\\(centering|raggedright|raggedleft|justifying)\b/g)];
    if (!matches.length) return current;
    const command = matches[matches.length - 1][1];
    if (command === 'centering') return 'center';
    if (command === 'raggedright') return 'left';
    if (command === 'raggedleft') return 'right';
    return 'justify';
  };

  const isOnlyAlignmentDirective = (raw: string): boolean =>
    /^(?:\s|%[^\n]*(?:\n|$))*\\(?:centering|raggedright|raggedleft|justifying)\b\s*(?:%[^\n]*)?\s*$/.test(String(raw || ''));

  const pushText = (s: number, e: number) => {
    const raw = body.slice(s, e);
    if (!raw.trim()) return;

    if (s === 0) {
      const size = /^((?:(?:[ \t\r\n]+)|(?:[ \t]*%[^\n]*(?:\r?\n|$)))*)\\(?:normalsize|small|footnotesize|scriptsize|tiny)\b[ \t]*(?:%[^\n]*)?(?:\r?\n)?/.exec(raw);
      if (size) {
        const prefix = String(size[1] || '');
        const commandStart = s + prefix.length;
        const commandEnd = s + size[0].length;

        if (prefix) pushText(s, commandStart);

        blocks.push({
          id: `b${count++}`,
          kind: 'raw',
          start: commandStart,
          end: commandEnd,
          raw: body.slice(commandStart, commandEnd),
          text: body.slice(commandStart, commandEnd).trim()
        });

        if (commandEnd < e) pushText(commandEnd, e);
        return;
      }
    }

    const alignmentDirective = /(^|\r?\n)([ \t]*\\(centering|raggedright|raggedleft|justifying)\b[ \t]*(?:%[^\n]*)?)(?=\r?\n|$)/m.exec(raw);
    if (alignmentDirective) {
      const linePrefix = String(alignmentDirective[1] || '');
      const command = String(alignmentDirective[3] || '');
      const commandStart = s + (alignmentDirective.index ?? 0) + linePrefix.length;
      const commandEnd = commandStart + String(alignmentDirective[2] || '').length;

      if (commandStart > s) pushText(s, commandStart);

      blocks.push({
        id: `b${count++}`,
        kind: 'raw',
        start: commandStart,
        end: commandEnd,
        raw: body.slice(commandStart, commandEnd),
        text: body.slice(commandStart, commandEnd).trim()
      });

      currentAlign = alignmentFromDirective(`\\${command}`, currentAlign);

      if (commandEnd < e) pushText(commandEnd, e);
      return;
    }

    const trimmedRaw = raw.trim();
    if (trimmedRaw && trimmedRaw.split(/\r?\n/).every(line => /^\s*%/.test(line))) {
      const lead = raw.search(/\S/); const trail = (/\s*$/.exec(raw) || [''])[0].length;
      const start = lead < 0 ? s : s + lead, end = e - trail; const cleanRaw = body.slice(start, end);
      const commentNote=/^\s*%\s*TeXFlow note:/i.test(cleanRaw);const commentText=cleanRaw.replace(/^\s*%\s?/gm,'').replace(/^TeXFlow note:\s*/i,'');
      blocks.push({ id: `b${count++}`, kind: 'comment', start, end, raw: cleanRaw, text: commentText, commentText, commentNote });
      return;
    }

    // Standalone labels are structural metadata. Keep them in the .tex source,
    // but exclude them from editable/raw visual ranges so editing nearby text
    // cannot flatten, move, or delete the label command.
    const labels = [...raw.matchAll(/\\label\{[^}]+\}/g)];
    if (labels.length) {
      let local = 0;
      for (const lm of labels) {
        const at = lm.index ?? 0;
        if (at > local) pushText(s + local, s + at);
        local = at + lm[0].length;
      }
      if (local < raw.length) pushText(s + local, e);
      return;
    }

    const nextAlign = alignmentFromDirective(raw, currentAlign);

    if (isOnlyAlignmentDirective(raw)) {
      const lead = raw.search(/\S/);
      const trailMatch = /\s*$/.exec(raw);
      const trail = trailMatch ? trailMatch[0].length : 0;
      const start = lead < 0 ? s : s + lead;
      const end = e - trail;
      const cleanRaw = body.slice(start, end);
      if (cleanRaw) blocks.push({ id: `b${count++}`, kind: 'raw', start, end, raw: cleanRaw, text: cleanRaw });
      currentAlign = nextAlign;
      return;
    }

    // Match the webview safety classification exactly. Alignment directives
    // are semantic state, not a reason to classify the whole chunk as raw.
    const unsafe =
      /^(?:\s*%|\s*\\(?:newpage|clearpage|pagebreak)\b)/m.test(raw) ||
      /\\(begin|end|input|include|hypertarget|label|only|visible|uncover|pause|vspace|includegraphics|tikz)/.test(raw);

    if (!unsafe) {
      const sep = /\n[ \t]*\n+/g;
      let local = 0;
      const pushSegment = (a: number, b: number) => {
        if (b <= a) return;
        const segment = raw.slice(a, b);
        const lead = segment.search(/\S/);
        if (lead < 0) return;
        const trailMatch = /\s*$/.exec(segment);
        const trail = trailMatch ? trailMatch[0].length : 0;
        const segStart = s + a + lead;
        const segEnd = s + b - trail;
        if (segEnd <= segStart) return;
        const text = body.slice(segStart, segEnd);
        const block: ParsedBlock = { id: `b${count++}`, kind: 'paragraph', start: segStart, end: segEnd, raw: text, text };
        (block as any).align = nextAlign;
        blocks.push(block);
      };
      let sm: RegExpExecArray | null;
      while ((sm = sep.exec(raw))) {
        pushSegment(local, sm.index);
        local = sep.lastIndex;
      }
      pushSegment(local, raw.length);
      currentAlign = nextAlign;
      return;
    }

    const lead = raw.search(/\S/);
    const trailMatch = /\s*$/.exec(raw);
    const trail = trailMatch ? trailMatch[0].length : 0;
    const start = lead < 0 ? s : s + lead;
    const end = e - trail;
    const cleanRaw = body.slice(start, end);
    if (cleanRaw) blocks.push({ id: `b${count++}`, kind: 'raw', start, end, raw: cleanRaw, text: cleanRaw });
    currentAlign = nextAlign;
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
        figureHeight: data.height.value, figureHeightUnit: data.height.unit, figureCaption: data.caption, figureLabel: data.label, figurePlacement: data.placement, figureCaptionPosition: data.captionPosition, figureAlign: data.align
      });
      cursor = tokenRe.lastIndex;
      continue;
    }
    if (m[6] !== undefined) {
      const raw = m[0];
      blocks.push({ id: `b${count++}`, kind: 'vspace', start: m.index, end: tokenRe.lastIndex, raw, text: raw, spaceAmount: String(m[6] || '').trim(), spaceStarred: m[5] === '*' });
      cursor = tokenRe.lastIndex;
      continue;
    }
    if (m[7] !== undefined) {
      const raw = m[0];
      blocks.push({ id: `b${count++}`, kind: 'break', start: m.index, end: tokenRe.lastIndex, raw, text: raw, breakCommand: String(m[7] || 'newpage') });
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
    else if (/^(equation|align|gather|multline)/.test(env)) kind = 'equation';
    else if (env === 'figure') kind = 'figure';
    else if (env === 'table') kind = 'table';
    else if (env === 'columns' || env === 'multicols') kind = 'columns';
    else if (env === 'quote' || env === 'quotation') kind = 'quote';
    else if (env === 'minipage') kind = 'container';
    else if (['theorem','lemma','proposition','corollary','definition','proof'].includes(env)) kind = 'theorem';
    else if (['flushleft','center','flushright'].includes(env)) kind = 'paragraph';
    const block: ParsedBlock = { id: `b${count++}`, kind, start: m.index, end, raw, env, title: m[2] ?? '', text: inner };
    if (kind === 'paragraph' && ['flushleft','center','flushright'].includes(env)) (block as any).align = env === 'flushleft' ? 'left' : env === 'flushright' ? 'right' : 'center';
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
      block.figureShortCaption = data.shortCaption;
      block.figureAngle = data.angle;
      block.figureLabel = data.label;
      block.figurePlacement = data.placement;
      block.figureCaptionPosition = data.captionPosition;
      block.figureAlign = data.align;
    }
    if (kind === 'columns') {
      if (env === 'multicols') {
        block.columnCount = Math.max(2, Math.min(4, Number(m[2]) || 2));
        // Article multicols is one flowing text stream. Manual column breaks are
        // preserved as source text instead of being turned into separate editors.
        block.columnTexts = inner.split(/\\columnbreak\b/).map(x => x.trim());
      } else {
        const parts = [...inner.matchAll(/\\column\{[^}]+\}([\s\S]*?)(?=\\column\{|$)/g)].map(x => String(x[1] || '').trim());
        block.columnTexts = parts.length ? parts : [inner];
        block.columnCount = block.columnTexts.length;
      }
    }
    if (kind === 'table') {
      const data = parseTableData(raw);
      if (!data.simple) block.kind = 'raw';
      else {
        block.tableSimple = true;
        block.tableColumns = data.columns;
        block.tableRows = data.rows;
        block.tableCaption = data.caption;
        block.tableLabel = data.label;
        block.tablePlacement = data.placement;
        block.tableCaptionPosition = data.captionPosition;
        block.tableStyle = data.tableStyle;
      }
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
  if (/^(?:%|\\(?:newpage|clearpage|pagebreak)\b)/m.test(t)) return false;
  if (/\\(begin|end|input|include|hypertarget|label|only|visible|uncover|pause|vspace|includegraphics|tikz)/.test(t)) return false;
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
  if (block.kind === 'paragraph') { const text=normalizeEditableText(payload.text); const requested=String(payload.align||''); if(requested==='justify') return text; const env=requested==='left'?'flushleft':requested==='right'?'flushright':requested==='center'?'center':(['flushleft','center','flushright'].includes(String(block.env||''))?String(block.env):''); return env?`\\begin{${env}}\n${text}\n\\end{${env}}`:text; }
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
    const env = String(payload.env || block.env || 'equation');
    const incoming = String(payload.text ?? block.text ?? '').trim();
    if (/^align\*?$/.test(env)) return `\\begin{${env}}\n${incoming}\n\\end{${env}}`;
    const existingLabel = /\\label\{([^}]+)\}/.exec(String(block.text ?? block.raw ?? ''))?.[1] ?? '';
    const text = incoming.replace(/\\label\{[^}]+\}/g, '').trim();
    const payloadHasLabel = /\\label\{[^}]+\}/.test(incoming);
    const content = payloadHasLabel ? incoming : text + (existingLabel ? `\n\\label{${existingLabel}}` : '');
    if (env === '$$') return `$$\n${content}\n$$`;
    return `\\begin{${env}}\n${content}\n\\end{${env}}`;
  }
  if (block.kind === 'vspace') {
    const amount = String(payload.amount ?? block.spaceAmount ?? '').trim();
    const safe = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*(?:pt|mm|cm|in|em|ex|pc|bp|dd|cc|sp|\\baselineskip|\\parskip|\\textheight|\\linewidth)$/.test(amount);
    if (!safe) return block.raw;
    const star = payload.starred ?? block.spaceStarred;
    return `\\vspace${star ? '*' : ''}{${amount}}`;
  }
  if (block.kind === 'break') {
    const cmd = String(payload.command ?? block.breakCommand ?? 'newpage');
    return `\\${['newpage','clearpage','pagebreak'].includes(cmd) ? cmd : 'newpage'}`;
  }
  if (block.kind === 'quote') {
    const env = block.env === 'quotation' ? 'quotation' : 'quote';
    return `\\begin{${env}}\n${normalizeEditableText(payload.text ?? block.text ?? '')}\n\\end{${env}}`;
  }
  if (block.kind === 'container') {
    const width = String(payload.width ?? '0.9\\linewidth').trim();
    const safeWidth = /^[0-9.]+(?:\\linewidth|\\textwidth|cm|mm|in|pt)$/.test(width) ? width : '0.9\\linewidth';
    return `\\begin{minipage}{${safeWidth}}\n${normalizeEditableText(payload.text ?? block.text ?? '')}\n\\end{minipage}`;
  }
  if (block.kind === 'theorem') {
    const env = ['theorem','lemma','proposition','corollary','definition','proof'].includes(String(block.env||'')) ? String(block.env) : 'theorem';
    return `\\begin{${env}}${block.title ? `{${escapeTitle(payload.title ?? block.title ?? '')}}` : ''}\n${normalizeEditableText(payload.text ?? block.text ?? '')}\n\\end{${env}}`;
  }
  if (block.kind === 'comment') {
    const text = String(payload.text ?? block.commentText ?? block.text ?? '').replace(/\r?\n/g,' ');
    return block.commentNote ? `% TeXFlow note: ${text.replace(/^%\s*/, '')}` : `% ${text.replace(/^%\s*/, '')}`;
  }
  if (block.kind === 'columns') {
    const texts = (payload.texts || block.columnTexts || []).map((x: unknown) => String(x ?? '').trim());
    const count = Math.max(2, Math.min(4, Number(payload.count || block.columnCount || texts.length || 2)));
    if (block.env === 'multicols') {
      const content = texts.slice(0, count).map((x: string) => x.trim()).join('\n\\columnbreak\n');
      return `\\begin{multicols}{${count}}\n${content}\n\\end{multicols}`;
    }
    const widths = Array.from({ length: count }, () => Number((0.96 / count).toFixed(3)));
    return `\\begin{columns}[T]\n${widths.map((w,i)=>`\\column{${w}\\textwidth}\n${texts[i] || ''}`).join('\n')}\n\\end{columns}`;
  }
  if (block.kind === 'table') {
    const columns = (payload.columns || block.tableColumns || []).map((x: string) => /^[lcr]$/.test(x) ? x : 'c');
    const rows = (payload.rows || block.tableRows || []).map((r: string[]) => r.map(x => String(x ?? '').replace(/\r?\n/g, ' ')));
    if (!columns.length || !rows.length || rows.some((r: string[]) => r.length !== columns.length)) return block.raw;
    const placement = String(payload.placement ?? block.tablePlacement ?? '').trim();
    const tableStyle = String(payload.tableStyle ?? block.tableStyle ?? 'plain') === 'booktabs' ? 'booktabs' : 'plain';
    const caption = escapeLatexPlainField(String(payload.caption ?? block.tableCaption ?? '').trim().replace(/[{}]/g, ''));
    const label = String(payload.label ?? block.tableLabel ?? '').trim().replace(/[{}\\\s]/g, '');
    const captionPosition = String(payload.captionPosition ?? block.tableCaptionPosition ?? 'below') === 'above' ? 'above' : 'below';
    const lines = [`\\begin{table}${placement ? `[${placement}]` : ''}`, '\\centering'];
    if (caption && captionPosition === 'above') lines.push(`\\caption{${caption}}`);
    if (caption && captionPosition === 'above' && label) lines.push(`\\label{${label}}`);
    lines.push(`\\begin{tabular}{${columns.join('')}}`);
    if (tableStyle === 'booktabs') lines.push('\\toprule');
    rows.forEach((row: string[], i: number) => { lines.push(row.join(' & ') + ' \\\\'); if (tableStyle === 'booktabs' && i === 0 && rows.length > 1) lines.push('\\midrule'); });
    if (tableStyle === 'booktabs') lines.push('\\bottomrule');
    lines.push('\\end{tabular}');
    if (caption && captionPosition === 'below') lines.push(`\\caption{${caption}}`);
    if (label && !(caption && captionPosition === 'above')) lines.push(`\\label{${label}}`);
    lines.push('\\end{table}');
    return lines.join('\n');
  }
  if (block.kind === 'figure') {
    let raw = block.raw;
    const match = /\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}/.exec(raw);
    if (!match) return raw;
    const existing = (match[1] ?? '').split(',').map(x => x.trim()).filter(Boolean);
    const preserved = existing.filter(x => !/^(?:width|height|keepaspectratio|angle|origin)\s*(?:=|$)/.test(x));
    const width = Math.max(0.05, Math.min(2, Number(payload.width ?? block.figureWidth ?? 1)));
    const widthUnit = String(payload.widthUnit ?? block.figureWidthUnit ?? '\\linewidth');
    preserved.push(`width=${Number(width.toFixed(3))}${widthUnit}`);
    const angle=Math.max(-360,Math.min(360,Number(payload.angle ?? block.figureAngle ?? 0)));if(angle)preserved.push(`angle=${angle}`,'origin=c');
    const heightValue = Number(payload.height ?? 0);
    if (heightValue > 0) {
      const height = Math.max(0.05, Math.min(2, heightValue));
      const heightUnit = String(payload.heightUnit ?? block.figureHeightUnit ?? '\\textheight');
      preserved.push(`height=${Number(height.toFixed(3))}${heightUnit}`);
      if (payload.keepAspect !== false) preserved.push('keepaspectratio');
    }
    const command = `\\includegraphics[${preserved.join(',')}]{${match[2]}}`;
    raw = raw.slice(0, match.index) + command + raw.slice((match.index ?? 0) + match[0].length);

    if (/^\\begin\{figure\}/.test(raw.trim())) {
      const placement = String(payload.placement ?? block.figurePlacement ?? '').trim();
      raw = raw.replace(/\\begin\{figure\}(?:\[[^\]]*\])?/, `\\begin{figure}${placement ? `[${placement}]` : ''}`);

      const align = String(payload.align ?? block.figureAlign ?? 'center');
      raw = raw.replace(/^([ \t]*)(?:\\centering|\\raggedright|\\raggedleft)\s*$/gm, '').replace(/\n{3,}/g, '\n\n');
      const directive = align === 'right' ? '\\raggedleft' : align === 'left' ? '\\raggedright' : '\\centering';
      raw = raw.replace(/(\\begin\{figure\}(?:\[[^\]]*\])?\s*\n?)/, `$1${directive}\n`);

      const caption = escapeLatexPlainField(String(payload.caption ?? block.figureCaption ?? '').trim().replace(/[{}]/g, ''));
      const shortCaption = escapeLatexPlainField(String(payload.shortCaption ?? block.figureShortCaption ?? '').trim().replace(/[{}\[\]]/g, ''));
      const captionPosition = String(payload.captionPosition ?? block.figureCaptionPosition ?? 'below') === 'above' ? 'above' : 'below';
      raw = raw.replace(/\n?\\caption(?:\[[^\]]*\])?\{[^}]*\}\n?/g, '\n');
      if (caption) {
        const cap = `\\caption${shortCaption ? `[${shortCaption}]` : ''}{${caption}}`;
        raw = captionPosition === 'above'
          ? raw.replace(/(\\begin\{figure\}(?:\[[^\]]*\])?\s*\n(?:\\centering|\\raggedright|\\raggedleft)?\s*\n?)/, `$1${cap}\n`)
          : raw.replace(/\n?\\end\{figure\}/, `\n${cap}\n\\end{figure}`);
      }

      const label = String(payload.label ?? block.figureLabel ?? '').trim();
      if (/\\label\{[^}]*\}/.test(raw)) {
        raw = raw.replace(/\\label\{[^}]*\}/, label ? `\\label{${label}}` : '');
      } else if (label) {
        raw = raw.replace(/\n?\\end\{figure\}/, `\n\\label{${label}}\n\\end{figure}`);
      }
      raw = raw.replace(/\n{3,}/g, '\n\n');
    }
    return raw;
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
.beamer-only.hidden,.document-only.hidden{display:none}
.inline-key{font-weight:650;color:var(--vscode-textLink-foreground)}
.inline-alert{font-weight:650;color:var(--vscode-errorForeground)}
.inline-underline{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:.12em}
.inline-color{border-radius:2px}
.color-grid{display:grid;grid-template-columns:repeat(6,24px);gap:6px;padding:7px 10px 9px}.color-swatch{width:24px!important;height:24px;padding:0!important;border:1px solid var(--line-strong)!important;border-radius:50%!important;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--panel) 72%,transparent)}.color-swatch:hover{outline:2px solid var(--vscode-focusBorder);outline-offset:1px}
.inline-math{display:inline-block;vertical-align:baseline;padding:0 .08em;cursor:default}.inline-math .katex{font-size:1.04em}.display-math{display:block;margin:.55em 0;padding:.15em .25em;text-align:center;overflow-x:auto;cursor:default}.display-math .katex-display{margin:0}
.section{font-size:10px;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin:18px 8px 5px}
.frame-link{position:relative;margin:3px 0;padding:9px 9px 9px 12px;border:1px solid transparent;border-radius:8px;cursor:pointer;font-size:12px;line-height:1.35;color:var(--vscode-sideBar-foreground,var(--vscode-foreground));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .12s ease,border-color .12s ease,transform .12s ease}
.frame-link::before{content:"";position:absolute;left:2px;top:10px;bottom:10px;width:2px;border-radius:2px;background:transparent}
.frame-link:hover{background:var(--hover);border-color:var(--line);transform:translateX(1px)}
.frame-link.active{background:color-mix(in srgb,var(--vscode-list-inactiveSelectionBackground,var(--hover)) 88%,transparent);border-color:color-mix(in srgb,var(--vscode-focusBorder) 45%,transparent);font-weight:600}
.frame-link.active::before{background:var(--vscode-focusBorder)}
.nav-group{margin:7px 0 3px}.nav-group-title{display:flex;align-items:center;gap:6px;margin:12px 5px 5px;padding:5px 6px;border-radius:6px;color:var(--vscode-sideBar-foreground,var(--vscode-foreground));font-size:12px;font-weight:650;line-height:1.3;cursor:pointer;user-select:none}.nav-group-title:hover{background:var(--hover)}.nav-group-title .chev{width:12px;color:var(--muted);font-size:10.5px}.nav-group.collapsed>.nav-group-body{display:none}.nav-subgroup-title{display:flex;align-items:center;gap:5px;margin:7px 7px 4px 13px;padding:4px 5px;border-radius:5px;color:var(--muted);font-size:11px;font-weight:600;line-height:1.3;cursor:pointer}.nav-subgroup-title:hover{background:var(--hover);color:var(--vscode-foreground)}.nav-subgroup.collapsed>.nav-subgroup-body{display:none}
.thumb-card{position:relative;margin:7px 3px 10px;padding:6px 6px 7px;border:1px solid transparent;border-radius:9px;cursor:pointer;transition:background .12s ease,border-color .12s ease,transform .12s ease}.thumb-card:hover{background:var(--hover);border-color:var(--line);transform:translateX(1px)}.thumb-card.active{background:color-mix(in srgb,var(--vscode-list-inactiveSelectionBackground,var(--hover)) 88%,transparent);border-color:color-mix(in srgb,var(--vscode-focusBorder) 65%,transparent)}.thumb-slide{position:relative;width:100%;aspect-ratio:var(--slide-aspect);overflow:hidden;background:var(--paper);border:1px solid var(--line-strong);border-radius:5px;box-shadow:0 3px 10px rgba(0,0,0,.10);padding:9px 10px;color:var(--vscode-editor-foreground)}.thumb-title{font-size:9px;line-height:1.1;font-weight:700;margin:0 0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.thumb-body{font-size:5.7px;line-height:1.25;opacity:.86;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap}.thumb-body ul,.thumb-body ol{margin:2px 0 0 9px;padding:0}.thumb-body li{margin:1px 0}.thumb-math{font-family:serif;font-style:italic;text-align:center;margin:3px 0}.thumb-label{display:flex;align-items:center;gap:6px;padding:6px 2px 0;font-size:11.5px;line-height:1.3;color:var(--vscode-sideBar-foreground,var(--vscode-foreground))}.thumb-number{color:var(--muted);font-size:10.5px;font-variant-numeric:tabular-nums;min-width:17px}.thumb-title-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.thumb-card.active .thumb-label{font-weight:650}.thumb-card.active::before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:2px;border-radius:2px;background:var(--vscode-focusBorder)}
.slide{width:min(960px,calc((100vh - 170px) * var(--slide-aspect-number)),100%);aspect-ratio:var(--slide-aspect);min-height:0;margin:8px auto;padding:2.65em 3.15em 2.7em;background:var(--paper);border:1px solid color-mix(in srgb,var(--line-strong) 78%,transparent);border-radius:10px;box-shadow:0 26px 70px rgba(0,0,0,.18),0 4px 14px rgba(0,0,0,.10);position:relative;overflow:hidden;display:flex;flex-direction:column;font-size:var(--slide-body-size);line-height:var(--slide-line-height)}
.slide::after{content:"";position:absolute;inset:0;pointer-events:none;border-radius:10px;box-shadow:inset 0 1px 0 color-mix(in srgb,white 10%,transparent)}
.slide.frame-size-small{font-size:calc(var(--slide-body-size) * .91)}
.slide.frame-size-footnotesize{font-size:calc(var(--slide-body-size) * .82)}
.slide.frame-size-scriptsize{font-size:calc(var(--slide-body-size) * .73)}
.slide.frame-size-tiny{font-size:calc(var(--slide-body-size) * .55)}
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
.beamer-block{flex-shrink:0;border:1px solid var(--line-strong);border-radius:8px;overflow:hidden;background:color-mix(in srgb,var(--paper) 96%,var(--vscode-editorWidget-background));box-shadow:0 3px 12px rgba(0,0,0,.08)}
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
.doc-figure-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.doc-figure-fields label{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)}.doc-figure-fields input,.figure-controls select{min-width:0;flex:1;background:var(--input);color:var(--fg);border:1px solid var(--line-strong);border-radius:5px;padding:4px 6px;font:inherit}.doc-figure .figure-stage{min-height:180px}.doc-figure .figure-visual.pdf{min-height:300px}
.table-card{border:1px solid var(--line);border-radius:8px;padding:10px 12px 12px;margin:15px 0;background:color-mix(in srgb,var(--paper) 98%,var(--vscode-editorWidget-background))}.table-head{display:flex;align-items:center;gap:8px;margin-bottom:9px;color:var(--muted);font-size:11px}.table-head .tag{margin-right:auto}.table-controls{display:flex;gap:7px;align-items:center}.table-controls label{display:flex;align-items:center;gap:5px}.table-controls select,.table-fields input{background:var(--input);color:var(--fg);border:1px solid var(--line-strong);border-radius:5px;padding:4px 6px;font:inherit}.table-scroll{overflow:auto;border:1px solid var(--line);border-radius:6px;background:var(--paper)}.semantic-table{border-collapse:collapse;width:100%;min-width:260px}.semantic-table td{border:1px solid var(--line);padding:7px 9px;min-width:70px;vertical-align:top}.semantic-table td[contenteditable=true]:focus{outline:2px solid color-mix(in srgb,var(--accent) 55%,transparent);outline-offset:-2px;background:color-mix(in srgb,var(--paper) 94%,var(--accent) 6%)}.table-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.table-fields label{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)}.table-fields input{min-width:0;flex:1}.table-column-tools{display:flex;gap:4px;flex-wrap:wrap;margin:8px 0}.table-column-tools label{display:flex;align-items:center;gap:3px;font-size:10px;color:var(--muted)}.table-column-tools select{font-size:10px;padding:2px 4px}.table-actions{display:flex;gap:6px;margin-top:8px}.table-actions button{font-size:11px;padding:4px 8px;border:1px solid var(--line-strong);border-radius:5px;background:var(--input);color:var(--fg);cursor:pointer}.table-actions button:hover{background:var(--hover)}
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
.topbar-spacer{flex:1;min-width:6px}.top-action.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
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
.doc-title{text-align:center;margin:18px 0 58px}.doc-title h1{font-size:2.05em;margin:0 0 12px;font-weight:650}.doc-title>div{color:var(--muted);margin-top:5px}.doc-heading{scroll-margin-top:72px;color:var(--fg);font-weight:650}.doc-heading.level-1{font-size:1.85em;margin:46px 0 22px}.doc-heading.level-2{font-size:1.55em;margin:38px 0 18px}.doc-heading.level-3{font-size:1.27em;margin:30px 0 14px}.doc-heading.level-4{font-size:1.1em;margin:24px 0 12px}.doc-paragraph{margin:0 0 18px;white-space:pre-wrap}.doc-list{margin:10px 0 22px;padding-left:2.1em}.doc-list li{margin:6px 0}.doc-math{position:relative;margin:24px 0;text-align:center;overflow-x:auto;padding:0 2.2em}.doc-equation-number{position:absolute;right:.2em;top:50%;transform:translateY(-50%);font-size:.9em;color:var(--muted)}.doc-code{font-family:var(--vscode-editor-font-family,monospace);font-size:.92em;background:color-mix(in srgb,var(--paper) 88%,var(--fg) 12%);padding:.08em .28em;border-radius:4px}.doc-latex-block{margin:22px 0;padding:14px 18px;border-left:3px solid var(--accent);background:color-mix(in srgb,var(--paper) 92%,var(--accent) 8%)}.doc-block-title{font-weight:650;margin-bottom:8px}.doc-figure-placeholder{margin:24px auto;padding:32px;border:1px dashed var(--line-strong);text-align:center;color:var(--muted);border-radius:8px}.doc-raw{margin:20px 0;padding:12px 14px;border:1px solid var(--line);border-radius:6px;color:var(--muted);font-size:.9em}.doc-raw pre{white-space:pre-wrap;margin:8px 0 0}.doc-mode-note{text-align:right;color:var(--muted);font-size:11px;margin-top:54px}.doc-outline{padding:7px 10px;border-radius:6px;cursor:pointer;color:var(--muted);line-height:1.25}.doc-outline:hover{background:var(--hover);color:var(--fg)}.doc-outline.level-1{font-weight:700;color:var(--fg);margin-top:9px}.doc-outline.level-2{font-weight:600;color:var(--fg);margin-top:7px}.doc-outline.level-3{padding-left:20px;font-size:.94em}.doc-outline.level-4{padding-left:30px;font-size:.9em}.doc-outline-object{font-size:.86em;color:var(--muted);padding-top:5px;padding-bottom:5px}.doc-outline-object.depth-1{padding-left:18px}.doc-outline-object.depth-2{padding-left:26px}.doc-outline-object.depth-3{padding-left:34px}.doc-outline-object.depth-4,.doc-outline-object.depth-5{padding-left:42px}.doc-outline-object .outline-kind{font-size:.82em;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-right:5px}.doc-outline-object .outline-label{color:var(--fg)}.doc-outline-empty{padding:12px 10px;color:var(--muted);font-size:.9em}.doc-outline-matter{margin:14px 8px 5px;padding-top:8px;border-top:1px solid var(--line);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.doc-heading.starred:before{content:'◇ ';color:var(--muted);font-size:.72em;vertical-align:.15em}.doc-toc{margin:28px 0 44px;padding:24px 26px;border:1px solid var(--line);border-radius:9px;background:color-mix(in srgb,var(--paper) 98%,var(--fg) 2%)}.doc-toc h2{font-size:1.45em;margin:0 0 16px}.doc-toc-row{display:grid;grid-template-columns:4.7em 1fr;width:100%;border:0;background:transparent;color:var(--fg);font:inherit;text-align:left;padding:5px 4px;border-radius:4px;cursor:pointer}.doc-toc-row:hover{background:var(--hover)}.doc-toc-row.level-2{padding-left:14px}.doc-toc-row.level-3{padding-left:28px}.doc-toc-row.level-4{padding-left:42px;font-size:.94em}.doc-toc-number{font-variant-numeric:tabular-nums;color:var(--muted)}.doc-toc-note,.doc-toc-empty{margin-top:13px;font-size:.82em;color:var(--muted)}.document-pane{overflow:auto;padding:0 18px}.document-pane .document-pages{padding-top:10px}.document-pane .document-continuous-wrap{padding-top:10px}.document-pane .document-continuous{padding:44px 48px 54px}.document-pane .document-sheet{--doc-page-pad-x:48px;--doc-page-pad-top:44px;--doc-page-pad-bottom:54px}.workspace>.document-pages{padding-top:18px}.document-sheet .doc-editable{outline:none;border-radius:4px;transition:background .12s,box-shadow .12s}.document-sheet .doc-editable:hover{background:color-mix(in srgb,var(--paper) 96%,var(--fg) 4%)}.document-sheet .doc-editable:focus{background:color-mix(in srgb,var(--paper) 94%,var(--accent) 6%);box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 45%,transparent)}.doc-item-editable{min-height:1.4em;padding:1px 3px}.doc-math{cursor:default}.doc-math:hover{background:color-mix(in srgb,var(--paper) 96%,var(--accent) 4%);border-radius:6px}
.texflow-semantic-block{position:relative;outline:none}.texflow-semantic-block.semantic-block-selected{outline:2px solid color-mix(in srgb,var(--accent) 72%,transparent);outline-offset:5px;border-radius:7px}.semantic-delete{position:absolute;z-index:8;right:-9px;top:-11px;width:24px;height:24px;display:none;align-items:center;justify-content:center;border:1px solid var(--line-strong);border-radius:999px;background:var(--vscode-editor-background);color:var(--vscode-foreground);font:600 17px/1 var(--vscode-font-family);cursor:pointer;box-shadow:0 2px 7px rgba(0,0,0,.25)}.texflow-semantic-block.semantic-block-selected>.semantic-delete{display:flex}.semantic-delete:hover{background:var(--vscode-inputValidation-errorBackground,var(--hover));border-color:var(--vscode-inputValidation-errorBorder,var(--line-strong))}.doc-after-block-slot{min-height:18px;margin:-4px 0 8px;border-radius:5px;display:flex;align-items:center;justify-content:flex-start;color:transparent;font-size:11px;cursor:text;outline:none;transition:color .12s,background .12s}.doc-after-block-slot:before{content:'Start typing…';padding:2px 6px}.doc-after-block-slot:hover,.doc-after-block-slot:focus{color:var(--muted);background:color-mix(in srgb,var(--paper) 96%,var(--accent) 4%)}

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
.math-structure-bar{display:grid;grid-template-columns:minmax(150px,1fr) auto minmax(170px,1fr);gap:10px;align-items:end;margin:0 0 10px}.math-field{display:grid;gap:4px;font-size:11px;color:var(--muted)}.math-field select,.math-field input{height:30px;border:1px solid var(--line-strong);border-radius:6px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);padding:4px 7px}.math-numbered{display:flex;align-items:center;gap:6px;height:30px;color:var(--fg);font-size:12px}.math-builder{display:none;margin:0 0 10px;border:1px solid var(--line);border-radius:8px;padding:10px;background:color-mix(in srgb,var(--paper) 97%,var(--fg) 3%)}.math-builder.open{display:block}.math-builder-toolbar{display:flex;align-items:center;gap:7px;margin-bottom:8px;flex-wrap:wrap}.math-builder-toolbar button{border:1px solid var(--line);background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border-radius:5px;padding:4px 8px;cursor:pointer}.math-builder-grid{display:grid;gap:5px}.math-align-row{display:grid;grid-template-columns:minmax(80px,1fr) 38px minmax(80px,1fr) minmax(110px,.6fr) auto;gap:5px;align-items:center}.math-cases-row{display:grid;grid-template-columns:minmax(120px,1fr) minmax(120px,1fr) auto;gap:5px}.math-builder input,.math-builder select{min-width:0;border:1px solid var(--line-strong);border-radius:5px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);padding:6px 7px}.math-row-delete{border:0!important;background:transparent!important;color:var(--muted)!important;font-size:15px}.math-matrix-grid{display:grid;gap:4px;overflow:auto}.math-matrix-grid input{width:100%;min-width:58px}.math-raw-toggle{font-size:10px;color:var(--muted);margin-left:auto}.math-code.structured-source{min-height:90px}.math-inline-tools{display:flex;gap:7px;margin:-2px 0 9px}.math-inline-tools button,.math-builder-actions button{border:1px solid var(--line);background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border-radius:5px;padding:4px 8px;cursor:pointer}.math-builder-actions{display:flex;gap:7px;margin-top:8px}.math-multline-line{width:100%;box-sizing:border-box}
.symbol-panel{border-left:1px solid var(--line);padding-left:14px;min-width:0}.symbol-tabs{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}.symbol-tab{border:1px solid var(--line);background:transparent;color:var(--vscode-foreground);border-radius:5px;padding:5px 7px;cursor:pointer;font-size:11px}.symbol-tab.active,.symbol-tab:hover{background:var(--active);color:var(--active-fg)}
.symbol-grid{display:grid;grid-template-columns:repeat(5,minmax(34px,1fr));gap:6px}.symbol-btn{height:36px;border:1px solid var(--line);background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border-radius:6px;cursor:pointer;font-size:16px}.symbol-btn:hover{border-color:var(--vscode-focusBorder);background:var(--hover)}
.math-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:11px 14px;border-top:1px solid var(--line)}.math-modal-foot button{border:0;border-radius:6px;padding:8px 14px;cursor:pointer;font:inherit}.math-cancel{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}.math-save{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
@media(max-width:760px){.math-editor-body{grid-template-columns:1fr}.symbol-panel{border-left:0;border-top:1px solid var(--line);padding-left:0;padding-top:12px}.symbol-grid{grid-template-columns:repeat(8,minmax(32px,1fr))}}

.topbar{height:48px;display:flex;align-items:center;gap:7px;padding:0 10px;border-bottom:1px solid var(--line);background:var(--panel);position:relative;z-index:100}
.topbar-brand{display:flex;align-items:center;gap:8px;font-weight:650;margin-right:4px;padding:4px 10px 4px 5px;border:1px solid var(--line-strong);border-radius:999px;background:color-mix(in srgb,var(--panel) 88%,var(--accent) 12%);white-space:nowrap;flex:0 0 auto}
.topbar-spacer{flex:1;min-width:6px}
.top-action{appearance:none;border:0;background:transparent;color:var(--vscode-foreground);padding:7px 9px;border-radius:6px;cursor:pointer;font:inherit;white-space:nowrap}
.top-action:hover{background:var(--hover)}
.top-action.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.top-separator{width:1px;height:22px;background:var(--line-strong);margin:0 4px;flex:0 0 auto}
.top-menu{position:relative;flex:0 0 auto}
.top-menu-panel{display:none;position:absolute;left:0;right:auto;top:calc(100% + 7px);min-width:190px;padding:6px;background:var(--vscode-menu-background,var(--vscode-editorWidget-background));border:1px solid var(--line-strong);border-radius:8px;box-shadow:0 12px 28px rgba(0,0,0,.32)}
.top-menu.open .top-menu-panel{display:block}.menu-label{font-weight:600}
.top-menu-panel button{display:block;width:100%;text-align:left;border:0;background:transparent;color:var(--vscode-foreground);padding:8px 10px;border-radius:5px;cursor:pointer;font:inherit}
.top-menu-panel .menu-divider{display:block;height:1px;background:var(--border);margin:5px 6px}.top-menu-panel button:hover{background:var(--hover)}
.top-menu-panel.wide-menu{min-width:240px;max-height:min(70vh,620px);overflow:auto}.top-menu-panel .menu-title{padding:7px 10px 3px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}.top-color-grid{padding:7px 10px 9px}.top-color-grid .color-swatch{width:19px;height:19px}.toolbar .tool-label{font-size:9px}
.nav-section{margin:14px 5px 4px;padding:4px 5px;font-size:11px;font-weight:700;color:var(--vscode-foreground)}
.nav-subsection{margin:8px 5px 3px 14px;padding:3px 5px;font-size:10px;font-weight:650;color:var(--muted)}
.nav-subsection + .frame-link,.nav-section + .frame-link{margin-top:2px}

@media(max-width:1220px){.topbar{gap:5px;padding-left:8px;padding-right:8px}.top-action{padding-left:7px;padding-right:7px}.save-status{display:none}.topbar-brand{margin-right:1px;padding-right:8px}}
@media(max-width:1080px){.topbar{gap:3px}.top-action{padding-left:6px;padding-right:6px}.mode-tab{padding-left:7px;padding-right:7px}.topbar-brand .brand-mark{display:none}.topbar-brand{padding-left:9px}}
/* TeXFlow labs.5 responsive brand: full -> TF -> hidden. */
.topbar-brand{gap:0;min-width:0;margin-right:2px;padding:4px 9px;border-radius:999px}
.topbar-brand .brand-full{display:inline}.topbar-brand .brand-short{display:none}
@media(max-width:1080px){.topbar-brand{padding:4px 8px}.topbar-brand .brand-full{display:none!important}.topbar-brand .brand-short{display:inline!important}}
@media(max-width:860px){.topbar-brand{display:none!important}}
@media(max-width:1050px){#app,body.nav-open #app,body.nav-closed #app{grid-template-columns:0 minmax(0,1fr)}.side{position:fixed;left:0;top:48px;bottom:0;width:min(240px,82vw);z-index:120;box-shadow:12px 0 30px rgba(0,0,0,.32);transform:translateX(-105%);opacity:0;pointer-events:none}.side::-webkit-scrollbar{width:8px}body.nav-open .side{transform:translateX(0);opacity:1;pointer-events:auto}body.nav-closed .side{transform:translateX(-105%);opacity:0;pointer-events:none}.main{min-width:0;width:100%;padding:12px 10px 70px}.slide{width:100%;margin:0;padding:2.15em 2.5em 2.25em;border-radius:8px}.floating-actions,body.nav-open .floating-actions,body.nav-closed .floating-actions{left:10px}.toolbar,body.nav-open .toolbar,body.nav-closed .toolbar{left:10px}}
[contenteditable="true"][data-placeholder]:empty:before{content:attr(data-placeholder);color:var(--muted);pointer-events:none;font-style:italic;}
::highlight(texflow-spelling){text-decoration-line:underline;text-decoration-style:wavy;text-decoration-thickness:1.25px;text-decoration-color:var(--vscode-editorError-foreground, var(--vscode-errorForeground));}
/* TeXFlow 0.8 visual refresh */
.side #nav{padding-top:6px}.section{margin-top:16px;opacity:.75}.nav-section{border-top:1px solid var(--line);padding-top:10px;margin-top:14px}.nav-subsection{opacity:.82}.preamble-link{margin-top:8px;background:color-mix(in srgb,var(--vscode-editor-background) 45%,transparent)}
.topbar{backdrop-filter:blur(12px);box-shadow:0 1px 0 rgba(0,0,0,.08)}.topbar-brand{letter-spacing:.1px}.mode-tabs{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--line) 35%,transparent)}.mode-tab.active{box-shadow:0 1px 4px rgba(0,0,0,.16)}.save-status{padding:4px 7px;border-radius:999px;background:color-mix(in srgb,var(--vscode-testing-iconPassed) 9%,transparent)}
.slide:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:color-mix(in srgb,var(--vscode-focusBorder) 55%,transparent);opacity:.55}.slide .blocks-host{position:relative;z-index:1}.title{position:relative;z-index:1}.block{margin:12px 0}.block:hover{box-shadow:0 0 0 4px color-mix(in srgb,var(--hover) 18%,transparent)}
.floating-btn{border-radius:10px;backdrop-filter:blur(10px)}.toolbar{border-radius:12px;backdrop-filter:blur(14px)}


.bib-citation{display:inline-flex;align-items:center;gap:.22em;padding:.02em .22em;border-radius:4px;background:color-mix(in srgb,var(--accent) 10%,transparent);color:var(--fg);white-space:nowrap}.bib-citation.missing{color:var(--danger);background:color-mix(in srgb,var(--danger) 10%,transparent)}.bib-citation-key{font-size:.72em;color:var(--muted);margin-left:.15em}.tex-reference{display:inline-flex;align-items:center;gap:.28em;padding:.02em .26em;border-radius:4px;background:color-mix(in srgb,var(--vscode-symbolIcon-referenceForeground,var(--accent)) 12%,transparent);color:var(--fg);white-space:nowrap}.tex-reference.missing{color:var(--danger);background:color-mix(in srgb,var(--danger) 10%,transparent)}.tex-reference-kind{font-size:.72em;font-weight:650;color:var(--muted)}.tex-reference-key{font-family:var(--vscode-editor-font-family,monospace);font-size:.74em}.texflow-label-badge{display:inline-flex;vertical-align:middle;align-items:center;margin-left:.5em;padding:.12em .38em;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-family:var(--vscode-editor-font-family,monospace);font-size:10px;font-weight:500;line-height:1.2;user-select:none}.doc-math-wrap{position:relative}.doc-math-wrap .texflow-label-badge{position:absolute;right:0;top:0}.doc-heading-selected,.doc-math-wrap.selected{outline:1px solid color-mix(in srgb,var(--accent) 55%,transparent);outline-offset:4px;border-radius:3px}.doc-heading[data-label]::after{content:attr(data-label);display:inline-flex;vertical-align:middle;align-items:center;margin-left:.5em;padding:.12em .38em;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-family:var(--vscode-editor-font-family,monospace);font-size:10px;font-weight:500;line-height:1.2;user-select:none;pointer-events:none}.doc-bibliography{margin:34px 0 10px;padding-top:12px;border-top:1px solid var(--line)}.doc-bibliography h2{font-size:1.45em;margin:0 0 16px}.bib-entry{padding:8px 0;border-bottom:1px solid color-mix(in srgb,var(--line) 65%,transparent);line-height:1.42}.bib-entry:last-child{border-bottom:0}.bib-entry-key{font-family:var(--vscode-editor-font-family,monospace);font-size:.75em;color:var(--muted);margin-left:.45em}.bib-print-placeholder{display:block;margin:14px 0;padding:12px 14px;border-left:3px solid var(--accent);background:color-mix(in srgb,var(--paper) 95%,var(--accent) 5%);color:var(--muted)}
.table-editor-body{padding:16px;overflow:auto;display:grid;gap:14px}.table-editor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.table-field{display:grid;gap:5px}.table-field.wide{grid-column:1/-1}.table-field label{font-size:11px;color:var(--muted);font-weight:650}.table-input,.table-select{width:100%;box-sizing:border-box;background:var(--input);color:var(--fg);border:1px solid var(--line-strong);border-radius:7px;padding:8px 10px;font:inherit;outline:none}.table-input:focus,.table-select:focus{border-color:var(--vscode-focusBorder)}.table-alignments{display:flex;flex-wrap:wrap;gap:8px}.table-align-control{display:flex;align-items:center;gap:5px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;background:color-mix(in srgb,var(--panel) 90%,transparent)}.table-align-control span{font-size:11px;color:var(--muted)}.table-align-control select{background:var(--input);color:var(--fg);border:1px solid var(--line-strong);border-radius:5px;padding:4px 6px}.table-preview-shell{border:1px solid var(--line);border-radius:8px;padding:12px;overflow:auto;background:var(--vscode-editor-background)}.table-preview{border-collapse:collapse;margin:auto;min-width:260px}.table-preview td{border:1px solid var(--line-strong);height:28px;min-width:62px;padding:3px 7px;color:var(--muted);font-size:11px}.table-validation{min-height:16px;font-size:11px;color:var(--vscode-inputValidation-errorForeground,var(--danger))}@media(max-width:640px){.table-editor-grid{grid-template-columns:1fr}.table-field.wide{grid-column:auto}}
.tex-footnote,.tex-link,.tex-index,.tex-field,.tex-nomenclature{display:inline-flex;align-items:center;gap:.28em;padding:.03em .3em;margin:0 .05em;border:1px solid var(--line);border-radius:4px;background:color-mix(in srgb,var(--paper) 94%,var(--accent) 6%);color:var(--fg);font-size:.9em;white-space:nowrap;vertical-align:baseline}.tex-footnote:before{content:'fn';font-size:.68em;font-weight:700;color:var(--accent)}.tex-link:before{content:'↗';color:var(--accent)}.tex-index:before{content:'idx';font-size:.65em;color:var(--muted)}.tex-field:before{content:'ƒ';color:var(--muted)}.tex-nomenclature:before{content:'sym';font-size:.65em;color:var(--muted)}.doc-rich-block{position:relative;margin:18px 0;padding:14px 16px;border:1px solid var(--line);border-radius:8px;background:color-mix(in srgb,var(--paper) 97%,var(--accent) 3%)}.doc-rich-block.quote{border-left:4px solid var(--line-strong);font-style:italic}.doc-rich-block.theorem{border-left:4px solid var(--accent)}.doc-rich-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px}.doc-break{position:relative;height:28px;margin:18px 0;border-top:1px dashed var(--line-strong);color:var(--muted);font-size:10px;text-align:center;padding-top:5px}.labs-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.labs-form-grid label{display:flex;flex-direction:column;gap:5px;color:var(--muted);font-size:11px}.labs-form-grid label.wide{grid-column:1/-1}.labs-form-grid input,.labs-form-grid textarea,.labs-form-grid select{background:var(--input);color:var(--fg);border:1px solid var(--line-strong);border-radius:6px;padding:7px 8px;font:inherit}.labs-feature-note{font-size:10px;color:var(--muted);margin-top:8px}
.tex-hspace{display:inline-flex;align-items:center;justify-content:center;min-width:.45em;height:1em;margin:0 .08em;padding:0 .18em;border:1px dashed color-mix(in srgb,var(--accent) 45%,var(--line));border-radius:3px;color:var(--muted);font-family:var(--vscode-editor-font-family,monospace);font-size:.68em;vertical-align:middle;white-space:nowrap}.doc-vspace,.vspace-block{position:relative;min-height:18px;margin:8px 0;border-left:2px dotted color-mix(in srgb,var(--accent) 55%,transparent);background:linear-gradient(to bottom,transparent 45%,color-mix(in srgb,var(--accent) 10%,transparent) 45%,color-mix(in srgb,var(--accent) 10%,transparent) 55%,transparent 55%);border-radius:3px}.doc-vspace .vspace-label,.vspace-block .vspace-label{position:absolute;left:7px;top:50%;transform:translateY(-50%);padding:1px 5px;background:var(--paper,var(--panel));color:var(--muted);font-size:10px;font-family:var(--vscode-editor-font-family,monospace)}.spacing-modal-body{padding:16px;display:grid;gap:13px}.spacing-type-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.spacing-type-row button{padding:10px;border:1px solid var(--line-strong);border-radius:8px;background:var(--input);color:var(--fg);cursor:pointer}.spacing-type-row button.active{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--input))}.spacing-presets{display:flex;gap:7px;flex-wrap:wrap}.spacing-presets button{padding:6px 9px;border:1px solid var(--line);border-radius:7px;background:transparent;color:var(--fg);cursor:pointer}.spacing-presets button:hover{background:var(--hover)}
.cite-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.46);display:none;align-items:center;justify-content:center;z-index:260}.cite-modal-backdrop.open{display:flex}.cite-modal{width:min(760px,calc(100vw - 34px));max-height:min(720px,calc(100vh - 34px));display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line-strong);border-radius:14px;box-shadow:0 28px 70px rgba(0,0,0,.42);overflow:hidden}.cite-modal-head,.cite-modal-foot{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line)}.cite-modal-foot{border-bottom:0;border-top:1px solid var(--line);justify-content:flex-end}.cite-modal-body{padding:14px;overflow:auto}.cite-search-row{display:grid;grid-template-columns:1fr 150px;gap:10px;margin-bottom:12px}.cite-search,.cite-style{width:100%;box-sizing:border-box;background:var(--input);color:var(--fg);border:1px solid var(--line-strong);border-radius:7px;padding:8px 10px;font:inherit}.cite-results{display:flex;flex-direction:column;gap:7px}.cite-result{display:grid;grid-template-columns:22px 1fr;gap:9px;padding:9px 10px;border:1px solid var(--line);border-radius:8px;cursor:pointer;background:transparent;color:var(--fg);text-align:left}.cite-result:hover{background:var(--hover)}.cite-result.selected{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent)}.cite-result-main{min-width:0}.cite-result-title{font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cite-result-meta{font-size:.82em;color:var(--muted);margin-top:2px}.cite-empty{padding:20px;color:var(--muted);text-align:center}.cite-check{align-self:center}.cite-close,.cite-cancel,.cite-insert,.cite-secondary{border:1px solid var(--line-strong);background:var(--button);color:var(--button-fg);border-radius:7px;padding:7px 11px;cursor:pointer}.cite-insert{background:var(--accent);color:var(--accent-fg);border-color:transparent}.cite-secondary{background:transparent;color:var(--fg)}.cite-secondary:disabled,.cite-insert:disabled{opacity:.45;cursor:default}.cite-preview{font-size:.78em;color:var(--muted);display:block;margin-top:2px}.cite-menu-subtitle{margin-top:8px;padding-top:9px;border-top:1px solid var(--line)}.doc-outline-bibliography{font-weight:650;color:var(--fg);margin-top:9px}.doc-outline-bibliography.pending{color:var(--muted);font-weight:500;font-style:italic}

.settings-shell{display:grid;grid-template-columns:minmax(280px,420px) minmax(0,1fr);gap:16px;padding:18px;min-height:100%;box-sizing:border-box}.settings-card{border:1px solid var(--line);border-radius:10px;background:var(--paper);padding:16px}.settings-card h3{margin:0 0 12px;font-size:14px}.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.settings-field{display:flex;flex-direction:column;gap:5px;font-size:11px;color:var(--muted)}.settings-field.wide{grid-column:1/-1}.settings-field input,.settings-field select,.settings-field textarea{background:var(--input);color:var(--fg);border:1px solid var(--line-strong);border-radius:6px;padding:7px 8px;font:inherit}.settings-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.settings-note{font-size:11px;color:var(--muted);line-height:1.45;margin-top:10px}.doc-columns,.columns-card{display:grid;gap:10px;margin:18px 0}.columns-grid{display:grid;gap:10px}.doc-column,.column-edit{min-height:90px;padding:10px;border:1px solid var(--line);border-radius:7px;background:color-mix(in srgb,var(--paper) 97%,var(--accent) 3%);outline:none}
.slide .beamer-block{margin:.75em 0}.slide .beamer-block .head{padding:.5em .75em}.slide .beamer-block .body{padding:.75em}.slide .columns-card{gap:.625em;margin:1.125em 0;flex-shrink:0}.slide .columns-grid{gap:.625em;align-items:stretch}.slide .column-edit{min-height:5.625em;height:auto;padding:.625em;overflow:visible;align-self:stretch}.slide .columns-head{font-size:.6875em}.slide .trailing-paragraph{margin-top:.5em;padding:.3125em .4375em}.doc-column:focus,.column-edit:focus{box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 55%,transparent)}.doc-columns-flow{display:block;margin:18px 0;border:1px solid var(--line);border-radius:8px;padding:10px 12px;background:color-mix(in srgb,var(--paper) 98%,var(--accent) 2%)}.doc-column-flow{min-height:110px;padding:8px;outline:none;column-gap:28px;column-rule:1px solid color-mix(in srgb,var(--line) 65%,transparent)}.doc-column-flow:focus{box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 55%,transparent);border-radius:5px}.subfigure-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;width:100%}.subfigure-item{border:1px solid var(--line);border-radius:7px;padding:8px;background:color-mix(in srgb,var(--paper) 97%,var(--fg) 3%)}.subfigure-item img,.subfigure-item object{display:block;width:100%;max-height:260px;object-fit:contain}.subfigure-name{font-size:10px;color:var(--muted);margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.columns-head{display:flex;gap:8px;align-items:center;color:var(--muted);font-size:11px}.symbol-search{width:100%;box-sizing:border-box;margin-bottom:8px;background:var(--input);color:var(--fg);border:1px solid var(--line-strong);border-radius:6px;padding:6px 8px;font:inherit}@media(max-width:900px){.settings-shell{grid-template-columns:1fr}.settings-grid{grid-template-columns:1fr}}
</style></head><body class="nav-open"><header class="topbar"><div class="topbar-brand" aria-label="TeXFlow"><span class="brand-full">TeXFlow</span><span class="brand-short">TF</span></div><div class="top-menu" id="file-menu"><button class="top-action menu-label" id="file-menu-button">File ▾</button><div class="top-menu-panel"><button id="new-document">New document…</button><span class="menu-divider"></span><button id="open-file" title="Open (Ctrl/Cmd+O)">Open…</button><button id="save-file" title="Save (Ctrl/Cmd+S)">Save</button><button id="save-as" title="Save as (Ctrl/Cmd+Shift+S)">Save as…</button></div></div><div class="top-menu" id="edit-menu"><button class="top-action menu-label" id="edit-menu-button">Edit ▾</button><div class="top-menu-panel"><button id="undo" title="Undo">↶ Undo</button><button id="redo" title="Redo">↷ Redo</button><span class="menu-divider"></span><button id="labs-find-replace">Find / Replace…</button><span class="menu-divider"></span><div class="menu-title">Selected object</div><button id="labs-copy-object">Copy object</button><button id="labs-paste-object">Paste object</button><button id="labs-duplicate-object">Duplicate object</button><button id="labs-move-up">Move up</button><button id="labs-move-down">Move down</button></div></div><div class="top-menu" id="structure-menu"><button class="top-action menu-label" id="structure-menu-button">Structure ▾</button><div class="top-menu-panel wide-menu" id="structure-menu-panel"></div></div><div class="top-menu" id="insert-menu"><button class="top-action menu-label" id="insert-menu-button">Insert ▾</button><div class="top-menu-panel wide-menu" id="insert-menu-panel"></div></div><div class="top-menu" id="format-menu"><button class="top-action menu-label" id="format-menu-button">Format ▾</button><div class="top-menu-panel"><div class="menu-title">Text</div><button class="format" data-format="bold"><b>B</b>&nbsp;&nbsp;Bold</button><button class="format" data-format="italic"><i>I</i>&nbsp;&nbsp;Italic</button><button class="format" data-format="underline"><u>U</u>&nbsp;&nbsp;Underline</button><button class="format" data-format="key">K&nbsp;&nbsp;Key</button><button class="format" data-format="alert">!&nbsp;&nbsp;Alert</button><span class="menu-divider"></span><div class="menu-title">Paragraph alignment</div><button class="insert" data-action="alignleft">Align left</button><button class="insert" data-action="aligncenter">Center</button><button class="insert" data-action="alignright">Align right</button><button class="insert" data-action="alignjustify">Justify / normal</button><span class="menu-divider"></span><div class="menu-title">Text color</div><div class="color-grid top-color-grid"><button class="color-swatch" data-color="black" title="black" style="background:black"></button><button class="color-swatch" data-color="gray" title="gray" style="background:gray"></button><button class="color-swatch" data-color="red" title="red" style="background:red"></button><button class="color-swatch" data-color="orange" title="orange" style="background:orange"></button><button class="color-swatch" data-color="yellow" title="yellow" style="background:yellow"></button><button class="color-swatch" data-color="green" title="green" style="background:green"></button><button class="color-swatch" data-color="blue" title="blue" style="background:blue"></button><button class="color-swatch" data-color="cyan" title="cyan" style="background:cyan"></button><button class="color-swatch" data-color="magenta" title="magenta" style="background:magenta"></button><button class="color-swatch" data-color="purple" title="purple" style="background:purple"></button><button class="color-swatch" data-color="brown" title="brown" style="background:brown"></button></div></div></div><div class="top-menu" id="references-menu"><button class="top-action menu-label" id="references-menu-button">References ▾</button><div class="top-menu-panel wide-menu" id="references-menu-panel"></div></div><div class="top-menu" id="layout-menu-top"><button class="top-action menu-label" id="layout-menu-button">Layout ▾</button><div class="top-menu-panel wide-menu" id="layout-menu-panel"></div></div><div class="top-menu" id="language-menu-top"><button class="top-action menu-label" id="language-menu-button">Language ▾</button><div class="top-menu-panel"><button id="spell-language-automatic">Automatic</button><button id="spell-language-english">English</button><button id="spell-language-spanish">Español</button><span class="menu-divider"></span><button id="spell-check-toggle">Spell checking</button></div></div><div class="top-menu beamer-only" id="beamer-menu-top"><button class="top-action menu-label" id="beamer-menu-button">Beamer ▾</button><div class="top-menu-panel"><button class="insert" data-action="frame">New frame</button><span class="menu-divider"></span><div class="menu-title">Blocks</div><button class="insert" data-action="beamerblock">Block</button><button class="insert" data-action="beameralert">Alert block</button><button class="insert" data-action="beamerexample">Example block</button><span class="menu-divider"></span><div class="menu-title">Frame text size</div><button class="frame-size-option" data-frame-size="normal">✓ Normal</button><button class="frame-size-option" data-frame-size="small">Small</button><button class="frame-size-option" data-frame-size="footnotesize">Footnotesize</button><button class="frame-size-option" data-frame-size="scriptsize">Scriptsize</button><button class="frame-size-option" data-frame-size="tiny">Tiny</button><span class="menu-divider"></span><button class="insert" data-action="frameoptions">Frame options…</button></div></div><div class="top-menu" id="view-menu"><button class="top-action menu-label" id="view-menu-button">View ▾</button><div class="top-menu-panel"><button class="document-only" id="view-continuous">✓ Continuous</button><button class="document-only" id="view-pages">Pages</button><span class="menu-divider document-only"></span><button id="toggle-nav">Index / outline</button><button id="focus-mode">Focus mode</button><span class="menu-divider"></span><button id="project-diagnostics">Project diagnostics</button></div></div><span class="top-separator"></span><nav class="mode-tabs"><button class="mode-tab active" data-view="visual">Visual</button><button class="mode-tab" data-view="source">Source</button><button class="mode-tab" data-view="split">Split</button><button class="mode-tab" data-view="pdf">PDF</button></nav><span class="top-spacer topbar-spacer"></span><button class="top-action primary" id="top-compile">▶ Compile</button><span class="save-status" id="save-status">Saved</span></header><div class="floating-actions"><button class="floating-btn focus-exit" id="exit-focus" title="Exit focus mode">⛶</button></div><div id="app"><aside class="side"><div class="brand"><span class="brand-mark">T</span><span>Document</span></div><div id="nav"></div></aside><main class="main"><div id="content" class="empty">Loading…</div></main></div>
<div class="math-modal-backdrop" id="math-modal" aria-hidden="true">
  <section class="math-modal" role="dialog" aria-modal="true" aria-labelledby="math-modal-title">
    <header class="math-modal-head">
      <span id="math-modal-title">Edit equation</span><span class="spacer"></span>
      <button id="math-close" type="button" title="Close">✕</button>
    </header>
    <div class="math-editor-body">
      <div class="math-main">
        <div class="math-structure-bar">
          <label class="math-field">Structure<select id="math-structure"><option value="inline">Inline</option><option value="display">Display</option><option value="equation">Equation</option><option value="align">Align</option><option value="gather">Gather</option><option value="multline">Multline</option><option value="cases">Cases</option><option value="matrix">Matrix</option></select></label>
          <label class="math-numbered" id="math-numbered-wrap"><input type="checkbox" id="math-numbered" checked> Numbered</label>
          <label class="math-field" id="math-label-wrap">Label<input id="math-label" type="text" placeholder="eq:model"></label>
        </div>
        <div class="math-inline-tools"><button id="math-text-insert" type="button" title="Insert \text{…}">Text</button></div>
        <div class="math-builder" id="math-align-builder"><div class="math-builder-toolbar"><strong>Aligned rows</strong><span class="math-raw-toggle">labels and numbering can differ by row</span></div><div class="math-builder-grid" id="math-align-rows"></div><div class="math-builder-actions"><button id="math-align-add" type="button">+ Add row</button></div></div>
        <div class="math-builder" id="math-cases-builder"><div class="math-builder-toolbar"><strong>Cases</strong></div><div class="math-builder-grid" id="math-cases-rows"></div><div class="math-builder-actions"><button id="math-cases-add" type="button">+ Add row</button></div></div>
        <div class="math-builder" id="math-multline-builder"><div class="math-builder-toolbar"><strong>Multline</strong><span class="math-raw-toggle">one logical equation split across lines</span></div><div class="math-builder-grid" id="math-multline-lines"></div><div class="math-builder-actions"><button id="math-multline-add" type="button">+ Add line</button></div></div>
        <div class="math-builder" id="math-matrix-builder"><div class="math-builder-toolbar"><strong>Matrix</strong><label>Style <select id="math-matrix-env"><option value="matrix">None</option><option value="pmatrix" selected>( )</option><option value="bmatrix">[ ]</option><option value="vmatrix">| |</option><option value="Vmatrix">‖ ‖</option></select></label><button id="math-matrix-add-row" type="button">+ Row</button><button id="math-matrix-del-row" type="button">− Row</button><button id="math-matrix-add-col" type="button">+ Column</button><button id="math-matrix-del-col" type="button">− Column</button></div><div class="math-matrix-grid" id="math-matrix-grid"></div></div>
        <div class="math-preview" id="math-preview"></div>
        <textarea class="math-code" id="math-code" spellcheck="false" aria-label="LaTeX equation"></textarea>
        <div class="math-help">Double-click an equation to edit it. Press ⌘/Ctrl+Enter to save.</div>
      </div>
      <aside class="symbol-panel">
        <input class="symbol-search" id="symbol-search" type="search" placeholder="Search symbols…">
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
<div class="math-modal-backdrop" id="figure-modal" aria-hidden="true">
  <section class="math-modal" role="dialog" aria-modal="true" aria-labelledby="figure-modal-title" style="width:min(700px,96vw)">
    <header class="math-modal-head"><strong id="figure-modal-title">Insert figure</strong><span class="spacer"></span><button id="figure-close" type="button" title="Close">✕</button></header>
    <div class="table-editor-body">
      <div class="table-editor-grid">
        <div class="table-field wide"><label>File</label><div class="table-input" id="figure-file" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.85"></div></div>
        <div class="table-field wide"><label for="figure-caption-new">Caption (optional)</label><input class="table-input" id="figure-caption-new" type="text" placeholder="Figure caption"></div>
        <div class="table-field wide"><label for="figure-short-caption-new">Short caption (optional, list of figures)</label><input class="table-input" id="figure-short-caption-new" type="text" placeholder="Short caption"></div>
        <div class="table-field"><label for="figure-label-new">Label (optional)</label><input class="table-input" id="figure-label-new" type="text" spellcheck="false" placeholder="fig:example"></div>
        <div class="table-field" id="figure-placement-field"><label for="figure-placement-new">Placement</label><select class="table-select" id="figure-placement-new"><option value="htbp">htbp — recommended</option><option value="h">h — here</option><option value="t">t — top</option><option value="b">b — bottom</option><option value="p">p — float page</option><option value="">Default — no option</option></select></div>
        <div class="table-field"><label for="figure-caption-position-new">Caption position</label><select class="table-select" id="figure-caption-position-new"><option value="below">Below</option><option value="above">Above</option></select></div>
        <div class="table-field"><label for="figure-align-new">Alignment</label><select class="table-select" id="figure-align-new"><option value="center">Center</option><option value="left">Left</option><option value="right">Right</option></select></div>
        <div class="table-field"><label for="figure-width-new">Width (%)</label><input class="table-input" id="figure-width-new" type="number" min="5" max="100" step="1" value="70"></div>
        <div class="table-field"><label for="figure-angle-new">Rotation (degrees)</label><input class="table-input" id="figure-angle-new" type="number" min="-360" max="360" step="1" value="0"></div>
      </div>
      <div class="table-validation" id="figure-validation"></div>
    </div>
    <footer class="math-modal-foot"><button class="math-cancel" id="figure-cancel" type="button">Cancel</button><button class="math-save" id="figure-insert" type="button">Insert figure</button></footer>
  </section>
</div>
<div class="math-modal-backdrop" id="table-modal" aria-hidden="true">
  <section class="math-modal" role="dialog" aria-modal="true" aria-labelledby="table-modal-title" style="width:min(760px,96vw)">
    <header class="math-modal-head"><strong id="table-modal-title">Insert table</strong><span class="spacer"></span><button id="table-close" type="button" title="Close">✕</button></header>
    <div class="table-editor-body">
      <div class="table-editor-grid">
        <div class="table-field"><label for="table-rows">Rows</label><input class="table-input" id="table-rows" type="number" min="1" max="30" value="3"></div>
        <div class="table-field"><label for="table-cols">Columns</label><input class="table-input" id="table-cols" type="number" min="1" max="12" value="3"></div>
        <div class="table-field wide"><label for="table-caption">Caption (optional)</label><input class="table-input" id="table-caption" type="text" placeholder="Table caption"></div>
        <div class="table-field"><label for="table-label">Label (optional)</label><input class="table-input" id="table-label" type="text" spellcheck="false" placeholder="tab:results"></div>
        <div class="table-field" id="table-placement-field"><label for="table-placement">Placement</label><select class="table-select" id="table-placement"><option value="htbp">htbp — recommended</option><option value="h">h — here</option><option value="t">t — top</option><option value="b">b — bottom</option><option value="p">p — float page</option><option value="">Default — no option</option></select></div>
        <div class="table-field"><label for="table-style-new">Style</label><select class="table-select" id="table-style-new"><option value="plain">Plain LaTeX</option><option value="booktabs">Booktabs</option></select></div>
        <div class="table-field wide"><label>Column alignment</label><div class="table-alignments" id="table-alignments"></div></div>
      </div>
      <div class="table-preview-shell"><table class="table-preview" id="table-preview"></table></div>
      <div class="table-validation" id="table-validation"></div>
    </div>
    <footer class="math-modal-foot"><button class="math-cancel" id="table-cancel" type="button">Cancel</button><button class="math-save" id="table-insert" type="button">Insert table</button></footer>
  </section>
</div>
<div class="math-modal-backdrop" id="spacing-modal" aria-hidden="true">
  <section class="math-modal" role="dialog" aria-modal="true" aria-labelledby="spacing-modal-title" style="width:min(520px,94vw)">
    <header class="math-modal-head"><strong id="spacing-modal-title">Insert spacing</strong><span class="spacer"></span><button id="spacing-close" type="button" title="Close">✕</button></header>
    <div class="spacing-modal-body">
      <div class="spacing-type-row"><button id="spacing-vertical" class="active" type="button">Vertical space</button><button id="spacing-horizontal" type="button">Horizontal space</button></div>
      <div class="table-field"><label for="spacing-amount">Length</label><input class="table-input" id="spacing-amount" type="text" value="6pt" spellcheck="false" placeholder="6pt, 0.5cm, 1em…"></div>
      <div class="spacing-presets"><button type="button" data-space="3pt">Small · 3pt</button><button type="button" data-space="6pt">Medium · 6pt</button><button type="button" data-space="12pt">Large · 12pt</button><button type="button" data-space="1em">1em</button></div>
      <label style="display:flex;align-items:center;gap:8px"><input id="spacing-starred" type="checkbox"> Starred form (preserve at page boundaries)</label>
      <div class="table-validation" id="spacing-validation"></div>
    </div>
    <footer class="math-modal-foot"><button class="math-cancel" id="spacing-cancel" type="button">Cancel</button><button class="math-save" id="spacing-insert" type="button">Insert</button></footer>
  </section>
</div>
<div class="cite-modal-backdrop" id="frame-options-modal" aria-hidden="true"><section class="cite-modal" role="dialog" aria-modal="true" style="width:min(520px,calc(100vw - 34px))"><header class="cite-modal-head"><strong>Frame options</strong><span class="spacer"></span><button class="cite-close" id="frame-options-close" type="button">✕</button></header><div class="cite-modal-body"><div class="settings-grid"><label class="settings-field wide">Vertical alignment<select id="frame-vertical"><option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option></select></label><label class="settings-field"><span><input id="frame-fragile" type="checkbox"> Fragile</span></label><label class="settings-field"><span><input id="frame-breaks" type="checkbox"> Allow frame breaks</span></label></div></div><footer class="cite-modal-foot"><button class="cite-cancel" id="frame-options-cancel" type="button">Cancel</button><button class="cite-insert" id="frame-options-save" type="button">Apply</button></footer></section></div>
<div class="cite-modal-backdrop" id="cite-modal" aria-hidden="true">
  <section class="cite-modal" role="dialog" aria-modal="true" aria-labelledby="cite-modal-title">
    <header class="cite-modal-head"><strong id="cite-modal-title">Insert citation</strong><span class="spacer"></span><button class="cite-close" id="cite-close" type="button">✕</button></header>
    <div class="cite-modal-body">
      <div class="cite-search-row"><input class="cite-search" id="cite-search" type="search" placeholder="Search author, title, year or citation key…"><select class="cite-style" id="cite-style"></select></div>
      <div class="cite-results" id="cite-results"></div>
    </div>
    <footer class="cite-modal-foot"><button class="cite-secondary" id="cite-add-bib" type="button">Add bibliography…</button><button class="cite-secondary" id="cite-open-bib" type="button">Open .bib</button><span class="spacer"></span><button class="cite-cancel" id="cite-cancel" type="button">Cancel</button><button class="cite-insert" id="cite-insert" type="button">Insert citation</button></footer>
  </section>
</div>
<div class="cite-modal-backdrop" id="reference-modal" aria-hidden="true">
  <section class="cite-modal" role="dialog" aria-modal="true" aria-labelledby="reference-modal-title">
    <header class="cite-modal-head"><strong id="reference-modal-title">Insert reference</strong><span class="spacer"></span><button class="cite-close" id="reference-close" type="button">✕</button></header>
    <div class="cite-modal-body">
      <div class="cite-search-row"><input class="cite-search" id="reference-search" type="search" placeholder="Search labels…"><select class="cite-style" id="reference-style"><option value="ref">Reference — \ref</option><option value="eqref">Equation — \eqref</option></select></div>
      <div class="cite-results" id="reference-results"></div>
    </div>
    <footer class="cite-modal-foot"><span class="spacer"></span><button class="cite-cancel" id="reference-cancel" type="button">Cancel</button><button class="cite-insert" id="reference-insert" type="button" disabled>Insert reference</button></footer>
  </section>
</div>
<div class="cite-modal-backdrop" id="label-modal" aria-hidden="true">
  <section class="cite-modal" role="dialog" aria-modal="true" aria-labelledby="label-modal-title">
    <header class="cite-modal-head"><strong id="label-modal-title">Add label</strong><span class="spacer"></span><button class="cite-close" id="label-close" type="button">✕</button></header>
    <div class="cite-modal-body">
      <div class="cite-result-meta" id="label-target-description" style="margin-bottom:10px"></div>
      <input class="cite-search" id="label-key" type="text" spellcheck="false" placeholder="e.g. sec:introduction or eq:model">
      <div class="cite-result-meta" id="label-validation" style="margin-top:8px"></div>
    </div>
    <footer class="cite-modal-foot"><span class="spacer"></span><button class="cite-cancel" id="label-cancel" type="button">Cancel</button><button class="cite-insert" id="label-insert" type="button">Add label</button></footer>
  </section>
</div>
<script nonce="${nonce}" src="${katexJs}"></script>
<script nonce="${nonce}">
const vscode=acquireVsCodeApi();let frames=[],current=0,isBeamer=false,documentClass='',documentSource='',metadata={},documentSettings={},documentLayoutMode='continuous',preambleOriginalText='',preambleDirty=false,presentationStyle={aspectWidth:4,aspectHeight:3,aspectLabel:'4:3',baseFontPt:11,bodyFontPx:16,titleFontPx:24.8,lineHeight:1.28},preambles=[],currentPreamble='root-preamble',mode='frames',viewMode='visual',sources=[],rootUri='',pdfUri='',figureResources={},bibliographyEntries=[],bibliographyResources=[],bibliographyByKey={};
window.addEventListener('error',e=>{const c=document.getElementById('content');if(c)c.innerHTML='<div class="empty">TeXFlow error: '+esc(e.message||'unknown error')+'</div>';});
let pdfBuildState='idle',pdfBuildMessage='';
const TEXFLOW_SPELL_HIGHLIGHT='texflow-spelling';
const texflowSpellState={enabled:true,language:'auto',requestSeq:0,lastAppliedSeq:0,supported:!!(window.CSS&&'highlights' in CSS&&typeof Highlight!=='undefined')};
const texflowSpellIssuesById=new Map();
const texflowSpellIssueRanges=[];
const texflowSpellMenu=document.createElement('div');
texflowSpellMenu.id='texflow-spell-menu';
texflowSpellMenu.style.cssText='position:fixed;z-index:9999;display:none;min-width:220px;max-width:320px;background:var(--vscode-menu-background,var(--vscode-editorWidget-background));color:var(--vscode-menu-foreground,var(--vscode-foreground));border:1px solid var(--vscode-menu-border, var(--line-strong));border-radius:8px;box-shadow:0 12px 28px rgba(0,0,0,.32);padding:6px;';
document.body.appendChild(texflowSpellMenu);
const texflowSpellHighlights=new Map();
function texflowClearSpellHighlights(){if(texflowSpellState.supported&&CSS.highlights)CSS.highlights.delete(TEXFLOW_SPELL_HIGHLIGHT);texflowSpellHighlights.clear();texflowSpellIssuesById.clear();texflowSpellIssueRanges.length=0;texflowSpellMenu.style.display='none';texflowSpellMenu.innerHTML='';}
function texflowApplySpellHighlights(blocks){if(!texflowSpellState.supported)return;texflowClearSpellHighlights();const list=[];for(const [id,items] of Object.entries(blocks||{})){texflowSpellIssuesById.set(id,items||[]);const el=document.querySelector('[data-spell-block-id="'+CSS.escape(id)+'"]');if(!el)continue;const rangeMap=el.__texflowSpellRanges||[];for(const issue of items||[]){for(const segment of rangeMap){const start=segment.start,end=segment.end;if(issue.offset>=end||issue.offset+issue.length<=start)continue;const r=document.createRange();const from=Math.max(issue.offset,start),to=Math.min(issue.offset+issue.length,end);try{r.setStart(segment.node,from-start);r.setEnd(segment.node,to-start);list.push(r);texflowSpellIssueRanges.push({blockId:id,issue,range:r,from,to});}catch{}}}}if(list.length){CSS.highlights.set(TEXFLOW_SPELL_HIGHLIGHT,new Highlight(...list));}}
function texflowUpdateLanguageMenu(){const a=document.getElementById('spell-language-automatic'),b=document.getElementById('spell-language-english'),c=document.getElementById('spell-language-spanish'),t=document.getElementById('spell-check-toggle');if(a)a.textContent=(texflowSpellState.language==='auto'?'✓ ':'')+'Automatic';if(b)b.textContent=(texflowSpellState.language==='en'?'✓ ':'')+'English';if(c)c.textContent=(texflowSpellState.language==='es'?'✓ ':'')+'Español';if(t)t.textContent='Spell checking '+(texflowSpellState.enabled?'on':'off');}
function texflowResolveSpellLanguage(){const docLang=String(documentSettings&&documentSettings.language||'').toLowerCase().replace(/_/g,'-');if(texflowSpellState.language==='en'||texflowSpellState.language==='es')return texflowSpellState.language;if(/^(spanish|es|es-es|es-mx|es-ar|es-cl|es-co|es-pe|es-419)$/.test(docLang))return'es';if(/^(english|american|british|en|en-us|en-gb|en-au|en-ca|en-nz)$/.test(docLang))return'en';return'en';}
function texflowCollectSpellBlocks(){const editors=[...document.querySelectorAll('[contenteditable="true"]')].filter(el=>!el.closest('.math-code,.structured-source,.tex-footnote,.tex-link,.tex-reference,.bib-citation,.tex-index,.tex-nomenclature,.tex-field,.tex-hspace,.doc-table-cell[contenteditable="true"] textarea, input, textarea'));return editors.map((el,i)=>{const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode(node){const p=node.parentElement;if(!p)return NodeFilter.FILTER_REJECT;if(p.closest('[contenteditable="false"],.math-caret-anchor,.display-math,.inline-math,.tex-footnote,.tex-link,.tex-reference,.bib-citation,.tex-index,.tex-nomenclature,.tex-field,.tex-hspace,.texflow-label-badge'))return NodeFilter.FILTER_REJECT;return node.nodeValue&&node.nodeValue.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});const segments=[];let text='';let n;while((n=walker.nextNode())){const start=text.length;const value=n.nodeValue||'';text+=value;segments.push({node:n,start,end:text.length});}el.__texflowSpellRanges=segments;const id=el.dataset.spellBlockId||el.dataset.nodeId||('block-'+i);el.dataset.spellBlockId=id;return{id,text};}).filter(block=>block.text.trim().length);}
function texflowRequestSpellcheck(){if(!texflowSpellState.enabled){texflowClearSpellHighlights();return;}if(!texflowSpellState.supported){texflowClearSpellHighlights();return;}const blocks=texflowCollectSpellBlocks();const requestId=String(++texflowSpellState.requestSeq);texflowSpellState.pendingRequestId=requestId;vscode.postMessage({type:'spellcheckRequest',requestId,language:texflowResolveSpellLanguage(),blocks});}
function texflowScheduleSpellcheck(){if(texflowSpellState.requestTimer)clearTimeout(texflowSpellState.requestTimer);texflowSpellState.requestTimer=setTimeout(texflowRequestSpellcheck,500);}
function texflowIssueAtPoint(x,y){for(let i=texflowSpellIssueRanges.length-1;i>=0;i--){const item=texflowSpellIssueRanges[i];for(const rect of item.range.getClientRects()){if(x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom)return item;}}return null;}
function texflowApplySuggestion(blockId,issue,replacement){texflowCollectSpellBlocks();const editable=document.querySelector('[data-spell-block-id="'+CSS.escape(blockId)+'"]');if(!editable)return false;const from=issue.offset,to=issue.offset+issue.length,segments=editable.__texflowSpellRanges||[],seg=segments.find(s=>from>=s.start&&to<=s.end);if(!seg)return false;const textNode=seg.node,current=textNode.nodeValue||'',localFrom=from-seg.start,localTo=to-seg.start;if(current.slice(localFrom,localTo)!==issue.text)return false;textNode.nodeValue=current.slice(0,localFrom)+replacement+current.slice(localTo);const latex=editableLatex(editable);if(typeof editable.__texflowCommit==='function')editable.__texflowCommit(latex);else{editable.dispatchEvent(new InputEvent('input',{bubbles:true,cancelable:true,inputType:'insertReplacementText',data:replacement}));if(typeof editable.__texflowSaveNow==='function')editable.__texflowSaveNow();}texflowScheduleSpellcheck();return true;}
document.addEventListener('input',e=>{if(e.target&&e.target.closest&&e.target.closest('[contenteditable="true"]'))texflowScheduleSpellcheck();});
document.addEventListener('contextmenu',e=>{const target=e.target&&e.target.closest?e.target.closest('[contenteditable="true"]'):null;if(!target||!texflowSpellState.enabled)return;const hit=texflowIssueAtPoint(e.clientX,e.clientY);if(!hit)return;const sugg=(hit.issue.suggestions||[]).slice(0,5);e.preventDefault();e.stopPropagation();texflowShowSpellMenu(e.clientX,e.clientY,sugg,item=>texflowApplySuggestion(hit.blockId,hit.issue,item));},{capture:true});if(texflowSpellState.requestTimer)clearTimeout(texflowSpellState.requestTimer);
function texflowShowSpellMenu(x,y,items,apply){texflowSpellMenu.innerHTML='';if(!items.length){const b=document.createElement('button');b.textContent='Close';b.onclick=()=>texflowSpellMenu.style.display='none';texflowSpellMenu.appendChild(b);}else{items.forEach(item=>{const b=document.createElement('button');b.textContent=item;b.style.cssText='display:block;width:100%;text-align:left;padding:7px 9px;border:0;background:transparent;color:inherit;border-radius:5px;cursor:pointer;font:inherit;';b.onmouseenter=()=>b.style.background='var(--vscode-list-hoverBackground,var(--hover))';b.onmouseleave=()=>b.style.background='transparent';b.onclick=()=>{texflowSpellMenu.style.display='none';apply(item);};texflowSpellMenu.appendChild(b);});const close=document.createElement('button');close.textContent='Close';close.style.cssText='display:block;width:100%;margin-top:4px;text-align:left;padding:7px 9px;border:0;background:transparent;color:inherit;border-radius:5px;cursor:pointer;font:inherit;';close.onclick=()=>texflowSpellMenu.style.display='none';texflowSpellMenu.appendChild(close);}texflowSpellMenu.style.left=Math.max(8,Math.min(window.innerWidth-260,x))+'px';texflowSpellMenu.style.top=Math.max(8,Math.min(window.innerHeight-180,y))+'px';texflowSpellMenu.style.display='block';}
window.addEventListener('message',e=>{if(e.data.type==='spellcheckResult'){if(String(e.data.requestId||'')!==String(texflowSpellState.pendingRequestId||''))return;if(!texflowSpellState.supported)return;texflowApplySpellHighlights(e.data.issuesById||{});return;}if(e.data.type==='compileStarted'){pdfBuildState='building';pdfBuildMessage='Compiling…';viewMode='pdf';renderWorkspace();return;}if(e.data.type==='compileFinished'){pdfBuildState='ready';pdfBuildMessage='PDF compiled and opened in the VS Code PDF viewer.';viewMode='pdf';renderWorkspace();return;}if(e.data.type==='compileFailed'){pdfBuildState='error';pdfBuildMessage=e.data.message||'Compilation failed.';viewMode='pdf';renderWorkspace();return;}if(e.data.type==='saveStatus'){const el=document.getElementById('save-status');el.textContent=e.data.state==='saving'?'Saving…':e.data.state==='error'?'Save error':(e.data.message||'Saved');el.classList.toggle('error',e.data.state==='error');if(e.data.state==='saved'){clearTimeout(window.__texflowStatusTimer);window.__texflowStatusTimer=setTimeout(()=>{el.textContent='Saved';},1600);}return;}if(e.data.type==='document'){frames=e.data.frames;isBeamer=!!e.data.isBeamer;documentClass=e.data.documentClass||'';documentSource=e.data.documentSource||'';metadata=e.data.metadata||{};documentSettings=e.data.documentSettings||documentSettings||{};presentationStyle=e.data.presentationStyle||presentationStyle;applyPresentationStyle();preambles=e.data.preambles||[];sources=e.data.sources||[];rootUri=e.data.rootUri||'';pdfUri=e.data.pdfUri||'';figureResources=e.data.figureResources||{};bibliographyEntries=e.data.bibliographyEntries||[];bibliographyResources=e.data.bibliographyResources||[];bibliographyByKey={};bibliographyEntries.forEach(x=>bibliographyByKey[x.key]=x);if(e.data.spellCheckSettings){texflowSpellState.enabled=!!e.data.spellCheckSettings.enabled;texflowSpellState.language=e.data.spellCheckSettings.language||'auto';}if(Number.isInteger(e.data.selectedFrame))current=Math.max(0,Math.min(e.data.selectedFrame,frames.length-1));if(!preambles.some(x=>x.id===currentPreamble)&&preambles[0])currentPreamble=preambles[0].id;document.querySelectorAll('.beamer-only').forEach(x=>x.classList.toggle('hidden',!isBeamer));document.querySelectorAll('.document-only').forEach(x=>x.classList.toggle('hidden',isBeamer));updateDocumentViewMenu();renderTopMenus();texflowUpdateLanguageMenu();renderNav();if(mode==='preamble')renderPreamble(currentPreamble);else renderWorkspace();if(e.data.focusFrameTitle){requestAnimationFrame(()=>{const t=document.querySelector('.workspace .slide .title[contenteditable=true]');if(t){t.focus();const r=document.createRange();r.selectNodeContents(t);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);}});}if(e.data.focusNewMath){requestAnimationFrame(()=>{const f=frames[current];if(!f)return;const maths=parseBlocks(f.body).filter(b=>b.kind==='equation');const b=maths[maths.length-1];if(b)openMathEditor(b,current);});}if(Number.isFinite(e.data.focusDocumentHeadingStart)){requestAnimationFrame(()=>{const t=document.querySelector('.doc-heading[data-node-start="'+String(e.data.focusDocumentHeadingStart)+'"]');if(t){t.focus();const r=document.createRange();r.selectNodeContents(t);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);}});}texflowScheduleSpellcheck();}});
function esc(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
let activeEditable=null;const saveTimers=new WeakMap();function scheduleSave(el,send){const old=saveTimers.get(el);if(old)clearTimeout(old);document.getElementById('save-status').textContent='Editing…';saveTimers.set(el,setTimeout(()=>send(false),500));}function flushSave(el,send){const old=saveTimers.get(el);if(old)clearTimeout(old);send(true);}
function markdownToLatex(text){
 let x=String(text??'').replace(/\u200B/g,'');
 x=x.replace(/\*\*([^*\n]+)\*\*/g,'\\textbf{$1}');
 x=x.replace(/(^|[^*])\*([^*\n]+)\*/g,'$1\\textit{$2}');
 x=x.replace(/==([^=\n]+)==/g,'\\alert{$1}');
 return x;
}
window.addEventListener('message',e=>{if(e.data.type==='bibliographyUpdated'){bibliographyEntries=e.data.bibliographyEntries||[];bibliographyResources=e.data.bibliographyResources||[];if(typeof e.data.documentSource==='string')documentSource=e.data.documentSource;bibliographyByKey={};bibliographyEntries.forEach(x=>bibliographyByKey[x.key]=x);if(mode!=='preamble')renderWorkspace();}if(e.data.type==='bibliographyReady'&&e.data.openPicker)openCitationPicker();});
window.addEventListener('message',e=>{if(e.data.type==='figureFileChosen')openFigureEditor(e.data);if(e.data.type==='subfiguresChosen')openLabsSubfigures(e.data);if(e.data.type==='tableDataFileChosen'){const field=document.querySelector('#labs-dynamic-modal [data-labs-field="data"]');if(field){field.value=String(e.data.text||'');field.dispatchEvent(new Event('input',{bubbles:true}));field.focus();}}});
function bibPlain(value){return String(value||'').replace(/[{}]/g,'').replace(/\\[A-Za-z]+\s*/g,'').trim();}
function bibAuthorLabel(entry){const raw=bibPlain(entry&&entry.fields&&(entry.fields.author||entry.fields.editor)||'');if(!raw)return entry?entry.key:'?';const first=raw.split(/\s+and\s+/i)[0].trim();const parts=first.split(',');if(parts.length>1)return parts[0].trim();const words=first.split(/\s+/).filter(Boolean);return words[words.length-1]||first;}
function citationLabel(keys,command){const vals=String(keys||'').split(',').map(x=>x.trim()).filter(Boolean).map(key=>{const e=bibliographyByKey[key];if(!e)return{key,label:'?'+key,missing:true};const author=bibAuthorLabel(e),year=bibPlain(e.fields.year||e.fields.date||'n.d.');return{key,label:author+(year?' '+year:''),missing:false};});const missing=vals.some(x=>x.missing),core=vals.map(x=>x.label).join('; ');if(command==='textcite'||command==='citet'){const one=vals.length===1?vals[0]:null;return{html:one?(esc(bibAuthorLabel(bibliographyByKey[one.key]))+' ('+esc(bibPlain((bibliographyByKey[one.key]||{fields:{}}).fields.year||'n.d.'))+')'):esc(core),missing};}if(command==='cite')return{html:'['+esc(core)+']',missing};if(command==='citep')return{html:'('+esc(core)+')',missing};return{html:'('+esc(core)+')',missing};}
function bibliographyEntryHtml(entry){const f=entry.fields||{},author=bibPlain(f.author||f.editor||''),year=bibPlain(f.year||f.date||''),title=bibPlain(f.title||entry.key),where=bibPlain(f.journal||f.booktitle||f.publisher||f.institution||f.url||'');return '<div class="bib-entry"><span>'+esc(author)+(year?' ('+esc(year)+').':'')+' <em>'+esc(title)+'</em>'+(where?' — '+esc(where):'')+'.</span><span class="bib-entry-key">'+esc(entry.key)+'</span></div>';}
function citedBibliographyEntries(){const src=String(documentSource||'');if(/\\nocite\{\*\}/.test(src))return bibliographyEntries;const keys=[],seen=new Set();let m;const re=/\\(?:parencite|textcite|autocite|citep|citet|cite|nocite)\s*(?:\[[^\]]*\]\s*)*\{([^}]+)\}/g;while((m=re.exec(src)))String(m[1]||'').split(',').map(x=>x.trim()).filter(Boolean).forEach(k=>{if(k!=='*'&&!seen.has(k)){seen.add(k);keys.push(k);}});return keys.map(k=>bibliographyByKey[k]).filter(Boolean);}
function bibliographyHtml(nodeId=''){const id=nodeId?' id="'+esc(nodeId)+'"':'';const entries=citedBibliographyEntries();if(!bibliographyEntries.length)return '<section'+id+' class="doc-bibliography"><h2>Bibliography</h2><div class="cite-empty">No bibliography entries loaded. Open the connected .bib file in VS Code to add references.</div></section>';if(!entries.length)return '<section'+id+' class="doc-bibliography"><h2>Bibliography</h2><div class="cite-empty">No cited references yet. The compiled bibliography will update as citations are added.</div></section>';return '<section'+id+' class="doc-bibliography"><h2>Bibliography</h2><div class="cite-empty" style="padding:0 0 8px;text-align:left">'+entries.length+' cited reference'+(entries.length===1?'':'s')+' · preview</div>'+entries.map(bibliographyEntryHtml).join('')+'</section>';}
function refreshBibliographyPreviews(){document.querySelectorAll('.doc-bibliography:not(.doc-bibliography-pending)').forEach(section=>{const tmp=document.createElement('div');tmp.innerHTML=bibliographyHtml(section.id||'');const fresh=tmp.firstElementChild;if(fresh)section.innerHTML=fresh.innerHTML;});}

function latexToHtml(text){
 let source=String(text??'');
 const inlineMath=[],displayMath=[],citations=[],references=[],hspaces=[],footnotes=[],links=[],indexes=[],fields=[],nomenclatures=[];
 source=source.replace(/\\footnote\{([^{}]*)\}/g,(_,text)=>{const i=footnotes.push({text})-1;return '@@TEXFLOW_FOOTNOTE_'+i+'@@';});
 source=source.replace(/\\href\{([^{}]*)\}\{([^{}]*)\}/g,(_,url,label)=>{const i=links.push({url,label,kind:'href'})-1;return '@@TEXFLOW_LINK_'+i+'@@';});
 source=source.replace(/\\url\{([^{}]*)\}/g,(_,url)=>{const i=links.push({url,label:url,kind:'url'})-1;return '@@TEXFLOW_LINK_'+i+'@@';});
 source=source.replace(/\\index\{([^{}]*)\}/g,(_,text)=>{const i=indexes.push(text)-1;return '@@TEXFLOW_INDEX_'+i+'@@';});
 source=source.replace(/\\nomenclature\{([^{}]*)\}\{([^{}]*)\}/g,(_,symbol,description)=>{const i=nomenclatures.push({symbol,description})-1;return '@@TEXFLOW_NOMENCLATURE_'+i+'@@';});
 source=source.replace(/\\(?:today|jobname)\b/g,m=>{const i=fields.push(m.slice(1))-1;return '@@TEXFLOW_FIELD_'+i+'@@';});
 source=source.replace(/\\hspace(\*)?\{([^}]+)\}/g,(_,star,amount)=>{const i=hspaces.push({star:!!star,amount})-1;return '@@TEXFLOW_HSPACE_'+i+'@@';});
 source=source.replace(/\\(eqref|ref|autoref|pageref)\{([^}]+)\}/g,(_,cmd,key)=>{const i=references.push({cmd,key})-1;return '@@TEXFLOW_REFERENCE_'+i+'@@';});
 source=source.replace(/\\(parencite|textcite|autocite|citep|citet|cite)\{([^}]+)\}/g,(_,cmd,keys)=>{const i=citations.push({cmd,keys})-1;return '@@TEXFLOW_CITATION_'+i+'@@';});
 source=source.replace(/\\printbibliography(?:\[[^\]]*\])?/g,'@@TEXFLOW_PRINT_BIB@@');
 source=source.replace(/\\\[([\s\S]*?)\\\]/g,(_,expr)=>{const i=displayMath.push(expr)-1;return '@@TEXFLOW_DISPLAY_MATH_'+i+'@@';});
 source=source.replace(/\$([^$\n]+)\$/g,(_,expr)=>{const i=inlineMath.push(expr)-1;return '@@TEXFLOW_INLINE_MATH_'+i+'@@';});
 source=source.replace(/\\\(([\s\S]*?)\\\)/g,(_,expr)=>{const i=inlineMath.push(expr)-1;return '@@TEXFLOW_INLINE_MATH_'+i+'@@';});
 source=source.replace(/\\today\b/g,()=>new Intl.DateTimeFormat(undefined,{day:'numeric',month:'long',year:'numeric'}).format(new Date()));
 let x=esc(source);
 x=x.replace(/\\\\(?:[ \t]*\n)?/g,'<br>');
 let prev='';
 for(let i=0;i<6&&x!==prev;i++){
  prev=x;
  x=x.replace(/\\textbf\{([^{}]*)\}/g,'<strong>$1</strong>')
     .replace(/\\(?:textit|emph)\{([^{}]*)\}/g,'<em>$1</em>')
     .replace(/\\texttt\{([^{}]*)\}/g,'<code class="doc-code">$1</code>')
     .replace(/\\underline\{([^{}]*)\}/g,'<span class="inline-underline" data-tex-command="underline">$1</span>')
     .replace(/\\textcolor\{([A-Za-z][A-Za-z0-9_-]*)\}\{([^{}]*)\}/g,'<span class="inline-color" data-tex-command="textcolor" data-tex-color="$1">$2</span>')
     .replace(/\\key\{([^{}]*)\}/g,'<span class="inline-key" data-tex-command="key">$1</span>')
     .replace(/\\alert\{([^{}]*)\}/g,'<span class="inline-alert" data-tex-command="alert">$1</span>');
 }
 x=x.replace(/@@TEXFLOW_FOOTNOTE_(\d+)@@/g,(_,idx)=>{const f=footnotes[Number(idx)]||{text:''};return '<span class="tex-footnote" contenteditable="false" data-footnote="'+encodeURIComponent(f.text)+'" title="'+esc(f.text)+'">'+esc((f.text||'footnote').slice(0,36))+'</span><span class="math-caret-anchor">&#8203;</span>';});
 x=x.replace(/@@TEXFLOW_LINK_(\d+)@@/g,(_,idx)=>{const l=links[Number(idx)]||{url:'',label:'',kind:'url'};return '<span class="tex-link" contenteditable="false" data-link-kind="'+esc(l.kind)+'" data-link-url="'+encodeURIComponent(l.url)+'" data-link-label="'+encodeURIComponent(l.label)+'">'+esc(l.label||l.url)+'</span><span class="math-caret-anchor">&#8203;</span>';});
 x=x.replace(/@@TEXFLOW_INDEX_(\d+)@@/g,(_,idx)=>'<span class="tex-index" contenteditable="false" data-index="'+encodeURIComponent(indexes[Number(idx)]||'')+'">'+esc(indexes[Number(idx)]||'index')+'</span><span class="math-caret-anchor">&#8203;</span>');
 x=x.replace(/@@TEXFLOW_NOMENCLATURE_(\d+)@@/g,(_,idx)=>{const n=nomenclatures[Number(idx)]||{symbol:'',description:''};return '<span class="tex-nomenclature" contenteditable="false" data-symbol="'+encodeURIComponent(n.symbol)+'" data-description="'+encodeURIComponent(n.description)+'">'+esc(n.symbol)+'</span><span class="math-caret-anchor">&#8203;</span>';});
 x=x.replace(/@@TEXFLOW_FIELD_(\d+)@@/g,(_,idx)=>{const f=fields[Number(idx)]||'today';const display=f==='today'?new Intl.DateTimeFormat(undefined,{day:'numeric',month:'long',year:'numeric'}).format(new Date()):f;return '<span class="tex-field" contenteditable="false" data-field="'+esc(f)+'">'+esc(display)+'</span><span class="math-caret-anchor">&#8203;</span>';});
 x=x.replace(/@@TEXFLOW_HSPACE_(\d+)@@/g,(_,idx)=>{const h=hspaces[Number(idx)]||{amount:'',star:false};return '<span class="tex-hspace" contenteditable="false" data-space-amount="'+esc(h.amount)+'" data-space-starred="'+(h.star?'true':'false')+'">↔ '+esc(h.amount)+'</span><span class="math-caret-anchor">&#8203;</span>';});
 x=x.replace(/@@TEXFLOW_DISPLAY_MATH_(\d+)@@/g,(_,idx)=>'<span class="display-math" contenteditable="false" data-math="'+encodeURIComponent(displayMath[Number(idx)]||'')+'"></span><span class="math-caret-anchor">&#8203;</span>');
 x=x.replace(/@@TEXFLOW_INLINE_MATH_(\d+)@@/g,(_,idx)=>'<span class="inline-math" contenteditable="false" data-math="'+encodeURIComponent(inlineMath[Number(idx)]||'')+'"></span><span class="math-caret-anchor">&#8203;</span>');
 x=x.replace(/@@TEXFLOW_REFERENCE_(\d+)@@/g,(_,idx)=>{const r=references[Number(idx)]||{cmd:'ref',key:''},known=documentLabels.some(x=>x.key===r.key)||String(documentSource||'').includes('\\label{'+r.key+'}'),num=documentRefs[r.key],display=r.cmd==='eqref'&&num?'('+num+')':r.key;return '<span class="tex-reference'+(known?'':' missing')+'" contenteditable="false" data-ref-command="'+esc(r.cmd)+'" data-ref-key="'+esc(r.key)+'"><span class="tex-reference-kind">'+esc(r.cmd)+'</span><span class="tex-reference-key">'+esc(display)+'</span></span><span class="math-caret-anchor">&#8203;</span>';});
 x=x.replace(/@@TEXFLOW_CITATION_(\d+)@@/g,(_,idx)=>{const c=citations[Number(idx)]||{cmd:'cite',keys:''},v=citationLabel(c.keys,c.cmd);return '<span class="bib-citation'+(v.missing?' missing':'')+'" contenteditable="false" data-cite-command="'+esc(c.cmd)+'" data-cite-keys="'+esc(c.keys)+'">'+v.html+'<span class="bib-citation-key">'+esc(c.keys)+'</span></span><span class="math-caret-anchor">&#8203;</span>';});
 x=x.replace(/@@TEXFLOW_PRINT_BIB@@/g,'<span class="bib-print-placeholder" contenteditable="false">References — rendered from the loaded .bib file. See PDF for final bibliography formatting.</span>');
 return x;
}
function renderInlineMaths(root){
 if(!root)return;
 root.querySelectorAll('.inline-color').forEach(node=>{const color=String(node.dataset.texColor||'');if(/^[A-Za-z][A-Za-z0-9_-]*$/.test(color))node.style.color=color;});
 root.querySelectorAll('.inline-math,.display-math').forEach(node=>{
  const tex=decodeURIComponent(node.dataset.math||''),display=node.classList.contains('display-math');
  node.title=(display?'Display':'Inline')+' math: '+tex.trim();
  try{katex.render(tex.trim(),node,{displayMode:display,throwOnError:false})}catch{node.textContent=display?'\\['+tex+'\\]':'$'+tex+'$'}
 });
}
const TEX_LINE_BREAK=String.fromCharCode(92,92,10);
const TEX_PARAGRAPH_BREAK='\n\n';
function nodeToLatex(node){
 if(node.nodeType===Node.TEXT_NODE)return markdownToLatex((node.nodeValue||'').replace(/\u200B/g,''));
 if(node.nodeType!==Node.ELEMENT_NODE)return '';
 const el=node,inner=[...el.childNodes].map(nodeToLatex).join('');
 if(el.tagName==='STRONG'||el.tagName==='B')return '\\textbf{'+inner+'}';
 if(el.tagName==='EM'||el.tagName==='I')return '\\textit{'+inner+'}';
 if(el.dataset&&el.dataset.texCommand==='key')return '\\key{'+inner+'}';
 if(el.dataset&&el.dataset.texCommand==='alert')return '\\alert{'+inner+'}';
 if(el.dataset&&el.dataset.texCommand==='underline')return '\\underline{'+inner+'}';
 if(el.dataset&&el.dataset.texCommand==='textcolor')return '\\textcolor{'+(el.dataset.texColor||'black')+'}{'+inner+'}';
 if(el.classList&&el.classList.contains('display-math'))return '\\['+decodeURIComponent(el.dataset.math||'')+'\\]';
 if(el.classList&&el.classList.contains('inline-math'))return '$'+decodeURIComponent(el.dataset.math||'')+'$';
 if(el.classList&&el.classList.contains('bib-citation'))return '\\'+(el.dataset.citeCommand||'cite')+'{'+(el.dataset.citeKeys||'')+'}';
 if(el.classList&&el.classList.contains('tex-reference'))return '\\'+(el.dataset.refCommand||'ref')+'{'+(el.dataset.refKey||'')+'}';
 if(el.classList&&el.classList.contains('tex-hspace'))return '\\hspace'+(el.dataset.spaceStarred==='true'?'*':'')+'{'+(el.dataset.spaceAmount||'')+'}';
 if(el.classList&&el.classList.contains('tex-footnote'))return '\\footnote{'+decodeURIComponent(el.dataset.footnote||'')+'}';
 if(el.classList&&el.classList.contains('tex-link')){const kind=el.dataset.linkKind||'url',url=decodeURIComponent(el.dataset.linkUrl||''),label=decodeURIComponent(el.dataset.linkLabel||'');return kind==='href'?'\\href{'+url+'}{'+label+'}':'\\url{'+url+'}';}
 if(el.classList&&el.classList.contains('tex-index'))return '\\index{'+decodeURIComponent(el.dataset.index||'')+'}';
 if(el.classList&&el.classList.contains('tex-nomenclature'))return '\\nomenclature{'+decodeURIComponent(el.dataset.symbol||'')+'}{'+decodeURIComponent(el.dataset.description||'')+'}';
 if(el.classList&&el.classList.contains('tex-field'))return '\\'+(el.dataset.field||'today');
 if(el.classList&&el.classList.contains('bib-print-placeholder'))return '\\printbibliography';
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
function visualCaretWhitespaceState(el){
 const sel=getSelection();if(!sel||!sel.rangeCount||!sel.isCollapsed||!el.contains(sel.anchorNode))return null;
 const r=sel.getRangeAt(0),before=document.createRange(),after=document.createRange();
 try{before.selectNodeContents(el);before.setEnd(r.startContainer,r.startOffset);after.selectNodeContents(el);after.setStart(r.endContainer,r.endOffset);}catch{return null;}
 return{before:before.toString(),after:after.toString()};
}
function attachEditor(el){
 renderInlineMaths(el);
 el.addEventListener('focus',()=>activeEditable=el);
 // Visual prose uses semantic whitespace: pressing Space beside an existing
 // whitespace boundary is a no-op, just like repeated Enter on an empty paragraph.
 // This prevents invisible source churn without rewriting whitespace already in .tex.
 el.addEventListener('beforeinput',e=>{
  if(e.inputType!=='insertText'||e.data!==' ')return;
  const state=visualCaretWhitespaceState(el);if(!state)return;
  if(/[ \t\r\n\u00a0]$/.test(state.before)||/^[ \t\r\n\u00a0]/.test(state.after))e.preventDefault();
 });
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
function listIndentOutdent(edit,rootList,outdent=false){
 const li=edit&&edit.closest&&edit.closest('li');if(!li||!rootList.contains(li))return false;
 const parentList=li.parentElement;if(!parentList)return false;
 if(outdent){
  const parentLi=parentList.closest('li');if(!parentLi)return false;
  parentLi.after(li);if(!parentList.children.length)parentList.remove();placeCaretEnd(edit);return true;
 }
 const prev=li.previousElementSibling;if(!prev)return false;
 let child=prev.querySelector(':scope > ul, :scope > ol');
 if(!child){child=document.createElement(parentList.tagName.toLowerCase());prev.appendChild(child);}
 child.appendChild(li);placeCaretEnd(edit);return true;
}
function bindListEditing(list,save){
 list.addEventListener('input',()=>scheduleSave(list,save));
 list.addEventListener('focusout',e=>{if(!list.contains(e.relatedTarget))flushSave(list,save)});
 list.addEventListener('keydown',e=>{
  const text=e.target.closest&&e.target.closest('.item-text');if(!text||!list.contains(text))return;
  const li=text.closest('li');
  if(e.key==='Tab'){
   e.preventDefault();if(listIndentOutdent(text,list,e.shiftKey))scheduleSave(list,save);return;
  }
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
function formattingSelection(){
 const sel=getSelection();
 if(activeEditable&&sel&&sel.rangeCount>0){const live=sel.getRangeAt(0);if(activeEditable.contains(live.commonAncestorContainer))return {sel,range:live};}
 const ctx=lastVisualCursor;if(!ctx||!ctx.editable||!ctx.editable.isConnected||!ctx.range)return null;
 const range=ctx.range.cloneRange();if(!ctx.editable.contains(range.commonAncestorContainer))return null;
 activeEditable=ctx.editable;const current=getSelection();if(!current)return null;
 current.removeAllRanges();current.addRange(range);return {sel:current,range};
}
function inlineFormatKind(el){
 if(!el||el.nodeType!==Node.ELEMENT_NODE)return '';
 if(el.tagName==='STRONG'||el.tagName==='B')return 'bold';
 if(el.tagName==='EM'||el.tagName==='I')return 'italic';
 if(el.dataset&&el.dataset.texCommand==='underline')return 'underline';
 if(el.dataset&&el.dataset.texCommand==='key')return 'key';
 if(el.dataset&&el.dataset.texCommand==='alert')return 'alert';
 if(el.dataset&&el.dataset.texCommand==='textcolor')return 'textcolor';
 return '';
}
function makeInlineFormatWrapper(command,color=''){
 let wrapper;
 if(command==='bold')wrapper=document.createElement('strong');
 else if(command==='italic')wrapper=document.createElement('em');
 else if(command==='underline'){wrapper=document.createElement('span');wrapper.dataset.texCommand='underline';wrapper.className='inline-underline';}
 else if(command==='textcolor'){wrapper=document.createElement('span');wrapper.dataset.texCommand='textcolor';wrapper.dataset.texColor=color;wrapper.className='inline-color';wrapper.style.color=color;}
 else{wrapper=document.createElement('span');wrapper.dataset.texCommand=command;wrapper.className=command==='key'?'inline-key':'inline-alert';}
 return wrapper;
}
function closestFormatWrapper(node,command,color=''){
 let el=node&&node.nodeType===Node.ELEMENT_NODE?node:node&&node.parentElement;
 while(el&&el!==activeEditable){
  if(inlineFormatKind(el)===command&&(command!=='textcolor'||String(el.dataset.texColor||'')===String(color||'')))return el;
  el=el.parentElement;
 }
 return null;
}
function markRange(range){
 const start=document.createComment('tf-format-start'),end=document.createComment('tf-format-end');
 const r2=range.cloneRange();r2.collapse(false);r2.insertNode(end);
 const r1=range.cloneRange();r1.collapse(true);r1.insertNode(start);
 return{start,end};
}
function restoreMarkedRange(markers,collapseToEnd=false){
 const r=document.createRange();r.setStartAfter(markers.start);r.setEndBefore(markers.end);if(collapseToEnd)r.collapse(false);
 const sel=getSelection();sel.removeAllRanges();sel.addRange(r);markers.start.remove();markers.end.remove();return r;
}
function unwrapElement(el){const parent=el&&el.parentNode;if(!parent)return;while(el.firstChild)parent.insertBefore(el.firstChild,el);parent.removeChild(el);parent.normalize();}
function selectionExistingFormat(range,command,color=''){const a=closestFormatWrapper(range.startContainer,command,color);if(range.collapsed)return a;const b=closestFormatWrapper(range.endContainer,command,color);return a&&a===b?a:null;}
function fragmentHasContent(f){return !!(f&&f.childNodes&&f.childNodes.length);}
function toggleOffFormatRange(range,wrapper){if(!wrapper||!wrapper.parentNode)return null;const beforeRange=document.createRange(),afterRange=document.createRange();beforeRange.selectNodeContents(wrapper);beforeRange.setEnd(range.startContainer,range.startOffset);afterRange.selectNodeContents(wrapper);afterRange.setStart(range.endContainer,range.endOffset);const before=beforeRange.cloneContents(),selected=range.collapsed?document.createDocumentFragment():range.cloneContents(),after=afterRange.cloneContents(),frag=document.createDocumentFragment();if(fragmentHasContent(before)){const w=wrapper.cloneNode(false);w.appendChild(before);frag.appendChild(w);}const start=document.createComment('tf-unformat-start'),end=document.createComment('tf-unformat-end');frag.appendChild(start);if(range.collapsed){const marker=document.createTextNode('\u200B');frag.appendChild(marker);}else frag.appendChild(selected);frag.appendChild(end);if(fragmentHasContent(after)){const w=wrapper.cloneNode(false);w.appendChild(after);frag.appendChild(w);}wrapper.parentNode.replaceChild(frag,wrapper);const r=document.createRange();if(range.collapsed){const marker=start.nextSibling;r.setStart(marker,marker&&marker.nodeType===Node.TEXT_NODE?marker.nodeValue.length:0);r.collapse(true);}else{r.setStartAfter(start);r.setEndBefore(end);}const sel=getSelection();sel.removeAllRanges();sel.addRange(r);start.remove();end.remove();return r;}
function commitInlineFormatting(el){
 if(!el)return;const old=saveTimers.get(el);if(old)clearTimeout(old);
 // One formatting action is one semantic transaction. Commit immediately so
 // consecutive Bold/Italic/Underline operations queue against the updated local
 // snapshot instead of racing blur or the 500 ms prose autosave.
 if(typeof el.__texflowSaveNow==='function')el.__texflowSaveNow();else el.dispatchEvent(new Event('input',{bubbles:true}));
 rememberVisualCursor();
}
function toggleSelectionFormat(command,color=''){
 const target=formattingSelection();if(!target||!activeEditable)return;const {sel,range}=target;
 const existing=selectionExistingFormat(range,command,color);
 if(existing){toggleOffFormatRange(range,existing);activeEditable.focus();commitInlineFormatting(activeEditable);return;}
 const wrapper=makeInlineFormatWrapper(command,color);
 if(range.collapsed){
  // A zero-width marker keeps the typing caret inside the chosen character style;
  // nodeToLatex strips it, so an unused style never reaches the .tex source.
  const marker=document.createTextNode('\u200B');wrapper.appendChild(marker);range.insertNode(wrapper);const r=document.createRange();r.setStart(marker,1);r.collapse(true);sel.removeAllRanges();sel.addRange(r);
 }else{
  try{range.surroundContents(wrapper)}catch{wrapper.appendChild(range.extractContents());range.insertNode(wrapper)}
  // Applying a format to an existing selection should not make the next typed
  // characters inherit that format. Collapse the caret after the wrapper.
  const r=document.createRange();r.setStartAfter(wrapper);r.collapse(true);sel.removeAllRanges();sel.addRange(r);
 }
 activeEditable.focus();commitInlineFormatting(activeEditable);
}
function wrapSelection(command){toggleSelectionFormat(command);}
function wrapSelectionColor(color){const safe=String(color||'');if(!/^[A-Za-z][A-Za-z0-9_-]*$/.test(safe))return;toggleSelectionFormat('textcolor',safe);}
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
let documentRefs={},documentFlowById={},documentLabels=[];
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
 const tokenRe=/\\(chapter|section|subsection|subsubsection|paragraph)(\*)?\{([^}]*)\}|\\(tableofcontents|printbibliography|frontmatter|mainmatter|backmatter)\b|\\(bibliographystyle|bibliography)\{([^}]*)\}/g;let m;
 function pushChunk(a,b){
  let start=a;
  // A label immediately following a heading belongs to that heading structurally.
  // Keep the command in Source and let the label metadata pass below attach it,
  // but do not send it through the generic chunk parser: otherwise the label can
  // make the following ordinary paragraph look like an unknown/raw LaTeX block.
  // Consume only leading standalone labels (plus whitespace before each one), so
  // labels inside equations/figures remain inside those semantic blocks.
  const prev=out[out.length-1];
  if(prev&&prev.kind==='heading'){
   while(start<b){
    const leading=/^\s*\\label\{[^}]+\}/.exec(body.slice(start,b));
    if(!leading)break;
    start+=leading[0].length;
   }
  }
  const raw=body.slice(start,b);
  if(!raw.trim()){if(prev&&prev.kind==='heading'&&b===body.length){out.push({kind:'block',id:'doc-b'+nextId(),start:info.start+b,end:info.start+b,raw:'',synthetic:true,block:{id:'doc-empty',kind:'paragraph',start:0,end:0,raw:'',text:'',synthetic:true}});}return;}
  parseDocumentChunk(raw,info.start+start,out,nextId);
 }
 while((m=tokenRe.exec(body))){
  pushChunk(cur,m.index);
  if(m[1]){
   const command=m[1],starred=!!m[2],title=m[3]||'';
   const level=command==='chapter'?1:command==='section'?(documentClass==='article'?1:2):command==='subsection'?(documentClass==='article'?2:3):command==='subsubsection'?(documentClass==='article'?3:4):5;
   out.push({kind:'heading',id:'doc-h'+nextId(),level,title,command,starred,start:info.start+m.index,end:info.start+tokenRe.lastIndex,raw:m[0]});
  }else if(m[4]==='tableofcontents'){
   out.push({kind:'toc',id:'doc-toc'+nextId(),start:info.start+m.index,end:info.start+tokenRe.lastIndex,raw:m[0]});
  }else if(m[4]==='printbibliography'){
   out.push({kind:'bibliography',id:'doc-bib'+nextId(),start:info.start+m.index,end:info.start+tokenRe.lastIndex,raw:m[0]});
  }else if(m[5]==='bibliography'){
   out.push({kind:'bibliography',id:'doc-bib'+nextId(),start:info.start+m.index,end:info.start+tokenRe.lastIndex,raw:m[0]});
  }else if(m[5]==='bibliographystyle'){
   /* style command is metadata; preserve in Source, do not render */
  }else{
   out.push({kind:'matter',id:'doc-matter'+nextId(),matter:m[4],start:info.start+m.index,end:info.start+tokenRe.lastIndex,raw:m[0]});
  }
  cur=tokenRe.lastIndex;
 }
 pushChunk(cur,body.length);
 documentRefs={};documentFlowById={};documentLabels=[];let equationNumber=0;
 out.forEach(x=>{documentFlowById[x.id]=x;if(x.kind==='block'&&x.block&&x.block.kind==='equation'){const b=x.block;if(/^equation/.test(String(b.env||''))){equationNumber+=1;b.eqNumber=equationNumber;}}});
 const labelRe=/\\label\{([^}]+)\}/g;let lm;
 while((lm=labelRe.exec(body))){
  const key=String(lm[1]||'').trim(),abs=info.start+lm.index;if(!key)continue;let target=null;
  for(const node of out){if(Number(node.start)<=abs&&abs<Number(node.end)){if(node.kind==='block'&&node.block&&['equation','figure','table'].includes(node.block.kind))target=node;break;}}
  if(!target){for(let i=out.length-1;i>=0;i--){const node=out[i],eligible=node.kind==='heading'||(node.kind==='block'&&node.block&&['equation','figure','table'].includes(node.block.kind));if(!eligible||Number(node.end)>abs)continue;const between=documentSource.slice(Number(node.end),abs);if(/^\s*$/.test(between))target=node;break;}}
  const targetKind=target?(target.kind==='heading'?target.command:(target.block&&target.block.kind)||'block'):'unattached';
  const item={key,pos:abs,targetId:target&&target.id||'',targetKind};documentLabels.push(item);
  if(target){target.label=key;if(target.block)target.block.label=key;if(target.block&&target.block.eqNumber)documentRefs[key]=target.block.eqNumber;}
 }
 return out;
}
function renderDocumentOutline(nav){
 const title=document.createElement('div');title.className='section';title.textContent=(documentClass||'document').toUpperCase();nav.appendChild(title);
 const flow=parseDocumentFlow();let found=false,currentLevel=0;
 const scrollToNode=x=>{
  const byId=document.getElementById(x.id);
  const byData=document.querySelector('[data-node-id="'+CSS.escape(String(x.id||''))+'"]');
  const el=byId||byData;
  if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
 };
 const objectText=x=>{
  const b=x.block||{},label=String(x.label||b.label||'').trim();
  if(b.kind==='figure'){
   const caption=String(b.figureCaption||'').trim(),path=String(b.figurePath||'').trim();
   return{kind:'Figure',text:caption||label||path||'Figure'};
  }
  if(b.kind==='table'){
   const caption=String(b.tableCaption||'').trim();
   return{kind:'Table',text:caption||label||'Table'};
  }
  const n=b.eqNumber?String(b.eqNumber):'';
  return{kind:'Equation',text:label||((n?'Equation '+n:'Equation'))};
 };
 flow.forEach(x=>{
  if(x.kind==='matter'){
   currentLevel=0;
   const row=document.createElement('div');row.className='doc-outline-matter';row.textContent=x.matter==='frontmatter'?'Front matter':x.matter==='mainmatter'?'Main matter':'Back matter';nav.appendChild(row);return;
  }
  if(x.kind==='bibliography'){
   found=true;const row=document.createElement('div');row.className='doc-outline doc-outline-bibliography';row.textContent='Bibliography';row.onclick=()=>scrollToNode(x);nav.appendChild(row);return;
  }
  if(x.kind==='heading'){
   found=true;currentLevel=Number(x.level)||1;const row=document.createElement('div');row.className='doc-outline level-'+x.level;row.textContent=(x.starred?'◇ ':'')+(x.title||('Untitled '+x.command));row.onclick=()=>scrollToNode(x);nav.appendChild(row);return;
  }
  if(x.kind==='block'&&x.block&&['figure','table','equation'].includes(x.block.kind)){
   found=true;
   const info=objectText(x),depth=Math.max(1,Math.min(5,currentLevel+1)),row=document.createElement('div');
   row.className='doc-outline doc-outline-object depth-'+depth;
   const kind=document.createElement('span');kind.className='outline-kind';kind.textContent=info.kind;
   const label=document.createElement('span');label.className='outline-label';label.textContent=info.text;
   row.appendChild(kind);row.appendChild(label);row.title=(x.label||x.block.label)?String(x.label||x.block.label):info.text;
   row.onclick=()=>scrollToNode(x);nav.appendChild(row);
  }
 });
 if(bibliographyResources.length&&!flow.some(x=>x.kind==='bibliography')){const row=document.createElement('div');row.className='doc-outline doc-outline-bibliography pending';row.textContent='Bibliography (not inserted)';nav.appendChild(row);}
 if(!found){const empty=document.createElement('div');empty.className='doc-outline-empty';empty.textContent='No structure found';nav.appendChild(empty);}
}
function documentFigureHtml(node,b){
 const raw=String(b.raw||''),paths=[...raw.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)].map(m=>String(m[1]||''));
 const res=figureResources['*|'+(b.figurePath||'')]||null,width=relativeWidth(b),caption=b.figureCaption||'',shortCaption=b.figureShortCaption||'',angle=Number(b.figureAngle)||0,label=b.label||b.figureLabel||'',placement=b.figurePlacement||'',captionPosition=b.figureCaptionPosition||'below',align=b.figureAlign||b.align||'center';
 function oneMedia(path){const r=figureResources['*|'+path]||null;if(r){if(r.isPdf)return '<object data="'+esc(r.uri)+'#toolbar=0&navpanes=0" type="application/pdf"><div class="figure-placeholder">PDF figure<br>'+esc(path)+'</div></object>';return '<img src="'+esc(r.uri)+'" alt="'+esc(path)+'">';}return '<div class="figure-placeholder">Figure not found<br>'+esc(path)+'</div>';}
 let media='';if(paths.length>1){media='<div class="subfigure-grid">'+paths.map(path=>'<div class="subfigure-item">'+oneMedia(path)+'<div class="subfigure-name">'+esc(path)+'</div></div>').join('')+'</div>';}else if(paths.length===1)media=oneMedia(paths[0]);else if(res){media=res.isPdf?'<object data="'+esc(res.uri)+'#toolbar=0&navpanes=0" type="application/pdf"><div class="figure-placeholder">PDF figure<br>'+esc(b.figurePath||'')+'</div></object>':'<img src="'+esc(res.uri)+'" alt="'+esc(b.figurePath||'')+'">';}else media='<div class="figure-placeholder">Figure not found<br>'+esc(b.figurePath||'')+'</div>';
 const isFloat=String(b.env||'')==='figure',group=paths.length>1;
 return '<div class="doc-figure figure figure-card" data-node-id="'+node.id+'">'+
  '<div class="figure-head"><span class="tag">'+(group?'Subfigures':'Figure')+'</span><span class="figure-name">'+esc(group?(paths.length+' images'):(b.figurePath||'image'))+'</span><div class="figure-controls">'+
  '<label>W <input class="figure-width-input" type="number" min="5" max="100" step="1" value="'+Math.round(width)+'">%</label><label>Rotate <input class="figure-angle-input" type="number" min="-360" max="360" step="1" value="'+angle+'">°</label>'+
  (isFloat?'<label>Align <select class="figure-align-input"><option value="left"'+(align==='left'?' selected':'')+'>Left</option><option value="center"'+(align==='center'?' selected':'')+'>Center</option><option value="right"'+(align==='right'?' selected':'')+'>Right</option></select></label><label>Caption <select class="figure-caption-position-input"><option value="below"'+(captionPosition==='below'?' selected':'')+'>Below</option><option value="above"'+(captionPosition==='above'?' selected':'')+'>Above</option></select></label><label>Place <select class="figure-placement-input"><option value=""'+(!placement?' selected':'')+'>default</option><option value="htbp"'+(placement==='htbp'?' selected':'')+'>htbp</option><option value="h"'+(placement==='h'?' selected':'')+'>h</option><option value="t"'+(placement==='t'?' selected':'')+'>t</option><option value="b"'+(placement==='b'?' selected':'')+'>b</option><option value="p"'+(placement==='p'?' selected':'')+'>p</option></select></label>':'')+'</div></div>'+
  '<div class="figure-stage '+alignClass(align,'center')+'"><div class="figure-visual'+(res&&res.isPdf?' pdf':'')+'" style="width:'+(group?100:width)+'%"><div class="figure-media">'+media+'</div><span class="figure-size">'+(group?'group':Math.round(width)+'%')+'</span><span class="figure-resize" title="Drag to resize"></span></div></div>'+
  (isFloat?'<div class="doc-figure-fields"><label>Caption <input class="figure-caption-input" type="text" value="'+esc(caption)+'"></label><label>Short caption <input class="figure-short-caption-input" type="text" value="'+esc(shortCaption)+'"></label><label>Label <input class="figure-label-input" type="text" value="'+esc(label)+'" spellcheck="false"></label></div>':'')+
  (label?'<span class="texflow-label-badge" contenteditable="false">'+esc(label)+'</span>':'')+'</div>';
}
function escapeLatexPlainText(value){const text=String(value??'');let out='';for(let i=0;i<text.length;i++){const ch=text[i],prev=i?text[i-1]:'';if('#$%&_'.includes(ch)&&prev!=='\\')out+='\\'+ch;else out+=ch;}return out;}
function serializeDocumentFigure(node,payload){
 const b=node.block;let raw=String(b.raw||'');const match=/\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}/.exec(raw);if(!match)return raw;
 const existing=(match[1]||'').split(',').map(x=>x.trim()).filter(Boolean),preserved=existing.filter(x=>!/^(?:width|height|keepaspectratio|angle|origin)\s*(?:=|$)/.test(x));
 const width=Math.max(.05,Math.min(2,Number(payload.width||b.figureWidth||.7))),unit=b.figureWidthUnit||'\\linewidth';preserved.push('width='+Number(width.toFixed(3))+unit);
 const command='\\includegraphics['+preserved.join(',')+']{'+match[2]+'}';raw=raw.slice(0,match.index)+command+raw.slice(match.index+match[0].length);
 if(String(b.env||'')==='figure'){
  const placement=String(payload.placement??b.figurePlacement??'').trim();raw=raw.replace(/\\begin\{figure\}(?:\[[^\]]*\])?/,'\\begin{figure}'+(placement?'['+placement+']':''));
  const align=String(payload.align??b.figureAlign??'center');raw=raw.replace(/^([ \t]*)(?:\\centering|\\raggedright|\\raggedleft)\s*$/gm,'').replace(/\n{3,}/g,'\n\n');const directive=align==='right'?'\\raggedleft':align==='left'?'\\raggedright':'\\centering';raw=raw.replace(/(\\begin\{figure\}(?:\[[^\]]*\])?\s*\n?)/,'$1'+directive+'\n');
  const caption=escapeLatexPlainText(String(payload.caption??b.figureCaption??'').trim().replace(/[{}]/g,'')),shortCaption=escapeLatexPlainText(String(payload.shortCaption??b.figureShortCaption??'').trim().replace(/[{}\[\]]/g,'')),captionPosition=String(payload.captionPosition??b.figureCaptionPosition??'below')==='above'?'above':'below';raw=raw.replace(/\n?\\caption(?:\[[^\]]*\])?\{[^}]*\}\n?/g,'\n');if(caption){const cap='\\caption'+(shortCaption?'['+shortCaption+']':'')+'{'+caption+'}';raw=captionPosition==='above'?raw.replace(/(\\begin\{figure\}(?:\[[^\]]*\])?\s*\n(?:\\centering|\\raggedright|\\raggedleft)?\s*\n?)/,'$1'+cap+'\n'):raw.replace(/\n?\\end\{figure\}/,'\n'+cap+'\n\\end{figure}');}
  const label=String(payload.label??b.figureLabel??'').trim().replace(/[{}\\\s]/g,'');if(/\\label\{[^}]*\}/.test(raw))raw=raw.replace(/\\label\{[^}]*\}/,label?'\\label{'+label+'}':'');else if(label)raw=raw.replace(/\n?\\end\{figure\}/,'\n\\label{'+label+'}\n\\end{figure}');
  raw=raw.replace(/\n{3,}/g,'\n\n');
 }
 return raw;
}
function bindDocumentFigure(el,node){
 const visual=el.querySelector('.figure-visual'),stage=el.querySelector('.figure-stage'),wi=el.querySelector('.figure-width-input'),angleInput=el.querySelector('.figure-angle-input'),size=el.querySelector('.figure-size'),caption=el.querySelector('.figure-caption-input'),shortCaption=el.querySelector('.figure-short-caption-input'),label=el.querySelector('.figure-label-input'),align=el.querySelector('.figure-align-input'),placement=el.querySelector('.figure-placement-input'),captionPosition=el.querySelector('.figure-caption-position-input');
 const payload=()=>({width:Math.max(5,Math.min(100,Number(wi&&wi.value)||70))/100,angle:angleInput?Number(angleInput.value)||0:0,caption:caption?caption.value:'',shortCaption:shortCaption?shortCaption.value:'',label:label?label.value:'',align:align?align.value:'center',placement:placement?placement.value:'',captionPosition:captionPosition?captionPosition.value:'below'});
 const save=()=>updateDocumentNode(node,serializeDocumentFigure(node,payload()),true);
 if(wi)wi.onchange=()=>{const w=Math.max(5,Math.min(100,Number(wi.value)||70));visual.style.width=w+'%';size.textContent=Math.round(w)+'%';save();};if(angleInput)angleInput.onchange=save;if(caption)caption.onchange=save;if(shortCaption)shortCaption.onchange=save;if(label)label.onchange=save;if(align)align.onchange=save;if(placement)placement.onchange=save;if(captionPosition)captionPosition.onchange=save;
 const handle=el.querySelector('.figure-resize');if(handle)handle.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();handle.setPointerCapture(e.pointerId);const sr=stage.getBoundingClientRect(),vr=visual.getBoundingClientRect(),sx=e.clientX,sw=vr.width;function move(ev){const nw=Math.max(sr.width*.08,Math.min(sr.width,sw+(ev.clientX-sx))),wp=nw/sr.width*100;wi.value=String(Math.round(wp));visual.style.width=wp+'%';size.textContent=Math.round(wp)+'%';}function up(ev){handle.releasePointerCapture(ev.pointerId);handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',up);save();}handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',up);});
 el.addEventListener('click',()=>setStructuralTarget(node,el));
 bindSemanticBlockSelection(el,()=>updateDocumentNode(node,'',true));
}
function documentTableHtml(node,b){
 const cols=b.tableColumns||[],rows=b.tableRows||[],caption=b.tableCaption||'',label=b.label||b.tableLabel||'',placement=b.tablePlacement||'',captionPosition=b.tableCaptionPosition||'below',tableStyle=b.tableStyle||'plain';
 const colTools=cols.map((c,i)=>'<label>C'+(i+1)+' <select class="table-col-align" data-col="'+i+'"><option value="l"'+(c==='l'?' selected':'')+'>L</option><option value="c"'+(c==='c'?' selected':'')+'>C</option><option value="r"'+(c==='r'?' selected':'')+'>R</option></select></label>').join('');
 const body=rows.map((r,ri)=>'<tr>'+r.map((cell,ci)=>'<td class="doc-table-cell doc-editable" data-row="'+ri+'" data-col="'+ci+'" contenteditable="true">'+latexToHtml(cell||'')+'</td>').join('')+'</tr>').join('');
 return '<div class="doc-table table-card" data-node-id="'+node.id+'"><div class="table-head"><span class="tag">Table</span><div class="table-controls"><label>Style <select class="table-style-input"><option value="plain"'+(tableStyle==='plain'?' selected':'')+'>Plain</option><option value="booktabs"'+(tableStyle==='booktabs'?' selected':'')+'>Booktabs</option></select></label><label>Caption <select class="table-caption-position-input"><option value="below"'+(captionPosition==='below'?' selected':'')+'>Below</option><option value="above"'+(captionPosition==='above'?' selected':'')+'>Above</option></select></label><label>Place <select class="table-placement-input"><option value=""'+(!placement?' selected':'')+'>default</option><option value="htbp"'+(placement==='htbp'?' selected':'')+'>htbp</option><option value="h"'+(placement==='h'?' selected':'')+'>h</option><option value="t"'+(placement==='t'?' selected':'')+'>t</option><option value="b"'+(placement==='b'?' selected':'')+'>b</option><option value="p"'+(placement==='p'?' selected':'')+'>p</option></select></label></div></div><div class="table-column-tools">'+colTools+'</div><div class="table-scroll"><table class="semantic-table"><tbody>'+body+'</tbody></table></div><div class="table-actions"><button type="button" class="table-add-row">+ Row</button><button type="button" class="table-del-row">− Row</button><button type="button" class="table-add-col">+ Column</button><button type="button" class="table-del-col">− Column</button></div><div class="table-fields"><label>Caption <input class="table-caption-input" type="text" value="'+esc(caption)+'"></label><label>Label <input class="table-label-input" type="text" value="'+esc(label)+'" spellcheck="false"></label></div>'+(label?'<span class="texflow-label-badge" contenteditable="false">'+esc(label)+'</span>':'')+'</div>';
}
function serializeDocumentTable(node,payload){
 const b=node.block,columns=(payload.columns||b.tableColumns||[]).map(x=>/^[lcr]$/.test(x)?x:'c'),rows=payload.rows||b.tableRows||[];
 if(!columns.length||!rows.length||rows.some(r=>r.length!==columns.length))return String(b.raw||'');
 const placement=String(payload.placement??b.tablePlacement??'').trim(),tableStyle=String(payload.tableStyle??b.tableStyle??'plain')==='booktabs'?'booktabs':'plain',caption=escapeLatexPlainText(String(payload.caption??b.tableCaption??'').trim().replace(/[{}]/g,'')),label=String(payload.label??b.tableLabel??'').trim().replace(/[{}\\\s]/g,''),captionPosition=String(payload.captionPosition??b.tableCaptionPosition??'below')==='above'?'above':'below';
 const lines=['\\begin{table}'+(placement?'['+placement+']':''),'\\centering'];if(caption&&captionPosition==='above')lines.push('\\caption{'+caption+'}');if(caption&&captionPosition==='above'&&label)lines.push('\\label{'+label+'}');lines.push('\\begin{tabular}{'+columns.join('')+'}');if(tableStyle==='booktabs')lines.push('\\toprule');
 rows.forEach((r,i)=>{lines.push(r.map(x=>String(x??'').replace(/\r?\n/g,' ')).join(' & ')+' \\\\');if(tableStyle==='booktabs'&&i===0&&rows.length>1)lines.push('\\midrule');});if(tableStyle==='booktabs')lines.push('\\bottomrule');
 lines.push('\\end{tabular}');if(caption&&captionPosition==='below')lines.push('\\caption{'+caption+'}');if(label&&!(caption&&captionPosition==='above'))lines.push('\\label{'+label+'}');lines.push('\\end{table}');return lines.join('\n');
}

function bindDocumentTable(el,node){
 const table=el.querySelector('.semantic-table'),caption=el.querySelector('.table-caption-input'),label=el.querySelector('.table-label-input'),placement=el.querySelector('.table-placement-input'),captionPosition=el.querySelector('.table-caption-position-input'),styleInput=el.querySelector('.table-style-input');
 function payload(){const rows=[...table.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>editableLatex(td)));const columns=[...el.querySelectorAll('.table-col-align')].map(x=>x.value);return{rows,columns,caption:caption?caption.value:'',label:label?label.value:'',placement:placement?placement.value:'',captionPosition:captionPosition?captionPosition.value:'below',tableStyle:styleInput?styleInput.value:'plain'};}
 const save=(refresh=true)=>updateDocumentNode(node,serializeDocumentTable(node,payload()),refresh);
 let activeRow=null,activeCol=null;
 function markActive(cell){activeRow=Number(cell&&cell.dataset&&cell.dataset.row);activeCol=Number(cell&&cell.dataset&&cell.dataset.col);if(!Number.isFinite(activeRow))activeRow=null;if(!Number.isFinite(activeCol))activeCol=null;}
 function focusCell(target,atEnd=false){if(target)markActive(target);if(!target)return;target.focus();const r=document.createRange();r.selectNodeContents(target);r.collapse(!atEnd);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);}
 function caretAtBoundary(cell,which){const sel=getSelection();if(!sel||!sel.rangeCount)return false;const r=sel.getRangeAt(0);if(!r.collapsed||!cell.contains(r.startContainer))return false;const test=r.cloneRange();if(which==='start'){test.selectNodeContents(cell);test.setEnd(r.startContainer,r.startOffset);return test.toString().length===0;}test.selectNodeContents(cell);test.setStart(r.startContainer,r.startOffset);return test.toString().length===0;}
 el.querySelectorAll('.doc-table-cell').forEach(cell=>{attachEditor(cell);cell.addEventListener('focus',()=>markActive(cell));cell.addEventListener('mousedown',()=>markActive(cell));cell.addEventListener('blur',()=>save(false));cell.addEventListener('keydown',e=>{const cells=[...el.querySelectorAll('.doc-table-cell')],i=cells.indexOf(cell),cols=Math.max(1,[...table.querySelectorAll('tbody tr:first-child td')].length),row=Math.floor(i/cols),col=i%cols;let target=null,atEnd=false;if(e.key==='Tab'){target=cells[(i+(e.shiftKey?-1:1)+cells.length)%cells.length];atEnd=!!e.shiftKey;}else if(e.key==='ArrowRight'&&caretAtBoundary(cell,'end'))target=cells[i+1]||null;else if(e.key==='ArrowLeft'&&caretAtBoundary(cell,'start')){target=cells[i-1]||null;atEnd=true;}else if(e.key==='ArrowDown'&&caretAtBoundary(cell,'end'))target=cells[(row+1)*cols+col]||null;else if(e.key==='ArrowUp'&&caretAtBoundary(cell,'start')){target=row>0?cells[(row-1)*cols+col]:null;atEnd=true;}else if(e.key==='Enter'){e.preventDefault();insertSoftBreak();return;}if(target){e.preventDefault();focusCell(target,atEnd);}});});
 el.querySelectorAll('.table-col-align').forEach(x=>x.onchange=()=>save(true));if(caption)caption.onchange=()=>save(true);if(label)label.onchange=()=>save(true);if(placement)placement.onchange=()=>save(true);if(captionPosition)captionPosition.onchange=()=>save(true);if(styleInput)styleInput.onchange=()=>{save(true);if(styleInput.value==='booktabs')setTimeout(()=>vscode.postMessage({type:'ensureFeaturePackage',feature:'booktabs'}),25);};
 const addRow=el.querySelector('.table-add-row'),delRow=el.querySelector('.table-del-row'),addCol=el.querySelector('.table-add-col'),delCol=el.querySelector('.table-del-col');
 if(addRow)addRow.onclick=()=>{const p=payload(),at=activeRow!==null&&activeRow>=0&&activeRow<p.rows.length?activeRow+1:p.rows.length;p.rows.splice(at,0,Array.from({length:p.columns.length},()=>''));updateDocumentNode(node,serializeDocumentTable(node,p),true);};
 if(delRow)delRow.onclick=()=>{const p=payload();if(p.rows.length<=1){vscode.postMessage({type:'showWarning',message:'A table must keep at least one row.'});return;}const at=activeRow!==null&&activeRow>=0&&activeRow<p.rows.length?activeRow:p.rows.length-1;p.rows.splice(at,1);updateDocumentNode(node,serializeDocumentTable(node,p),true);};
 if(addCol)addCol.onclick=()=>{const p=payload();if(p.columns.length>=12){vscode.postMessage({type:'showWarning',message:'TeXFlow tables currently support up to 12 columns.'});return;}const at=activeCol!==null&&activeCol>=0&&activeCol<p.columns.length?activeCol+1:p.columns.length;p.columns.splice(at,0,'c');p.rows=p.rows.map(r=>{const x=[...r];x.splice(at,0,'');return x;});updateDocumentNode(node,serializeDocumentTable(node,p),true);};
 if(delCol)delCol.onclick=()=>{const p=payload();if(p.columns.length<=1){vscode.postMessage({type:'showWarning',message:'A table must keep at least one column.'});return;}const at=activeCol!==null&&activeCol>=0&&activeCol<p.columns.length?activeCol:p.columns.length-1;p.columns.splice(at,1);p.rows=p.rows.map(r=>r.filter((_,i)=>i!==at));updateDocumentNode(node,serializeDocumentTable(node,p),true);};
 el.addEventListener('click',()=>setStructuralTarget(node,el));
 bindSemanticBlockSelection(el,()=>updateDocumentNode(node,'',true));
}
function documentBlockHtml(node){
 const b=node.block;
 if(b.kind==='paragraph')return '<div class="doc-paragraph doc-editable '+alignClass(b.align,'justify')+'" data-node-id="'+node.id+'"'+(node.synthetic?' data-synthetic="true" data-placeholder="Start typing…"':'')+' contenteditable="true">'+latexToHtml(b.text||'')+'</div>';
 if(b.kind==='itemize'){const tag=b.env==='enumerate'?'ol':'ul';const items=(b.items||[]).map(it=>'<li><div class="doc-item-editable doc-editable" contenteditable="true">'+latexToHtml(typeof it==='string'?it:(it&&it.text)||'')+'</div></li>').join('');return '<'+tag+' class="doc-list" data-node-id="'+node.id+'">'+items+'</'+tag+'>';}
 if(b.kind==='equation'){let clean=String(b.text||'').replace(/\\label\{[^}]+\}/g,'').replace(/\\(?:notag|nonumber)\b/g,'').trim();if(/^align/.test(String(b.env||'')))clean='\\begin{aligned}'+clean+'\\end{aligned}';const number=b.eqNumber?'<span class="doc-equation-number">('+b.eqNumber+')</span>':'',badge=b.label?'<span class="texflow-label-badge" contenteditable="false">'+esc(b.label)+'</span>':'';return '<div class="doc-math-wrap" data-node-id="'+node.id+'"><div class="doc-math" data-node-id="'+node.id+'" data-tex="'+esc(clean)+'">'+number+'</div>'+badge+'</div>';}
 if(b.kind==='figure')return documentFigureHtml(node,b);
 if(b.kind==='table')return documentTableHtml(node,b);
 if(b.kind==='columns'){const texts=b.columnTexts||[b.text||''],count=Math.max(2,Math.min(4,Number(b.columnCount)||texts.length||2));if(b.env==='multicols')return '<div class="doc-columns-flow semantic-block" data-node-id="'+node.id+'"><div class="columns-head"><span class="tag">'+count+' columns · flowing text</span></div><div class="doc-column-flow doc-editable" contenteditable="true" style="column-count:'+count+'">'+latexToHtml(texts[0]||'')+'</div></div>';return '<div class="doc-columns semantic-block" data-node-id="'+node.id+'" style="grid-template-columns:repeat('+count+',minmax(0,1fr))">'+Array.from({length:count},(_,i)=>'<div class="doc-column doc-editable" contenteditable="true" data-col="'+i+'">'+latexToHtml(texts[i]||'')+'</div>').join('')+'</div>'; }
 if(b.kind==='vspace')return '<div class="doc-vspace semantic-block" data-node-id="'+node.id+'"><span class="vspace-label">vertical '+esc((b.spaceStarred?'* ':'')+(b.spaceAmount||''))+'</span></div>';
 if(b.kind==='break')return '<div class="doc-break semantic-block" data-node-id="'+node.id+'">'+esc(b.breakCommand||'newpage')+'</div>';
 if(b.kind==='comment')return '<div class="doc-rich-block semantic-block comment" data-node-id="'+node.id+'"><div class="doc-rich-label">'+(b.commentNote?'Author note':'Source comment')+' · not in PDF</div><div class="doc-rich-edit doc-editable" contenteditable="true">'+esc(b.commentText||b.text||'')+'</div></div>';
 if(b.kind==='quote'||b.kind==='container'||b.kind==='theorem'){const cls=b.kind==='quote'?'quote':b.kind==='theorem'?'theorem':'container',label=b.kind==='theorem'?(b.env||'theorem'):(b.kind==='container'?'minipage':(b.env||'quote'));return '<div class="doc-rich-block semantic-block '+cls+'" data-node-id="'+node.id+'"><div class="doc-rich-label">'+esc(label)+'</div><div class="doc-rich-edit doc-editable" contenteditable="true">'+latexToHtml(b.text||'')+'</div></div>';}
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
function isAtomicDocumentBlockNode(x){return !!(x&&x.kind==='block'&&x.block&&['equation','figure','table','vspace','columns','quote','container','break','theorem','comment'].includes(x.block.kind));}
function documentAfterBlockSlotHtml(node){return '<div class="doc-after-block-slot" data-after-node-id="'+node.id+'" tabindex="0" aria-label="Start a paragraph after this object"></div>'; }
function documentFlowInnerHtml(){
 const flow=parseDocumentFlow();let html='';
 if(metadata.title||metadata.author){html+='<header class="doc-title"><h1>'+latexToHtml(metadata.title||'Untitled document')+'</h1>'+(metadata.author?'<div>'+latexToHtml(metadata.author)+'</div>':'')+(metadata.date?'<div class="doc-date">'+latexToHtml(metadata.date)+'</div>':'')+'</header>';}
 flow.forEach((x,i)=>{
  if(x.kind==='matter')return;
  if(x.kind==='toc'){html+=documentTocHtml(flow);return;}
  if(x.kind==='bibliography'){html+=bibliographyHtml(x.id);return;}
  if(x.kind==='heading'){const tag=x.level<=1?'h1':x.level===2?'h2':x.level===3?'h3':'h4',labelAttr=x.label?' data-label="'+esc(x.label)+'"':'';html+='<'+tag+' id="'+x.id+'" data-node-id="'+x.id+'" data-node-start="'+x.start+'"'+labelAttr+' contenteditable="true" class="doc-heading doc-editable level-'+x.level+(x.starred?' starred':'')+'">'+latexToHtml(x.title||'')+'</'+tag+'>';return;}
  html+=documentBlockHtml(x);
  if(isAtomicDocumentBlockNode(x)){
   const next=flow.slice(i+1).find(y=>y.kind!=='matter');
   const nextIsEditableParagraph=!!(next&&next.kind==='block'&&next.block&&next.block.kind==='paragraph');
   if(!nextIsEditableParagraph)html+=documentAfterBlockSlotHtml(x);
  }
 });
 if(bibliographyResources.length&&!flow.some(x=>x.kind==='bibliography'))html+='<section class="doc-bibliography doc-bibliography-pending"><h2>Bibliography</h2><div class="cite-empty">Bibliography connected, but it has not been inserted yet. Use Cite → Insert bibliography…</div></section>';
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
function updateDocumentNode(node,replacement,refresh=true,feature=''){
 if(!node)return;
 const start=Number(node.start),end=Number(node.end),expected=String(node.raw||'');
 const wasSynthetic=!!node.synthetic;
 const syntheticPrefix=wasSynthetic?String(node.insertPrefix||''):'';
 const syntheticContent=wasSynthetic?String(replacement).trim():'';
 let finalReplacement=String(replacement);
 if(wasSynthetic)finalReplacement=syntheticContent?syntheticPrefix+syntheticContent+'\n\n':'';

 vscode.postMessage({type:'updateDocumentNode',start,end,expected,replacement:finalReplacement,refresh,feature});
 // Mirror only edits that still match the local source snapshot. Structural
 // separators stay outside editable ranges, including for a paragraph that is
 // created by Enter and does not exist in the .tex until the user types in it.
 if(Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end>=start&&documentSource.slice(start,end)===expected){
  const delta=finalReplacement.length-(end-start);
  documentSource=documentSource.slice(0,start)+finalReplacement+documentSource.slice(end);
  const rootSource=sources.find(x=>x.uri===rootUri);if(rootSource)rootSource.text=documentSource;
  if(wasSynthetic){
   node.start=start+syntheticPrefix.length;node.end=node.start+syntheticContent.length;node.raw=syntheticContent;node.synthetic=false;delete node.insertPrefix;
   if(node.block){node.block.raw=syntheticContent;node.block.text=syntheticContent;node.block.synthetic=false;}
  }else{
   node.raw=finalReplacement;node.end=start+finalReplacement.length;node.synthetic=false;
   if(node.block){node.block.raw=finalReplacement;node.block.text=String(replacement).trim();}
  }
  Object.values(documentFlowById||{}).forEach(other=>{if(!other||other===node)return;if(Number.isFinite(other.start)&&other.start>=end){other.start+=delta;other.end+=delta;}});
  // Bibliography preview is derived state. Refresh only that component so an
  // inserted/deleted citation is reflected immediately without rebuilding the editor DOM.
  refreshBibliographyPreviews();
 }
}
function serializeDocumentList(node,list){const env=node.block.env==='enumerate'?'enumerate':'itemize';const items=[...list.querySelectorAll(':scope > li > .doc-item-editable')].map(el=>editableLatex(el)).filter((x,i,a)=>x||a.length===1);return '\\begin{'+env+'}\n'+items.map(x=>'    \\item '+x).join('\n')+'\n\\end{'+env+'}';}
let syntheticParagraphCounter=0;
function paragraphInsertionPoint(node){
 const start=Math.max(0,Number(node&&node.end)||0),info=documentBodyInfo();let p=start;
 while(p<info.end&&/[ \t\r\n]/.test(documentSource[p]||''))p++;
 const ws=documentSource.slice(start,p),hasParagraphSep=/\n[ \t]*\n/.test(ws);
 return{anchor:hasParagraphSep?p:start,prefix:hasParagraphSep?'':'\n\n'};
}
function focusParagraphStart(el){el.focus();const r=document.createRange();r.selectNodeContents(el);r.collapse(true);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);}
function createSyntheticParagraphAfter(referenceEl,node,initialText=''){
 const existing=referenceEl.nextElementSibling;
 if(existing&&existing.classList&&existing.classList.contains('doc-paragraph')&&existing.dataset.synthetic==='true'&&!editableLatex(existing).trim()){focusParagraphStart(existing);return existing;}
 const point=paragraphInsertionPoint(node),id='doc-synth-'+(++syntheticParagraphCounter)+'-'+Date.now();
 const syn={kind:'block',id,start:point.anchor,end:point.anchor,raw:'',synthetic:true,insertPrefix:point.prefix,block:{id:'doc-empty',kind:'paragraph',start:0,end:0,raw:'',text:'',synthetic:true}};
 documentFlowById[id]=syn;
 const div=document.createElement('div');div.className='doc-paragraph doc-editable justify';div.contentEditable='true';div.dataset.nodeId=id;div.dataset.synthetic='true';div.dataset.placeholder='Start typing…';referenceEl.after(div);bindDocumentParagraph(div,syn);
 if(initialText){setEditableLatex(div,initialText);div.dispatchEvent(new Event('input',{bubbles:true}));}
 focusParagraphStart(div);return div;
}
function paragraphEnv(node){return node&&node.block&&['flushleft','center','flushright'].includes(String(node.block.env||''))?String(node.block.env):'';}
function paragraphSource(node,text){const env=paragraphEnv(node);return env?'\\begin{'+env+'}\n'+text+'\n\\end{'+env+'}':text;}
function paragraphCaretBoundary(el,which){const sel=getSelection();if(!sel||!sel.rangeCount)return false;const r=sel.getRangeAt(0);if(!r.collapsed||!el.contains(r.startContainer))return false;const test=document.createRange();test.selectNodeContents(el);if(which==='start')test.setEnd(r.startContainer,r.startOffset);else test.setStart(r.startContainer,r.startOffset);return test.toString().length===0;}
function adjacentParagraphElement(el,dir){const x=dir<0?el.previousElementSibling:el.nextElementSibling;return x&&x.classList&&x.classList.contains('doc-paragraph')?x:null;}
function combineParagraphDom(left,right){const marker=document.createElement('span');marker.dataset.texflowMergeCaret='true';marker.textContent='';const leftFrag=document.createDocumentFragment();while(right.firstChild)leftFrag.appendChild(right.firstChild);left.appendChild(marker);left.appendChild(leftFrag);renderInlineMaths(left);const live=left.querySelector('[data-texflow-merge-caret="true"]')||marker;const r=document.createRange();r.setStartBefore(live);r.collapse(true);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);live.remove();left.focus();return editableLatex(left);}
function mergeDocumentParagraphs(left,right){if(!left||!right)return false;let leftNode=documentFlowById[left.dataset.nodeId],rightNode=documentFlowById[right.dataset.nodeId];if(!leftNode||!rightNode)return false;const lt=saveTimers.get(left),rt=saveTimers.get(right);if(lt)clearTimeout(lt);if(rt)clearTimeout(rt);if(leftNode.synthetic&&!editableLatex(left).trim()){delete documentFlowById[left.dataset.nodeId];left.remove();focusParagraphStart(right);return true;}if(leftNode.synthetic){const leftText=editableLatex(left);updateDocumentNode(leftNode,leftText,false);leftNode=documentFlowById[left.dataset.nodeId]||leftNode;}const merged=combineParagraphDom(left,right),replacement=paragraphSource(leftNode,merged);if(rightNode.synthetic){updateDocumentNode(leftNode,replacement,false);}else{const start=Number(leftNode.start),end=Number(rightNode.end),expected=documentSource.slice(start,end),fake={start,end,raw:expected,synthetic:false,block:{kind:'paragraph'}};updateDocumentNode(fake,replacement,false);leftNode.raw=replacement;leftNode.end=start+replacement.length;if(leftNode.block){leftNode.block.raw=replacement;leftNode.block.text=merged;}delete documentFlowById[right.dataset.nodeId];}if(left.__texflowState)left.__texflowState.lastSentLatex=merged;right.remove();return true;}
function moveParagraphCaret(el,dir){const target=adjacentParagraphElement(el,dir);if(!target)return false;target.focus();const r=document.createRange();r.selectNodeContents(target);r.collapse(dir>0);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);return true;}
function caretOnOuterVisualLine(el,which){const sel=getSelection();if(!sel||!sel.rangeCount||!sel.isCollapsed||!el.contains(sel.anchorNode))return false;const r=sel.getRangeAt(0).cloneRange(),cr=r.getBoundingClientRect(),box=el.getBoundingClientRect();if(!cr||(!cr.width&&!cr.height))return which==='first'?paragraphCaretBoundary(el,'start'):paragraphCaretBoundary(el,'end');const line=Math.max(12,parseFloat(getComputedStyle(el).lineHeight)||16);return which==='first'?cr.top<=box.top+line*.65:cr.bottom>=box.bottom-line*.65;}
function bindMultiParagraphMouseSelection(host){
 if(host.dataset.multiParagraphSelectionBound==='true')return;host.dataset.multiParagraphSelectionBound='true';
 let drag=null;
 const caretAt=(x,y)=>{if(document.caretRangeFromPoint)return document.caretRangeFromPoint(x,y);const pos=document.caretPositionFromPoint&&document.caretPositionFromPoint(x,y);if(!pos)return null;const r=document.createRange();r.setStart(pos.offsetNode,pos.offset);r.collapse(true);return r;};
 host.addEventListener('mousedown',e=>{if(e.button!==0)return;const para=e.target.closest&&e.target.closest('.doc-paragraph');if(!para)return;const r=caretAt(e.clientX,e.clientY);if(r&&para.contains(r.startContainer))drag={para,node:r.startContainer,offset:r.startOffset};});
 host.addEventListener('mousemove',e=>{if(!drag||!(e.buttons&1))return;const para=e.target.closest&&e.target.closest('.doc-paragraph');if(!para||para===drag.para)return;const end=caretAt(e.clientX,e.clientY);if(!end)return;e.preventDefault();const sel=getSelection();if(!sel)return;if(typeof sel.setBaseAndExtent==='function'){try{sel.setBaseAndExtent(drag.node,drag.offset,end.startContainer,end.startOffset);return;}catch{}}const a=document.createRange();a.setStart(drag.node,drag.offset);a.collapse(true);const cmp=a.compareBoundaryPoints(Range.START_TO_START,end),r=document.createRange();if(cmp<=0){r.setStart(drag.node,drag.offset);r.setEnd(end.startContainer,end.startOffset);}else{r.setStart(end.startContainer,end.startOffset);r.setEnd(drag.node,drag.offset);}sel.removeAllRanges();sel.addRange(r);});
 host.addEventListener('mouseup',()=>{drag=null;});host.addEventListener('mouseleave',e=>{if(!(e.buttons&1))drag=null;});
}
function bindDocumentParagraph(el,node){
 attachEditor(el);
 const state=el.__texflowState={lastSentLatex:editableLatex(el)};
 const save=refresh=>{const now=editableLatex(el);if(now===state.lastSentLatex)return;state.lastSentLatex=now;updateDocumentNode(node,paragraphSource(node,now),refresh);};
 el.__texflowCommit=text=>{setEditableLatex(el,text);state.lastSentLatex=editableLatex(el);updateDocumentNode(node,paragraphSource(node,text),true);};
 el.__texflowSaveNow=()=>save(false);
 el.addEventListener('keydown',e=>{
  if(e.key==='Backspace'&&paragraphCaretBoundary(el,'start')){const prev=adjacentParagraphElement(el,-1);if(prev){e.preventDefault();if(node.synthetic&&!editableLatex(el).trim()){delete documentFlowById[el.dataset.nodeId];el.remove();placeCaretEnd(prev);}else mergeDocumentParagraphs(prev,el);return;}}
  if(e.key==='Delete'&&paragraphCaretBoundary(el,'end')){const next=adjacentParagraphElement(el,1);if(next){e.preventDefault();mergeDocumentParagraphs(el,next);return;}}
  if(e.key==='ArrowLeft'&&paragraphCaretBoundary(el,'start')&&!e.shiftKey){if(moveParagraphCaret(el,-1)){e.preventDefault();return;}}
  if(e.key==='ArrowRight'&&paragraphCaretBoundary(el,'end')&&!e.shiftKey){if(moveParagraphCaret(el,1)){e.preventDefault();return;}}
  if(e.key==='ArrowUp'&&caretOnOuterVisualLine(el,'first')&&!e.shiftKey){if(moveParagraphCaret(el,-1)){e.preventDefault();return;}}
  if(e.key==='ArrowDown'&&caretOnOuterVisualLine(el,'last')&&!e.shiftKey){if(moveParagraphCaret(el,1)){e.preventDefault();return;}}
  if(e.key!=='Enter')return;
  e.preventDefault();
  if(e.shiftKey){insertSoftBreak();el.dispatchEvent(new Event('input',{bubbles:true}));return;}
  if(node.synthetic&&!editableLatex(el).trim())return;
  const parts=caretSplit(el),old=saveTimers.get(el);if(old)clearTimeout(old);
  // Enter at the very beginning creates a transient paragraph before this one.
  // It does not rewrite the real paragraph as empty or add blank source lines.
  if(!node.synthetic&&!parts.text&&parts.tail){const id='doc-synth-'+(++syntheticParagraphCounter)+'-'+Date.now(),syn={kind:'block',id,start:Number(node.start),end:Number(node.start),raw:'',synthetic:true,insertPrefix:'',block:{id:'doc-empty',kind:'paragraph',start:0,end:0,raw:'',text:'',synthetic:true}};documentFlowById[id]=syn;const div=document.createElement('div');div.className='doc-paragraph doc-editable justify';div.contentEditable='true';div.dataset.nodeId=id;div.dataset.synthetic='true';div.dataset.placeholder='Start typing…';el.before(div);bindDocumentParagraph(div,syn);focusParagraphStart(div);return;}
  setEditableLatex(el,parts.text);save(false);
  createSyntheticParagraphAfter(el,node,parts.tail);
 });
 el.addEventListener('input',()=>{const now=editableLatex(el);if(now===state.lastSentLatex)return;scheduleSave(el,save);});
 el.addEventListener('blur',e=>{if(e.relatedTarget&&e.relatedTarget.closest&&e.relatedTarget.closest('.topbar,.top-menu-panel'))return;const old=saveTimers.get(el);if(old)clearTimeout(old);if(node.synthetic&&!editableLatex(el).trim()){return;}save(false);});
}
function bindDocumentList(list,node){
 const save=refresh=>updateDocumentNode(node,serializeDocumentList(node,list),refresh);
 list.querySelectorAll('.doc-item-editable').forEach(edit=>{attachEditor(edit);edit.__texflowCommit=text=>{setEditableLatex(edit,text);updateDocumentNode(node,serializeDocumentList(node,list),true);};});
 list.addEventListener('keydown',e=>{const edit=e.target.closest('.doc-item-editable');if(!edit)return;if(e.key==='Tab'){e.preventDefault();if(listIndentOutdent(edit,list,e.shiftKey))save(true);return;}if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();const parts=caretSplit(edit),li=edit.closest('li');setEditableLatex(edit,parts.text);const next=document.createElement('li');next.innerHTML='<div class="doc-item-editable doc-editable" contenteditable="true"></div>';li.after(next);const ne=next.firstChild;setEditableLatex(ne,parts.tail);attachEditor(ne);ne.__texflowCommit=text=>{setEditableLatex(ne,text);updateDocumentNode(node,serializeDocumentList(node,list),true);};placeCaretEnd(ne);save(true);}else if(e.key==='Enter'&&e.shiftKey){e.preventDefault();insertSoftBreak();scheduleSave(list,save);}else if(e.key==='Backspace'&&!editableLatex(edit).trim()){const li=edit.closest('li'),prev=li.previousElementSibling;if(prev){e.preventDefault();li.remove();const target=prev.querySelector('.doc-item-editable');placeCaretEnd(target);save(true);}}});
 list.addEventListener('input',()=>scheduleSave(list,save));list.addEventListener('focusout',()=>flushSave(list,save));
}
function openDocumentMathEditor(node){mathEditing={mode:'doc-edit',node};const modal=document.getElementById('math-modal'),b=node.block,structure=inferMathStructure(b),rawText=String(b.text||'').trim(),overallLabel=structure==='align'?'':String(b.label||'').trim(),text=structure==='align'?rawText:rawText.replace(/\\label\{[^}]+\}/g,'').trim(),numbered=!String(b.env||'').endsWith('*')&&structure!=='display';document.getElementById('math-modal-title').textContent='Edit equation';modal.classList.add('open');modal.setAttribute('aria-hidden','false');renderMathPalette();configureMathStructure(structure,text,numbered,overallLabel);const ta=document.getElementById('math-code');setTimeout(()=>{ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length)},0);}
function serializeDocumentColumns(node,texts){const b=node.block,count=Math.max(2,Math.min(4,Number(b.columnCount)||texts.length||2));if(b.env==='multicols')return '\\begin{multicols}{'+count+'}\n'+String(texts[0]||'').trim()+'\n\\end{multicols}';const width=Number((.96/count).toFixed(3));return '\\begin{columns}[T]\n'+texts.slice(0,count).map(t=>'\\column{'+width+'\\textwidth}\n'+t).join('\n')+'\n\\end{columns}';}
function bindDocumentColumns(el,node){const flow=el.querySelector('.doc-column-flow'),edits=flow?[flow]:[...el.querySelectorAll('.doc-column')];edits.forEach(x=>attachEditor(x));const save=refresh=>updateDocumentNode(node,serializeDocumentColumns(node,edits.map(x=>editableLatex(x))),refresh);edits.forEach(x=>{x.__texflowCommit=text=>{setEditableLatex(x,text);save(true);};x.addEventListener('input',()=>scheduleSave(x,save));x.addEventListener('blur',()=>flushSave(x,save));});el.addEventListener('click',()=>setStructuralTarget(node,el));bindSemanticBlockSelection(el,()=>updateDocumentNode(node,'',true));}

function serializeRichDocumentBlock(node,text){
 const b=node.block,body=String(text||'').trim();
 if(b.kind==='break')return '\\'+(b.breakCommand||'newpage');
 if(b.kind==='quote'){const env=b.env==='quotation'?'quotation':'quote';return '\\begin{'+env+'}\n'+body+'\n\\end{'+env+'}';}
 if(b.kind==='container')return '\\begin{minipage}{0.9\\linewidth}\n'+body+'\n\\end{minipage}';
 if(b.kind==='theorem'){const env=b.env||'theorem';return '\\begin{'+env+'}\n'+body+'\n\\end{'+env+'}';}
 if(b.kind==='comment')return (b.commentNote?'% TeXFlow note: ':'% ')+body.replace(/\r?\n/g,' ');
 return node.raw||'';
}
function bindDocumentRichBlock(el,node){const edit=el.querySelector('.doc-rich-edit');if(edit){attachEditor(edit);const save=refresh=>updateDocumentNode(node,serializeRichDocumentBlock(node,editableLatex(edit)),refresh);edit.__texflowSaveNow=()=>save(false);edit.addEventListener('input',()=>scheduleSave(edit,save));edit.addEventListener('blur',()=>flushSave(edit,save));}bindSemanticBlockSelection(el,()=>updateDocumentNode(node,'',true));}

function bindVisualDocument(host){
 const flow=parseDocumentFlow();const byId={};flow.forEach(x=>byId[x.id]=x);
 host.querySelectorAll('.doc-heading[contenteditable=true]').forEach(el=>{const node=byId[el.dataset.nodeId];attachEditor(el);let exiting=false;const save=refresh=>{const text=editableLatex(el).replace(/\n+/g,' ').trim();updateDocumentNode(node,'\\'+node.command+(node.starred?'*':'')+'{'+text+'}',refresh);};el.__texflowSaveNow=()=>save(false);el.addEventListener('input',()=>scheduleSave(el,save));el.addEventListener('blur',()=>{if(exiting){exiting=false;return;}flushSave(el,save);});el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();const old=saveTimers.get(el);if(old)clearTimeout(old);exiting=true;save(false);const next=el.nextElementSibling;if(next&&next.classList&&next.classList.contains('doc-paragraph'))focusParagraphStart(next);else createSyntheticParagraphAfter(el,node,'');}});});
 host.querySelectorAll('.doc-paragraph[contenteditable=true]').forEach(el=>bindDocumentParagraph(el,byId[el.dataset.nodeId]));bindMultiParagraphMouseSelection(host);host.querySelectorAll('.doc-toc-row[data-target]').forEach(el=>el.addEventListener('click',()=>{const target=host.querySelector('#'+el.dataset.target)||document.getElementById(el.dataset.target);if(target)target.scrollIntoView({behavior:'smooth',block:'start'});}));
 host.querySelectorAll('.doc-list').forEach(list=>bindDocumentList(list,byId[list.dataset.nodeId]));
 host.querySelectorAll('.doc-math').forEach(el=>{const node=byId[el.dataset.nodeId],numberText=el.querySelector('.doc-equation-number')?.textContent||'';try{katex.render(el.dataset.tex||'',el,{displayMode:true,throwOnError:false});if(numberText){const n=document.createElement('span');n.className='doc-equation-number';n.textContent=numberText;el.appendChild(n);}}catch{el.textContent=el.dataset.tex||'';}el.title='Double-click to edit equation';el.addEventListener('dblclick',()=>openDocumentMathEditor(node));});
 host.querySelectorAll('.doc-heading[data-node-id]').forEach(el=>{const node=byId[el.dataset.nodeId];el.addEventListener('focus',()=>setStructuralTarget(node,el));el.addEventListener('click',()=>setStructuralTarget(node,el));});
 host.querySelectorAll('.doc-math-wrap[data-node-id]').forEach(el=>{const node=byId[el.dataset.nodeId];el.addEventListener('click',()=>setStructuralTarget(node,el));bindSemanticBlockSelection(el,()=>updateDocumentNode(node,'',true));});
 host.querySelectorAll('.doc-figure[data-node-id]').forEach(el=>bindDocumentFigure(el,byId[el.dataset.nodeId]));
 host.querySelectorAll('.doc-table[data-node-id]').forEach(el=>bindDocumentTable(el,byId[el.dataset.nodeId]));
 host.querySelectorAll('.doc-columns[data-node-id],.doc-columns-flow[data-node-id]').forEach(el=>bindDocumentColumns(el,byId[el.dataset.nodeId]));
 host.querySelectorAll('.doc-vspace[data-node-id]').forEach(el=>{const node=byId[el.dataset.nodeId];bindSemanticBlockSelection(el,()=>updateDocumentNode(node,'',true));});
 host.querySelectorAll('.doc-break[data-node-id]').forEach(el=>{const node=byId[el.dataset.nodeId];bindSemanticBlockSelection(el,()=>updateDocumentNode(node,'',true));});
 host.querySelectorAll('.doc-rich-block[data-node-id]').forEach(el=>bindDocumentRichBlock(el,byId[el.dataset.nodeId]));
 host.querySelectorAll('.doc-after-block-slot[data-after-node-id]').forEach(slot=>{
  const node=byId[slot.dataset.afterNodeId];if(!node)return;
  const activate=initialText=>{const ref=host.querySelector('[data-node-id="'+node.id+'"]');if(!ref)return;const p=createSyntheticParagraphAfter(ref,node,initialText||'');slot.remove();return p;};
  slot.addEventListener('click',()=>activate(''));
  slot.addEventListener('keydown',e=>{
   if(e.key==='Enter'){e.preventDefault();activate('');return;}
   if(e.key==='Backspace'||e.key==='Delete'||e.key==='Tab'||e.key.startsWith('Arrow')||e.ctrlKey||e.metaKey||e.altKey)return;
   if(e.key.length===1){e.preventDefault();activate(e.key);}
  });
 });
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

function figureData(raw){
 const graphic=/\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}/.exec(String(raw||''));
 const options=graphic&&graphic[1]||'',path=graphic&&graphic[2]&&graphic[2].trim()||'';
 const parts=options.split(',').map(x=>x.trim()).filter(Boolean);
 function dim(name){const token=parts.find(x=>new RegExp('^'+name+'\\s*=').test(x));if(!token)return{};const value=token.slice(token.indexOf('=')+1).trim(),m=/^([0-9]*\.?[0-9]+)\s*(\\(?:textwidth|linewidth|columnwidth|paperwidth|textheight)|[a-zA-Z]+)$/.exec(value);return m?{value:Number(m[1]),unit:m[2]}:{};}
 const captionMatch=/\\caption(?:\[([^\]]*)\])?\{([^}]*)\}/.exec(String(raw||'')),shortCaption=captionMatch?captionMatch[1]||'':'',caption=captionMatch?captionMatch[2]:'',captionPosition=captionMatch&&graphic&&captionMatch.index<graphic.index?'above':'below';
 const label=(/\\label\{([^}]+)\}/.exec(String(raw||''))||[])[1]||'';
 const placement=(/\\begin\{figure\}(?:\[([^\]]*)\])?/.exec(String(raw||''))||[])[1]||'';
 const align=/\\raggedleft|\\begin\{flushright\}/.test(raw)?'right':/\\centering|\\begin\{center\}/.test(raw)?'center':'left';
 const angleToken=parts.find(x=>/^angle\s*=/.test(x));const angle=angleToken?Number(angleToken.slice(angleToken.indexOf('=')+1).trim())||0:0;
 return{path,options,width:dim('width'),height:dim('height'),caption,shortCaption,angle,label,placement,captionPosition,align};
}
function tableData(raw){
 const text=String(raw||''),tab=/\\begin\{tabular\}\{([^}]*)\}([\s\S]*?)\\end\{tabular\}/.exec(text),captionMatch=/\\caption(?:\[[^\]]*\])?\{([^}]*)\}/.exec(text),caption=captionMatch?captionMatch[1]:'',captionPosition=captionMatch&&tab&&captionMatch.index<tab.index?'above':'below',label=(/\\label\{([^}]+)\}/.exec(text)||[])[1]||'',placement=(/\\begin\{table\}(?:\[([^\]]*)\])?/.exec(text)||[])[1]||'';
 if(!tab)return{simple:false,columns:[],rows:[],caption,label,placement,captionPosition,tableStyle:'plain'};
 const spec=tab[1].trim(),tableStyle=/\\(?:toprule|midrule|bottomrule)\b/.test(tab[2])?'booktabs':'plain',unsupported=/\\(?:multicolumn|multirow|cline|cmidrule|begin\{|end\{)/.test(tab[2]),columns=[...spec.matchAll(/[lcr]/g)].map(m=>m[0]);
 if(!columns.length||unsupported||spec.replace(/[lcr|\s]/g,'')!=='')return{simple:false,columns,rows:[],caption,label,placement,captionPosition,tableStyle};
 let tbody=tab[2].replace(/^[\s\n]+|[\s\n]+$/g,'').replace(/(^|\n)\s*\\(?:hline|toprule|midrule|bottomrule)\s*(?=\n|$)/g,'$1');
 const rawRows=tbody.split(/\\\\(?:\s*\[[^\]]*\])?/).map(x=>x.trim()).filter(Boolean),rows=rawRows.map(r=>r.split(/(?<!\\)&/).map(c=>c.trim()));
 return{simple:!!rows.length&&rows.every(r=>r.length===columns.length),columns,rows,caption,label,placement,captionPosition,tableStyle};
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
 const out=[];const re=/\\begin\{(itemize|enumerate|block|alertblock|exampleblock|equation\*?|align\*?|gather\*?|multline\*?|figure|table|columns|multicols|flushleft|center|flushright|quote|quotation|minipage|theorem|lemma|proposition|corollary|definition|proof)\}(?:\[[^\]]*\])?(?:\{([^}]*)\})?|\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}|\\vspace(\*)?\{([^}]+)\}|\\(newpage|clearpage|pagebreak)\b|\$\$/g;let cur=0,m,n=0,currentAlign='justify';
 function text(s,e){
  const raw=body.slice(s,e);if(!raw.trim())return;
  if(s===0){const size=/^((?:(?:[ \t\r\n]+)|(?:[ \t]*%[^\n]*(?:\r?\n|$)))*)\\(?:normalsize|small|footnotesize|scriptsize|tiny)\b[ \t]*(?:%[^\n]*)?(?:\r?\n)?/.exec(raw);if(size){const prefix=String(size[1]||''),commandStart=s+prefix.length,commandEnd=s+size[0].length;if(prefix)text(s,commandStart);out.push({id:'b'+n++,kind:'raw',start:commandStart,end:commandEnd,raw:body.slice(commandStart,commandEnd),text:body.slice(commandStart,commandEnd).trim(),hidden:true,align:currentAlign});if(commandEnd<e)text(commandEnd,e);return;}}
  const alignmentDirective=/(^|\r?\n)([ \t]*\\(centering|raggedright|raggedleft|justifying)\b[ \t]*(?:%[^\n]*)?)(?=\r?\n|$)/m.exec(raw);
  if(alignmentDirective){
   const linePrefix=String(alignmentDirective[1]||''),command=String(alignmentDirective[3]||''),commandStart=s+(alignmentDirective.index||0)+linePrefix.length,commandEnd=commandStart+String(alignmentDirective[2]||'').length;
   if(commandStart>s)text(s,commandStart);
   currentAlign=alignmentFromDirective('\\'+command,currentAlign);
   out.push({id:'b'+n++,kind:'raw',start:commandStart,end:commandEnd,raw:body.slice(commandStart,commandEnd),text:body.slice(commandStart,commandEnd).trim(),hidden:true,align:currentAlign});
   if(commandEnd<e)text(commandEnd,e);
   return;
  }
  const trimmedRaw=raw.trim();if(trimmedRaw&&trimmedRaw.split(/\r?\n/).every(line=>/^\s*%/.test(line))){const lead=raw.search(/\S/),trail=(/\s*$/.exec(raw)||[''])[0].length,start=lead<0?s:s+lead,end=e-trail,clean=body.slice(start,end);const commentNote=/^\s*%\s*TeXFlow note:/i.test(clean),commentText=clean.replace(/^\s*%\s?/gm,'').replace(/^TeXFlow note:\s*/i,'');out.push({id:'b'+n++,kind:'comment',start,end,raw:clean,text:commentText,commentText,commentNote,align:currentAlign});return;}
  // Labels in ordinary document text are structural metadata, not raw visible
  // LaTeX. Split them out before the safety classification so a heading label
  // cannot force the following prose/citations into "LaTeX preserved".
  const labels=[...raw.matchAll(/\\label\{[^}]+\}/g)];
  if(labels.length){
   let local=0;
   for(const lm of labels){const at=lm.index||0;if(at>local)text(s+local,s+at);local=at+lm[0].length;}
   if(local<raw.length)text(s+local,e);
   return;
  }
  const nextAlign=alignmentFromDirective(raw,currentAlign);
  if(isOnlyAlignmentDirective(raw)){const lead=raw.search(/\S/),trail=(/\s*$/.exec(raw)||[''])[0].length,start=lead<0?s:s+lead,end=e-trail;out.push({id:'b'+n++,kind:'raw',start,end,raw:body.slice(start,end),text:body.slice(start,end).trim(),hidden:true,align:nextAlign});currentAlign=nextAlign;return;}
  const unsafe=/^(?:\s*%|\s*\\(?:newpage|clearpage|pagebreak)\b)/m.test(raw)||/\\(begin|end|input|include|hypertarget|label|only|visible|uncover|pause|vspace|includegraphics|tikz)/.test(raw);
  if(unsafe){const lead=raw.search(/\S/),trail=(/\s*$/.exec(raw)||[''])[0].length,start=lead<0?s:s+lead,end=e-trail,clean=body.slice(start,end);if(clean)out.push({id:'b'+n++,kind:'raw',start,end,raw:clean,text:clean,align:nextAlign});currentAlign=nextAlign;return;}
  // LaTeX blank lines are paragraph boundaries. Make each paragraph its own
  // semantic node and keep the blank-line separators outside editable ranges.
  const sep=/\n[ \t]*\n+/g;let local=0,sm;
  const pushPara=(a,b)=>{if(b<=a)return;const seg=raw.slice(a,b),lead=seg.search(/\S/);if(lead<0)return;const trail=(/\s*$/.exec(seg)||[''])[0].length,start=s+a+lead,end=s+b-trail;if(end<=start)return;const clean=body.slice(start,end);out.push({id:'b'+n++,kind:'paragraph',start,end,raw:clean,text:clean,align:nextAlign});};
  while((sm=sep.exec(raw))){pushPara(local,sm.index);local=sep.lastIndex;}pushPara(local,raw.length);currentAlign=nextAlign;
 }
 while((m=re.exec(body))){text(cur,m.index);
  if(m[0]==='$$'){const ep=body.indexOf('$$',re.lastIndex);if(ep<0)break;const end=ep+2,raw=body.slice(m.index,end),inner=body.slice(re.lastIndex,ep).trim();out.push({id:'b'+n++,kind:'equation',start:m.index,end,raw,env:'$$',text:inner,align:'center'});cur=end;re.lastIndex=end;continue;}
  if(m[4]!==undefined){const raw=m[0],d=figureData(raw);out.push({id:'b'+n++,kind:'figure',start:m.index,end:re.lastIndex,raw,env:'includegraphics',text:raw,align:d.align,figurePath:d.path,figureOptions:d.options,figureWidth:d.width.value,figureWidthUnit:d.width.unit,figureHeight:d.height.value,figureHeightUnit:d.height.unit,figureCaption:d.caption,figureShortCaption:d.shortCaption,figureAngle:d.angle,figureLabel:d.label,figurePlacement:d.placement,figureCaptionPosition:d.captionPosition});cur=re.lastIndex;continue;}
  if(m[6]!==undefined){const raw=m[0];out.push({id:'b'+n++,kind:'vspace',start:m.index,end:re.lastIndex,raw,text:raw,spaceAmount:String(m[6]||'').trim(),spaceStarred:m[5]==='*'});cur=re.lastIndex;continue;}
  if(m[7]!==undefined){const raw=m[0];out.push({id:'b'+n++,kind:'break',start:m.index,end:re.lastIndex,raw,text:raw,breakCommand:String(m[7]||'newpage')});cur=re.lastIndex;continue;}
  const env=m[1],token='\\end{'+env+'}',match=findMatchingEnvEnd(body,env,re.lastIndex);if(!match)break;const end=match.end,raw=body.slice(m.index,end),inner=raw.slice(m[0].length,raw.length-token.length).trim();let kind='raw';if(env==='itemize'||env==='enumerate')kind='itemize';else if(['block','alertblock','exampleblock'].includes(env))kind='block';else if(/^(equation|align|gather|multline)/.test(env))kind='equation';else if(env==='figure')kind='figure';else if(env==='table')kind='table';else if(env==='columns'||env==='multicols')kind='columns';else if(env==='quote'||env==='quotation')kind='quote';else if(env==='minipage')kind='container';else if(['theorem','lemma','proposition','corollary','definition','proof'].includes(env))kind='theorem';else if(['flushleft','center','flushright'].includes(env))kind='paragraph';const effectiveAlign=['flushleft','center','flushright'].includes(env)?(env==='flushleft'?'left':env==='flushright'?'right':'center'):kind==='equation'?'center':kind==='itemize'?(currentAlign==='justify'?'left':currentAlign):currentAlign;const b={id:'b'+n++,kind,start:m.index,end,raw,env,title:m[2]||'',text:inner,align:effectiveAlign};if(kind==='itemize')b.items=splitTopItems(inner);if(kind==='figure'){const d=figureData(raw);Object.assign(b,{align:d.align,figurePath:d.path,figureOptions:d.options,figureWidth:d.width.value,figureWidthUnit:d.width.unit,figureHeight:d.height.value,figureHeightUnit:d.height.unit,figureCaption:d.caption,figureShortCaption:d.shortCaption,figureAngle:d.angle,figureLabel:d.label,figurePlacement:d.placement,figureCaptionPosition:d.captionPosition})}if(kind==='columns'){if(env==='multicols'){b.columnCount=Math.max(2,Math.min(4,Number(m[2])||2));b.columnTexts=inner.split(/\\columnbreak\b/).map(x=>x.trim())}else{const ps=[...inner.matchAll(/\\column\{[^}]+\}([\s\S]*?)(?=\\column\{|$)/g)].map(x=>String(x[1]||'').trim());b.columnTexts=ps.length?ps:[inner];b.columnCount=b.columnTexts.length}}if(kind==='table'){const d=tableData(raw);if(!d.simple)b.kind='raw';else Object.assign(b,{tableSimple:true,tableColumns:d.columns,tableRows:d.rows,tableCaption:d.caption,tableLabel:d.label,tablePlacement:d.placement,tableCaptionPosition:d.captionPosition,tableStyle:d.tableStyle})}out.push(b);cur=end;re.lastIndex=end}text(cur,body.length);return out;
}
function applyPresentationStyle(){
 const st=presentationStyle||{};const w=Number(st.aspectWidth)||4,h=Number(st.aspectHeight)||3;
 const root=document.documentElement;root.style.setProperty('--slide-aspect',w+' / '+h);root.style.setProperty('--slide-aspect-number',String(w/h));root.style.setProperty('--slide-body-size',(Number(st.bodyFontPx)||16)+'px');root.style.setProperty('--slide-title-size',(Number(st.titleFontPx)||24.8)+'px');root.style.setProperty('--slide-line-height',String(Number(st.lineHeight)||1.28));
}
function frameVerticalClass(f){const o=String((f&&f.options)||'');if(/(?:^|[\[,])\s*t(?:\s|,|\]|$)/.test(o))return' v-top';if(/(?:^|[\[,])\s*b(?:\s|,|\]|$)/.test(o))return' v-bottom';return' v-center';}
function frameTextSizeValue(f){const m=/^(?:(?:\s+)|(?:[ \t]*%[^\n]*(?:\r?\n|$)))*\\(normalsize|small|footnotesize|scriptsize|tiny)\b/.exec(String((f&&f.body)||''));return !m||m[1]==='normalsize'?'normal':m[1];}
function frameTextSizeClass(f){const size=frameTextSizeValue(f);return size==='normal'?'':' frame-size-'+size;}
function updateFrameTextSizeMenu(){const active=frameTextSizeValue(frames[current]);document.querySelectorAll('.frame-size-option').forEach(btn=>{const size=String(btn.dataset.frameSize||'normal');const label=size==='footnotesize'?'Footnotesize':size==='scriptsize'?'Scriptsize':size==='tiny'?'Tiny':size==='small'?'Small':'Normal';btn.textContent=(size===active?'✓ ':'')+label;});}
function updateSlideFit(slide){
 if(!slide)return;let badge=slide.querySelector('.slide-fit');if(!badge){badge=document.createElement('div');badge.className='slide-fit';slide.appendChild(badge);}
 const overflowing=slide.scrollHeight>slide.clientHeight+3;slide.classList.toggle('overflowing',overflowing);badge.classList.toggle('overflow',overflowing);
 badge.textContent=overflowing?'Content overflow':((presentationStyle&&presentationStyle.aspectLabel)||'4:3')+' · '+((presentationStyle&&presentationStyle.baseFontPt)||11)+'pt';
}
function scheduleSlideFit(slide){requestAnimationFrame(()=>requestAnimationFrame(()=>updateSlideFit(slide)));}
function closePreambleEditor(){preambleDirty=false;preambleOriginalText='';mode='frames';renderWorkspace();}
function renderPreamble(id){
 mode='preamble';currentPreamble=id||currentPreamble;renderNav();const info=preambles.find(x=>x.id===currentPreamble)||preambles[0];const c=document.getElementById('content');if(!info){c.innerHTML='<div class="empty">No preamble source found.</div>';return;}currentPreamble=info.id;const ds=documentSettings||{},options=preambles.map(x=>'<option value="'+esc(x.id)+'"'+(x.id===info.id?' selected':'')+'>'+esc(x.label)+'</option>').join('');
 const field=(label,html,wide=false)=>'<label class="settings-field'+(wide?' wide':'')+'"><span>'+label+'</span>'+html+'</label>';
 const select=(id,values,value)=>'<select id="'+id+'">'+values.map(x=>'<option value="'+x[0]+'"'+(String(value)===String(x[0])?' selected':'')+'>'+x[1]+'</option>').join('')+'</select>';
 let settings='<section class="settings-card"><h3>Document settings</h3><div class="settings-grid">';
 settings+=field('Base font size',select('ds-font',[['10pt','10 pt'],['11pt','11 pt'],['12pt','12 pt']],ds.fontSize||'12pt'));
 settings+=field('Paper',select('ds-paper',[['a4paper','A4'],['a5paper','A5'],['letterpaper','Letter'],['legalpaper','Legal']],ds.paper||'a4paper'));
 settings+=field('Orientation',select('ds-orientation',[['portrait','Portrait'],['landscape','Landscape']],ds.orientation||'portrait'));
 settings+=field('Global columns',select('ds-columns',[['one','One column'],['two','Two columns']],ds.globalColumns||'one'));
 settings+=field('Language','<input id="ds-language" value="'+esc(ds.language||'')+'" placeholder="spanish">');
 settings+=field('Line spacing',select('ds-lines',[['single','Single'],['onehalf','1.5'],['double','Double']],ds.lineSpacing||'single'));
 settings+=field('Default alignment',select('ds-align',[['justify','Justified'],['left','Left'],['center','Centered'],['right','Right']],ds.defaultAlignment||'justify'));
 settings+=field('Margins','<input id="ds-margin" value="'+esc(ds.margin||'')+'" placeholder="2.5cm">');
 settings+=field('Paragraph indent','<input id="ds-parindent" value="'+esc(ds.paragraphIndent||'')+'" placeholder="1.5em">');
 settings+=field('Paragraph spacing','<input id="ds-parskip" value="'+esc(ds.paragraphSkip||'')+'" placeholder="6pt">');
 settings+=field('PDF links',select('ds-hyperlinks',[['off','Preserve existing'],['on','Enable hyperref']],ds.hyperlinks?'on':'off'));
 if(isBeamer){settings+=field('Aspect ratio',select('ds-aspect',[['43','4:3'],['169','16:9'],['1610','16:10'],['149','14:9']],ds.beamerAspect||'43'));settings+=field('Theme','<input id="ds-theme" value="'+esc(ds.beamerTheme||'default')+'" placeholder="Madrid">');}
 settings+=field('Additional packages','<textarea id="ds-packages" rows="3" placeholder="microtype, xcolor[dvipsnames]">'+esc(ds.extraPackages||'')+'</textarea>',true);settings+='</div><div class="settings-note">TeXFlow changes recognized settings only. Unknown commands and packages remain in the raw preamble.</div><div class="settings-actions"><button id="ds-save">Apply settings</button></div></section>';
 c.innerHTML='<div class="settings-shell">'+settings+'<section class="settings-card"><div class="preamble-head"><select id="preamble-select">'+options+'</select><button class="secondary" id="preamble-cancel">Close</button><button class="secondary" id="preamble-source">Open source</button><button id="preamble-save">Save raw preamble</button></div><textarea id="preamble-code" class="preamble-code" spellcheck="false"></textarea><div class="settings-note">Use Raw LaTeX for custom commands and settings TeXFlow does not manage.</div></section></div>';
 const ta=document.getElementById('preamble-code'),cancel=document.getElementById('preamble-cancel'),save=document.getElementById('preamble-save');ta.value=info.text;preambleOriginalText=info.text;preambleDirty=false;const updateDirty=()=>{preambleDirty=ta.value!==preambleOriginalText;cancel.textContent=preambleDirty?'Cancel':'Close';save.disabled=!preambleDirty;};updateDirty();ta.addEventListener('input',updateDirty);document.getElementById('preamble-select').onchange=e=>{if(preambleDirty&&!confirm('Discard unsaved preamble changes?')){e.target.value=currentPreamble;return;}renderPreamble(e.target.value);};save.onclick=()=>{preambleOriginalText=ta.value;preambleDirty=false;updateDirty();vscode.postMessage({type:'savePreamble',preambleId:currentPreamble,text:ta.value});};cancel.onclick=()=>closePreambleEditor();document.getElementById('preamble-source').onclick=()=>{if(preambleDirty&&!confirm('Open source and discard unsaved preamble changes?'))return;preambleDirty=false;vscode.postMessage({type:'revealPreamble',preambleId:currentPreamble});};document.getElementById('ds-save').onclick=()=>{const settings={fontSize:document.getElementById('ds-font').value,paper:document.getElementById('ds-paper').value,orientation:document.getElementById('ds-orientation').value,globalColumns:document.getElementById('ds-columns').value,language:document.getElementById('ds-language').value,lineSpacing:document.getElementById('ds-lines').value,defaultAlignment:document.getElementById('ds-align').value,margin:document.getElementById('ds-margin').value,paragraphIndent:document.getElementById('ds-parindent').value,paragraphSkip:document.getElementById('ds-parskip').value,hyperlinks:document.getElementById('ds-hyperlinks').value==='on',extraPackages:document.getElementById('ds-packages').value};if(isBeamer){settings.beamerAspect=document.getElementById('ds-aspect').value;settings.beamerTheme=document.getElementById('ds-theme').value;}vscode.postMessage({type:'saveDocumentSettings',settings});};if(window.innerWidth<900&&typeof setNav==='function')setNav(false);
}
function currentSource(){const f=frames[current];return sources.find(x=>x.uri===(f&&f.sourceUri))||sources.find(x=>x.uri===rootUri)||sources[0];}
function sourceEditorHtml(compact=false){const src=currentSource();if(!src)return'<div class="empty">No LaTeX source loaded.</div>';const options=sources.map(x=>'<option value="'+esc(x.uri)+'"'+(x.uri===src.uri?' selected':'')+'>'+esc(x.label)+'</option>').join('');return'<section class="source-shell"><div class="source-head"><select class="source-select">'+options+'</select><button class="source-save">Save source</button></div><textarea class="source-code" spellcheck="false"></textarea></section>';}
function bindSourceEditor(host){const src=currentSource();if(!src)return;const ta=host.querySelector('.source-code');if(!ta)return;ta.value=src.text;host.querySelector('.source-select').onchange=e=>{const target=sources.find(x=>x.uri===e.target.value);if(target){const fIndex=frames.findIndex(f=>f.sourceUri===target.uri);if(fIndex>=0)current=fIndex;renderWorkspace();}};host.querySelector('.source-save').onclick=()=>vscode.postMessage({type:'saveSource',uri:src.uri,text:ta.value});}
function visualFrameHtml(f){if(!f)return'<div class="empty">No Beamer frames found.</div>';const v=frameVerticalClass(f),z=frameTextSizeClass(f);if(/\\(?:titlepage|maketitle)\b/.test(f.body))return'<article class="slide title-page align-center'+v+z+'"><div class="blocks-host"><div class="title align-center">'+latexToHtml(metadata.title||'Untitled presentation')+'</div>'+(metadata.subtitle?'<div style="font-size:1.25em;margin:.5em 0 1.6em">'+latexToHtml(metadata.subtitle)+'</div>':'')+'<div style="font-size:1.08em;margin-top:2.5em">'+latexToHtml(metadata.author||'')+'</div>'+(metadata.institute?'<div style="margin-top:.75em;color:var(--muted)">'+latexToHtml(metadata.institute)+'</div>':'')+(metadata.date?'<div style="margin-top:2em">'+latexToHtml(metadata.date)+'</div>':'')+'</div></article>';return'<article class="slide'+v+z+'"><div class="title" contenteditable="true">'+esc(f.title)+'</div><div class="blocks-host"></div></article>';}
function bindVisualFrame(host,i){const f=frames[i];if(!f||/\\(?:titlepage|maketitle)\b/.test(f.body))return;const title=host.querySelector('.title');attachEditor(title);const saveTitle=refresh=>vscode.postMessage({type:'updateFrameTitle',frameIndex:i,title:editorToLatex(title),refresh});title.addEventListener('input',()=>scheduleSave(title,saveTitle));title.addEventListener('blur',()=>flushSave(title,saveTitle));const blockHost=host.querySelector('.blocks-host');const parsed=parseBlocks(f.body);parsed.forEach(b=>blockHost.appendChild(renderBlock(b,i)));if(!parsed.length){const empty=document.createElement('div');empty.className='block paragraph empty-frame-body';empty.contentEditable='true';empty.dataset.placeholder='Start typing slide content…';attachEditor(empty);const saveEmpty=refresh=>vscode.postMessage({type:'updateEmptyFrameBody',frameIndex:i,text:editorToLatex(empty),refresh});empty.__texflowCommit=(text)=>vscode.postMessage({type:'updateEmptyFrameBody',frameIndex:i,text,refresh:true});empty.__texflowSaveNow=()=>saveEmpty(false);empty.addEventListener('input',()=>scheduleSave(empty,saveEmpty));empty.addEventListener('blur',()=>flushSave(empty,saveEmpty));blockHost.appendChild(empty);}else{const trailing=document.createElement('div');trailing.className='trailing-paragraph editable';trailing.contentEditable='true';trailing.dataset.placeholder='Continue typing…';attachEditor(trailing);let saved='';const saveTrailing=refresh=>{const text=editableLatex(trailing);vscode.postMessage({type:'updateTrailingParagraph',frameIndex:i,previous:saved,text,refresh});saved=text;};trailing.__texflowCommit=(text)=>{setEditableLatex(trailing,text);vscode.postMessage({type:'updateTrailingParagraph',frameIndex:i,previous:saved,text,refresh:true});saved=text;};trailing.__texflowSaveNow=()=>saveTrailing(false);trailing.addEventListener('input',()=>scheduleSave(trailing,saveTrailing));trailing.addEventListener('blur',()=>flushSave(trailing,saveTrailing));blockHost.appendChild(trailing);}title.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();flushSave(title,saveTitle);const target=blockHost.querySelector('[contenteditable=true]');if(target){target.focus();const r=document.createRange();r.selectNodeContents(target);r.collapse(true);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);}}});;const slide=host.querySelector('.slide');if(slide){scheduleSlideFit(slide);slide.addEventListener('input',()=>scheduleSlideFit(slide));}}
function renderWorkspace(){mode='frames';current=Math.max(0,Math.min(current,frames.length-1));renderNav();updateFrameTextSizeMenu();document.querySelectorAll('.mode-tab').forEach(x=>x.classList.toggle('active',x.dataset.view===viewMode));const c=document.getElementById('content');c.className='workspace';if(viewMode==='source'){c.innerHTML=sourceEditorHtml();bindSourceEditor(c);return;}if(viewMode==='pdf'){const hasPdf=!!pdfUri;const status=pdfBuildState==='building'?'Compiling…':pdfBuildState==='error'?pdfBuildMessage:(hasPdf?(pdfBuildMessage||'PDF ready.'):'No compiled PDF found.');c.innerHTML='<section class="pdf-shell"><div class="pdf-head"><span>Compiled PDF</span><button class="top-action" id="pdf-refresh">Refresh</button>'+(hasPdf?'<button class="top-action" id="pdf-open">Open PDF</button>':'')+'<button class="top-action primary" id="pdf-compile">Compile</button></div><div class="pdf-empty"><div><div style="font-size:28px;margin-bottom:12px">'+(pdfBuildState==='building'?'⏳':pdfBuildState==='error'?'⚠':'✓')+'</div><div>'+esc(status)+'</div>'+(hasPdf?'<div style="margin-top:8px;font-size:12px">TeXFlow uses the native VS Code PDF viewer to avoid the blank grey embedded-PDF bug.</div>':'')+'</div></div></section>';document.getElementById('pdf-refresh').onclick=()=>vscode.postMessage({type:'refreshPdf'});const open=document.getElementById('pdf-open');if(open)open.onclick=()=>vscode.postMessage({type:'openPdf'});document.getElementById('pdf-compile').onclick=()=>vscode.postMessage({type:'compile'});return;}if(!isBeamer){if(viewMode==='split'){c.innerHTML='<div class="split-workspace"><div class="split-pane visual-pane document-pane">'+visualDocumentHtml()+'</div><div class="split-pane source-pane">'+sourceEditorHtml(true)+'</div></div>';bindVisualDocument(c.querySelector('.visual-pane'));bindSourceEditor(c.querySelector('.source-pane'));return;}c.innerHTML=visualDocumentHtml();bindVisualDocument(c);return;}if(viewMode==='split'){c.innerHTML='<div class="split-workspace"><div class="split-pane visual-pane">'+visualFrameHtml(frames[current])+'</div><div class="split-pane source-pane">'+sourceEditorHtml(true)+'</div></div>';bindVisualFrame(c.querySelector('.visual-pane'),current);scheduleSlideFit(c.querySelector('.visual-pane .slide'));bindSourceEditor(c.querySelector('.source-pane'));return;}c.innerHTML=visualFrameHtml(frames[current]);bindVisualFrame(c,current);scheduleSlideFit(c.querySelector('.slide'));}
function renderFrame(i){current=i;renderWorkspace();if(window.innerWidth<900&&typeof setNav==='function')setNav(false);}
function renderBlock(b,fi){const wrap=document.createElement('div');wrap.className='block '+alignClass(b.align,b.kind==='itemize'?'left':'justify');if(b.hidden){wrap.style.display='none';return wrap;}
 if(b.kind==='vspace'){wrap.className+=' vspace-block semantic-block';wrap.innerHTML='<span class="vspace-label">vertical '+esc((b.spaceStarred?'* ':'')+(b.spaceAmount||''))+'</span>';bindSemanticBlockSelection(wrap,()=>vscode.postMessage({type:'deleteBlock',frameIndex:fi,blockId:b.id}));return wrap;}
 if(b.kind==='paragraph'){wrap.innerHTML='<div class="editable '+alignClass(b.align,'justify')+'" contenteditable="true">'+latexToHtml(b.text)+'</div>';const e=wrap.firstChild;attachEditor(e);const saveParagraph=refresh=>{const msg={type:'updateBlock',frameIndex:fi,blockId:b.id,payload:{text:editableLatex(e)},refresh};vscode.postMessage(msg);};e.__texflowCommit=(text)=>{const msg={type:'updateBlock',frameIndex:fi,blockId:b.id,payload:{text},refresh:true};vscode.postMessage(msg);};e.__texflowSaveNow=()=>saveParagraph(false);e.addEventListener('input',()=>scheduleSave(e,saveParagraph));e.addEventListener('blur',()=>flushSave(e,saveParagraph));}
 else if(b.kind==='itemize'){const list=createVisualList(b.env,b.items||[]);list.classList.add(alignClass(b.align,'left'));const saveList=refresh=>vscode.postMessage({type:'updateBlock',frameIndex:fi,blockId:b.id,payload:{items:listItemsPayload(list)},refresh});list.querySelectorAll('.item-text').forEach(edit=>{edit.__texflowCommit=(text)=>{setEditableLatex(edit,text);vscode.postMessage({type:'updateBlock',frameIndex:fi,blockId:b.id,payload:{items:listItemsPayload(list)},refresh:true});};});bindListEditing(list,saveList);wrap.appendChild(list)}
 else if(b.kind==='block'){wrap.className+=' beamer-block '+(b.env==='alertblock'?'alert':b.env==='exampleblock'?'example':'');wrap.innerHTML='<div class="head" contenteditable="true">'+latexToHtml(b.title)+'</div><div class="body editable '+alignClass(b.align,'justify')+'" contenteditable="true">'+latexToHtml(b.text)+'</div>';const blockHead=wrap.querySelector('.head'),blockBody=wrap.querySelector('.body');attachEditor(blockHead);attachEditor(blockBody);const saveBlock=refresh=>{const msg={type:'updateBlock',frameIndex:fi,blockId:b.id,payload:{title:editorToLatex(blockHead),text:editableLatex(blockBody)},refresh};vscode.postMessage(msg);};blockHead.__texflowCommit=(text)=>{setEditableLatex(blockHead,text);saveBlock(true);};blockHead.__texflowSaveNow=()=>saveBlock(false);blockBody.__texflowCommit=(text)=>{setEditableLatex(blockBody,text);saveBlock(true);};blockBody.__texflowSaveNow=()=>saveBlock(false);wrap.addEventListener('focusout',()=>saveBlock(false));}
 else if(b.kind==='equation'){wrap.className+=' math';wrap.innerHTML='<div class="render"></div>';let previewText=String(b.text||'').replace(/\\label\{[^}]+\}/g,'').replace(/\\(?:notag|nonumber)\b/g,'');if(/^align/.test(String(b.env||'')))previewText='\\begin{aligned}'+previewText+'\\end{aligned}';try{katex.render(previewText,wrap.querySelector('.render'),{displayMode:true,throwOnError:false})}catch{}wrap.title='Double-click to edit equation';wrap.addEventListener('dblclick',()=>openMathEditor(b,fi));}
 else if(b.kind==='figure'){renderFigure(b,fi,wrap);}
 else if(b.kind==='table'){renderTable(b,fi,wrap);}
 else if(b.kind==='columns'){renderColumns(b,fi,wrap);}
 else if(b.kind==='break'){wrap.className+=' doc-break';wrap.textContent=b.breakCommand||'newpage';}
 else if(b.kind==='comment'){wrap.className+=' doc-rich-block comment';wrap.innerHTML='<div class="doc-rich-label">'+(b.commentNote?'Author note':'Source comment')+' · not in PDF</div><div class="editable doc-rich-edit" contenteditable="true">'+esc(b.commentText||b.text||'')+'</div>';const edit=wrap.querySelector('.doc-rich-edit');attachEditor(edit);const save=refresh=>{const msg={type:'updateBlock',frameIndex:fi,blockId:b.id,payload:{text:editableLatex(edit)},refresh};vscode.postMessage(msg);};edit.__texflowCommit=text=>{setEditableLatex(edit,text);save(true);};edit.__texflowSaveNow=()=>save(false);edit.addEventListener('input',()=>scheduleSave(edit,save));edit.addEventListener('blur',()=>flushSave(edit,save));}
 else if(b.kind==='quote'||b.kind==='container'||b.kind==='theorem'){wrap.className+=' doc-rich-block '+b.kind;wrap.innerHTML='<div class="doc-rich-label">'+esc(b.env||b.kind)+'</div><div class="editable doc-rich-edit" contenteditable="true">'+latexToHtml(b.text||'')+'</div>';const edit=wrap.querySelector('.doc-rich-edit');attachEditor(edit);const save=refresh=>{const msg={type:'updateBlock',frameIndex:fi,blockId:b.id,payload:{text:editableLatex(edit)},refresh};vscode.postMessage(msg);};edit.__texflowCommit=text=>{setEditableLatex(edit,text);save(true);};edit.__texflowSaveNow=()=>save(false);edit.addEventListener('input',()=>scheduleSave(edit,save));edit.addEventListener('blur',()=>flushSave(edit,save));}
 else {wrap.className+=' '+b.kind;wrap.innerHTML='<div class="tag">'+esc(b.kind)+' — preserved as LaTeX</div><pre>'+esc(b.raw)+'</pre>'}
 if(['equation','figure','table','columns','break','quote','container','theorem','comment'].includes(b.kind))bindSemanticBlockSelection(wrap,()=>vscode.postMessage({type:'deleteBlock',frameIndex:fi,blockId:b.id}));
 return wrap;}

function renderColumns(block,frameIndex,wrap){
 const texts=block.columnTexts||[block.text||''],count=Math.max(2,Math.min(4,Number(block.columnCount)||texts.length||2));wrap.className+=' columns-card semantic-block';wrap.innerHTML='<div class="columns-head"><span class="tag">'+(block.env==='multicols'?'Document columns':'Beamer columns')+'</span><span>'+count+' columns</span></div><div class="columns-grid" style="grid-template-columns:repeat('+count+',minmax(0,1fr))">'+Array.from({length:count},(_,i)=>'<div class="column-edit editable" contenteditable="true" data-col="'+i+'">'+latexToHtml(texts[i]||'')+'</div>').join('')+'</div>';
 const edits=[...wrap.querySelectorAll('.column-edit')];edits.forEach(e=>attachEditor(e));const save=refresh=>{const msg={type:'updateBlock',frameIndex,blockId:block.id,payload:{count,texts:edits.map(e=>editableLatex(e))},refresh};vscode.postMessage(msg);};edits.forEach(e=>{e.__texflowCommit=text=>{setEditableLatex(e,text);save(true);};e.__texflowSaveNow=()=>save(false);e.addEventListener('input',()=>scheduleSave(e,save));e.addEventListener('blur',()=>flushSave(e,save));});
}

function renderTable(block,frameIndex,wrap){
 wrap.className+=' table-card';const cols=block.tableColumns||[],rows=block.tableRows||[],caption=block.tableCaption||'',label=block.tableLabel||'',captionPosition=block.tableCaptionPosition||'below';
 const colTools=cols.map((c,i)=>'<label>C'+(i+1)+' <select class="table-col-align" data-col="'+i+'"><option value="l"'+(c==='l'?' selected':'')+'>L</option><option value="c"'+(c==='c'?' selected':'')+'>C</option><option value="r"'+(c==='r'?' selected':'')+'>R</option></select></label>').join('');
 const body=rows.map((r,ri)=>'<tr>'+r.map((cell,ci)=>'<td class="table-cell editable" data-row="'+ri+'" data-col="'+ci+'" contenteditable="true">'+latexToHtml(cell||'')+'</td>').join('')+'</tr>').join('');
 wrap.innerHTML='<div class="table-head"><span class="tag">Table</span><div class="table-controls"><label>Caption <select class="table-caption-position-input"><option value="below"'+(captionPosition==='below'?' selected':'')+'>Below</option><option value="above"'+(captionPosition==='above'?' selected':'')+'>Above</option></select></label></div></div><div class="table-column-tools">'+colTools+'</div><div class="table-scroll"><table class="semantic-table"><tbody>'+body+'</tbody></table></div><div class="table-actions"><button type="button" class="table-add-row">+ Row</button><button type="button" class="table-del-row">− Row</button><button type="button" class="table-add-col">+ Column</button><button type="button" class="table-del-col">− Column</button></div><div class="table-fields"><label>Caption <input class="table-caption-input" type="text" value="'+esc(caption)+'"></label><label>Label <input class="table-label-input" type="text" value="'+esc(label)+'"></label></div>';
 const table=wrap.querySelector('.semantic-table'),captionInput=wrap.querySelector('.table-caption-input'),labelInput=wrap.querySelector('.table-label-input'),captionPositionInput=wrap.querySelector('.table-caption-position-input');
 function payload(){return{rows:[...table.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>editableLatex(td))),columns:[...wrap.querySelectorAll('.table-col-align')].map(x=>x.value),caption:captionInput?captionInput.value:'',label:labelInput?labelInput.value:'',captionPosition:captionPositionInput?captionPositionInput.value:'below'};}
 const save=(refresh=true)=>vscode.postMessage({type:'updateBlock',frameIndex,blockId:block.id,payload:payload(),refresh});
 function focusBeamerCell(target,atEnd=false){if(!target)return;target.focus();const r=document.createRange();r.selectNodeContents(target);r.collapse(!atEnd);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);}
 function beamerCaretBoundary(cell,which){const sel=getSelection();if(!sel||!sel.rangeCount)return false;const r=sel.getRangeAt(0);if(!r.collapsed||!cell.contains(r.startContainer))return false;const test=r.cloneRange();if(which==='start'){test.selectNodeContents(cell);test.setEnd(r.startContainer,r.startOffset);return test.toString().length===0;}test.selectNodeContents(cell);test.setStart(r.startContainer,r.startOffset);return test.toString().length===0;}
 wrap.querySelectorAll('.table-cell').forEach(cell=>{attachEditor(cell);cell.addEventListener('blur',()=>save(false));cell.addEventListener('keydown',e=>{const cells=[...wrap.querySelectorAll('.table-cell')],i=cells.indexOf(cell),ncols=Math.max(1,[...table.querySelectorAll('tbody tr:first-child td')].length),row=Math.floor(i/ncols),col=i%ncols;let target=null,atEnd=false;if(e.key==='Tab'){target=cells[(i+(e.shiftKey?-1:1)+cells.length)%cells.length];atEnd=!!e.shiftKey;}else if(e.key==='ArrowRight'&&beamerCaretBoundary(cell,'end'))target=cells[i+1]||null;else if(e.key==='ArrowLeft'&&beamerCaretBoundary(cell,'start')){target=cells[i-1]||null;atEnd=true;}else if(e.key==='ArrowDown'&&beamerCaretBoundary(cell,'end'))target=cells[(row+1)*ncols+col]||null;else if(e.key==='ArrowUp'&&beamerCaretBoundary(cell,'start')){target=row>0?cells[(row-1)*ncols+col]:null;atEnd=true;}else if(e.key==='Enter'){e.preventDefault();insertSoftBreak();return;}if(target){e.preventDefault();focusBeamerCell(target,atEnd);}});});
 wrap.querySelectorAll('.table-col-align').forEach(x=>x.onchange=()=>save(true));if(captionInput)captionInput.onchange=()=>save(true);if(labelInput)labelInput.onchange=()=>save(true);if(captionPositionInput)captionPositionInput.onchange=()=>save(true);
 const mutate=(fn)=>{const p=payload();if(fn(p)!==false)vscode.postMessage({type:'updateBlock',frameIndex,blockId:block.id,payload:p,refresh:true});};
 wrap.querySelector('.table-add-row').onclick=()=>mutate(p=>p.rows.push(Array.from({length:p.columns.length},()=>'')));
 wrap.querySelector('.table-del-row').onclick=()=>mutate(p=>{if(p.rows.length<=1){vscode.postMessage({type:'showWarning',message:'A table must keep at least one row.'});return false;}p.rows.pop();});
 wrap.querySelector('.table-add-col').onclick=()=>mutate(p=>{if(p.columns.length>=12){vscode.postMessage({type:'showWarning',message:'TeXFlow tables currently support up to 12 columns.'});return false;}p.columns.push('c');p.rows=p.rows.map(r=>[...r,'']);});
 wrap.querySelector('.table-del-col').onclick=()=>mutate(p=>{if(p.columns.length<=1){vscode.postMessage({type:'showWarning',message:'A table must keep at least one column.'});return false;}p.columns.pop();p.rows=p.rows.map(r=>r.slice(0,-1));});
}

function figureResource(block,frameIndex){const frame=frames[frameIndex]||{},key=(frame.sourceUri||'')+'|'+(block.figurePath||'');return figureResources[key]||figureResources['*|'+(block.figurePath||'')]||null;}
function relativeWidth(block){const unit=block.figureWidthUnit||'\\linewidth',value=Number(block.figureWidth);if(['\\linewidth','\\textwidth','\\columnwidth','\\paperwidth'].includes(unit)&&value>0)return Math.max(8,Math.min(100,value*100));return 70;}
function relativeHeight(block){const unit=block.figureHeightUnit||'\\textheight',value=Number(block.figureHeight);if(unit==='\\textheight'&&value>0)return Math.max(8,Math.min(100,value*100));return 0;}
function renderFigure(block,frameIndex,wrap){
 wrap.className+=' figure figure-card';const res=figureResource(block,frameIndex),width=relativeWidth(block),height=relativeHeight(block),caption=block.figureCaption||'',figLabel=block.figureLabel||'',placement=block.figurePlacement||'',captionPosition=block.figureCaptionPosition||'below',align=block.figureAlign||block.align||'center',isFloat=String(block.env||'')==='figure';
 wrap.innerHTML='<div class="figure-head"><span class="tag">Figure</span><span class="figure-name">'+esc(block.figurePath||'image')+'</span><div class="figure-controls"><label><input class="figure-lock" type="checkbox" checked> lock</label><label>W <input class="figure-width-input" type="number" min="5" max="100" step="1" value="'+Math.round(width)+'">%</label><label class="height-control" style="display:none">H <input class="figure-height-input" type="number" min="5" max="100" step="1" value="'+Math.round(height||40)+'">%</label>'+(isFloat?'<label>Align <select class="figure-align-input"><option value="left"'+(align==='left'?' selected':'')+'>Left</option><option value="center"'+(align==='center'?' selected':'')+'>Center</option><option value="right"'+(align==='right'?' selected':'')+'>Right</option></select></label><label>Caption <select class="figure-caption-position-input"><option value="below"'+(captionPosition==='below'?' selected':'')+'>Below</option><option value="above"'+(captionPosition==='above'?' selected':'')+'>Above</option></select></label>':'')+'</div></div><div class="figure-stage '+alignClass(align,'center')+'"><div class="figure-visual'+(res&&res.isPdf?' pdf':'')+'" style="width:'+width+'%"><div class="figure-media"></div><span class="figure-size">'+Math.round(width)+'%</span><span class="figure-resize" title="Drag to resize"></span></div></div>'+(isFloat?'<div class="doc-figure-fields"><label>Caption <input class="figure-caption-input" type="text" value="'+esc(caption)+'"></label><label>Label <input class="figure-label-input" type="text" value="'+esc(figLabel)+'" spellcheck="false"></label></div>':'')+(caption?'<div class="figure-caption">'+latexToHtml(caption)+'</div>':'');
 const visual=wrap.querySelector('.figure-visual'),media=wrap.querySelector('.figure-media'),stage=wrap.querySelector('.figure-stage'),lock=wrap.querySelector('.figure-lock'),wi=wrap.querySelector('.figure-width-input'),hi=wrap.querySelector('.figure-height-input'),hc=wrap.querySelector('.height-control'),sizeLabel=wrap.querySelector('.figure-size'),captionInput=wrap.querySelector('.figure-caption-input'),labelInput=wrap.querySelector('.figure-label-input'),alignInput=wrap.querySelector('.figure-align-input'),captionPositionInput=wrap.querySelector('.figure-caption-position-input');
 const slide=wrap.closest('.slide');function heightPixels(percent){return Math.max(55,(slide?slide.clientHeight:620)*percent/100)}if(height)visual.style.height=heightPixels(height)+'px';
 if(res){if(res.isPdf)media.innerHTML='<object data="'+esc(res.uri)+'#toolbar=0&navpanes=0" type="application/pdf" aria-label="'+esc(block.figurePath)+'"><div class="figure-placeholder">PDF figure<br>'+esc(block.figurePath)+'</div></object>';else if(['png','jpg','jpeg','svg','webp','gif'].includes(res.extension))media.innerHTML='<img src="'+esc(res.uri)+'" alt="'+esc(block.figurePath)+'">';else media.innerHTML='<div class="figure-placeholder">Preview unavailable<br>'+esc(block.figurePath)+'</div>';}else media.innerHTML='<div class="figure-placeholder">Figure not found<br>'+esc(block.figurePath||'')+'</div>';
 function save(){const w=Math.max(5,Math.min(100,Number(wi.value)||70))/100,h=lock.checked?0:Math.max(5,Math.min(100,Number(hi.value)||40))/100;vscode.postMessage({type:'updateBlock',frameIndex,blockId:block.id,payload:{width:w,widthUnit:block.figureWidthUnit||'\\linewidth',height:h,heightUnit:block.figureHeightUnit||'\\textheight',keepAspect:lock.checked,caption:captionInput?captionInput.value:caption,label:labelInput?labelInput.value:figLabel,align:alignInput?alignInput.value:align,placement,captionPosition:captionPositionInput?captionPositionInput.value:'below'}})}
 function applyInputs(){const w=Math.max(5,Math.min(100,Number(wi.value)||70));visual.style.width=w+'%';sizeLabel.textContent=Math.round(w)+'%';if(!lock.checked){const h=Math.max(5,Math.min(100,Number(hi.value)||40));visual.style.height=heightPixels(h)+'px'}else visual.style.height='';}
 lock.onchange=()=>{hc.style.display=lock.checked?'none':'flex';applyInputs();save()};wi.onchange=()=>{applyInputs();save()};hi.onchange=()=>{applyInputs();save()};if(captionInput)captionInput.onchange=save;if(labelInput)labelInput.onchange=save;if(alignInput)alignInput.onchange=()=>{stage.classList.remove('align-left','align-center','align-right','align-justify');stage.classList.add(alignClass(alignInput.value,'center'));save()};if(captionPositionInput)captionPositionInput.onchange=save;
 const handle=wrap.querySelector('.figure-resize');handle.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();handle.setPointerCapture(e.pointerId);document.body.classList.add('figure-resizing');const sr=stage.getBoundingClientRect(),vr=visual.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,sw=vr.width,sh=vr.height;function move(ev){const nw=Math.max(sr.width*.08,Math.min(sr.width,sw+(ev.clientX-sx))),wp=nw/sr.width*100;wi.value=String(Math.round(wp));visual.style.width=wp+'%';sizeLabel.textContent=Math.round(wp)+'%';if(!lock.checked){const nh=Math.max(55,sh+(ev.clientY-sy)),hp=Math.min(100,nh/Math.max(1,(slide?slide.clientHeight:620))*100);hi.value=String(Math.round(hp));visual.style.height=hp+'%'}}function up(ev){handle.releasePointerCapture(ev.pointerId);handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',up);document.body.classList.remove('figure-resizing');save()}handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',up)});
}

const mathSymbols={
 Greek:[['α','\\alpha'],['β','\\beta'],['γ','\\gamma'],['δ','\\delta'],['ε','\\epsilon'],['ζ','\\zeta'],['η','\\eta'],['θ','\\theta'],['ι','\\iota'],['κ','\\kappa'],['λ','\\lambda'],['μ','\\mu'],['ν','\\nu'],['ξ','\\xi'],['π','\\pi'],['ρ','\\rho'],['σ','\\sigma'],['τ','\\tau'],['φ','\\phi'],['χ','\\chi'],['ψ','\\psi'],['ω','\\omega'],['Γ','\\Gamma'],['Δ','\\Delta'],['Θ','\\Theta'],['Λ','\\Lambda'],['Ξ','\\Xi'],['Π','\\Pi'],['Σ','\\Sigma'],['Φ','\\Phi'],['Ψ','\\Psi'],['Ω','\\Omega']],
 Relations:[['=','='],['≠','\\neq'],['<','<'],['>','>'],['≤','\\leq'],['≥','\\geq'],['≈','\\approx'],['≡','\\equiv'],['∼','\\sim'],['≃','\\simeq'],['∝','\\propto'],['∈','\\in'],['∉','\\notin'],['⊂','\\subset'],['⊆','\\subseteq'],['⊃','\\supset'],['⊇','\\supseteq'],['≪','\\ll'],['≫','\\gg'],['⊥','\\perp']],
 Operators:[['±','\\pm'],['∓','\\mp'],['×','\\times'],['÷','\\div'],['·','\\cdot'],['∑','\\sum'],['∏','\\prod'],['∫','\\int'],['∮','\\oint'],['∞','\\infty'],['∂','\\partial'],['∇','\\nabla'],['√','\\sqrt{}'],['|x|','\\left|  \\right|'],['⌈ ⌉','\\left\\lceil  \\right\\rceil'],['⌊ ⌋','\\left\\lfloor  \\right\\rfloor'],['min','\\min'],['max','\\max'],['lim','\\lim'],['log','\\log']],
 Structures:[['a/b','\\frac{}{}'],['x²','^{}'],['xᵢ','_{}'],['( )','\\left(  \\right)'],['[ ]','\\left[  \\right]'],['{ }','\\left\\{  \\right\\}'],['Σ','\\sum_{}^{}'],['∫','\\int_{}^{}'],['lim','\\lim_{}'],['2×2','\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'],['cases','\\begin{cases}  &  \\\\  &  \\end{cases}'],['text','\\text{}']],
 Arrows:[['→','\\rightarrow'],['←','\\leftarrow'],['↔','\\leftrightarrow'],['⇒','\\Rightarrow'],['⇐','\\Leftarrow'],['⇔','\\Leftrightarrow'],['↦','\\mapsto'],['↑','\\uparrow'],['↓','\\downarrow'],['↗','\\nearrow'],['↘','\\searrow']],
 Sets:[['∅','\\emptyset'],['ℝ','\\mathbb{R}'],['ℕ','\\mathbb{N}'],['ℤ','\\mathbb{Z}'],['ℚ','\\mathbb{Q}'],['ℂ','\\mathbb{C}'],['∪','\\cup'],['∩','\\cap'],['\\','\\setminus'],['∀','\\forall'],['∃','\\exists'],['¬','\\neg'],['∧','\\land'],['∨','\\lor']]
};
let mathEditing=null,mathCategory='Greek',lastVisualCursor=null,lastMathStructuredField=null;
let mathMatrixRows=2,mathMatrixCols=2;
function mathStructure(){return document.getElementById('math-structure').value||'display';}
function mathCleanLabel(value){return String(value||'').trim().replace(/[{}\\\s]/g,'');}
function splitMathRows(text){return String(text||'').split(/\\\\(?:\s*\[[^\]]*\])?\s*(?:\n|$)/).map(x=>x.trim()).filter(Boolean);}
function makeAlignRow(left='',op='=',right='',label='',numbered=true){const row=document.createElement('div');row.className='math-align-row';row.innerHTML='<input class="math-align-left" placeholder="left" value="'+esc(left)+'"><select class="math-align-op"><option value="=">=</option><option value="\\le">≤</option><option value="\\ge">≥</option><option value="\\approx">≈</option><option value="\\sim">∼</option><option value="">align only</option></select><input class="math-align-right" placeholder="right" value="'+esc(right)+'"><input class="math-align-label" placeholder="eq:label" value="'+esc(label)+'"><label class="math-numbered"><input class="math-align-numbered" type="checkbox" '+(numbered?'checked':'')+'> #</label><button class="math-row-delete" type="button" title="Delete row">×</button>';row.querySelector('.math-align-op').value=op;row.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',syncMathStructuredSource));row.querySelector('.math-row-delete').onclick=()=>{if(document.querySelectorAll('.math-align-row').length>1){row.remove();syncMathStructuredSource();}};return row;}
function loadAlignBuilder(text){const host=document.getElementById('math-align-rows');host.innerHTML='';const rows=splitMathRows(text);(rows.length?rows:['x &= y']).forEach(raw=>{let label='';const lm=/\\label\{([^}]+)\}/.exec(raw);if(lm)label=lm[1];const numbered=!/\\(?:notag|nonumber)\b/.test(raw);let core=raw.replace(/\\label\{[^}]+\}/g,'').replace(/\\(?:notag|nonumber)\b/g,'').trim();const am=/^(.*?)\s*&\s*(=|\\le|\\ge|\\approx|\\sim)?\s*(.*)$/.exec(core);host.appendChild(makeAlignRow(am?am[1].trim():'',am?(am[2]||''):'=',am?am[3].trim():core,label,numbered));});}
function makeCasesRow(expr='',cond=''){const row=document.createElement('div');row.className='math-cases-row';row.innerHTML='<input class="math-case-expr" placeholder="expression" value="'+esc(expr)+'"><input class="math-case-cond" placeholder="condition" value="'+esc(cond)+'"><button class="math-row-delete" type="button">×</button>';row.querySelectorAll('input').forEach(x=>x.addEventListener('input',syncMathStructuredSource));row.querySelector('button').onclick=()=>{if(document.querySelectorAll('.math-cases-row').length>1){row.remove();syncMathStructuredSource();}};return row;}
function loadCasesBuilder(text){const host=document.getElementById('math-cases-rows');host.innerHTML='';const inner=(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/.exec(String(text||''))||[])[1]||text||'';const rows=splitMathRows(inner);(rows.length?rows:['x & \\text{if } x>0','0 & \\text{otherwise}']).forEach(raw=>{const at=raw.indexOf('&');host.appendChild(makeCasesRow(at>=0?raw.slice(0,at).trim():raw.trim(),at>=0?raw.slice(at+1).trim():''));});}
function makeMultlineLine(value=''){const wrap=document.createElement('div');wrap.className='math-cases-row';wrap.innerHTML='<input class="math-multline-line" placeholder="equation line" value="'+esc(value)+'"><button class="math-row-delete" type="button" title="Delete line">×</button>';wrap.querySelector('input').addEventListener('focus',e=>{lastMathStructuredField=e.currentTarget;});wrap.querySelector('input').addEventListener('input',syncMathStructuredSource);wrap.querySelector('button').onclick=()=>{if(document.querySelectorAll('.math-multline-line').length>1){wrap.remove();syncMathStructuredSource();}};return wrap;}
function loadMultlineBuilder(text){const host=document.getElementById('math-multline-lines');host.innerHTML='';const rows=splitMathRows(String(text||''));(rows.length?rows:['a+b+c=d','+e+f=g']).forEach(raw=>host.appendChild(makeMultlineLine(raw)));}
function renderMatrixGrid(values){const host=document.getElementById('math-matrix-grid');host.style.gridTemplateColumns='repeat('+mathMatrixCols+',minmax(60px,1fr))';host.innerHTML='';for(let r=0;r<mathMatrixRows;r++)for(let c=0;c<mathMatrixCols;c++){const input=document.createElement('input');input.className='math-matrix-cell';input.dataset.row=String(r);input.dataset.col=String(c);input.value=(values&&values[r]&&values[r][c])||'';input.addEventListener('input',syncMathStructuredSource);host.appendChild(input);}}
function matrixValues(){const vals=Array.from({length:mathMatrixRows},()=>Array(mathMatrixCols).fill(''));document.querySelectorAll('.math-matrix-cell').forEach(x=>{const r=Number(x.dataset.row),c=Number(x.dataset.col);if(vals[r])vals[r][c]=x.value;});return vals;}
function loadMatrixBuilder(text){const m=/\\begin\{(matrix|pmatrix|bmatrix|vmatrix|Vmatrix)\}([\s\S]*?)\\end\{\1\}/.exec(String(text||''));const env=m?m[1]:'pmatrix',inner=m?m[2]:'';document.getElementById('math-matrix-env').value=env;const rows=splitMathRows(inner).map(x=>x.split('&').map(y=>y.trim()));mathMatrixRows=Math.max(1,rows.length||2);mathMatrixCols=Math.max(1,...(rows.length?rows.map(r=>r.length):[2]));renderMatrixGrid(rows);}
function syncMathStructuredSource(){const structure=mathStructure(),ta=document.getElementById('math-code');if(structure==='align'){const rows=[...document.querySelectorAll('.math-align-row')].map(row=>{const l=row.querySelector('.math-align-left').value.trim(),op=row.querySelector('.math-align-op').value,r=row.querySelector('.math-align-right').value.trim(),lab=mathCleanLabel(row.querySelector('.math-align-label').value);let x=l+' &'+op+(r?' '+r:'');if(lab)x+=' \\label{'+lab+'}';if(!row.querySelector('.math-align-numbered').checked)x+=' \\notag';return x.trim();});ta.value=rows.join(' \\\\\n');}else if(structure==='cases'){const rows=[...document.querySelectorAll('.math-cases-row')].map(row=>row.querySelector('.math-case-expr').value.trim()+' & '+row.querySelector('.math-case-cond').value.trim());ta.value='\\begin{cases}\n'+rows.join(' \\\\\n')+'\n\\end{cases}';}else if(structure==='multline'){const rows=[...document.querySelectorAll('.math-multline-line')].map(x=>x.value.trim()).filter((x,i,a)=>x||a.length===1);ta.value=rows.join(' \\\\\n');}else if(structure==='matrix'){const env=document.getElementById('math-matrix-env').value||'pmatrix',vals=matrixValues();ta.value='\\begin{'+env+'}\n'+vals.map(r=>r.join(' & ')).join(' \\\\\n')+'\n\\end{'+env+'}';}updateMathPreview();}
function configureMathStructure(structure,text='',numbered=true,label=''){const sel=document.getElementById('math-structure');sel.value=structure;document.getElementById('math-numbered').checked=!!numbered;document.getElementById('math-label').value=label||'';document.getElementById('math-numbered-wrap').style.display=['equation','align','gather','multline','cases','matrix'].includes(structure)?'flex':'none';document.getElementById('math-label-wrap').style.display=['equation','gather','multline','cases','matrix'].includes(structure)?'grid':'none';document.getElementById('math-align-builder').classList.toggle('open',structure==='align');document.getElementById('math-cases-builder').classList.toggle('open',structure==='cases');document.getElementById('math-multline-builder').classList.toggle('open',structure==='multline');document.getElementById('math-matrix-builder').classList.toggle('open',structure==='matrix');const ta=document.getElementById('math-code');ta.classList.toggle('structured-source',['align','cases','multline','matrix'].includes(structure));if(structure==='align')loadAlignBuilder(text);else if(structure==='cases')loadCasesBuilder(text);else if(structure==='multline')loadMultlineBuilder(text);else if(structure==='matrix')loadMatrixBuilder(text);ta.value=text||'';if(['align','cases','multline','matrix'].includes(structure))syncMathStructuredSource();else updateMathPreview();}
function inferMathStructure(block){const env=String(block&&block.env||'');const text=String(block&&block.text||'');if(/^align/.test(env))return'align';if(/^gather/.test(env))return'gather';if(/^multline/.test(env))return'multline';if(/\\begin\{cases\}/.test(text))return'cases';if(/\\begin\{(?:matrix|pmatrix|bmatrix|vmatrix|Vmatrix)\}/.test(text))return'matrix';if(/^equation/.test(env))return'equation';return'display';}
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
 else if(kind==='equation'||kind==='equation*'||kind==='align'||kind==='align*'||kind==='gather'||kind==='gather*'||kind==='multline'||kind==='multline*')code='\n\n\\begin{'+kind+'}\n'+text+'\n\\end{'+kind+'}\n\n';
 else if(kind==='cases'||kind==='cases*'||kind==='matrix'||kind==='matrix*'){const env=kind.endsWith('*')?'equation*':'equation';code='\n\n\\begin{'+env+'}\n'+text+'\n\\end{'+env+'}\n\n';}
 else code='\n\n\\[\n'+text+'\n\\]\n\n';
 if(!latex.includes(marker))return false;
 editable.__texflowCommit(latex.replace(marker,code));
 return true;
}
function renderMathPalette(){const tabs=document.getElementById('symbol-tabs'),grid=document.getElementById('symbol-grid');tabs.innerHTML='';Object.keys(mathSymbols).forEach(name=>{const b=document.createElement('button');b.className='symbol-tab'+(name===mathCategory?' active':'');b.textContent=name;b.onclick=()=>{mathCategory=name;renderMathPalette()};tabs.appendChild(b)});grid.innerHTML='';mathSymbols[mathCategory].forEach(([label,code])=>{const b=document.createElement('button');b.className='symbol-btn';b.textContent=label;b.title=code;b.onclick=()=>insertMathCode(code);grid.appendChild(b)});}
function insertIntoMathField(field,code){if(!field)return false;const start=Number(field.selectionStart)||0,end=Number(field.selectionEnd)||start;field.setRangeText(code,start,end,'end');field.focus();const firstEmpty=code.indexOf('{}');if(firstEmpty>=0){const p=start+firstEmpty+1;field.setSelectionRange(p,p);}field.dispatchEvent(new Event('input',{bubbles:true}));return true;}
function insertMathCode(code){const ta=document.getElementById('math-code');insertIntoMathField(ta,code);updateMathPreview();}
function insertMathText(){const structure=mathStructure(),field=lastMathStructuredField&&lastMathStructuredField.isConnected?lastMathStructuredField:null;if(['align','cases','multline','matrix'].includes(structure)&&field&&field.closest('.math-builder')){insertIntoMathField(field,'\\text{}');syncMathStructuredSource();return;}insertMathCode('\\text{}');}
function updateMathPreview(){const ta=document.getElementById('math-code'),preview=document.getElementById('math-preview'),structure=mathStructure();let code=ta.value||'\\;';code=code.replace(/\\label\{[^}]+\}/g,'').replace(/\\(?:notag|nonumber)\b/g,'');if(structure==='align')code='\\begin{aligned}'+code+'\\end{aligned}';else if(structure==='gather'||structure==='multline')code='\\begin{gathered}'+code+'\\end{gathered}';try{katex.render(code,preview,{displayMode:structure!=='inline',throwOnError:false})}catch{preview.textContent=ta.value}}
function openMathEditor(block,frameIndex){mathEditing={mode:'edit',block,frameIndex};const modal=document.getElementById('math-modal'),structure=inferMathStructure(block),rawText=String(block.text||'').trim(),overallLabel=structure==='align'?'':((/\\label\{([^}]+)\}/.exec(rawText)||[])[1]||''),text=structure==='align'?rawText:rawText.replace(/\\label\{[^}]+\}/g,'').trim(),numbered=!String(block.env||'').endsWith('*')&&structure!=='display';document.getElementById('math-modal-title').textContent='Edit equation';modal.classList.add('open');modal.setAttribute('aria-hidden','false');renderMathPalette();configureMathStructure(structure,text,numbered,overallLabel);const ta=document.getElementById('math-code');setTimeout(()=>{ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length)},0)}
function openMathInsert(kind,frameIndex){const structure=kind==='inlinemath'?'inline':kind==='equation'?'equation':kind==='alignmath'?'align':kind==='gathermath'?'gather':kind==='multlinemath'?'multline':kind==='casesmath'?'cases':kind==='matrixmath'?'matrix':'display';mathEditing={mode:'insert',kind,frameIndex,anchor:snapshotVisualCursor()||lastVisualCursor};const modal=document.getElementById('math-modal');document.getElementById('math-modal-title').textContent=structure==='inline'?'Insert inline math':structure==='align'?'Insert aligned equations':structure==='gather'?'Insert gathered equations':structure==='multline'?'Insert multiline equation':structure==='cases'?'Insert cases':structure==='matrix'?'Insert matrix':structure==='equation'?'Insert numbered equation':'Insert display math';modal.classList.add('open');modal.setAttribute('aria-hidden','false');renderMathPalette();configureMathStructure(structure,'',structure!=='display'&&structure!=='inline','');const ta=document.getElementById('math-code');setTimeout(()=>ta.focus(),0)}
function closeMathEditor(){const modal=document.getElementById('math-modal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');mathEditing=null}
function saveMathEditor(){if(!mathEditing)return;const structure=mathStructure(),numbered=document.getElementById('math-numbered').checked,label=mathCleanLabel(document.getElementById('math-label').value),text=document.getElementById('math-code').value.trim();if(label){const duplicate=availableLabels().find(x=>x.key===label);const existing=mathEditing.mode==='doc-edit'?String(mathEditing.node.block.label||''):mathEditing.mode==='edit'?((/\\label\{([^}]+)\}/.exec(String(mathEditing.block.text||''))||[])[1]||''):'';if(duplicate&&existing!==label){vscode.postMessage({type:'showWarning',message:'Label '+label+' already exists.'});return;}}const env=structure==='align'?(numbered?'align':'align*'):structure==='gather'?(numbered?'gather':'gather*'):structure==='multline'?(numbered?'multline':'multline*'):structure==='equation'||structure==='cases'||structure==='matrix'?(numbered?'equation':'equation*'):structure==='display'?'display':'inline';const body=text+(label&&structure!=='align'?'\n\\label{'+label+'}':'');if(mathEditing.mode==='insert'){const kind=structure==='inline'?'inlinemath':structure==='display'?'displaymath':structure==='align'?(numbered?'align':'align*'):structure==='gather'?(numbered?'gather':'gather*'):structure==='multline'?(numbered?'multline':'multline*'):structure==='cases'?(numbered?'cases':'cases*'):structure==='matrix'?(numbered?'matrix':'matrix*'):(numbered?'equation':'equation*');if(text&&!insertMathAtRememberedCursor(kind,body,mathEditing.anchor))vscode.postMessage({type:'insertMath',frameIndex:mathEditing.frameIndex,kind,text:body});closeMathEditor();return;}if(mathEditing.mode==='doc-edit'){const node=mathEditing.node;let replacement='';if(env==='display')replacement='\\[\n'+body+'\n\\]';else if(env==='inline')replacement='$'+body+'$';else replacement='\\begin{'+env+'}\n'+body+'\n\\end{'+env+'}';updateDocumentNode(node,replacement,true);closeMathEditor();return;}vscode.postMessage({type:'updateBlock',frameIndex:mathEditing.frameIndex,blockId:mathEditing.block.id,payload:{text:body,env}});closeMathEditor()}
document.getElementById('math-modal').addEventListener('focusin',e=>{if(e.target&&e.target.matches&&e.target.matches('.math-builder input'))lastMathStructuredField=e.target;});document.getElementById('math-code').addEventListener('input',updateMathPreview);document.getElementById('math-close').onclick=closeMathEditor;document.getElementById('math-cancel').onclick=closeMathEditor;document.getElementById('math-save').onclick=saveMathEditor;document.getElementById('math-modal').addEventListener('mousedown',e=>{if(e.target.id==='math-modal')closeMathEditor()});document.getElementById('math-code').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();saveMathEditor();return;}if(e.key==='Tab'){const ta=e.currentTarget,start=ta.selectionStart||0,txt=ta.value||'';let p=txt.indexOf('{}',start);if(p<0)p=txt.indexOf('{}');if(p>=0){e.preventDefault();ta.focus();ta.setSelectionRange(p+1,p+1);}}});
document.getElementById('math-structure').addEventListener('change',e=>configureMathStructure(e.target.value,'',document.getElementById('math-numbered').checked,document.getElementById('math-label').value));document.getElementById('math-numbered').addEventListener('change',updateMathPreview);document.querySelectorAll('.math-builder input').forEach(x=>x.addEventListener('focus',()=>{lastMathStructuredField=x;}));document.getElementById('math-text-insert').onclick=insertMathText;document.getElementById('math-align-add').onclick=()=>{document.getElementById('math-align-rows').appendChild(makeAlignRow());syncMathStructuredSource();};document.getElementById('math-cases-add').onclick=()=>{document.getElementById('math-cases-rows').appendChild(makeCasesRow());syncMathStructuredSource();};document.getElementById('math-multline-add').onclick=()=>{document.getElementById('math-multline-lines').appendChild(makeMultlineLine());syncMathStructuredSource();};document.getElementById('math-matrix-env').addEventListener('change',syncMathStructuredSource);document.getElementById('math-matrix-add-row').onclick=()=>{const vals=matrixValues();mathMatrixRows=Math.min(12,mathMatrixRows+1);renderMatrixGrid(vals);syncMathStructuredSource();};document.getElementById('math-matrix-del-row').onclick=()=>{if(mathMatrixRows>1){const vals=matrixValues();mathMatrixRows--;renderMatrixGrid(vals);syncMathStructuredSource();}};document.getElementById('math-matrix-add-col').onclick=()=>{const vals=matrixValues();mathMatrixCols=Math.min(12,mathMatrixCols+1);renderMatrixGrid(vals);syncMathStructuredSource();};document.getElementById('math-matrix-del-col').onclick=()=>{if(mathMatrixCols>1){const vals=matrixValues();mathMatrixCols--;renderMatrixGrid(vals.map(r=>r.slice(0,mathMatrixCols)));syncMathStructuredSource();}};

let citationSelection=new Set(),citationAnchor=null,referenceSelection='',referenceAnchor=null,labelTarget=null,lastStructuralTarget=null;
let selectedSemanticBlock=null;
function clearSemanticBlockSelection(){
 document.querySelectorAll('.texflow-semantic-block.semantic-block-selected').forEach(x=>x.classList.remove('semantic-block-selected'));
 selectedSemanticBlock=null;
}
function eventInsideSemanticEditor(target){return !!(target&&target.closest&&target.closest('input,select,textarea,button,[contenteditable=true]'));}
function bindSemanticBlockSelection(el,deleteAction){
 if(!el||!deleteAction)return;
 el.classList.add('texflow-semantic-block');el.tabIndex=0;
 let del=el.querySelector(':scope > .semantic-delete');if(!del){del=document.createElement('button');del.type='button';del.className='semantic-delete';del.title='Delete object';del.setAttribute('aria-label','Delete object');del.textContent='×';el.appendChild(del);}
 const select=(focus)=>{clearSemanticBlockSelection();el.classList.add('semantic-block-selected');selectedSemanticBlock={el,deleteAction};if(focus)try{el.focus({preventScroll:true})}catch{el.focus();}};
 el.addEventListener('mousedown',e=>{if(e.target===del)return;if(!eventInsideSemanticEditor(e.target))select(false);});
 el.addEventListener('click',e=>{if(e.target===del)return;if(!eventInsideSemanticEditor(e.target))select(true);});
 del.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();});
 del.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();select(false);deleteAction();});
}
function setStructuralTarget(node,el){
 document.querySelectorAll('.doc-heading-selected,.doc-math-wrap.selected,.doc-figure.selected').forEach(x=>x.classList.remove('doc-heading-selected','selected'));
 lastStructuralTarget=node||null;
 if(!node||!el)return;
 if(node.kind==='heading')el.classList.add('doc-heading-selected');
 else{const wrap=el.closest('.doc-math-wrap')||el;wrap.classList.add('selected');}
}
function availableLabels(){
 if(!isBeamer)parseDocumentFlow();
 const found=[],seen=new Set();
 const enrich=new Map(documentLabels.map(x=>[x.key,x]));
 const src=String(documentSource||'');let m;const re=/\\label\{([^}]+)\}/g;
 while((m=re.exec(src))){const key=String(m[1]||'').trim();if(!key||seen.has(key))continue;seen.add(key);const meta=enrich.get(key)||{};found.push({key,targetKind:meta.targetKind||'label'});}
 return found;
}
function openReferencePicker(){
 referenceAnchor=snapshotVisualCursor();referenceSelection='';
 const modal=document.getElementById('reference-modal');document.getElementById('reference-search').value='';document.getElementById('reference-insert').disabled=true;
 modal.classList.add('open');modal.setAttribute('aria-hidden','false');renderReferenceResults();setTimeout(()=>document.getElementById('reference-search').focus(),0);
}
function closeReferencePicker(){const modal=document.getElementById('reference-modal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');referenceSelection='';referenceAnchor=null;}
function renderReferenceResults(){
 const host=document.getElementById('reference-results'),q=(document.getElementById('reference-search').value||'').trim().toLowerCase(),rows=availableLabels().filter(x=>!q||x.key.toLowerCase().includes(q)||String(x.targetKind||'').toLowerCase().includes(q));
 if(!rows.length){host.innerHTML='<div class="cite-empty">'+(availableLabels().length?'No matching labels.':'No \\label{...} commands were found in this document.')+'</div>';document.getElementById('reference-insert').disabled=true;return;}
 host.innerHTML='';rows.forEach(item=>{const row=document.createElement('button');row.type='button';row.className='cite-result'+(referenceSelection===item.key?' selected':'');row.innerHTML='<span></span><span class="cite-result-main"><div class="cite-result-title">'+esc(item.key)+'</div><div class="cite-result-meta">'+esc(item.targetKind||'label')+'</div></span>';row.onclick=()=>{referenceSelection=item.key;document.getElementById('reference-style').value=item.targetKind==='equation'?'eqref':'ref';document.getElementById('reference-insert').disabled=false;renderReferenceResults();};host.appendChild(row);});
}
function saveReferencePicker(){if(!referenceSelection)return;const cmd=document.getElementById('reference-style').value||'ref',code='\\'+cmd+'{'+referenceSelection+'}';if(!insertLatexAtRememberedCursor(code,referenceAnchor)){vscode.postMessage({type:'showWarning',message:'Place the cursor in editable text before inserting a reference.'});return;}closeReferencePicker();}
function openLabelPicker(){
 if(isBeamer){vscode.postMessage({type:'showWarning',message:'Label insertion from Visual is available for document headings and equations in TeXFlow 0.11.3. Existing Beamer labels are preserved.'});return;}
 const target=lastStructuralTarget;if(!target||!(target.kind==='heading'||(target.kind==='block'&&target.block&&['equation','figure'].includes(target.block.kind)))){vscode.postMessage({type:'showWarning',message:'Select a heading, equation, or figure first, then choose Ref → Add label.'});return;}
 if(target.label){vscode.postMessage({type:'showWarning',message:'The selected target already has label '+target.label+'. TeXFlow does not rename labels automatically.'});return;}
 labelTarget=target;const modal=document.getElementById('label-modal'),input=document.getElementById('label-key'),desc=document.getElementById('label-target-description');input.value='';document.getElementById('label-validation').textContent='';desc.textContent=target.kind==='heading'?(target.command+' — '+String(target.title||'')):(target.block&&target.block.kind==='figure'?'figure':'equation');modal.classList.add('open');modal.setAttribute('aria-hidden','false');setTimeout(()=>input.focus(),0);
}
function closeLabelPicker(){const modal=document.getElementById('label-modal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');labelTarget=null;}
function validateLabelKey(key){const k=String(key||'').trim();if(!k)return'Enter a label identifier.';if(/[{}\\\s]/.test(k))return'Labels cannot contain spaces, braces, or backslashes.';if(availableLabels().some(x=>x.key===k))return'That label already exists.';return'';}
function saveLabelPicker(){
 if(!labelTarget)return;const key=String(document.getElementById('label-key').value||'').trim(),problem=validateLabelKey(key);document.getElementById('label-validation').textContent=problem;if(problem)return;
 const node=labelTarget;let replacement=String(node.raw||'');
 if(node.kind==='heading')replacement=replacement+'\n\\label{'+key+'}';
 else{const b=node.block||{},raw=String(node.raw||'');if(b.kind==='figure'){const at=raw.lastIndexOf('\\end{figure}');if(at<0)return;replacement=raw.slice(0,at).replace(/\s*$/,'')+'\n\\label{'+key+'}\n'+raw.slice(at);}else if(b.env==='display'){const at=raw.lastIndexOf('\\]');if(at<0)return;replacement=raw.slice(0,at).replace(/\s*$/,'')+'\n\\label{'+key+'}\n'+raw.slice(at);}else if(b.env==='$$'){const at=raw.lastIndexOf('$$');if(at<=0)return;replacement=raw.slice(0,at).replace(/\s*$/,'')+'\n\\label{'+key+'}\n'+raw.slice(at);}else{const endToken='\\end{'+b.env+'}',at=raw.lastIndexOf(endToken);if(at<0)return;replacement=raw.slice(0,at).replace(/\s*$/,'')+'\n\\label{'+key+'}\n'+raw.slice(at);}}
 closeLabelPicker();updateDocumentNode(node,replacement,true);
}
function citationSystemFromSource(){const all=String(documentSource||'')+'\n'+sources.map(x=>x.text||'').join('\n');if(/\\addbibresource(?:\[[^\]]*\])?\{[^}]+\}/i.test(all)||/\\usepackage(?:\[[^\]]*\])?\{[^}]*\bbiblatex\b[^}]*\}/i.test(all))return'biblatex';if(/\\bibliography\{[^}]+\}/i.test(all)){if(/\\usepackage(?:\[[^\]]*\])?\{[^}]*\bnatbib\b[^}]*\}/i.test(all)||/\\(?:citep|citet)\b/.test(all))return'natbib';return'bibtex';}return'none';}
function citationPreviewText(cmd,entry){const f=(entry||{}).fields||{},author=bibAuthorLabel(entry||{fields:{},key:'ref'}),year=bibPlain(f.year||f.date||'Year');if(cmd==='textcite'||cmd==='citet')return author+' ('+year+')';if(cmd==='cite')return '['+author+' '+year+']';return '('+author+' '+year+')';}
function configureCitationStyle(){const select=document.getElementById('cite-style'),system=citationSystemFromSource(),entry=bibliographyByKey[[...citationSelection][0]]||bibliographyEntries[0];let opts=[];if(system==='natbib')opts=[['citep','Parenthetical'],['citet','Textual'],['cite','Standard']];else if(system==='bibtex')opts=[['cite','Standard']];else opts=[['parencite','Parenthetical'],['textcite','Textual'],['cite','Standard'],['autocite','Automatic']];select.innerHTML=opts.map(([cmd,label])=>'<option value="'+cmd+'">'+label+' — '+esc(citationPreviewText(cmd,entry))+' — \\'+cmd+'</option>').join('');}
function citationSearchText(entry){const f=entry.fields||{};return [entry.key,entry.type,f.author,f.editor,f.title,f.year,f.date,f.journal,f.booktitle,f.publisher].filter(Boolean).join(' ').toLowerCase();}
function renderCitationResults(){const host=document.getElementById('cite-results'),q=(document.getElementById('cite-search').value||'').trim().toLowerCase();const rows=bibliographyEntries.filter(e=>!q||citationSearchText(e).includes(q));if(!rows.length){host.innerHTML='<div class="cite-empty">'+(bibliographyResources.length?(bibliographyEntries.length?'No matching references.':'The connected .bib file has no readable entries yet. Open it in VS Code to add references.'):'No bibliography is connected yet. Add or select a .bib file, then insert citations here.')+'</div>';document.getElementById('cite-insert').disabled=true;return;}host.innerHTML='';rows.forEach(entry=>{const f=entry.fields||{},row=document.createElement('button');row.type='button';row.className='cite-result'+(citationSelection.has(entry.key)?' selected':'');row.innerHTML='<input class="cite-check" type="checkbox" tabindex="-1" '+(citationSelection.has(entry.key)?'checked':'')+'><span class="cite-result-main"><div class="cite-result-title">'+esc(bibPlain(f.title||entry.key))+'</div><div class="cite-result-meta">'+esc(bibPlain(f.author||f.editor||''))+(f.year?' · '+esc(bibPlain(f.year)):'')+' · '+esc(entry.type)+' · '+esc(entry.key)+'</div></span>';row.onclick=()=>{if(citationSelection.has(entry.key))citationSelection.delete(entry.key);else citationSelection.add(entry.key);configureCitationStyle();document.getElementById('cite-insert').disabled=!citationSelection.size;renderCitationResults();};host.appendChild(row);});document.getElementById('cite-insert').disabled=!citationSelection.size;}
function snapshotVisualCursor(){
 rememberVisualCursor();
 const ctx=lastVisualCursor;
 if(ctx&&ctx.editable&&ctx.editable.isConnected&&ctx.editable.__texflowCommit&&ctx.range&&ctx.range.cloneRange){
  const r=ctx.range.cloneRange();if(ctx.editable.contains(r.startContainer))return{editable:ctx.editable,range:r,frameIndex:ctx.frameIndex};
 }
 if(activeEditable&&activeEditable.isConnected&&activeEditable.__texflowCommit){
  const r=document.createRange();r.selectNodeContents(activeEditable);r.collapse(false);return{editable:activeEditable,range:r,frameIndex:current};
 }
 return null;
}
function openCitationPicker(){citationAnchor=snapshotVisualCursor();citationSelection=new Set();const modal=document.getElementById('cite-modal');document.getElementById('cite-search').value='';document.getElementById('cite-open-bib').disabled=!bibliographyResources.length;document.getElementById('cite-insert').disabled=true;configureCitationStyle();modal.classList.add('open');modal.setAttribute('aria-hidden','false');renderCitationResults();setTimeout(()=>document.getElementById('cite-search').focus(),0);}
function closeCitationPicker(){const modal=document.getElementById('cite-modal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');citationSelection.clear();citationAnchor=null;}
function rememberedStructuralCursorPos(explicitCtx=null){const ctx=explicitCtx||citationAnchor||lastVisualCursor;if(!ctx||!ctx.editable||!ctx.editable.isConnected)return null;const host=ctx.editable.closest('[data-node-id]')||ctx.editable;const id=host&&host.dataset?host.dataset.nodeId:null;const node=id?documentFlowById[id]:null;return node&&Number.isFinite(node.end)?Number(node.end):null;}
function rangePartLatex(editable,range,part){const r=document.createRange();r.selectNodeContents(editable);if(part==='before')r.setEnd(range.startContainer,range.startOffset);else if(part==='selected'){r.setStart(range.startContainer,range.startOffset);r.setEnd(range.endContainer,range.endOffset);}else r.setStart(range.endContainer,range.endOffset);const box=document.createElement('div');box.appendChild(r.cloneContents());return editorToLatex(box);}
function insertLocalColumns(count){count=Math.max(2,Math.min(4,Number(count)||2));if(isBeamer){vscode.postMessage({type:'insertLayoutColumns',frameIndex:current,count});return;}const ctx=(lastVisualCursor&&lastVisualCursor.editable&&lastVisualCursor.editable.isConnected)?lastVisualCursor:snapshotVisualCursor();if(ctx&&ctx.editable&&ctx.range&&ctx.editable.classList.contains('doc-paragraph')){const node=documentFlowById[ctx.editable.dataset.nodeId],range=ctx.range.cloneRange();if(node&&ctx.editable.contains(range.startContainer)&&ctx.editable.contains(range.endContainer)){const before=rangePartLatex(ctx.editable,range,'before').trimEnd(),selected=range.collapsed?'':rangePartLatex(ctx.editable,range,'selected').trim(),after=rangePartLatex(ctx.editable,range,'after').trimStart(),block='\\begin{multicols}{'+count+'}\n'+selected+'\n\\end{multicols}',replacement=(before?before+'\n\n':'')+block+(after?'\n\n'+after:'');updateDocumentNode(node,replacement,true,'multicol');return;}}vscode.postMessage({type:'insertLayoutColumns',frameIndex:current,count,cursorPos:rememberedStructuralCursorPos()});}
function normalizeAtomicInsertionRange(editable,range){
 if(!range||!editable.contains(range.startContainer))return null;
 const r=range.cloneRange();
 if(!r.collapsed)return r;
 const startEl=r.startContainer.nodeType===Node.ELEMENT_NODE?r.startContainer:r.startContainer.parentElement;
 const atomic=startEl&&startEl.closest?startEl.closest('.bib-citation,.tex-reference,.inline-math,.display-math,.tex-footnote,.tex-link,.tex-index,.tex-field,.tex-nomenclature,.math-caret-anchor'):null;
 if(atomic&&editable.contains(atomic)){
  let boundary=atomic;
  if((atomic.classList.contains('bib-citation')||atomic.classList.contains('tex-reference')||atomic.classList.contains('inline-math')||atomic.classList.contains('display-math'))&&atomic.nextSibling&&atomic.nextSibling.nodeType===Node.ELEMENT_NODE&&atomic.nextSibling.classList.contains('math-caret-anchor'))boundary=atomic.nextSibling;
  try{r.setStartAfter(boundary);r.collapse(true);}catch{return null;}
 }
 return r;
}
function citationCodeParts(code){const m=/^\\(parencite|textcite|autocite|citep|citet|cite)\{([^}]*)\}$/.exec(String(code||''));return m?{cmd:m[1],keys:m[2]}:null;}
function referenceCodeParts(code){const m=/^\\(eqref|ref|autoref|pageref)\{([^}]*)\}$/.exec(String(code||''));return m?{cmd:m[1],key:m[2]}:null;}
function restoreCaretAfterInsertedLatex(editable,code,occurrence){
 const parts=citationCodeParts(code),refParts=referenceCodeParts(code),spaceParts=/^\\hspace(\*)?\{([^}]+)\}$/.exec(String(code||''));let boundary=null;
 if(parts){
  const matches=[...editable.querySelectorAll('.bib-citation')].filter(el=>(el.dataset.citeCommand||'cite')===parts.cmd&&(el.dataset.citeKeys||'')===parts.keys);
  boundary=matches[Math.min(Math.max(0,occurrence),Math.max(0,matches.length-1))]||null;
 }else if(refParts){
  const matches=[...editable.querySelectorAll('.tex-reference')].filter(el=>(el.dataset.refCommand||'ref')===refParts.cmd&&(el.dataset.refKey||'')===refParts.key);
  boundary=matches[Math.min(Math.max(0,occurrence),Math.max(0,matches.length-1))]||null;
 }else if(spaceParts){
  const amount=spaceParts[2],star=!!spaceParts[1];const matches=[...editable.querySelectorAll('.tex-hspace')].filter(el=>(el.dataset.spaceAmount||'')===amount&&(el.dataset.spaceStarred==='true')===star);
  boundary=matches[Math.min(Math.max(0,occurrence),Math.max(0,matches.length-1))]||null;
 }
 if(boundary&&boundary.nextSibling&&boundary.nextSibling.nodeType===Node.ELEMENT_NODE&&boundary.nextSibling.classList.contains('math-caret-anchor'))boundary=boundary.nextSibling;
 if(!boundary){editable.focus();placeCaretEnd(editable);rememberVisualCursor();return;}
 editable.focus();const r=document.createRange();r.setStartAfter(boundary);r.collapse(true);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);rememberVisualCursor();
}
function insertLatexAtRememberedCursor(code,anchor){
 const ctx=anchor||lastVisualCursor;if(!ctx||!ctx.editable||!ctx.editable.isConnected||!ctx.editable.__texflowCommit)return false;
 const editable=ctx.editable,base=ctx.range&&ctx.range.cloneRange?ctx.range.cloneRange():null,range=normalizeAtomicInsertionRange(editable,base);if(!range)return false;
 const marker='@@TEXFLOW_CURSOR_INSERT_'+Date.now()+'_'+Math.random().toString(36).slice(2)+'@@',markerNode=document.createTextNode(marker);
 try{range.deleteContents();range.insertNode(markerNode);}catch{return false;}
 const latex=editableLatex(editable);markerNode.remove();const at=latex.indexOf(marker);if(at<0)return false;
 const insert=String(code||''),before=latex.slice(0,at),occurrence=insert?before.split(insert).length-1:0;
 editable.__texflowCommit(latex.slice(0,at)+insert+latex.slice(at+marker.length));
 // __texflowCommit re-renders semantic inline objects. Restore a live caret just
 // after the newly inserted citation so a second citation can be inserted immediately.
 restoreCaretAfterInsertedLatex(editable,insert,occurrence);return true;
}
function saveCitationPicker(){const keys=[...citationSelection];if(!keys.length)return;const cmd=document.getElementById('cite-style').value||'parencite',code='\\'+cmd+'{'+keys.join(',')+'}';if(!insertLatexAtRememberedCursor(code,citationAnchor)){vscode.postMessage({type:'showWarning',message:'Place the cursor in editable text before inserting a citation.'});return;}closeCitationPicker();}

let tableInsertAnchor=null;
let figureInsertState=null;
function validateFigureEditor(){
 const label=String(document.getElementById('figure-label-new').value||'').trim();let error='';
 if(label&&!/^[^{}\\\s]+$/.test(label))error='Labels cannot contain spaces, braces, or backslashes.';
 if(!error&&label&&documentLabels.some(x=>x.key===label))error='That label already exists.';
 const width=Number(document.getElementById('figure-width-new').value);if(!error&&(!Number.isFinite(width)||width<5||width>100))error='Width must be between 5 and 100 percent.';
 document.getElementById('figure-validation').textContent=error;document.getElementById('figure-insert').disabled=!!error;return !error;
}
function openFigureEditor(data){
 figureInsertState={latexPath:String(data.latexPath||''),frameIndex:Number(data.frameIndex),cursorPos:Number(data.cursorPos)};
 document.getElementById('figure-file').textContent=figureInsertState.latexPath;document.getElementById('figure-caption-new').value='';document.getElementById('figure-short-caption-new').value='';document.getElementById('figure-angle-new').value='0';document.getElementById('figure-label-new').value=String(data.defaultLabel||'');document.getElementById('figure-placement-new').value='htbp';document.getElementById('figure-placement-field').style.display=isBeamer?'none':'';document.getElementById('figure-caption-position-new').value='below';document.getElementById('figure-align-new').value='center';document.getElementById('figure-width-new').value='70';validateFigureEditor();const modal=document.getElementById('figure-modal');modal.classList.add('open');modal.setAttribute('aria-hidden','false');setTimeout(()=>document.getElementById('figure-caption-new').focus(),0);
}
function closeFigureEditor(){const modal=document.getElementById('figure-modal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');figureInsertState=null;}
function saveFigureEditor(){if(!figureInsertState||!validateFigureEditor())return;const state=figureInsertState;const payload={type:'insertFigureConfigured',latexPath:state.latexPath,frameIndex:state.frameIndex,cursorPos:state.cursorPos,caption:String(document.getElementById('figure-caption-new').value||''),shortCaption:String(document.getElementById('figure-short-caption-new').value||''),angle:Number(document.getElementById('figure-angle-new').value)||0,label:String(document.getElementById('figure-label-new').value||''),placement:isBeamer?'':String(document.getElementById('figure-placement-new').value||''),captionPosition:String(document.getElementById('figure-caption-position-new').value||'below'),align:String(document.getElementById('figure-align-new').value||'center'),widthPercent:Number(document.getElementById('figure-width-new').value)||70};closeFigureEditor();vscode.postMessage(payload);}
['figure-label-new','figure-width-new'].forEach(id=>document.getElementById(id).addEventListener('input',validateFigureEditor));document.getElementById('figure-close').onclick=closeFigureEditor;document.getElementById('figure-cancel').onclick=closeFigureEditor;document.getElementById('figure-insert').onclick=saveFigureEditor;document.getElementById('figure-modal').addEventListener('mousedown',e=>{if(e.target.id==='figure-modal')closeFigureEditor()});
function tableEditorValues(){
 const rows=Math.max(1,Math.min(30,Number(document.getElementById('table-rows').value)||0));
 const cols=Math.max(1,Math.min(12,Number(document.getElementById('table-cols').value)||0));
 const caption=String(document.getElementById('table-caption').value||'');
 const label=String(document.getElementById('table-label').value||'').trim();
 const placement=isBeamer?'':String(document.getElementById('table-placement').value||'');
 const tableStyle=String(document.getElementById('table-style-new').value||'plain')==='booktabs'?'booktabs':'plain';
 const alignments=[...document.querySelectorAll('#table-alignments select')].map(x=>x.value||'c');
 return{rows,cols,caption,label,placement,tableStyle,alignments};
}
function renderTableEditor(){
 const rowsInput=document.getElementById('table-rows'),colsInput=document.getElementById('table-cols');
 let rows=Number(rowsInput.value)||0,cols=Number(colsInput.value)||0;
 const validation=document.getElementById('table-validation');
 let error='';if(!Number.isInteger(rows)||rows<1||rows>30)error='Rows must be between 1 and 30.';else if(!Number.isInteger(cols)||cols<1||cols>12)error='Columns must be between 1 and 12.';
 const label=String(document.getElementById('table-label').value||'').trim();if(!error&&label&&!/^[^{}\\\s]+$/.test(label))error='Labels cannot contain spaces, braces, or backslashes.';if(!error&&label&&documentLabels.some(x=>x.key===label))error='That label already exists.';
 validation.textContent=error;document.getElementById('table-insert').disabled=!!error;
 if(error){rows=Math.max(1,Math.min(30,rows||1));cols=Math.max(1,Math.min(12,cols||1));}
 const aligns=document.getElementById('table-alignments');const previous=[...aligns.querySelectorAll('select')].map(x=>x.value||'c');aligns.innerHTML='';
 for(let i=0;i<cols;i++){const box=document.createElement('label');box.className='table-align-control';box.innerHTML='<span>Col '+(i+1)+'</span><select aria-label="Column '+(i+1)+' alignment"><option value="l">Left</option><option value="c">Center</option><option value="r">Right</option></select>';const select=box.querySelector('select');select.value=previous[i]||'c';select.addEventListener('change',renderTablePreview);aligns.appendChild(box);}
 renderTablePreview();
}
function renderTablePreview(){
 const rows=Math.max(1,Math.min(30,Number(document.getElementById('table-rows').value)||1)),cols=Math.max(1,Math.min(12,Number(document.getElementById('table-cols').value)||1));const alignments=[...document.querySelectorAll('#table-alignments select')].map(x=>x.value||'c'),table=document.getElementById('table-preview');let html='';for(let r=0;r<Math.min(rows,6);r++){html+='<tr>';for(let c=0;c<cols;c++){const a=alignments[c]==='l'?'left':alignments[c]==='r'?'right':'center';html+='<td style="text-align:'+a+'">'+(r===0?'Column '+(c+1):'')+'</td>';}html+='</tr>';}if(rows>6)html+='<tr><td colspan="'+cols+'" style="text-align:center">… '+rows+' rows total</td></tr>';table.innerHTML=html;
}
function openTableEditor(){
 tableInsertAnchor=snapshotVisualCursor();const modal=document.getElementById('table-modal');document.getElementById('table-rows').value='3';document.getElementById('table-cols').value='3';document.getElementById('table-caption').value='';document.getElementById('table-label').value='tab:table';document.getElementById('table-placement').value='htbp';document.getElementById('table-style-new').value='plain';document.getElementById('table-placement-field').style.display=isBeamer?'none':'';modal.classList.add('open');modal.setAttribute('aria-hidden','false');renderTableEditor();setTimeout(()=>document.getElementById('table-rows').focus(),0);
}
function closeTableEditor(){const modal=document.getElementById('table-modal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');tableInsertAnchor=null;}
function saveTableEditor(){
 renderTableEditor();if(document.getElementById('table-insert').disabled)return;const v=tableEditorValues(),anchor=tableInsertAnchor||lastVisualCursor,pos=rememberedStructuralCursorPos(anchor);closeTableEditor();lastVisualCursor=anchor||lastVisualCursor;vscode.postMessage({type:'insertTable',frameIndex:current,cursorPos:pos,rows:v.rows,cols:v.cols,caption:v.caption,label:v.label,placement:v.placement,tableStyle:v.tableStyle,alignments:v.alignments});if(v.tableStyle==='booktabs')vscode.postMessage({type:'ensureFeaturePackage',feature:'booktabs'});
}
['table-rows','table-cols','table-label'].forEach(id=>document.getElementById(id).addEventListener('input',renderTableEditor));document.getElementById('table-caption').addEventListener('input',renderTablePreview);document.getElementById('table-close').onclick=closeTableEditor;document.getElementById('table-cancel').onclick=closeTableEditor;document.getElementById('table-insert').onclick=saveTableEditor;document.getElementById('table-modal').addEventListener('mousedown',e=>{if(e.target.id==='table-modal')closeTableEditor()});
document.getElementById('cite-search').addEventListener('input',renderCitationResults);document.getElementById('cite-close').onclick=closeCitationPicker;document.getElementById('cite-cancel').onclick=closeCitationPicker;document.getElementById('cite-insert').onclick=saveCitationPicker;document.getElementById('cite-add-bib').onclick=()=>{const anchor=citationAnchor;const pos=rememberedStructuralCursorPos();closeCitationPicker();lastVisualCursor=anchor||lastVisualCursor;vscode.postMessage({type:'addBibliography',resumeCitation:true,cursorPos:pos});};document.getElementById('cite-open-bib').onclick=()=>vscode.postMessage({type:'openBibliography'});document.getElementById('cite-modal').addEventListener('mousedown',e=>{if(e.target.id==='cite-modal')closeCitationPicker()});
document.getElementById('reference-search').addEventListener('input',renderReferenceResults);document.getElementById('reference-close').onclick=closeReferencePicker;document.getElementById('reference-cancel').onclick=closeReferencePicker;document.getElementById('reference-insert').onclick=saveReferencePicker;document.getElementById('reference-modal').addEventListener('mousedown',e=>{if(e.target.id==='reference-modal')closeReferencePicker()});document.getElementById('label-close').onclick=closeLabelPicker;document.getElementById('label-cancel').onclick=closeLabelPicker;document.getElementById('label-insert').onclick=saveLabelPicker;document.getElementById('label-key').addEventListener('input',e=>document.getElementById('label-validation').textContent=validateLabelKey(e.target.value));document.getElementById('label-key').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveLabelPicker();}});document.getElementById('label-modal').addEventListener('mousedown',e=>{if(e.target.id==='label-modal')closeLabelPicker()});
document.getElementById('symbol-search').addEventListener('input',e=>{const q=String(e.target.value||'').toLowerCase().trim();document.querySelectorAll('#symbol-grid button').forEach(b=>{const hay=(b.textContent+' '+(b.title||'')+' '+(b.dataset.latex||'')).toLowerCase();b.style.display=!q||hay.includes(q)?'':'none';});});
const citationMenuButton=document.querySelector('.insert[data-action="citation"]');if(citationMenuButton)citationMenuButton.addEventListener('mousedown',e=>{rememberVisualCursor();e.preventDefault();});
const referenceMenuButton=document.querySelector('.insert[data-action="reference"]');if(referenceMenuButton)referenceMenuButton.addEventListener('mousedown',e=>{rememberVisualCursor();e.preventDefault();});
const figureMenuButton=document.querySelector('.insert[data-action="figure"]');if(figureMenuButton)figureMenuButton.addEventListener('mousedown',e=>{rememberVisualCursor();e.preventDefault();});
const tableMenuButton=document.querySelector('.insert[data-action="table"]');if(tableMenuButton)tableMenuButton.addEventListener('mousedown',e=>{rememberVisualCursor();e.preventDefault();});
const spacingMenuButton=document.querySelector('.insert[data-action="spacing"]');if(spacingMenuButton)spacingMenuButton.addEventListener('mousedown',e=>{rememberVisualCursor();e.preventDefault();});
function closeMenus(){document.querySelectorAll('.menu-panel').forEach(x=>x.classList.remove('open'));document.querySelectorAll('.menu-trigger').forEach(x=>x.classList.remove('open'));}
document.querySelectorAll('.menu-trigger').forEach(btn=>{btn.addEventListener('mousedown',e=>e.preventDefault());btn.addEventListener('click',e=>{e.stopPropagation();const panel=document.getElementById('menu-'+btn.dataset.menu);const open=panel.classList.contains('open');closeMenus();if(!open){panel.classList.add('open');btn.classList.add('open')}})});
document.addEventListener('click',e=>{if(!e.target.closest('.menu'))closeMenus()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(document.getElementById('reference-modal').classList.contains('open'))closeReferencePicker();else if(document.getElementById('label-modal').classList.contains('open'))closeLabelPicker();else if(document.getElementById('cite-modal').classList.contains('open'))closeCitationPicker();else if(document.getElementById('figure-modal').classList.contains('open'))closeFigureEditor();else if(document.getElementById('table-modal').classList.contains('open'))closeTableEditor();else if(document.getElementById('frame-options-modal').classList.contains('open'))closeFrameOptions();else if(document.getElementById('math-modal').classList.contains('open'))closeMathEditor();else if(mode==='preamble')closePreambleEditor();else closeMenus();}});
document.querySelectorAll('.menu-panel button').forEach(btn=>btn.addEventListener('click',()=>setTimeout(closeMenus,0)));
let labsClipboard='',labsClipboardArmed=false;
function closeLabsDialog(){const old=document.getElementById('labs-dynamic-modal');if(old)old.remove();}
function openLabsDialog(title,fields,onSave,note='Experimental Labs feature',saveLabel='Insert'){
 closeLabsDialog();rememberVisualCursor();const anchor=snapshotVisualCursor()||lastVisualCursor;
 const back=document.createElement('div');back.id='labs-dynamic-modal';back.className='cite-modal-backdrop open';back.setAttribute('aria-hidden','false');
 const section=document.createElement('section');section.className='cite-modal';section.style.width='min(680px,calc(100vw - 34px))';
 section.innerHTML='<header class="cite-modal-head"><strong>'+esc(title)+'</strong><span class="spacer"></span><button class="cite-close labs-close" type="button">✕</button></header><div class="cite-modal-body"><div class="labs-form-grid"></div><div class="labs-feature-note">'+esc(note)+'</div></div><footer class="cite-modal-foot"><span class="spacer"></span><button class="cite-cancel labs-cancel" type="button">Cancel</button><button class="cite-insert labs-save" type="button">'+esc(saveLabel)+'</button></footer>';
 const grid=section.querySelector('.labs-form-grid'),controls={};
 (fields||[]).forEach(f=>{const lab=document.createElement('label');if(f.wide!==false)lab.classList.add('wide');const span=document.createElement('span');span.textContent=f.label;lab.appendChild(span);let el;if(f.type==='select'){el=document.createElement('select');(f.options||[]).forEach(o=>{const op=document.createElement('option');op.value=Array.isArray(o)?o[0]:o;op.textContent=Array.isArray(o)?o[1]:o;if(String(f.value||'')===String(op.value))op.selected=true;el.appendChild(op);});}else if(f.type==='textarea'){el=document.createElement('textarea');el.rows=f.rows||4;el.value=f.value||'';}else{el=document.createElement('input');el.type=f.type||'text';el.value=f.value||'';el.placeholder=f.placeholder||'';}el.dataset.labsField=f.id;controls[f.id]=el;lab.appendChild(el);grid.appendChild(lab);});
 back.appendChild(section);document.body.appendChild(back);const close=()=>closeLabsDialog();section.querySelector('.labs-close').onclick=close;section.querySelector('.labs-cancel').onclick=close;back.addEventListener('mousedown',e=>{if(e.target===back)close();});section.querySelector('.labs-save').onclick=()=>{const values={};Object.keys(controls).forEach(k=>values[k]=controls[k].value);if(onSave(values,anchor)!==false)close();};setTimeout(()=>{const first=Object.values(controls)[0];if(first)first.focus();},0);
}
function labsInsertInline(code,anchor,feature=''){if(!insertLatexAtRememberedCursor(code,anchor)){vscode.postMessage({type:'showWarning',message:'Place the cursor in editable text first.'});return false;}if(feature)vscode.postMessage({type:'ensureFeaturePackage',feature});return true;}
function labsInsertBlock(code,feature='',anchor=null){vscode.postMessage({type:'insertRawLatex',frameIndex:current,cursorPos:rememberedStructuralCursorPos(anchor),latex:code,feature});return true;}
function openLabsFootnote(){openLabsDialog('Insert footnote',[{id:'text',label:'Footnote text',type:'textarea',rows:5}],(v,a)=>v.text.trim()?labsInsertInline('\\footnote{'+v.text.replace(/[{}]/g,'')+'}',a):false,'Inserted as an atomic inline footnote.');}
function openLabsLink(){openLabsDialog('Insert link',[{id:'label',label:'Display text',placeholder:'OpenAI'},{id:'url',label:'URL',placeholder:'https://example.com'}],(v,a)=>{const url=v.url.trim();if(!url)return false;return labsInsertInline(v.label.trim()?'\\href{'+url.replace(/[{}]/g,'')+'}{'+v.label.replace(/[{}]/g,'')+'}':'\\url{'+url.replace(/[{}]/g,'')+'}',a,'link');},'TeXFlow adds hyperref when needed.');}
function openLabsSubfigures(data){
 const paths=Array.isArray(data&&data.paths)?data.paths:[];if(paths.length<2){vscode.postMessage({type:'showWarning',message:'Choose at least two valid images for subfigures.'});return;}
 openLabsDialog('Insert subfigures',[{id:'caption',label:'Main caption'},{id:'label',label:'Main label',value:'fig:group'},{id:'subcaptions',label:'Subcaptions (one per line)',type:'textarea',rows:Math.min(6,paths.length),value:paths.map(p=>String(p).split('/').pop().replace(/\.[^.]+$/,'')).join('\n')}],v=>{
  const captions=String(v.subcaptions||'').split(/\r?\n/),n=paths.length,width=Math.max(.15,Math.min(.9,.96/Math.min(n,3)));
  const parts=paths.map((p,i)=>'\\begin{subfigure}[t]{'+width.toFixed(2)+'\\textwidth}\n\\centering\n\\includegraphics[width=\\linewidth]{'+p+'}\n'+(captions[i]?'\\caption{'+escapeLatexPlainText(captions[i].replace(/[{}]/g,''))+'}\n':'')+'\\end{subfigure}');
  const code='\\begin{figure}[htbp]\n\\centering\n'+parts.join('\\hfill\n')+'\n'+(v.caption.trim()?'\\caption{'+escapeLatexPlainText(v.caption.replace(/[{}]/g,''))+'}\n':'')+(v.label.trim()?'\\label{'+v.label.replace(/[{}\\\s]/g,'')+'}\n':'')+'\\end{figure}';
  vscode.postMessage({type:'insertRawLatex',frameIndex:Number(data.frameIndex)||current,cursorPos:Number(data.cursorPos),latex:code,feature:'subfigure'});return true;
 },'Experimental: uses the subcaption package. Up to six selected images are preserved as standard LaTeX subfigures.');
}
function openLabsSpecial(){openLabsDialog('Insert special character',[{id:'char',label:'Character',type:'select',options:[['%','% — percent'],['&','& — ampersand'],['#','# — hash'],['_','_ — underscore'],['$','$ — dollar'],['{','{ — left brace'],['}','} — right brace'],['~','~ — tilde'],['^','^ — caret']]}],(v,a)=>{const map={'%':'\\%','&':'\\&','#':'\\#','_':'\\_','$':'\\$','{':'\\{','}':'\\}','~':'\\textasciitilde{}','^':'\\textasciicircum{}'};return labsInsertInline(map[v.char]||v.char,a);});}
function openLabsAuthorNote(){openLabsDialog('Insert author note',[{id:'text',label:'Note',type:'textarea',rows:4}],(v,a)=>v.text.trim()?labsInsertBlock('% TeXFlow note: '+v.text.replace(/\r?\n/g,' '),'comment',a):false,'Author notes are source comments marked by TeXFlow and never appear in the PDF.');}
function openLabsComment(){openLabsDialog('Insert source comment',[{id:'text',label:'Comment',type:'textarea',rows:4}],(v,a)=>v.text.trim()?labsInsertBlock('% '+v.text.replace(/\r?\n/g,' '),'comment',a):false,'Comments stay out of the compiled PDF.');}
function openLabsQuote(env='quote'){openLabsDialog(env==='quotation'?'Insert quotation':'Insert quote',[{id:'text',label:'Text',type:'textarea',rows:6}],(v,a)=>v.text.trim()?labsInsertBlock('\\begin{'+env+'}\n'+v.text+'\n\\end{'+env+'}','quote',a):false);}
function openLabsMinipage(){openLabsDialog('Insert minipage',[{id:'width',label:'Width',value:'0.9\\linewidth'},{id:'text',label:'Content',type:'textarea',rows:6}],(v,a)=>labsInsertBlock('\\begin{minipage}{'+(v.width.trim()||'0.9\\linewidth')+'}\n'+v.text+'\n\\end{minipage}','box',a),'A visual container; unsupported nested structures remain preserved.');}
function openLabsTheorem(){openLabsDialog('Insert theorem / proof',[{id:'env',label:'Environment',type:'select',options:['theorem','lemma','proposition','corollary','definition','proof']},{id:'text',label:'Content',type:'textarea',rows:6}],(v,a)=>v.text.trim()?labsInsertBlock('\\begin{'+v.env+'}\n'+v.text+'\n\\end{'+v.env+'}','theorem',a):false,'TeXFlow adds amsthm and standard theorem definitions when needed.');}
function openLabsIndex(){openLabsDialog('Insert index entry',[{id:'entry',label:'Index entry'}],(v,a)=>v.entry.trim()?labsInsertInline('\\index{'+v.entry.replace(/[{}]/g,'')+'}',a,'index'):false,'Use Insert → Print index to render it.');}
function openLabsNomenclature(){openLabsDialog('Insert nomenclature entry',[{id:'symbol',label:'Symbol',placeholder:'$\\alpha$'},{id:'description',label:'Description'}],(v,a)=>v.symbol.trim()&&v.description.trim()?labsInsertInline('\\nomenclature{'+v.symbol.replace(/[{}]/g,'')+'}{'+v.description.replace(/[{}]/g,'')+'}',a,'nomenclature'):false,'Use Insert → Print nomenclature to render it.');}
function openLabsField(){openLabsDialog('Insert field',[{id:'field',label:'Field',type:'select',options:[['today','Current date (\\today)'],['jobname','Document file name (\\jobname)']]}],(v,a)=>labsInsertInline('\\'+v.field,a));}
function openLabsTableData(){
 openLabsDialog('Table from CSV / TSV',[{id:'data',label:'Paste rows or choose a file below',type:'textarea',rows:10,placeholder:'Name\tValue\nA\t1\nB\t2'},{id:'delimiter',label:'Delimiter',type:'select',options:[['auto','Auto detect'],['tab','Tab'],['comma','Comma'],['semicolon','Semicolon']]},{id:'caption',label:'Caption'},{id:'label',label:'Label',value:'tab:data'}],(v,a)=>{
  const raw=String(v.data||'').trim();if(!raw)return false;const lines=raw.split(/\r?\n/).filter(Boolean);let delim=v.delimiter==='tab'?'\t':v.delimiter==='comma'?',':v.delimiter==='semicolon'?';':(lines[0].includes('\t')?'\t':lines[0].includes(';')?';':',');const rows=lines.map(line=>line.split(delim).map(x=>x.trim()));const cols=Math.max(...rows.map(r=>r.length));if(!cols||cols>12||rows.length>30){vscode.postMessage({type:'showWarning',message:'Tables support up to 30 rows and 12 columns.'});return false;}rows.forEach(r=>{while(r.length<cols)r.push('');});const safe=x=>escapeLatexPlainText(String(x||'').replace(/[{}]/g,''));const body=rows.map(r=>r.map(safe).join(' & ')+' \\\\').join('\n');const cap=escapeLatexPlainText(String(v.caption||'').trim().replace(/[{}]/g,''));const code='\\begin{table}[htbp]\n\\centering\n\\begin{tabular}{'+Array(cols).fill('c').join('')+'}\n'+body+'\n\\end{tabular}\n'+(cap?'\\caption{'+cap+'}\n':'')+(v.label.trim()?'\\label{'+v.label.replace(/[{}\\\s]/g,'')+'}\n':'')+'\\end{table}';labsInsertBlock(code,'csvtable',a);return true;
 },'Paste tab-separated data directly from a spreadsheet, or choose a CSV/TSV file. TeXFlow inserts a normal semantic table.');const modal=document.getElementById('labs-dynamic-modal');if(modal){const grid=modal.querySelector('.labs-form-grid'),btn=document.createElement('button');btn.type='button';btn.className='cite-secondary';btn.textContent='Choose CSV / TSV file…';btn.onclick=()=>vscode.postMessage({type:'chooseTableDataFile'});grid.appendChild(btn);}
}
function commitLabsInlineEdit(el){
 const editable=el&&el.closest?el.closest('[contenteditable=true]'):null;if(!editable||!editable.__texflowCommit)return false;
 editable.__texflowCommit(editableLatex(editable));return true;
}
function editLabsInlineObject(el){
 if(!el||!el.classList)return;
 if(el.classList.contains('tex-footnote')){
  const value=decodeURIComponent(el.dataset.footnote||'');openLabsDialog('Edit footnote',[{id:'text',label:'Footnote text',type:'textarea',rows:5,value}],v=>{if(!v.text.trim())return false;el.dataset.footnote=encodeURIComponent(v.text.replace(/[{}]/g,''));el.title=v.text;el.textContent=(v.text||'footnote').slice(0,36);return commitLabsInlineEdit(el);},'Atomic inline footnote.','Save');return;
 }
 if(el.classList.contains('tex-link')){
  const url=decodeURIComponent(el.dataset.linkUrl||''),label=decodeURIComponent(el.dataset.linkLabel||''),kind=el.dataset.linkKind||'url';openLabsDialog('Edit link',[{id:'label',label:'Display text',value:kind==='href'?label:''},{id:'url',label:'URL',value:url}],v=>{if(!v.url.trim())return false;const nextLabel=v.label.trim(),nextUrl=v.url.trim();el.dataset.linkKind=nextLabel?'href':'url';el.dataset.linkUrl=encodeURIComponent(nextUrl.replace(/[{}]/g,''));el.dataset.linkLabel=encodeURIComponent((nextLabel||nextUrl).replace(/[{}]/g,''));el.textContent=nextLabel||nextUrl;const ok=commitLabsInlineEdit(el);vscode.postMessage({type:'ensureFeaturePackage',feature:'link'});return ok;},'TeXFlow preserves the link as a semantic inline object.','Save');return;
 }
 if(el.classList.contains('tex-index')){
  const value=decodeURIComponent(el.dataset.index||'');openLabsDialog('Edit index entry',[{id:'entry',label:'Index entry',value}],v=>{if(!v.entry.trim())return false;el.dataset.index=encodeURIComponent(v.entry.replace(/[{}]/g,''));el.textContent=v.entry;const ok=commitLabsInlineEdit(el);vscode.postMessage({type:'ensureFeaturePackage',feature:'index'});return ok;},'Index entry; not printed until a print-index command is inserted.','Save');return;
 }
 if(el.classList.contains('tex-nomenclature')){
  const symbol=decodeURIComponent(el.dataset.symbol||''),description=decodeURIComponent(el.dataset.description||'');openLabsDialog('Edit nomenclature entry',[{id:'symbol',label:'Symbol',value:symbol},{id:'description',label:'Description',value:description}],v=>{if(!v.symbol.trim()||!v.description.trim())return false;el.dataset.symbol=encodeURIComponent(v.symbol.replace(/[{}]/g,''));el.dataset.description=encodeURIComponent(v.description.replace(/[{}]/g,''));el.textContent=v.symbol;const ok=commitLabsInlineEdit(el);vscode.postMessage({type:'ensureFeaturePackage',feature:'nomenclature'});return ok;},'Nomenclature entry; insert Print nomenclature to render the list.','Save');return;
 }
 if(el.classList.contains('tex-field')){
  const field=el.dataset.field||'today';openLabsDialog('Edit field',[{id:'field',label:'Field',type:'select',value:field,options:[['today','Current date (\\today)'],['jobname','Document file name (\\jobname)']]}],v=>{el.dataset.field=v.field;el.textContent=v.field==='today'?new Intl.DateTimeFormat(undefined,{day:'numeric',month:'long',year:'numeric'}).format(new Date()):v.field;return commitLabsInlineEdit(el);},'Dynamic LaTeX field.','Save');return;
 }
}
document.addEventListener('dblclick',e=>{const el=e.target&&e.target.closest?e.target.closest('.tex-footnote,.tex-link,.tex-index,.tex-nomenclature,.tex-field'):null;if(el){e.preventDefault();e.stopPropagation();editLabsInlineObject(el);}});
function openLabsFindReplace(){openLabsDialog('Find / Replace',[{id:'find',label:'Find literal text'},{id:'replace',label:'Replace with'}],v=>{if(!v.find)return false;vscode.postMessage({type:'findReplaceText',find:v.find,replace:v.replace});return true;},'Labs: literal text only; LaTeX command searches are refused.');}
function selectedDocumentNode(){if(isBeamer||!selectedSemanticBlock)return null;const id=selectedSemanticBlock.el&&selectedSemanticBlock.el.dataset&&selectedSemanticBlock.el.dataset.nodeId;return id&&documentFlowById[id]||null;}
function labsCopyObject(){const n=selectedDocumentNode();if(!n){vscode.postMessage({type:'showWarning',message:'Select a document object first.'});return;}labsClipboard=String(n.raw||'');labsClipboardArmed=!!labsClipboard;if(labsClipboard)vscode.postMessage({type:'writeClipboardText',text:labsClipboard});}
function labsPasteObject(){if(!labsClipboard){vscode.postMessage({type:'showWarning',message:'No TeXFlow object has been copied yet.'});return;}labsInsertBlock(labsClipboard,'clipboard');}
function labsDuplicateObject(){const n=selectedDocumentNode();if(!n)return;const src=documentSource,insert='\n\n'+String(n.raw||'')+'\n\n',next=src.slice(0,n.end)+insert+src.slice(n.end);vscode.postMessage({type:'replaceWholeDocumentExpected',expected:src,replacement:next});}
function labsMoveObject(dir){const n=selectedDocumentNode();if(!n)return;const flow=parseDocumentFlow().filter(x=>x.kind!=='matter'&&x.kind!=='toc'&&x.kind!=='bibliography'),i=flow.findIndex(x=>x.id===n.id),j=i+(dir<0?-1:1);if(i<0||j<0||j>=flow.length)return;const other=flow[j],src=documentSource;if(dir<0){const middle=src.slice(other.end,n.start),next=src.slice(0,other.start)+src.slice(n.start,n.end)+middle+src.slice(other.start,other.end)+src.slice(n.end);vscode.postMessage({type:'replaceWholeDocumentExpected',expected:src,replacement:next});}else{const middle=src.slice(n.end,other.start),next=src.slice(0,n.start)+src.slice(other.start,other.end)+middle+src.slice(n.start,n.end)+src.slice(other.end);vscode.postMessage({type:'replaceWholeDocumentExpected',expected:src,replacement:next});}}

let spacingInsertAnchor=null,spacingMode='vertical';
function validSpaceAmount(v){return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*(?:pt|mm|cm|in|em|ex|pc|bp|dd|cc|sp|\\baselineskip|\\parskip|\\textheight|\\linewidth)$/.test(String(v||'').trim());}
function setSpacingMode(mode){spacingMode=mode==='horizontal'?'horizontal':'vertical';document.getElementById('spacing-vertical').classList.toggle('active',spacingMode==='vertical');document.getElementById('spacing-horizontal').classList.toggle('active',spacingMode==='horizontal');document.getElementById('spacing-starred').closest('label').style.display='flex';validateSpacing();}
function validateSpacing(){const v=String(document.getElementById('spacing-amount').value||'').trim(),ok=validSpaceAmount(v),msg=document.getElementById('spacing-validation');msg.textContent=ok?'':'Enter a LaTeX length such as 6pt, 0.5cm, or 1em.';document.getElementById('spacing-insert').disabled=!ok;return ok;}
function openSpacingEditor(){rememberVisualCursor();spacingInsertAnchor=lastVisualCursor;spacingMode='vertical';document.getElementById('spacing-amount').value='6pt';document.getElementById('spacing-starred').checked=false;setSpacingMode('vertical');const m=document.getElementById('spacing-modal');m.classList.add('open');m.setAttribute('aria-hidden','false');setTimeout(()=>document.getElementById('spacing-amount').focus(),0);}
function closeSpacingEditor(){const m=document.getElementById('spacing-modal');m.classList.remove('open');m.setAttribute('aria-hidden','true');spacingInsertAnchor=null;}
function saveSpacingEditor(){if(!validateSpacing())return;const amount=String(document.getElementById('spacing-amount').value||'').trim(),starred=!!document.getElementById('spacing-starred').checked;if(spacingMode==='horizontal'){const code='\\hspace'+(starred?'*':'')+'{'+amount+'}';if(!insertLatexAtRememberedCursor(code,spacingInsertAnchor)){vscode.postMessage({type:'showWarning',message:'Place the cursor in editable text before inserting horizontal space.'});return;}closeSpacingEditor();return;}const pos=rememberedStructuralCursorPos();closeSpacingEditor();vscode.postMessage({type:'insertVerticalSpace',frameIndex:current,cursorPos:pos,amount,starred});}
document.getElementById('spacing-vertical').onclick=()=>setSpacingMode('vertical');document.getElementById('spacing-horizontal').onclick=()=>setSpacingMode('horizontal');document.getElementById('spacing-amount').addEventListener('input',validateSpacing);document.querySelectorAll('[data-space]').forEach(b=>b.onclick=()=>{document.getElementById('spacing-amount').value=b.dataset.space;validateSpacing();});document.getElementById('spacing-close').onclick=closeSpacingEditor;document.getElementById('spacing-cancel').onclick=closeSpacingEditor;document.getElementById('spacing-insert').onclick=saveSpacingEditor;document.getElementById('spacing-modal').addEventListener('mousedown',e=>{if(e.target.id==='spacing-modal')closeSpacingEditor()});
function openFrameOptions(){if(!isBeamer)return;const f=frames[current]||{},o=String(f.options||'');document.getElementById('frame-vertical').value=/(?:^|[\[,])\s*t(?:\s|,|\]|$)/.test(o)?'top':/(?:^|[\[,])\s*b(?:\s|,|\]|$)/.test(o)?'bottom':'center';document.getElementById('frame-fragile').checked=/\bfragile\b/.test(o);document.getElementById('frame-breaks').checked=/\ballowframebreaks\b/.test(o);const m=document.getElementById('frame-options-modal');m.classList.add('open');m.setAttribute('aria-hidden','false');}
function closeFrameOptions(){const m=document.getElementById('frame-options-modal');m.classList.remove('open');m.setAttribute('aria-hidden','true');}
document.getElementById('frame-options-close').onclick=closeFrameOptions;document.getElementById('frame-options-cancel').onclick=closeFrameOptions;document.getElementById('frame-options-save').onclick=()=>{vscode.postMessage({type:'updateFrameOptions',frameIndex:current,vertical:document.getElementById('frame-vertical').value,fragile:document.getElementById('frame-fragile').checked,allowFrameBreaks:document.getElementById('frame-breaks').checked});closeFrameOptions();};document.getElementById('frame-options-modal').addEventListener('mousedown',e=>{if(e.target.id==='frame-options-modal')closeFrameOptions()});

document.querySelectorAll('.format').forEach(btn=>{btn.addEventListener('mousedown',e=>{e.preventDefault();wrapSelection(btn.dataset.format);setTimeout(()=>closeTopMenus(),0)})});
document.querySelectorAll('.color-swatch').forEach(btn=>{btn.addEventListener('mousedown',e=>{e.preventDefault();wrapSelectionColor(btn.dataset.color);setTimeout(()=>closeTopMenus(),0)})});
function alignCurrentParagraph(alignment){const el=activeEditable&&activeEditable.isConnected?activeEditable:(document.activeElement&&document.activeElement.closest?document.activeElement.closest('.doc-paragraph,.slide .editable'):null);if(!el){vscode.postMessage({type:'showWarning',message:'Place the cursor in a text paragraph first.'});return;}if(!isBeamer&&el.dataset&&el.dataset.nodeId){const node=documentFlowById[el.dataset.nodeId];if(!node)return;const text=editableLatex(el);const env=alignment==='left'?'flushleft':alignment==='right'?'flushright':alignment==='center'?'center':'';updateDocumentNode(node,env?'\\begin{'+env+'}\n'+text+'\n\\end{'+env+'}':text,true);return;}const blockEl=el.closest('.block');if(blockEl){const blocks=parseBlocks((frames[current]||{}).body||''),idx=[...blockEl.parentElement.children].filter(x=>x.classList.contains('block')).indexOf(blockEl),b=blocks[idx];if(b)vscode.postMessage({type:'updateBlock',frameIndex:current,blockId:b.id,payload:{text:editableLatex(el),align:alignment},refresh:true});}}
document.querySelectorAll('.insert').forEach(btn=>btn.addEventListener('click',()=>{
 const a=btn.dataset.action;
 if(a==='title'||a==='author')vscode.postMessage({type:'setMetadata',field:a});
 else if(a==='abstract')vscode.postMessage({type:'insertAbstract'});
 else if(a==='frame')vscode.postMessage({type:'insertFrame',frameIndex:current});
 else if(a==='chapter')vscode.postMessage({type:'insertChapter',frameIndex:current});
 else if(a==='section')vscode.postMessage({type:'insertSection',frameIndex:current});
 else if(a==='subsection')vscode.postMessage({type:'insertSubsection',frameIndex:current});
 else if(a==='subsubsection')vscode.postMessage({type:'insertSubsubsection',frameIndex:current});
 else if(a==='paragraphHeading')vscode.postMessage({type:'insertParagraphHeading',frameIndex:current});
 else if(a==='paragraph')vscode.postMessage({type:'insertBlock',frameIndex:current,kind:'paragraph'});
 else if(a==='bullets')vscode.postMessage({type:'insertBlock',frameIndex:current,kind:'itemize'});
 else if(a==='numbered')vscode.postMessage({type:'insertBlock',frameIndex:current,kind:'enumerate'});
 else if(a==='inlinemath')openMathInsert('inlinemath',current);
 else if(a==='displaymath')openMathInsert('displaymath',current);
 else if(a==='equation')openMathInsert('equation',current);
 else if(a==='alignmath')openMathInsert('alignmath',current);
 else if(a==='gathermath')openMathInsert('gathermath',current);
 else if(a==='multlinemath')openMathInsert('multlinemath',current);
 else if(a==='casesmath')openMathInsert('casesmath',current);
 else if(a==='matrixmath')openMathInsert('matrixmath',current);
 else if(a==='citation')openCitationPicker();
 else if(a==='label')openLabelPicker();
 else if(a==='reference')openReferencePicker();
 else if(a==='figure')vscode.postMessage({type:'insertFigure',frameIndex:current,cursorPos:rememberedStructuralCursorPos()});
 else if(a==='table')openTableEditor();
 else if(a==='spacing')openSpacingEditor();
 else if(a==='alignleft')alignCurrentParagraph('left');
 else if(a==='aligncenter')alignCurrentParagraph('center');
 else if(a==='alignright')alignCurrentParagraph('right');
 else if(a==='alignjustify')alignCurrentParagraph('justify');
 else if(a==='columns2')insertLocalColumns(2);
 else if(a==='columns3')insertLocalColumns(3);
 else if(a==='documentsettings')renderPreamble(currentPreamble);
 else if(a==='beamerblock')vscode.postMessage({type:'insertBeamerBlock',frameIndex:current,env:'block',title:'Block title'});
 else if(a==='beameralert')vscode.postMessage({type:'insertBeamerBlock',frameIndex:current,env:'alertblock',title:'Alert'});
 else if(a==='beamerexample')vscode.postMessage({type:'insertBeamerBlock',frameIndex:current,env:'exampleblock',title:'Example'});
 else if(a==='frameoptions')openFrameOptions();
 else if(a==='addbibliography')vscode.postMessage({type:'addBibliography',resumeCitation:false,cursorPos:rememberedStructuralCursorPos()});
 else if(a==='referencessection')vscode.postMessage({type:'addReferencesSection',cursorPos:rememberedStructuralCursorPos()});
 else if(a==='openbibliography')vscode.postMessage({type:'openBibliography'});
}));
document.addEventListener('copy',e=>{if(eventInsideSemanticEditor(e.target)&&!selectedSemanticBlock)labsClipboardArmed=false;},true);
document.addEventListener('cut',e=>{if(eventInsideSemanticEditor(e.target)&&!selectedSemanticBlock)labsClipboardArmed=false;},true);
// Intercept the actual paste event rather than only Cmd/Ctrl+V keydown. VS Code/Electron
// can dispatch native paste even when the webview key event was handled, which previously
// let stale system-clipboard text appear in the paragraph and then inserted the TeXFlow
// object as a second action. Object paste is now atomic: one paste event, one object.
document.addEventListener('paste',e=>{
 if(!labsClipboardArmed)return;
 const target=e.target;
 if(target&&target.closest&&target.closest('input,select,textarea'))return;
 e.preventDefault();e.stopPropagation();labsPasteObject();
},true);
window.addEventListener('keydown',e=>{
 const shortcut=e.ctrlKey||e.metaKey,key=String(e.key||'').toLowerCase();
 if(!selectedSemanticBlock)return;
 if(eventInsideSemanticEditor(e.target))return;
 if(shortcut&&key==='c'){e.preventDefault();e.stopPropagation();labsCopyObject();return;}
 if(shortcut&&key==='d'){e.preventDefault();e.stopPropagation();labsDuplicateObject();return;}
 if(shortcut&&key==='x'){e.preventDefault();e.stopPropagation();labsCopyObject();const action=selectedSemanticBlock.deleteAction;clearSemanticBlockSelection();if(action)action();return;}
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopPropagation();const action=selectedSemanticBlock.deleteAction;clearSemanticBlockSelection();if(action)action();return;}
 if((e.key==='Enter'||e.key==='ArrowDown')&&!isBeamer){
  const el=selectedSemanticBlock.el,nodeId=el&&el.dataset&&el.dataset.nodeId,node=documentFlowById[nodeId];
  if(node){e.preventDefault();e.stopPropagation();const slot=document.querySelector('.doc-after-block-slot[data-after-node-id="'+nodeId+'"]');if(slot)slot.click();else createSyntheticParagraphAfter(el,node,'');}
 }
});
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
const cursorMenuButtons=['structure-menu-button','insert-menu-button','format-menu-button','references-menu-button','layout-menu-button'].map(id=>document.getElementById(id)).filter(Boolean);cursorMenuButtons.forEach(btn=>btn.addEventListener('mousedown',e=>{rememberVisualCursor();e.preventDefault();}));const topMenus=[...document.querySelectorAll('.top-menu')];function moveLanguageMenuToFormat(){const menu=document.getElementById('language-menu-top');const panel=document.querySelector('#format-menu .top-menu-panel');if(!menu||!panel)return;const divider=document.createElement('span');divider.className='menu-divider';const title=document.createElement('div');title.className='menu-title';title.textContent='Language';panel.appendChild(divider);panel.appendChild(title);['spell-language-automatic','spell-language-english','spell-language-spanish'].forEach(id=>{const btn=document.getElementById(id);if(btn)panel.appendChild(btn);});const toggleDivider=document.createElement('span');toggleDivider.className='menu-divider';panel.appendChild(toggleDivider);const toggle=document.getElementById('spell-check-toggle');if(toggle)panel.appendChild(toggle);menu.remove();}moveLanguageMenuToFormat();function closeTopMenus(except){topMenus.forEach(m=>{if(m!==except)m.classList.remove('open')})}topMenus.forEach(menu=>{const trigger=menu.querySelector(':scope > .top-action');trigger.onclick=e=>{e.stopPropagation();const wasOpen=menu.classList.contains('open');closeTopMenus();if(menu.id==='beamer-menu-top')updateFrameTextSizeMenu();menu.classList.toggle('open',!wasOpen);};});document.querySelectorAll('.frame-size-option').forEach(btn=>{btn.onmousedown=e=>{rememberVisualCursor();e.preventDefault();};btn.onclick=()=>{const size=String(btn.dataset.frameSize||'normal');closeTopMenus();vscode.postMessage({type:'updateFrameFontSize',frameIndex:current,size});};});function runTopMenuAction(action){closeTopMenus();if(action==='title'||action==='author')vscode.postMessage({type:'setMetadata',field:action});else if(action==='abstract')vscode.postMessage({type:'insertAbstract'});else if(action==='frame')vscode.postMessage({type:'insertFrame',frameIndex:current});else if(action==='chapter')vscode.postMessage({type:'insertChapter',frameIndex:current});else if(action==='section')vscode.postMessage({type:'insertSection',frameIndex:current});else if(action==='subsection')vscode.postMessage({type:'insertSubsection',frameIndex:current});else if(action==='subsubsection')vscode.postMessage({type:'insertSubsubsection',frameIndex:current});else if(action==='paragraphHeading')vscode.postMessage({type:'insertParagraphHeading',frameIndex:current});else if(action==='paragraph')vscode.postMessage({type:'insertBlock',frameIndex:current,kind:'paragraph'});else if(action==='bullets')vscode.postMessage({type:'insertBlock',frameIndex:current,kind:'itemize'});else if(action==='numbered')vscode.postMessage({type:'insertBlock',frameIndex:current,kind:'enumerate'});else if(action==='inlinemath')openMathInsert('inlinemath',current);else if(action==='displaymath')openMathInsert('displaymath',current);else if(action==='equation')openMathInsert('equation',current);else if(action==='alignmath')openMathInsert('alignmath',current);else if(action==='gathermath')openMathInsert('gathermath',current);else if(action==='multlinemath')openMathInsert('multlinemath',current);else if(action==='casesmath')openMathInsert('casesmath',current);else if(action==='matrixmath')openMathInsert('matrixmath',current);else if(action==='citation')openCitationPicker();else if(action==='addbibliography')vscode.postMessage({type:'addBibliography',resumeCitation:false,cursorPos:rememberedStructuralCursorPos()});else if(action==='referencessection')vscode.postMessage({type:'addReferencesSection',cursorPos:rememberedStructuralCursorPos()});else if(action==='openbibliography')vscode.postMessage({type:'openBibliography'});else if(action==='label')openLabelPicker();else if(action==='reference')openReferencePicker();else if(action==='footnote')openLabsFootnote();else if(action==='link')openLabsLink();else if(action==='special')openLabsSpecial();else if(action==='index')openLabsIndex();else if(action==='nomenclature')openLabsNomenclature();else if(action==='field')openLabsField();else if(action==='newpage')labsInsertBlock('\\newpage','break');else if(action==='clearpage')labsInsertBlock('\\clearpage','break');else if(action==='quote')openLabsQuote('quote');else if(action==='quotation')openLabsQuote('quotation');else if(action==='minipage')openLabsMinipage();else if(action==='theorem')openLabsTheorem();else if(action==='comment')openLabsComment();else if(action==='authornote')openLabsAuthorNote();else if(action==='printindex')labsInsertBlock('\\printindex','index');else if(action==='printnomenclature')labsInsertBlock('\\printnomenclature','nomenclature');else if(action==='figure')vscode.postMessage({type:'insertFigure',frameIndex:current,cursorPos:rememberedStructuralCursorPos()});else if(action==='subfigures')vscode.postMessage({type:'chooseSubfigures',frameIndex:current,cursorPos:rememberedStructuralCursorPos()});else if(action==='table')openTableEditor();else if(action==='tabledata')openLabsTableData();else if(action==='spacing')openSpacingEditor();else if(action==='documentsettings')renderPreamble(currentPreamble);else if(action==='columns2')insertLocalColumns(2);else if(action==='columns3')insertLocalColumns(3);}
function renderTopMenu(panelId,sections){const panel=document.getElementById(panelId);if(!panel)return;panel.innerHTML='';const addTitle=t=>{const d=document.createElement('div');d.className='menu-title';d.textContent=t;panel.appendChild(d);};const addDivider=()=>{const d=document.createElement('span');d.className='menu-divider';panel.appendChild(d);};const add=(label,action)=>{const b=document.createElement('button');b.textContent=label;b.onmousedown=e=>{rememberVisualCursor();e.preventDefault();};b.onclick=()=>runTopMenuAction(action);panel.appendChild(b);};sections.forEach((section,i)=>{if(i)addDivider();if(section.title)addTitle(section.title);section.items.forEach(item=>{if(item.when===false)return;add(item.label,item.action);});});}
function renderTopMenus(){renderTopMenu('structure-menu-panel',[{title:'Document structure',items:[{label:'Normal text',action:'paragraph'},{label:'Title',action:'title'},{label:'Author',action:'author'},{label:'Abstract',action:'abstract',when:!isBeamer},{label:'Chapter',action:'chapter',when:['book','report'].includes(documentClass)},{label:'Section',action:'section'},{label:'Subsection',action:'subsection'},{label:'Subsubsection',action:'subsubsection',when:!isBeamer},{label:'Paragraph heading',action:'paragraphHeading',when:!isBeamer}]},{title:'Lists',items:[{label:'Bulleted list',action:'bullets'},{label:'Numbered list',action:'numbered'}]},{title:'Blocks & containers',items:[{label:'Quote…',action:'quote'},{label:'Quotation…',action:'quotation'},{label:'Minipage…',action:'minipage'},{label:'Theorem / proof…',action:'theorem'},{label:'Source comment…',action:'comment'},{label:'Author note…',action:'authornote'},{label:'Two-column block…',action:'columns2'},{label:'Three-column block…',action:'columns3'}]}]);renderTopMenu('insert-menu-panel',[{title:'Math',items:[{label:'Inline math',action:'inlinemath'},{label:'Display math',action:'displaymath'},{label:'Numbered equation…',action:'equation'},{label:'Aligned equations…',action:'alignmath'},{label:'Gathered equations…',action:'gathermath'},{label:'Multiline equation…',action:'multlinemath'},{label:'Cases / system…',action:'casesmath'},{label:'Matrix…',action:'matrixmath'}]},{title:'Figures',items:[{label:'Figure…',action:'figure'},{label:'Subfigures…',action:'subfigures'}]},{title:'Tables',items:[{label:'Table…',action:'table'},{label:'Table from CSV / TSV…',action:'tabledata'}]},{title:'Inline objects',items:[{label:'Link / URL…',action:'link'},{label:'Special character…',action:'special'},{label:'Field…',action:'field'}]}]);renderTopMenu('references-menu-panel',[{title:'Citations & bibliography',items:[{label:'Insert citation…',action:'citation'},{label:'Add / change bibliography…',action:'addbibliography'},{label:'Insert bibliography…',action:'referencessection'},{label:'Open .bib',action:'openbibliography'}]},{title:'Cross-references',items:[{label:'Add label to selected object…',action:'label'},{label:'Insert cross-reference…',action:'reference'}]},{title:'Notes & indexes',items:[{label:'Footnote…',action:'footnote'},{label:'Index entry…',action:'index'},{label:'Print index',action:'printindex'},{label:'Nomenclature entry…',action:'nomenclature'},{label:'Print nomenclature',action:'printnomenclature'}]}]);renderTopMenu('layout-menu-panel',[{title:'Document',items:[{label:'Document settings / preamble…',action:'documentsettings'}]},{title:'Spacing',items:[{label:'Horizontal / vertical spacing…',action:'spacing'}]},{title:'Breaks',items:[{label:'Page break',action:'newpage'},{label:'Clear page',action:'clearpage'}]}]);} document.getElementById('view-continuous').onclick=()=>{documentLayoutMode='continuous';updateDocumentViewMenu();closeTopMenus();renderWorkspace();};document.getElementById('view-pages').onclick=()=>{documentLayoutMode='pages';updateDocumentViewMenu();closeTopMenus();renderWorkspace();};document.addEventListener('click',e=>{if(!e.target.closest('.top-menu'))closeTopMenus();});document.querySelectorAll('.mode-tab').forEach(btn=>btn.onclick=()=>{viewMode=btn.dataset.view;renderWorkspace();});document.getElementById('new-document').onclick=()=>{closeTopMenus();vscode.postMessage({type:'newDocument'});};document.getElementById('open-file').onclick=()=>{closeTopMenus();vscode.postMessage({type:'open'});};document.getElementById('save-file').onclick=()=>{closeTopMenus();const el=document.getElementById('save-status');el.textContent='Saving…';vscode.postMessage({type:'save'});};document.getElementById('save-as').onclick=()=>{closeTopMenus();vscode.postMessage({type:'saveAs'});};document.getElementById('undo').onclick=()=>vscode.postMessage({type:'undo'});document.getElementById('redo').onclick=()=>vscode.postMessage({type:'redo'});document.getElementById('labs-find-replace').onclick=()=>{closeTopMenus();openLabsFindReplace();};document.getElementById('labs-copy-object').onclick=()=>{closeTopMenus();labsCopyObject();};document.getElementById('labs-paste-object').onclick=()=>{closeTopMenus();labsPasteObject();};document.getElementById('labs-duplicate-object').onclick=()=>{closeTopMenus();labsDuplicateObject();};document.getElementById('labs-move-up').onclick=()=>{closeTopMenus();labsMoveObject(-1);};document.getElementById('labs-move-down').onclick=()=>{closeTopMenus();labsMoveObject(1);};document.getElementById('project-diagnostics').onclick=()=>{closeTopMenus();vscode.postMessage({type:'showProjectDiagnostics'});};document.getElementById('top-compile').onclick=()=>vscode.postMessage({type:'compile'});document.getElementById('spell-language-automatic').onclick=()=>vscode.postMessage({type:'updateSpellcheckSetting',key:'language',value:'auto'});document.getElementById('spell-language-english').onclick=()=>vscode.postMessage({type:'updateSpellcheckSetting',key:'language',value:'en'});document.getElementById('spell-language-spanish').onclick=()=>vscode.postMessage({type:'updateSpellcheckSetting',key:'language',value:'es'});document.getElementById('spell-check-toggle').onclick=()=>vscode.postMessage({type:'updateSpellcheckSetting',key:'enabled',value:!texflowSpellState.enabled});const body=document.body;const toggleNav=document.getElementById('toggle-nav');const focusBtn=document.getElementById('focus-mode');const exitFocus=document.getElementById('exit-focus');function setNav(open){body.classList.toggle('nav-open',open);body.classList.toggle('nav-closed',!open);localStorage.setItem('texflow-nav',open?'open':'closed');}function setFocus(on){body.classList.toggle('focus-mode',on);localStorage.setItem('texflow-focus',on?'on':'off');}// Every TeXFlow document starts with its navigator visible on desktop.
// On narrow panes it starts closed and the Index button opens it as an overlay.
setNav(window.innerWidth>=900);setFocus(localStorage.getItem('texflow-focus')==='on');toggleNav.onclick=()=>{setNav(body.classList.contains('nav-closed'));closeTopMenus();};focusBtn.onclick=()=>{setFocus(!body.classList.contains('focus-mode'));closeTopMenus();};exitFocus.onclick=()=>setFocus(false);document.addEventListener('click',e=>{if(window.innerWidth<900&&body.classList.contains('nav-open')&&!e.target.closest('.side')&&!e.target.closest('#toggle-nav'))setNav(false);});window.addEventListener('resize',()=>{if(window.innerWidth<900&&body.classList.contains('nav-open'))setNav(false);});document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeTopMenus();if(body.classList.contains('focus-mode'))setFocus(false);}if(e.ctrlKey||e.metaKey){const k=e.key.toLowerCase();if(k==='s'){e.preventDefault();vscode.postMessage({type:e.shiftKey?'saveAs':'save'});}else if(k==='o'){e.preventDefault();vscode.postMessage({type:'open'});}else if(k==='z'){e.preventDefault();vscode.postMessage({type:e.shiftKey?'redo':'undo'});}}});vscode.postMessage({type:'ready'});
</script></body></html>`;
}

export function deactivate() {}
