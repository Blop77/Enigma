/*
 * story.js — story.html, a scroll-driven ride from PCMC to Swargate that
 * tells the MetroMitra pitch. Scrolling drives the train; it stops at seven
 * stations, and each stop shows one chapter.
 *
 * The scene (sky, hills, city, viaduct, train, traffic) is drawn on one
 * canvas from seeded random data, so it looks the same on every visit. Every
 * number comes from story-data.js, which runs the app's own engines.
 * Depends on data.js, i18n.js, planner.js, gapmap.js, story-data.js and
 * vendor/qrcode.js.
 */
(function () {
  'use strict';

  const { STATIONS, STATIONS_MR, LINES, HUBS, CONFIG } = MetroData;
  const I = I18N, t = I18N.t;
  const $ = (sel) => document.querySelector(sel);
  const LANG_KEY = 'metromitra-lang';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = $('#scene'), ctx = canvas.getContext('2d');
  const basics = MetroStory.basics();
  const trip = basics.trip;
  let gap = null;            // MetroStory.gap() result, from the worker

  /* ------------------------------------------------------------------
   * Small helpers
   * ------------------------------------------------------------------ */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, x) => a + (b - a) * x;
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmtMin = (m) => {
    m = Math.max(1, Math.round(m));
    if (m < 60) return m + ' ' + t('unit.min');
    return Math.floor(m / 60) + ' ' + t('unit.h') + ' ' + String(m % 60).padStart(2, '0') + ' ' + t('unit.min');
  };
  // Indian style: "61 lakh", "1.1 lakh", or below a lakh "44,400" (same as the Gap Map).
  const people = (n) => n >= 1e5 ? t('num.lakh', { n: n >= 1e6 ? Math.round(n / 1e5) : (n / 1e5).toFixed(1) })
    : (Math.round(n / 100) * 100).toLocaleString('en-IN');

  // Seeded random numbers, so the city is the same on every visit.
  function rng(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let r = Math.imul(seed ^ seed >>> 15, 1 | seed);
      r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }
  const hash = (a, b) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };

  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, x) => { const p = hex(a), q = hex(b); return 'rgb(' + p.map((v, i) => Math.round(lerp(v, q[i], x))).join(',') + ')'; };
  const mixHex = (a, b, x) => { const p = hex(a), q = hex(b); return '#' + p.map((v, i) => Math.round(lerp(v, q[i], x)).toString(16).padStart(2, '0')).join(''); };

  /* ------------------------------------------------------------------
   * The timeline: the train waits at each stop (a chapter) and travels
   * between them. Lengths are in screen heights of scrolling.
   * ------------------------------------------------------------------ */
  const STOPS = basics.stops;
  const PX_PER_KM = 3000;                 // world units per km of line (a coach is 300)
  const stopX = STOPS.map((id) => basics.lineKm[id] * PX_PER_KM);
  const lineStations = LINES[basics.line].stations.map((id) => ({ id, x: basics.lineKm[id] * PX_PER_KM, stop: STOPS.indexOf(id) }));
  const lineEnd = stopX[stopX.length - 1];
  const DWELL = [1.1, 1.3, 1.9, 1.9, 2.8, 2.2, 1.5];
  const TRAVEL = [1.7, 1.1, 0.8, 0.8, 0.8, 0.9];
  let segs = [], maxY = 1, unit = 1;

  function buildTimeline() {
    let y = 0;
    segs = [];
    STOPS.forEach((id, i) => {
      segs.push({ kind: 'dwell', stop: i, a: y, b: (y += DWELL[i] * unit) });
      if (i < STOPS.length - 1) segs.push({ kind: 'travel', from: i, to: i + 1, a: y, b: (y += TRAVEL[i] * unit) });
    });
    maxY = y;
    $('#spacer').style.height = Math.round(maxY + window.innerHeight) + 'px';
  }

  const dwellOf = (i) => segs[i * 2];

  // Where the train is for a scroll position: world x, speed (0..1) and
  // acceleration (-1..1) for the effects, and the current segment.
  function trainAt(y) {
    const seg = segs.find((s) => y < s.b) || segs[segs.length - 1];
    const q = clamp((y - seg.a) / (seg.b - seg.a));
    if (seg.kind === 'dwell') return { x: stopX[seg.stop], speed: 0, accel: 0, seg, q };
    const x0 = stopX[seg.from], x1 = stopX[seg.to];
    const e = (1 - Math.cos(Math.PI * q)) / 2;                    // ease in and out: pull away, brake in
    const v = Math.PI / 2 * Math.sin(Math.PI * q) * (x1 - x0) / (seg.b - seg.a) * unit;
    return { x: lerp(x0, x1, e), speed: clamp(v / 20000), accel: Math.cos(Math.PI * q) * clamp((x1 - x0) / 9000), seg, q };
  }

  /* ------------------------------------------------------------------
   * The city, generated once (world units; drawn scaled by S)
   * ------------------------------------------------------------------ */
  const PAR = { hills: 0.08, far: 0.25, near: 0.55, fg: 1.3 };
  const WADA_U = stopX[STOPS.indexOf('budhwar-peth')] * PAR.near + 300;      // Shaniwar Wada, near Budhwar Peth
  const PARVATI_U = stopX[STOPS.indexOf('swargate')] * PAR.hills - 640;      // Parvati Hill, beside Swargate
  const FACADES = ['#e9dcc3', '#f1c9a5', '#c9d6e3', '#e6e1d3', '#d8c0d6', '#f3e2b8', '#bfd3c6'];

  function buildings(par, minW, maxW, minH, maxH, seed, skip) {
    const r = rng(seed), out = [];
    for (let u = -2500; u < lineEnd * par + 2500;) {
      const w = lerp(minW, maxW, r()), h = lerp(minH, maxH, Math.pow(r(), 1.4));
      if (!skip || Math.abs(u + w / 2 - skip) > 420) {
        out.push({ u, w, h, seed: r() * 1000, facade: FACADES[Math.floor(r() * FACADES.length)], tank: r() < 0.45, mast: r() < 0.12 });
      }
      u += w + lerp(2, 26, r());
    }
    return out;
  }
  const FAR = buildings(PAR.far, 34, 90, 50, 210, 7);
  const NEAR = buildings(PAR.near, 70, 170, 80, 300, 11, WADA_U);
  const TREES = (() => {
    const r = rng(23), out = [];
    for (let u = -2500; u < lineEnd * PAR.fg + 2500; u += lerp(380, 1100, r())) out.push({ u, s: lerp(0.7, 1.2, r()), lamp: r() < 0.4 });
    return out;
  })();
  const STARS = (() => { const r = rng(5); return Array.from({ length: 140 }, () => [r(), r() * 0.62, r() * 1.4 + 0.4, r() * 6]); })();
  // Traffic under the viaduct: [lane, start, speed, kind]. Feeder e-buses join after the Gap Map chapter.
  const TRAFFIC = (() => {
    const r = rng(41), out = [];
    for (let i = 0; i < 26; i++) {
      const lane = i % 2, kind = i % 9 === 4 ? 'bus' : (r() < 0.72 ? 'auto' : 'car');
      out.push({ lane, x0: r() * 6000, v: (lane ? -1 : 1) * lerp(55, 110, r()), kind, color: ['#d23b3b', '#3a6fd8', '#e8e8e8', '#2f2f3a'][Math.floor(r() * 4)] });
    }
    return out;
  })();

  /* ------------------------------------------------------------------
   * Canvas
   * ------------------------------------------------------------------ */
  // AX: where the train sits across the screen; on wide screens it waits
  // to the right of the chapter cards.
  let W = 0, H = 0, S = 1, AX = 0, dpr = 1, narrow = false, coaches = 3, deckY = 0, groundY = 0;

  function resize() {
    const oldMax = maxY, oldY = window.scrollY;
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    narrow = W < 700;
    coaches = narrow ? 2 : 3;
    AX = narrow ? W / 2 : W * 0.63;
    S = clamp(Math.max(H / 1150, W / 1800), 0.55, 1.15);
    deckY = H * (narrow ? 0.79 : 0.74);
    groundY = deckY + 130 * S;
    // Mobile browsers resize as the address bar hides; only re-time the
    // story when the size really changes, so the page doesn't jump.
    const newUnit = Math.max(H, 480);
    if (!segs.length || Math.abs(newUnit - unit) > 150 || resize.w !== W) {
      unit = newUnit;
      resize.w = W;
      buildTimeline();
      if (oldMax > 1) window.scrollTo(0, oldY / oldMax * maxY);
    }
    sizeMinimap();
    dirty = true;
  }

  // Sky colours through the day: [hour, top, horizon].
  const SKY = [[7, '#3a4f8f', '#f7b48a'], [8.5, '#5fa3e6', '#d3ebff'], [12, '#3e8de0', '#c4e3ff'],
    [16, '#4f86cf', '#ffe0b0'], [17.8, '#4a3f95', '#ff9a62'], [18.8, '#2a2a6a', '#d0607c'],
    [19.8, '#141a48', '#3d3470'], [23, '#070b22', '#161b3d']];
  function skyAt(h) {
    let i = 0;
    while (i < SKY.length - 2 && h > SKY[i + 1][0]) i++;
    const [h0, t0, b0] = SKY[i], [h1, t1, b1] = SKY[i + 1], x = clamp((h - h0) / (h1 - h0));
    return [mixHex(t0, t1, x), mixHex(b0, b1, x)];
  }
  const darkness = (h) => h < 8.2 ? lerp(0.3, 0, clamp((h - 7.5) / 0.7)) : smooth((h - 16.8) / 3.2);
  const dusk = (h) => Math.exp(-Math.pow((h - 18.2) / 1.1, 2));

  function drawSky(h, d, now) {
    const [top, bottom] = skyAt(h);
    const g = ctx.createLinearGradient(0, 0, 0, deckY);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const starA = smooth((h - 19.3) / 1.2);
    if (starA > 0) {
      ctx.fillStyle = '#ffffff';
      STARS.forEach(([x, y, r, ph]) => {
        ctx.globalAlpha = starA * (reduced ? 0.8 : 0.55 + 0.45 * Math.sin(now * 1.7 + ph));
        ctx.fillRect(x * W, y * H, r, r);
      });
      ctx.globalAlpha = 1;
    }
    // The sun crosses the sky; the moon rises after sunset.
    const a = (h - 6.6) / (19.1 - 6.6);
    if (a > 0 && a < 1) {
      const x = W * (0.12 + 0.76 * a), y = deckY - Math.sin(Math.PI * a) * (deckY - 90 * S) + 30 * S;
      const col = mixHex('#fff3c4', '#ff7a45', clamp(dusk(h) * 1.3));
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 140 * S);
      glow.addColorStop(0, col); glow.addColorStop(0.25, col + '88'); glow.addColorStop(1, col + '00');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 140 * S, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 30 * S, 0, 7); ctx.fill();
    }
    const m = smooth((h - 19.3) / 1.6);
    if (m > 0) {
      const x = W * 0.8, y = lerp(deckY * 0.7, H * 0.17, m);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 90 * S);
      glow.addColorStop(0, 'rgba(245,240,220,.35)'); glow.addColorStop(1, 'rgba(245,240,220,0)');
      ctx.globalAlpha = m; ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 90 * S, 0, 7); ctx.fill();
      ctx.fillStyle = '#f2eedc'; ctx.beginPath(); ctx.arc(x, y, 22 * S, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.arc(x - 6 * S, y - 4 * S, 5 * S, 0, 7); ctx.arc(x + 7 * S, y + 6 * S, 4 * S, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Screen x of something at layer position u in a layer with parallax par.
  const sx = (u, par, camX) => AX + (u - camX * par) * S;

  function ridge(u) {
    const base = 70 + 38 * Math.sin(u * 0.0021 + 1.3) + 26 * Math.sin(u * 0.0057 + 0.4) + 12 * Math.sin(u * 0.013);
    return base + 120 * Math.exp(-Math.pow((u - PARVATI_U) / 150, 2));   // Parvati Hill
  }

  function drawHills(camX, h, d) {
    const baseY = deckY - 20 * S;
    ctx.fillStyle = mix(mixHex('#93acc6', '#7d6f9f', dusk(h)), '#161b38', d);
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, baseY - ridge((x - AX) / S + camX * PAR.hills) * S);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    // Parvati's temples on the hilltop, lit at night.
    const px = sx(PARVATI_U, PAR.hills, camX);
    if (px > -100 && px < W + 100) {
      const top = baseY - ridge(PARVATI_U) * S;
      [[-26, 0.7], [0, 1], [24, 0.6]].forEach(([dx, k]) => {
        const x = px + dx * S, w = 12 * S * k, hh = 34 * S * k;
        ctx.beginPath();
        ctx.moveTo(x - w, top + 2 * S); ctx.lineTo(x - w * 0.8, top - hh * 0.4); ctx.lineTo(x, top - hh);
        ctx.lineTo(x + w * 0.8, top - hh * 0.4); ctx.lineTo(x + w, top + 2 * S); ctx.closePath(); ctx.fill();
        if (d > 0.3) {
          ctx.fillStyle = 'rgba(255,200,120,' + (d * 0.9).toFixed(2) + ')';
          ctx.fillRect(x - 1.5 * S, top - hh * 0.35, 3 * S, 4 * S);
          ctx.fillStyle = mix(mixHex('#93acc6', '#7d6f9f', dusk(h)), '#161b38', d);
        }
      });
    }
  }

  function drawWindows(x, y, w, h, seed, d, k, near) {
    const lit = d * (near ? 0.6 : 0.5);
    const cw = (near ? 13 : 8) * S * k, ch = (near ? 16 : 10) * S * k;
    const cols = Math.max(1, Math.floor((w - 8 * S * k) / cw)), rows = Math.floor((h - 14 * S * k) / ch);
    const ox = x + (w - cols * cw) / 2 + cw * 0.25;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = hash(seed + c, r);
        if (d > 0.05) {
          if (v > lit) continue;
          ctx.fillStyle = v < lit * 0.15 ? '#bfe3ff' : (v < lit * 0.5 ? '#ffd58a' : '#ffe9b8');
        } else {
          if (!near) return;
          ctx.fillStyle = 'rgba(40,60,90,.18)';
        }
        ctx.fillRect(ox + c * cw, y + 10 * S * k + r * ch, cw * 0.5, ch * 0.55);
      }
    }
  }

  function drawCity(list, par, k, camX, h, d, near) {
    const baseY = near ? groundY + 2 * S : groundY - 26 * S;
    const dayFar = mixHex('#a4b9d1', '#9a8fb5', dusk(h));
    list.forEach((b) => {
      const x = sx(b.u, par, camX), w = b.w * S * k, hh = b.h * S * k;
      if (x + w < 0 || x > W) return;
      const y = baseY - hh;
      ctx.fillStyle = near ? mix(mixHex(b.facade, '#b9a3a0', dusk(h) * 0.5), '#10142c', d * 0.92) : mix(dayFar, '#1b2142', d);
      ctx.fillRect(x, y, w, hh);
      if (near) {
        ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(x + w * 0.82, y, w * 0.18, hh);   // shaded side
        if (b.tank) {                                                                    // rooftop water tank
          ctx.fillStyle = mix('#2c2f36', '#07080f', d);
          ctx.fillRect(x + w * 0.62, y - 12 * S * k, 16 * S * k, 12 * S * k);
        }
      }
      if (b.mast) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + w * 0.3, y - 26 * S * k, 2 * S, 26 * S * k); }
      drawWindows(x, y, w, hh, b.seed, d, k, near);
    });
  }

  // Shaniwar Wada: the fort wall, bastions, Delhi Gate and its saffron flag.
  function drawWada(camX, h, d) {
    const cx = sx(WADA_U, PAR.near, camX), k = 0.55 * S;
    if (cx < -500 * k || cx > W + 500 * k) return;
    const baseY = groundY + 2 * S, stone = mix(mixHex('#c7a173', '#b07a6a', dusk(h) * 0.6), '#2a1f33', d * 0.85);
    ctx.fillStyle = stone;
    ctx.fillRect(cx - 420 * k, baseY - 110 * k, 840 * k, 110 * k);
    for (let i = -420; i < 420; i += 22) {                                   // battlements
      ctx.beginPath(); ctx.arc(cx + (i + 11) * k, baseY - 110 * k, 9 * k, Math.PI, 0); ctx.fill();
    }
    [-420, -170, 170, 420].forEach((dx) => {                                 // bastions
      ctx.fillRect(cx + dx * k - 38 * k, baseY - 150 * k, 76 * k, 150 * k);
      ctx.beginPath(); ctx.arc(cx + dx * k, baseY - 150 * k, 38 * k, Math.PI, 0); ctx.fill();
    });
    ctx.fillRect(cx - 80 * k, baseY - 175 * k, 160 * k, 175 * k);            // gate house
    ctx.fillStyle = mix('#3b2a22', '#0b0710', d);
    ctx.beginPath(); ctx.moveTo(cx - 34 * k, baseY); ctx.lineTo(cx - 34 * k, baseY - 80 * k);
    ctx.quadraticCurveTo(cx, baseY - 128 * k, cx + 34 * k, baseY - 80 * k); ctx.lineTo(cx + 34 * k, baseY); ctx.fill();
    ctx.fillStyle = mix('#5a4a3a', '#1b1420', d);
    ctx.fillRect(cx - 1.5 * k, baseY - 250 * k, 3 * k, 75 * k);
    ctx.fillStyle = '#f08a24';
    ctx.beginPath(); ctx.moveTo(cx + 1.5 * k, baseY - 250 * k); ctx.lineTo(cx + 46 * k, baseY - 236 * k); ctx.lineTo(cx + 1.5 * k, baseY - 222 * k); ctx.fill();
    if (d > 0.2) {                                                           // warm floodlights at night
      const g = ctx.createLinearGradient(0, baseY - 150 * k, 0, baseY);
      g.addColorStop(0, 'rgba(255,170,80,0)'); g.addColorStop(1, 'rgba(255,170,80,' + (0.35 * d).toFixed(2) + ')');
      ctx.fillStyle = g; ctx.fillRect(cx - 440 * k, baseY - 150 * k, 880 * k, 150 * k);
    }
  }

  function drawVehicle(v, x, y, d) {
    const k = S * (v.lane ? 1 : 0.86), dir = v.v > 0 ? 1 : -1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir * k, k);
    if (v.kind === 'auto') {
      ctx.fillStyle = '#1b1b1f'; ctx.fillRect(-22, -34, 40, 16);                 // black canopy
      ctx.fillStyle = mix('#f5c400', '#6b5a10', d * 0.6); ctx.fillRect(-22, -18, 40, 12);
      ctx.beginPath(); ctx.moveTo(18, -34); ctx.lineTo(26, -14); ctx.lineTo(26, -6); ctx.lineTo(18, -6); ctx.fill();
      ctx.fillStyle = mix('#2f8f4e', '#174428', d * 0.6); ctx.fillRect(-22, -8, 48, 4);
      ctx.fillStyle = '#111'; [-14, 20].forEach((wx) => { ctx.beginPath(); ctx.arc(wx, -3, 5, 0, 7); ctx.fill(); });
    } else if (v.kind === 'car') {
      ctx.fillStyle = mix(v.color, '#141420', d * 0.6);
      ctx.beginPath(); ctx.moveTo(-34, -6); ctx.lineTo(-34, -18); ctx.lineTo(-18, -20); ctx.lineTo(-8, -32); ctx.lineTo(16, -32);
      ctx.lineTo(26, -20); ctx.lineTo(36, -16); ctx.lineTo(36, -6); ctx.fill();
      ctx.fillStyle = 'rgba(160,200,230,.7)'; ctx.fillRect(-6, -29, 10, 9); ctx.fillRect(7, -29, 9, 9);
      ctx.fillStyle = '#111'; [-20, 22].forEach((wx) => { ctx.beginPath(); ctx.arc(wx, -4, 6, 0, 7); ctx.fill(); });
    } else {                                                                      // ₹10 feeder e-bus
      ctx.fillStyle = mix('#1f9e5a', '#0d4a2a', d * 0.5); ctx.fillRect(-60, -46, 120, 40);
      ctx.fillStyle = d > 0.3 ? '#ffe7a8' : 'rgba(190,225,240,.85)';
      for (let i = -52; i < 44; i += 18) ctx.fillRect(i, -40, 14, 13);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-56, -22, 112, 3);
      ctx.fillStyle = '#111'; [-38, 38].forEach((wx) => { ctx.beginPath(); ctx.arc(wx, -5, 7, 0, 7); ctx.fill(); });
    }
    if (d > 0.3) {                                                                // headlights
      const g = ctx.createLinearGradient(26, 0, 110, 0);
      g.addColorStop(0, 'rgba(255,240,190,' + (0.45 * d).toFixed(2) + ')'); g.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(26, -14); ctx.lineTo(110, -26); ctx.lineTo(110, 6); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawStreet(camX, d, now, buses) {
    ctx.fillStyle = mix('#8f95a0', '#22253a', d); ctx.fillRect(0, groundY, W, 10 * S);       // footpath
    ctx.fillStyle = mix('#5c626e', '#151826', d); ctx.fillRect(0, groundY + 10 * S, W, H);   // road
    ctx.fillStyle = mix('#e9e4d0', '#5a5a6a', d);
    const laneY = groundY + 10 * S + (H - groundY) * 0.45, dash = 70 * S, off = ((camX * S) % (dash * 2) + dash * 2) % (dash * 2);
    for (let x = -off; x < W; x += dash * 2) ctx.fillRect(x, laneY, dash, 3 * S);
    TRAFFIC.forEach((v) => {
      if (v.kind === 'bus' && buses <= 0) return;
      const P = 6000, base = v.x0 + (reduced ? 0 : v.v * now);
      const rel = ((base - camX) % P + P * 1.5) % P - P / 2;
      const x = AX + rel * S, y = v.lane ? H - 4 * S : laneY - 6 * S;
      if (x < -150 || x > W + 150) return;
      ctx.globalAlpha = v.kind === 'bus' ? buses : 1;
      drawVehicle(v, x, y, d);
      ctx.globalAlpha = 1;
    });
  }

  const PILLAR_GAP = 210, MAST_GAP = 420;
  function drawViaduct(camX, d) {
    const concrete = mix('#d5d0c8', '#2e3045', d);
    const first = Math.floor((camX - AX / S) / PILLAR_GAP) - 1;
    for (let i = first; i * PILLAR_GAP < camX + (W - AX) / S + PILLAR_GAP; i++) {
      const x = AX + (i * PILLAR_GAP - camX) * S;
      ctx.fillStyle = mix('#bdb7ae', '#24263a', d);
      ctx.fillRect(x - 13 * S, deckY + 20 * S, 26 * S, groundY + 40 * S - deckY);
      ctx.fillStyle = concrete;
      ctx.beginPath(); ctx.moveTo(x - 40 * S, deckY + 22 * S); ctx.lineTo(x + 40 * S, deckY + 22 * S);
      ctx.lineTo(x + 14 * S, deckY + 46 * S); ctx.lineTo(x - 14 * S, deckY + 46 * S); ctx.fill();
    }
    ctx.fillStyle = concrete; ctx.fillRect(0, deckY, W, 24 * S);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, deckY + 16 * S, W, 8 * S);
    ctx.fillStyle = mix('#7a7f8c', '#4b4f66', d); ctx.fillRect(0, deckY - 3 * S, W, 3 * S);      // rail
    if (d > 0.4) {                                                                               // deck lights
      ctx.fillStyle = 'rgba(160,120,255,' + ((d - 0.4) * 0.9).toFixed(2) + ')';
      ctx.fillRect(0, deckY + 24 * S, W, 2 * S);
    }
  }

  const COACH = 300, COACH_H = 92, COACH_GAP = 12;
  const trainTop = () => deckY - 6 * S - COACH_H * S;
  const wireY = () => trainTop() - 34 * S;

  function drawMasts(camX, d) {
    ctx.strokeStyle = mix('#8d8f99', '#3b3e55', d); ctx.lineWidth = 3 * S;
    const first = Math.floor((camX - AX / S) / MAST_GAP) - 1;
    for (let i = first; i * MAST_GAP < camX + (W - AX) / S + MAST_GAP; i++) {
      const x = AX + (i * MAST_GAP + 100 - camX) * S;
      ctx.beginPath(); ctx.moveTo(x, deckY); ctx.lineTo(x, wireY() - 18 * S); ctx.lineTo(x + 26 * S, wireY() - 18 * S); ctx.stroke();
    }
    ctx.lineWidth = 1.2 * S; ctx.beginPath(); ctx.moveTo(0, wireY()); ctx.lineTo(W, wireY()); ctx.stroke();
  }

  const STATION_LEN = 1080;
  function drawStation(st, camX, d, front) {
    const cx = AX + (st.x - camX) * S, half = STATION_LEN / 2 * S;
    if (cx + half + 40 < 0 || cx - half - 40 > W) return;
    const roofY = trainTop() - 92 * S;
    if (!front) {
      // Back wall (glass), lit from inside at night.
      ctx.fillStyle = mix('#cfdbe8', '#2b3352', d); ctx.fillRect(cx - half, roofY, half * 2, deckY - roofY);
      ctx.fillStyle = 'rgba(255,214,150,' + (d * 0.35).toFixed(2) + ')'; ctx.fillRect(cx - half, roofY, half * 2, deckY - roofY);
      ctx.fillStyle = mix('#9fb0c4', '#1e2440', d);
      for (let x = cx - half; x < cx + half; x += 60 * S) ctx.fillRect(x, roofY, 3 * S, deckY - roofY);
      ctx.fillStyle = mix('#b8bcc8', '#2a2d44', d);                          // roof supports
      [-1, 1].forEach((side) => ctx.fillRect(cx + side * (half + 10 * S) - 5 * S, roofY, 10 * S, deckY - roofY));
      // Concourse under the deck.
      ctx.fillStyle = mix('#e4e2ea', '#262a43', d); ctx.fillRect(cx - 260 * S, deckY + 24 * S, 520 * S, groundY - deckY - 24 * S);
      ctx.fillStyle = d > 0.3 ? 'rgba(255,220,160,.55)' : 'rgba(80,110,150,.3)';
      for (let x = cx - 240 * S; x < cx + 230 * S; x += 40 * S) ctx.fillRect(x, deckY + 40 * S, 30 * S, (groundY - deckY) * 0.45);
      return;
    }
    // Roof: a curved canopy with the line's colour on its edge.
    ctx.fillStyle = mix('#eeedf3', '#3a3658', d);
    ctx.beginPath(); ctx.moveTo(cx - half - 30 * S, roofY);
    ctx.quadraticCurveTo(cx, roofY - 70 * S, cx + half + 30 * S, roofY);
    ctx.lineTo(cx + half + 30 * S, roofY + 12 * S); ctx.lineTo(cx - half - 30 * S, roofY + 12 * S); ctx.fill();
    ctx.fillStyle = LINES[basics.line].color; ctx.fillRect(cx - half - 30 * S, roofY + 8 * S, half * 2 + 60 * S, 5 * S);
    // Name board, Marathi above English as on the platforms.
    [-0.55, 0.55].forEach((pos) => {
      const bx = cx + pos * half, bw = Math.max(210 * S, 150), bh = 52 * S, by = roofY + 18 * S;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(bx - bw / 2 + 3, by + 3, bw, bh);
      ctx.fillStyle = '#3c1d5c'; ctx.fillRect(bx - bw / 2, by, bw, bh);
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
      ctx.font = '700 ' + Math.round(20 * S) + 'px system-ui, "Noto Sans Devanagari", sans-serif';
      ctx.fillText(STATIONS_MR[st.id] || STATIONS[st.id][0], bx, by + 23 * S);
      ctx.font = '600 ' + Math.round(14 * S) + 'px system-ui, sans-serif';
      ctx.fillText(STATIONS[st.id][0], bx, by + 43 * S);
      ctx.textAlign = 'start';
    });
  }

  function drawTrain(lag, open, d, x) {
    const n = coaches, len = (n * COACH + (n - 1) * COACH_GAP) * S, left = AX + lag - len / 2;
    const top = trainTop(), ch = COACH_H * S;
    // Pantograph up to the wire.
    const px = left + ((n === 3 ? 1 : 0) * (COACH + COACH_GAP) + COACH * 0.5) * S;
    ctx.strokeStyle = mix('#555a66', '#8a8fa6', d); ctx.lineWidth = 2 * S;
    const mid = (top + wireY()) / 2;
    ctx.beginPath();
    ctx.moveTo(px - 14 * S, top); ctx.lineTo(px - 20 * S, mid); ctx.lineTo(px, wireY() + 2 * S);
    ctx.lineTo(px + 20 * S, mid); ctx.lineTo(px + 14 * S, top);
    ctx.moveTo(px - 24 * S, wireY() + 2 * S); ctx.lineTo(px + 24 * S, wireY() + 2 * S); ctx.stroke();
    if (d > 0.4) {                                                                     // headlight beam
      const hx = left + len, g = ctx.createLinearGradient(hx, 0, hx + 320 * S, 0);
      g.addColorStop(0, 'rgba(255,245,210,' + (0.5 * d).toFixed(2) + ')'); g.addColorStop(1, 'rgba(255,245,210,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(hx, top + ch * 0.7); ctx.lineTo(hx + 320 * S, top + ch * 0.4);
      ctx.lineTo(hx + 320 * S, deckY + 4 * S); ctx.lineTo(hx, top + ch * 0.85); ctx.fill();
    }
    for (let c = 0; c < n; c++) {
      const cx = left + c * (COACH + COACH_GAP) * S, cw = COACH * S;
      const nose = c === n - 1 ? 1 : 0, tail = c === 0 ? 1 : 0;
      if (c > 0) { ctx.fillStyle = '#2a2d36'; ctx.fillRect(cx - COACH_GAP * S, top + 16 * S, COACH_GAP * S, ch - 26 * S); }
      // Body with sloped cab ends.
      const g = ctx.createLinearGradient(0, top, 0, top + ch);
      g.addColorStop(0, mix('#fbfbfd', '#9da2b6', d * 0.6)); g.addColorStop(1, mix('#c7ccd6', '#585d73', d * 0.6));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx + (tail ? 26 * S : 0), top);
      ctx.lineTo(cx + cw - (nose ? 26 * S : 0), top);
      if (nose) { ctx.quadraticCurveTo(cx + cw + 6 * S, top + 8 * S, cx + cw + 8 * S, top + ch * 0.55); ctx.lineTo(cx + cw + 8 * S, top + ch); }
      else ctx.lineTo(cx + cw, top + ch);
      if (tail) { ctx.lineTo(cx - 8 * S, top + ch); ctx.lineTo(cx - 8 * S, top + ch * 0.55); ctx.quadraticCurveTo(cx - 6 * S, top + 8 * S, cx + 26 * S, top); }
      else ctx.lineTo(cx, top + ch);
      ctx.closePath(); ctx.fill();
      // Window band, warm and full of people at night.
      ctx.fillStyle = mix('#28324a', '#1a1d2c', d); ctx.fillRect(cx + 8 * S, top + 16 * S, cw - 16 * S, 34 * S);
      for (let w = 0; w < 6; w++) {
        const wx = cx + (16 + w * 47) * S;
        if (w === 1 || w === 4) continue;                                        // doors go here
        const wg = ctx.createLinearGradient(0, top + 18 * S, 0, top + 48 * S);
        wg.addColorStop(0, mix('#6f86a8', '#ffe2a6', d)); wg.addColorStop(1, mix('#3b4a66', '#f3c77e', d));
        ctx.fillStyle = wg; ctx.fillRect(wx, top + 19 * S, 38 * S, 28 * S);
        ctx.fillStyle = 'rgba(20,22,35,' + (0.25 + 0.5 * d).toFixed(2) + ')';
        for (let p = 0; p < 2; p++) {
          if (hash(c * 10 + w, p) > 0.55) continue;
          const hx = wx + (10 + p * 18) * S;
          ctx.beginPath(); ctx.arc(hx, top + 34 * S, 4.5 * S, 0, 7); ctx.fill();
          ctx.fillRect(hx - 7 * S, top + 39 * S, 14 * S, 8 * S);
        }
      }
      // Doors slide open at the stations.
      [1, 4].forEach((w) => {
        const dx = cx + (16 + w * 47) * S, dw = 38 * S, gapW = dw * 0.9 * open;
        ctx.fillStyle = mix('#dfe3ea', '#7e8398', d * 0.6); ctx.fillRect(dx, top + 12 * S, dw, ch - 24 * S);
        if (gapW > 0.5) {
          ctx.fillStyle = mix('#fff4dc', '#ffdc96', d); ctx.fillRect(dx + (dw - gapW) / 2, top + 13 * S, gapW, ch - 26 * S);
        }
        ctx.strokeStyle = 'rgba(40,40,60,.35)'; ctx.lineWidth = 1;
        ctx.strokeRect(dx + (dw - gapW) / 2 - dw / 2 + 0.5, top + 12 * S, dw / 2, ch - 24 * S);
        ctx.strokeRect(dx + (dw + gapW) / 2 - 0.5, top + 12 * S, dw / 2, ch - 24 * S);
      });
      // Line stripes.
      ctx.fillStyle = LINES.purple.color; ctx.fillRect(cx + (tail ? -6 : 0) * S, top + 56 * S, cw + (nose + tail) * 6 * S, 8 * S);
      ctx.fillStyle = LINES.aqua.color; ctx.fillRect(cx + (tail ? -6 : 0) * S, top + 66 * S, cw + (nose + tail) * 6 * S, 3 * S);
      // Underframe and bogies.
      ctx.fillStyle = '#23252e'; ctx.fillRect(cx + 4 * S, top + ch - 8 * S, cw - 8 * S, 8 * S);
      [0.18, 0.82].forEach((f) => {
        const bx = cx + cw * f;
        ctx.fillStyle = '#30333d'; ctx.fillRect(bx - 30 * S, top + ch - 4 * S, 60 * S, 8 * S);
        [-16, 16].forEach((o) => {
          ctx.fillStyle = '#15161c'; ctx.beginPath(); ctx.arc(bx + o * S, top + ch + 2 * S, 7 * S, 0, 7); ctx.fill();
          const a = x / 7 + o;                                                     // spokes turn with distance
          ctx.strokeStyle = '#5b5f6b'; ctx.lineWidth = 1.2 * S; ctx.beginPath();
          ctx.moveTo(bx + o * S - Math.cos(a) * 5 * S, top + ch + 2 * S - Math.sin(a) * 5 * S);
          ctx.lineTo(bx + o * S + Math.cos(a) * 5 * S, top + ch + 2 * S + Math.sin(a) * 5 * S); ctx.stroke();
        });
      });
      if (nose) {                                                                  // windscreen, destination, headlight
        ctx.fillStyle = mix('#33405c', '#1b2032', d);
        ctx.beginPath(); ctx.moveTo(cx + cw - 20 * S, top + 12 * S); ctx.quadraticCurveTo(cx + cw + 2 * S, top + 14 * S, cx + cw + 5 * S, top + 46 * S);
        ctx.lineTo(cx + cw - 20 * S, top + 46 * S); ctx.fill();
        ctx.fillStyle = '#ffb347'; ctx.fillRect(cx + cw - 16 * S, top + 18 * S, 14 * S, 4 * S);
        ctx.fillStyle = d > 0.3 ? '#fffbe6' : '#f4f1e6'; ctx.beginPath(); ctx.ellipse(cx + cw + 3 * S, top + ch * 0.78, 4 * S, 3 * S, 0, 0, 7); ctx.fill();
      }
      if (tail) { ctx.fillStyle = '#d6372e'; ctx.beginPath(); ctx.ellipse(cx - 4 * S, top + ch * 0.78, 3 * S, 2.5 * S, 0, 0, 7); ctx.fill(); }
    }
  }

  function drawForeground(camX, d) {
    TREES.forEach((tr) => {
      const x = sx(tr.u, PAR.fg, camX), k = tr.s * S * 1.15;
      if (x < -200 || x > W + 200) return;
      if (tr.lamp) {
        const lh = Math.min(170 * k, H - deckY - 40 * S);
        ctx.fillStyle = mix('#3c3f4a', '#0c0d14', d); ctx.fillRect(x - 3 * k, H - lh, 6 * k, lh);
        ctx.fillRect(x - 3 * k, H - lh, 46 * k, 5 * k);
        if (d > 0.3) {
          const g = ctx.createRadialGradient(x + 40 * k, H - lh + 10 * k, 0, x + 40 * k, H - lh + 10 * k, 90 * k);
          g.addColorStop(0, 'rgba(255,215,140,' + (0.55 * d).toFixed(2) + ')'); g.addColorStop(1, 'rgba(255,215,140,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 40 * k, H - lh + 10 * k, 90 * k, 0, 7); ctx.fill();
        }
        return;
      }
      ctx.fillStyle = mix('#2d5a3a', '#070d0b', d * 0.9);
      ctx.fillRect(x - 5 * k, H - 70 * k, 10 * k, 70 * k);
      [[0, -110, 60], [-44, -80, 44], [44, -84, 46], [0, -150, 40]].forEach(([ox, oy, r]) => {
        ctx.beginPath(); ctx.arc(x + ox * k, H + oy * k, r * k, 0, 7); ctx.fill();
      });
    });
  }

  function drawStreaks(speed, camX) {
    if (speed < 0.2 || reduced) return;
    ctx.strokeStyle = 'rgba(255,255,255,' + ((speed - 0.2) * 0.35).toFixed(2) + ')';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 16; i++) {
      const y = lerp(trainTop() - 140 * S, deckY + 60 * S, hash(i, 3)), len = (80 + 260 * hash(i, 5)) * speed * S;
      const x = ((hash(i, 7) * (W + 400) - camX * S * 1.7) % (W + 400) + (W + 400)) % (W + 400) - 200;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    }
  }

  /* ------------------------------------------------------------------
   * Chapters (DOM)
   * ------------------------------------------------------------------ */
  const chapters = Array.from(document.querySelectorAll('.chapter'));
  const dim = $('#dim');
  const cache = new Map();
  // Only touch the DOM when a value changes.
  function set(el, prop, value) {
    const key = el.id + '|' + prop + '|' + (el.dataset.stop || el.dataset.count || '');
    if (cache.get(key) === value) return;
    cache.set(key, value);
    if (prop === 'text') el.textContent = value;
    else if (prop === 'html') el.innerHTML = value;
    else el.style.setProperty(prop, value);
  }

  function chapterState(i, y) {
    const seg = dwellOf(i), h = unit;
    const appear = i === 0 ? 1 : smooth((y - (seg.a - 0.3 * h)) / (0.38 * h));
    const leave = i === STOPS.length - 1 ? 1 : 1 - smooth((y - (seg.b - 0.05 * h)) / (0.4 * h));
    return { vis: Math.min(appear, leave), appear, leave, ap: clamp((y - seg.a + 0.35 * h) / (seg.b - seg.a)) };
  }

  // Chapter 1: count up the network facts.
  function animStats(ap) {
    const n = basics.network, f = smooth(ap * 2.4);
    document.querySelectorAll('[data-count]').forEach((el) => {
      const target = { km: n.km, stations: n.stations, headway: n.peakHeadwayMin }[el.dataset.count];
      set(el, 'text', String(Math.round(target * (el.dataset.count === 'headway' ? 1 : f))));
    });
  }

  // Chapter 2: a race between the metro trip (auto + metro + auto) and an auto all the way.
  const legs = () => {
    const m = trip.metro;
    return [m.first.mode !== 'none' && { kind: m.first.mode, min: m.first.min, cost: m.first.cost },
      { kind: 'metro', min: m.ride.min, cost: m.fare },
      m.last.mode !== 'none' && { kind: m.last.mode, min: m.last.min, cost: m.last.cost }].filter(Boolean);
  };
  const ICON = { auto: '🛺', walk: '🚶', cycle: '🚲', metro: '🚇' };
  function renderRace() {
    const m = trip.metro, max = Math.max(m.min, trip.auto.min);
    let at = 0;
    const segsHtml = legs().map((l) => {
      const html = '<i class="leg ' + (l.kind === 'metro' ? 'metro' : 'road') + '" style="left:' + (at / max * 100) + '%;width:' + (l.min / max * 100) + '%">' + ICON[l.kind] + '</i>';
      at += l.min;
      return html;
    }).join('');
    const legend = [
      m.first.mode !== 'none' && t('story.c2.first', { icon: ICON[m.first.mode], station: esc(I.station(m.first.station)) }) + ' · ' + fmtMin(m.first.min) + ' · ₹' + m.first.cost,
      t('story.c2.ride', { from: esc(I.station(m.ride.from)), to: esc(I.station(m.ride.to)) }) + ' · ' + fmtMin(m.ride.min) + ' · ₹' + m.fare,
      m.last.mode !== 'none' && t('story.c2.last', { icon: ICON[m.last.mode], station: esc(I.station(m.last.station)) }) + ' · ' + fmtMin(m.last.min) + ' · ₹' + m.last.cost
    ].filter(Boolean).map((s) => '<li>' + s + '</li>').join('');
    $('#race').innerHTML =
      '<div class="race-row"><span class="race-label">' + t('story.c2.metro') + '</span><div class="track"><div class="fill" id="race-metro">' + segsHtml +
      '</div></div><span class="race-end" id="race-metro-end">' + fmtMin(m.min) + ' · ₹' + m.cost + '</span></div>' +
      '<ul class="race-legs">' + legend + '</ul>' +
      '<div class="race-row"><span class="race-label">' + t('story.c2.auto') + '</span><div class="track"><div class="fill" id="race-auto"><i class="leg road" style="left:0;width:' +
      (trip.auto.min / max * 100) + '%">🛺</i></div></div><span class="race-end" id="race-auto-end">' + fmtMin(trip.auto.min) + ' · ₹' + trip.auto.cost + '</span></div>';
    cache.clear();
  }
  function animRace(ap) {
    const m = trip.metro, max = Math.max(m.min, trip.auto.min), clock = smooth(ap * 1.5) * max;
    set($('#race-metro'), 'clip-path', 'inset(0 ' + (100 - clamp(clock / max) * 100).toFixed(2) + '% 0 0)');
    set($('#race-auto'), 'clip-path', 'inset(0 ' + (100 - clamp(clock / max) * 100).toFixed(2) + '% 0 0)');
    set($('#race-metro-end'), 'opacity', clock >= m.min - 0.01 ? '1' : '0');
    set($('#race-auto-end'), 'opacity', clock >= trip.auto.min - 0.01 ? '1' : '0');
    set($('#c2-punch'), 'opacity', String(smooth((ap - 0.55) * 5)));
    set($('#c2-verdict'), 'opacity', String(smooth((ap - 0.65) * 5)));
  }

  // Chapter 3: 100 dots, one per 1% of residents.
  const dots = $('#people');
  dots.innerHTML = '<i></i>'.repeat(100);
  function animPeople(ap) {
    const s = gap ? gap.snapshots[0] : null;
    const f = smooth(ap * 1.6);
    set($('#c3-pct'), 'text', s ? Math.round(s.goodPeoplePct * f) + '%' : '…');
    if (!s) return;
    const good = Math.round(s.goodPeoplePct), mixed = Math.round(s.mixedPeoplePct), shown = Math.round(f * 100);
    const key = good + ':' + mixed + ':' + shown;
    if (animPeople.key === key) return;
    animPeople.key = key;
    Array.from(dots.children).forEach((el, i) => {
      el.className = i >= shown ? '' : i < good ? 'good' : i < good + mixed ? 'mixed' : 'poor';
    });
  }

  // Chapter 4: the real Gap Map, with the suggested feeders added as you scroll.
  const mini = $('#minimap'), mctx = mini.getContext('2d');
  let miniW = 0, miniH = 0;
  const G = CONFIG.gapMap, K = Math.cos((G.minLat + G.maxLat) / 2 * Math.PI / 180);
  const ASPECT = (G.maxLng - G.minLng) * K / (G.maxLat - G.minLat);
  function sizeMinimap() {
    const box = mini.parentElement.getBoundingClientRect();
    miniW = Math.max(200, Math.min(box.width, H * (narrow ? 0.32 : 0.6) * ASPECT));
    miniH = miniW / ASPECT;
    mini.style.width = miniW + 'px'; mini.style.height = miniH + 'px';
    mini.width = Math.round(miniW * dpr); mini.height = Math.round(miniH * dpr);
    drawMinimap.key = null;
  }
  const HEAT = ['#5d6475', '#d9483b', '#e9a23b', '#2f9e5f'];
  function drawMinimap(k, sub) {
    if (!gap) return;
    const key = k + ':' + sub.toFixed(2) + ':' + miniW;
    if (drawMinimap.key === key) return;
    drawMinimap.key = key;
    const scale = miniW / ((G.maxLng - G.minLng) * K);
    const xy = (lat, lng) => [(lng - G.minLng) * K * scale, (G.maxLat - lat) * scale];
    const c = mctx, cw = G.step * K * scale, chh = G.step * scale, snap = gap.snapshots[k];
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, miniW, miniH);
    gap.cells.forEach(([row, col, ppl], i) => {
      c.globalAlpha = ppl < G.sparsePeople ? 0.25 : 0.85;
      c.fillStyle = HEAT[snap.bands[i]];
      c.fillRect(col * cw, row * chh, cw + 0.4, chh + 0.4);
    });
    c.globalAlpha = 1;
    // Feeder catchments; the newest one grows in.
    const radius = CONFIG.feeder.maxKm / CONFIG.roadFactor / 111.32 * scale;
    gap.recs.slice(0, Math.min(5, k + 1)).forEach((r, i) => {
      const grow = i < k ? 1 : sub;
      if (grow <= 0) return;
      const [x, y] = xy(STATIONS[r.station][1], STATIONS[r.station][2]);
      c.fillStyle = 'rgba(47,158,95,' + (0.18 * grow).toFixed(2) + ')';
      c.strokeStyle = 'rgba(255,255,255,' + (0.8 * grow).toFixed(2) + ')';
      c.setLineDash([4, 3]); c.lineWidth = 1.2;
      c.beginPath(); c.arc(x, y, radius * grow, 0, 7); c.fill(); c.stroke();
      c.setLineDash([]);
    });
    ['purple', 'aqua'].forEach((l) => {
      c.strokeStyle = LINES[l].color; c.lineWidth = 3;
      c.beginPath();
      LINES[l].stations.forEach((id, i) => { const [x, y] = xy(STATIONS[id][1], STATIONS[id][2]); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
      c.stroke();
    });
    gap.recs.slice(0, k).forEach((r) => {
      const [x, y] = xy(STATIONS[r.station][1], STATIONS[r.station][2]);
      c.fillStyle = '#2f9e5f'; c.strokeStyle = '#fff'; c.lineWidth = 2;
      c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); c.stroke();
    });
    c.fillStyle = '#ffffff';
    gap.hubs.forEach(([lat, lng]) => {
      const [x, y] = xy(lat, lng);
      c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillRect(-3.5, -3.5, 7, 7); c.restore();
    });
  }
  function renderRecs() {
    const ol = $('#c4-recs');
    if (!gap) { ol.innerHTML = '<li class="muted">' + t('gap.testing') + '</li>'; return; }
    ol.innerHTML = gap.recs.map((r, i) => '<li data-i="' + i + '"><b>🚌 ' + esc(I.station(r.station)) + '</b><span>' +
      t('gap.gain', { people: people(r.gainPeople) }) + '</span></li>').join('');
    animFeeders.k = null;
  }
  function animFeeders(ap, vis) {
    if (!gap) return;
    const steps = gap.recs.length, f = clamp((ap - 0.18) / 0.7) * steps;
    const k = Math.min(steps, Math.floor(f)), sub = k < steps ? f - k : 1;
    if (vis > 0.01) drawMinimap(Math.min(k, gap.snapshots.length - 1), reduced ? (sub > 0 ? 1 : 0) : smooth(sub * 1.6));
    if (animFeeders.k === k) return;
    animFeeders.k = k;
    const first = gap.snapshots[0], now = gap.snapshots[k];
    $('#c4-result').innerHTML = k === 0 ? t('story.c4.none', { pct: Math.round(first.goodPeoplePct) })
      : t('story.c4.result', { n: k, before: Math.round(first.goodPeoplePct), after: Math.round(now.goodPeoplePct) });
    document.querySelectorAll('#c4-recs li[data-i]').forEach((li) => li.classList.toggle('on', +li.dataset.i < k));
  }

  // The 3D moments: the map tilts down onto the table, the phone turns to face you.
  function anim3d(ch, st) {
    if (reduced) return;
    if (ch.dataset.stop === '4') {
      const e = smooth(clamp(st.appear * 1.1));
      set(mini, 'transform', 'rotateX(' + (58 * (1 - e)).toFixed(2) + 'deg) rotateZ(' + (-14 * (1 - e)).toFixed(2) + 'deg) scale(' + (0.82 + 0.18 * e).toFixed(3) + ')');
    } else if (ch.dataset.stop === '5') {
      const e = smooth(st.ap * 1.2);
      set($('#phone'), 'transform', 'rotateY(' + lerp(-42, 16, e).toFixed(2) + 'deg) rotateX(' + (14 * (1 - smooth(st.appear))).toFixed(2) + 'deg) translateY(' +
        (40 * (1 - smooth(st.appear))).toFixed(1) + 'px)');
    }
  }

  function updateChapters(y) {
    let dimTo = 0;
    chapters.forEach((ch, i) => {
      const st = chapterState(i, y);
      const shown = st.vis > 0.01;
      set(ch, 'visibility', shown ? 'visible' : 'hidden');   // hidden chapters leave the tab order and the accessibility tree
      if (!shown) return;
      set(ch, 'opacity', st.vis.toFixed(3));
      set(ch, '--shift', ((1 - st.appear) * 28 - (1 - st.leave) * 28).toFixed(1) + 'px');
      if (ch.classList.contains('feature')) dimTo = Math.max(dimTo, 0.5 * st.vis);
      else if (narrow && i > 0) dimTo = Math.max(dimTo, 0.2 * st.vis);
      if (i === 1) animStats(st.ap);
      if (i === 2) animRace(st.ap);
      if (i === 3) animPeople(st.ap);
      if (i === 4) animFeeders(st.ap, st.vis);
      if (i === 4 || i === 5) anim3d(ch, st);
      if (i === 5 && !phoneLoaded) loadPhone();
    });
    if (y > dwellOf(3).a && !phoneLoaded) loadPhone();
    set(dim, 'opacity', dimTo.toFixed(3));
  }

  /* ------------------------------------------------------------------
   * The phone in chapter 5: the real app, planning the example trip
   * ------------------------------------------------------------------ */
  let phoneLoaded = false;
  const tripHash = () => '#' + new URLSearchParams({ from: trip.from, to: trip.to, mile: 'auto', lang: I.lang }).toString();
  function loadPhone() {
    phoneLoaded = true;
    $('#phone-app').src = 'index.html' + tripHash();
  }

  /* ------------------------------------------------------------------
   * LED display, line bar and clock
   * ------------------------------------------------------------------ */
  const linebar = $('#linebar');
  function renderLinebar() {
    const pos = (x) => (x / lineEnd * 100).toFixed(2) + '%';
    linebar.innerHTML = '<div class="lb-track"><i class="lb-done" id="lb-done"></i>' + lineStations.map((s) => s.stop >= 0
      ? '<button type="button" class="lb-stop" data-stop="' + s.stop + '" style="left:' + pos(s.x) + '" aria-label="' +
        esc(t('story.jump', { station: I.station(s.id) })) + '"><span>' + esc(I.station(s.id)) + '</span></button>'
      : '<i class="lb-pass" style="left:' + pos(s.x) + '" title="' + esc(I.station(s.id)) + '"></i>').join('') +
      '<i class="lb-train" id="lb-train" aria-hidden="true">🚇</i></div>';
    linebar.querySelectorAll('.lb-stop').forEach((b) => b.addEventListener('click', () => {
      const seg = dwellOf(+b.dataset.stop);
      window.scrollTo({ top: seg.a + 0.15 * (seg.b - seg.a), behavior: reduced ? 'auto' : 'smooth' });
    }));
    cache.clear();
  }

  function updateLed(pos, hour) {
    const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
    set($('#led-clock'), 'text', String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'));
    const seg = pos.seg;
    let text;
    if (seg.kind === 'dwell') {
      const id = STOPS[seg.stop];
      text = seg.stop === STOPS.length - 1 ? t('story.led.end', { station: I.station(id) }) : t('story.led.at', { station: I.station(id) });
    } else text = t('story.led.next', { station: I.station(STOPS[seg.to]) });
    set($('#led-text'), 'text', text);
    const f = (pos.x / lineEnd * 100).toFixed(2) + '%';
    set($('#lb-train'), 'left', f);
    set($('#lb-done'), 'width', f);
    const current = seg.kind === 'dwell' ? seg.stop : -1;
    if (updateLed.current !== current) {
      updateLed.current = current;
      linebar.querySelectorAll('.lb-stop').forEach((b) => b.classList.toggle('here', +b.dataset.stop === current));
    }
  }

  /* ------------------------------------------------------------------
   * Frame
   * ------------------------------------------------------------------ */
  let dirty = true, lastY = -1;
  function frame(ms) {
    const now = ms / 1000, y = clamp(window.scrollY, 0, maxY);
    if (y !== lastY) { dirty = true; lastY = y; }
    if (dirty || !reduced) {
      const pos = trainAt(y), hour = 7.6 + 15 * y / maxY, d = darkness(hour);
      const camX = pos.x, lag = reduced ? 0 : -pos.accel * 22 * S;
      const dwell = pos.seg.kind === 'dwell' ? pos.q : -1;
      const open = dwell < 0 ? 0 : smooth((dwell - 0.04) / 0.12) * (pos.seg.stop === STOPS.length - 1 ? 1 : 1 - smooth((dwell - 0.84) / 0.12));
      const buses = smooth((y - dwellOf(4).a - 0.5 * (dwellOf(4).b - dwellOf(4).a)) / unit);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSky(hour, d, now);
      drawHills(camX, hour, d);
      drawCity(FAR, PAR.far, 0.75, camX, hour, d, false);
      drawCity(NEAR, PAR.near, 1, camX, hour, d, true);
      drawWada(camX, hour, d);
      drawStreet(camX, d, now, buses);
      lineStations.forEach((st) => drawStation(st, camX, d, false));
      drawViaduct(camX, d);
      drawMasts(camX, d);
      drawStreaks(pos.speed, camX);
      drawTrain(lag, open, d, camX);
      lineStations.forEach((st) => drawStation(st, camX, d, true));
      drawForeground(camX, d);
      if (dirty) { updateChapters(y); updateLed(pos, hour); }
      dirty = false;
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------
   * Text that depends on the language
   * ------------------------------------------------------------------ */
  function initialLang() {
    const linked = new URLSearchParams(location.hash.slice(1)).get('lang');
    if (linked === 'mr' || linked === 'en') return linked;
    try { const saved = localStorage.getItem(LANG_KEY); if (saved) return saved; } catch (e) { /* no storage */ }
    return /^mr\b/i.test(navigator.language || '') ? 'mr' : 'en';
  }

  function renderGapText() {
    const s = gap && gap.snapshots[0];
    $('#c3-text').innerHTML = s ? t('story.c3.text', { people: people(s.residents), pct: Math.round(s.goodPeoplePct), n: HUBS.length }) : t('gap.testing');
    $('#c3-area').textContent = s ? t('story.c3.area', { pct: Math.round(s.goodPct) }) : '';
    dots.setAttribute('aria-label', t('story.c3.dots') + (s ? ' ' + t('story.c3.dotsAlt', { good: Math.round(s.goodPeoplePct) }) : ''));
    renderRecs();
    animPeople.key = null;
  }

  function translate() {
    document.documentElement.lang = I.lang;
    document.title = t('story.title');
    I.applyTo(document);
    const n = basics.network, m = trip.metro;
    $('#hero-sub').textContent = t('story.hero.sub', { from: I.station(STOPS[0]), to: I.station(STOPS[STOPS.length - 1]) });
    $('#fares').textContent = '₹' + n.fareMin + '–' + n.fareMax;
    $('#c1-text').textContent = t('story.c1.text', { first: n.firstTrain, last: n.lastTrain });
    $('#c2-lead').textContent = t('story.c2.lead', { from: I.place(trip.from), to: I.place(trip.to) });
    renderRace();
    $('#c2-punch').innerHTML = t('story.c2.punch', { fare: m.fare, miles: m.miles.cost });
    const share = t('story.c2.share', { pct: Math.round(100 * m.miles.min / m.min) });
    const autoWins = trip.auto.min < m.min && trip.auto.cost < m.cost;
    $('#c2-verdict').textContent = share + (autoWins ? ' ' + t('story.c2.verdict', { min: fmtMin(m.min - trip.auto.min), rs: Math.round(m.cost - trip.auto.cost) }) : '');
    $('#c4-text').textContent = t('story.c4.text', { fare: CONFIG.feeder.fare });
    $('#c5-open').href = 'index.html' + tripHash();
    renderGapText();
    renderLinebar();
    if (phoneLoaded) $('#phone-app').src = 'index.html' + tripHash();
    animFeeders.k = null;
    cache.clear();
    dirty = true;
  }

  function setLanguage(lang) {
    I.setLang(lang);
    try { localStorage.setItem(LANG_KEY, I.lang); } catch (e) { /* no storage */ }
    translate();
  }

  function buildQr() {
    const url = new URL('index.html', location.href).href;
    const code = qrcode(0, 'M');
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    code.addData(url);
    code.make();
    $('#qr').innerHTML = code.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
  }

  /* ------------------------------------------------------------------
   * Wiring
   * ------------------------------------------------------------------ */
  function onGap(data) {
    gap = data;
    renderGapText();
    drawMinimap.key = null;
    dirty = true;
  }

  function startGap() {
    // In a worker so scrolling stays smooth; on the main thread if workers are unavailable (e.g. file://).
    const fallback = () => setTimeout(() => onGap(MetroStory.gap()), 50);
    try {
      const worker = new Worker('js/story-worker.js');
      worker.onmessage = (e) => { onGap(e.data); worker.terminate(); };
      worker.onerror = (e) => { e.preventDefault(); worker.terminate(); fallback(); };
      worker.postMessage('go');
    } catch (e) { fallback(); }
  }

  I.setLang(initialLang());
  resize();
  translate();
  buildQr();
  startGap();
  window.addEventListener('resize', resize);
  window.addEventListener('scroll', () => { dirty = true; }, { passive: true });
  $('#lang-toggle').addEventListener('click', () => setLanguage(I.lang === 'mr' ? 'en' : 'mr'));
  $('#replay').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* the story still works online */ });
  }
})();
