/*
 * app.js — MetroMitra user interface.
 * Depends on data.js (network + assumptions), i18n.js (strings) and
 * planner.js (engine).
 */
(function () {
  'use strict';

  const { STATIONS, STATIONS_MR, STATION_ACCESS, STATION_ALIASES, LINES, LANDMARKS, LANDMARKS_MR, CONFIG } = MetroData;
  const P = MetroPlanner, I = I18N, t = I18N.t;
  const Savings = MetroSavings;
  const OPEN_STATION_IDS = Object.keys(STATIONS).filter((id) => P.linesAt(id).length > 0);
  const OPEN_LINE_IDS = Object.keys(LINES).filter((id) => LINES[id].status !== 'planned');
  const INITIAL_HASH = location.hash;   // read before showView() rewrites it; the Gap Map restores from it
  const STORE_KEY = 'metromitra-v1';
  const LANG_KEY = 'metromitra-lang';
  const ACCESS_KEY = 'metromitra-accessible';
  const MILE_ICON = { walk: '🚶', auto: '🛺', cycle: '🚲' };

  const $ = (sel) => document.querySelector(sel);
  const form = $('#plan-form'), fromIn = $('#from'), toIn = $('#to'), whenIn = $('#when');
  const errorEl = $('#error'), resultsEl = $('#results'), mapEl = $('#map');

  let myLocation = null;     // { lat, lng } once the user shares GPS
  let pickNext = 'from';     // which field a tap on the map fills
  let trips = [];            // logged trips: { t, from, to, cost, autoCost, co2SavedG } (English names)
  let cardPreviewVisible = false;
  let cardPreviewUrl = null;
  let cardRenderId = 0;
  let accessibleOn = false;
  let mapSxy = null;         // station -> [x, y] for the planner map as last drawn

  /* ------------------------------------------------------------------
   * Places: stations + landmarks, resolved from free text in either
   * language. The datalist only suggests names in the current language.
   * ------------------------------------------------------------------ */
  const PLACES = [];
  OPEN_STATION_IDS.forEach((id) => {
    PLACES.push({ label: STATIONS[id][0], lang: 'en', place: { stationId: id } });
    if (STATIONS_MR[id]) PLACES.push({ label: STATIONS_MR[id], lang: 'mr', place: { stationId: id } });
    // Other names (e.g. "Paud Phata", "Kasba Peth") resolve but stay out of the suggestion list.
    (STATION_ALIASES[id] || []).forEach((label) => PLACES.push({ label, lang: 'alias', place: { stationId: id } }));
  });
  LANDMARKS.forEach(([name, lat, lng]) => {
    PLACES.push({ label: name, lang: 'en', place: { name, lat, lng } });
    if (LANDMARKS_MR[name]) PLACES.push({ label: LANDMARKS_MR[name], lang: 'mr', place: { name, lat, lng } });
  });

  function fillDatalist() {
    const dl = $('#places');
    dl.innerHTML = '';
    PLACES.filter((p) => p.lang === I.lang).forEach((p) => {
      const o = document.createElement('option');
      o.value = p.label;
      o.label = p.place.stationId
        ? t('hint.metro', { lines: P.linesAt(p.place.stationId).map(I.line).join(' + ') })
        : t('hint.place');
      dl.appendChild(o);
    });
  }

  // A point picked on the Gap Map is written as "📍 Near X · lat, lng" so it
  // survives in a share link.
  const POINT_RE = /^📍 (.+) · (-?\d+\.\d+), (-?\d+\.\d+)$/;
  function pointLabel(p) { return '📍 ' + p.name + ' · ' + p.lat.toFixed(4) + ', ' + p.lng.toFixed(4); }
  const isMyLocation = (text) => I.all('myLocation').includes(text.trim());

  function resolve(text) {
    const q = text.trim().toLowerCase();
    if (!q) return null;
    if (isMyLocation(text)) return myLocation ? { name: t('myLocation.name'), lat: myLocation.lat, lng: myLocation.lng } : null;
    const pt = text.trim().match(POINT_RE);
    if (pt) return { name: pt[1], lat: +pt[2], lng: +pt[3] };
    const exact = PLACES.find((p) => p.label.toLowerCase() === q);
    if (exact) return exact.place;
    // Several labels can name the same place (English and Marathi); count places, not labels.
    const partial = PLACES.filter((p) => p.label.toLowerCase().includes(q));
    const keys = new Set(partial.map((p) => p.place.stationId || p.place.name));
    return keys.size === 1 ? partial[0].place : null;
  }

  // Name in the current language, and the English name we store.
  function placeName(place) { return place.stationId ? I.station(place.stationId) : I.place(place.name); }
  function placeKey(place) { return place.stationId ? STATIONS[place.stationId][0] : place.name; }

  /* ------------------------------------------------------------------
   * Formatting
   * ------------------------------------------------------------------ */
  function fmtMin(m) {
    m = Math.max(1, Math.round(m));
    if (m < 60) return m + ' ' + t('unit.min');
    return Math.floor(m / 60) + ' ' + t('unit.h') + ' ' + String(m % 60).padStart(2, '0') + ' ' + t('unit.min');
  }
  const fmtRs = (n) => '₹' + Math.round(n);
  const fmtKm = (n) => (n < 10 ? n.toFixed(1) : Math.round(n)) + ' ' + t('unit.km');
  const fmtCo2 = (g) => (g >= 1000 ? (g / 1000).toFixed(1) + ' ' + t('unit.kg') : Math.round(g) + ' ' + t('unit.g'));
  function clock(date, plusMin) {
    const d = new Date(date.getTime() + plusMin * 60000);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  const stName = (id) => I.station(id);
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
    if (s.open) text = t('service.running', { hw: s.headwayMin }) + (s.peak ? t('service.peak') : '');
    else if (s.closed) text = t('service.closed', { time: CONFIG.firstTrain });
    else text = t('service.opens', { wait: fmtMin(s.startsInMin), time: CONFIG.firstTrain });
    el.innerHTML = '<span class="dot"></span>' + esc(text);
  }

  /* ------------------------------------------------------------------
   * Results
   * ------------------------------------------------------------------ */
  function verdictText(v, trip) {
    const direct = trip.direct;
    const rs = fmtRs(Math.abs(v.saveRs)), min = fmtMin(Math.abs(v.saveMin));
    switch (v.kind) {
      case 'closed': return t('verdict.closed', { time: CONFIG.lastTrain });
      case 'notyet': return t('verdict.notyet', { time: CONFIG.firstTrain, wait: fmtMin(trip.service.startsInMin) });
      case 'metro': return t(v.saveMin >= 1 ? 'verdict.faster' : 'verdict.slower', { rs, min });
      case 'tradeoff': return t('verdict.tradeoff', { rs, min });
      default: return t('verdict.road', { rs: fmtRs(direct.auto.cost), min: fmtMin(direct.auto.min) });
    }
  }

  function step(icon, title, detail, time, extra) {
    return '<li class="step ' + (extra && extra.cls || '') + '">' +
      '<span class="ico"' + (extra && extra.color ? ' style="background:' + extra.color + '"' : '') + '>' + icon + '</span>' +
      '<span class="what"><b>' + title + '</b><small>' + detail + '</small></span>' +
      '<span class="when">' + time + '</span></li>';
  }

  function mileDetail(leg) {
    return fmtKm(leg.km) + ' · ' + fmtMin(leg.min) + (leg.cost ? ' · ~' + fmtRs(leg.cost) : '');
  }

  function timeline(trip, date) {
    const b = trip.best, r = b.route, hw = trip.service.headwayMin;
    let tm = 0, html = '';

    if (trip.accessible) html += step('♿', t('access.route'), '', clock(date, tm));

    if (b.firstMile.mode !== 'none') {
      html += step(MILE_ICON[b.firstMile.mode], t('step.first.' + b.firstMile.mode, { place: esc(stName(r.from)) }),
        mileDetail(b.firstMile), clock(date, tm));
      tm += b.firstMile.min;
    }

    const tk = b.ticket;
    const fare = t('step.ticket', { fare: fmtRs(tk.fare) }) + (tk.pct ? t('step.discount', { pct: tk.pct, base: fmtRs(tk.base) }) : '');
    const entryMin = CONFIG.stationEntryMin + (trip.accessible ? CONFIG.access.extraEntryMin : 0);
    const wait = trip.service.startsInMin
      ? fare + t('step.firstTrain', { time: CONFIG.firstTrain })
      : fare + t('step.wait', { min: entryMin, hw });
    html += step('🎫', t('step.enter', { station: esc(stName(r.from)) }), wait, clock(date, tm));
    tm += b.waitMin;

    r.legs.forEach((leg, i) => {
      const L = LINES[leg.line];
      if (i > 0) {
        const transferMin = CONFIG.transferMin + hw / 2 + (trip.accessible ? CONFIG.access.extraTransferMin : 0);
        html += step('⇄', t('step.change', { station: esc(stName(leg.stations[0])) }),
          t('step.changeHow', { line: I.line(leg.line), min: Math.round(transferMin) }), clock(date, tm));
        tm += transferMin;
      }
      const chip = '<span class="chip" style="background:' + L.color + '">' + I.line(leg.line) + '</span>';
      html += step(L.short.replace('Line ', 'L'),
        t('step.ride', { line: chip, station: esc(stName(leg.towards)) }),
        t('step.stops', { n: leg.stops, km: fmtKm(leg.km), station: esc(stName(leg.stations[leg.stations.length - 1])) }),
        clock(date, tm), { cls: 'ride', color: L.color });
      tm += leg.min;
    });

    if (b.lastMile.mode !== 'none') {
      html += step(MILE_ICON[b.lastMile.mode], t('step.last.' + b.lastMile.mode, { place: esc(placeName(trip.dest)) }),
        mileDetail(b.lastMile), clock(date, tm));
      tm += b.lastMile.min;
    }
    html += step('🏁', t('step.arrive', { place: esc(placeName(trip.dest)) }), '', clock(date, tm));
    return '<ol class="steps">' + html + '</ol>';
  }

  function compareTable(trip) {
    const rows = [];
    if (trip.best) {
      const modes = [trip.best.firstMile.mode, trip.best.lastMile.mode];
      const extra = ['auto', 'cycle'].filter((m) => modes.includes(m)).map((m) => t('mode.' + m)).join(' + ');
      rows.push([t('res.metro') + (extra ? ' + ' + extra : ''), trip.best]);
    }
    rows.push([t('res.autoAll'), trip.direct.auto]);
    rows.push([t('res.cabAll'), trip.direct.cab]);
    const cheapest = Math.min(...rows.map((r) => r[1].cost));
    return '<table class="compare"><thead><tr><th>' + t('res.option') + '</th><th>' + t('res.time') + '</th><th>' +
      t('res.cost') + '</th><th>' + t('res.co2') + '</th></tr></thead><tbody>' +
      rows.map(([label, o]) => '<tr' + (o.cost === cheapest ? ' class="best"' : '') + '><td>' + label + '</td><td>' +
        fmtMin(o.min) + '</td><td>' + fmtRs(o.cost) + '</td><td>' + fmtCo2(o.co2) + '</td></tr>').join('') +
      '</tbody></table>';
  }

  function renderResults(trip, date) {
    let html = '';
    if (trip.best) {
      const b = trip.best;
      html += '<div class="summary">' +
        '<div class="stat"><b>' + fmtMin(b.min) + '</b><small>' + t('sum.door') + '</small></div>' +
        '<div class="stat"><b>' + fmtRs(b.cost) + '</b><small>' + t('sum.metro', { fare: fmtRs(b.ticket.fare) }) +
          (b.ticket.pct ? t('sum.off', { pct: b.ticket.pct }) : '') + '</small></div>' +
        '<div class="stat"><b>' + fmtCo2(Math.max(0, trip.verdict.co2SavedG)) + '</b><small>' + t('sum.co2') + '</small></div>' +
        '</div>';
      html += '<p class="verdict ' + trip.verdict.kind + '">' + verdictText(trip.verdict, trip) + '</p>';
      html += timeline(trip, date);
    } else {
      html += '<p class="verdict road">' + t(trip.noStepFree ? 'access.noRoute' : 'verdict.same') + '</p>';
    }
    html += '<h3>' + t('res.compare') + '</h3>' + compareTable(trip);
    if (trip.alternatives.length) {
      html += '<h3>' + t('res.others') + '</h3>' + trip.alternatives.map((a) =>
        '<p class="alt">' + t('res.alt', { from: esc(stName(a.route.from)), to: esc(stName(a.route.to)),
          min: fmtMin(a.min), rs: fmtRs(a.cost) }) + '</p>').join('');
    }
    html += '<div class="actions">' +
      (trip.best && trip.verdict.kind !== 'closed' ? '<button type="button" class="took" id="took">' + t('res.took') + '</button>' : '') +
      '<button type="button" class="share" id="share">' + t('res.share') + '</button>' +
      '<button type="button" class="share" id="trip-qr">' + t('share.qr') + '</button></div>';

    resultsEl.innerHTML = html;
    resultsEl.hidden = false;
    $('#share').addEventListener('click', share);
    $('#trip-qr').addEventListener('click', () =>
      MetroShare.showQr(location.href.split('#')[0] + '#' + hashFor(), t('share.qrTrip')));
    const took = $('#took');
    if (took) took.addEventListener('click', () => { logTrip(trip); took.disabled = true; took.textContent = t('res.added'); });
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

  // Tooltip: the name in the current language, then the other one.
  function bilingual(id) {
    const other = I.lang === 'mr' ? STATIONS[id][0] : STATIONS_MR[id];
    return stName(id) + (other ? ' · ' + other : '');
  }

  function drawMap(trip) {
    const pts = OPEN_STATION_IDS.map((id) => ({ lat: STATIONS[id][1], lng: STATIONS[id][2] }));
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
    mapSxy = sxy;   // the projection changes with each trip; taps must use the current one

    mapEl.innerHTML = '';
    mapEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    mapEl.classList.toggle('has-route', !!(trip && trip.best));

    OPEN_LINE_IDS.forEach((line) => {
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

    OPEN_STATION_IDS.forEach((id) => {
      const [x, y] = sxy(id), lines = P.linesAt(id), xchg = lines.length > 1;
      const st = LINES[lines[0]].stations;
      const terminal = lines.length === 1 && (st[0] === id || st[st.length - 1] === id);
      const c = el('circle', { cx: x, cy: y, r: xchg ? 8 : 6,
        class: 'stn' + (xchg ? ' xchg' : '') + (selected.has(id) ? ' sel' : ''),
        stroke: LINES[lines[0]].color, tabindex: 0, role: 'button', 'aria-label': stName(id) }, mapEl);
      el('title', {}, c).textContent = bilingual(id);
      c.addEventListener('click', () => pickStation(id));
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickStation(id); } });

      if (xchg || terminal || onRoute.has(id) || selected.has(id)) {
        const aqua = lines[0] === 'aqua' && !xchg;
        const tx = el('text', aqua
          ? { x: x + 6, y: y + 18, class: 'lbl', transform: 'rotate(30 ' + (x + 6) + ' ' + (y + 18) + ')' }
          : { x: xchg ? x - 12 : x + 11, y: y + 4, class: 'lbl', 'text-anchor': xchg ? 'end' : 'start' }, mapEl);
        tx.textContent = stName(id);
      }
    });

    if (trip) {
      [[trip.origin, '#1f8a4c', 'A'], [trip.dest, '#b3261e', 'B']].forEach(([p, color, tag]) => {
        if (p.stationId) return;
        const [x, y] = xy(p);
        el('circle', { cx: x, cy: y, r: 9, fill: color, class: 'pin' }, mapEl);
        const left = x > W / 2;   // keep labels on the right half inside the map
        const tx = el('text', { x: left ? x - 13 : x + 13, y: y + 4, class: 'lbl', 'text-anchor': left ? 'end' : 'start' }, mapEl);
        tx.textContent = tag + ' · ' + placeName(p);
      });
    }
  }

  function accessibleTouchRadius() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--access-tap-size')) / 2;
  }

  // Choose the nearest marker when enlarged station touch targets overlap.
  function nearestMapStation(e) {
    const rect = mapEl.getBoundingClientRect(), scale = rect.width / 600;
    if (!scale || !mapSxy) return null;
    const x = (e.clientX - rect.left) / scale, y = (e.clientY - rect.top) / scale;
    let best = null, bestDistance = Infinity;
    OPEN_STATION_IDS.forEach((id) => {
      const p = mapSxy(id), distance = Math.hypot(p[0] - x, p[1] - y) * scale;
      if (distance < bestDistance) { best = id; bestDistance = distance; }
    });
    return bestDistance <= accessibleTouchRadius() ? best : null;
  }

  function lineAttrs(a, b) { return { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'mile' }; }

  function drawLegend() {
    $('#legend').innerHTML = OPEN_LINE_IDS.map((l) =>
      '<span><i style="background:' + LINES[l].color + '"></i>' + I.line(l) + '</span>').join('');
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
   * My savings: trips the user says they took, compared with an auto
   * ------------------------------------------------------------------ */
  function logTrip(trip) {
    trips.push({
      t: Date.now(),
      from: placeKey(trip.origin),
      to: placeKey(trip.dest),
      cost: Math.round(trip.best.cost),
      autoCost: Math.round(trip.direct.auto.cost),
      co2SavedG: Math.round(trip.verdict.co2SavedG)
    });
    save();
    renderSavings();
  }

  function renderSavings() {
    const renderId = ++cardRenderId;
    const body = $('#savings-body');
    $('#clear-trips').hidden = !trips.length;
    if (!trips.length) {
      cardPreviewVisible = false;
      body.innerHTML = '<p class="empty">' + t('sav.empty') + '</p>';
      return;
    }
    const now = new Date();
    const month = Savings.monthTrips(trips, now), card = Savings.cardData(trips, now);
    const m = Savings.totals(month), all = Savings.totals(trips);
    const monthName = card.month;
    if (!card.n) cardPreviewVisible = false;
    const cardControls = card.n ? '<div class="savings-card-controls">' +
      '<button type="button" class="primary small-btn" id="save-card">' + t('sav.card.button') + '</button>' +
      '<p id="card-error" class="error" role="alert" hidden></p>' +
      '<div id="card-preview" class="savings-card-preview" hidden><img id="card-preview-image" alt="' +
      esc(t('sav.card.preview')) + '"></div></div>' : '';
    body.innerHTML = '<div class="summary">' +
      '<div class="stat"><b>' + m.n + '</b><small>' + esc(t('sav.month', { n: m.n, month: monthName })) + '</small></div>' +
      '<div class="stat"><b>' + fmtRs(Math.max(0, m.rs)) + '</b><small>' + t('sav.saved') + '</small></div>' +
      '<div class="stat"><b>' + fmtCo2(Math.max(0, m.co2)) + '</b><small>' + t('sav.co2') + '</small></div>' +
      '</div>' +
      cardControls +
      (all.n > m.n ? '<p class="alt">' + t('sav.all', { n: all.n, rs: fmtRs(Math.max(0, all.rs)), co2: fmtCo2(Math.max(0, all.co2)) }) + '</p>' : '') +
      '<ul class="trip-log">' + trips.slice(-5).reverse().map((x) => {
        const d = new Date(x.t), save = x.autoCost - x.cost;
        return '<li><span>' + esc(d.toLocaleDateString(I.locale(), { day: 'numeric', month: 'short' })) + ' · ' +
          esc(I.place(x.from)) + ' → ' + esc(I.place(x.to)) + '</span><span class="' + (save > 0 ? 'gain' : 'loss') + '">' +
          (save > 0 ? '+' + fmtRs(save) : fmtRs(x.cost)) + '</span></li>';
      }).join('') + '</ul>';
    const button = $('#save-card');
    if (button) button.addEventListener('click', () => {
      cardPreviewVisible = true;
      createSavingsCard(card, true, ++cardRenderId);
    });
    if (card.n && cardPreviewVisible) createSavingsCard(card, false, renderId);
  }

  async function createSavingsCard(data, shareOrDownload, renderId) {
    const button = $('#save-card'), error = $('#card-error');
    if (button) button.disabled = true;
    if (error) error.hidden = true;
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const canvas = document.createElement('canvas');
      MetroSavingsCard.drawCard(canvas, data);
      const blob = await MetroSavingsCard.toBlob(canvas);
      if (!cardPreviewVisible || renderId !== cardRenderId) return;
      if (cardPreviewUrl) URL.revokeObjectURL(cardPreviewUrl);
      cardPreviewUrl = URL.createObjectURL(blob);
      const image = $('#card-preview-image'), preview = $('#card-preview');
      if (!image || !preview) return;
      image.src = cardPreviewUrl;
      image.alt = t('sav.card.preview');
      preview.hidden = false;
      if (!shareOrDownload) return;

      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const file = new File([blob], 'metromitra-savings-' + data.year + '-' + month + '.png', { type: 'image/png' });
      if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: t('sav.card.shareText', {
          rs: fmtRs(data.rs), co2: fmtCo2(data.co2)
        }) });
      } else {
        const link = document.createElement('a'), downloadUrl = URL.createObjectURL(blob);
        link.href = downloadUrl;
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      if (error) { error.textContent = t('sav.card.error'); error.hidden = false; }
    } finally {
      if (renderId === cardRenderId && button && button.isConnected) button.disabled = false;
    }
  }

  /* ------------------------------------------------------------------
   * Planning, sharing, persistence
   * ------------------------------------------------------------------ */
  function showError(key) {
    errorEl.textContent = key ? t(key) : '';
    errorEl.hidden = !key;
  }

  function mile() { return form.elements.mile.value; }
  function pass() { return $('#pass').value; }

  function fillPasses() {
    const sel = $('#pass'), current = sel.value;
    sel.innerHTML = '';
    Object.keys(CONFIG.concessions).forEach((k) => {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = t('pass.' + k);
      sel.appendChild(o);
    });
    if (current) sel.value = current;
  }

  // quiet: re-render in place (e.g. after a language switch) without scrolling.
  function plan(quiet) {
    showError('');
    const from = resolve(fromIn.value), to = resolve(toIn.value);
    if (!from) return showError('err.from');
    if (!to) return showError('err.to');
    if (from.stationId && from.stationId === to.stationId) return showError('err.same');

    const date = departure();
    const trip = P.planTrip(from, to, { date, mile: mile(), pass: pass(), accessible: accessibleOn,
      avoid: accessibleOn ? avoidedStations() : [] });
    renderService(date);
    renderResults(trip, date);
    drawMap(trip);
    save();
    if (!isMyLocation(fromIn.value)) history.replaceState(null, '', '#' + hashFor());
    if (!quiet && window.matchMedia('(max-width: 899px)').matches) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      resultsEl.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function hashFor() {
    return new URLSearchParams({ from: fromIn.value, to: toIn.value, mile: mile() }).toString();
  }

  function share() {
    const url = location.href.split('#')[0] + '#' + hashFor();
    const btn = $('#share');
    const done = () => { btn.textContent = t('res.copied'); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt(t('res.copyPrompt'), url));
    else prompt(t('res.copyPrompt'), url);
  }

  function setMile(value) {
    const r = form.querySelector('input[name=mile][value="' + value + '"]');
    if (r) r.checked = true;
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ mile: mile(), pass: pass(), trips }));
      localStorage.setItem(ACCESS_KEY, String(accessibleOn));
    } catch (e) { /* private mode */ }
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      if (s.mile) setMile(s.mile);
      if (s.pass && CONFIG.concessions[s.pass]) $('#pass').value = s.pass;
      if (Array.isArray(s.trips)) trips = s.trips;
      accessibleOn = localStorage.getItem(ACCESS_KEY) === 'true';
    } catch (e) { /* storage blocked or corrupt: start fresh */ }
    renderAccessibilityToggle();
  }

  function renderAccessibilityToggle() {
    document.documentElement.classList.toggle('accessible', accessibleOn);
    const button = $('#access-toggle');
    if (button) button.setAttribute('aria-pressed', String(accessibleOn));
  }

  function avoidedStations() {
    return Object.keys(STATION_ACCESS).filter((id) => STATION_ACCESS[id] && STATION_ACCESS[id].lift === false);
  }

  function locate() {
    if (!navigator.geolocation) return showError('err.noGeo');
    const btn = $('#locate');
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition((pos) => {
      btn.disabled = false;
      const { latitude: lat, longitude: lng } = pos.coords, b = CONFIG.bounds;
      if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return showError('err.outside');
      myLocation = { lat, lng };
      fromIn.value = t('myLocation');
      showError('');
      if (toIn.value) plan(); else toIn.focus();
    }, () => {
      btn.disabled = false;
      showError('err.geoFail');
    }, { enableHighAccuracy: true, timeout: 10000 });
  }

  /* ------------------------------------------------------------------
   * Language: English / मराठी. Saved per device; Marathi browsers start in Marathi.
   * ------------------------------------------------------------------ */
  function initialLang() {
    const linked = new URLSearchParams(INITIAL_HASH.slice(1)).get('lang');   // a shared link's language wins
    if (linked === 'mr' || linked === 'en') return linked;
    try { const saved = localStorage.getItem(LANG_KEY); if (saved) return saved; } catch (e) { /* no storage */ }
    return /^mr\b/i.test(navigator.language || '') ? 'mr' : 'en';
  }

  // A place typed or picked in one language is shown in the new one.
  function relabel(input) {
    const known = PLACES.find((p) => p.label === input.value.trim());
    if (known) input.value = placeName(known.place);
    else if (isMyLocation(input.value)) input.value = t('myLocation');
  }

  function setLanguage(lang, rerender) {
    I.setLang(lang);
    try { localStorage.setItem(LANG_KEY, I.lang); } catch (e) { /* no storage */ }
    document.documentElement.lang = I.lang;
    document.title = t('doc.title');
    I.applyTo(document);
    relabel(fromIn);
    relabel(toIn);
    fillDatalist();
    fillPasses();
    drawLegend();
    if (!rerender) return;
    errorEl.hidden = true;
    if (!resultsEl.hidden) plan(true);
    else { renderService(departure()); drawMap(null); }
    document.dispatchEvent(new CustomEvent('mm:lang', { detail: I.lang }));
  }

  /* ------------------------------------------------------------------
   * Views: Gap Map (for the city) and Trip planner (for riders)
   * ------------------------------------------------------------------ */
  let view = null;
  function showView(name) {
    view = name;
    document.querySelectorAll('.tabs [data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === name)));
    $('#view-gap').hidden = name !== 'gap';
    $('#view-plan').hidden = name !== 'plan';
    if (name === 'gap') history.replaceState(null, '', '#view=gap');
    else if (resultsEl.hidden) history.replaceState(null, '', '#view=plan');
    else if (!isMyLocation(fromIn.value)) history.replaceState(null, '', '#' + hashFor());
    document.dispatchEvent(new CustomEvent('mm:view', { detail: name }));
  }

  // Used by the Gap Map: plan a trip from a point on the map.
  function planFrom(place, toName) {
    fromIn.value = pointLabel(place);
    toIn.value = toName;
    showView('plan');
    plan();
  }

  /* ------------------------------------------------------------------
   * Wiring
   * ------------------------------------------------------------------ */
  function init() {
    fillPasses();
    load();
    setLanguage(initialLang(), false);
    renderSavings();
    const now = new Date();
    whenIn.value = clock(now, 0);
    renderService(now);
    drawMap(null);

    $('#lang-toggle').addEventListener('click', () => setLanguage(I.lang === 'mr' ? 'en' : 'mr', true));
    $('#access-toggle').addEventListener('click', () => {
      accessibleOn = !accessibleOn;
      renderAccessibilityToggle();
      save();
      document.dispatchEvent(new CustomEvent('mm:access', { detail: accessibleOn }));
      if (!resultsEl.hidden) plan(true);
      else drawMap(null);
    });
    mapEl.addEventListener('click', (e) => {
      if (!accessibleOn || (e.target.closest && e.target.closest('.stn'))) return;
      const id = nearestMapStation(e);
      if (id) pickStation(id);
    });
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
    $('#pass').addEventListener('change', () => { save(); if (!resultsEl.hidden) plan(); });
    $('#clear-trips').addEventListener('click', () => {
      if (!confirm(t('sav.confirm'))) return;
      trips = [];
      save();
      renderSavings();
    });
    whenIn.addEventListener('change', () => { if (!resultsEl.hidden) plan(); else renderService(departure()); });
    document.querySelectorAll('.quick button').forEach((b) => b.addEventListener('click', () => {
      fromIn.value = I.place(b.dataset.from);
      toIn.value = I.place(b.dataset.to);
      plan();
    }));

    document.querySelectorAll('.tabs [data-view]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

    const params = new URLSearchParams(location.hash.slice(1));
    if (params.get('from') && params.get('to')) {
      fromIn.value = params.get('from');
      toIn.value = params.get('to');
      if (params.get('mile')) setMile(params.get('mile'));
      showView('plan');
      plan();
    } else {
      showView(params.get('view') === 'plan' ? 'plan' : 'gap');
    }
  }

  window.MetroMitra = {
    fmtMin, fmtRs, fmtKm, fmtCo2, esc, showView, planFrom,
    initialHash: INITIAL_HASH,
    get view() { return view; }
  };

  document.addEventListener('mm:lang', renderSavings);

  init();

  // Offline support: cache the app so it works underground with no signal.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* app still works online */ });
  }
})();
