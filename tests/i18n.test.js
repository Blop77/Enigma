// Run with:  node tests/i18n.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const I = require('../js/i18n.js');
const { STATIONS, STATIONS_MR, LANDMARKS, LANDMARKS_MR, HUBS, LINES, CONFIG } = require('../js/data.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✔ ' + name); }
  catch (e) { console.error('  ✘ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
const DEVANAGARI = /[ऀ-ॿ]/;

console.log('MetroMitra i18n tests');

test('Every string has an English and a Marathi version', () => {
  Object.entries(I.STRINGS).forEach(([key, row]) => {
    assert.strictEqual(row.length, I.LANGS.length, key);
    row.forEach((s) => assert.ok(typeof s === 'string' && s.trim(), key + ' is empty'));
  });
});

test('Both languages use the same placeholders', () => {
  Object.entries(I.STRINGS).forEach(([key, [en, mr]]) => assert.strictEqual(vars(mr), vars(en), key));
});

test('Marathi strings are actually in Marathi', () => {
  const sameInBoth = ['res.co2', 'sav.card.url', 'sav.card.brand'];   // CO₂, URL and bilingual brand stay identical in both languages
  Object.entries(I.STRINGS).forEach(([key, [en, mr]]) => {
    if (sameInBoth.includes(key)) return;
    // The language button speaks the *other* language, so a reader of that language can find it.
    if (key === 'lang.switch' || key === 'lang.switchLabel') { assert.ok(DEVANAGARI.test(en)); return; }
    assert.ok(DEVANAGARI.test(mr), key + ': ' + mr);
  });
});

test('Singular forms have a matching plural key', () => {
  Object.keys(I.STRINGS).filter((k) => k.endsWith('.one')).forEach((k) => assert.ok(I.STRINGS[k.slice(0, -4)], k));
});

test('t() fills placeholders, picks singular forms and falls back to the key', () => {
  I.setLang('en');
  assert.strictEqual(I.t('step.stops', { n: 3, km: '2 km', station: 'Swargate' }), '3 stops · 2 km · get off at Swargate');
  assert.strictEqual(I.t('step.stops', { n: 1, km: '1 km', station: 'Mandai' }), '1 stop · 1 km · get off at Mandai');
  assert.strictEqual(I.t('no.such.key'), 'no.such.key');
  I.setLang('mr');
  assert.strictEqual(I.t('service.running', { hw: 7 }), 'सुरू · दर ~7 मिनिटांनी गाडी');
  assert.strictEqual(I.setLang('fr'), 'mr', 'unknown languages are ignored');
  I.setLang('en');
});

test('Every station, landmark and hub has a Marathi name', () => {
  Object.keys(STATIONS).forEach((id) => assert.ok(DEVANAGARI.test(STATIONS_MR[id] || ''), id));
  LANDMARKS.forEach(([name]) => assert.ok(DEVANAGARI.test(LANDMARKS_MR[name] || ''), name));
  I.setLang('mr');
  HUBS.forEach((name) => assert.ok(DEVANAGARI.test(I.place(name)), name));
  assert.strictEqual(I.station('swargate'), 'स्वारगेट');
  assert.strictEqual(I.place('Not a place'), 'Not a place');
  I.setLang('en');
  assert.strictEqual(I.station('swargate'), 'Swargate');
  assert.strictEqual(I.place('Pune Airport'), 'Pune Airport');
});

test('Every key used in index.html exists', () => {
  const html = read('index.html');
  const keys = [...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((m) => m[1]);
  [...html.matchAll(/data-i18n-attr="([^"]+)"/g)].forEach((m) =>
    m[1].split(';').forEach((pair) => keys.push(pair.split(':')[1].trim())));
  assert.ok(keys.length > 40, keys.length + ' keys');
  keys.forEach((k) => assert.ok(I.STRINGS[k], 'missing ' + k));
});

test('Every key used in the UI scripts exists', () => {
  const src = read('js/app.js') + read('js/gap-ui.js') + read('js/savings-card.js');
  // Literal keys only; keys built at run time ('step.first.' + mode) are checked below.
  const keys = [...src.matchAll(/\bt\('([\w.]+)'/g), ...src.matchAll(/showError\('([\w.]+)'\)/g)]
    .map((m) => m[1]).filter((k) => !k.endsWith('.'));
  assert.ok(keys.length > 60, keys.length + ' keys');
  keys.forEach((k) => assert.ok(I.STRINGS[k], 'missing ' + k));
  // Keys built at run time.
  ['walk', 'auto', 'cycle'].forEach((m) => {
    assert.ok(I.STRINGS['step.first.' + m] && I.STRINGS['step.last.' + m], m);
  });
  ['auto', 'cycle'].forEach((m) => assert.ok(I.STRINGS['mode.' + m], m));
  Object.keys(CONFIG.concessions).forEach((k) => assert.ok(I.STRINGS['pass.' + k], k));
  Object.keys(LINES).forEach((l) => assert.ok(I.STRINGS['line.' + l], l));
  ['metro', 'tradeoff', 'road'].forEach((k) => assert.ok(I.STRINGS['kind.' + k], k));
});

test('Every string in the dictionary is used', () => {
  const src = read('js/app.js') + read('js/gap-ui.js') + read('js/savings-card.js') + read('index.html');
  const dynamic = /^(step\.(first|last)\.|mode\.|pass\.|line\.|kind\.)/;
  Object.keys(I.STRINGS).forEach((k) => {
    const base = k.endsWith('.one') ? k.slice(0, -4) : k;
    if (dynamic.test(base)) return;
    assert.ok(src.includes("'" + base + "'") || src.includes('"' + base + '"') || src.includes(':' + base),
      k + ' is never used');
  });
});

console.log(`\n${passed} passed`);
