import type { ProjectIndex, ProjectLocation } from '../project/index';

export type ProjectIssueKind =
  | 'missing-include'
  | 'include-cycle'
  | 'duplicate-label'
  | 'missing-reference'
  | 'unused-label'
  | 'missing-citation'
  | 'unused-bib-entry'
  | 'duplicate-bib-key'
  | 'missing-figure';

export type ProjectIssueSeverity = 'error' | 'warning' | 'info';

export interface ProjectIssue {
  kind: ProjectIssueKind;
  severity: ProjectIssueSeverity;
  documentUri?: string;
  start?: number;
  end?: number;
  message: string;
  target?: string;
  file?: string;
}

export interface ProjectStructuralIssueInput {
  kind: 'missing-include' | 'include-cycle' | 'missing-figure';
  severity?: ProjectIssueSeverity;
  message: string;
  target?: string;
  documentUri?: string;
  start?: number;
  end?: number;
  file?: string;
}

function issueAt(
  kind: ProjectIssueKind,
  severity: ProjectIssueSeverity,
  message: string,
  location?: Partial<ProjectLocation>,
  target?: string
): ProjectIssue {
  return {
    kind,
    severity,
    message,
    target,
    documentUri: location?.uri,
    start: location?.start,
    end: location?.end,
    file: location?.file
  };
}

function groupByKey<T extends { key: string }>(values: T[]): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) {
    const bucket = result.get(value.key) || [];
    bucket.push(value);
    result.set(value.key, bucket);
  }
  return result;
}

export function buildProjectIssues(index: ProjectIndex, structural: ProjectStructuralIssueInput[] = []): ProjectIssue[] {
  const issues: ProjectIssue[] = structural.map(item => ({
    kind: item.kind,
    severity: item.severity || (item.kind === 'missing-include' ? 'error' : 'warning'),
    message: item.message,
    target: item.target,
    documentUri: item.documentUri,
    start: item.start,
    end: item.end,
    file: item.file
  }));

  const labels = groupByKey(index.labels);
  const references = new Set(index.references.map(item => item.key));
  for (const [key, occurrences] of labels) {
    if (occurrences.length > 1) {
      for (const occurrence of occurrences) {
        issues.push(issueAt('duplicate-label', 'warning', `Duplicate label: ${key}`, occurrence, key));
      }
    }
    if (!references.has(key)) {
      issues.push(issueAt('unused-label', 'info', `Label is not referenced: ${key}`, occurrences[0], key));
    }
  }

  for (const reference of index.references) {
    if (!labels.has(reference.key)) {
      issues.push(issueAt('missing-reference', 'error', `Reference target not found: ${reference.key}`, reference, reference.key));
    }
  }

  const bib = groupByKey(index.bibliographyEntries);
  const citedKeys = new Set(index.citations.filter(item => item.key !== '*').map(item => item.key));
  const nociteAll = index.citations.some(item => item.command === 'nocite' && item.key === '*');

  for (const [key, occurrences] of bib) {
    if (occurrences.length > 1) {
      for (const occurrence of occurrences) {
        issues.push(issueAt('duplicate-bib-key', 'warning', `Duplicate bibliography key: ${key}`, occurrence, key));
      }
    }
    if (!nociteAll && !citedKeys.has(key)) {
      issues.push(issueAt('unused-bib-entry', 'info', `Bibliography entry is not cited: ${key}`, occurrences[0], key));
    }
  }

  for (const citation of index.citations) {
    if (citation.key === '*') continue;
    if (!bib.has(citation.key)) {
      issues.push(issueAt('missing-citation', 'error', `Citation key not found: ${citation.key}`, citation, citation.key));
    }
  }

  const severityRank: Record<ProjectIssueSeverity, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => {
    const rank = severityRank[a.severity] - severityRank[b.severity];
    if (rank) return rank;
    const file = String(a.file || '').localeCompare(String(b.file || ''));
    if (file) return file;
    return Number(a.start || 0) - Number(b.start || 0);
  });
  return issues;
}
