import type { BlockAlignment, ParsedBlock } from './types';

export interface FigureParseData {
  path: string;
  options: string;
  width: { value?: number; unit?: string };
  height: { value?: number; unit?: string };
  caption: string;
  shortCaption: string;
  angle: number;
  label: string;
  placement: string;
  captionPosition: 'above' | 'below';
  align: 'left' | 'center' | 'right';
}

export interface TableParseData {
  simple: boolean;
  columns: string[];
  rows: string[][];
  caption: string;
  label: string;
  placement: string;
  captionPosition: 'above' | 'below';
  tableStyle: 'plain' | 'booktabs';
}

export function splitTopItems(inner: string): string[] {
  const source = String(inner || '');
  const items: string[] = [];
  let depth = 0;
  let start = -1;
  let i = 0;
  while (i < source.length) {
    if (source.startsWith('\\begin{', i)) { depth++; i += 7; continue; }
    if (source.startsWith('\\end{', i)) { depth = Math.max(0, depth - 1); i += 5; continue; }
    if (depth === 0 && source.startsWith('\\item', i)) {
      if (start >= 0) items.push(source.slice(start, i).trim());
      i += 5;
      while (i < source.length && /\s/.test(source[i])) i++;
      start = i;
      continue;
    }
    i++;
  }
  if (start >= 0) items.push(source.slice(start).trim());
  if (!items.length && source.trim()) items.push(source.trim());
  return items;
}

export function alignmentFromDirective(raw: string, current: BlockAlignment = 'justify'): BlockAlignment {
  const text = String(raw || '');
  const matches = [...text.matchAll(/\\(centering|raggedright|raggedleft|justifying)\b/g)];
  if (!matches.length) return current || 'justify';
  const cmd = matches[matches.length - 1][1];
  if (cmd === 'centering') return 'center';
  if (cmd === 'raggedright') return 'left';
  if (cmd === 'raggedleft') return 'right';
  return 'justify';
}

export function isOnlyAlignmentDirective(raw: string): boolean {
  return /^(?:\s|%[^\n]*(?:\n|$))*\\(?:centering|raggedright|raggedleft|justifying)\b\s*(?:%[^\n]*)?\s*$/.test(String(raw || ''));
}

export function figureData(raw: string): FigureParseData {
  const text = String(raw || '');
  const graphic = /\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}/.exec(text);
  const options = graphic?.[1] || '';
  const figurePath = graphic?.[2]?.trim() || '';
  const parts = options.split(',').map(x => x.trim()).filter(Boolean);
  const dim = (name: string): { value?: number; unit?: string } => {
    const token = parts.find(x => new RegExp('^' + name + '\\s*=').test(x));
    if (!token) return {};
    const value = token.slice(token.indexOf('=') + 1).trim();
    const m = /^([0-9]*\.?[0-9]+)\s*(\\(?:textwidth|linewidth|columnwidth|paperwidth|textheight)|[a-zA-Z]+)$/.exec(value);
    return m ? { value: Number(m[1]), unit: m[2] } : {};
  };
  const captionMatch = /\\caption(?:\[([^\]]*)\])?\{([^}]*)\}/.exec(text);
  const shortCaption = captionMatch?.[1] || '';
  const caption = captionMatch?.[2] || '';
  const captionPosition: 'above' | 'below' = captionMatch && graphic && captionMatch.index < graphic.index ? 'above' : 'below';
  const label = (/\\label\{([^}]+)\}/.exec(text) || [])[1] || '';
  const placement = (/\\begin\{figure\}(?:\[([^\]]*)\])?/.exec(text) || [])[1] || '';
  const align: 'left' | 'center' | 'right' = /\\raggedleft|\\begin\{flushright\}/.test(text)
    ? 'right'
    : /\\centering|\\begin\{center\}/.test(text)
      ? 'center'
      : 'left';
  const angleToken = parts.find(x => /^angle\s*=/.test(x));
  const angle = angleToken ? Number(angleToken.slice(angleToken.indexOf('=') + 1).trim()) || 0 : 0;
  return {
    path: figurePath,
    options,
    width: dim('width'),
    height: dim('height'),
    caption,
    shortCaption,
    angle,
    label,
    placement,
    captionPosition,
    align
  };
}

export function tableData(raw: string): TableParseData {
  const text = String(raw || '');
  const tab = /\\begin\{tabular\}\{([^}]*)\}([\s\S]*?)\\end\{tabular\}/.exec(text);
  const captionMatch = /\\caption(?:\[[^\]]*\])?\{([^}]*)\}/.exec(text);
  const caption = captionMatch?.[1] || '';
  const captionPosition: 'above' | 'below' = captionMatch && tab && captionMatch.index < tab.index ? 'above' : 'below';
  const label = (/\\label\{([^}]+)\}/.exec(text) || [])[1] || '';
  const placement = (/\\begin\{table\}(?:\[([^\]]*)\])?/.exec(text) || [])[1] || '';
  if (!tab) return { simple: false, columns: [], rows: [], caption, label, placement, captionPosition, tableStyle: 'plain' };
  const spec = tab[1].trim();
  const tableStyle: 'plain' | 'booktabs' = /\\(?:toprule|midrule|bottomrule)\b/.test(tab[2]) ? 'booktabs' : 'plain';
  const unsupported = /\\(?:multicolumn|multirow|cline|cmidrule|begin\{|end\{)/.test(tab[2]);
  const columns = [...spec.matchAll(/[lcr]/g)].map(m => m[0]);
  if (!columns.length || unsupported || spec.replace(/[lcr|\s]/g, '') !== '') {
    return { simple: false, columns, rows: [], caption, label, placement, captionPosition, tableStyle };
  }
  let tbody = tab[2]
    .replace(/^[\s\n]+|[\s\n]+$/g, '')
    .replace(/(^|\n)\s*\\(?:hline|toprule|midrule|bottomrule)\s*(?=\n|$)/g, '$1');
  const rawRows = tbody.split(/\\\\(?:\s*\[[^\]]*\])?/).map(x => x.trim()).filter(Boolean);
  const rows = rawRows.map(r => r.split(/(?<!\\)&/).map(c => c.trim()));
  return {
    simple: !!rows.length && rows.every(r => r.length === columns.length),
    columns,
    rows,
    caption,
    label,
    placement,
    captionPosition,
    tableStyle
  };
}

export function findMatchingEnvEnd(source: string, env: string, from: number): { start: number; end: number } | null {
  const open = '\\begin{' + String(env) + '}';
  const close = '\\end{' + String(env) + '}';
  let depth = 1;
  let pos = from;
  while (pos < source.length) {
    const nextOpen = source.indexOf(open, pos);
    const nextClose = source.indexOf(close, pos);
    if (nextClose < 0) return null;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      pos = nextOpen + open.length;
      continue;
    }
    depth -= 1;
    if (depth === 0) return { start: nextClose, end: nextClose + close.length };
    pos = nextClose + close.length;
  }
  return null;
}

export function parseBlocks(body: string): ParsedBlock[] {
  const out: ParsedBlock[] = [];
  const re = /\\begin\{(itemize|enumerate|block|alertblock|exampleblock|equation\*?|align\*?|gather\*?|multline\*?|figure|table|columns|multicols|flushleft|center|flushright|quote|quotation|minipage|theorem|lemma|proposition|corollary|definition|proof|comment)\}(?:\[[^\]]*\])?(?:\{([^}]*)\})?|\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}|\\vspace(\*)?\{([^}]+)\}|\\(newpage|clearpage|pagebreak)\b|\$\$/g;
  let cur = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  let currentAlign: BlockAlignment = 'justify';

  const text = (s: number, e: number): void => {
    const raw = body.slice(s, e);
    if (!raw.trim()) return;

    if (s === 0) {
      const size = /^((?:(?:[ \t\r\n]+)|(?:[ \t]*%[^\n]*(?:\r?\n|$)))*)\\(?:normalsize|small|footnotesize|scriptsize|tiny)\b[ \t]*(?:%[^\n]*)?(?:\r?\n)?/.exec(raw);
      if (size) {
        const prefix = String(size[1] || '');
        const commandStart = s + prefix.length;
        const commandEnd = s + size[0].length;
        if (prefix) text(s, commandStart);
        out.push({
          id: 'b' + n++, kind: 'raw', start: commandStart, end: commandEnd,
          raw: body.slice(commandStart, commandEnd), text: body.slice(commandStart, commandEnd).trim(),
          hidden: true, align: currentAlign
        });
        if (commandEnd < e) text(commandEnd, e);
        return;
      }
    }

    const alignmentDirective = /(^|\r?\n)([ \t]*\\(centering|raggedright|raggedleft|justifying)\b[ \t]*(?:%[^\n]*)?)(?=\r?\n|$)/m.exec(raw);
    if (alignmentDirective) {
      const linePrefix = String(alignmentDirective[1] || '');
      const command = String(alignmentDirective[3] || '');
      const commandStart = s + (alignmentDirective.index || 0) + linePrefix.length;
      const commandEnd = commandStart + String(alignmentDirective[2] || '').length;
      if (commandStart > s) text(s, commandStart);
      currentAlign = alignmentFromDirective('\\' + command, currentAlign);
      out.push({
        id: 'b' + n++, kind: 'raw', start: commandStart, end: commandEnd,
        raw: body.slice(commandStart, commandEnd), text: body.slice(commandStart, commandEnd).trim(),
        hidden: true, align: currentAlign
      });
      if (commandEnd < e) text(commandEnd, e);
      return;
    }

    const standaloneComment = /(^|\r?\n)([ \t]*%[^\r\n]*)/.exec(raw);
    if (standaloneComment) {
      const prefixLength = String(standaloneComment[1] || '').length;
      const commentStart = (standaloneComment.index || 0) + prefixLength;
      let commentEnd = commentStart + String(standaloneComment[2] || '').length;
      while (commentEnd < raw.length) {
        const next = /^(\r?\n)([ \t]*%[^\r\n]*)/.exec(raw.slice(commentEnd));
        if (!next) break;
        commentEnd += next[0].length;
      }
      if (commentStart > 0) text(s, s + commentStart);
      const clean = raw.slice(commentStart, commentEnd);
      const commentNote = /^\s*%\s*TeXFlow note:/i.test(clean);
      const commentText = clean.replace(/^\s*%\s?/gm, '').replace(/^TeXFlow note:\s*/i, '');
      out.push({
        id: 'b' + n++, kind: 'comment', start: s + commentStart, end: s + commentEnd,
        raw: clean, text: commentText, commentText, commentNote, align: currentAlign
      });
      if (commentEnd < raw.length) text(s + commentEnd, e);
      return;
    }

    const trimmedRaw = raw.trim();
    if (trimmedRaw && trimmedRaw.split(/\r?\n/).every(line => /^\s*%/.test(line))) {
      const lead = raw.search(/\S/);
      const trail = (/\s*$/.exec(raw) || [''])[0].length;
      const start = lead < 0 ? s : s + lead;
      const end = e - trail;
      const clean = body.slice(start, end);
      const commentNote = /^\s*%\s*TeXFlow note:/i.test(clean);
      const commentText = clean.replace(/^\s*%\s?/gm, '').replace(/^TeXFlow note:\s*/i, '');
      out.push({ id: 'b' + n++, kind: 'comment', start, end, raw: clean, text: commentText, commentText, commentNote, align: currentAlign });
      return;
    }

    const labels = [...raw.matchAll(/\\label\{[^}]+\}/g)];
    if (labels.length) {
      let local = 0;
      for (const lm of labels) {
        const at = lm.index || 0;
        if (at > local) text(s + local, s + at);
        local = at + lm[0].length;
      }
      if (local < raw.length) text(s + local, e);
      return;
    }

    const nextAlign = alignmentFromDirective(raw, currentAlign);
    if (isOnlyAlignmentDirective(raw)) {
      const lead = raw.search(/\S/);
      const trail = (/\s*$/.exec(raw) || [''])[0].length;
      const start = lead < 0 ? s : s + lead;
      const end = e - trail;
      out.push({
        id: 'b' + n++, kind: 'raw', start, end,
        raw: body.slice(start, end), text: body.slice(start, end).trim(), hidden: true, align: nextAlign
      });
      currentAlign = nextAlign;
      return;
    }

    const unsafe = /^(?:\s*%|\s*\\(?:newpage|clearpage|pagebreak)\b)/m.test(raw)
      || /\\(begin|end|input|include|hypertarget|label|only|visible|uncover|pause|vspace|includegraphics|tikz)/.test(raw);
    if (unsafe) {
      const lead = raw.search(/\S/);
      const trail = (/\s*$/.exec(raw) || [''])[0].length;
      const start = lead < 0 ? s : s + lead;
      const end = e - trail;
      const clean = body.slice(start, end);
      if (clean) out.push({ id: 'b' + n++, kind: 'raw', start, end, raw: clean, text: clean, align: nextAlign });
      currentAlign = nextAlign;
      return;
    }

    const sep = /\n[ \t]*\n+/g;
    let local = 0;
    let sm: RegExpExecArray | null;
    const pushPara = (a: number, b: number): void => {
      if (b <= a) return;
      const seg = raw.slice(a, b);
      const lead = seg.search(/\S/);
      if (lead < 0) return;
      const trail = (/\s*$/.exec(seg) || [''])[0].length;
      const start = s + a + lead;
      const end = s + b - trail;
      if (end <= start) return;
      const clean = body.slice(start, end);
      out.push({ id: 'b' + n++, kind: 'paragraph', start, end, raw: clean, text: clean, align: nextAlign });
    };
    while ((sm = sep.exec(raw))) {
      pushPara(local, sm.index);
      local = sep.lastIndex;
    }
    pushPara(local, raw.length);
    currentAlign = nextAlign;
  };

  while ((m = re.exec(body))) {
    text(cur, m.index);

    if (m[0] === '$$') {
      const ep = body.indexOf('$$', re.lastIndex);
      if (ep < 0) break;
      const end = ep + 2;
      const raw = body.slice(m.index, end);
      const inner = body.slice(re.lastIndex, ep).trim();
      out.push({ id: 'b' + n++, kind: 'equation', start: m.index, end, raw, env: '$$', text: inner, align: 'center' });
      cur = end;
      re.lastIndex = end;
      continue;
    }

    if (m[4] !== undefined) {
      const raw = m[0];
      const d = figureData(raw);
      out.push({
        id: 'b' + n++, kind: 'figure', start: m.index, end: re.lastIndex, raw,
        env: 'includegraphics', text: raw, align: d.align,
        figurePath: d.path, figureOptions: d.options,
        figureWidth: d.width.value, figureWidthUnit: d.width.unit,
        figureHeight: d.height.value, figureHeightUnit: d.height.unit,
        figureCaption: d.caption, figureShortCaption: d.shortCaption,
        figureAngle: d.angle, figureLabel: d.label,
        figurePlacement: d.placement, figureCaptionPosition: d.captionPosition,
        figureAlign: d.align
      });
      cur = re.lastIndex;
      continue;
    }

    if (m[6] !== undefined) {
      const raw = m[0];
      out.push({
        id: 'b' + n++, kind: 'vspace', start: m.index, end: re.lastIndex, raw, text: raw,
        spaceAmount: String(m[6] || '').trim(), spaceStarred: m[5] === '*'
      });
      cur = re.lastIndex;
      continue;
    }

    if (m[7] !== undefined) {
      const raw = m[0];
      out.push({
        id: 'b' + n++, kind: 'break', start: m.index, end: re.lastIndex, raw, text: raw,
        breakCommand: String(m[7] || 'newpage')
      });
      cur = re.lastIndex;
      continue;
    }

    const env = m[1];
    const token = '\\end{' + env + '}';
    const match = findMatchingEnvEnd(body, env, re.lastIndex);
    if (!match) break;
    const end = match.end;
    const raw = body.slice(m.index, end);
    const inner = raw.slice(m[0].length, raw.length - token.length).trim();
    let kind: ParsedBlock['kind'] = 'raw';
    if (env === 'itemize' || env === 'enumerate') kind = 'itemize';
    else if (['block', 'alertblock', 'exampleblock'].includes(env)) kind = 'block';
    else if (/^(equation|align|gather|multline)/.test(env)) kind = 'equation';
    else if (env === 'figure') kind = 'figure';
    else if (env === 'table') kind = 'table';
    else if (env === 'columns' || env === 'multicols') kind = 'columns';
    else if (env === 'quote' || env === 'quotation') kind = 'quote';
    else if (env === 'minipage') kind = 'container';
    else if (['theorem', 'lemma', 'proposition', 'corollary', 'definition', 'proof'].includes(env)) kind = 'theorem';
    else if (env === 'comment') kind = 'commentblock';
    else if (['flushleft', 'center', 'flushright'].includes(env)) kind = 'paragraph';

    const effectiveAlign: BlockAlignment = ['flushleft', 'center', 'flushright'].includes(env)
      ? (env === 'flushleft' ? 'left' : env === 'flushright' ? 'right' : 'center')
      : kind === 'equation'
        ? 'center'
        : kind === 'itemize'
          ? (currentAlign === 'justify' ? 'left' : currentAlign)
          : currentAlign;

    const b: ParsedBlock = {
      id: 'b' + n++, kind, start: m.index, end, raw, env,
      title: m[2] || '', text: inner, align: effectiveAlign
    };

    if (kind === 'itemize') b.items = splitTopItems(inner);
    if (kind === 'figure') {
      const d = figureData(raw);
      Object.assign(b, {
        align: d.align,
        figureAlign: d.align,
        figurePath: d.path,
        figureOptions: d.options,
        figureWidth: d.width.value,
        figureWidthUnit: d.width.unit,
        figureHeight: d.height.value,
        figureHeightUnit: d.height.unit,
        figureCaption: d.caption,
        figureShortCaption: d.shortCaption,
        figureAngle: d.angle,
        figureLabel: d.label,
        figurePlacement: d.placement,
        figureCaptionPosition: d.captionPosition
      });
    }
    if (kind === 'columns') {
      if (env === 'multicols') {
        b.columnCount = Math.max(2, Math.min(4, Number(m[2]) || 2));
        b.columnTexts = inner.split(/\\columnbreak\b/).map(x => x.trim());
      } else {
        const ps = [...inner.matchAll(/\\column\{[^}]+\}([\s\S]*?)(?=\\column\{|$)/g)]
          .map(x => String(x[1] || '').trim());
        b.columnTexts = ps.length ? ps : [inner];
        b.columnCount = b.columnTexts.length;
      }
    }
    if (kind === 'table') {
      const d = tableData(raw);
      if (!d.simple) b.kind = 'raw';
      else Object.assign(b, {
        tableSimple: true,
        tableColumns: d.columns,
        tableRows: d.rows,
        tableCaption: d.caption,
        tableLabel: d.label,
        tablePlacement: d.placement,
        tableCaptionPosition: d.captionPosition,
        tableStyle: d.tableStyle
      });
    }

    out.push(b);
    cur = end;
    re.lastIndex = end;
  }

  text(cur, body.length);
  return out;
}

/**
 * Runtime source injected into the VS Code webview.
 *
 * This is deliberately generated from the same compiled functions used by the
 * Extension Host. It keeps the webview browser-only while removing the second
 * hand-maintained parser implementation that previously caused parity bugs.
 */
export function webviewParserRuntimeSource(): string {
  return [
    splitTopItems,
    alignmentFromDirective,
    isOnlyAlignmentDirective,
    figureData,
    tableData,
    findMatchingEnvEnd,
    parseBlocks
  ].map(fn => fn.toString()).join('\n');
}
