#!/usr/bin/env node
'use strict';

const { buildProjectIndex } = require('../out/project/index.js');
const { buildProjectIssues } = require('../out/diagnostics/projectDiagnostics.js');

function fail(message) { console.error(`FAIL diagnostics_runtime: ${message}`); process.exit(1); }
function ok(condition, message) { if (!condition) fail(message); }

const docs = [
  { uri:'file:///p/main.tex', label:'main.tex', text:String.raw`\label{dup}\ref{missing}\cite{missingbib}` },
  { uri:'file:///p/a.tex', label:'a.tex', text:String.raw`\label{dup}\label{unused}` }
];
const bib = [
  { key:'used', type:'article', fields:{title:'Used'}, source:'refs.bib', uri:'file:///p/refs.bib', start:0, end:10 },
  { key:'unusedbib', type:'article', fields:{title:'Unused'}, source:'refs.bib', uri:'file:///p/refs.bib', start:11, end:20 },
  { key:'dupkey', type:'article', fields:{}, source:'refs.bib', uri:'file:///p/refs.bib', start:21, end:30 },
  { key:'dupkey', type:'book', fields:{}, source:'other.bib', uri:'file:///p/other.bib', start:0, end:10 }
];
const index = buildProjectIndex(docs, bib, []);
const issues = buildProjectIssues(index, [{kind:'missing-include',severity:'error',message:'Included file not found: x',documentUri:'file:///p/main.tex',start:0,end:1,file:'main.tex'}]);
const kinds = new Set(issues.map(x => x.kind));
for (const kind of ['missing-include','duplicate-label','missing-reference','unused-label','missing-citation','unused-bib-entry','duplicate-bib-key']) ok(kinds.has(kind), `${kind} diagnostic`);
ok(issues[0].severity === 'error', 'issues sort errors first');
ok(issues.some(x => x.documentUri && Number.isFinite(x.start)), 'navigable issue locations preserved');
console.log('PASS diagnostics_runtime');
