#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src', 'extension.ts'), 'utf8');

assert(
  src.includes("function runTopMenuAction(action){closeTopMenus();"),
  'dynamic Structure/Insert/References actions must close their top menu immediately'
);

assert(
  src.includes("e.target.closest('.top-menu-panel button'):null;if(action)closeTopMenus();"),
  'all buttons inside top-menu panels must close the top menu after activation'
);

assert(
  /function openFigureEditor\(data\)\{\s*closeTopMenus\(\);closeMenus\(\);/.test(src),
  'opening the Figure configuration panel must leave no launch menu open'
);

assert(
  /function openTableEditor\(\)\{\s*closeTopMenus\(\);closeMenus\(\);/.test(src),
  'opening the Table configuration panel must leave no launch menu open'
);

assert(
  /function saveFigureEditor\(\).*?closeFigureEditor\(\);closeTopMenus\(\);closeMenus\(\);vscode\.postMessage\(payload\);/s.test(src),
  'applying Figure configuration must close the secondary panel and all menus'
);

assert(
  /function saveTableEditor\(\).*?closeTableEditor\(\);closeTopMenus\(\);closeMenus\(\);lastVisualCursor=/s.test(src),
  'applying Table configuration must close the secondary panel and all menus'
);

assert(
  src.includes("b.onmousedown=e=>{rememberVisualCursor();e.preventDefault();};b.onclick=()=>runTopMenuAction(action);"),
  'closing a menu must not lose the remembered insertion cursor'
);

console.log('PASS menu_lifecycle_runtime');
