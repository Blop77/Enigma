// Run with:  node tests/savings.test.js
'use strict';
const assert = require('assert');
const Savings = require('../js/savings.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✔ ' + name); }
  catch (e) { console.error('  ✘ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}
const trip = (date, autoCost, cost, co2SavedG) => ({ t: date.getTime(), autoCost, cost, co2SavedG });

console.log('MetroMitra savings tests');

test('monthTrips filters by month and year, including the December/January boundary', () => {
  const dec = new Date(2025, 11, 31, 12), jan = new Date(2026, 0, 1, 12), janLater = new Date(2026, 0, 20, 12);
  const trips = [trip(dec, 50, 20, 300), trip(jan, 40, 10, 200), trip(janLater, 35, 15, 100)];
  assert.deepStrictEqual(Savings.monthTrips(trips, jan), trips.slice(1));
  assert.deepStrictEqual(Savings.monthTrips(trips, dec), trips.slice(0, 1));
});

test('totals match the hand-computed savings', () => {
  const list = [trip(new Date(2026, 0, 1), 50, 20, 300), trip(new Date(2026, 0, 2), 40, 15, 250)];
  assert.deepStrictEqual(Savings.totals(list), { n: 2, rs: 55, co2: 550 });
});

test('cardData clamps negative rupees and CO₂ to zero', () => {
  const date = new Date(2026, 9, 24), list = [trip(date, 10, 40, -200)];
  assert.deepStrictEqual(Savings.cardData(list, date), {
    month: date.toLocaleString(require('../js/i18n.js').locale(), { month: 'long' }),
    year: 2026, n: 1, rs: 0, co2: 0
  });
});

test('empty list has zero totals', () => {
  assert.deepStrictEqual(Savings.totals([]), { n: 0, rs: 0, co2: 0 });
  const empty = Savings.cardData([], new Date(2026, 9, 24));
  assert.strictEqual(empty.n, 0);
  assert.strictEqual(empty.rs, 0);
  assert.strictEqual(empty.co2, 0);
});

console.log('\n' + passed + ' passed');
