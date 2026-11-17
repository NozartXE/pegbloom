// Generated WebAudio sound: seeded pentatonic plucks over a warm pad, garden sound effects and a mute, all silent in headless Node.
(function () {
  if (typeof globalThis.PB_Audio === 'object' && globalThis.PB_Audio !== null) return;

  const SFX_GAP_TICKS = 3;

  function config() {
    const c = globalThis.PB_CONFIG || {};
    return c.audio || { masterVolume: 0.5, musicVolume: 0.35, sfxVolume: 0.7, pentatonic: [0, 2, 4, 7, 9], rootHz: 220 };
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  const state = {
    ctx: null,
    master: null,
    music: null,
    sfxBus: null,
    padOsc: [],
    padGain: null,
    lastTick: null,
    lastSfxTick: {},
    step: 0,
    stepClock: 0,
    muted: false,
    musicVol: num(config().musicVolume, 0.35),
    sfxVol: num(config().sfxVolume, 0.7),
    calls: { sfx: 0, music: 0 },
    seed: 'pegbloom',
    rng: null,
    enabled: false,
  };

  function saveSettings() {
    const save = globalThis.PB_Save;
    if (save && typeof save.setSettings === 'function') {
      try {
        save.setSettings({ music: state.musicVol, sfx: state.sfxVol, muted: state.muted });
      } catch (err) {
        /* persistence is optional */
      }
    }
  }

  function loadSettings() {
    const save = globalThis.PB_Save;
    if (!save || typeof save.settings !== 'function') return;
    try {
      const s = save.settings();
      if (s) {
        state.musicVol = clamp(num(s.music, state.musicVol), 0, 1);
        state.sfxVol = clamp(num(s.sfx, state.sfxVol), 0, 1);
        state.muted = s.muted === true;
      }
    } catch (err) {
      /* defaults stay */
    }
  }

  function Ctor() {
    if (typeof globalThis.AudioContext === 'function') return globalThis.AudioContext;
    if (typeof globalThis.webkitAudioContext === 'function') return globalThis.webkitAudioContext;
    return null;
  }

  function ensure() {
    if (state.enabled) return true;
    const AC = Ctor();
    if (!AC) return false;
    try {
      const ctx = new AC();
      state.ctx = ctx;
      state.master = ctx.createGain();
      state.master.gain.value = state.muted ? 0 : num(config().masterVolume, 0.5);
      state.master.connect(ctx.destination);
      state.music = ctx.createGain();
      state.music.gain.value = state.musicVol * 0.5;
      state.music.connect(state.master);
      state.sfxBus = ctx.createGain();
      state.sfxBus.gain.value = state.sfxVol;
      state.sfxBus.connect(state.master);
      const padGain = ctx.createGain();
      padGain.gain.value = 0.08;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      padGain.connect(filter);
      filter.connect(state.music);
      state.padGain = padGain;
      const root = num(config().rootHz, 220);
      const freqs = [root / 2, root * 0.75, root * 2 / 3];
      for (let i = 0; i < freqs.length; i += 1) {
        const osc = ctx.createOscillator();
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.value = freqs[i] * (i === 2 ? 0.5 : 1);
        osc.detune.value = i * 3;
        osc.connect(padGain);
        osc.start();
        state.padOsc.push(osc);
      }
      state.enabled = true;
      return true;
    } catch (err) {
      state.ctx = null;
      state.enabled = false;
      return false;
    }
  }

  function init(opts) {
    loadSettings();
    if (!ensure()) {
      if (opts && opts.silent !== true) return false;
      return false;
    }
    if (state.ctx && state.ctx.state === 'suspended' && typeof state.ctx.resume === 'function') {
      try {
        state.ctx.resume();
      } catch (err) {
        /* resume can reject without a gesture; the next init tries again */
      }
    }
    return true;
  }

  function now() {
    return state.ctx ? state.ctx.currentTime : 0;
  }

  function synthRng() {
    if (!state.rng) state.rng = globalThis.PB_RNG.create('music:' + state.seed);
    return state.rng;
  }

  function setSeed(seed) {
    state.seed = seed == null ? 'music' : String(seed);
    state.rng = globalThis.PB_RNG.create('music:' + state.seed);
    state.step = 0;
  }

  function noteHz(degree, octave) {
    const c = config();
    const scale = c.pentatonic && c.pentatonic.length ? c.pentatonic : [0, 2, 4, 7, 9];
    const d = ((degree % scale.length) + scale.length) % scale.length;
    const oct = octave + Math.floor(degree / scale.length);
    return num(c.rootHz, 220) * Math.pow(2, (scale[d] + 12 * oct) / 12);
  }

  function tone(freq, when, dur, vol, type, dest) {
    const ctx = state.ctx;
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'triangle';
      osc.frequency.setValueAtTime(Math.max(40, freq), when);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.linearRampToValueAtTime(Math.max(0.0001, vol), when + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.05, dur));
      osc.connect(gain);
      gain.connect(dest || state.sfxBus);
      osc.start(when);
      osc.stop(when + Math.max(0.06, dur) + 0.02);
    } catch (err) {
      /* a failed node must never stop the game */
    }
  }

  function sweep(from, to, when, dur, vol, type, dest) {
    const ctx = state.ctx;
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(Math.max(30, from), when);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), when + dur);
      gain.gain.setValueAtTime(Math.max(0.0001, vol), when);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      osc.connect(gain);
      gain.connect(dest || state.sfxBus);
      osc.start(when);
      osc.stop(when + dur + 0.02);
    } catch (err) {
      /* ignore */
    }
  }

  // Real sounds share the sfx bus; the silent default (no AudioContext) still tracks call counts so
  // tools can verify that a cue was requested.
  function synthDest(bus) {
    const key = bus === 'music' ? 'music' : 'sfx';
    state.calls[key] = num(state.calls[key], 0) + 1;
    if (!state.ctx) return null;
    return key === 'music' ? state.music : state.sfxBus;
  }

  function pluck(when, vol) {
    const rng = synthRng();
    const degree = Math.floor(rng.next() * 7);
    const octave = rng.next() < 0.3 ? 2 : 1;
    const hz = noteHz(degree, octave);
    tone(hz, when, 0.9, vol, 'triangle', synthDest('pluck'));
    tone(hz * 2, when + 0.005, 0.25, vol * 0.22, 'sine', synthDest('pluck'));
  }

  // A slow seeded pattern: pluck on most eighth-note steps, with a livelier run when the cascade is hot.
  // Without an AudioContext it still advances its seeded clock, so headless runs replay the same notes.
  function step(dt, cascade) {
    if (!state.enabled && state.ctx) return;
    const hot = clamp(num(cascade, 1), 1, 8);
    const interval = 0.36 / (1 + (hot - 1) * 0.14);
    state.stepClock += num(dt, 0);
    let guard = 0;
    while (state.stepClock >= interval && guard < 4) {
      state.stepClock -= interval;
      state.step += 1;
      const rng = synthRng();
      if (!state.ctx) {
        state.calls.music = num(state.calls.music, 0) + 1;
        rng.next();
      } else if (rng.next() < 0.62) pluck(now() + 0.02, 0.10 + 0.02 * hot);
      if (state.step % 16 === 0 && state.ctx) {
        const hz = noteHz(Math.floor(rng.next() * 5), 0);
        tone(hz, now() + 0.02, 2.4, 0.05, 'sine', state.music);
      }
      guard += 1;
    }
  }

  function sfx(name, data, sim) {
    if (state.muted) return false;
    if (!state.ctx) {
      state.calls.sfx = num(state.calls.sfx, 0) + 1;
      return true;
    }
    const tick = sim && typeof sim.tick === 'number' ? sim.tick : -1;
    if (tick >= 0) {
      const last = state.lastSfxTick[name];
      if (last != null && tick - last < SFX_GAP_TICKS && name !== 'bossHit') return false;
      state.lastSfxTick[name] = tick;
    }
    const t = now() + 0.01;
    const mult = clamp(num(data && data.mult, sim && sim.cascade && sim.cascade.mult, 1), 1, 8);
    switch (name) {
      case 'drop':
        tone(noteHz(0, 2), t, 0.09, 0.10, 'sine');
        break;
      case 'peg':
        tone(noteHz(3 + (mult % 5), 2 + (mult >= 5 ? 1 : 0)), t, 0.12, 0.05, 'triangle');
        break;
      case 'bloom': {
        const base = 2 + mult;
        tone(noteHz(base, 2), t, 0.35, 0.14, 'sine');
        tone(noteHz(base + 2, 2), t + 0.06, 0.4, 0.10, 'triangle');
        tone(noteHz(base + 4, 3), t + 0.12, 0.5, 0.06, 'sine');
        break;
      }
      case 'drain':
        sweep(180, 55, t, 0.38, 0.18, 'sine');
        break;
      case 'pestHit':
        tone(noteHz(1, 1), t, 0.1, 0.09, 'square');
        break;
      case 'pestClear':
        tone(noteHz(5, 2), t, 0.16, 0.12, 'triangle');
        tone(noteHz(7, 2), t + 0.07, 0.22, 0.09, 'triangle');
        break;
      case 'bossHit':
        sweep(90, 140, t, 0.22, 0.20, 'sawtooth');
        tone(noteHz(0, 0), t, 0.3, 0.08, 'square');
        break;
      case 'bossDown':
        jingle(true, t);
        break;
      case 'win':
        jingle(true, t);
        break;
      case 'lose':
        jingle(false, t);
        break;
      case 'draft':
        tone(noteHz(4, 2), t, 0.2, 0.12, 'triangle');
        tone(noteHz(7, 2), t + 0.1, 0.35, 0.12, 'sine');
        tone(noteHz(9, 2), t + 0.2, 0.5, 0.10, 'triangle');
        break;
      case 'gate':
        tone(noteHz(2, 1), t, 0.07, 0.05, 'sine');
        break;
      case 'seed':
        tone(noteHz(9, 3), t, 0.08, 0.07, 'sine');
        break;
      case 'bumper':
        tone(noteHz(2, 2), t, 0.13, 0.09, 'triangle');
        break;
      default:
        return false;
    }
    return true;
  }

  function jingle(winning, t) {
    const steps = winning ? [0, 2, 4, 7, 9, 7, 12] : [4, 2, 0, -1, -3];
    for (let i = 0; i < steps.length; i += 1) {
      tone(noteHz(steps[i], winning ? 2 : 1), t + i * 0.13, winning ? 0.45 : 0.5, 0.13, 'triangle', state.sfxBus);
    }
    if (winning) tone(noteHz(0, 3), t + steps.length * 0.13, 1.2, 0.09, 'sine', state.sfxBus);
  }

  // The sim calls sim.eventsSound(name, data); main wires this to PB_Audio.sfx.
  function attach(sim) {
    if (!sim) return sim;
    sim.eventsSound = function (name, data) {
      return sfx(name, data, sim);
    };
    return sim;
  }

  function setVolumes(music, sfxVol) {
    if (music != null) state.musicVol = clamp(num(music, state.musicVol), 0, 1);
    if (sfxVol != null) state.sfxVol = clamp(num(sfxVol, state.sfxVol), 0, 1);
    if (state.music && state.ctx) state.music.gain.value = state.musicVol * 0.5;
    if (state.sfxBus && state.ctx) state.sfxBus.gain.value = state.sfxVol;
    saveSettings();
  }

  function setMuted(flag) {
    state.muted = flag == null ? !state.muted : flag === true;
    if (state.master && state.ctx) state.master.gain.value = state.muted ? 0 : num(config().masterVolume, 0.5);
    saveSettings();
    return state.muted;
  }

  function toggleMute() {
    return setMuted(!state.muted);
  }

  function isMuted() {
    return state.muted;
  }

  function volumes() {
    return { music: state.musicVol, sfx: state.sfxVol, muted: state.muted };
  }

  function suspend() {
    if (state.ctx && typeof state.ctx.suspend === 'function') {
      try {
        state.ctx.suspend();
      } catch (err) {
        /* ignore */
      }
    }
  }

  loadSettings();

  globalThis.PB_Audio = {
    init: init,
    step: step,
    sfx: sfx,
    attach: attach,
    setVolumes: setVolumes,
    setMuted: setMuted,
    toggleMute: toggleMute,
    isMuted: isMuted,
    volumes: volumes,
    setSeed: setSeed,
    suspend: suspend,
    available: function () { return Ctor() !== null; },
    enabled: function () { return state.enabled; },
    callCounts: function () { return { sfx: state.calls.sfx, music: state.calls.music }; },
  };
})();
