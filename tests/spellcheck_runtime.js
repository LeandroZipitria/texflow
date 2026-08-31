const assert = require('assert');
const { spellcheckText } = require('../out/spellcheck.js');

(async () => {
  const validSpanish = await spellcheckText('es', 'Esta oración contiene una palabra incorrecta.');
  assert.deepStrictEqual(validSpanish, [], 'Spanish sentence should not report normal words.');

  const spanishTypo = await spellcheckText('es', 'palbra');
  assert(
    spanishTypo.some(issue => issue.offset === 0 && issue.length === 6 && issue.text === 'palbra' && issue.suggestions.includes('palabra')),
    'Spanish typo should report palbra with palabra as a suggestion.'
  );

  const validEnglish = await spellcheckText('en', 'This sentence contains one misspelling.');
  assert.deepStrictEqual(validEnglish, [], 'English sentence should not report normal words.');

  const englishTypo = await spellcheckText('en', 'sentnce');
  assert(
    englishTypo.some(issue => issue.offset === 0 && issue.length === 7 && issue.text === 'sentnce' && issue.suggestions.includes('sentence')),
    'English typo should report sentnce with sentence as a suggestion.'
  );

  console.log('Spellcheck runtime checks: PASS');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
