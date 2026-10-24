(function () {
  'use strict';
  var D = MetroData, G = GapMap, I = I18N, t = I18N.t;
  var data = MetroPitchData.pitchNumbers();
  var bare = G.build({ peak: true });
  var state = G.build({ peak: true, feeders: data.feeders.map(function (f) { return f.station; }) });
  var map = document.getElementById('pitch-map'), ns = 'http://www.w3.org/2000/svg';
  var g = D.CONFIG.gapMap, K = Math.cos(((g.minLat + g.maxLat) / 2) * Math.PI / 180), W = 600;
  var scale = W / ((g.maxLng - g.minLng) * K), H = Math.round((g.maxLat - g.minLat) * scale);
  function xy(p) { return [(p.lng - g.minLng) * K * scale, (g.maxLat - p.lat) * scale]; }
  function stationXY(id) { return xy({ lat: D.STATIONS[id][1], lng: D.STATIONS[id][2] }); }
  function el(name, attrs, parent) {
    var n = document.createElementNS(ns, name);
    Object.keys(attrs || {}).forEach(function (key) { n.setAttribute(key, attrs[key]); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, value) { parent.textContent = value; return parent; }
  function pct(n) { return String(Math.round(n)); }

  function drawMap() {
    map.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    map.replaceChildren();
    var cw = g.step * K * scale, ch = g.step * scale;
    state.cells.forEach(function (cell, i) {
      var score = G.cellScore(state, i, -1), p = xy(cell);
      el('rect', { x: p[0] - cw / 2, y: p[1] - ch / 2, width: cw + .3, height: ch + .3, 'class': 'cell ' + G.band(score) }, map);
    });
    var radius = D.CONFIG.feeder.maxKm / D.CONFIG.roadFactor * scale / 111.32;
    G.feederList(state).forEach(function (id) {
      var p = stationXY(id); el('circle', { cx: p[0], cy: p[1], r: radius, 'class': 'catch' }, map);
    });
    Object.keys(D.LINES).forEach(function (line) {
      var info = D.LINES[line];
      if (info.status === 'planned') return;
      el('polyline', { 'class': 'track', stroke: info.color, points: info.stations.map(function (id) { return stationXY(id).join(','); }).join(' ') }, map);
    });
    var feeders = G.feederList(state);
    state.stationIds.forEach(function (id) {
      var p = stationXY(id), lines = MetroPlanner.linesAt(id);
      el('circle', { cx: p[0], cy: p[1], r: feeders.indexOf(id) >= 0 ? 6.5 : 4, 'class': 'stn' + (feeders.indexOf(id) >= 0 ? ' feeder' : ''), stroke: D.LINES[lines[0]].color }, map);
    });
    state.hubs.forEach(function (hub) {
      var p = xy(hub); el('rect', { x: p[0] - 4, y: p[1] - 4, width: 8, height: 8, transform: 'rotate(45 ' + p[0] + ' ' + p[1] + ')', 'class': 'hub' }, map);
    });
  }

  function render() {
    I.applyTo(document);
    document.getElementById('pitch-headline').textContent = t('pitch.headline', { pct: pct(data.basePct) });
    document.getElementById('pitch-after').textContent = t('pitch.feederHeadline', { pct: pct(data.withFeedersPct), n: data.feeders.length });
    document.querySelector('.feeders h2').textContent = t('pitch.topFeeders', { n: data.feeders.length });
    map.setAttribute('aria-label', t('pitch.mapLabel', { n: data.feeders.length }));
    document.querySelector('[data-i18n="pitch.fares"]').textContent = t('pitch.fares', { pairs: D.FARE_CODES.length * (D.FARE_CODES.length - 1) / 2 });
    var list = document.getElementById('pitch-feeders'); list.replaceChildren();
    data.feeders.forEach(function (r) {
      var li = document.createElement('li'), name = document.createElement('b'), gain = document.createElement('small');
      text(name, I.station(r.station)); text(gain, t('pitch.betterServed', { km2: r.gainKm2.toFixed(1) })); li.append(name, gain); list.appendChild(li);
    });
    text(document.getElementById('pitch-worst-name'), I.place(data.worst.hub));
    text(document.getElementById('pitch-worst-pct'), pct(data.worst.pct) + '%');
    text(document.getElementById('pitch-best-name'), I.place(data.best.hub));
    text(document.getElementById('pitch-best-pct'), pct(data.best.pct) + '%');
    text(document.getElementById('pitch-hinjewadi'), t('pitch.withoutLine3', { pct: pct(data.hinjewadi.pct) }));
    text(document.getElementById('pitch-line3'), t('pitch.withLine3', { pct: pct(data.hinjewadi.line3Pct) }));
    drawMap();
    var qr = qrcode(0, 'M'); qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    qr.addData(t('pitch.url')); qr.make();
    document.getElementById('pitch-qr').innerHTML = qr.createSvgTag({ cellSize: 3, margin: 1, scalable: true, title: t('pitch.scan') });
    document.documentElement.lang = I.lang;
    document.getElementById('pitch-lang').textContent = t('lang.switch');
  }
  document.getElementById('pitch-lang').addEventListener('click', function () { I.setLang(I.lang === 'en' ? 'mr' : 'en'); render(); });
  render();
})();
