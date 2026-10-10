// Run with:  node tests/enigma.test.js
// Checks the engine against well-known historical / reference test vectors.
'use strict';
const assert = require('assert');
const Enigma = require('../js/enigma.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✔ ' + name); }
  catch (e) { console.error('  ✘ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

console.log('Enigma engine tests');

test('AAAAA → BDZGO (I-II-III, UKW-B, rings AAA, start AAA)', () => {
  const m = new Enigma({ rotors: ['I', 'II', 'III'], reflector: 'B' });
  assert.strictEqual(m.process('AAAAA'), 'BDZGO');
});

test('Encryption is reciprocal (same settings decrypt)', () => {
  const cfg = { rotors: ['IV', 'II', 'V'], rings: ['C', 'Q', 'F'], positions: ['M', 'X', 'Z'], reflector: 'C', plugboard: 'AZ BY CX DW' };
  const plain = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG';
  const cipher = new Enigma(cfg).process(plain);
  assert.notStrictEqual(cipher, plain);
  assert.strictEqual(new Enigma(cfg).process(cipher), plain);
});

test('A letter never encrypts to itself', () => {
  const m = new Enigma({ rotors: ['I', 'II', 'III'] });
  const out = m.process('E'.repeat(2000));
  assert.ok(!out.includes('E'));
});

test('Double stepping: ADU → ADV → AEW → BFX', () => {
  const m = new Enigma({ rotors: ['I', 'II', 'III'], positions: ['A', 'D', 'U'] });
  const seen = [];
  for (let i = 0; i < 3; i++) seen.push(m.pressKey('A').positions);
  assert.deepStrictEqual(seen, ['ADV', 'AEW', 'BFX']);
});

test('Rotors VI–VIII turn over at both Z and M', () => {
  const m = new Enigma({ rotors: ['I', 'II', 'VI'], positions: ['A', 'A', 'M'] });
  m.pressKey('A');
  assert.strictEqual(m.getPositions(), 'ABN');
  m.setPositions('AAZ');
  m.pressKey('A');
  assert.strictEqual(m.getPositions(), 'ABA');
});

test('Operation Barbarossa message, 7 July 1941', () => {
  const m = new Enigma({
    rotors: ['II', 'IV', 'V'], rings: [2, 21, 12].map(n => n - 1), positions: 'BLA'.split(''),
    reflector: 'B', plugboard: 'AV BS CG DL FU HZ IN KM OW RX'
  });
  const cipher = 'EDPUD NRGYS ZRCXN UYTPO MRMBO FKTBZ REZKM LXLVE FGUEY SIOZV EQMIK UBPMM YLKLT TDEIS MDICA GYKUA CTCDO MOHWX MUUIA UBSTS LRNBZ SZWNR FXWFY SSXJZ VIJHI DISHP RKLKA YUPAD TXQSP INQMA TLPIF SVKDA SCTAC DPBOP VHJK';
  const plain = m.process(cipher, { lettersOnly: true });
  assert.ok(plain.startsWith('AUFKLXABTEILUNGXVONXKURTINOWAXKURTINOWAX'), plain);
});

test('Plugboard validation gives friendly errors', () => {
  assert.throws(() => Enigma.parsePlugboard('AB AC'), /more than one/);
  assert.throws(() => Enigma.parsePlugboard('AA'), /itself/);
  assert.throws(() => Enigma.parsePlugboard('ABC'), /two letters/);
  assert.deepStrictEqual(Enigma.parsePlugboard('ab, cd'), ['AB', 'CD']);
});

test('Signal path trace has 11 stages and ends at the output lamp', () => {
  const r = new Enigma().pressKey('A');
  assert.strictEqual(r.path.length, 11);
  assert.strictEqual(r.path[10].letter, r.output);
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
