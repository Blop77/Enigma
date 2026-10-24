/*
 * gap-ui.js — the Gap Map view: a heat map of where Pune Metro beats an auto,
 * and a feeder-bus simulator. Depends on data.js, i18n.js, planner.js,
 * gapmap.js and app.js (window.MetroMitra for formatting and opening the
 * trip planner).
 */
(function () {
  'use strict';

  const { STATIONS, STATIONS_MR, LINES, LANDMARKS, HUBS, CONFIG } = MetroData;
  const P = MetroPlanner, G = GapMap, M = window.MetroMitra, I = I18N, t = I18N.t;
  const $ = (sel) => document.querySelector(sel);
  const svg = $('#gap-map');
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const KIND_ICON = { metro: '✅', tradeoff: '⚖️', road: '🛺' };

  let state = null;          // GapMap.build() result for the current time, with the chosen feeders
  let bare = null;           // the same grid with no feeders (recommend() leaves it unchanged)
  let comparison = null;     // open-lines-only baseline while Line 3 is included
  let base = null;           // summary of bare, for "before → after"
  let recs = null;           // suggested feeders for the current hub and time (null while calculating)
  let reportRows = null;     // city report rows, kept so a language switch needn't recompute
  let selected = null;       // index of the tapped cell
  let started = false;
  const chosenFeeders = new Set();

  const hub = () => +$('#gap-hub').value;               // -1 = all hubs
  const peak = () => document.querySelector('input[name=gap-time]:checked').value === 'peak';
  const includePlanned = () => $('#include-line3').checked;
  const stName = (id) => I.station(id);
  const when = () => t(peak() ? 'gap.when.peak' : 'gap.when.off');
  const km2 = (n) => n.toFixed(1);

  /* ------------------------------------------------------------------
   * Building and summarising
   * ------------------------------------------------------------------ */
  // Time changed (or first load): rebuild the grid, keeping the chosen feeders.
  function rebuild() {
    const planned = includePlanned(), option = { planned };
    const feeders = Array.from(chosenFeeders).filter((id) => P.linesAt(id, option).length > 0);
    bare = G.build({ peak: peak(), planned });
    comparison = planned ? G.build({ peak: peak(), planned: false }) : null;
    state = G.build({ peak: peak(), planned, feeders });
    refresh();
    setTimeout(buildReport, 60);
  }

  // Hub changed: same grid, new headline and suggestions.
  let pending = 0;
  function refresh() {
    base = G.summary(bare, hub());
    recs = null;
    render();
    renderRecs();
    // Recommending takes about a second; let the map paint first.
    const ticket = ++pending;
    setTimeout(() => {
      if (ticket !== pending) return;      // a newer request replaced this one
      // Drop suggestions too small to be worth running a bus for.
      recs = G.recommend(bare, 5, hub()).filter((r) => r.gainKm2 >= 0.5);
      renderRecs();
    }, 30);
  }

  function renderHeadline() {
    const now = G.summary(state, hub());
    const feeders = G.feederList(state).length;
    $('#gap-pct').textContent = Math.round(base.goodPct) + '%';
    $('#gap-after').innerHTML = feeders
      ? ' <span class="arrow">→</span> <b class="after">' + Math.round(now.goodPct) + '%</b>'
      : '';
    $('#gap-caption').innerHTML = (hub() < 0
      ? t('gap.caption.all', { n: HUBS.length, when: when() })
      : t('gap.caption.hub', { hub: M.esc(I.place(HUBS[hub()])), when: when() })) +
      (feeders ? t('gap.withFeeders', { n: feeders, good: Math.round(now.goodPct),
        poor0: Math.round(base.poorPct), poor1: Math.round(now.poorPct) }) : '');
    const delta = $('#gap-planned-delta');
    if (comparison) {
      const without = G.summary(comparison, hub()).goodPct;
      const key = hub() < 0 ? 'gap.line3Change.all' : 'gap.line3Change.hub';
      const vars = { before: Math.round(without), after: Math.round(base.goodPct) };
      if (hub() >= 0) vars.hub = M.esc(I.place(HUBS[hub()]));
      delta.innerHTML = t(key, vars);
      delta.hidden = false;
    } else {
      delta.textContent = '';
      delta.hidden = true;
    }
    const bar = $('#gap-bar').children;
    bar[0].style.width = now.goodPct + '%';
    bar[1].style.width = now.mixedPct + '%';
    bar[2].style.width = now.poorPct + '%';
  }

  function gainHtml(r) {
    return t('gap.gain', { km2: km2(r.gainKm2) });
  }

  function renderRecs() {
    const ol = $('#recs');
    if (!recs) { ol.innerHTML = '<li class="muted">' + t('gap.testing') + '</li>'; return; }
    if (!recs.length) { ol.innerHTML = '<li class="muted">' + t('gap.noFeeder') + '</li>'; return; }
    const on = new Set(G.feederList(state));
    ol.innerHTML = recs.map((r, i) =>
      '<li><label><input type="checkbox" data-station="' + r.station + '"' + (on.has(r.station) ? ' checked' : '') + '>' +
      '<span class="rec-name">' + (i + 1) + '. ' + M.esc(stName(r.station)) + '</span>' +
      '<span class="rec-gain" title="' + M.esc(t('gap.gainTitle')) + '">' + gainHtml(r) + '</span></label></li>').join('');
    ol.querySelectorAll('input').forEach((cb) => cb.addEventListener('change', () => toggleFeeder(cb.dataset.station, cb.checked)));
  }

  function toggleFeeder(id, on) {
    if (on) chosenFeeders.add(id); else chosenFeeders.delete(id);
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
      const plannedOnly = LINES[line].status === 'planned' && !includePlanned();
      el('polyline', { class: 'track' + (plannedOnly ? ' planned-track' : ''), stroke: LINES[line].color,
        points: LINES[line].stations.map((id) => sxy(id).join(',')).join(' ') }, svg);
    });

    const feeders = new Set(G.feederList(state));
    state.stationIds.forEach((id) => {
      const [x, y] = sxy(id), lines = P.linesAt(id, { planned: includePlanned() }), on = feeders.has(id);
      const other = I.lang === 'mr' ? STATIONS[id][0] : STATIONS_MR[id];
      const c = el('circle', { cx: x, cy: y, r: on ? 7 : 4.5,
        class: 'stn' + (on ? ' feeder' : ''), stroke: LINES[lines[0]].color,
        tabindex: 0, role: 'button', 'aria-label': stName(id) + t(on ? 'gap.ariaOn' : 'gap.ariaAdd') }, svg);
      el('title', {}, c).textContent = stName(id) + (other ? ' · ' + other : '') + t(on ? 'gap.feederOn' : 'gap.feederAdd');
      const toggle = () => toggleFeeder(id, !on);
      c.addEventListener('click', toggle);
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      if (on) {
        const tx = el('text', { x: x + 10, y: y - 8, class: 'lbl feeder-lbl' }, svg);
        tx.textContent = '🚌 ' + stName(id);
      }
    });

    // Hubs: a diamond each. Names only for a single chosen hub; with all 12
    // the centre gets too crowded, so they show on hover instead.
    state.hubs.forEach((hb, j) => {
      if (h >= 0 && j !== h) return;
      const [x, y] = xy(hb);
      const d = el('rect', { x: x - 5, y: y - 5, width: 10, height: 10, transform: 'rotate(45 ' + x + ' ' + y + ')', class: 'hub' }, svg);
      el('title', {}, d).textContent = I.place(hb.name);
      if (h < 0) return;
      const tx = el('text', { x: x > W * 0.7 ? x - 10 : x + 10, y: y + 4, class: 'lbl hub-lbl', 'text-anchor': x > W * 0.7 ? 'end' : 'start' }, svg);
      tx.textContent = I.place(hb.name);
    });
  }

  /* ------------------------------------------------------------------
   * City report: every hub ranked, with the single best feeder for it.
   * One hub per tick so the page stays responsive.
   * ------------------------------------------------------------------ */
  let reportRun = 0;
  function buildReport() {
    const run = ++reportRun, rows = [], src = bare;
    reportRows = null;
    renderReport();
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
      reportRows = rows.sort((a, b) => a.good - b.good);
      renderReport();
    })();
  }

  function renderReport() {
    if (!reportRows) {
      $('#report-lead').textContent = t('rep.ranking');
      $('#report-body').innerHTML = '';
      return;
    }
    const worst = reportRows[0], best = reportRows[reportRows.length - 1];
    $('#report-lead').innerHTML = t('rep.lead', { worst: M.esc(I.place(worst.name)), when: when(),
      wpct: Math.round(worst.good), best: M.esc(I.place(best.name)), bpct: Math.round(best.good) });
    $('#report-body').innerHTML = reportRows.map((r) =>
      '<tr><td>' + M.esc(I.place(r.name)) + '</td>' +
      '<td class="pct good">' + Math.round(r.good) + '%</td>' +
      '<td class="pct poor">' + Math.round(r.poor) + '%</td>' +
      '<td>' + (r.feeder ? '🚌 ' + M.esc(stName(r.feeder.station)) + '<small>' + gainHtml(r.feeder) + '</small>'
        : '<span class="muted">' + t('rep.none') + '</span>') + '</td>' +
      '<td>' + (r.feeder ? '<span class="pct good">' + Math.round(r.feeder.goodPct) + '%</span> / <span class="pct poor">' +
        Math.round(r.feeder.poorPct) + '%</span>' : '–') + '</td></tr>').join('');
  }

  /* ------------------------------------------------------------------
   * Cell details
   * ------------------------------------------------------------------ */
  // Nearest named place within 2.5 km (an English name), or null.
  function nearestPlace(c) {
    let best = null;
    LANDMARKS.forEach(([name, lat, lng]) => {
      const d = P.haversineKm(c, { lat, lng });
      if (!best || d < best.d) best = { name, d };
    });
    state.stationIds.forEach((id) => {
      const d = P.haversineKm(c, P.station(id));
      if (!best || d < best.d) best = { name: STATIONS[id][0], d };
    });
    return best.d < 2.5 ? best.name : null;
  }

  function legText(leg) {
    if (leg.mode === 'none') return '';
    const icon = { walk: '🚶', auto: '🛺', feeder: '🚌', cycle: '🚲' }[leg.mode];
    return icon + ' ' + M.fmtKm(leg.km);
  }

  function showCell(i) {
    selected = i;
    const c = state.cells[i], h = hub(), near = nearestPlace(c);
    const title = near ? t('cell.near', { place: I.place(near) })
      : t('cell.around', { lat: c.lat.toFixed(3), lng: c.lng.toFixed(3) });
    const rows = state.hubs.map((hb, j) => ({ hb, j, t: state.trips[i][j] }))
      .filter((r) => (h < 0 || r.j === h));
    const body = rows.map(({ hb, t: trip }) => {
      if (!trip) return '<tr><td>' + M.esc(I.place(hb.name)) + '</td><td colspan="3" class="muted">' + t('cell.tooClose') + '</td></tr>';
      const m = trip.metro;
      return '<tr><td>' + M.esc(I.place(hb.name)) + '<small>' + legText(m.first) + ' · ' + M.esc(stName(m.from)) + ' → ' +
        M.esc(stName(m.to)) + ' · ' + legText(m.last) + '</small></td>' +
        '<td title="' + M.esc(t('kind.' + trip.kind)) + '">' + KIND_ICON[trip.kind] + '</td>' +
        '<td>' + M.fmtMin(m.min) + '<small>' + M.fmtRs(m.cost) + '</small></td>' +
        '<td>' + M.fmtMin(trip.auto.min) + '<small>' + M.fmtRs(trip.auto.cost) + '</small></td></tr>';
    }).join('');
    const box = $('#cell-info');
    box.innerHTML = '<div class="cell-head"><h3>' + M.esc(title) + '</h3>' +
      '<button type="button" class="link-btn" id="cell-close">' + t('cell.close') + '</button></div>' +
      '<table class="compare cell-table"><thead><tr><th>' + t('cell.to') + '</th><th></th><th>' + t('cell.metro') +
      '</th><th>' + t('cell.auto') + '</th></tr></thead><tbody>' + body + '</tbody></table>' +
      '<div class="rec-actions"><label class="small-label" for="cell-to">' + t('cell.planTo') + '</label>' +
      '<select id="cell-to">' + rows.filter((r) => r.t).map((r) =>
        '<option value="' + M.esc(r.hb.name) + '">' + M.esc(I.place(r.hb.name)) + '</option>').join('') + '</select>' +
      '<button type="button" class="primary small-btn" id="cell-plan">' + t('cell.open') + '</button></div>';
    box.hidden = false;
    $('#cell-close').addEventListener('click', () => { box.hidden = true; selected = null; render(); });
    const go = $('#cell-plan');
    if (!$('#cell-to').options.length) go.disabled = true;
    go.addEventListener('click', () => {
      const name = near ? I.place(near) : c.lat.toFixed(3) + ', ' + c.lng.toFixed(3);
      M.planFrom({ name, lat: c.lat, lng: c.lng }, I.place($('#cell-to').value));
    });
    render();
  }

  /* ------------------------------------------------------------------
   * Text that depends on the language
   * ------------------------------------------------------------------ */
  function translate() {
    const sel = $('#gap-hub'), current = sel.value || '-1';
    sel.innerHTML = '<option value="-1">' + M.esc(t('gap.allHubs', { n: HUBS.length })) + '</option>' +
      HUBS.map((name, j) => '<option value="' + j + '">' + M.esc(I.place(name)) + '</option>').join('');
    sel.value = current;
    $('#feeder-note').textContent = t('gap.feedersNote', { km: CONFIG.feeder.maxKm });
    $('#gap-hint').textContent = t('gap.hint', { km2: km2(G.cellKm2()) });
    $('#report-note').textContent = t('rep.note', { km: CONFIG.gapMap.minTripKm });
    $('#gap-legend').innerHTML = Object.keys(LINES).map((l) =>
      '<span><i style="background:' + LINES[l].color + '"></i>' + I.line(l) + '</span>').join('') +
      '<span><i class="hub-key"></i>' + t('gap.hubKey') + '</span>';
  }

  /* ------------------------------------------------------------------
   * Wiring
   * ------------------------------------------------------------------ */
  function start() {
    if (started) return;
    started = true;
    translate();
    $('#print-report').addEventListener('click', () => window.print());
    $('#gap-hub').addEventListener('change', () => {
      selected = null;
      $('#cell-info').hidden = true;
      refresh();
    });
    document.querySelectorAll('input[name=gap-time]').forEach((r) => r.addEventListener('change', rebuild));
    $('#include-line3').addEventListener('change', rebuild);
    $('#apply-all').addEventListener('click', () => {
      (recs || []).forEach((r) => { G.setFeeder(state, r.station, true); chosenFeeders.add(r.station); });
      render();
      renderRecs();
    });
    $('#reset-feeders').addEventListener('click', () => {
      G.feederList(state).forEach((id) => G.setFeeder(state, id, false));
      chosenFeeders.clear();
      render();
      renderRecs();
    });
    svg.addEventListener('click', (e) => {
      const i = e.target.dataset && e.target.dataset.i;
      if (i !== undefined) {
        showCell(+i);
        if (window.matchMedia('(max-width: 899px)').matches) $('#cell-info').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
    rebuild();
  }

  document.addEventListener('mm:view', (e) => { if (e.detail === 'gap') start(); });
  document.addEventListener('mm:lang', () => {
    if (!started) return;
    translate();
    render();
    renderRecs();
    renderReport();
    if (selected !== null && !$('#cell-info').hidden) showCell(selected);
  });
  if (M.view === 'gap') start();
})();
