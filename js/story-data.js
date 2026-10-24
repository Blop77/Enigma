/*
 * story-data.js — the numbers behind story.html, the scroll-through pitch.
 *
 * Everything the story shows is computed here from the same engines as the
 * app (data.js, planner.js, gapmap.js), so the story can never drift from the
 * Gap Map or the trip planner.
 *
 * basics(): cheap, runs on page load (network facts and one example trip).
 * gap():    the Gap Map with the suggested feeders added one at a time; takes
 *           a second or two, so story.js runs it in a Web Worker.
 *
 * No DOM code. Works in the browser and workers (window/self.MetroStory, after
 * data.js, population.js, planner.js and gapmap.js) and in Node.
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var Data = isNode ? require('./data.js') : root.MetroData;
  var P = isNode ? require('./planner.js') : root.MetroPlanner;
  var G = isNode ? require('./gapmap.js') : root.GapMap;
  var CONFIG = Data.CONFIG;

  // The ride: the Purple Line from PCMC to Swargate, stopping at these
  // stations to tell the story (the others are passed without stopping).
  var LINE = 'purple';
  var STOPS = ['pcmc', 'khadki', 'shivaji-nagar', 'civil-court', 'budhwar-peth', 'mandai', 'swargate'];

  // The example trip: a student commute (MIT-WPU to SPPU) on a weekday at 9 AM.
  var EXAMPLE = { from: 'MIT-WPU, Kothrud', to: 'Savitribai Phule Pune University' };
  var EXAMPLE_DATE = [2026, 9, 21, 9, 0];   // a Wednesday

  function landmark(name) {
    for (var i = 0; i < Data.LANDMARKS.length; i++) {
      var l = Data.LANDMARKS[i];
      if (l[0] === name) return { name: name, lat: l[1], lng: l[2] };
    }
    throw new Error('Unknown landmark: ' + name);
  }

  // Distance along the line from its first station, in km, for each station.
  function lineKm() {
    var ids = Data.LINES[LINE].stations, km = 0, out = {};
    ids.forEach(function (id, i) {
      if (i) km += P.haversineKm(P.station(ids[i - 1]), P.station(id));
      out[id] = km;
    });
    return out;
  }

  function network() {
    var open = Object.keys(Data.LINES).filter(function (l) { return Data.LINES[l].status === 'open'; });
    var ids = {}, km = 0, fares = [];
    open.forEach(function (l) {
      km += Data.LINES[l].lengthKm;
      Data.LINES[l].stations.forEach(function (id) { ids[id] = true; });
    });
    Data.FARE_CHART.forEach(function (row) { row.forEach(function (f) { if (f > 0) fares.push(f); }); });
    return {
      lines: open.length, km: km, stations: Object.keys(ids).length,
      peakHeadwayMin: CONFIG.peakHeadwayMin, firstTrain: CONFIG.firstTrain, lastTrain: CONFIG.lastTrain,
      fareMin: Math.min.apply(null, fares), fareMax: Math.max.apply(null, fares)
    };
  }

  function exampleTrip() {
    var d = EXAMPLE_DATE, date = new Date(d[0], d[1], d[2], d[3], d[4]);
    var r = P.planTrip(landmark(EXAMPLE.from), landmark(EXAMPLE.to), { date: date });
    var m = r.best, auto = r.direct.auto;
    var miles = { min: m.firstMile.min + m.lastMile.min, cost: m.firstMile.cost + m.lastMile.cost };
    return {
      from: EXAMPLE.from, to: EXAMPLE.to, verdict: r.verdict.kind,
      metro: {
        min: m.min, cost: m.cost, fare: m.ticket.fare,
        first: { mode: m.firstMile.mode, min: m.firstMile.min, cost: m.firstMile.cost, station: m.route.from },
        ride: { min: m.metroMin, from: m.route.from, to: m.route.to },
        last: { mode: m.lastMile.mode, min: m.lastMile.min, cost: m.lastMile.cost, station: m.route.to },
        miles: miles
      },
      auto: { min: auto.min, cost: auto.cost }
    };
  }

  function basics() {
    return { stops: STOPS.slice(), line: LINE, lineKm: lineKm(), network: network(), trip: exampleTrip() };
  }

  var BAND_CODE = { none: 0, poor: 1, mixed: 2, good: 3 };

  // The Gap Map at peak hour, then with each suggested feeder added in turn.
  function gap(k) {
    k = k === undefined ? 5 : k;
    var state = G.build({ peak: true });
    var recs = G.recommend(state, k, -1);
    function snapshot() {
      var s = G.summary(state, -1);
      return {
        feeders: G.feederList(state),
        bands: state.cells.map(function (c, i) { return BAND_CODE[G.band(G.cellScore(state, i, -1))]; }),
        goodPeoplePct: s.goodPeoplePct, mixedPeoplePct: s.mixedPeoplePct, poorPeoplePct: s.poorPeoplePct,
        goodPct: s.goodPct, residents: s.people.rated
      };
    }
    var snaps = [snapshot()];
    recs.forEach(function (r) { G.setFeeder(state, r.station, true); snaps.push(snapshot()); });
    return {
      grid: CONFIG.gapMap,
      cells: state.cells.map(function (c) { return [c.row, c.col, c.people]; }),
      stationIds: state.stationIds,
      hubs: state.hubs.map(function (h) { return [h.lat, h.lng]; }),
      recs: recs.map(function (r) { return { station: r.station, gainPeople: r.gainPeople }; }),
      snapshots: snaps
    };
  }

  var MetroStory = { STOPS: STOPS, EXAMPLE: EXAMPLE, BAND_CODE: BAND_CODE, basics: basics, gap: gap };

  if (isNode) module.exports = MetroStory;
  else root.MetroStory = MetroStory;
})(this);
