// Run with:  node tests/planner.test.js
'use strict';
const assert = require('assert');
const P = require('../js/planner.js');
const { LINES, STATIONS, STATION_ACCESS, LANDMARKS, CONFIG, FARE_CODES, FARE_CHART, FARE_ASYMMETRIC, STATION_CODES, STATION_ALIASES, CALIBRATION_TRIPS } = require('../js/data.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✔ ' + name); }
  catch (e) { console.error('  ✘ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}
const at = (h, m) => new Date(2026, 9, 23, h, m || 0);
function openStationIds() {
  const ids = new Set();
  Object.values(LINES).filter(line => line.status === 'open')
    .forEach(line => line.stations.forEach(id => ids.add(id)));
  return Array.from(ids);
}

console.log('MetroMitra planner tests');

test('Every line station exists and every station is on a line', () => {
  const onLine = new Set();
  Object.values(LINES).forEach(l => l.stations.forEach(id => { assert.ok(STATIONS[id], id); onLine.add(id); }));
  Object.keys(STATIONS).forEach(id => assert.ok(onLine.has(id), id + ' is on no line'));
});

test('Every station has a Marathi name', () => {
  const { STATIONS_MR } = require('../js/data.js');
  Object.keys(STATIONS).forEach(id => assert.ok(/[\u0900-\u097F]/.test(STATIONS_MR[id] || ''), id));
});

test('District Court (Civil Court) is the interchange between Purple and Aqua', () => {
  assert.deepStrictEqual(P.linesAt('civil-court').sort(), ['aqua', 'purple']);
  assert.deepStrictEqual(P.linesAt('swargate'), ['purple']);
});

test('Planned Line 3 is excluded by default and available when requested', () => {
  assert.strictEqual(P.route('hinjewadi', 'civil-court'), null);
  assert.ok(P.route('pcmc', 'ramwadi').legs.every(leg => leg.line !== 'line3'));
  assert.strictEqual(P.planTrip({ stationId: 'hinjewadi' }, { stationId: 'civil-court' }, { date: at(9) }).best, null);
  const near = P.nearestStations({ lat: STATIONS.hinjewadi[1], lng: STATIONS.hinjewadi[2] }, 100);
  assert.ok(!near.some(s => s.id === 'hinjewadi'));
  assert.ok(P.nearestStations({ lat: STATIONS.hinjewadi[1], lng: STATIONS.hinjewadi[2] }, { planned: true })
    .some(s => s.id === 'hinjewadi'));
  LINES.line3.stations.forEach(id => {
    if (!openStationIds().includes(id)) assert.strictEqual(STATION_CODES[id], undefined, id + ' has no Maha-Metro fare code');
  });
});

test('Line 3 reaches District Court directly and transfers to Aqua at District Court', () => {
  const direct = P.route('hinjewadi', 'civil-court', { planned: true });
  assert.strictEqual(direct.legs.length, 1);
  assert.strictEqual(direct.legs[0].line, 'line3');
  assert.strictEqual(direct.transfers, 0);
  const onward = P.route('hinjewadi', 'ramwadi', { planned: true });
  assert.deepStrictEqual(onward.legs.map(leg => leg.line), ['line3', 'aqua']);
  assert.strictEqual(onward.legs[0].stations[onward.legs[0].stations.length - 1], 'civil-court');
  assert.strictEqual(onward.legs[1].stations[0], 'civil-court');
});

test('Mixed-operator fares charge Line 3 slabs plus the Maha-Metro chart fare', () => {
  const r = P.route('hinjewadi', 'ramwadi', { planned: true });
  const line3 = r.legs.find(leg => leg.line === 'line3');
  assert.strictEqual(r.fare, P.metroFare(line3.km) + P.chartFare('civil-court', 'ramwadi'));
  const trip = P.planTrip({ stationId: 'hinjewadi' }, { stationId: 'ramwadi' },
                          { date: at(9), planned: true, pass: 'student' });
  assert.strictEqual(trip.best.ticket.base, r.fare);
});

test('Line 3 station gaps and end-to-end time match its planned data', () => {
  const r = P.route('megapolis-circle', 'civil-court', { planned: true });
  assert.ok(Math.abs(r.km - LINES.line3.lengthKm) < 1e-9);
  assert.ok(Math.abs(r.rideMin - LINES.line3.runMin) < 1e-9);
});

test('Every station has an accessibility placeholder', () => {
  Object.keys(STATIONS).forEach(id => assert.ok(STATION_ACCESS[id], id));
});

test('Avoiding District Court blocks a cross-line step-free route but not a through ride', () => {
  assert.strictEqual(P.route('pcmc', 'ramwadi', { avoid: ['civil-court'] }), null);
  const trip = P.planTrip({ stationId: 'pcmc' }, { stationId: 'ramwadi' },
    { date: at(9), accessible: true, avoid: ['civil-court'] });
  assert.strictEqual(trip.best, null);
  assert.strictEqual(trip.noStepFree, true);
  const through = P.route('vanaz', 'ramwadi', { avoid: ['civil-court'] });
  assert.ok(through);
  assert.strictEqual(through.transfers, 0);
});

test('An avoided station origin boards from another station with a first-mile leg', () => {
  const trip = P.planTrip({ stationId: 'pmc' }, { stationId: 'ramwadi' },
    { date: at(9), accessible: true, avoid: ['pmc'] });
  assert.ok(trip.best);
  assert.notStrictEqual(trip.best.route.from, 'pmc');
  assert.notStrictEqual(trip.best.firstMile.mode, 'none');
});

test('Accessible interchange adds the configured transfer time and keeps fares', () => {
  const normal = P.planTrip({ stationId: 'pcmc' }, { stationId: 'ramwadi' }, { date: at(9) });
  const accessible = P.planTrip({ stationId: 'pcmc' }, { stationId: 'ramwadi' },
    { date: at(9), accessible: true, avoid: [] });
  assert.strictEqual(accessible.best.transferMin - normal.best.transferMin, CONFIG.access.extraTransferMin);
  const cross = P.planTrip({ stationId: 'pcmc' }, { stationId: 'swargate' },
    { date: at(9), accessible: true, avoid: [] });
  assert.strictEqual(cross.best.ticket.base, P.chartFare('pcmc', 'swargate'));
});

test('Accessible first/last-mile walking is slower and long hops always use an auto', () => {
  const walk = P.mileLeg(CONFIG.access.maxWalkKm, 'walk', false, { accessible: true });
  assert.strictEqual(walk.mode, 'walk');
  assert.ok(walk.min > P.mileLeg(CONFIG.access.maxWalkKm, 'walk', false).min);
  ['walk', 'cycle'].forEach(mode => {
    assert.strictEqual(P.mileLeg(0.8, mode, false, { accessible: true }).mode, 'auto');
  });
});

test('Accessible routing can include planned Line 3 and change at District Court', () => {
  const trip = P.planTrip({ stationId: 'hinjewadi' }, { stationId: 'ramwadi' },
    { date: at(9), accessible: true, planned: true, avoid: [] });
  assert.ok(trip.best);
  assert.deepStrictEqual(trip.best.route.legs.map(leg => leg.line), ['line3', 'aqua']);
  const finalStop = trip.best.route.legs[0].stations[trip.best.route.legs[0].stations.length - 1];
  assert.strictEqual(finalStop, 'civil-court');
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
  assert.strictEqual(r.stops, 12);   // 13 open stations; Range Hill is not open yet (Maha-Metro project profile)
});

test('Reverse direction says "towards" the other terminal', () => {
  assert.strictEqual(P.route('ramwadi', 'vanaz').legs[0].towards, 'vanaz');
});

test('Cross-line trip changes at District Court', () => {
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
  assert.strictEqual(P.metroFare(1), 10);
  assert.strictEqual(P.metroFare(1.01), 15);
  assert.strictEqual(P.metroFare(50), 35);
});

test('Route fares come from the official Maha-Metro fare chart', () => {
  assert.strictEqual(P.route('swargate', 'vanaz').fare, 25);
  assert.strictEqual(P.route('swargate', 'ramwadi').fare, 25);
  assert.strictEqual(P.route('ramwadi', 'pcmc').fare, 35);
  assert.strictEqual(P.route('vanaz', 'ramwadi').fare, 30);
  assert.strictEqual(P.route('pcmc', 'swargate').fare, 30);
  assert.strictEqual(P.route('civil-court', 'pmc').fare, 10);
  // Printed differently each way on the chart; kept as printed.
  assert.strictEqual(P.route('phugewadi', 'swargate').fare, 30);
  assert.strictEqual(P.route('swargate', 'phugewadi').fare, 25);
});

test('Fare chart covers every station and is consistent', () => {
  assert.strictEqual(FARE_CHART.length, FARE_CODES.length);
  FARE_CHART.forEach((row, i) => {
    assert.strictEqual(row.length, FARE_CODES.length);
    assert.strictEqual(row[i], 0);
    row.forEach((v, j) => { if (i !== j) assert.ok([10, 15, 20, 25, 30, 35].includes(v), FARE_CODES[i] + '>' + FARE_CODES[j]); });
  });
  openStationIds().forEach((id) => assert.ok(FARE_CODES.includes(STATION_CODES[id]), id + ' has no fare code'));
  assert.strictEqual(new Set(Object.values(STATION_CODES)).size, FARE_CODES.length);
  // Only the pairs listed in FARE_ASYMMETRIC may differ by direction.
  const asym = [];
  FARE_CHART.forEach((row, i) => row.forEach((v, j) => { if (i < j && v !== FARE_CHART[j][i]) asym.push(FARE_CODES[i] + '-' + FARE_CODES[j]); }));
  assert.deepStrictEqual(asym, FARE_ASYMMETRIC.map((p) => p.join('-')));
});

test('Every station pair uses a chart fare', () => {
  const ids = openStationIds();
  ids.forEach(a => ids.forEach(b => {
    if (a !== b) assert.strictEqual(P.route(a, b).fare, P.chartFare(a, b), a + ' → ' + b);
  }));
});

test('End-to-end ride times match the official timetable', () => {
  assert.ok(Math.abs(P.route('pcmc', 'swargate').rideMin - LINES.purple.runMin) < 1e-9);
  assert.ok(Math.abs(P.route('vanaz', 'ramwadi').rideMin - LINES.aqua.runMin) < 1e-9);
  assert.ok(Math.abs(P.route('swargate', 'pcmc').rideMin - 34) < 1e-9);
  assert.ok(Math.abs(P.route('ramwadi', 'vanaz').rideMin - 37) < 1e-9);
});

test('Range Hill is not a stop until it opens', () => {
  assert.ok(!STATIONS['range-hills']);
  Object.values(LINES).forEach((l) => assert.ok(!l.stations.includes('range-hills')));
});

test('Station aliases point at real stations', () => {
  Object.keys(STATION_ALIASES).forEach((id) => {
    assert.ok(STATIONS[id], id);
    assert.ok(STATION_ALIASES[id].length > 0, id);
  });
});

test('Concessions: student every day, card more on weekends', () => {
  const fri = at(12), sat = new Date(2026, 9, 24, 12);
  assert.strictEqual(P.isWeekend(fri), false);
  assert.strictEqual(P.isWeekend(sat), true);
  assert.deepStrictEqual(P.ticketFare(10, 'regular', sat), { base: 30, pct: 0, fare: 30 });
  assert.strictEqual(P.ticketFare(10, 'student', fri).fare, 21);
  assert.strictEqual(P.ticketFare(10, 'card', fri).fare, 27);
  assert.strictEqual(P.ticketFare(10, 'card', sat).fare, 21);
  assert.strictEqual(P.ticketFare(20, 'card', fri).fare, 32);   // ₹31.50 rounds to ₹32
});

test('Trip cost uses the discounted fare', () => {
  const t = P.planTrip({ stationId: 'vanaz' }, { stationId: 'ramwadi' }, { date: at(12), pass: 'student' });
  assert.strictEqual(t.best.ticket.base, 30);
  assert.strictEqual(t.best.cost, 21);
});

test('Auto fare: minimum fare covers the first 1.5 km', () => {
  assert.strictEqual(P.autoFare(1), CONFIG.auto.baseFare);
  // Meters show whole rupees; ₹17.14/km makes the exact fare ₹43.14.
  assert.strictEqual(P.autoFare(2.5), Math.round(CONFIG.auto.baseFare + CONFIG.auto.perKm));
});

test('Auto night surcharge: +25% from midnight to 5 AM only', () => {
  const day = P.autoFare(10, at(14)), night = P.autoFare(10, at(1));
  assert.strictEqual(P.autoFare(10), day, 'no date means the day rate');
  assert.strictEqual(night, Math.round((CONFIG.auto.baseFare + (10 - CONFIG.auto.baseKm) * CONFIG.auto.perKm) * 1.25));
  assert.strictEqual(P.autoFare(10, at(5)), day, 'surcharge ends at 5 AM');
});

test('Road model reproduces the team\'s collected trips', () => {
  const where = (name) => {
    const l = LANDMARKS.find((x) => x[0] === name);
    if (l) return { lat: l[1], lng: l[2] };
    const id = Object.keys(STATIONS).find((k) => STATIONS[k][0] === name);
    return { lat: STATIONS[id][1], lng: STATIONS[id][2] };
  };
  // Each value must land inside the collected [low, high] range, widened by 10%.
  const within = (got, [lo, hi], what) =>
    assert.ok(got >= lo * 0.9 && got <= hi * 1.1, what + ': ' + got.toFixed(1) + ' not in ' + lo + '–' + hi);
  assert.ok(CALIBRATION_TRIPS.length >= 4);
  CALIBRATION_TRIPS.forEach((trip) => {
    const label = trip.from + ' → ' + trip.to;
    const km = P.roadKm(where(trip.from), where(trip.to));
    within(km, trip.km, label + ' km');
    within(P.autoFare(km), trip.auto, label + ' auto ₹');
    within(P.directRoad('cab', km, false).cost, trip.cab, label + ' cab ₹ at 2 PM');
    within(P.directRoad('cab', km, true).cost, trip.cabPeak, label + ' cab ₹ at 9 AM');
    within(km / CONFIG.roadKmhPeak * 60, trip.peakMin, label + ' 9 AM min');
    within(km / CONFIG.roadKmhOffPeak * 60, trip.offMin, label + ' 2 PM min');
  });
});

test('Cabs surge at peak hours, autos stay on the meter', () => {
  assert.strictEqual(P.directRoad('cab', 10, true).cost, Math.round(P.cabFare(10) * CONFIG.cab.peakSurge));
  assert.strictEqual(P.directRoad('cab', 10, false).cost, P.cabFare(10));
  assert.strictEqual(P.directRoad('auto', 10, true).cost, P.directRoad('auto', 10, false).cost);
});

test('Peak hours and service window', () => {
  assert.strictEqual(P.isPeak(at(9)), true);
  assert.strictEqual(P.isPeak(at(14)), false);
  assert.strictEqual(P.isPeak(at(16, 30)), true, 'evening peak starts at 4 PM');
  assert.strictEqual(P.serviceStatus(at(16, 30)).headwayMin, 6, 'peak trains every 6 min');
  assert.strictEqual(P.serviceStatus(at(5, 30)).open, false);
  assert.strictEqual(P.serviceStatus(at(5, 30)).startsInMin, 30);
  assert.strictEqual(P.serviceStatus(at(22, 30)).open, true, 'runs till 23:00');
  assert.strictEqual(P.serviceStatus(at(23, 15)).closed, true);
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

test('Trip long before the first train is flagged not-yet-open', () => {
  const t = P.planTrip({ stationId: 'pcmc' }, { stationId: 'swargate' }, { date: at(4) });
  assert.strictEqual(t.verdict.kind, 'notyet');
  assert.strictEqual(P.planTrip({ stationId: 'pcmc' }, { stationId: 'swargate' }, { date: at(5, 50) }).verdict.kind, 'metro');
});

test('Trip after last train is flagged closed', () => {
  const t = P.planTrip({ stationId: 'pcmc' }, { stationId: 'swargate' }, { date: at(23, 30) });
  assert.strictEqual(t.verdict.kind, 'closed');
});

test('Every station pair has a route', () => {
  const ids = openStationIds();
  ids.forEach(a => ids.forEach(b => { if (a !== b) assert.ok(P.route(a, b), a + ' → ' + b); }));
});

console.log(`\n${passed} passed`);
