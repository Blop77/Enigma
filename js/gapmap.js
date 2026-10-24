/*
 * gapmap.js — MetroMitra Gap Map engine.
 *
 * Splits Pune into a grid of ~0.9 km cells and asks, for every cell and every
 * major hub (IT parks, colleges, stations, airport): door to door, does the
 * metro beat an auto? The answer is scored with the same rules as the trip
 * planner. Red areas are where the metro fails people, usually because the
 * first or last mile is too long or too costly.
 *
 * It then simulates feeder services (cheap e-bus / shared e-rickshaw from a
 * station) and greedily picks the stations where a feeder turns the most of
 * the city green.
 *
 * No DOM code. Works in the browser (window.GapMap, after data.js and
 * planner.js) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var Data = isNode ? require('./data.js') : root.MetroData;
  var P = isNode ? require('./planner.js') : root.MetroPlanner;
  var STATIONS = Data.STATIONS, LANDMARKS = Data.LANDMARKS, CONFIG = Data.CONFIG;
  var IDS = Object.keys(STATIONS);
  var KIND_SCORE = { metro: 1, tradeoff: 0.5, road: 0 };

  /* ------------------------------------------------------------------
   * Places
   * ------------------------------------------------------------------ */
  function hubPlace(name, opts) {
    for (var i = 0; i < IDS.length; i++) {
      if (P.linesAt(IDS[i], opts).length && STATIONS[IDS[i]][0] === name) {
        var s = P.station(IDS[i]);
        return { name: name, lat: s.lat, lng: s.lng, stationId: s.id };
      }
    }
    for (var j = 0; j < LANDMARKS.length; j++) {
      if (LANDMARKS[j][0] === name) return { name: name, lat: LANDMARKS[j][1], lng: LANDMARKS[j][2] };
    }
    throw new Error('Unknown hub: ' + name);
  }

  // Candidate stations around a place: the place itself if it is a station,
  // otherwise its 3 nearest (same rule as the trip planner).
  function near(place, opts) {
    if (place.stationId) return P.linesAt(place.stationId, opts).length ? [{ id: place.stationId, km: 0 }] : [];
    return P.nearestStations(place, 3, opts);
  }

  function grid(opts) {
    var g = CONFIG.gapMap, cells = [];
    opts = opts || {};
    var rows = Math.round((g.maxLat - g.minLat) / g.step), cols = Math.round((g.maxLng - g.minLng) / g.step);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = { row: r, col: c, lat: g.maxLat - (r + 0.5) * g.step, lng: g.minLng + (c + 0.5) * g.step };
        cell.near = near(cell, opts);
        if (cell.near[0].km <= g.maxStationKm) cells.push(cell);
      }
    }
    return cells;
  }

  // Area of one cell in km².
  function cellKm2() {
    var g = CONFIG.gapMap, lat = (g.minLat + g.maxLat) / 2;
    return (g.step * 111.32) * (g.step * 111.32 * Math.cos(lat * Math.PI / 180));
  }

  /* ------------------------------------------------------------------
   * Metro times between every pair of stations, computed once per headway.
   * ------------------------------------------------------------------ */
  var tables = {};
  function metroTable(headway, planned, ids) {
    var key = headway + ':' + (planned ? 'planned' : 'open');
    if (tables[key]) return tables[key];
    var t = {};
    ids.forEach(function (a) {
      t[a] = {};
      ids.forEach(function (b) {
        if (a === b) return;
        var r = P.route(a, b, { headwayMin: headway, planned: planned });
        t[a][b] = { min: r.rideMin + r.transfers * (CONFIG.transferMin + headway / 2), fare: r.fare, km: r.km };
      });
    });
    tables[key] = t;
    return t;
  }

  /* ------------------------------------------------------------------
   * One trip: cell -> hub, with an optional set of feeder stations.
   * Mirrors MetroPlanner.planTrip so the two always agree.
   * ------------------------------------------------------------------ */
  // A feeder leg from/to a station, or null if there is no feeder or it is out of range.
  function feederLeg(km, stationId, ctx) {
    var f = CONFIG.feeder;
    if (!ctx.feeders[stationId] || km <= CONFIG.maxWalkKm || km > f.maxKm) return null;
    return { mode: 'feeder', km: km, min: f.waitMin + km / f.kmh * 60, cost: f.fare, co2: km * CONFIG.co2.feeder };
  }

  function faster(a, b) { return !a || b.min < a.min || (b.min === a.min && b.cost < a.cost); }

  // The base option is exactly what the trip planner would pick (fastest, autos
  // for the first/last mile). Options using a feeder are scored separately and
  // only win if they rate better, because a rider can always ignore the feeder.
  // So adding a feeder can never make a trip worse.
  function trip(cell, hub, ctx) {
    var auto = P.directRoad('auto', P.roadKm(cell, hub), ctx.peak);
    if (auto.km < CONFIG.gapMap.minTripKm) return null;   // too short for the metro to matter

    var base = null, viaFeeder = null, wait = CONFIG.stationEntryMin + ctx.headway / 2;
    cell.near.forEach(function (o) {
      hub.near.forEach(function (d) {
        if (o.id === d.id) return;
        var m = ctx.table[o.id][d.id];
        var firsts = [P.mileLeg(o.km, 'auto', ctx.peak)], lasts = [P.mileLeg(d.km, 'auto', ctx.peak)];
        var ff = feederLeg(o.km, o.id, ctx), fl = feederLeg(d.km, d.id, ctx);
        if (ff) firsts.push(ff);
        if (fl) lasts.push(fl);
        firsts.forEach(function (first, a) {
          lasts.forEach(function (last, b) {
            var opt = { min: first.min + wait + m.min + last.min, cost: first.cost + m.fare + last.cost,
                        from: o.id, to: d.id, first: first, last: last };
            if (a === 0 && b === 0) {
              if (faster(base, opt)) base = opt;
            } else {
              opt.score = KIND_SCORE[P.metroKind(opt, auto)];
              if (!viaFeeder || opt.score > viaFeeder.score || (opt.score === viaFeeder.score && faster(viaFeeder, opt))) viaFeeder = opt;
            }
          });
        });
      });
    });
    if (!base) return null;
    var best = base, kind = P.metroKind(base, auto);
    if (viaFeeder && viaFeeder.score > KIND_SCORE[kind]) { best = viaFeeder; kind = P.metroKind(viaFeeder, auto); }
    delete best.score;
    return { kind: kind, score: KIND_SCORE[kind], metro: best, auto: auto };
  }

  /* ------------------------------------------------------------------
   * The whole map
   * opts: { peak: true|false, planned: true|false, feeders: [stationId...] }
   * ------------------------------------------------------------------ */
  function build(opts) {
    opts = opts || {};
    var peak = opts.peak !== false;
    var planned = !!opts.planned;
    var headway = peak ? CONFIG.peakHeadwayMin : CONFIG.offPeakHeadwayMin;
    var ids = IDS.filter(function (id) { return P.linesAt(id, { planned: planned }).length > 0; });
    var hubs = Data.HUBS.map(function (name) {
      var h = hubPlace(name, { planned: planned });
      h.near = near(h, { planned: planned });
      return h;
    });
    var state = {
      cells: grid({ planned: planned }),
      stationIds: ids,
      hubs: hubs,
      ctx: { peak: peak, planned: planned, headway: headway, table: metroTable(headway, planned, ids), feeders: {} },
      trips: null
    };
    (opts.feeders || []).forEach(function (id) {
      if (state.stationIds.indexOf(id) !== -1) state.ctx.feeders[id] = true;
    });

    // Which (cell, hub) pairs a feeder at a station can change.
    state.cellsByStation = {};
    state.hubsByStation = {};
    ids.forEach(function (id) { state.cellsByStation[id] = []; state.hubsByStation[id] = []; });
    state.cells.forEach(function (c, i) { c.near.forEach(function (n) { state.cellsByStation[n.id].push(i); }); });
    hubs.forEach(function (h, j) { h.near.forEach(function (n) { state.hubsByStation[n.id].push(j); }); });

    state.trips = state.cells.map(function (c) { return hubs.map(function (h) { return trip(c, h, state.ctx); }); });
    return state;
  }

  // Score of one cell: share of hubs reachable well by metro (1 = all, 0 = none).
  // hub: index of a single hub, or -1 for all hubs.
  function cellScore(state, i, hub) {
    var row = state.trips[i];
    if (hub >= 0) return row[hub] ? row[hub].score : null;
    var sum = 0, n = 0;
    row.forEach(function (t) { if (t) { sum += t.score; n++; } });
    return n ? sum / n : null;
  }

  function band(score) {
    if (score === null) return 'none';
    return score >= 0.67 ? 'good' : score >= 0.34 ? 'mixed' : 'poor';
  }

  function summary(state, hub) {
    var s = { good: 0, mixed: 0, poor: 0, none: 0, cells: state.cells.length, km2: cellKm2() };
    state.cells.forEach(function (c, i) { s[band(cellScore(state, i, hub))]++; });
    var rated = s.good + s.mixed + s.poor || 1;
    s.goodPct = 100 * s.good / rated;
    s.mixedPct = 100 * s.mixed / rated;
    s.poorPct = 100 * s.poor / rated;
    return s;
  }

  /* ------------------------------------------------------------------
   * Feeders
   * ------------------------------------------------------------------ */
  // Every (cell, hub) pair whose trip could use this station.
  function affected(state, id, hub) {
    var pairs = {}, list = [];
    if (!state.cellsByStation[id]) return list;
    function add(i, j) { var k = i + ':' + j; if (!pairs[k]) { pairs[k] = true; list.push([i, j]); } }
    var hubIdx = hub >= 0 ? [hub] : state.hubs.map(function (h, j) { return j; });
    state.cellsByStation[id].forEach(function (i) { hubIdx.forEach(function (j) { add(i, j); }); });
    state.hubsByStation[id].forEach(function (j) {
      if (hub < 0 || hub === j) state.cells.forEach(function (c, i) { add(i, j); });
    });
    return list;
  }

  // How many hubs count towards a cell's score (for spreading a pair's change).
  function weight(state, i, hub) {
    if (hub >= 0) return 1;
    var n = 0;
    state.trips[i].forEach(function (t) { if (t) n++; });
    return n || 1;
  }

  function setFeeder(state, id, on) {
    if (!state.cellsByStation[id]) return;
    if (on) state.ctx.feeders[id] = true; else delete state.ctx.feeders[id];
    affected(state, id, -1).forEach(function (p) {
      state.trips[p[0]][p[1]] = trip(state.cells[p[0]], state.hubs[p[1]], state.ctx);
    });
  }

  function feederList(state) { return Object.keys(state.ctx.feeders); }

  // Greedy plan: repeatedly add the feeder that raises the city's score most.
  // gainKm2 is the rise in total score times cell area (a red cell turning amber
  // counts half). Returns [{ station, gainKm2, goodPct, poorPct }] and leaves
  // state's feeders unchanged.
  function recommend(state, k, hub) {
    hub = hub === undefined ? -1 : hub;
    var start = feederList(state), picks = [];
    for (var round = 0; round < k; round++) {
      var best = null;
      state.stationIds.forEach(function (id) {
        if (state.ctx.feeders[id]) return;
        state.ctx.feeders[id] = true;
        var gain = 0;
        affected(state, id, hub).forEach(function (p) {
          var old = state.trips[p[0]][p[1]], neu = trip(state.cells[p[0]], state.hubs[p[1]], state.ctx);
          gain += ((neu ? neu.score : 0) - (old ? old.score : 0)) / weight(state, p[0], hub);
        });
        delete state.ctx.feeders[id];
        if (!best || gain > best.gain) best = { id: id, gain: gain };
      });
      if (!best || best.gain <= 0) break;
      setFeeder(state, best.id, true);
      var after = summary(state, hub);
      picks.push({ station: best.id, gainKm2: best.gain * cellKm2(), goodPct: after.goodPct, poorPct: after.poorPct });
    }
    // Restore the caller's feeders.
    picks.forEach(function (p) { if (start.indexOf(p.station) === -1) setFeeder(state, p.station, false); });
    return picks;
  }

  var GapMap = {
    hubPlace: hubPlace,
    grid: grid,
    cellKm2: cellKm2,
    build: build,
    trip: trip,
    cellScore: cellScore,
    band: band,
    summary: summary,
    setFeeder: setFeeder,
    feederList: feederList,
    recommend: recommend
  };

  if (isNode) module.exports = GapMap;
  else root.GapMap = GapMap;
})(this);
