const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'extension.ts'), 'utf8');

assert(src.includes('function objectEditPanel(root)'), 'shared Edit panel helper missing');
assert(src.includes("button.textContent='Edit'"), 'compact object Edit button missing');
assert(src.includes("[...root.children].find"), 'Edit panel lookup must not depend on :scope support');
assert(!src.includes("root.querySelector(':scope > .object-edit-panel')"), 'fragile :scope Edit panel lookup still present');
assert(src.includes('function configureFigureEditPanel'), 'figure advanced panel missing');
assert(src.includes('function configureTableEditPanel'), 'table advanced panel missing');
assert((src.match(/configureFigureEditPanel\(/g) || []).length >= 3, 'Figure Edit panel is not wired in Document and Beamer modes');
assert((src.match(/configureTableEditPanel\(/g) || []).length >= 3, 'Table Edit panel is not wired in Document and Beamer modes');
assert(src.includes("'.figure-label-input'"), 'figure label was not moved to advanced properties');
assert(src.includes("'.figure-layout-input'"), 'multi-figure layout was not moved to advanced properties');
assert(src.includes("'.table-label-input'"), 'table label was not moved to advanced properties');
assert(src.includes('tableSizeControl(panel,currentSize)'), 'table size is not available in advanced properties');
assert(src.includes('table-border-tools'), 'table borders must remain available from advanced properties');
assert(src.includes('primary-only'), 'caption/title fields were not kept as the compact primary controls');

assert((src.match(/class="object-edit-toggle"/g) || []).length >= 4, 'Edit buttons must be rendered directly for Document/Beamer figures and tables');
assert((src.match(/class="object-edit-panel"/g) || []).length >= 4, 'advanced panels must be rendered directly rather than moved after render');

console.log('PASS object_edit_panels_runtime');
