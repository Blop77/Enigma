/*
 * app.js — MetroMitra user interface.
 * Depends on data.js (network + assumptions) and planner.js (engine).
 */
(function () {
  'use strict';

  const { STATIONS, LINES, LANDMARKS, CONFIG } = MetroData;
  const P = MetroPlanner;
  const STORE_KEY = 'metromitra-v1';
  const MY_LOCATION = '📍 My location';
  const MILE_ICON = { walk: '🚶', auto: '🛺', cycle: '🚲' };
  const MILE_VERB = { walk: 'Walk', auto: 'Auto', cycle: 'Cycle' };

  const $ = (sel) => document.querySelector(sel);
  const form = $('#plan-form'), fromIn = $('#from'), toIn = $('#to'), whenIn = $('#when');
  const errorEl = $('#error'), resultsEl = $('#results'), mapEl = $('#map');

  let myLocation = null;     // { lat, lng } once the user shares GPS
  let pickNext = 'from';     // which field a tap on the map fills

  /* ------------------------------------------------------------------
   * Places: stations + landmarks, resolved from free text
   * ------------------------------------------------------------------ */
  const PLACES = [];
  Object.keys(STATIONS).forEach((id) => {
    const lines = P.linesAt(id).map((l) => LINES[l].name).join(' + ');
    PLACES.push({ label: STATIONS[id][0], hint: 'Metro · ' + lines, place: { stationId: id } });
  });
  LANDMARKS.forEach(([name, lat, lng]) => {
    PLACES.push({ label: name, hint: 'Place', place: { name, lat, lng } });
  });

  function fillDatalist() {
    const dl = $('#places');
    PLACES.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.label;
      o.label = p.hint;
      dl.appendChild(o);
    });
  }

  function resolve(text) {
    const q = text.trim().toLowerCase();
    if (!q) return null;
    if (text.trim() === MY_LOCATION && myLocation) return { name: 'My location', lat: myLocation.lat, lng: myLocation.lng };
    const exact = PLACES.find((p) => p.label.toLowerCase() === q);
    if (exact) return exact.place;
    const partial = PLACES.filter((p) => p.label.toLowerCase().includes(q));
    return partial.length === 1 ? partial[0].place : null;
  }

  function placeName(place) {
    return place.stationId ? STATIONS[place.stationId][0] : place.name;
  }

  /* ------------------------------------------------------------------
   * Formatting
   * ------------------------------------------------------------------ */
  function fmtMin(m) {
    m = Math.max(1, Math.round(m));
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min';
  }
  const fmtRs = (n) => '₹' + Math.round(n);
  const fmtKm = (n) => (n < 10 ? n.toFixed(1) : Math.round(n)) + ' km';
  const fmtCo2 = (g) => (g >= 1000 ? (g / 1000).toFixed(1) + ' kg' : Math.round(g) + ' g');
  function clock(date, plusMin) {
    const d = new Date(date.getTime() + plusMin * 60000);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  const stName = (id) => STATIONS[id][0];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function departure() {
    const d = new Date();
    if (whenIn.value) {
      const [h, m] = whenIn.value.split(':').map(Number);
      d.setHours(h, m, 0, 0);
    }
    return d;
  }

  /* ------------------------------------------------------------------
   * Service pill in the header
   * ------------------------------------------------------------------ */
  function renderService(date) {
    const s = P.serviceStatus(date), el = $('#service');
    el.classList.toggle('closed', !s.open);
    let text;
    if (s.open) text = 'Running · trains every ~' + s.headwayMin + ' min' + (s.peak ? ' (peak)' : '');
    else if (s.closed) text = 'Closed · first train ' + CONFIG.firstTrain;
    else text = 'Opens in ' + fmtMin(s.startsInMin) + ' · ' + CONFIG.firstTrain;
    el.innerHTML = '<span class="dot"></span>' + esc(text);
  }

  /* ------------------------------------------------------------------
   * Results
   * ------------------------------------------------------------------ */
  function verdictText(v, best, direct) {
    const rs = fmtRs(Math.abs(v.saveRs)), mins = fmtMin(Math.abs(v.saveMin));
    switch (v.kind) {
      case 'closed':
        return 'The metro has stopped for the night (last train ' + CONFIG.lastTrain + '). Road options are below.';
      case 'metro':
        return v.saveMin >= 1
          ? '✅ Metro wins: ' + rs + ' cheaper and ' + mins + ' faster than an auto.'
          : '✅ Take the metro: ' + rs + ' cheaper than an auto, and only ' + mins + ' slower.';
      case 'tradeoff':
        return '⚖️ Metro saves ' + rs + ', but an auto is about ' + mins + ' quicker. Your call.';
      default:
        return '🛺 For this trip an auto is the better deal (' + fmtRs(direct.auto.cost) + ', ' +
               fmtMin(direct.auto.min) + '). The metro does not save you anything here.';
    }
  }

  function step(icon, title, detail, time, extra) {
    return '<li class="step ' + (extra && extra.cls || '') + '">' +
      '<span class="ico"' + (extra && extra.color ? ' style="background:' + extra.color + '"' : '') + '>' + icon + '</span>' +
      '<span class="what"><b>' + title + '</b><small>' + detail + '</small></span>' +
      '<span class="when">' + time + '</span></li>';
  }

  function timeline(trip, date) {
    const b = trip.best, r = b.route, hw = trip.service.headwayMin;
    let t = 0, html = '';

    if (b.firstMile.mode !== 'none') {
      html += step(MILE_ICON[b.firstMile.mode],
        MILE_VERB[b.firstMile.mode] + ' to ' + esc(stName(r.from)) + ' station',
        fmtKm(b.firstMile.km) + ' · ' + fmtMin(b.firstMile.min) + (b.firstMile.cost ? ' · ~' + fmtRs(b.firstMile.cost) : ''),
        clock(date, t));
      t += b.firstMile.min;
    }

    const wait = trip.service.startsInMin
      ? 'First train at ' + CONFIG.firstTrain
      : 'Ticket + security ~' + CONFIG.stationEntryMin + ' min · trains every ~' + hw + ' min';
    html += step('🎫', 'Enter ' + esc(stName(r.from)), wait, clock(date, t));
    t += b.waitMin;

    r.legs.forEach((leg, i) => {
      const L = LINES[leg.line];
      if (i > 0) {
        html += step('⇄', 'Change at ' + esc(stName(leg.stations[0])),
          'Go to the ' + L.name + ' platform · ~' + Math.round(CONFIG.transferMin + hw / 2) + ' min with wait',
          clock(date, t));
        t += CONFIG.transferMin + hw / 2;
      }
      html += step(L.short.replace('Line ', 'L'),
        '<span class="chip" style="background:' + L.color + '">' + L.name + '</span> towards ' + esc(stName(leg.towards)),
        leg.stops + (leg.stops === 1 ? ' stop' : ' stops') + ' · ' + fmtKm(leg.km) + ' · get off at ' + esc(stName(leg.stations[leg.stations.length - 1])),
        clock(date, t), { cls: 'ride', color: L.color });
      t += leg.min;
    });

    if (b.lastMile.mode !== 'none') {
      html += step(MILE_ICON[b.lastMile.mode],
        MILE_VERB[b.lastMile.mode] + ' to ' + esc(placeName(trip.dest)),
        fmtKm(b.lastMile.km) + ' · ' + fmtMin(b.lastMile.min) + (b.lastMile.cost ? ' · ~' + fmtRs(b.lastMile.cost) : ''),
        clock(date, t));
      t += b.lastMile.min;
    }
    html += step('🏁', 'Arrive at ' + esc(placeName(trip.dest)), '', clock(date, t));
    return '<ol class="steps">' + html + '</ol>';
  }

  function compareTable(trip) {
    const rows = [];
    if (trip.best) {
      const modes = [trip.best.firstMile.mode, trip.best.lastMile.mode];
      const extra = ['auto', 'cycle'].filter((m) => modes.includes(m)).join(' + ');
      rows.push(['🚇 Metro' + (extra ? ' + ' + extra : ''), trip.best]);
    }
    rows.push(['🛺 Auto all the way', trip.direct.auto]);
    rows.push(['🚕 Cab all the way', trip.direct.cab]);
    const cheapest = Math.min(...rows.map((r) => r[1].cost));
    return '<table class="compare"><thead><tr><th>Option</th><th>Time</th><th>Cost</th><th>CO₂</th></tr></thead><tbody>' +
      rows.map(([label, o]) => '<tr' + (o.cost === cheapest ? ' class="best"' : '') + '><td>' + label + '</td><td>' +
        fmtMin(o.min) + '</td><td>' + fmtRs(o.cost) + '</td><td>' + fmtCo2(o.co2) + '</td></tr>').join('') +
      '</tbody></table>';
  }

  function renderResults(trip, date) {
    let html = '';
    if (trip.best) {
      const b = trip.best;
      html += '<div class="summary">' +
        '<div class="stat"><b>' + fmtMin(b.min) + '</b><small>door to door</small></div>' +
        '<div class="stat"><b>' + fmtRs(b.cost) + '</b><small>metro ' + fmtRs(b.route.fare) + '</small></div>' +
        '<div class="stat"><b>' + fmtCo2(Math.max(0, trip.verdict.co2SavedG)) + '</b><small>CO₂ saved vs cab</small></div>' +
        '</div>';
      html += '<p class="verdict ' + trip.verdict.kind + '">' + verdictText(trip.verdict, b, trip.direct) + '</p>';
      html += timeline(trip, date);
    } else {
      html += '<p class="verdict road">Both places are closest to the same metro station, so the metro will not help. ' +
              'Walk or take an auto.</p>';
    }
    html += '<h3>Compare</h3>' + compareTable(trip);
    if (trip.alternatives.length) {
      html += '<h3>Other ways by metro</h3>' + trip.alternatives.map((a) =>
        '<p class="alt">From ' + esc(stName(a.route.from)) + ' to ' + esc(stName(a.route.to)) + ' · ' +
        fmtMin(a.min) + ' · ' + fmtRs(a.cost) + '</p>').join('');
    }
    html += '<button type="button" class="share" id="share">🔗 Copy link to this trip</button>';

    resultsEl.innerHTML = html;
    resultsEl.hidden = false;
    $('#share').addEventListener('click', share);
  }

  /* ------------------------------------------------------------------
   * Map: stations projected from lat/lng into an SVG
   * ------------------------------------------------------------------ */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    const n = document.createElementNS(SVG_NS, name);
    Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(n);
    return n;
  }

  function drawMap(trip) {
    const pts = Object.keys(STATIONS).map((id) => ({ lat: STATIONS[id][1], lng: STATIONS[id][2] }));
    if (trip) {
      if (!trip.origin.stationId) pts.push(trip.origin);
      if (!trip.dest.stationId) pts.push(trip.dest);
    }
    const k = Math.cos(18.55 * Math.PI / 180);
    let minLat = Math.min(...pts.map((p) => p.lat)), maxLat = Math.max(...pts.map((p) => p.lat));
    let minLng = Math.min(...pts.map((p) => p.lng)), maxLng = Math.max(...pts.map((p) => p.lng));
    const W = 600, pad = 80, inner = W - 2 * pad;
    const scale = inner / Math.max((maxLng - minLng) * k, (maxLat - minLat));
    const H = Math.round((maxLat - minLat) * scale + 2 * pad);
    const xy = (p) => [pad + (p.lng - minLng) * k * scale, pad + (maxLat - p.lat) * scale];
    const sxy = (id) => xy({ lat: STATIONS[id][1], lng: STATIONS[id][2] });

    mapEl.innerHTML = '';
    mapEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    mapEl.classList.toggle('has-route', !!(trip && trip.best));

    Object.keys(LINES).forEach((line) => {
      el('polyline', { class: 'track', stroke: LINES[line].color,
        points: LINES[line].stations.map((id) => sxy(id).join(',')).join(' ') }, mapEl);
    });

    const onRoute = new Set();   // stations where you board, change or get off
    if (trip && trip.best) {
      const b = trip.best;
      if (b.firstMile.mode !== 'none') el('line', lineAttrs(xy(trip.origin), sxy(b.route.from)), mapEl);
      if (b.lastMile.mode !== 'none') el('line', lineAttrs(sxy(b.route.to), xy(trip.dest)), mapEl);
      b.route.legs.forEach((leg) => {
        onRoute.add(leg.stations[0]);
        onRoute.add(leg.stations[leg.stations.length - 1]);
        el('polyline', { class: 'route', stroke: LINES[leg.line].color,
          points: leg.stations.map((id) => sxy(id).join(',')).join(' ') }, mapEl);
      });
    }

    const selected = new Set();
    [fromIn.value, toIn.value].forEach((v) => { const p = resolve(v); if (p && p.stationId) selected.add(p.stationId); });

    Object.keys(STATIONS).forEach((id) => {
      const [x, y] = sxy(id), lines = P.linesAt(id), xchg = lines.length > 1;
      const st = LINES[lines[0]].stations;
      const terminal = lines.length === 1 && (st[0] === id || st[st.length - 1] === id);
      const c = el('circle', { cx: x, cy: y, r: xchg ? 8 : 6,
        class: 'stn' + (xchg ? ' xchg' : '') + (selected.has(id) ? ' sel' : ''),
        stroke: LINES[lines[0]].color, tabindex: 0, role: 'button', 'aria-label': stName(id) }, mapEl);
      el('title', {}, c).textContent = stName(id);
      c.addEventListener('click', () => pickStation(id));
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickStation(id); } });

      if (xchg || terminal || onRoute.has(id) || selected.has(id)) {
        const aqua = lines[0] === 'aqua' && !xchg;
        const t = el('text', aqua
          ? { x: x + 6, y: y + 18, class: 'lbl', transform: 'rotate(30 ' + (x + 6) + ' ' + (y + 18) + ')' }
          : { x: xchg ? x - 12 : x + 11, y: y + 4, class: 'lbl', 'text-anchor': xchg ? 'end' : 'start' }, mapEl);
        t.textContent = stName(id);
      }
    });

    if (trip) {
      [[trip.origin, '#1f8a4c', 'A'], [trip.dest, '#b3261e', 'B']].forEach(([p, color, tag]) => {
        if (p.stationId) return;
        const [x, y] = xy(p);
        el('circle', { cx: x, cy: y, r: 9, fill: color, class: 'pin' }, mapEl);
        const left = x > W / 2;   // keep labels on the right half inside the map
        const t = el('text', { x: left ? x - 13 : x + 13, y: y + 4, class: 'lbl', 'text-anchor': left ? 'end' : 'start' }, mapEl);
        t.textContent = tag + ' · ' + p.name;
      });
    }
  }

  function lineAttrs(a, b) { return { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'mile' }; }

  function drawLegend() {
    $('#legend').innerHTML = Object.keys(LINES).map((l) =>
      '<span><i style="background:' + LINES[l].color + '"></i>' + LINES[l].name + '</span>').join('');
  }

  function pickStation(id) {
    if (pickNext === 'from') {
      fromIn.value = stName(id);
      toIn.value = '';
      resultsEl.hidden = true;
      pickNext = 'to';
      drawMap(null);
      toIn.focus();
    } else {
      toIn.value = stName(id);
      pickNext = 'from';
      plan();
    }
  }

  /* ------------------------------------------------------------------
   * Planning, sharing, persistence
   * ------------------------------------------------------------------ */
  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = !msg;
  }

  function mile() { return form.elements.mile.value; }

  function plan() {
    showError('');
    const from = resolve(fromIn.value), to = resolve(toIn.value);
    if (!from) return showError('Pick a "From" place from the list (start typing a station or landmark).');
    if (!to) return showError('Pick a "To" place from the list (start typing a station or landmark).');
    if (from.stationId && from.stationId === to.stationId) return showError('From and To are the same station.');

    const date = departure();
    const trip = P.planTrip(from, to, { date, mile: mile() });
    renderService(date);
    renderResults(trip, date);
    drawMap(trip);
    save();
    if (fromIn.value !== MY_LOCATION) history.replaceState(null, '', '#' + hashFor());
    if (window.matchMedia('(max-width: 899px)').matches) resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hashFor() {
    return new URLSearchParams({ from: fromIn.value, to: toIn.value, mile: mile() }).toString();
  }

  function share() {
    const url = location.href.split('#')[0] + '#' + hashFor();
    const btn = $('#share');
    const done = () => { btn.textContent = '✔ Link copied'; };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt('Copy this link:', url));
    else prompt('Copy this link:', url);
  }

  function setMile(value) {
    const r = form.querySelector('input[name=mile][value="' + value + '"]');
    if (r) r.checked = true;
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ mile: mile() })); } catch (e) { /* private mode */ }
  }

  function load() {
    try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && s.mile) setMile(s.mile); } catch (e) { /* ignore */ }
  }

  function locate() {
    if (!navigator.geolocation) return showError('Your browser cannot share its location.');
    const btn = $('#locate');
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition((pos) => {
      btn.disabled = false;
      const { latitude: lat, longitude: lng } = pos.coords, b = CONFIG.bounds;
      if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) {
        return showError('You seem to be outside Pune. Pick a starting place from the list instead.');
      }
      myLocation = { lat, lng };
      fromIn.value = MY_LOCATION;
      showError('');
      if (toIn.value) plan(); else toIn.focus();
    }, () => {
      btn.disabled = false;
      showError('Could not get your location. Pick a starting place from the list instead.');
    }, { enableHighAccuracy: true, timeout: 10000 });
  }

  /* ------------------------------------------------------------------
   * Wiring
   * ------------------------------------------------------------------ */
  function init() {
    fillDatalist();
    drawLegend();
    load();
    const now = new Date();
    whenIn.value = clock(now, 0);
    renderService(now);
    drawMap(null);

    form.addEventListener('submit', (e) => { e.preventDefault(); plan(); });
    $('#swap').addEventListener('click', () => {
      [fromIn.value, toIn.value] = [toIn.value, fromIn.value];
      if (fromIn.value && toIn.value) plan();
    });
    $('#locate').addEventListener('click', locate);
    form.querySelectorAll('input[name=mile]').forEach((r) => r.addEventListener('change', () => {
      save();
      if (!resultsEl.hidden) plan();
    }));
    whenIn.addEventListener('change', () => { if (!resultsEl.hidden) plan(); else renderService(departure()); });
    document.querySelectorAll('.quick button').forEach((b) => b.addEventListener('click', () => {
      fromIn.value = b.dataset.from;
      toIn.value = b.dataset.to;
      plan();
    }));

    const params = new URLSearchParams(location.hash.slice(1));
    if (params.get('from') && params.get('to')) {
      fromIn.value = params.get('from');
      toIn.value = params.get('to');
      if (params.get('mile')) setMile(params.get('mile'));
      plan();
    }
  }

  init();
})();
