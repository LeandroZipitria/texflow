#!/usr/bin/env node
'use strict';
const fs = require('fs');
const source = fs.readFileSync('src/extension.ts','utf8');
const diagnostics = fs.readFileSync('src/diagnostics/projectDiagnostics.ts','utf8');
function fail(message) { console.error(`FAIL bibliography_index_runtime: ${message}`); process.exit(1); }
function ok(condition, message) { if (!condition) fail(message); }
ok(source.includes("function citationSearchText(entry){const f=entry.fields||{};return [entry.key,entry.type,f.author,f.editor,f.title,f.year,f.date"), 'citation search does not include key/author/title/year/date');
ok(source.includes("msg.type === 'navigateCitation'"), 'citation navigation handler missing');
ok(diagnostics.includes("duplicate-bib-key"), 'duplicate bibliography diagnostics missing');
ok(source.includes('uri: sourceUri, start: m.index, end: i + 1'), 'BibTeX entry source location missing');
ok(source.includes("Double-click to open bibliography entry") && source.includes("Missing bibliography entry: "), 'Visual citation navigation/missing-entry affordances missing');
ok(source.includes("const itemRe = /\\\\bibitem"), 'inline \\bibitem indexing missing');
ok(source.includes("msg.type === 'navigateBibliographyUsage'"), 'bibliography entry to usage navigation missing');
console.log('PASS bibliography_index_runtime');
