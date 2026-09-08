#!/usr/bin/env node
'use strict';
const fs = require('fs');
const source = fs.readFileSync('src/extension.ts','utf8');
function fail(message) { console.error(`FAIL references_runtime: ${message}`); process.exit(1); }
function ok(condition, message) { if (!condition) fail(message); }
ok(source.includes("projectIndex&&Array.isArray(projectIndex.labels)"), 'reference picker is not project-wide');
ok(source.includes("eqref|ref|autoref|cref|Cref|pageref|vref|Vref"), 'reference command coverage missing');
ok(source.includes("msg.type === 'navigateReference'"), 'reference navigation handler missing');
ok(source.includes("Double-click to open reference target"), 'Visual reference navigation affordance missing');
ok(source.includes("No \\\\label{...} commands were found in this project."), 'reference picker still reports current-document scope');
console.log('PASS references_runtime');
