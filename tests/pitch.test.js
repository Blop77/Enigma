// Run with: node tests/pitch.test.js
'use strict';
const assert = require('assert');
const { pitchNumbers } = require('../js/pitch-data.js');
const G = require('../js/gapmap.js');
const { STATIONS } = require('../js/data.js');

console.log('MetroMitra pitch sheet tests');
const result = pitchNumbers();
const between = n => assert.ok(n >= 0 && n <= 100, n + ' is outside 0–100');

['basePct', 'withFeedersPct'].forEach(key => between(result[key]));
between(result.worst.pct); between(result.best.pct);
between(result.hinjewadi.pct); between(result.hinjewadi.line3Pct);
assert.ok(result.withFeedersPct >= result.basePct);
assert.ok(result.feeders.length <= 5);
result.feeders.forEach(f => assert.ok(Object.prototype.hasOwnProperty.call(STATIONS, f.station), f.station));
assert.ok(result.hinjewadi.line3Pct > result.hinjewadi.pct);
assert.ok(result.worst.pct <= result.best.pct);

const bare = G.build({ peak: true });
const recommendations = G.recommend(bare, 5, -1).filter(r => r.gainKm2 >= 0.5);
assert.strictEqual(result.basePct, G.summary(bare, -1).goodPct);
assert.deepStrictEqual(result.feeders, recommendations);
const withFeeders = G.build({ peak: true, feeders: recommendations.map(r => r.station) });
assert.strictEqual(result.withFeedersPct, G.summary(withFeeders, -1).goodPct);
const hubs = bare.hubs.map((hub, i) => ({ hub: hub.name, pct: G.summary(bare, i).goodPct })).sort((a, b) => a.pct - b.pct);
assert.deepStrictEqual(result.worst, hubs[0]);
assert.deepStrictEqual(result.best, hubs[hubs.length - 1]);
const hinjewadi = bare.hubs.findIndex(h => h.name.indexOf('Hinjewadi') === 0);
const planned = G.build({ peak: true, planned: true });
const plannedIndex = planned.hubs.findIndex(h => h.name === bare.hubs[hinjewadi].name);
assert.strictEqual(result.hinjewadi.pct, G.summary(bare, hinjewadi).goodPct);
assert.strictEqual(result.hinjewadi.line3Pct, G.summary(planned, plannedIndex).goodPct);
console.log('\nAll pitch tests passed');
