const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const parserPath = path.join(root, 'out', 'latex', 'blocks.js');
assert(fs.existsSync(parserPath), 'compiled parser missing; run npm run compile first');
delete require.cache[require.resolve(parserPath)];
const { parseBlocks, pastedTableData } = require(parserPath);
const extension = fs.readFileSync(path.join(root, 'src', 'extension.ts'), 'utf8');

const rows = Array.from({ length: 31 }, (_, i) => `Row ${i + 1} & ${i + 1} \\\\`).join('\n');
const latex = `\\begin{table}\n\\centering\n\\begin{tabular}{lr}\n${rows}\n\\end{tabular}\n\\end{table}`;
const pasted = pastedTableData(latex);
assert(pasted, 'valid large LaTeX table must be accepted for insertion');
assert.strictEqual(pasted.rows.length, 31);
const parsed = parseBlocks(latex);
assert.strictEqual(parsed.length, 1);
assert.strictEqual(parsed[0].kind, 'raw', 'large table should use preserved-source fallback rather than huge visual grid');
assert.strictEqual(parsed[0].tableOversize, true);
assert.strictEqual(parsed[0].tableSourceEditable, true);
assert.strictEqual(parsed[0].tableFallbackReason, 'oversize');
assert.strictEqual(parsed[0].tableRowCount, 31);
assert.strictEqual(parsed[0].tableColumnCount, 2);

const wideColumns = Array.from({ length: 13 }, () => 'c').join('');
const wideRow = Array.from({ length: 13 }, (_, i) => `C${i + 1}`).join(' & ') + ' \\\\';
const wideLatex = `\\begin{table}\n\\centering\n\\begin{tabular}{${wideColumns}}\n${wideRow}\n${wideRow}\n\\end{tabular}\n\\end{table}`;
const widePasted = pastedTableData(wideLatex);
assert(widePasted, 'valid wide LaTeX table must be accepted for insertion');
const wideParsed = parseBlocks(wideLatex);
assert.strictEqual(wideParsed[0].kind, 'raw');
assert.strictEqual(wideParsed[0].tableOversize, true);
assert.strictEqual(wideParsed[0].tableSourceEditable, true);
assert.strictEqual(wideParsed[0].tableFallbackReason, 'oversize');
assert.strictEqual(wideParsed[0].tableColumnCount, 13);

assert(extension.includes('doc-large-table large-table-card semantic-block'), 'Document large-table fallback card missing');
assert(extension.includes("b.kind==='raw'&&(b.tableSourceEditable||b.tableOversize)"), 'Beamer editable-LaTeX table fallback card missing');
assert(extension.includes('Large table · LaTeX'), 'large-table heading missing');
assert(extension.includes('Visual editing disabled because of table size.'), 'large-table size explanation missing');
assert(extension.includes('Limit: 30 rows × 12 columns.'), 'large-table limit explanation missing');
assert(extension.includes('Edit LaTeX'), 'table LaTeX editing action missing');
assert(extension.includes("tableLatexSourceEditorHtml(String(b.raw||''))"), 'small document table LaTeX editor missing');
assert(extension.includes("tableLatexSourceEditorHtml(String(block.raw||''))"), 'small Beamer table LaTeX editor missing');
assert(extension.includes("(block.kind === 'raw' || block.kind === 'table') && typeof payload?.rawSource === 'string'"), 'Beamer small-table raw-source replacement is not supported');
assert(extension.includes("payload:{rawSource:next}"), 'Beamer large-table source is not editable');
assert(!extension.includes("if(!cols||cols>12||rows.length>30){vscode.postMessage({type:'showWarning',message:'Tables support up to 30 rows and 12 columns.'})"), 'CSV/TSV import still rejects large tables');
assert(!extension.includes("Rows must be between 1 and 30."), 'manual table creator still hard-rejects rows above 30');
assert(!extension.includes('Tables support up to 30 rows and 12 columns.'), 'legacy hard rejection for large tables still exists');
assert(extension.includes('Large table: it will be inserted completely'), 'large manual table fallback message missing');
assert(extension.includes("rows > 500") || extension.includes("rows>500"), 'large-table safety bound missing');
assert(extension.includes("cols > 100") || extension.includes("cols>100"), 'wide-table safety bound missing');


const complex = String.raw`\begin{table}[ht!]
\caption{\label{tab:complex} Complex table.}
\centering
\footnotesize
\begin{tabular}{lcc}
\toprule
Dependent & \multicolumn{2}{c}{Outcome} \\
\cmidrule(lr){2-3}
A & 1 & 2 \\
\bottomrule
\end{tabular}
\parbox{0.95\textwidth}{\footnotesize Notes: preserved with the table.}
\end{table}`;
assert.strictEqual(pastedTableData(complex), null, 'complex multicolumn table should remain non-grid-editable');
const complexParsed = parseBlocks(complex);
assert.strictEqual(complexParsed.length, 1);
assert.strictEqual(complexParsed[0].kind, 'raw', 'complex table must remain preserved LaTeX');
assert.strictEqual(complexParsed[0].tableSourceEditable, true, 'complex table must expose editable LaTeX source');
assert.strictEqual(complexParsed[0].tableFallbackReason, 'unsupported');
assert(extension.includes('Complex table · LaTeX'), 'complex-table heading missing');
assert(extension.includes('Visual editing unavailable for this table structure.'), 'unsupported-table explanation missing');
assert(extension.includes("if(/\\\\begin\\\{(?:table|tabular)\\\}/.test(raw)){vscode.postMessage({type:'insertLatexTable'"), 'Insert Table dialog does not forward unsupported LaTeX tables to preserved insertion');
assert(extension.includes("const code = parsedTable ? parsedTable.latex : (fullTable ? rawTable"), 'Extension host does not preserve unsupported LaTeX tables verbatim');

console.log('PASS large_table_fallback_runtime');
