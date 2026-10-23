// Run with:  node tests/planner.test.js
'use strict';
const assert = require('assert');
const P = require('../js/planner.js');
const { LINES, STATIONS, LANDMARKS, CONFIG } = require('../js/data.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✔ ' + name); }
  catch (e) { console.error('  ✘ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}
const at = (h, m) => new Date(2026, 9, 23, h, m || 0);

console.log('MetroMitra planner tests');

test('Every line station exists and every station is on a line', () => {
  const onLine = new Set();
  Object.values(LINES).forEach(l => l.stations.forEach(id => { assert.ok(STATIONS[id], id); onLine.add(id); }));
  Object.keys(STATIONS).forEach(id => assert.ok(onLine.has(id), id + ' is on no line'));
});

test('Civil Court is the interchange between Purple and Aqua', () => {
  assert.deepStrictEqual(P.linesAt('civil-court').sort(), ['aqua', 'purple']);
  assert.deepStrictEqual(P.linesAt('swargate'), ['purple']);
});

test('Line lengths add up to the published route length', () => {
  assert.ok(Math.abs(P.route('pcmc', 'swargate').km - LINES.purple.lengthKm) < 1e-9);
  assert.ok(Math.abs(P.route('vanaz', 'ramwadi').km - LINES.aqua.lengthKm) < 1e-9);
});

test('Same-line trip: one leg, no transfer, correct direction', () => {
  const r = P.route('pcmc', 'swargate');
  assert.strictEqual(r.legs.length, 1);
  assert.strictEqual(r.transfers, 0);
  assert.strictEqual(r.legs[0].line, 'purple');
  assert.strictEqual(r.legs[0].towards, 'swargate');
  assert.strictEqual(r.stops, 13);
});

test('Reverse direction says "towards" the other terminal', () => {
  assert.strictEqual(P.route('ramwadi', 'vanaz').legs[0].towards, 'vanaz');
});

test('Cross-line trip changes at Civil Court', () => {
  const r = P.route('pcmc', 'ramwadi');
  assert.strictEqual(r.transfers, 1);
  assert.deepStrictEqual(r.legs.map(l => l.line), ['purple', 'aqua']);
  assert.strictEqual(r.legs[0].stations[r.legs[0].stations.length - 1], 'civil-court');
  assert.strictEqual(r.legs[1].stations[0], 'civil-court');
  assert.strictEqual(r.legs[1].towards, 'ramwadi');
});

test('Starting at the interchange needs no transfer', () => {
  assert.strictEqual(P.route('civil-court', 'vanaz').transfers, 0);
  assert.strictEqual(P.route('swargate', 'civil-court').transfers, 0);
});

test('Same station gives no route', () => {
  assert.strictEqual(P.route('pmc', 'pmc'), null);
});

test('Unknown station throws', () => {
  assert.throws(() => P.route('nowhere', 'pmc'), /Unknown station/);
});

test('Fare slabs: minimum, boundaries and maximum', () => {
  assert.strictEqual(P.metroFare(0.5), 10);
  assert.strictEqual(P.metroFare(2), 10);
  assert.strictEqual(P.metroFare(2.01), 15);
  assert.strictEqual(P.metroFare(50), 35);
  assert.strictEqual(P.route('pcmc', 'ramwadi').fare, 35);
});

test('Auto fare: minimum fare covers the first 1.5 km', () => {
  assert.strictEqual(P.autoFare(1), CONFIG.auto.baseFare);
  assert.strictEqual(P.autoFare(2.5), CONFIG.auto.baseFare + CONFIG.auto.perKm);
});

test('Peak hours and service window', () => {
  assert.strictEqual(P.isPeak(at(9)), true);
  assert.strictEqual(P.isPeak(at(14)), false);
  assert.strictEqual(P.serviceStatus(at(5, 30)).open, false);
  assert.strictEqual(P.serviceStatus(at(5, 30)).startsInMin, 30);
  assert.strictEqual(P.serviceStatus(at(23)).closed, true);
  assert.strictEqual(P.serviceStatus(at(12)).headwayMin, CONFIG.offPeakHeadwayMin);
});

test('Nearest station to MIT-WPU is on the Aqua line', () => {
  const mit = LANDMARKS.find(l => l[0].startsWith('MIT-WPU'));
  const near = P.nearestStations({ lat: mit[1], lng: mit[2] }, 1)[0];
  assert.strictEqual(near.id, 'ideal-colony');
  assert.ok(near.km < 2);
});

test('Short first mile is walked, long one by auto, cycle when chosen', () => {
  assert.strictEqual(P.mileLeg(0.6, 'auto', false).mode, 'walk');
  assert.strictEqual(P.mileLeg(3, 'auto', false).mode, 'auto');
  assert.strictEqual(P.mileLeg(3, 'cycle', false).mode, 'cycle');
  assert.strictEqual(P.mileLeg(3, 'walk', false).mode, 'walk');
  assert.strictEqual(P.mileLeg(CONFIG.maxCycleKm + 1, 'cycle', false).mode, 'auto', 'long hops fall back to auto');
  assert.ok(P.mileLeg(3, 'auto', true).min > P.mileLeg(3, 'auto', false).min, 'peak traffic is slower');
});

test('Station-to-station plan has no first/last mile', () => {
  const t = P.planTrip({ stationId: 'vanaz' }, { stationId: 'ramwadi' }, { date: at(12) });
  assert.strictEqual(t.best.firstMile.mode, 'none');
  assert.strictEqual(t.best.lastMile.mode, 'none');
  assert.strictEqual(t.best.cost, 30);
});

test('Long cross-city trip: metro beats an auto on cost', () => {
  const t = P.planTrip({ name: 'MIT-WPU', lat: 18.5182, lng: 73.8153 },
                       { name: 'Airport', lat: 18.5793, lng: 73.9089 }, { date: at(9) });
  assert.ok(t.best);
  assert.ok(t.verdict.saveRs > 0);
  assert.ok(t.verdict.co2SavedG > 0);
  assert.ok(t.direct.cab.cost > t.direct.auto.cost);
});

test('Plans are sorted fastest first', () => {
  const t = P.planTrip({ name: 'A', lat: 18.5182, lng: 73.8153 }, { name: 'B', lat: 18.6000, lng: 73.8300 }, { date: at(12) });
  t.alternatives.forEach(a => assert.ok(a.min >= t.best.min));
});

test('Trip after last train is flagged closed', () => {
  const t = P.planTrip({ stationId: 'pcmc' }, { stationId: 'swargate' }, { date: at(23, 30) });
  assert.strictEqual(t.verdict.kind, 'closed');
});

test('Every station pair has a route', () => {
  const ids = Object.keys(STATIONS);
  ids.forEach(a => ids.forEach(b => { if (a !== b) assert.ok(P.route(a, b), a + ' → ' + b); }));
});

console.log(`\n${passed} passed`);
