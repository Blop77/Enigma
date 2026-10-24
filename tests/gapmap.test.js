// Run with:  node tests/gapmap.test.js
'use strict';
const assert = require('assert');
const G = require('../js/gapmap.js');
const P = require('../js/planner.js');
const { HUBS, CONFIG } = require('../js/data.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✔ ' + name); }
  catch (e) { console.error('  ✘ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

console.log('MetroMitra Gap Map tests');

const state = G.build({ peak: true });

test('Every hub resolves to a station or landmark', () => {
  HUBS.forEach(name => assert.ok(G.hubPlace(name).lat, name));
  assert.strictEqual(G.hubPlace('Swargate').stationId, 'swargate');
  assert.throws(() => G.hubPlace('Nowhere'), /Unknown hub/);
});

test('Grid covers the city around the network', () => {
  assert.ok(state.cells.length > 300, state.cells.length + ' cells');
  state.cells.forEach(c => assert.ok(c.near[0].km <= CONFIG.gapMap.maxStationKm));
  assert.ok(G.cellKm2() > 0.5 && G.cellKm2() < 1.5);
});

test('Planned-only Line 3 stations are excluded unless planned routes are enabled', () => {
  assert.strictEqual(P.route('hinjewadi', 'civil-court'), null);
  assert.ok(!state.cells.some(cell => cell.near.some(n => n.id === 'hinjewadi')));
  const planned = G.build({ peak: true, planned: true });
  assert.ok(planned.cells.some(cell => cell.near.some(n => n.id === 'hinjewadi')));
});

test('Line 3 improves peak-hour access to Hinjewadi', () => {
  const planned = G.build({ peak: true, planned: true });
  const idx = planned.hubs.findIndex(h => h.name === 'Hinjewadi Phase 1');
  assert.ok(G.summary(planned, idx).goodPct > G.summary(state, idx).goodPct);
});

test('Gap Map agrees with the trip planner for the same trip', () => {
  const peak = new Date(2026, 9, 23, 9, 0);   // Friday 09:00, regular ticket
  let checked = 0;
  for (let i = 0; i < state.cells.length; i += 37) {
    state.hubs.forEach((hub, j) => {
      const g = state.trips[i][j];
      if (!g) return;
      const cell = state.cells[i];
      const p = P.planTrip({ name: 'cell', lat: cell.lat, lng: cell.lng },
                           hub.stationId ? { stationId: hub.stationId } : hub, { date: peak });
      assert.ok(Math.abs(p.best.min - g.metro.min) < 1e-6, 'time ' + i + '/' + hub.name);
      assert.strictEqual(p.best.cost, g.metro.cost);
      assert.strictEqual(p.verdict.kind, g.kind);
      checked++;
    });
  }
  assert.ok(checked > 50, checked + ' trips checked');
});

test('Gap Map and planner agree when planned Line 3 is enabled', () => {
  const planned = G.build({ peak: true, planned: true });
  const peak = new Date(2026, 9, 23, 9, 0);
  let checked = 0;
  for (let i = 0; i < planned.cells.length; i += 53) {
    planned.hubs.forEach((hub, j) => {
      const g = planned.trips[i][j];
      if (!g) return;
      const cell = planned.cells[i];
      const p = P.planTrip({ name: 'cell', lat: cell.lat, lng: cell.lng },
                           hub.stationId ? { stationId: hub.stationId } : hub,
                           { date: peak, planned: true });
      assert.ok(Math.abs(p.best.min - g.metro.min) < 1e-6, 'time ' + i + '/' + hub.name);
      assert.strictEqual(p.best.cost, g.metro.cost);
      assert.strictEqual(p.verdict.kind, g.kind);
      checked++;
    });
  }
  assert.ok(checked > 50, checked + ' planned trips checked');
});

test('Short trips are left out', () => {
  state.cells.forEach((c, i) => state.hubs.forEach((h, j) => {
    if (state.trips[i][j]) assert.ok(state.trips[i][j].auto.km >= CONFIG.gapMap.minTripKm);
  }));
});

test('Summary bands add up', () => {
  const s = G.summary(state, -1);
  assert.strictEqual(s.good + s.mixed + s.poor + s.none, s.cells);
  assert.ok(Math.abs(s.goodPct + s.mixedPct + s.poorPct - 100) < 1e-9);
});

test('Score bands', () => {
  assert.strictEqual(G.band(1), 'good');
  assert.strictEqual(G.band(0.5), 'mixed');
  assert.strictEqual(G.band(0), 'poor');
  assert.strictEqual(G.band(null), 'none');
});

test('A feeder never makes any trip worse', () => {
  const s = G.build({ peak: true });
  const before = s.trips.map(r => r.map(t => t && t.score));
  G.setFeeder(s, 'ramwadi', true);
  s.trips.forEach((r, i) => r.forEach((t, j) => {
    if (t) assert.ok(t.score >= before[i][j], 'cell ' + i + ' hub ' + j);
  }));
  assert.ok(G.summary(s, -1).goodPct > G.summary(state, -1).goodPct);
  assert.deepStrictEqual(G.feederList(s), ['ramwadi']);
  G.setFeeder(s, 'ramwadi', false);
  assert.deepStrictEqual(s.trips.map(r => r.map(t => t && t.score)), before);
});

test('Feeder legs are used only within their range', () => {
  const s = G.build({ peak: true, feeders: ['vanaz'] });
  s.trips.forEach(r => r.forEach(t => {
    if (!t) return;
    [t.metro.first, t.metro.last].forEach(leg => {
      if (leg.mode === 'feeder') assert.ok(leg.km > CONFIG.maxWalkKm && leg.km <= CONFIG.feeder.maxKm);
    });
  }));
});

test('Recommendations improve the city and leave state unchanged', () => {
  const s = G.build({ peak: true });
  const base = G.summary(s, -1).goodPct;
  const recs = G.recommend(s, 3, -1);
  assert.strictEqual(recs.length, 3);
  assert.strictEqual(new Set(recs.map(r => r.station)).size, 3);
  recs.forEach(r => assert.ok(r.gainKm2 > 0));
  assert.ok(recs[2].poorPct <= G.summary(s, -1).poorPct);
  assert.ok(recs[2].goodPct > base);
  assert.deepStrictEqual(G.feederList(s), []);
  assert.strictEqual(G.summary(s, -1).goodPct, base);
});

test('Recommendations for one hub only look at that hub', () => {
  const s = G.build({ peak: true });
  const hub = s.hubs.findIndex(h => h.name.startsWith('Kharadi'));
  const recs = G.recommend(s, 1, hub);
  assert.ok(['ramwadi', 'kalyani-nagar', 'yerawada'].includes(recs[0].station), recs[0].station);
});

test('Off-peak builds too', () => {
  const s = G.build({ peak: false });
  assert.strictEqual(s.ctx.headway, CONFIG.offPeakHeadwayMin);
  assert.ok(G.summary(s, -1).cells > 0);
});

console.log(`\n${passed} passed`);
