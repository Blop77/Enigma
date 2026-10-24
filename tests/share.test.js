// Run with:  node tests/share.test.js
'use strict';
const assert = require('assert');
const S = require('../js/share.js');
const { HUBS } = require('../js/data.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✔ ' + name); }
  catch (e) { console.error('  ✘ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

console.log('MetroMitra share-link tests');

test('Default view gives a short link', () => {
  assert.strictEqual(S.encodeGap({ hub: null, peak: true, line3: false, feeders: [], lang: 'en' }), 'view=gap');
});

test('Every setting survives a round trip', () => {
  const state = { hub: 'Hinjewadi Phase 1', peak: false, line3: true, feeders: ['ramwadi', 'khadki'], lang: 'mr' };
  const back = S.decodeGap('#' + S.encodeGap(state));
  assert.strictEqual(back.view, 'gap');
  assert.strictEqual(back.hub, state.hub);
  assert.strictEqual(back.peak, false);
  assert.strictEqual(back.line3, true);
  assert.deepStrictEqual(back.feeders, ['khadki', 'ramwadi']);   // sorted, so equal views give equal links
  assert.strictEqual(back.lang, 'mr');
});

test('Every hub name round-trips, including ones with commas and brackets', () => {
  HUBS.forEach((hub) => assert.strictEqual(S.decodeGap(S.encodeGap({ hub, peak: true })).hub, hub));
});

test('Unknown or edited values are ignored, never fatal', () => {
  const back = S.decodeGap('#view=gap&hub=Nowhere&time=noon&line3=yes&feeders=ramwadi,not-a-station,ramwadi,__proto__&lang=fr');
  assert.strictEqual(back.hub, null);
  assert.strictEqual(back.peak, true);
  assert.strictEqual(back.line3, false);
  assert.deepStrictEqual(back.feeders, ['ramwadi']);
  assert.strictEqual(back.lang, null);
});

test('An empty or trip-planner link decodes to defaults', () => {
  ['', '#', '#from=Swargate&to=Vanaz&mile=auto'].forEach((hash) => {
    const back = S.decodeGap(hash);
    assert.strictEqual(back.hub, null);
    assert.strictEqual(back.peak, true);
    assert.deepStrictEqual(back.feeders, []);
  });
});

console.log(`\n${passed} passed`);
