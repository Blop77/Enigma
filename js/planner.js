/*
 * planner.js — MetroMitra journey engine.
 *
 *   - Shortest metro route between any two stations (Dijkstra over a
 *     station-per-line graph, so line changes cost real time)
 *   - Distance-based metro fare
 *   - Door-to-door plans: nearest stations + first/last mile by walk, auto or cycle
 *   - Honest comparison against taking an auto or cab the whole way
 *
 * No DOM code here. Works in the browser (window.MetroPlanner, needs
 * data.js loaded first) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  var Data = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.MetroData;
  var STATIONS = Data.STATIONS, LINES = Data.LINES, CONFIG = Data.CONFIG;

  /* ------------------------------------------------------------------
   * Small helpers
   * ------------------------------------------------------------------ */
  function station(id) {
    var s = STATIONS[id];
    if (!s) throw new Error('Unknown station: ' + id);
    return { id: id, name: s[0], lat: s[1], lng: s[2] };
  }

  function haversineKm(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function roadKm(a, b) { return haversineKm(a, b) * CONFIG.roadFactor; }

  function hhmm(str) { var p = str.split(':'); return +p[0] * 60 + +p[1]; }
  function minuteOfDay(date) { return date.getHours() * 60 + date.getMinutes(); }

  function linesAt(id) {
    return Object.keys(LINES).filter(function (l) { return LINES[l].stations.indexOf(id) !== -1; });
  }

  /* ------------------------------------------------------------------
   * Service: peak hours, headways, operating window
   * ------------------------------------------------------------------ */
  function isPeak(date) {
    var m = minuteOfDay(date);
    return CONFIG.peakWindows.some(function (w) { return m >= hhmm(w[0]) && m < hhmm(w[1]); });
  }

  function headwayMin(date) {
    return isPeak(date) ? CONFIG.peakHeadwayMin : CONFIG.offPeakHeadwayMin;
  }

  // open: trains are running now. waitMin: extra wait before service starts (0 if open).
  function serviceStatus(date) {
    var m = minuteOfDay(date), first = hhmm(CONFIG.firstTrain), last = hhmm(CONFIG.lastTrain);
    if (m < first) return { open: false, startsInMin: first - m, headwayMin: CONFIG.offPeakHeadwayMin };
    if (m > last) return { open: false, closed: true, headwayMin: CONFIG.offPeakHeadwayMin };
    return { open: true, startsInMin: 0, headwayMin: headwayMin(date), peak: isPeak(date) };
  }

  /* ------------------------------------------------------------------
   * Fares and road tariffs
   * ------------------------------------------------------------------ */
  function metroFare(km) {
    for (var i = 0; i < CONFIG.fareSlabs.length; i++) {
      if (km <= CONFIG.fareSlabs[i][0]) return CONFIG.fareSlabs[i][1];
    }
    return CONFIG.fareSlabs[CONFIG.fareSlabs.length - 1][1];
  }

  function autoFare(km) {
    var a = CONFIG.auto;
    return Math.round(a.baseFare + Math.max(0, km - a.baseKm) * a.perKm);
  }

  function cabFare(km) {
    return Math.round(CONFIG.cab.baseFare + km * CONFIG.cab.perKm);
  }

  /* ------------------------------------------------------------------
   * Metro graph. Node = "line|station". Moving along a line costs run
   * time + dwell; switching lines at an interchange costs a platform
   * walk + an average wait (half a headway).
   * ------------------------------------------------------------------ */
  // Track km between consecutive stations of each line. Straight-line gaps
  // are scaled so that each line adds up to its published length.
  var SEGMENTS = {};
  Object.keys(LINES).forEach(function (line) {
    var st = LINES[line].stations, raw = [], sum = 0;
    for (var i = 0; i + 1 < st.length; i++) {
      raw.push(haversineKm(station(st[i]), station(st[i + 1])));
      sum += raw[i];
    }
    var scale = LINES[line].lengthKm ? LINES[line].lengthKm / sum : 1;
    SEGMENTS[line] = raw.map(function (km) { return km * scale; });
  });

  function segmentKm(line, a, b) {
    var st = LINES[line].stations, i = st.indexOf(a), j = st.indexOf(b);
    return SEGMENTS[line][Math.min(i, j)];
  }
  function segmentMin(km) { return km / CONFIG.metroSpeedKmh * 60 + CONFIG.dwellMin; }

  function buildGraph(headway) {
    var g = {};
    function edge(from, to, w) { (g[from] = g[from] || []).push({ to: to, w: w }); }

    Object.keys(LINES).forEach(function (line) {
      var st = LINES[line].stations;
      for (var i = 0; i + 1 < st.length; i++) {
        var w = segmentMin(SEGMENTS[line][i]);
        edge(line + '|' + st[i], line + '|' + st[i + 1], w);
        edge(line + '|' + st[i + 1], line + '|' + st[i], w);
      }
    });

    Object.keys(STATIONS).forEach(function (id) {
      var ls = linesAt(id);
      ls.forEach(function (a) {
        ls.forEach(function (b) {
          if (a !== b) edge(a + '|' + id, b + '|' + id, CONFIG.transferMin + headway / 2);
        });
      });
    });
    return g;
  }

  // Shortest-time metro route. Returns null if from === to.
  function route(fromId, toId, opts) {
    station(fromId); station(toId);
    if (fromId === toId) return null;
    var headway = (opts && opts.headwayMin) || CONFIG.offPeakHeadwayMin;
    var g = buildGraph(headway);

    var dist = {}, prev = {}, done = {}, queue = [];
    linesAt(fromId).forEach(function (l) { var n = l + '|' + fromId; dist[n] = 0; queue.push(n); });

    var target = null;
    while (queue.length) {
      // The network is ~30 stations, so a linear scan beats a heap here.
      queue.sort(function (a, b) { return dist[a] - dist[b]; });
      var u = queue.shift();
      if (done[u]) continue;
      done[u] = true;
      if (u.split('|')[1] === toId) { target = u; break; }
      (g[u] || []).forEach(function (e) {
        var d = dist[u] + e.w;
        if (dist[e.to] === undefined || d < dist[e.to]) {
          dist[e.to] = d; prev[e.to] = u; queue.push(e.to);
        }
      });
    }
    if (!target) return null;

    var path = [];
    for (var n = target; n; n = prev[n]) path.unshift(n);
    return describe(path);
  }

  // Turn a node path into legs: one leg per line ridden. The path never
  // starts or ends with a transfer, so every leg has at least two stations.
  function describe(path) {
    var legs = [], cur = null;
    path.forEach(function (node) {
      var p = node.split('|'), line = p[0], id = p[1];
      if (!cur || cur.line !== line) {
        cur = { line: line, stations: [id] };
        legs.push(cur);
      } else {
        cur.stations.push(id);
      }
    });

    var totalKm = 0, rideMin = 0, stops = 0;
    legs.forEach(function (leg) {
      var st = LINES[leg.line].stations;
      var a = st.indexOf(leg.stations[0]), b = st.indexOf(leg.stations[leg.stations.length - 1]);
      leg.towards = b > a ? st[st.length - 1] : st[0];
      leg.km = 0;
      for (var i = 0; i + 1 < leg.stations.length; i++) leg.km += segmentKm(leg.line, leg.stations[i], leg.stations[i + 1]);
      leg.stops = leg.stations.length - 1;
      leg.min = leg.km / CONFIG.metroSpeedKmh * 60 + CONFIG.dwellMin * (leg.stops - 1);
      totalKm += leg.km; rideMin += leg.min; stops += leg.stops;
    });

    return {
      from: legs[0].stations[0],
      to: legs[legs.length - 1].stations[legs[legs.length - 1].stations.length - 1],
      legs: legs,
      km: totalKm,
      rideMin: rideMin,
      stops: stops,
      transfers: legs.length - 1,
      fare: metroFare(totalKm)
    };
  }

  /* ------------------------------------------------------------------
   * First / last mile
   * ------------------------------------------------------------------ */
  function nearestStations(place, k) {
    return Object.keys(STATIONS)
      .map(function (id) { return { id: id, km: roadKm(place, station(id)) }; })
      .sort(function (a, b) { return a.km - b.km; })
      .slice(0, k || 3);
  }

  // mode: 'auto' (walk short hops, auto otherwise), 'cycle' or 'walk'.
  function mileLeg(km, mode, peak) {
    if (km < 0.05) return { mode: 'none', km: 0, min: 0, cost: 0, co2: 0 };
    var walk = { mode: 'walk', km: km, min: km / CONFIG.walkKmh * 60, cost: 0, co2: 0 };
    if (mode === 'walk' || km <= CONFIG.maxWalkKm) return walk;
    if (mode === 'cycle' && km <= CONFIG.maxCycleKm) return { mode: 'cycle', km: km, min: km / CONFIG.cycleKmh * 60, cost: 0, co2: 0 };
    var speed = peak ? CONFIG.roadKmhPeak : CONFIG.roadKmhOffPeak;
    return { mode: 'auto', km: km, min: CONFIG.auto.waitMin + km / speed * 60, cost: autoFare(km), co2: km * CONFIG.co2.auto };
  }

  function directRoad(kind, km, peak) {
    var speed = peak ? CONFIG.roadKmhPeak : CONFIG.roadKmhOffPeak;
    var t = CONFIG[kind];
    return {
      mode: kind, km: km,
      min: t.waitMin + km / speed * 60,
      cost: kind === 'auto' ? autoFare(km) : cabFare(km),
      co2: km * CONFIG.co2[kind]
    };
  }

  /* ------------------------------------------------------------------
   * Door-to-door planning.
   * A place is { name, lat, lng } or { stationId }.
   * opts: { date: Date, mile: 'auto' | 'cycle' | 'walk' }
   * ------------------------------------------------------------------ */
  function toPlace(p) {
    if (p.stationId) { var s = station(p.stationId); s.stationId = s.id; return s; }
    return p;
  }

  function candidates(place) {
    return place.stationId ? [{ id: place.stationId, km: 0 }] : nearestStations(place, 3);
  }

  function planTrip(originIn, destIn, opts) {
    opts = opts || {};
    var date = opts.date || new Date(), mile = opts.mile || 'auto';
    var origin = toPlace(originIn), dest = toPlace(destIn);
    var service = serviceStatus(date), peak = !!service.peak;
    var headway = service.headwayMin;

    var options = [];
    candidates(origin).forEach(function (o) {
      candidates(dest).forEach(function (d) {
        var r = route(o.id, d.id, { headwayMin: headway });
        if (!r) return;
        var first = mileLeg(o.km, mile, peak), last = mileLeg(d.km, mile, peak);
        var waitMin = CONFIG.stationEntryMin + headway / 2 + (service.startsInMin || 0);
        var transferMin = r.transfers * (CONFIG.transferMin + headway / 2);
        var metroMin = waitMin + r.rideMin + transferMin;
        options.push({
          route: r,
          firstMile: first,
          lastMile: last,
          waitMin: waitMin,
          transferMin: transferMin,
          metroMin: metroMin,
          min: first.min + metroMin + last.min,
          cost: first.cost + r.fare + last.cost,
          co2: first.co2 + r.km * CONFIG.co2.metro + last.co2
        });
      });
    });
    options.sort(function (a, b) { return (a.min - b.min) || (a.cost - b.cost); });

    var km = roadKm(origin, dest);
    var direct = { auto: directRoad('auto', km, peak), cab: directRoad('cab', km, peak) };
    var best = options[0] || null;

    return {
      origin: origin,
      dest: dest,
      service: service,
      best: best,
      alternatives: options.slice(1, 3),
      direct: direct,
      verdict: best ? verdict(best, direct.auto, direct.cab, service) : null
    };
  }

  function verdict(metro, auto, cab, service) {
    var saveRs = auto.cost - metro.cost;
    var saveMin = auto.min - metro.min;
    var co2Saved = cab.co2 - metro.co2;
    var kind;
    if (service.closed) kind = 'closed';
    else if (saveMin >= -5 && saveRs > 0) kind = 'metro';
    else if (saveRs > 0) kind = 'tradeoff';
    else kind = 'road';
    return { kind: kind, saveRs: saveRs, saveMin: saveMin, co2SavedG: co2Saved };
  }

  /* ------------------------------------------------------------------
   * Exports
   * ------------------------------------------------------------------ */
  var MetroPlanner = {
    station: station,
    linesAt: linesAt,
    haversineKm: haversineKm,
    roadKm: roadKm,
    isPeak: isPeak,
    headwayMin: headwayMin,
    serviceStatus: serviceStatus,
    metroFare: metroFare,
    autoFare: autoFare,
    cabFare: cabFare,
    route: route,
    nearestStations: nearestStations,
    mileLeg: mileLeg,
    planTrip: planTrip
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = MetroPlanner;
  else root.MetroPlanner = MetroPlanner;
})(this);
