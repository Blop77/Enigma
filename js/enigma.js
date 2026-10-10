/*
 * enigma.js — historically accurate Enigma I / M3 cipher engine.
 *
 * Models:
 *   - Rotors I–VIII with their real wirings and turnover notches
 *   - Reflectors UKW-A, UKW-B, UKW-C
 *   - Ring settings (Ringstellung) and start positions (Grundstellung)
 *   - Plugboard (Steckerbrett) with up to 13 pairs
 *   - The famous "double-stepping" anomaly of the middle rotor
 *
 * Works in the browser (window.Enigma) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  var ROTORS = {
    I:    { wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notches: 'Q',  note: 'Enigma I, 1930' },
    II:   { wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notches: 'E',  note: 'Enigma I, 1930' },
    III:  { wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', notches: 'V',  note: 'Enigma I, 1930' },
    IV:   { wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', notches: 'J',  note: 'M3 Army, Dec 1938' },
    V:    { wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK', notches: 'Z',  note: 'M3 Army, Dec 1938' },
    VI:   { wiring: 'JPGVOUMFYQBENHZRDKASXLICTW', notches: 'ZM', note: 'M3 & M4 Navy, 1939' },
    VII:  { wiring: 'NZJHGRCXMYSWBOUFAIVLPEKQDT', notches: 'ZM', note: 'M3 & M4 Navy, 1939' },
    VIII: { wiring: 'FKQHTLXOCBJSPDZRAMEWNIUYGV', notches: 'ZM', note: 'M3 & M4 Navy, 1939' }
  };

  var REFLECTORS = {
    A: { wiring: 'EJMZALYXVBWFCRQUONTSPIKHGD', note: 'UKW-A, pre-war' },
    B: { wiring: 'YRUHQSLDPXNGOKMIEBFZCWVJAT', note: 'UKW-B, the standard wartime reflector' },
    C: { wiring: 'FVPJIAOYEDRZXWGCTKUQSBNMHL', note: 'UKW-C, used 1940–1945' }
  };

  function mod(n, m) { return ((n % m) + m) % m; }
  function toIndex(ch) { return ALPHABET.indexOf(ch); }
  function toChar(i) { return ALPHABET[mod(i, 26)]; }

  function Rotor(name, ring, position) {
    var spec = ROTORS[name];
    if (!spec) throw new Error('Unknown rotor: ' + name);
    this.name = name;
    this.forward = spec.wiring.split('').map(toIndex);
    this.backward = new Array(26);
    for (var i = 0; i < 26; i++) this.backward[this.forward[i]] = i;
    this.notches = spec.notches.split('').map(toIndex);
    this.ring = ring || 0;         // 0..25  (A = 01)
    this.position = position || 0; // 0..25  letter visible in the window
  }
  Rotor.prototype.atNotch = function () {
    return this.notches.indexOf(this.position) !== -1;
  };
  Rotor.prototype.step = function () {
    this.position = mod(this.position + 1, 26);
  };
  Rotor.prototype.encodeForward = function (c) {
    var shift = this.position - this.ring;
    return mod(this.forward[mod(c + shift, 26)] - shift, 26);
  };
  Rotor.prototype.encodeBackward = function (c) {
    var shift = this.position - this.ring;
    return mod(this.backward[mod(c + shift, 26)] - shift, 26);
  };

  /**
   * Parse "AB CD EF" (or "AB,CD" / "ab-cd") into an array of pairs.
   * Throws a friendly Error when the plugboard is invalid.
   */
  function parsePlugboard(text) {
    var cleaned = String(text || '').toUpperCase().replace(/[^A-Z]+/g, ' ').trim();
    if (!cleaned) return [];
    var pairs = cleaned.split(/\s+/);
    var used = {};
    pairs.forEach(function (p) {
      if (p.length !== 2) throw new Error('Plugboard pairs must be two letters each — "' + p + '" is not.');
      if (p[0] === p[1]) throw new Error('A letter cannot be plugged to itself ("' + p + '").');
      for (var k = 0; k < 2; k++) {
        if (used[p[k]]) throw new Error('Letter ' + p[k] + ' is used in more than one plugboard pair.');
        used[p[k]] = true;
      }
    });
    if (pairs.length > 13) throw new Error('At most 13 plugboard pairs are possible.');
    return pairs;
  }

  /**
   * new Enigma({
   *   rotors:    ['I', 'II', 'III'],   // left, middle, right
   *   rings:     [0, 0, 0],            // 0..25 or 'A'..'Z'
   *   positions: [0, 0, 0],            // 0..25 or 'A'..'Z'
   *   reflector: 'B',
   *   plugboard: 'AB CD'               // string or array of pairs
   * })
   */
  function Enigma(config) {
    config = config || {};
    var names = config.rotors || ['I', 'II', 'III'];
    var rings = (config.rings || [0, 0, 0]).map(normalise);
    var positions = (config.positions || [0, 0, 0]).map(normalise);
    if (names.length !== 3) throw new Error('Exactly three rotors are required.');
    this.rotors = names.map(function (n, i) { return new Rotor(n, rings[i], positions[i]); });

    var refName = config.reflector || 'B';
    if (!REFLECTORS[refName]) throw new Error('Unknown reflector: ' + refName);
    this.reflectorName = refName;
    this.reflector = REFLECTORS[refName].wiring.split('').map(toIndex);

    this.setPlugboard(config.plugboard || []);
  }

  function normalise(v) {
    if (typeof v === 'string') {
      var s = v.trim().toUpperCase();
      if (/^[A-Z]$/.test(s)) return toIndex(s);
      v = parseInt(s, 10) - 1; // "01".."26"
    }
    if (typeof v !== 'number' || isNaN(v)) throw new Error('Invalid rotor setting: ' + v);
    return mod(v, 26);
  }

  Enigma.prototype.setPlugboard = function (pairs) {
    if (typeof pairs === 'string') pairs = parsePlugboard(pairs);
    else parsePlugboard(pairs.join(' ')); // validate
    var map = [];
    for (var i = 0; i < 26; i++) map[i] = i;
    pairs.forEach(function (p) {
      var a = toIndex(p[0].toUpperCase()), b = toIndex(p[1].toUpperCase());
      map[a] = b; map[b] = a;
    });
    this.plugMap = map;
    this.plugPairs = pairs.map(function (p) { return p.toUpperCase(); });
  };

  Enigma.prototype.getPositions = function () {
    return this.rotors.map(function (r) { return toChar(r.position); }).join('');
  };

  Enigma.prototype.setPositions = function (positions) {
    var list = typeof positions === 'string' ? positions.split('') : positions;
    for (var i = 0; i < 3; i++) this.rotors[i].position = normalise(list[i]);
  };

  /**
   * Advance the rotors exactly like the real pawl-and-ratchet mechanism.
   * Returns which rotors moved: [left, middle, right].
   */
  Enigma.prototype.stepRotors = function () {
    var L = this.rotors[0], M = this.rotors[1], R = this.rotors[2];
    var moved = [false, false, true];
    if (M.atNotch()) {          // double step: middle pawl pushes both
      M.step(); L.step();
      moved[0] = moved[1] = true;
    } else if (R.atNotch()) {
      M.step();
      moved[1] = true;
    }
    R.step();
    return moved;
  };

  /**
   * Press one key. Steps the rotors first (as on the real machine), then
   * sends current through the scrambler. Returns a detailed trace object.
   */
  Enigma.prototype.pressKey = function (letter) {
    var ch = String(letter).toUpperCase();
    var c = toIndex(ch);
    if (c < 0) throw new Error('Only letters A–Z can be typed on an Enigma.');

    var moved = this.stepRotors();
    var path = [{ stage: 'Keyboard', letter: ch }];

    c = this.plugMap[c];
    path.push({ stage: 'Plugboard', letter: toChar(c) });

    for (var i = 2; i >= 0; i--) {
      c = this.rotors[i].encodeForward(c);
      path.push({ stage: 'Rotor ' + this.rotors[i].name, dir: 'in', letter: toChar(c) });
    }

    c = this.reflector[c];
    path.push({ stage: 'Reflector ' + this.reflectorName, letter: toChar(c) });

    for (var j = 0; j <= 2; j++) {
      c = this.rotors[j].encodeBackward(c);
      path.push({ stage: 'Rotor ' + this.rotors[j].name, dir: 'out', letter: toChar(c) });
    }

    c = this.plugMap[c];
    path.push({ stage: 'Plugboard', letter: toChar(c) });
    path.push({ stage: 'Lamp', letter: toChar(c) });

    return { input: ch, output: toChar(c), moved: moved, positions: this.getPositions(), path: path };
  };

  /**
   * Encrypt/decrypt a whole string. Enigma is reciprocal, so the same call
   * decrypts when the machine starts from the same settings.
   * Non-letters are kept unchanged unless options.lettersOnly is true.
   */
  Enigma.prototype.process = function (text, options) {
    options = options || {};
    var out = '';
    var src = String(text).toUpperCase();
    for (var i = 0; i < src.length; i++) {
      var ch = src[i];
      if (ch >= 'A' && ch <= 'Z') out += this.pressKey(ch).output;
      else if (!options.lettersOnly) out += src[i];
    }
    return out;
  };

  Enigma.ALPHABET = ALPHABET;
  Enigma.ROTORS = ROTORS;
  Enigma.REFLECTORS = REFLECTORS;
  Enigma.parsePlugboard = parsePlugboard;

  if (typeof module !== 'undefined' && module.exports) module.exports = Enigma;
  else root.Enigma = Enigma;
})(typeof window !== 'undefined' ? window : this);
