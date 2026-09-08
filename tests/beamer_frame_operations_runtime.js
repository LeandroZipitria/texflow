#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function fail(message) { console.error(`FAIL beamer_frame_operations_runtime: ${message}`); process.exit(1); }
function ok(condition, message) { if (!condition) fail(message); }

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'extension.ts'), 'utf8');

ok(source.includes('disabled?: boolean;'), 'FrameInfo disabled state is missing');
ok(source.includes('enabledRaw?: string;'), 'FrameInfo restore source is missing');
ok(source.includes('const disabledStartRe = /^[ \\t]*%\\s*TeXFlow disabled frame begin'), 'disabled frames are not rediscovered by parseFrames');
ok(source.includes('frames.sort((a, b) => a.start - b.start)'), 'active and disabled frames are not re-ordered in source order');
ok(source.includes("msg.type === 'duplicateFrame'"), 'duplicateFrame message handler is missing');
ok(source.includes("msg.type === 'moveFrame'"), 'moveFrame message handler is missing');
ok(source.includes("msg.type === 'toggleFrameDisabled'"), 'toggleFrameDisabled message handler is missing');
ok(source.includes("id=\"beamer-duplicate-frame\""), 'Duplicate frame menu item is missing');
ok(source.includes("id=\"beamer-move-frame-up\""), 'Move frame up menu item is missing');
ok(source.includes("id=\"beamer-move-frame-down\""), 'Move frame down menu item is missing');
ok(source.includes("id=\"beamer-toggle-frame\""), 'Disable/restore frame menu item is missing');
ok(source.includes("toggle.textContent=disabled?'Restore frame':'Disable frame'"), 'Beamer menu does not reflect disabled state');
ok(source.includes("Restore this frame before editing its contents."), 'disabled-frame content edits are not guarded');

console.log('PASS beamer_frame_operations_runtime');
