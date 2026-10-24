// Run with: node tests/reports.test.js
'use strict';
const assert = require('assert');
const Reports = require('../js/reports.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✔ ' + name); }
  catch (e) { console.error('  ✘ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

console.log('MetroMitra station report tests');
const expiry = 2 * 60 * 60 * 1000;

test('addReport appends a valid report with the supplied timestamp', () => {
  const report = Reports.addReport([], 'civil-court', 'lift', 1000, expiry);
  assert.deepStrictEqual(report, [{ stationId: 'civil-court', type: 'lift', time: 1000 }]);
});

test('dropExpired removes reports at expiry, future timestamps and invalid entries', () => {
  const now = 10000000;
  const reports = [
    { stationId: 'a', type: 'crowded', time: now - expiry },
    { stationId: 'a', type: 'lift', time: now },
    { stationId: 'a', type: 'escalator', time: now + 1 },
    { stationId: 'a', type: 'unknown', time: now }, null
  ];
  assert.deepStrictEqual(Reports.dropExpired(reports, now, expiry), [reports[1]]);
});

test('activeForStation filters by station after dropping expired reports', () => {
  const now = 5000000;
  const reports = [
    { stationId: 'a', type: 'crowded', time: now - 10 },
    { stationId: 'b', type: 'lift', time: now - 10 },
    { stationId: 'a', type: 'lift', time: now - expiry - 1 }
  ];
  assert.deepStrictEqual(Reports.activeForStation(reports, 'a', now, expiry), [reports[0]]);
});

test('addReport drops stale entries and refuses unknown report types', () => {
  const old = { stationId: 'a', type: 'lift', time: 1 };
  assert.deepStrictEqual(Reports.addReport([old], 'a', 'broken', 10000000, expiry), []);
});

console.log('\n' + passed + ' passed');
