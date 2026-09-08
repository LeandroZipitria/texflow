export interface ProjectSourceInput {
  uri: string;
  label: string;
  text: string;
}

export interface ProjectIncludeInput {
  sourceUri: string;
  targetUri: string;
  rawTarget: string;
  command: 'input' | 'include';
  start: number;
  end: number;
  missing?: boolean;
}

export interface ProjectBibliographyEntryInput {
  key: string;
  type: string;
  fields: Record<string, string>;
  source: string;
  uri?: string;
  start?: number;
  end?: number;
}

export interface ProjectLocation {
  uri: string;
  file: string;
  start: number;
  end: number;
  context: string;
}

export interface ProjectHeading extends ProjectLocation {
  command: 'chapter' | 'section' | 'subsection' | 'subsubsection' | 'paragraph';
  title: string;
  starred: boolean;
}

export interface ProjectLabel extends ProjectLocation {
  key: string;
  targetKind: string;
}

export interface ProjectReference extends ProjectLocation {
  command: string;
  key: string;
  allKeys: string[];
}

export interface ProjectCitation extends ProjectLocation {
  command: string;
  key: string;
  allKeys: string[];
}

export interface ProjectFigure extends ProjectLocation {
  path: string;
}

export interface ProjectInclude extends ProjectLocation {
  targetUri: string;
  rawTarget: string;
  command: 'input' | 'include';
  missing: boolean;
}

export interface ProjectBibliographyEntry extends ProjectLocation {
  key: string;
  type: string;
  fields: Record<string, string>;
  source: string;
}

export interface ProjectIndex {
  documents: Array<{ uri: string; label: string }>;
  headings: ProjectHeading[];
  labels: ProjectLabel[];
  references: ProjectReference[];
  citations: ProjectCitation[];
  bibliographyEntries: ProjectBibliographyEntry[];
  figures: ProjectFigure[];
  includes: ProjectInclude[];
}

function isEscapedPercent(source: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && source[i] === '\\'; i--) backslashes++;
  return backslashes % 2 === 1;
}

/**
 * Masks source that LaTeX treats as comments while preserving offsets and line
 * breaks. Index consumers can therefore use locations directly against the
 * original TextDocument.
 */
export function maskLatexComments(source: string): string {
  const text = String(source ?? '');
  const chars = text.split('');
  let lineComment = false;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (lineComment) {
      if (ch === '\n' || ch === '\r') lineComment = false;
      else chars[i] = ' ';
      continue;
    }
    if (ch === '%' && !isEscapedPercent(text, i)) {
      lineComment = true;
      chars[i] = ' ';
    }
  }

  const lineMasked = chars.join('');
  const token = /\\(begin|end)\{comment\}/g;
  const stack: number[] = [];
  const ranges: Array<{ start: number; end: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = token.exec(lineMasked))) {
    if (match[1] === 'begin') stack.push(match.index);
    else if (stack.length) {
      const start = stack.pop()!;
      if (!stack.length) ranges.push({ start, end: token.lastIndex });
    }
  }
  if (stack.length) ranges.push({ start: stack[0], end: lineMasked.length });

  for (const range of ranges) {
    for (let i = range.start; i < range.end; i++) {
      if (chars[i] !== '\n' && chars[i] !== '\r') chars[i] = ' ';
    }
  }
  return chars.join('');
}

function contextAround(source: string, start: number, end: number): string {
  const left = Math.max(0, start - 70);
  const right = Math.min(source.length, end + 90);
  return source.slice(left, right).replace(/\s+/g, ' ').trim();
}

function splitKeys(value: string): string[] {
  return String(value || '').split(',').map(x => x.trim()).filter(Boolean);
}

interface LabelEnvironmentContext {
  index: number;
  command: 'begin' | 'end';
  environment: string;
}

interface LabelHeadingContext {
  index: number;
  end: number;
  command: string;
}

function labelTargetKind(
  masked: string,
  key: string,
  start: number,
  lastEnvironment?: LabelEnvironmentContext,
  lastHeading?: LabelHeadingContext
): string {
  const prefix = String(key || '').split(':', 1)[0].toLowerCase();
  if (['eq', 'equation'].includes(prefix)) return 'equation';
  if (['fig', 'figure'].includes(prefix)) return 'figure';
  if (['tab', 'table'].includes(prefix)) return 'table';
  if (['sec', 'section', 'subsec', 'chap', 'chapter'].includes(prefix)) return 'section';

  if (lastEnvironment?.command === 'begin') {
    const env = lastEnvironment.environment.replace(/\*$/, '');
    if (['equation', 'align', 'gather', 'multline'].includes(env)) return 'equation';
    return env;
  }

  if (lastHeading && /^\s*$/.test(masked.slice(lastHeading.end, start))) return lastHeading.command;
  return 'label';
}

export function buildProjectIndex(
  documents: ProjectSourceInput[],
  bibliographyEntries: ProjectBibliographyEntryInput[] = [],
  includes: ProjectIncludeInput[] = []
): ProjectIndex {
  const index: ProjectIndex = {
    documents: documents.map(d => ({ uri: d.uri, label: d.label })),
    headings: [],
    labels: [],
    references: [],
    citations: [],
    bibliographyEntries: [],
    figures: [],
    includes: []
  };
  const labelByUri = new Map(documents.map(d => [d.uri, d.label]));

  for (const document of documents) {
    const source = String(document.text ?? '');
    const masked = maskLatexComments(source);
    let match: RegExpExecArray | null;

    const headingRe = /\\(chapter|section|subsection|subsubsection|paragraph)(\*)?\{([^}]*)\}/g;
    while ((match = headingRe.exec(masked))) {
      index.headings.push({
        uri: document.uri,
        file: document.label,
        start: match.index,
        end: headingRe.lastIndex,
        context: contextAround(source, match.index, headingRe.lastIndex),
        command: match[1] as ProjectHeading['command'],
        title: String(match[3] || '').trim(),
        starred: !!match[2]
      });
    }

    const environmentContexts: LabelEnvironmentContext[] = [];
    const environmentContextRe = /\\(begin|end)\{(equation\*?|align\*?|gather\*?|multline\*?|figure|table)\}/g;
    while ((match = environmentContextRe.exec(masked))) {
      environmentContexts.push({
        index: match.index,
        command: match[1] as 'begin' | 'end',
        environment: match[2]
      });
    }

    const headingContexts: LabelHeadingContext[] = [];
    const headingContextRe = /\\(chapter|section|subsection|subsubsection|paragraph)\*?\{[^}]*\}/g;
    while ((match = headingContextRe.exec(masked))) {
      headingContexts.push({
        index: match.index,
        end: headingContextRe.lastIndex,
        command: match[1]
      });
    }

    let environmentContextIndex = 0;
    let headingContextIndex = 0;
    let lastEnvironmentContext: LabelEnvironmentContext | undefined;
    let lastHeadingContext: LabelHeadingContext | undefined;
    const labelRe = /\\label\{([^}]+)\}/g;
    while ((match = labelRe.exec(masked))) {
      while (environmentContextIndex < environmentContexts.length && environmentContexts[environmentContextIndex].index < match.index) {
        lastEnvironmentContext = environmentContexts[environmentContextIndex++];
      }
      while (headingContextIndex < headingContexts.length && headingContexts[headingContextIndex].index < match.index) {
        lastHeadingContext = headingContexts[headingContextIndex++];
      }

      const key = String(match[1] || '').trim();
      if (!key) continue;
      index.labels.push({
        uri: document.uri,
        file: document.label,
        start: match.index,
        end: labelRe.lastIndex,
        context: contextAround(source, match.index, labelRe.lastIndex),
        key,
        targetKind: labelTargetKind(masked, key, match.index, lastEnvironmentContext, lastHeadingContext)
      });
    }

    const refRe = /\\(eqref|ref|autoref|cref|Cref|pageref|vref|Vref)\*?\s*\{([^}]+)\}/g;
    while ((match = refRe.exec(masked))) {
      const keys = splitKeys(match[2]);
      for (const key of keys) {
        index.references.push({
          uri: document.uri,
          file: document.label,
          start: match.index,
          end: refRe.lastIndex,
          context: contextAround(source, match.index, refRe.lastIndex),
          command: match[1],
          key,
          allKeys: keys
        });
      }
    }

    const citeRe = /\\(parencite|textcite|autocite|footcite|smartcite|supercite|citep|citet|cite|nocite)\*?\s*(?:\[[^\]]*\]\s*){0,2}\{([^}]+)\}/g;
    while ((match = citeRe.exec(masked))) {
      const keys = splitKeys(match[2]);
      for (const key of keys) {
        index.citations.push({
          uri: document.uri,
          file: document.label,
          start: match.index,
          end: citeRe.lastIndex,
          context: contextAround(source, match.index, citeRe.lastIndex),
          command: match[1],
          key,
          allKeys: keys
        });
      }
    }

    const figureRe = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;
    while ((match = figureRe.exec(masked))) {
      const figurePath = String(match[1] || '').trim();
      if (!figurePath) continue;
      index.figures.push({
        uri: document.uri,
        file: document.label,
        start: match.index,
        end: figureRe.lastIndex,
        context: contextAround(source, match.index, figureRe.lastIndex),
        path: figurePath
      });
    }
  }

  for (const include of includes) {
    index.includes.push({
      uri: include.sourceUri,
      file: labelByUri.get(include.sourceUri) || include.sourceUri,
      start: include.start,
      end: include.end,
      context: '',
      targetUri: include.targetUri,
      rawTarget: include.rawTarget,
      command: include.command,
      missing: !!include.missing
    });
  }

  for (const entry of bibliographyEntries) {
    index.bibliographyEntries.push({
      uri: entry.uri || '',
      file: entry.source,
      start: Number.isFinite(entry.start) ? Number(entry.start) : 0,
      end: Number.isFinite(entry.end) ? Number(entry.end) : 0,
      context: String(entry.fields?.title || entry.key || '').replace(/\s+/g, ' ').trim(),
      key: entry.key,
      type: entry.type,
      fields: entry.fields || {},
      source: entry.source
    });
  }

  return index;
}
