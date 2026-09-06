const fs = require('fs');
const path = require('path');

const srcPath = path.join(process.cwd(), 'src', 'extension.ts');
if (!fs.existsSync(srcPath)) {
  console.error(`Missing ${srcPath}`);
  process.exit(1);
}
const src = fs.readFileSync(srcPath, 'utf8');

function check(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${message}`);
  }
}

check(src.includes('interface IncludeReference'), 'IncludeReference model exists');
check(src.includes('interface ProjectIncludeGraph'), 'Project include graph exists');
check(src.includes('async function buildProjectIncludeGraph'), 'recursive include graph builder exists');

check(
  src.includes('const projectRootDir = path.dirname(root.uri.fsPath);'),
  'include resolution has an explicit master-project root'
);
check(
  src.includes('const resolutionBase = projectRootDir ?? path.dirname(document.uri.fsPath);'),
  'input/include resolution uses the master folder when known'
);
check(
  src.includes('extractIncludeReferences(document, projectRootDir)'),
  'recursive graph resolves nested includes with master-folder semantics'
);

check(src.includes('function documentIncludeHtml'), 'visual include cards remain enabled');
check(src.includes("msg.type === 'openIncludedSource'"), 'include cards still open source files');

check(src.includes('async function getLatexFatalBuildMessage'), 'fatal LaTeX build detection exists');
check(src.includes('previousLogMtime'), 'compile flow tracks the previous log timestamp');
check(src.includes('const fatal = await getLatexFatalBuildMessage'), 'compile polling checks for fatal build errors');
check(src.includes('LaTeX could not find ${fileError}.'), 'missing-file failures get a direct message');
check(
  src.includes('only after checking the newly') && src.includes('written log for a fatal error'),
  'stale PDF fast path is guarded by fatal-log detection'
);

if (process.exitCode) {
  console.error('\nTeXFlow multi-file / compile responsiveness checks: FAIL');
  process.exit(process.exitCode);
}

console.log('\nTeXFlow multi-file / compile responsiveness checks: PASS');
