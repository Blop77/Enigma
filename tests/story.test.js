// Run with:  node tests/story.test.js
'use strict';
const assert = require('assert');
const St = require('../js/story-data.js');
const G = require('../js/gapmap.js');
const P = require('../js/planner.js');
const { LINES, CONFIG, FARE_CHART } = require('../js/data.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✔ ' + name); }
  catch (e) { console.error('  ✘ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

console.log('MetroMitra story tests');

const b = St.basics();

test('The ride stops at stations of its line, in running order', () => {
  const order = LINES[b.line].stations;
  assert.strictEqual(b.stops[0], order[0]);
  assert.strictEqual(b.stops[b.stops.length - 1], order[order.length - 1]);
  b.stops.reduce((prev, id) => { const i = order.indexOf(id); assert.ok(i > prev, id); return i; }, -1);
  b.stops.reduce((prev, id) => { assert.ok(b.lineKm[id] > prev, id); return b.lineKm[id]; }, -1);
});

test('Network facts come from the data', () => {
  const n = b.network;
  assert.strictEqual(n.km, LINES.purple.lengthKm + LINES.aqua.lengthKm);
  assert.strictEqual(n.peakHeadwayMin, CONFIG.peakHeadwayMin);
  const fares = FARE_CHART.flat().filter((f) => f > 0);
  assert.strictEqual(n.fareMin, Math.min(...fares));
  assert.strictEqual(n.fareMax, Math.max(...fares));
  assert.ok(n.stations > 20 && n.lines === 2);
});

test('The example trip adds up and matches the trip planner', () => {
  const m = b.trip.metro;
  assert.ok(Math.abs(m.first.min + m.ride.min + m.last.min - m.min) < 1e-6);
  assert.strictEqual(m.first.cost + m.fare + m.last.cost, m.cost);
  assert.strictEqual(m.miles.cost, m.first.cost + m.last.cost);
  const p = P.planTrip({ name: 'a', lat: 18.5182, lng: 73.8153 }, { name: 'b', lat: 18.5536, lng: 73.8247 },
                       { date: new Date(2026, 9, 21, 9, 0) });
  assert.strictEqual(p.best.cost, m.cost);
  assert.strictEqual(p.verdict.kind, b.trip.verdict);
  assert.strictEqual(p.direct.auto.cost, b.trip.auto.cost);
});

test('The Gap Map story matches the Gap Map, feeder by feeder', () => {
  const g = St.gap(2);
  const state = G.build({ peak: true });
  assert.strictEqual(g.cells.length, state.cells.length);
  assert.strictEqual(g.snapshots.length, g.recs.length + 1);
  assert.ok(Math.abs(g.snapshots[0].goodPeoplePct - G.summary(state, -1).goodPeoplePct) < 1e-9);
  g.recs.forEach((r, i) => {
    G.setFeeder(state, r.station, true);
    assert.deepStrictEqual(g.snapshots[i + 1].feeders, G.feederList(state));
    assert.ok(Math.abs(g.snapshots[i + 1].goodPeoplePct - G.summary(state, -1).goodPeoplePct) < 1e-9);
    assert.ok(g.snapshots[i + 1].goodPeoplePct >= g.snapshots[i].goodPeoplePct);
  });
  g.snapshots.forEach((s) => s.bands.forEach((code) => assert.ok(code >= 0 && code <= 3)));
});

console.log(`\n${passed} passed`);
