import type { BlockAlignment, ParsedBlock, ParsedFigureItem } from './types';

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
  items: ParsedFigureItem[];
  layout: 'side-by-side' | 'stacked';
}

export interface TableParseData {
  simple: boolean;
  columns: string[];
  rows: string[][];
  caption: string;
  label: string;
  placement: string;
  captionPosition: 'above' | 'below';
  tableStyle: 'plain' | 'booktabs' | 'grid' | 'custom';
  verticalBorders: boolean[];
  horizontalBorders: boolean[];
  tableSize: '' | 'normalsize' | 'small' | 'footnotesize' | 'scriptsize' | 'tiny';
}

export interface PastedTableParseData extends TableParseData {
  latex: string;
  wrapped: boolean;
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


function balancedCommandArguments(text: string, command: string): Array<{ start: number; end: number; optional: string; content: string }> {
  const source = String(text || '');
  const out: Array<{ start: number; end: number; optional: string; content: string }> = [];
  const needle = '\\' + command;
  let at = 0;
  const balancedEnd = (openAt: number, openChar: string, closeChar: string): number => {
    let depth = 0;
    for (let i = openAt; i < source.length; i++) {
      const ch = source[i];
      if (ch === '\\') { i++; continue; }
      if (ch === openChar) depth++;
      else if (ch === closeChar) { depth--; if (depth === 0) return i; }
    }
    return -1;
  };
  while ((at = source.indexOf(needle, at)) >= 0) {
    const after = at + needle.length;
    if (/[A-Za-z@]/.test(source[after] || '')) { at = after; continue; }
    let cursor = after;
    while (/\s/.test(source[cursor] || '')) cursor++;
    let optional = '';
    if (source[cursor] === '[') {
      const end = balancedEnd(cursor, '[', ']');
      if (end < 0) { at = after; continue; }
      optional = source.slice(cursor + 1, end);
      cursor = end + 1;
      while (/\s/.test(source[cursor] || '')) cursor++;
    }
    if (source[cursor] !== '{') { at = after; continue; }
    const end = balancedEnd(cursor, '{', '}');
    if (end < 0) { at = after; continue; }
    out.push({ start: at, end: end + 1, optional, content: source.slice(cursor + 1, end) });
    at = end + 1;
  }
  return out;
}

function captionContentData(content: string): { caption: string; label: string } {
  const source = String(content || '');
  const labelMatch = /\\label\{([^{}]+)\}/.exec(source);
  const label = labelMatch?.[1] || '';
  const caption = labelMatch ? (source.slice(0, labelMatch.index) + source.slice((labelMatch.index || 0) + labelMatch[0].length)).trim() : source.trim();
  return { caption, label };
}

export function figureData(raw: string): FigureParseData {
  const text = String(raw || '');
  const graphicRe = /\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}/g;
  const graphic = graphicRe.exec(text);
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
  const captionCommand = balancedCommandArguments(text, 'caption')[0];
  const captionInfo = captionContentData(captionCommand?.content || '');
  const shortCaption = captionCommand?.optional || '';
  const caption = captionInfo.caption;
  const captionPosition: 'above' | 'below' = captionCommand && graphic && captionCommand.start < graphic.index ? 'above' : 'below';
  const label = captionInfo.label || ((/\\label\{([^}]+)\}/.exec(text) || [])[1] || '');
  const placement = (/\\begin\{figure\}(?:\[([^\]]*)\])?/.exec(text) || [])[1] || '';
  const align: 'left' | 'center' | 'right' = /\\raggedleft|\\begin\{flushright\}/.test(text)
    ? 'right'
    : /\\centering|\\begin\{center\}/.test(text)
      ? 'center'
      : 'left';
  const angleToken = parts.find(x => /^angle\s*=/.test(x));
  const angle = angleToken ? Number(angleToken.slice(angleToken.indexOf('=') + 1).trim()) || 0 : 0;

  const parseDimValue = (value: string): { value?: number; unit?: string } => {
    const textValue = String(value || '').trim();
    const m = /^([0-9]*\.?[0-9]+)\s*(\\(?:textwidth|linewidth|columnwidth|paperwidth|textheight)|[a-zA-Z]+)$/.exec(textValue);
    if (m) return { value: Number(m[1]), unit: m[2] };
    const bare = /^(\\(?:textwidth|linewidth|columnwidth|paperwidth|textheight))$/.exec(textValue);
    return bare ? { value: 1, unit: bare[1] } : {};
  };
  const parseGraphicItem = (m: RegExpExecArray, subfigure = false, container = ''): ParsedFigureItem => {
    const itemOptions = String(m[1] || '');
    const itemParts = itemOptions.split(',').map(x => x.trim()).filter(Boolean);
    const itemDim = (name: string) => {
      const token = itemParts.find(x => new RegExp('^' + name + '\\s*=').test(x));
      return token ? parseDimValue(token.slice(token.indexOf('=') + 1)) : {};
    };
    const anglePart = itemParts.find(x => /^angle\s*=/.test(x));
    const containerDim = parseDimValue(container);
    return {
      path: String(m[2] || '').trim(),
      options: itemOptions,
      width: itemDim('width').value,
      widthUnit: itemDim('width').unit,
      height: itemDim('height').value,
      heightUnit: itemDim('height').unit,
      angle: anglePart ? Number(anglePart.slice(anglePart.indexOf('=') + 1).trim()) || 0 : 0,
      containerWidth: containerDim.value,
      containerWidthUnit: containerDim.unit,
      subfigure
    };
  };

  const items: ParsedFigureItem[] = [];
  const subMatches: Array<{ start: number; end: number; item: ParsedFigureItem }> = [];
  const subRe = /\\begin\{subfigure\}(?:\[[^\]]*\])?\{([^}]*)\}([\s\S]*?)\\end\{subfigure\}/g;
  let sm: RegExpExecArray | null;
  while ((sm = subRe.exec(text))) {
    const gm = /\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}/.exec(sm[2]);
    if (!gm) continue;
    const item = parseGraphicItem(gm, true, sm[1]);
    const subCaptionCommand = balancedCommandArguments(sm[2], 'caption')[0];
    item.caption = captionContentData(subCaptionCommand?.content || '').caption;
    items.push(item);
    subMatches.push({ start: sm.index, end: subRe.lastIndex, item });
  }
  if (!items.length) {
    graphicRe.lastIndex = 0;
    let gm: RegExpExecArray | null;
    while ((gm = graphicRe.exec(text))) items.push(parseGraphicItem(gm));
  }

  let layout: 'side-by-side' | 'stacked' = 'side-by-side';
  if (subMatches.length > 1) {
    for (let i = 0; i < subMatches.length - 1; i++) {
      const between = text.slice(subMatches[i].end, subMatches[i + 1].start);
      if (/\\par\b|\\(?:small|med|big)skip\b|\\vspace\b|\n\s*\n/.test(between) && !/\\hfill\b/.test(between)) {
        layout = 'stacked';
        break;
      }
    }
  }
  const insideSubfigure = (index: number) => subMatches.some(x => index >= x.start && index < x.end);
  const topCaptionCommand = balancedCommandArguments(text, 'caption').find(m => !insideSubfigure(m.start));
  const topCaptionInfo = captionContentData(topCaptionCommand?.content || '');
  const topShortCaption = topCaptionCommand?.optional || '';
  const topCaption = topCaptionInfo.caption;
  const topCaptionPosition: 'above' | 'below' = topCaptionCommand && graphic && topCaptionCommand.start < graphic.index ? 'above' : 'below';
  const topLabelMatch = [...text.matchAll(/\\label\{([^}]+)\}/g)].find(m => !insideSubfigure(m.index ?? -1));
  const topLabel = topCaptionInfo.label || topLabelMatch?.[1] || '';
  return {
    path: figurePath,
    options,
    width: dim('width'),
    height: dim('height'),
    caption: topCaption,
    shortCaption: topShortCaption,
    angle,
    label: topLabel,
    placement,
    captionPosition: topCaptionPosition,
    align,
    items,
    layout
  };
}

export function tableData(raw: string): TableParseData {
  const text = String(raw || '');
  const tab = /\\begin\{tabular\}\{([^}]*)\}([\s\S]*?)\\end\{tabular\}/.exec(text);
  const captionCommand = balancedCommandArguments(text, 'caption')[0];
  const captionInfo = captionContentData(captionCommand?.content || '');
  const caption = captionInfo.caption;
  const captionPosition: 'above' | 'below' = captionCommand && tab && captionCommand.start < tab.index ? 'above' : 'below';
  const label = captionInfo.label || ((/\\label\{([^}]+)\}/.exec(text) || [])[1] || '');
  const placement = (/\\begin\{table\}(?:\[([^\]]*)\])?/.exec(text) || [])[1] || '';
  const beforeTabular = tab ? text.slice(0, tab.index) : text;
  const tableSize = ((/\\(normalsize|small|footnotesize|scriptsize|tiny)\b/.exec(beforeTabular) || [])[1] || '') as TableParseData['tableSize'];
  const emptyResult = (tableStyle: TableParseData['tableStyle'] = 'plain', columns: string[] = []): TableParseData => ({
    simple: false,
    columns,
    rows: [],
    caption,
    label,
    placement,
    captionPosition,
    tableStyle,
    verticalBorders: Array.from({ length: columns.length + 1 }, () => false),
    horizontalBorders: [],
    tableSize
  });
  if (!tab) return emptyResult();

  const spec = tab[1].trim();
  const cleanSpec = spec.replace(/\s+/g, '');
  if (!cleanSpec || /\|\|/.test(cleanSpec) || /[^lcr|]/.test(cleanSpec)) return emptyResult();
  const columns: string[] = [];
  const verticalBorders: boolean[] = [false];
  let boundary = 0;
  for (const token of cleanSpec) {
    if (token === '|') {
      verticalBorders[boundary] = true;
      continue;
    }
    columns.push(token);
    boundary += 1;
    verticalBorders[boundary] = false;
  }
  if (!columns.length) return emptyResult('plain', columns);

  const body = String(tab[2] || '').replace(/^[\s\n]+|[\s\n]+$/g, '');
  const unsupported = /\\(?:multicolumn|multirow|cline|cmidrule|begin\{|end\{)/.test(body);
  const hasBooktabs = /\\(?:toprule|midrule|bottomrule)\b/.test(body);
  const hasHline = /\\hline\b/.test(body);
  if (unsupported || (hasBooktabs && (hasHline || verticalBorders.some(Boolean)))) return emptyResult(hasBooktabs ? 'booktabs' : 'plain', columns);

  const rows: string[][] = [];
  const horizontalBorders: boolean[] = [false];
  const bookRules = new Map<number, Set<string>>();
  const rawSegments = body.split(/\\\\(?:\s*\[[^\]]*\])?/);
  const takeRules = (value: string): { text: string; rules: string[] } => {
    let rest = String(value || '').trim();
    const rules: string[] = [];
    while (true) {
      const m = /^\\(hline|toprule|midrule|bottomrule)\b\s*/.exec(rest);
      if (!m) break;
      rules.push(m[1]);
      rest = rest.slice(m[0].length).trim();
    }
    return { text: rest, rules };
  };
  const recordRules = (at: number, rules: string[]) => {
    for (const rule of rules) {
      if (rule === 'hline') horizontalBorders[at] = true;
      else {
        if (!bookRules.has(at)) bookRules.set(at, new Set());
        bookRules.get(at)!.add(rule);
      }
    }
  };

  for (const rawSegment of rawSegments) {
    const leading = takeRules(rawSegment);
    recordRules(rows.length, leading.rules);
    let rowText = leading.text;
    const trailingMatch = /((?:\s*\\(?:hline|toprule|midrule|bottomrule)\b\s*)+)$/.exec(rowText);
    let trailingRules: string[] = [];
    if (trailingMatch) {
      const trailing = takeRules(trailingMatch[1]);
      trailingRules = trailing.rules;
      rowText = rowText.slice(0, trailingMatch.index).trim();
    }
    if (rowText) {
      const row = rowText.split(/(?<!\\)&/).map(c => c.trim());
      rows.push(row);
      if (horizontalBorders.length < rows.length + 1) horizontalBorders.push(false);
      recordRules(rows.length, trailingRules);
    } else if (trailingRules.length) {
      recordRules(rows.length, trailingRules);
    }
  }
  while (horizontalBorders.length < rows.length + 1) horizontalBorders.push(false);

  if (!rows.length || rows.some(r => r.length !== columns.length)) return emptyResult(hasBooktabs ? 'booktabs' : 'plain', columns);

  let tableStyle: TableParseData['tableStyle'] = 'plain';
  if (hasBooktabs) {
    const onlyExpectedRules = [...bookRules.entries()].every(([at, rules]) => {
      for (const rule of rules) {
        if (rule === 'toprule' && at !== 0) return false;
        if (rule === 'bottomrule' && at !== rows.length) return false;
        if (rule === 'midrule' && (rows.length < 2 || at !== 1)) return false;
      }
      return true;
    });
    const hasTop = !!bookRules.get(0)?.has('toprule');
    const hasBottom = !!bookRules.get(rows.length)?.has('bottomrule');
    if (!onlyExpectedRules || !hasTop || !hasBottom) return emptyResult('booktabs', columns);
    tableStyle = 'booktabs';
  } else {
    const allVertical = verticalBorders.length === columns.length + 1 && verticalBorders.every(Boolean);
    const allHorizontal = horizontalBorders.length === rows.length + 1 && horizontalBorders.every(Boolean);
    const anyBorder = verticalBorders.some(Boolean) || horizontalBorders.some(Boolean);
    tableStyle = allVertical && allHorizontal ? 'grid' : anyBorder ? 'custom' : 'plain';
  }

  return {
    simple: true,
    columns,
    rows,
    caption,
    label,
    placement,
    captionPosition,
    tableStyle,
    verticalBorders,
    horizontalBorders,
    tableSize
  };
}

export function pastedTableData(raw: string): PastedTableParseData | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  const fullTable = /^\\begin\{table\}(?:\[[^\]]*\])?[\s\S]*\\end\{table\}$/.test(text);
  const bareTabular = /^\\begin\{tabular\}\{[^}]*\}[\s\S]*\\end\{tabular\}$/.test(text);
  if (!fullTable && !bareTabular) return null;
  const parsed = tableData(text);
  if (!parsed.simple || !parsed.columns.length || !parsed.rows.length) return null;
  if (parsed.placement && !['htbp','h','t','b','p'].includes(parsed.placement)) return null;
  if (/\\caption\s*\[[^\]]*\]/.test(text)) return null;
  return {
    ...parsed,
    latex: fullTable ? text : `\\begin{table}\n\\centering\n${text}\n\\end{table}`,
    wrapped: bareTabular
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
  const re = /\\begin\{(itemize|enumerate|block|alertblock|exampleblock|equation\*?|align\*?|gather\*?|multline\*?|figure|table|columns|multicols|flushleft|center|flushright|quote|quotation|minipage|theorem|lemma|proposition|corollary|definition|proof|abstract|comment|tikzpicture)\}(?:\[[^\]]*\])?(?:\{([^}]*)\})?|\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}|\\vspace(\*)?\{([^}]+)\}|\\(newpage|clearpage|pagebreak)\b(?:\{\})?|\$\$/g;
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

    const namedSpacingDirective = /(^|\r?\n)([ \t]*\\(smallskip|medskip|bigskip)(?:\{\})?[ \t]*(?:%[^\n]*)?)(?=\r?\n|$)/m.exec(raw);
    if (namedSpacingDirective) {
      const linePrefix = String(namedSpacingDirective[1] || '');
      const command = String(namedSpacingDirective[3] || 'medskip');
      const commandStart = s + (namedSpacingDirective.index || 0) + linePrefix.length;
      const commandEnd = commandStart + String(namedSpacingDirective[2] || '').length;
      if (commandStart > s) text(s, commandStart);
      out.push({
        id: 'b' + n++, kind: 'vspace', start: commandStart, end: commandEnd,
        raw: body.slice(commandStart, commandEnd), text: body.slice(commandStart, commandEnd).trim(),
        spaceAmount: command, spaceStarred: false, align: currentAlign
      });
      if (commandEnd < e) text(commandEnd, e);
      return;
    }

    const noindentDirective = /(^|\r?\n)([ \t]*\\noindent\b[ \t]*)/m.exec(raw);
    if (noindentDirective) {
      const linePrefix = String(noindentDirective[1] || '');
      const commandStart = s + (noindentDirective.index || 0) + linePrefix.length;
      const commandEnd = commandStart + String(noindentDirective[2] || '').length;
      if (commandStart > s) text(s, commandStart);
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
      const tagMatch = /^(TODO|FIXME)\b/i.exec(commentText.trim());
      const commentTag = tagMatch ? tagMatch[1].toUpperCase() as 'TODO' | 'FIXME' : undefined;
      out.push({
        id: 'b' + n++, kind: 'comment', start: s + commentStart, end: s + commentEnd,
        raw: clean, text: commentText, commentText, commentNote, commentTag, align: currentAlign
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
      const tagMatch = /^(TODO|FIXME)\b/i.exec(commentText.trim());
      const commentTag = tagMatch ? tagMatch[1].toUpperCase() as 'TODO' | 'FIXME' : undefined;
      out.push({ id: 'b' + n++, kind: 'comment', start, end, raw: clean, text: commentText, commentText, commentNote, commentTag, align: currentAlign });
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
        figureAlign: d.align,
        figureItems: d.items,
        figureLayout: d.layout
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
    let inner = raw.slice(m[0].length, raw.length - token.length).trim();
    let abstractStretch = '';
    if (env === 'abstract') {
      const stretch = /^(?:(?:\s*%[^\r\n]*(?:\r?\n|$))|\s)*\\setstretch\s*\{([^{}]+)\}[ \t]*(?:%[^\r\n]*)?(?:\r?\n)?/.exec(inner);
      if (stretch) {
        abstractStretch = String(stretch[1] || '').trim();
        inner = inner.slice(stretch[0].length).replace(/^\s+/, '');
      }
    }
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
    else if (env === 'abstract') kind = 'abstract';
    else if (env === 'comment') kind = 'commentblock';
    else if (env === 'tikzpicture') kind = 'tikz';
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
    if (kind === 'abstract' && abstractStretch) b.abstractStretch = abstractStretch;
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
        figureCaptionPosition: d.captionPosition,
        figureItems: d.items,
        figureLayout: d.layout
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
      if (!d.simple) {
        // Tables that use constructs outside the safe visual-grid subset stay
        // source-preserved, but remain editable as one complete LaTeX block.
        b.kind = 'raw';
        Object.assign(b, {
          tableSourceEditable: true,
          tableFallbackReason: 'unsupported',
          tableRowCount: d.rows.length,
          tableColumnCount: d.columns.length,
          tableCaption: d.caption,
          tableLabel: d.label
        });
      } else if (d.columns.length > 12 || d.rows.length > 30) {
        // Large simple tables are valid LaTeX, but rendering dozens of editable
        // cells in the Visual grid is both noisy and expensive. Preserve the
        // complete source and expose a compact editable-LaTeX card instead.
        b.kind = 'raw';
        Object.assign(b, {
          tableOversize: true,
          tableSourceEditable: true,
          tableFallbackReason: 'oversize',
          tableRowCount: d.rows.length,
          tableColumnCount: d.columns.length,
          tableCaption: d.caption,
          tableLabel: d.label
        });
      } else Object.assign(b, {
        tableSimple: true,
        tableColumns: d.columns,
        tableRows: d.rows,
        tableCaption: d.caption,
        tableLabel: d.label,
        tablePlacement: d.placement,
        tableCaptionPosition: d.captionPosition,
        tableStyle: d.tableStyle,
        tableVerticalBorders: d.verticalBorders,
        tableHorizontalBorders: d.horizontalBorders,
        tableSize: d.tableSize
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
    balancedCommandArguments,
    captionContentData,
    figureData,
    tableData,
    pastedTableData,
    findMatchingEnvEnd,
    parseBlocks
  ].map(fn => fn.toString()).join('\n');
}
