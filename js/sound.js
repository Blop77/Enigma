/*
 * sound.js — mechanical sound effects synthesised with the Web Audio API.
 * No audio files are needed; every click is generated on the fly.
 */
(function (root) {
  'use strict';

  var ctx = null;
  var master = null;
  var noiseBuffer = null;
  var muted = false;
  var volume = 0.7;

  function ensure() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);

      // One second of white noise, reused by every percussive sound.
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var data = noiseBuffer.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // A filtered noise burst — the basis of every "clack".
  function burst(opts) {
    var c = ensure();
    if (!c || muted) return;
    var t = c.currentTime + (opts.delay || 0);
    var src = c.createBufferSource();
    src.buffer = noiseBuffer;
    src.playbackRate.value = 0.9 + Math.random() * 0.2; // tiny variation, sounds less robotic
    var filter = c.createBiquadFilter();
    filter.type = opts.type || 'bandpass';
    filter.frequency.value = opts.freq * (0.95 + Math.random() * 0.1);
    filter.Q.value = opts.q || 1;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + opts.decay + 0.02);
  }

  // A short pitched body resonance — gives keys their "weight".
  function thump(opts) {
    var c = ensure();
    if (!c || muted) return;
    var t = c.currentTime + (opts.delay || 0);
    var osc = c.createOscillator();
    osc.type = opts.wave || 'sine';
    osc.frequency.setValueAtTime(opts.freq, t);
    osc.frequency.exponentialRampToValueAtTime(opts.freq * 0.5, t + opts.decay);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);
    osc.connect(g); g.connect(master);
    osc.start(t);
    osc.stop(t + opts.decay + 0.02);
  }

  var Sound = {
    /** Heavy key going down: thick clack + wooden body thump. */
    keyDown: function () {
      burst({ freq: 2200, q: 0.8, gain: 0.55, decay: 0.05 });
      burst({ freq: 900, q: 1.5, gain: 0.35, decay: 0.07 });
      thump({ freq: 140, gain: 0.45, decay: 0.09 });
    },
    /** Key spring returning. */
    keyUp: function () {
      burst({ freq: 3200, q: 1.2, gain: 0.18, decay: 0.03 });
      thump({ freq: 220, gain: 0.12, decay: 0.04 });
    },
    /**
     * Rotor ratchet clicks. `moved` = [left, middle, right]; one click per
     * rotor that stepped, slightly staggered so double steps are audible.
     */
    rotorStep: function (moved) {
      var n = 0;
      for (var i = 2; i >= 0; i--) {
        if (!moved || moved[i]) {
          burst({ freq: 4200 - i * 400, q: 3, gain: 0.3, decay: 0.025, delay: 0.012 + n * 0.035 });
          thump({ freq: 600 - i * 80, gain: 0.08, decay: 0.03, delay: 0.012 + n * 0.035, wave: 'triangle' });
          n++;
        }
      }
    },
    /** Turning a rotor by hand with its thumbwheel. */
    wheelTick: function () {
      burst({ freq: 5200, q: 4, gain: 0.25, decay: 0.02 });
      burst({ freq: 1800, q: 2, gain: 0.1, decay: 0.03, delay: 0.008 });
    },
    /** Pushing a plug into the plugboard socket. */
    plugIn: function () {
      burst({ freq: 1200, q: 2, gain: 0.4, decay: 0.06 });
      thump({ freq: 180, gain: 0.3, decay: 0.08 });
    },
    /** Pulling a plug out. */
    plugOut: function () {
      burst({ freq: 2600, q: 1.5, gain: 0.3, decay: 0.05 });
      thump({ freq: 260, gain: 0.15, decay: 0.05, delay: 0.01 });
    },
    /** Lamp filament: faint electrical tick. */
    lamp: function () {
      thump({ freq: 1800, gain: 0.04, decay: 0.05, wave: 'square' });
    },
    /** Soft switch click for ordinary UI buttons. */
    ui: function () {
      burst({ freq: 3000, q: 2, gain: 0.18, decay: 0.025 });
    },
    /** Error buzz. */
    error: function () {
      thump({ freq: 110, gain: 0.2, decay: 0.18, wave: 'sawtooth' });
    },

    setMuted: function (m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : volume;
    },
    isMuted: function () { return muted; },
    setVolume: function (v) {
      volume = Math.max(0, Math.min(1, v));
      if (master && !muted) master.gain.value = volume;
    },
    getVolume: function () { return volume; },
    /** Browsers only allow audio after a user gesture; call from one. */
    unlock: function () { ensure(); }
  };

  root.Sound = Sound;
})(window);
