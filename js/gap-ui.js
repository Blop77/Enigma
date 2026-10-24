/*
 * gap-ui.js — the Gap Map view: a heat map of where Pune Metro beats an auto,
 * and a feeder-bus simulator. Depends on data.js, planner.js, gapmap.js and
 * app.js (window.MetroMitra for formatting and opening the trip planner).
 */
(function () {
  'use strict';

  const { STATIONS, STATIONS_MR, LINES, LANDMARKS, HUBS, CONFIG } = MetroData;
  const P = MetroPlanner, G = GapMap, M = window.MetroMitra;
  const $ = (sel) => document.querySelector(sel);
  const svg = $('#gap-map');
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const KIND_ICON = { metro: '✅', tradeoff: '⚖️', road: '🛺' };
  const KIND_TEXT = { metro: 'Metro wins', tradeoff: 'Metro cheaper, slower', road: 'Auto better' };

  let state = null;          // GapMap.build() result for the current time, with the chosen feeders
  let bare = null;           // the same grid with no feeders (recommend() leaves it unchanged)
  let base = null;           // summary of bare, for "before → after"
  let recs = [];             // suggested feeders for the current hub and time
  let selected = null;       // index of the tapped cell
  let started = false;

  const hub = () => +$('#gap-hub').value;               // -1 = all hubs
  const peak = () => document.querySelector('input[name=gap-time]:checked').value === 'peak';
  const stName = (id) => STATIONS[id][0];

  /* ------------------------------------------------------------------
   * Building and summarising
   * ------------------------------------------------------------------ */
  // Time changed (or first load): rebuild the grid, keeping the chosen feeders.
  function rebuild() {
    const feeders = state ? G.feederList(state) : [];
    bare = G.build({ peak: peak() });
    state = G.build({ peak: peak(), feeders });
    refresh();
    setTimeout(buildReport, 60);
  }

  // Hub changed: same grid, new headline and suggestions.
  let pending = 0;
  function refresh() {
    base = G.summary(bare, hub());
    recs = [];
    render();
    $('#recs').innerHTML = '<li class="muted">Testing a feeder at every station…</li>';
    // Recommending takes about a second; let the map paint first.
    const ticket = ++pending;
    setTimeout(() => {
      if (ticket !== pending) return;      // a newer request replaced this one
      // Drop suggestions too small to be worth running a bus for.
      recs = G.recommend(bare, 5, hub()).filter((r) => r.gainKm2 >= 0.5);
      renderRecs();
    }, 30);
  }

  function hubLabel() {
    return hub() < 0 ? 'Pune\'s ' + HUBS.length + ' main job, college and travel hubs' : HUBS[hub()];
  }

  function renderHeadline() {
    const now = G.summary(state, hub());
    const feeders = G.feederList(state).length;
    $('#gap-pct').textContent = Math.round(base.goodPct) + '%';
    $('#gap-after').innerHTML = feeders
      ? ' <span class="arrow">→</span> <b class="after">' + Math.round(now.goodPct) + '%</b>'
      : '';
    $('#gap-caption').innerHTML = 'of Pune\'s area near the metro, the metro beats an auto for ' +
      (hub() < 0 ? 'most trips to ' : 'getting to ') + '<b>' + M.esc(hubLabel()) + '</b> at ' +
      (peak() ? 'peak hour' : 'off-peak times') + '.' +
      (feeders ? ' With ' + feeders + ' feeder' + (feeders > 1 ? 's' : '') + ' it rises to <b>' + Math.round(now.goodPct) +
        '%</b>, and the area where an auto is better shrinks from ' + Math.round(base.poorPct) + '% to <b>' +
        Math.round(now.poorPct) + '%</b>.' : '');
    const bar = $('#gap-bar').children;
    bar[0].style.width = now.goodPct + '%';
    bar[1].style.width = now.mixedPct + '%';
    bar[2].style.width = now.poorPct + '%';
  }

  function renderRecs() {
    const ol = $('#recs');
    if (!recs.length) { ol.innerHTML = '<li class="muted">No feeder would help here.</li>'; return; }
    const on = new Set(G.feederList(state));
    ol.innerHTML = recs.map((r, i) =>
      '<li><label><input type="checkbox" data-station="' + r.station + '"' + (on.has(r.station) ? ' checked' : '') + '>' +
      '<span class="rec-name">' + (i + 1) + '. ' + M.esc(stName(r.station)) + '</span>' +
      '<span class="rec-gain" title="Area that gets better metro access">+' + r.gainKm2.toFixed(1) + ' km² better served</span></label></li>').join('');
    ol.querySelectorAll('input').forEach((cb) => cb.addEventListener('change', () => toggleFeeder(cb.dataset.station, cb.checked)));
  }

  function toggleFeeder(id, on) {
    G.setFeeder(state, id, on);
    render();
    renderRecs();
  }

  /* ------------------------------------------------------------------
   * Map
   * ------------------------------------------------------------------ */
  function el(name, attrs, parent) {
    const n = document.createElementNS(SVG_NS, name);
    Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(n);
    return n;
  }

  const g = CONFIG.gapMap, K = Math.cos(((g.minLat + g.maxLat) / 2) * Math.PI / 180);
  const W = 600, SCALE = W / ((g.maxLng - g.minLng) * K), H = Math.round((g.maxLat - g.minLat) * SCALE);
  const xy = (p) => [(p.lng - g.minLng) * K * SCALE, (g.maxLat - p.lat) * SCALE];
  const sxy = (id) => xy({ lat: STATIONS[id][1], lng: STATIONS[id][2] });

  function render() {
    renderHeadline();
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = '';
    const h = hub(), cw = g.step * K * SCALE, ch = g.step * SCALE;

    const cells = el('g', { class: 'cells' }, svg);
    state.cells.forEach((c, i) => {
      const b = G.band(G.cellScore(state, i, h));
      const [x, y] = xy(c);
      const r = el('rect', { x: x - cw / 2, y: y - ch / 2, width: cw + 0.3, height: ch + 0.3, class: 'cell ' + b + (i === selected ? ' sel' : '') }, cells);
      r.dataset.i = i;
    });

    // Feeder catchments (road km -> straight-line km).
    const radius = CONFIG.feeder.maxKm / CONFIG.roadFactor * SCALE / 111.32;
    G.feederList(state).forEach((id) => {
      const [x, y] = sxy(id);
      el('circle', { cx: x, cy: y, r: radius, class: 'catch' }, svg);
    });

    Object.keys(LINES).forEach((line) => {
      el('polyline', { class: 'track', stroke: LINES[line].color,
        points: LINES[line].stations.map((id) => sxy(id).join(',')).join(' ') }, svg);
    });

    const feeders = new Set(G.feederList(state));
    Object.keys(STATIONS).forEach((id) => {
      const [x, y] = sxy(id), lines = P.linesAt(id);
      const c = el('circle', { cx: x, cy: y, r: feeders.has(id) ? 7 : 4.5,
        class: 'stn' + (feeders.has(id) ? ' feeder' : ''), stroke: LINES[lines[0]].color,
        tabindex: 0, role: 'button', 'aria-label': stName(id) + (feeders.has(id) ? ', feeder on' : ', add feeder') }, svg);
      el('title', {}, c).textContent = stName(id) + (STATIONS_MR[id] ? ' · ' + STATIONS_MR[id] : '') +
        (feeders.has(id) ? ' · feeder on (tap to remove)' : ' · tap to add a feeder');
      const toggle = () => toggleFeeder(id, !feeders.has(id));
      c.addEventListener('click', toggle);
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      if (feeders.has(id)) {
        const t = el('text', { x: x + 10, y: y - 8, class: 'lbl feeder-lbl' }, svg);
        t.textContent = '🚌 ' + stName(id);
      }
    });

    // Hubs: a diamond each. Names only for a single chosen hub; with all 12
    // the centre gets too crowded, so they show on hover instead.
    state.hubs.forEach((hb, j) => {
      if (h >= 0 && j !== h) return;
      const [x, y] = xy(hb);
      const d = el('rect', { x: x - 5, y: y - 5, width: 10, height: 10, transform: 'rotate(45 ' + x + ' ' + y + ')', class: 'hub' }, svg);
      el('title', {}, d).textContent = hb.name;
      if (h < 0) return;
      const t = el('text', { x: x > W * 0.7 ? x - 10 : x + 10, y: y + 4, class: 'lbl hub-lbl', 'text-anchor': x > W * 0.7 ? 'end' : 'start' }, svg);
      t.textContent = hb.name;
    });
  }

  /* ------------------------------------------------------------------
   * City report: every hub ranked, with the single best feeder for it.
   * One hub per tick so the page stays responsive.
   * ------------------------------------------------------------------ */
  let reportRun = 0;
  function buildReport() {
    const run = ++reportRun, rows = [], src = bare;
    $('#report-lead').textContent = 'Ranking hubs…';
    $('#report-body').innerHTML = '';
    let j = 0;
    (function step() {
      if (run !== reportRun) return;            // settings changed; a newer report is running
      if (j < HUBS.length) {
        const s = G.summary(src, j), r = G.recommend(src, 1, j)[0];
        rows.push({ name: HUBS[j], good: s.goodPct, poor: s.poorPct, feeder: r && r.gainKm2 >= 0.5 ? r : null });
        j++;
        setTimeout(step, 0);
        return;
      }
      rows.sort((a, b) => a.good - b.good);
      const worst = rows[0], best = rows[rows.length - 1];
      $('#report-lead').innerHTML = 'At ' + (peak() ? 'peak hour' : 'off-peak times') + ', <b>' + M.esc(worst.name) +
        '</b> is the worst-served hub: the metro beats an auto from only <b>' + Math.round(worst.good) + '%</b> of the area. ' +
        '<b>' + M.esc(best.name) + '</b> is the best served (' + Math.round(best.good) + '%).';
      $('#report-body').innerHTML = rows.map((r) =>
        '<tr><td>' + M.esc(r.name) + '</td>' +
        '<td class="pct good">' + Math.round(r.good) + '%</td>' +
        '<td class="pct poor">' + Math.round(r.poor) + '%</td>' +
        '<td>' + (r.feeder ? '🚌 ' + M.esc(stName(r.feeder.station)) + '<small>+' + r.feeder.gainKm2.toFixed(1) + ' km² better served</small>' : '<span class="muted">none needed</span>') + '</td>' +
        '<td>' + (r.feeder ? '<span class="pct good">' + Math.round(r.feeder.goodPct) + '%</span> / <span class="pct poor">' +
          Math.round(r.feeder.poorPct) + '%</span>' : '–') + '</td></tr>').join('');
    })();
  }

  /* ------------------------------------------------------------------
   * Cell details
   * ------------------------------------------------------------------ */
  function areaName(c) {
    let best = null;
    LANDMARKS.forEach(([name, lat, lng]) => {
      const d = P.haversineKm(c, { lat, lng });
      if (!best || d < best.d) best = { name, d };
    });
    Object.keys(STATIONS).forEach((id) => {
      const d = P.haversineKm(c, P.station(id));
      if (!best || d < best.d) best = { name: stName(id), d };
    });
    return best.d < 2.5 ? 'Near ' + best.name : 'Around ' + c.lat.toFixed(3) + ', ' + c.lng.toFixed(3);
  }

  function legText(leg) {
    if (leg.mode === 'none') return '';
    const icon = { walk: '🚶', auto: '🛺', feeder: '🚌', cycle: '🚲' }[leg.mode];
    return icon + ' ' + M.fmtKm(leg.km);
  }

  function showCell(i) {
    selected = i;
    const c = state.cells[i], name = areaName(c), h = hub();
    const rows = state.hubs.map((hb, j) => ({ hb, j, t: state.trips[i][j] }))
      .filter((r) => (h < 0 || r.j === h));
    const body = rows.map(({ hb, t }) => {
      if (!t) return '<tr><td>' + M.esc(hb.name) + '</td><td colspan="3" class="muted">Too close for the metro</td></tr>';
      const m = t.metro;
      return '<tr><td>' + M.esc(hb.name) + '<small>' + legText(m.first) + ' · ' + M.esc(stName(m.from)) + ' → ' +
        M.esc(stName(m.to)) + ' · ' + legText(m.last) + '</small></td>' +
        '<td title="' + KIND_TEXT[t.kind] + '">' + KIND_ICON[t.kind] + '</td>' +
        '<td>' + M.fmtMin(m.min) + '<small>' + M.fmtRs(m.cost) + '</small></td>' +
        '<td>' + M.fmtMin(t.auto.min) + '<small>' + M.fmtRs(t.auto.cost) + '</small></td></tr>';
    }).join('');
    const box = $('#cell-info');
    box.innerHTML = '<div class="cell-head"><h3>' + M.esc(name) + '</h3>' +
      '<button type="button" class="link-btn" id="cell-close">Close</button></div>' +
      '<table class="compare cell-table"><thead><tr><th>To</th><th></th><th>Metro</th><th>Auto</th></tr></thead><tbody>' +
      body + '</tbody></table>' +
      '<div class="rec-actions"><label class="small-label" for="cell-to">Plan a trip from here to</label>' +
      '<select id="cell-to">' + rows.filter((r) => r.t).map((r) => '<option>' + M.esc(r.hb.name) + '</option>').join('') + '</select>' +
      '<button type="button" class="primary small-btn" id="cell-plan">Open in trip planner</button></div>';
    box.hidden = false;
    $('#cell-close').addEventListener('click', () => { box.hidden = true; selected = null; render(); });
    const go = $('#cell-plan');
    if (!$('#cell-to').options.length) go.disabled = true;
    go.addEventListener('click', () => {
      M.planFrom({ name: name.replace(/^(Near|Around) /, ''), lat: c.lat, lng: c.lng }, $('#cell-to').value);
    });
    render();
    if (window.matchMedia('(max-width: 899px)').matches) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ------------------------------------------------------------------
   * Wiring
   * ------------------------------------------------------------------ */
  function start() {
    if (started) return;
    started = true;
    const sel = $('#gap-hub');
    sel.innerHTML = '<option value="-1">All ' + HUBS.length + ' major hubs</option>' +
      HUBS.map((name, j) => '<option value="' + j + '">' + M.esc(name) + '</option>').join('');
    $('#feeder-km').textContent = CONFIG.feeder.maxKm;
    $('#cell-size').textContent = G.cellKm2().toFixed(1);
    $('#min-trip').textContent = CONFIG.gapMap.minTripKm;
    $('#print-report').addEventListener('click', () => window.print());
    $('#gap-legend').innerHTML = Object.keys(LINES).map((l) =>
      '<span><i style="background:' + LINES[l].color + '"></i>' + LINES[l].name + '</span>').join('') +
      '<span><i class="hub-key"></i>Hub</span>';

    sel.addEventListener('change', () => {
      selected = null;
      $('#cell-info').hidden = true;
      refresh();
    });
    document.querySelectorAll('input[name=gap-time]').forEach((r) => r.addEventListener('change', rebuild));
    $('#apply-all').addEventListener('click', () => {
      recs.forEach((r) => G.setFeeder(state, r.station, true));
      render();
      renderRecs();
    });
    $('#reset-feeders').addEventListener('click', () => {
      G.feederList(state).forEach((id) => G.setFeeder(state, id, false));
      render();
      renderRecs();
    });
    svg.addEventListener('click', (e) => {
      const i = e.target.dataset && e.target.dataset.i;
      if (i !== undefined) showCell(+i);
    });
    rebuild();
  }

  document.addEventListener('mm:view', (e) => { if (e.detail === 'gap') start(); });
  if (M.view === 'gap') start();
})();
