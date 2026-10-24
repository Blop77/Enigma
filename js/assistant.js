/*
 * assistant.js — offline question answering over MetroMitra's own engines.
 * Works in the browser (window.MetroAssistant) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var Data = isNode ? require('./data.js') : root.MetroData;
  var P = isNode ? require('./planner.js') : root.MetroPlanner;
  var G = isNode ? require('./gapmap.js') : root.GapMap;
  var R = isNode ? require('./reports.js') : root.MetroReports;
  var I = isNode ? require('./i18n.js') : root.I18N;
  var STATIONS = Data.STATIONS, CONFIG = Data.CONFIG;
  var gapState = null;

  function translate(key, vars, lang) {
    var strings = I.STRINGS[key], text = strings ? strings[lang === 'mr' ? 1 : 0] : undefined;
    if (text === undefined && strings) text = strings[0];
    if (text === undefined) return key;
    return vars ? text.replace(/\{(\w+)\}/g, function (match, name) { return name in vars ? vars[name] : match; }) : text;
  }

  function dateValue(now) {
    if (now instanceof Date) return now;
    if (typeof now === 'number') return new Date(now);
    return new Date();
  }

  function normalize(text) {
    return String(text || '').toLowerCase().trim().replace(/[?？!！。.,;:]+$/g, '').replace(/\s+/g, ' ');
  }

  function placeRows() {
    var rows = [];
    Object.keys(STATIONS).forEach(function (id) {
      if (!P.linesAt(id).length) return;
      rows.push({ id: id, name: STATIONS[id][0], place: { stationId: id } });
      if (Data.STATIONS_MR[id]) rows.push({ id: id, name: Data.STATIONS_MR[id], place: { stationId: id } });
      (Data.STATION_ALIASES[id] || []).forEach(function (name) { rows.push({ id: id, name: name, place: { stationId: id } }); });
    });
    Data.LANDMARKS.forEach(function (item) {
      var name = item[0], place = { name: name, lat: item[1], lng: item[2] };
      rows.push({ name: name, place: place });
      if (Data.LANDMARKS_MR[name]) rows.push({ name: Data.LANDMARKS_MR[name], place: place });
    });
    return rows;
  }

  function resolvePlace(label) {
    var q = normalize(label), rows = placeRows();
    var exact = rows.filter(function (row) { return normalize(row.name) === q; });
    if (exact.length) return exact[0].place;
    var partial = rows.filter(function (row) { return normalize(row.name).indexOf(q) !== -1; });
    var ids = {};
    partial.forEach(function (row) { ids[row.place.stationId || row.place.name] = row.place; });
    var keys = Object.keys(ids);
    return keys.length === 1 ? ids[keys[0]] : null;
  }

  function displayName(place, lang) {
    if (place.stationId) return lang === 'mr' && Data.STATIONS_MR[place.stationId] || STATIONS[place.stationId][0];
    return lang === 'mr' && Data.LANDMARKS_MR[place.name] || place.name;
  }

  function cleanLabel(label) {
    return String(label || '').trim().replace(/^[\s,]+|[\s,]+$/g, '').replace(/[?.!؟]+$/g, '').trim();
  }

  function pairFrom(text, lang, fare) {
    var s = normalize(text), match;
    if (lang === 'mr' || /\sते\s/.test(s)) {
      s = s.replace(/\s+भाडे\s*$/i, '').replace(/^.*?(?:सांगा|दाखवा)\s*/i, '');
      match = s.match(/^(.+?)\s+ते\s+(.+)$/);
    } else {
      s = s.replace(/\s+(?:fare|ticket|price)\s*$/i, '');
      s = s.replace(/^(?:what is the |what's the |tell me the )?(?:metro )?(?:fare|ticket price|price)(?: from)?\s+/i, '');
      s = s.replace(/^(?:how do i get from|how can i get from|how to get from|directions from|route from|from)\s+/i, '');
      match = s.match(/^(.+?)\s+(?:to|→)\s+(.+)$/i);
    }
    if (!match) return null;
    var a = resolvePlace(cleanLabel(match[1])), b = resolvePlace(cleanLabel(match[2]));
    if (!a || !b) return null;
    return { from: a, to: b, fromLabel: displayName(a, lang), toLabel: displayName(b, lang), fare: !!fare };
  }

  function nearestStation(place) {
    if (place.stationId) return place.stationId;
    var nearest = P.nearestStations(place, 1);
    return nearest.length ? nearest[0].id : null;
  }

  function money(n) { return '₹' + Math.round(n); }
  function mins(n, lang) {
    var m = Math.max(1, Math.round(n));
    if (m < 60) return m + ' ' + translate('unit.min', null, lang);
    return Math.floor(m / 60) + ' ' + translate('unit.h', null, lang) + ' ' + String(m % 60).padStart(2, '0') + ' ' + translate('unit.min', null, lang);
  }

  function stationName(id, lang) { return lang === 'mr' && Data.STATIONS_MR[id] || STATIONS[id][0]; }

  function verdictText(trip, lang) {
    var v = trip.verdict;
    if (v.kind === 'closed') return translate('verdict.closed', { time: CONFIG.lastTrain }, lang);
    if (v.kind === 'notyet') return translate('verdict.notyet', { time: CONFIG.firstTrain, wait: mins(trip.service.startsInMin, lang) }, lang);
    if (v.kind === 'metro') return translate(v.saveMin >= 1 ? 'verdict.faster' : 'verdict.slower', { rs: money(Math.abs(v.saveRs)), min: mins(Math.abs(v.saveMin), lang) }, lang);
    if (v.kind === 'tradeoff') return translate('verdict.tradeoff', { rs: money(Math.abs(v.saveRs)), min: mins(Math.abs(v.saveMin), lang) }, lang);
    return translate('verdict.road', { rs: money(trip.direct.auto.cost), min: mins(trip.direct.auto.min, lang) }, lang);
  }

  function stateForGap() {
    if (!gapState) gapState = G.build({ peak: true });
    return gapState;
  }

  function nearScore(place) {
    var state = stateForGap(), point = place.stationId ? P.station(place.stationId) : place;
    var best = -1, bestKm = Infinity;
    state.cells.forEach(function (cell, i) {
      var km = P.haversineKm(point, cell);
      if (km < bestKm) { bestKm = km; best = i; }
    });
    var score = best < 0 ? null : G.cellScore(state, best, -1);
    return { score: score, band: G.band(score) };
  }

  function answer(question, lang, now, reports) {
    lang = lang === 'mr' ? 'mr' : 'en';
    var s = normalize(question), date = dateValue(now), pair;

    if (/\b(first train|first metro)\b/.test(s) || /पहिली गाडी|पहिली मेट्रो/.test(s)) {
      return { textKey: 'assistant.first', vars: { time: CONFIG.firstTrain }, action: null };
    }
    if (/\b(last train|last metro)\b/.test(s) || /शेवटची गाडी|शेवटची मेट्रो/.test(s)) {
      return { textKey: 'assistant.last', vars: { time: CONFIG.lastTrain }, action: null };
    }
    if (/\b(how often|frequency|train frequency|how frequently)\b/.test(s) || /किती वेळाने|किती मिनिटांनी|वारंवारता/.test(s)) {
      return { textKey: 'assistant.frequency', vars: { minutes: P.headwayMin(date) }, action: null };
    }

    pair = pairFrom(s, lang, true);
    if (pair && /\b(fare|ticket|price)\b/.test(s) || pair && /भाडे/.test(s)) {
      var fromId = nearestStation(pair.from), toId = nearestStation(pair.to);
      var fare = fromId && toId ? P.chartFare(fromId, toId) : null;
      return fare === null
        ? { textKey: 'assistant.fareMissing', vars: { from: pair.fromLabel, to: pair.toLabel }, action: null }
        : { textKey: 'assistant.fare', vars: { from: stationName(fromId, lang), to: stationName(toId, lang), fare: money(fare) }, action: null };
    }

    var student = /\b(student|student fare|student concession)\b/.test(s) || /विद्यार्थी/.test(s);
    var card = /\b(card|pune card|e-ticket|concession|discount)\b/.test(s) || /कार्ड|सवलत|ई-तिकीट/.test(s);
    if (student || card) {
      var kind = student ? 'student' : 'card', concession = CONFIG.concessions[kind];
      return { textKey: 'assistant.concession', vars: { pass: translate('pass.' + kind, null, lang), weekday: concession.weekday, weekend: concession.weekend }, action: null };
    }

    if (/\b(where should|where can|best place).*(feeder|feeders|feeder bus|feeder buses)\b/.test(s) || /फीडर.*कुठे|कुठे.*फीडर/.test(s)) {
      var picks = G.recommend(stateForGap(), CONFIG.assistant.feederSuggestions);
      return { textKey: picks.length ? 'assistant.feeders' : 'assistant.feedersNone',
        vars: { stations: picks.map(function (pick) { return stationName(pick.station, lang); }).join(', ') }, action: { type: 'gap' } };
    }

    var liftMatch = s.match(/^(?:is the )?lift working at (.+)$/i) || s.match(/^(.+?)\s+(?:lift working|lift चालू)\??$/i) ||
      s.match(/^(.+?)\s+(?:येथे|ची)\s+लिफ्ट\s+चालू\s+आहे(?:\s+का)?$/i);
    if (liftMatch) {
      var place = resolvePlace(cleanLabel(liftMatch[1]));
      if (!place || !place.stationId) return { textKey: 'assistant.unknownStation', vars: {}, action: null };
      var active = R.activeForStation(reports, place.stationId, date.getTime(), CONFIG.reportExpiryMs);
      var lifts = active.filter(function (item) { return item.type === 'lift'; }).length;
      return { textKey: lifts ? 'assistant.liftReported' : 'assistant.liftNoReport',
        vars: { station: displayName(place, lang), count: lifts }, action: null };
    }

    var nearMatch = s.match(/\b(?:how good is (?:the )?metro near|metro near)\s+(.+)$/i) ||
      s.match(/^(.+?)\s+(?:जवळ|येथे)\s+मेट्रो\s+(?:कशी|किती चांगली)(?:\s+आहे)?$/i) ||
      s.match(/^मेट्रो\s+(.+?)\s+(?:जवळ|येथे)\s+(?:कशी|किती चांगली)(?:\s+आहे)?$/i);
    if (nearMatch) {
      var nearPlace = resolvePlace(cleanLabel(nearMatch[1]));
      if (!nearPlace) return { textKey: 'assistant.placeUnknown', vars: { place: cleanLabel(nearMatch[1]) }, action: null };
      var score = nearScore(nearPlace), pct = score.score === null ? 0 : Math.round(score.score * 100);
      return { textKey: 'assistant.gap.' + score.band, vars: { place: displayName(nearPlace, lang), percent: pct }, action: { type: 'gap' } };
    }

    pair = pairFrom(s, lang, false);
    if (pair) {
      var trip = P.planTrip(pair.from, pair.to, { date: date, mile: 'auto', pass: 'regular' });
      if (!trip.best) return { textKey: 'assistant.tripNoMetro', vars: { from: pair.fromLabel, to: pair.toLabel }, action: { type: 'trip', from: pair.fromLabel, to: pair.toLabel } };
      return { textKey: 'assistant.trip', vars: { from: pair.fromLabel, to: pair.toLabel,
        time: mins(trip.best.min, lang), fare: money(trip.best.cost), verdict: verdictText(trip, lang) },
        action: { type: 'trip', from: pair.fromLabel, to: pair.toLabel } };
    }

    return { textKey: 'assistant.fallback', vars: {}, action: null };
  }

  var MetroAssistant = { answer: answer, resolvePlace: resolvePlace };
  if (isNode) module.exports = MetroAssistant;
  else root.MetroAssistant = MetroAssistant;
})(this);
