const fs=require('fs');const assert=require('assert');
const s=fs.readFileSync('src/extension.ts','utf8');
for(const x of [
  "openLabsFootnote", "openLabsLink", "openLabsSpecial", "openLabsIndex", "openLabsNomenclature", "openLabsField",
  "openLabsQuote", "openLabsMinipage", "openLabsTheorem", "openLabsTableData", "openLabsSubfigures", "openLabsFindReplace",
  "showProjectDiagnostics", "chooseSubfigures", "ensureFeaturePackage", "replaceWholeDocumentExpected",
  "tex-footnote", "tex-link", "tex-index", "tex-nomenclature", "tex-field",
  "gathermath", "multlinemath", "booktabs", "\\\\toprule", "\\\\midrule", "\\\\bottomrule",
  "labsCopyObject", "labsDuplicateObject", "labsMoveObject", "listIndentOutdent", "editLabsInlineObject"
]) assert(s.includes(x),'Missing Labs feature marker: '+x);
assert(s.includes("data-action=\"footnote\"")||s.includes("'footnote'"),'Footnote action missing');
assert(s.includes("Table from CSV / TSV"),'CSV/TSV table import missing');
assert(s.includes("Project diagnostics"),'Project diagnostics UI missing');
console.log('0.13 Labs feature source checks: PASS');
