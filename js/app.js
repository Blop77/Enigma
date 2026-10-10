/*
 * app.js — user interface for the Enigma simulator.
 * Depends on enigma.js (cipher engine) and sound.js (sound effects).
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------ */
  const A = Enigma.ALPHABET;
  const ROWS = ['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML']; // real German Enigma layout
  const ALL_ROTORS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const MODELS = {
    I:  { rotors: ['I', 'II', 'III', 'IV', 'V'], reflectors: ['A', 'B', 'C'] },
    M3: { rotors: ALL_ROTORS,                    reflectors: ['B', 'C'] }
  };
  const SLOTS = ['Left', 'Middle', 'Right'];
  const SLOT_HINT = ['slow', '', 'fast'];
  const CABLE_COLORS = ['#e2584a', '#eba13a', '#e6d24e', '#69c467', '#43b9b1', '#4c8ee6',
                        '#9d6be3', '#e66bbb', '#c98a5a', '#a6d84a', '#59d2e3', '#f29a8c', '#d6d6d6'];
  const STORE_KEY = 'enigma-simulator-v1';
  const MAX_PLUGS = 13;

  const DEFAULTS = {
    model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: [0, 0, 0], start: [0, 0, 0], plugs: [],
    numbers: false, mode: 'encrypt', fmt: 'keep', animate: false, speed: 6,
    muted: false, volume: 70, welcomed: false
  };

  const MODE_TEXT = {
    encrypt: {
      inLabel: 'Your message (plaintext)',
      placeholder: 'Type or paste the message you want to encrypt…',
      outLabel: 'Encrypted message (ciphertext)',
      run: 'Encrypt message',
      swap: 'Decrypt this',
      steps: [
        'Check the <strong>Machine settings</strong> below — they are your secret key.',
        'Type your message and press <strong>Encrypt message</strong>.',
        'Send the ciphertext, and give the receiver the key (<strong>📋 Copy key</strong>).'
      ],
      fmts: [
        ['keep', 'Keep spaces & punctuation (easiest)'],
        ['groups', 'Letters only, in groups of five (authentic)'],
        ['x', 'Spaces become X, in groups of five (authentic)']
      ]
    },
    decrypt: {
      inLabel: 'Received ciphertext',
      placeholder: 'Paste the encrypted message you received…',
      outLabel: 'Decrypted message (plaintext)',
      run: 'Decrypt message',
      swap: 'Encrypt this',
      steps: [
        'Set <strong>exactly the same key</strong> the sender used (<strong>📥 Load key</strong>).',
        'Paste the ciphertext and press <strong>Decrypt message</strong>.',
        'Pick the same <strong>Spaces & punctuation</strong> option the sender used.'
      ],
      fmts: [
        ['keep', 'Keep spaces & punctuation'],
        ['groups', 'Letters only (ignore the spaces between groups)'],
        ['x', 'Letters only, and turn X back into spaces']
      ]
    }
  };

  // A genuine message sent by the German Army on 7 July 1941.
  const EXAMPLE = {
    key: { model: 'I', reflector: 'B', rotors: ['II', 'IV', 'V'], rings: [1, 20, 11], start: [1, 11, 0],
           plugs: ['AV', 'BS', 'CG', 'DL', 'FU', 'HZ', 'IN', 'KM', 'OW', 'RX'] },
    cipher: 'EDPUD NRGYS ZRCXN UYTPO MRMBO FKTBZ REZKM LXLVE FGUEY SIOZV EQMIK UBPMM YLKLT TDEIS ' +
            'MDICA GYKUA CTCDO MOHWX MUUIA UBSTS LRNBZ SZWNR FXWFY SSXJZ VIJHI DISHP RKLKA YUPAD ' +
            'TXQSP INQMA TLPIF SVKDA SCTAC DPBOP VHJK',
    before: '<b>A genuine German Army message from 7 July 1941</b> (Operation Barbarossa). ' +
            'Its key is already set on the machine — just press <b>Decrypt message</b>.',
    after: '<b>Decrypted!</b> It is German, with X used as a space. Roughly: <em>“Reconnaissance division ' +
           'from Kurtinowa, north-west of Sebez, on the flight corridor towards Dubrowki and Opotschka. ' +
           'Formed up at 18:30. Attack. Infantry regiment.”</em>'
  };

  /* ------------------------------------------------------------------
   * State
   * ------------------------------------------------------------------ */
  const $ = (id) => document.getElementById(id);
  const mod = (n, m) => ((n % m) + m) % m;
  const pad2 = (n) => String(n + 1).padStart(2, '0');

  let state = loadState();
  let machine = null;
  let tape = { in: '', out: '' };
  let typedSinceReset = false; // has the machine moved since the start position?
  let held = null;             // the key currently held down: { letter, out, source }
  let plugSel = null;          // first socket of a cable being connected
  let busy = false;            // an animated message is running
  let cancelRun = false;
  let exampleActive = false;
  const wheelY = [0, 0, 0];
  const rotorEls = [];
  const keyEls = {};
  const lampEls = {};
  const socketEls = {};

  /* ------------------------------------------------------------------
   * Persistence
   * ------------------------------------------------------------------ */
  function loadState() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { saved = {}; }
    const s = Object.assign({}, DEFAULTS, saved);
    if (!validKey(s)) Object.assign(s, pickKey(DEFAULTS));
    return s;
  }

  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode etc. */ }
  }

  function pickKey(s) {
    return { model: s.model, reflector: s.reflector, rotors: s.rotors.slice(), rings: s.rings.slice(),
             start: s.start.slice(), plugs: s.plugs.slice() };
  }

  function validKey(s) {
    try {
      const m = MODELS[s.model];
      if (!m || m.reflectors.indexOf(s.reflector) < 0) return false;
      if (!Array.isArray(s.rotors) || s.rotors.length !== 3 || new Set(s.rotors).size !== 3) return false;
      if (!s.rotors.every((r) => m.rotors.indexOf(r) >= 0)) return false;
      const okNums = (a) => Array.isArray(a) && a.length === 3 && a.every((n) => Number.isInteger(n) && n >= 0 && n < 26);
      if (!okNums(s.rings) || !okNums(s.start)) return false;
      Enigma.parsePlugboard(s.plugs.join(' '));
      return true;
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------
   * Key <-> text  ("UKW-B | Rotors I II III | Rings 01 01 01 | Start AAA | Plugs AB CD")
   * ------------------------------------------------------------------ */
  function formatKey(s) {
    return [
      s.model === 'M3' ? 'Enigma M3' : 'Enigma I',
      'UKW-' + s.reflector,
      'Rotors ' + s.rotors.join(' '),
      'Rings ' + s.rings.map(pad2).join(' '),
      'Start ' + s.start.map((n) => A[n]).join(''),
      'Plugs ' + (s.plugs.length ? s.plugs.join(' ') : 'none')
    ].join(' | ');
  }

  function parseTriple(v, what) {
    v = v.trim().toUpperCase();
    if (/^\d/.test(v)) {
      const nums = v.split(/[^0-9]+/).filter(Boolean).map(Number);
      if (nums.length !== 3 || nums.some((n) => n < 1 || n > 26)) throw new Error(what + ' needs three numbers from 01 to 26.');
      return nums.map((n) => n - 1);
    }
    const letters = v.replace(/[^A-Z]/g, '');
    if (letters.length !== 3) throw new Error(what + ' needs three letters (like AAA) or three numbers (like 01 01 01).');
    return letters.split('').map((c) => A.indexOf(c));
  }

  function parseKey(text) {
    const k = pickKey(DEFAULTS);
    let model = null;
    let gotRotors = false;
    const segs = String(text).split(/[|\n;]+/).map((s) => s.trim()).filter(Boolean);
    if (!segs.length) throw new Error('Paste a key first.');
    segs.forEach((seg) => {
      let m;
      if ((m = seg.match(/^(?:enigma|model)\s*[:=]?\s*(I|M3)$/i))) model = m[1].toUpperCase();
      else if ((m = seg.match(/^(?:ukw|reflector|umkehrwalze)\s*[-:=]?\s*([ABC])$/i))) k.reflector = m[1].toUpperCase();
      else if ((m = seg.match(/^(?:rotors?|walzen(?:lage)?|wheels?|order)\s*[:=]?\s*(.+)$/i))) {
        k.rotors = m[1].toUpperCase().split(/[^IVX]+/).filter(Boolean);
        gotRotors = true;
      }
      else if ((m = seg.match(/^(?:rings?|ringstellung)\s*[:=]?\s*(.+)$/i))) k.rings = parseTriple(m[1], 'Rings');
      else if ((m = seg.match(/^(?:start|grundstellung|positions?|pos)\s*[:=]?\s*(.+)$/i))) k.start = parseTriple(m[1], 'Start');
      else if ((m = seg.match(/^(?:plugs?|plugboard|stecker(?:brett)?)\s*[:=]?\s*(.*)$/i))) {
        k.plugs = /^(none|-|)$/i.test(m[1].trim()) ? [] : Enigma.parsePlugboard(m[1]);
      }
      else throw new Error('I didn’t understand “' + seg + '”.');
    });
    if (!gotRotors) throw new Error('The key must list the rotors, e.g. “Rotors I II III”.');
    if (k.rotors.length !== 3) throw new Error('Exactly three rotors are needed, e.g. “Rotors I II III”.');
    k.rotors.forEach((r) => { if (ALL_ROTORS.indexOf(r) < 0) throw new Error('Unknown rotor “' + r + '”. Use I to VIII.'); });
    if (new Set(k.rotors).size !== 3) throw new Error('Each rotor can only be used once.');
    if (!model) model = k.rotors.some((r) => MODELS.I.rotors.indexOf(r) < 0) ? 'M3' : 'I';
    if (k.reflector === 'A' && model === 'M3') model = 'I';
    if (model === 'I' && k.rotors.some((r) => MODELS.I.rotors.indexOf(r) < 0)) {
      throw new Error('Rotors VI–VIII only exist on the Enigma M3.');
    }
    k.model = model;
    return k;
  }

  /* ------------------------------------------------------------------
   * Building the machine UI
   * ------------------------------------------------------------------ */
  function label(n) { return state.numbers ? pad2(n) : A[n]; }

  function buildRotors() {
    const wrap = $('rotors');
    for (let i = 0; i < 3; i++) {
      const el = document.createElement('div');
      el.className = 'rotor';
      el.innerHTML =
        '<div class="rotor-name"><span class="rn"></span><small>' + SLOTS[i].toUpperCase() + '</small></div>' +
        '<div class="rotor-body">' +
          '<div class="rotor-col">' +
            '<button class="turn-btn" type="button" data-dir="1" aria-label="Turn ' + SLOTS[i].toLowerCase() + ' rotor forward">▲</button>' +
            '<div class="window" tabindex="0" role="spinbutton" aria-valuemin="1" aria-valuemax="26" ' +
              'aria-label="' + SLOTS[i] + ' rotor position. Use arrow keys to turn." ' +
              'title="Turn with ▲ ▼, mouse wheel, dragging or arrow keys">' +
              '<div class="strip"><span></span><span></span><span class="cur"></span><span></span><span></span></div>' +
            '</div>' +
            '<button class="turn-btn" type="button" data-dir="-1" aria-label="Turn ' + SLOTS[i].toLowerCase() + ' rotor back">▼</button>' +
          '</div>' +
          '<div class="wheel" aria-hidden="true" title="Thumbwheel — drag or scroll to turn"></div>' +
        '</div>' +
        '<div class="rotor-ring"></div>';
      wrap.appendChild(el);

      const r = {
        root: el,
        name: el.querySelector('.rn'),
        window: el.querySelector('.window'),
        strip: el.querySelector('.strip'),
        wheel: el.querySelector('.wheel'),
        ring: el.querySelector('.rotor-ring')
      };
      rotorEls.push(r);

      el.querySelectorAll('.turn-btn').forEach((b) => {
        b.addEventListener('click', () => turnRotor(i, Number(b.dataset.dir)));
      });
      r.window.addEventListener('keydown', (e) => {
        const dir = { ArrowUp: 1, ArrowRight: 1, PageUp: 1, ArrowDown: -1, ArrowLeft: -1, PageDown: -1 }[e.key];
        if (dir) { e.preventDefault(); e.stopPropagation(); turnRotor(i, dir); }
      });
      [r.window, r.wheel].forEach((target) => {
        let acc = 0;
        target.addEventListener('wheel', (e) => {
          e.preventDefault();
          acc += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
          while (Math.abs(acc) >= 40) {
            const dir = acc > 0 ? 1 : -1;
            acc -= dir * 40;
            turnRotor(i, dir);
          }
        }, { passive: false });
        let dragY = null;
        target.addEventListener('pointerdown', (e) => {
          dragY = e.clientY;
          target.setPointerCapture(e.pointerId);
        });
        target.addEventListener('pointermove', (e) => {
          if (dragY === null) return;
          const STEP = 18;
          while (dragY - e.clientY >= STEP) { dragY -= STEP; turnRotor(i, 1); }
          while (e.clientY - dragY >= STEP) { dragY += STEP; turnRotor(i, -1); }
        });
        const end = () => { dragY = null; };
        target.addEventListener('pointerup', end);
        target.addEventListener('pointercancel', end);
      });
    }
  }

  function buildBoards() {
    const lampboard = $('lampboard');
    const keyboard = $('keyboard');
    const plugboard = $('plugboard');

    ROWS.forEach((row) => {
      const lRow = document.createElement('div'); lRow.className = 'row';
      const kRow = document.createElement('div'); kRow.className = 'row';
      const pRow = document.createElement('div'); pRow.className = 'row';

      row.split('').forEach((ch) => {
        const lamp = document.createElement('div');
        lamp.className = 'lamp';
        lamp.textContent = ch;
        lRow.appendChild(lamp);
        lampEls[ch] = lamp;

        const key = document.createElement('button');
        key.type = 'button';
        key.className = 'key';
        key.textContent = ch;
        key.setAttribute('aria-label', 'Key ' + ch);
        kRow.appendChild(key);
        keyEls[ch] = key;
        key.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          e.preventDefault(); // keep focus where it is so the physical keyboard still works
          key.setPointerCapture(e.pointerId);
          pressDown(ch, 'pointer');
        });
        const up = () => { if (held && held.source === 'pointer') release(); };
        key.addEventListener('pointerup', up);
        key.addEventListener('pointercancel', up);
        key.addEventListener('lostpointercapture', up);
        key.addEventListener('click', (e) => {
          if (e.detail === 0) { // activated with Enter/Space while focused
            if (pressDown(ch, 'click')) setTimeout(release, 160);
          }
        });

        const sock = document.createElement('button');
        sock.type = 'button';
        sock.className = 'socket';
        sock.innerHTML = '<span class="s-letter">' + ch + '</span><span class="s-body"><i></i><i></i></span>';
        sock.setAttribute('aria-label', 'Plugboard socket ' + ch);
        sock.addEventListener('click', () => onSocket(ch));
        pRow.appendChild(sock);
        socketEls[ch] = sock;
      });

      lampboard.appendChild(lRow);
      keyboard.appendChild(kRow);
      plugboard.appendChild(pRow);
    });

    if ('ResizeObserver' in window) new ResizeObserver(drawCables).observe(plugboard);
    else window.addEventListener('resize', drawCables);
  }

  /* ------------------------------------------------------------------
   * Rendering
   * ------------------------------------------------------------------ */
  function renderRotor(i, dir) {
    const r = rotorEls[i];
    const rotor = machine.rotors[i];
    const pos = rotor.position;
    const cells = r.strip.children;
    for (let k = 0; k < 5; k++) cells[k].textContent = label(mod(pos + k - 2, 26));
    r.name.textContent = rotor.name;
    r.ring.textContent = 'RING ' + pad2(rotor.ring) + ' · ' + A[rotor.ring];
    r.window.setAttribute('aria-valuenow', pos + 1);
    r.window.setAttribute('aria-valuetext', A[pos] + ' (' + pad2(pos) + ')');

    if (dir && r.strip.animate) {
      const h = cells[0].getBoundingClientRect().height;
      r.strip.animate(
        [{ transform: 'translateY(' + dir * h + 'px)' }, { transform: 'translateY(0)' }],
        { duration: 150, easing: 'cubic-bezier(.2,.8,.3,1)' }
      );
      wheelY[i] -= dir * 5;
      r.wheel.style.setProperty('--wheel-y', wheelY[i] + 'px');
    }
  }

  function renderAllRotors(moved) {
    for (let i = 0; i < 3; i++) renderRotor(i, moved && moved[i] ? 1 : 0);
    renderPosStatus();
  }

  function renderPosStatus() {
    const fmt = (arr) => arr.map(label).join(state.numbers ? '-' : '');
    const now = machine.rotors.map((r) => r.position);
    const differs = now.some((p, i) => p !== state.start[i]);
    $('pos-status').innerHTML =
      'START <b>' + fmt(state.start) + '</b><br>' +
      'NOW <b class="' + (differs ? 'moved' : '') + '">' + fmt(now) + '</b>';
    $('btn-reset').disabled = !differs && !tape.in;
  }

  function renderTape() {
    const group = (s) => s.replace(/(.{5})/g, '$1 ').trim();
    $('tape-in').textContent = group(tape.in);
    const out = group(tape.out);
    const el = $('tape-out');
    el.textContent = '';
    if (out) {
      el.appendChild(document.createTextNode(out.slice(0, -1)));
      const last = document.createElement('span');
      last.className = 'last';
      last.textContent = out.slice(-1);
      el.appendChild(last);
    }
    $('btn-copy-tape').disabled = !tape.out;
    $('btn-clear-tape').disabled = !tape.out;
  }

  function renderTrace(result) {
    const list = $('trace');
    list.innerHTML = '';
    if (!result) {
      list.innerHTML = '<li class="trace-empty">Press any key to watch the electrical current travel through the machine.</li>';
      $('trace-legend').hidden = true;
      return;
    }
    result.path.forEach((p, idx) => {
      const li = document.createElement('li');
      let cls = 'chip';
      let st = p.stage;
      if (idx === 0) { cls += ' kb'; st = 'Key'; }
      else if (p.stage === 'Lamp') cls += ' lamp';
      else if (p.stage.indexOf('Reflector') === 0) { cls += ' ukw'; st = 'UKW-' + machine.reflectorName; }
      else if (p.stage === 'Plugboard') { cls += idx < 5 ? ' in' : ' out'; st = 'Plugs'; }
      else cls += p.dir === 'in' ? ' in' : ' out';
      li.innerHTML = '<span class="' + cls + '"><span class="st">' + st + '</span><span class="lt">' + p.letter + '</span></span>';
      list.appendChild(li);
    });
    $('trace-legend').hidden = false;
  }

  function renderPlugboard() {
    const colorOf = {};
    state.plugs.forEach((p, i) => { colorOf[p[0]] = colorOf[p[1]] = CABLE_COLORS[i % CABLE_COLORS.length]; });
    for (const ch of A) {
      const s = socketEls[ch];
      s.classList.toggle('plugged', !!colorOf[ch]);
      s.classList.toggle('selected', plugSel === ch);
      if (colorOf[ch]) s.style.setProperty('--c', colorOf[ch]);
      else s.style.removeProperty('--c');
      const partner = state.plugs.find((p) => p.indexOf(ch) >= 0);
      s.setAttribute('aria-label', 'Plugboard socket ' + ch + (partner ? ', connected to ' + partner.replace(ch, '') : ''));
      s.setAttribute('aria-pressed', plugSel === ch ? 'true' : 'false');
    }
    $('plug-hint').textContent = plugSel
      ? 'Now click the letter to connect with ' + plugSel + ' (Esc to cancel)'
      : 'Click two letters to connect them with a cable · click a plugged letter to remove its cable';
    drawCables();
  }

  function drawCables() {
    const svg = $('cables');
    const board = $('plugboard');
    const box = board.getBoundingClientRect();
    if (!box.width) return;
    svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
    const k = socketEls.A.getBoundingClientRect().width;
    const w = Math.max(3, k * 0.11);
    let html = '';
    state.plugs.forEach((p, i) => {
      const a = socketEls[p[0]].querySelector('.s-body').getBoundingClientRect();
      const b = socketEls[p[1]].querySelector('.s-body').getBoundingClientRect();
      const ax = a.left + a.width / 2 - box.left, ay = a.bottom - box.top - 2;
      const bx = b.left + b.width / 2 - box.left, by = b.bottom - box.top - 2;
      const dist = Math.hypot(bx - ax, by - ay);
      const sag = k * 0.6 + dist * 0.28;
      const d = 'M' + ax + ' ' + ay + ' C' + ax + ' ' + (ay + sag) + ' ' + bx + ' ' + (by + sag) + ' ' + bx + ' ' + by;
      const c = CABLE_COLORS[i % CABLE_COLORS.length];
      html += '<path class="cable-shadow" d="' + d + '" stroke-width="' + (w + 3) + '" transform="translate(1.5 3)"/>' +
              '<path class="cable" d="' + d + '" stroke="' + c + '" stroke-width="' + w + '"/>' +
              '<path class="cable-hi" d="' + d + '" stroke-width="' + Math.max(1, w * 0.25) + '" transform="translate(-' + w * 0.18 + ' -' + w * 0.18 + ')"/>';
    });
    svg.innerHTML = html;
  }

  function renderSettings() {
    const model = MODELS[state.model];
    $('model').value = state.model;

    const refl = $('reflector');
    refl.innerHTML = model.reflectors.map((r) =>
      '<option value="' + r + '">UKW-' + r + (r === 'B' ? ' (standard)' : r === 'A' ? ' (pre-war)' : '') + '</option>').join('');
    refl.value = state.reflector;
    $('ukw-label').textContent = state.reflector;

    const tbody = $('rotor-rows');
    if (!tbody.children.length) {
      for (let i = 0; i < 3; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + SLOTS[i] + (SLOT_HINT[i] ? '<br><small>' + SLOT_HINT[i] + '</small>' : '') + '</td>' +
          '<td><select data-kind="rotor" data-i="' + i + '" aria-label="' + SLOTS[i] + ' rotor"></select></td>' +
          '<td><select data-kind="ring" data-i="' + i + '" aria-label="' + SLOTS[i] + ' ring setting">' +
            A.split('').map((c, n) => '<option value="' + n + '">' + pad2(n) + ' · ' + c + '</option>').join('') + '</select></td>' +
          '<td><select data-kind="start" data-i="' + i + '" aria-label="' + SLOTS[i] + ' start position">' +
            A.split('').map((c, n) => '<option value="' + n + '">' + c + ' · ' + pad2(n) + '</option>').join('') + '</select></td>';
        tbody.appendChild(tr);
      }
      tbody.addEventListener('change', onRotorTableChange);
    }
    tbody.querySelectorAll('select').forEach((sel) => {
      const i = Number(sel.dataset.i);
      if (sel.dataset.kind === 'rotor') {
        sel.innerHTML = model.rotors.map((r) =>
          '<option value="' + r + '" title="' + Enigma.ROTORS[r].note + '">' + r + '</option>').join('');
        sel.value = state.rotors[i];
      } else if (sel.dataset.kind === 'ring') sel.value = state.rings[i];
      else sel.value = state.start[i];
    });

    const plugsInput = $('plugs');
    if (document.activeElement !== plugsInput) {
      plugsInput.value = state.plugs.join(' ');
      plugsInput.classList.remove('invalid');
      $('plugs-error').textContent = '';
    }
    const n = state.plugs.length;
    $('plug-count').textContent = n + (n === 1 ? ' cable' : ' cables') + (n === 10 ? ' — historical standard' : '');
    $('numbers').checked = state.numbers;
    $('key-preview').textContent = formatKey(state);
  }

  function renderMode() {
    const t = MODE_TEXT[state.mode];
    $('tab-encrypt').setAttribute('aria-selected', state.mode === 'encrypt');
    $('tab-decrypt').setAttribute('aria-selected', state.mode === 'decrypt');
    $('msg-in-label').textContent = t.inLabel;
    $('msg-in').placeholder = t.placeholder;
    $('msg-out-label').textContent = t.outLabel;
    $('swap-text').textContent = t.swap;
    $('mode-steps').innerHTML = t.steps.map((s) => '<li>' + s + '</li>').join('');
    $('fmt').innerHTML = t.fmts.map((f) => '<option value="' + f[0] + '">' + f[1] + '</option>').join('');
    $('fmt').value = state.fmt;
    renderRunButton();
    updateMsgNote();
  }

  function renderRunButton() {
    const btn = $('btn-run');
    btn.classList.toggle('decrypt', state.mode === 'decrypt' && !busy);
    btn.classList.toggle('stop', busy);
    btn.textContent = busy ? '■ Stop' : MODE_TEXT[state.mode].run;
  }

  function updateMsgNote() {
    const text = $('msg-in').value;
    const letters = (prepare(text).match(/[A-Z]/g) || []).length;
    let note = '';
    if (text.trim()) {
      note = letters + (letters === 1 ? ' letter' : ' letters') + ' will be ' + (state.mode === 'encrypt' ? 'encrypted' : 'decrypted') + '.';
      if (/[0-9]/.test(text)) {
        note += state.fmt === 'keep'
          ? ' <span class="warn">Digits are not encrypted — the Enigma had no number keys (spell them out: ONE, TWO…).</span>'
          : ' <span class="warn">Digits and punctuation will be dropped — spell numbers out.</span>';
      }
    }
    $('msg-note').innerHTML = note;
    $('speed-wrap').classList.toggle('off', !state.animate);
  }

  function updateOutputButtons() {
    const has = !!$('msg-out').value;
    $('btn-copy-out').disabled = !has;
    $('btn-swap').disabled = !has || busy;
  }

  /* ------------------------------------------------------------------
   * Machine actions
   * ------------------------------------------------------------------ */
  function buildMachine() {
    machine = new Enigma({
      rotors: state.rotors, rings: state.rings, positions: state.start,
      reflector: state.reflector, plugboard: state.plugs
    });
    typedSinceReset = false;
  }

  /** Called after any change to the key. Resets the machine to the start position. */
  function applySettings(opts) {
    opts = opts || {};
    const hadTyped = typedSinceReset && tape.in;
    buildMachine();
    clearTape();
    renderTrace(null);
    renderSettings();
    renderAllRotors();
    renderPlugboard();
    saveState();
    if (!opts.keepExample) setExample(false);
    if (hadTyped && !opts.quiet) toast('Key changed — machine reset to the start position');
  }

  function pressDown(letter, source) {
    if (held || (busy && source !== 'anim')) return null;
    Sound.unlock();
    const result = machine.pressKey(letter);
    typedSinceReset = true;
    held = { letter: letter, out: result.output, source: source };

    keyEls[letter].classList.add('down');
    lampEls[result.output].classList.add('lit');
    Sound.keyDown();
    Sound.rotorStep(result.moved);
    Sound.lamp();

    renderAllRotors(result.moved);
    tape.in += letter;
    tape.out += result.output;
    renderTape();
    renderTrace(result);
    return result;
  }

  function release() {
    if (!held) return;
    keyEls[held.letter].classList.remove('down');
    lampEls[held.out].classList.remove('lit');
    Sound.keyUp();
    held = null;
  }

  function turnRotor(i, dir) {
    if (busy) return;
    const rotor = machine.rotors[i];
    rotor.position = mod(rotor.position + dir, 26);
    if (!typedSinceReset) {
      // Before typing, the thumbwheels set the start position (like a real operator would).
      state.start[i] = rotor.position;
      renderSettings();
      saveState();
    }
    Sound.unlock();
    Sound.wheelTick();
    renderRotor(i, dir);
    renderPosStatus();
  }

  function resetToStart() {
    if (busy) return;
    release();
    machine.setPositions(state.start);
    typedSinceReset = false;
    clearTape();
    renderTrace(null);
    renderAllRotors([true, true, true]);
    Sound.rotorStep([true, true, true]);
    toast('Rotors back at the start position ' + state.start.map((n) => A[n]).join(''));
  }

  function clearTape() {
    tape = { in: '', out: '' };
    renderTape();
  }

  /* ------------------------------------------------------------------
   * Plugboard
   * ------------------------------------------------------------------ */
  function onSocket(ch) {
    if (busy) return;
    Sound.unlock();
    const existing = state.plugs.findIndex((p) => p.indexOf(ch) >= 0);
    if (existing >= 0) {
      const removed = state.plugs.splice(existing, 1)[0];
      plugSel = null;
      Sound.plugOut();
      applySettings();
      announce('Removed cable ' + removed);
      return;
    }
    if (!plugSel) {
      if (state.plugs.length >= MAX_PLUGS) { Sound.error(); toast('All 13 possible cables are in use', true); return; }
      plugSel = ch;
      Sound.ui();
      renderPlugboard();
      return;
    }
    if (plugSel === ch) { cancelPlug(); return; }
    state.plugs.push(plugSel + ch);
    plugSel = null;
    Sound.plugIn();
    applySettings();
    announce('Connected ' + state.plugs[state.plugs.length - 1]);
  }

  function cancelPlug() {
    if (!plugSel) return;
    plugSel = null;
    renderPlugboard();
  }

  /* ------------------------------------------------------------------
   * Whole-message processing
   * ------------------------------------------------------------------ */
  function prepare(text) {
    let t = String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    if (state.mode === 'encrypt' && state.fmt === 'x') t = t.trim().replace(/\s+/g, 'X');
    return t;
  }

  function formatOutput(raw) {
    if (state.fmt === 'keep') return raw;
    if (state.mode === 'encrypt') return raw.replace(/(.{5})/g, '$1 ').trim();
    if (state.fmt === 'x') return raw.replace(/X/g, ' ');
    return raw;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function runMessage() {
    if (busy) { cancelRun = true; return; }
    const src = prepare($('msg-in').value);
    if (!/[A-Z]/.test(src)) {
      Sound.error();
      toast('Type a message with at least one letter A–Z first', true);
      $('msg-in').focus();
      return;
    }
    const lettersOnly = state.fmt !== 'keep';
    const verb = state.mode === 'encrypt' ? 'Encrypted' : 'Decrypted';
    release();
    plugSel = null;

    if (!state.animate) {
      buildMachine();
      let raw = '';
      let last = null;
      let count = 0;
      for (const ch of src) {
        if (ch >= 'A' && ch <= 'Z') { last = machine.pressKey(ch); raw += last.output; count++; }
        else if (!lettersOnly) raw += ch;
      }
      typedSinceReset = true;
      clearTape();
      renderAllRotors([true, true, true]);
      renderTrace(last);
      $('msg-out').value = formatOutput(raw);
      Sound.unlock(); Sound.keyDown(); Sound.rotorStep([true, true, true]);
      toast(verb + ' ' + count + (count === 1 ? ' letter' : ' letters') + ' starting from ' + state.start.map((n) => A[n]).join(''));
      finishRun();
      return;
    }

    // Animated: type the message on the machine, key by key.
    buildMachine();
    clearTape();
    renderAllRotors();
    busy = true;
    cancelRun = false;
    $('settings-fieldset').disabled = true;
    $('keyboard').classList.add('busy');
    renderRunButton();
    updateOutputButtons();
    $('msg-out').value = '';
    let raw = '';
    for (const ch of src) {
      if (cancelRun) break;
      const interval = 720 - state.speed * 64;
      if (ch >= 'A' && ch <= 'Z') {
        const r = pressDown(ch, 'anim');
        raw += r.output;
        $('msg-out').value = formatOutput(raw);
        await sleep(interval * 0.6);
        release();
        await sleep(interval * 0.4);
      } else if (!lettersOnly) {
        raw += ch;
        $('msg-out').value = formatOutput(raw);
        await sleep(interval * 0.3);
      }
    }
    busy = false;
    $('settings-fieldset').disabled = false;
    $('keyboard').classList.remove('busy');
    renderRunButton();
    toast(cancelRun ? 'Stopped' : verb + ' — the result is ready to copy');
    finishRun();
  }

  function finishRun() {
    updateOutputButtons();
    renderPosStatus();
    if (exampleActive && state.mode === 'decrypt') $('example-note').innerHTML = EXAMPLE.after;
  }

  function setExample(on) {
    exampleActive = on;
    $('example-note').hidden = !on;
    if (on) $('example-note').innerHTML = EXAMPLE.before;
  }

  function loadExample() {
    if (busy) return;
    Object.assign(state, JSON.parse(JSON.stringify(EXAMPLE.key)));
    state.mode = 'decrypt';
    state.fmt = 'x';
    applySettings({ quiet: true });
    renderMode();
    $('msg-in').value = EXAMPLE.cipher;
    $('msg-out').value = '';
    updateOutputButtons();
    updateMsgNote();
    setExample(true);
    saveState();
    $('btn-run').focus();
    toast('Loaded a real 1941 message and its key');
  }

  /* ------------------------------------------------------------------
   * Settings handlers
   * ------------------------------------------------------------------ */
  function onRotorTableChange(e) {
    const sel = e.target;
    const i = Number(sel.dataset.i);
    if (sel.dataset.kind === 'rotor') {
      const chosen = sel.value;
      const other = state.rotors.indexOf(chosen);
      if (other >= 0 && other !== i) {
        state.rotors[other] = state.rotors[i]; // a rotor can only be in one slot — swap them
        toast('Rotor ' + chosen + ' was already in the ' + SLOTS[other].toLowerCase() + ' slot, so they swapped places');
      }
      state.rotors[i] = chosen;
    } else if (sel.dataset.kind === 'ring') {
      state.rings[i] = Number(sel.value);
    } else {
      state.start[i] = Number(sel.value);
    }
    applySettings();
  }

  function onModelChange() {
    state.model = $('model').value;
    const m = MODELS[state.model];
    if (m.reflectors.indexOf(state.reflector) < 0) state.reflector = 'B';
    for (let i = 0; i < 3; i++) {
      if (m.rotors.indexOf(state.rotors[i]) < 0) {
        state.rotors[i] = m.rotors.find((r) => state.rotors.indexOf(r) < 0);
      }
    }
    applySettings();
  }

  function onPlugsInput(final) {
    const input = $('plugs');
    const text = input.value;
    try {
      const pairs = Enigma.parsePlugboard(text);
      input.classList.remove('invalid');
      $('plugs-error').textContent = '';
      if (pairs.join(' ') !== state.plugs.join(' ')) {
        state.plugs = pairs;
        plugSel = null;
        applySettings();
      }
      if (final) input.value = pairs.join(' ');
    } catch (err) {
      // While typing the 2nd letter of a pair, don't nag yet.
      const lastToken = text.toUpperCase().replace(/[^A-Z]+/g, ' ').trim().split(' ').pop();
      const midPair = !final && lastToken.length === 1 && /incomplete|two letters/.test(err.message);
      if (!midPair) {
        input.classList.add('invalid');
        $('plugs-error').textContent = err.message;
      }
    }
  }

  function randomKey() {
    if (busy) return;
    const m = MODELS[state.model];
    const pool = m.rotors.slice();
    const pick = () => pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const rnd = () => Math.floor(Math.random() * 26);
    state.rotors = [pick(), pick(), pick()];
    state.reflector = Math.random() < 0.5 ? 'B' : 'C';
    state.rings = [rnd(), rnd(), rnd()];
    state.start = [rnd(), rnd(), rnd()];
    const letters = A.split('').sort(() => Math.random() - 0.5);
    state.plugs = [];
    for (let i = 0; i < 10; i++) state.plugs.push(letters[i * 2] + letters[i * 2 + 1]);
    applySettings({ quiet: true });
    toast('New random key — copy it and send it to your friend');
  }

  function applyKey(k) {
    Object.assign(state, k);
    plugSel = null;
    applySettings({ quiet: true });
  }

  /* ------------------------------------------------------------------
   * Helpers: clipboard, toast, announcements
   * ------------------------------------------------------------------ */
  async function copyText(text, what) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e2) { /* ignore */ }
      ta.remove();
    }
    toast(what + ' copied to the clipboard');
  }

  let toastTimer = null;
  function toast(msg, isError) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('error', !!isError);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), isError ? 3600 : 2600);
  }
  const announce = (msg) => toast(msg);

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  /* ------------------------------------------------------------------
   * Wiring up events
   * ------------------------------------------------------------------ */
  function bindEvents() {
    // Physical keyboard -> machine keys
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { cancelPlug(); return; }
      if (document.querySelector('dialog[open]')) return;
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1 || !/[a-z]/i.test(e.key)) return;
      e.preventDefault();
      if (e.repeat) return;
      pressDown(e.key.toUpperCase(), 'kbd');
    });
    document.addEventListener('keyup', (e) => {
      if (held && held.source === 'kbd' && e.key.toUpperCase() === held.letter) release();
    });
    window.addEventListener('blur', () => { if (held && held.source !== 'anim') release(); });

    // First interaction unlocks audio (browser autoplay rules)
    const unlock = () => Sound.unlock();
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });

    // Soft click on ordinary buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('.btn, .mode-tab, .turn-btn') && !e.target.closest('#btn-run')) Sound.ui();
    });

    // Sound controls
    $('btn-sound').addEventListener('click', () => {
      state.muted = !state.muted;
      Sound.setMuted(state.muted);
      $('btn-sound').setAttribute('aria-pressed', String(!state.muted));
      saveState();
      if (!state.muted) Sound.keyDown();
    });
    $('volume').addEventListener('input', (e) => {
      state.volume = Number(e.target.value);
      Sound.setVolume(state.volume / 100);
      if (state.muted && state.volume > 0) { state.muted = false; Sound.setMuted(false); $('btn-sound').setAttribute('aria-pressed', 'true'); }
      saveState();
    });
    $('volume').addEventListener('change', () => Sound.wheelTick());

    // Machine
    $('btn-reset').addEventListener('click', resetToStart);
    $('btn-copy-tape').addEventListener('click', () => copyText(tape.out.replace(/(.{5})/g, '$1 ').trim(), 'Tape output'));
    $('btn-clear-tape').addEventListener('click', clearTape);

    // Message
    $('tab-encrypt').addEventListener('click', () => setMode('encrypt'));
    $('tab-decrypt').addEventListener('click', () => setMode('decrypt'));
    $('msg-in').addEventListener('input', updateMsgNote);
    $('msg-in').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runMessage(); }
    });
    $('fmt').addEventListener('change', (e) => { state.fmt = e.target.value; saveState(); updateMsgNote(); });
    $('animate').addEventListener('change', (e) => { state.animate = e.target.checked; saveState(); updateMsgNote(); });
    $('speed').addEventListener('input', (e) => { state.speed = Number(e.target.value); saveState(); });
    $('btn-run').addEventListener('click', runMessage);
    $('btn-clear-msg').addEventListener('click', () => {
      $('msg-in').value = ''; $('msg-out').value = '';
      setExample(false); updateMsgNote(); updateOutputButtons(); $('msg-in').focus();
    });
    $('btn-copy-out').addEventListener('click', () => copyText($('msg-out').value, state.mode === 'encrypt' ? 'Ciphertext' : 'Plaintext'));
    $('btn-swap').addEventListener('click', () => {
      const out = $('msg-out').value;
      setMode(state.mode === 'encrypt' ? 'decrypt' : 'encrypt');
      $('msg-in').value = out;
      $('msg-out').value = '';
      updateMsgNote(); updateOutputButtons();
      toast('Moved to the ' + (state.mode === 'encrypt' ? 'Encrypt' : 'Decrypt') + ' tab — same key, same start position');
    });
    $('btn-example').addEventListener('click', loadExample);

    // Settings
    $('model').addEventListener('change', onModelChange);
    $('reflector').addEventListener('change', (e) => { state.reflector = e.target.value; applySettings(); });
    $('plugs').addEventListener('input', () => onPlugsInput(false));
    $('plugs').addEventListener('blur', () => onPlugsInput(true));
    $('numbers').addEventListener('change', (e) => { state.numbers = e.target.checked; saveState(); renderAllRotors(); });
    $('btn-random').addEventListener('click', randomKey);
    $('btn-copy-key').addEventListener('click', () => copyText(formatKey(state), 'Key'));
    $('btn-default-key').addEventListener('click', () => { if (!busy) { applyKey(pickKey(DEFAULTS)); toast('Settings back to the defaults'); } });

    // Load-key dialog
    const loadDlg = $('load-dialog');
    $('btn-load-key').addEventListener('click', () => {
      if (busy) return;
      $('load-text').value = '';
      $('load-error').textContent = '';
      loadDlg.showModal();
      $('load-text').focus();
    });
    $('load-apply').addEventListener('click', () => {
      try {
        const k = parseKey($('load-text').value);
        applyKey(k);
        loadDlg.close();
        toast('Key loaded: ' + k.rotors.join('-') + ', start ' + k.start.map((n) => A[n]).join(''));
      } catch (err) {
        Sound.error();
        $('load-error').textContent = err.message;
      }
    });

    // Guide & welcome
    const guide = $('guide');
    const openGuide = () => guide.showModal();
    const closeWelcome = () => { $('welcome').hidden = true; state.welcomed = true; saveState(); };
    $('btn-guide').addEventListener('click', openGuide);
    $('guide-close').addEventListener('click', () => guide.close());
    $('guide-ok').addEventListener('click', () => { guide.close(); closeWelcome(); });
    $('welcome-guide').addEventListener('click', () => { openGuide(); closeWelcome(); });
    $('welcome-close').addEventListener('click', closeWelcome);
    [guide, loadDlg].forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
  }

  function setMode(mode) {
    if (busy || state.mode === mode) return;
    state.mode = mode;
    saveState();
    renderMode();
    if (exampleActive && mode === 'encrypt') setExample(false);
  }

  /* ------------------------------------------------------------------
   * Start-up
   * ------------------------------------------------------------------ */
  function init() {
    // A key in the URL (#key=...) overrides the saved one.
    const m = location.hash.match(/key=([^&]+)/);
    if (m) {
      try { Object.assign(state, parseKey(decodeURIComponent(m[1]))); } catch (e) { /* ignore bad links */ }
    }

    buildRotors();
    buildBoards();

    const legend = document.createElement('p');
    legend.className = 'trace-legend';
    legend.id = 'trace-legend';
    legend.hidden = true;
    legend.innerHTML = 'Current flows <span class="d" style="background:#3e5a6e"></span>right → left into the reflector, ' +
      'then <span class="d" style="background:#7a4a4a"></span>back left → right by a different path. ' +
      'That’s why a letter can never become itself.';
    $('trace').after(legend);

    Sound.setMuted(state.muted);
    Sound.setVolume(state.volume / 100);
    $('btn-sound').setAttribute('aria-pressed', String(!state.muted));
    $('volume').value = state.volume;
    $('animate').checked = state.animate;
    $('speed').value = state.speed;
    if (!state.welcomed) $('welcome').hidden = false;

    bindEvents();
    applySettings({ quiet: true });
    renderMode();
    updateOutputButtons();
  }

  init();
})();
