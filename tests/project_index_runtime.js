#!/usr/bin/env node
'use strict';

const { buildProjectIndex, maskLatexComments } = require('../out/project/index.js');

function fail(message) { console.error(`FAIL project_index_runtime: ${message}`); process.exit(1); }
function ok(condition, message) { if (!condition) fail(message); }

const documents = [
  {
    uri: 'file:///project/main.tex', label: 'main.tex', text: String.raw`\documentclass{article}
\begin{document}
\section{Main}\label{sec:main}
See \ref{sec:results} and \cref{eq:a,eq:b}.
\input{sections/results}
\citep{smith2020,jones2021}
% \label{fake:comment}\ref{fake:target}\cite{fakecite}
\begin{comment}
\label{fake:block}\ref{fake:block-target}\cite{fakeblock}
\end{comment}
\end{document}`
  },
  {
    uri: 'file:///project/sections/results.tex', label: 'sections/results.tex', text: String.raw`\section{Results}\label{sec:results}
\begin{equation} a=b \label{eq:a}\end{equation}
\begin{equation} b=c \label{eq:b}\end{equation}
See \autoref{sec:main}.
\includegraphics{figures/result}`
  }
];
const bibliographyEntries = [
  { key: 'smith2020', type: 'article', fields: { author: 'Smith, Jane', year: '2020', title: 'A result' }, source: 'refs.bib', uri: 'file:///project/refs.bib', start: 0, end: 80 },
  { key: 'jones2021', type: 'book', fields: { author: 'Jones, John', year: '2021', title: 'Another result' }, source: 'refs.bib', uri: 'file:///project/refs.bib', start: 81, end: 160 }
];
const includes = [
  { sourceUri: 'file:///project/main.tex', targetUri: 'file:///project/sections/results.tex', rawTarget: 'sections/results', command: 'input', start: 120, end: 144, missing: false }
];

const index = buildProjectIndex(documents, bibliographyEntries, includes);
ok(index.documents.length === 2, 'document count');
ok(index.labels.some(x => x.key === 'sec:main' && x.uri.endsWith('/main.tex')), 'master label indexed');
ok(index.labels.some(x => x.key === 'sec:results' && x.uri.endsWith('/results.tex')), 'included label indexed');
ok(index.references.some(x => x.key === 'sec:results'), 'cross-file ref indexed');
ok(index.references.filter(x => ['eq:a','eq:b'].includes(x.key)).length === 2, 'multi-key cref split');
ok(index.citations.filter(x => ['smith2020','jones2021'].includes(x.key)).length === 2, 'multi-key citation split');
ok(!index.labels.some(x => x.key.startsWith('fake:')), 'comment labels ignored');
ok(!index.references.some(x => x.key.startsWith('fake:')), 'comment refs ignored');
ok(!index.citations.some(x => x.key.startsWith('fake')), 'comment citations ignored');
ok(index.figures.some(x => x.path === 'figures/result' && x.uri.endsWith('/results.tex')), 'figure indexed in included file');
ok(index.includes.length === 1 && index.includes[0].targetUri.endsWith('/results.tex'), 'include relationship indexed');
ok(index.bibliographyEntries.length === 2 && index.bibliographyEntries[0].uri.endsWith('/refs.bib'), 'bibliography locations preserved');

const masked = maskLatexComments('a% hidden\n\\label{ok}');
ok(masked.length === 'a% hidden\n\\label{ok}'.length, 'comment masking preserves offsets');
ok(masked.includes('\\label{ok}'), 'non-comment text preserved');

console.log('PASS project_index_runtime');
