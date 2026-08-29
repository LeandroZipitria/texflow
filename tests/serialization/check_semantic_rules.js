const assert = require('assert');

function paragraphs(raw) {
  const out = [];
  const sep = /\n[ \t]*\n+/g;
  let local = 0, m;
  const push = (a,b) => {
    const seg = raw.slice(a,b);
    const lead = seg.search(/\S/);
    if (lead < 0) return;
    const trail = (/\s*$/.exec(seg)||[''])[0].length;
    const text = raw.slice(a+lead,b-trail);
    if (text) out.push(text);
  };
  while ((m=sep.exec(raw))) { push(local,m.index); local=sep.lastIndex; }
  push(local,raw.length);
  return out;
}

assert.deepStrictEqual(paragraphs('Uno.\n\nDos.\n\n\nTres.'), ['Uno.','Dos.','Tres.']);
assert.deepStrictEqual(paragraphs('El aumento fue 4\\%.\n\nTexto \\textbf{fuerte}.'), ['El aumento fue 4\\%.','Texto \\textbf{fuerte}.']);

const heading = '\\section{Resultados}';
const serialized = heading + '\n\n' + 'Texto.' + '\n\n' + '\\end{document}';
assert(serialized.includes('\\section{Resultados}\n\nTexto.'));
assert(!serialized.includes('Texto.\\end{document}'));
assert.strictEqual((serialized.match(/\\end\{document\}/g)||[]).length, 1);

console.log('semantic serialization checks: PASS');
