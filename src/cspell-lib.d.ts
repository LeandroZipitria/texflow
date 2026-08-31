declare module 'cspell-lib' {
  export interface CSpellDocumentLike {
    uri: string;
    text: string;
    languageId?: string;
    locale?: string;
  }

  export interface SpellCheckDocumentOptions {
    generateSuggestions?: boolean;
    noConfigSearch?: boolean;
    allowCompoundWords?: boolean;
  }

  export interface SpellCheckDocumentSettings {
    words?: string[];
    suggestionsTimeout?: number;
    loadDefaultConfiguration?: boolean;
    language?: string;
    dictionaries?: string[];
    dictionaryDefinitions?: { name: string; path: string; description: string }[];
  }

  export interface SpellCheckIssue {
    offset: number;
    length: number;
    text: string;
    suggestions?: string[];
  }

  export interface SpellCheckDocumentResult {
    issues: SpellCheckIssue[];
  }

  export function spellCheckDocument(
    document: CSpellDocumentLike,
    options: SpellCheckDocumentOptions,
    settings: SpellCheckDocumentSettings
  ): Promise<SpellCheckDocumentResult>;
}
