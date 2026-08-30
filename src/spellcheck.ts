import * as path from 'path';

export type SpellcheckLanguage = 'en' | 'es';

export interface SpellcheckIssue {
  offset: number;
  length: number;
  text: string;
  suggestions: string[];
}

export interface SpellcheckBlock {
  id: string;
  text: string;
}

export interface SpellcheckRequest {
  language: SpellcheckLanguage;
  blocks: SpellcheckBlock[];
}

export interface SpellcheckResultBlock {
  id: string;
  issues: SpellcheckIssue[];
}

function languageToLocale(language: SpellcheckLanguage): string {
  return language === 'es' ? 'es' : 'en';
}

function normalizeSuggestions(suggestions: unknown): string[] {
  if (!Array.isArray(suggestions)) return [];
  return suggestions
    .map(s => typeof s === 'string' ? s : '')
    .filter(Boolean)
    .slice(0, 5);
}

function spellcheckSettings(language: SpellcheckLanguage) {
  const settings: {
    words: string[];
    suggestionsTimeout: number;
    language?: string;
    dictionaries?: string[];
    dictionaryDefinitions?: { name: string; path: string; description: string }[];
  } = { words: [], suggestionsTimeout: 250 };

  if (language === 'es') {
    const dictionaryDir = path.dirname(require.resolve('@cspell/dict-es-es/cspell-ext.json'));
    settings.language = 'es-ES';
    settings.dictionaries = ['es-es'];
    settings.dictionaryDefinitions = [{
      name: 'es-es',
      path: path.join(dictionaryDir, 'Spanish.trie.gz'),
      description: 'Spanish Dictionary (Spain)'
    }];
  }

  return settings;
}

export async function spellcheckText(language: SpellcheckLanguage, text: string): Promise<SpellcheckIssue[]> {
  try {
    const { spellCheckDocument } = await import('cspell-lib');
    const result = await spellCheckDocument(
      { uri: 'texflow://spellcheck', text, languageId: 'plaintext', locale: languageToLocale(language) },
      { generateSuggestions: true, noConfigSearch: true, allowCompoundWords: true },
      spellcheckSettings(language)
    );
    return (result.issues ?? []).map((issue: { offset: number; length: number; text: string; suggestions?: unknown }) => ({
      offset: issue.offset,
      length: issue.length,
      text: issue.text,
      suggestions: normalizeSuggestions(issue.suggestions)
    }));
  } catch {
    return [];
  }
}

export async function spellcheckBlocks(request: SpellcheckRequest): Promise<SpellcheckResultBlock[]> {
  const out: SpellcheckResultBlock[] = [];
  for (const block of request.blocks) {
    out.push({ id: block.id, issues: await spellcheckText(request.language, block.text) });
  }
  return out;
}
