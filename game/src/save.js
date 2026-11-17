// localStorage persistence for PEGBLOOM: best score, last runs, unlocked feats and settings, guarded so headless Node never crashes.
(function () {
  if (typeof globalThis.PB_Save === 'object' && globalThis.PB_Save !== null) return;

  const DEFAULT_SETTINGS = { music: 0.35, sfx: 0.7, muted: false };

  function config() {
    const c = globalThis.PB_CONFIG || {};
    return { save: c.save || { key: 'pegbloom.v1', history: 12, lastRuns: 3 }, audio: c.audio || {} };
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function defaults() {
    const c = config();
    return {
      version: 1,
      best: 0,
      bestByDifficulty: {},
      history: [],
      feats: {},
      settings: {
        music: clamp(num(c.audio.musicVolume, DEFAULT_SETTINGS.music), 0, 1),
        sfx: clamp(num(c.audio.sfxVolume, DEFAULT_SETTINGS.sfx), 0, 1),
        muted: false,
      },
      lastRun: null,
    };
  }

  function storage() {
    try {
      if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage) return null;
      if (typeof globalThis.localStorage.getItem !== 'function') return null;
      return globalThis.localStorage;
    } catch (err) {
      return null;
    }
  }

  function keyName() {
    return config().save.key || 'pegbloom.v1';
  }

  function deepCopy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clean(raw) {
    const base = defaults();
    if (!raw || typeof raw !== 'object') return base;
    const out = base;
    out.best = Math.max(0, Math.round(num(raw.best, 0)));
    if (raw.bestByDifficulty && typeof raw.bestByDifficulty === 'object') {
      for (const k in raw.bestByDifficulty) {
        if (!Object.prototype.hasOwnProperty.call(raw.bestByDifficulty, k)) continue;
        out.bestByDifficulty[k] = Math.max(0, Math.round(num(raw.bestByDifficulty[k], 0)));
      }
    }
    if (Array.isArray(raw.history)) {
      const cap = Math.max(1, num(config().save.history, 12));
      out.history = raw.history.slice(-cap).map(function (r) {
        return {
          score: Math.max(0, Math.round(num(r && r.score, 0))),
          won: !!(r && r.won),
          difficulty: String((r && (r.difficulty || r.diffKey)) || 'Normal'),
          seed: String((r && (r.seed != null ? r.seed : r.runSeed)) || ''),
          shower: Math.max(1, Math.round(num(r && r.shower, 1))),
          reason: String((r && r.reason) || ''),
          date: String((r && r.date) || ''),
        };
      });
    }
    if (raw.feats && typeof raw.feats === 'object') {
      for (const k in raw.feats) if (Object.prototype.hasOwnProperty.call(raw.feats, k) && raw.feats[k]) out.feats[k] = true;
    }
    if (raw.settings && typeof raw.settings === 'object') {
      out.settings.music = clamp(num(raw.settings.music, out.settings.music), 0, 1);
      out.settings.sfx = clamp(num(raw.settings.sfx, out.settings.sfx), 0, 1);
      out.settings.muted = raw.settings.muted === true;
    }
    if (raw.lastRun && typeof raw.lastRun === 'object') out.lastRun = deepCopy(raw.lastRun);
    return out;
  }

  let cache = null;

  function get() {
    if (cache) return cache;
    const store = storage();
    if (!store) {
      cache = defaults();
      return cache;
    }
    try {
      const text = store.getItem(keyName());
      cache = clean(text ? JSON.parse(text) : null);
    } catch (err) {
      cache = defaults();
    }
    return cache;
  }

  function load() {
    cache = null;
    return deepCopy(get());
  }

  function save(data) {
    if (data) cache = clean(data);
    const store = storage();
    if (!store) return false;
    try {
      store.setItem(keyName(), JSON.stringify(get()));
      return true;
    } catch (err) {
      return false;
    }
  }

  function isWin(sim) {
    if (!sim) return false;
    if (sim.over && sim.over.result === 'won') return true;
    if (sim.won === true) return true;
    return false;
  }

  // Folds one finished run into the store: a new best, the per-difficulty best, the last-3 history
  // window and every sim feat that is now true. Never inserts fake runs of its own.
  function recordRun(sim) {
    const data = get();
    if (!sim) return deepCopy(data);
    const score = Math.max(0, Math.round(num(sim.score, 0)));
    const won = isWin(sim);
    const diff = sim.difficulty || 'Normal';
    const entry = {
      score: score,
      won: won,
      difficulty: diff,
      seed: String(sim.seed == null ? '' : sim.seed),
      shower: num(sim.shower, 1),
      reason: sim.over ? String(sim.over.result === 'won' ? 'duskfather' : sim.over.reason || sim.over.result) : '',
      blooms: sim.stats ? num(sim.stats.blooms, 0) : 0,
      ticks: num(sim.tick, 0),
      date: '',
    };
    const before = data.best;
    if (score > data.best) data.best = score;
    data.bestByDifficulty[diff] = Math.max(num(data.bestByDifficulty[diff], 0), score);
    data.history.push(entry);
    const cap = Math.max(1, num(config().save.history, 12));
    if (data.history.length > cap) data.history.splice(0, data.history.length - cap);
    data.lastRun = { entry: entry, previousBest: before };
    if (sim.feats && typeof sim.feats === 'object') {
      for (const k in sim.feats) if (Object.prototype.hasOwnProperty.call(sim.feats, k) && sim.feats[k]) data.feats[k] = true;
    }
    save(data);
    return { best: data.best, newBest: score > before && score > 0, previousBest: before, entry: entry };
  }

  function unlockFeat(id) {
    if (!id) return false;
    const data = get();
    if (data.feats[id]) return false;
    data.feats[id] = true;
    save(data);
    return true;
  }

  function featsCount() {
    const data = get();
    const list = (globalThis.PB_NAMES && globalThis.PB_NAMES.feats) || [];
    if (list.length) {
      let n = 0;
      for (let i = 0; i < list.length; i += 1) if (data.feats[list[i].key]) n += 1;
      return n;
    }
    let n = 0;
    for (const k in data.feats) if (Object.prototype.hasOwnProperty.call(data.feats, k) && data.feats[k]) n += 1;
    return n;
  }

  function feats() {
    return deepCopy(get().feats);
  }

  // The results screen's LAST 3 RUNS: wins in mint, losses in coral, oldest first.
  function lastRuns() {
    const data = get();
    const n = Math.max(1, num(config().save.lastRuns, 3));
    return data.history.slice(-n).map(function (r) { return deepCopy(r); });
  }

  function setSettings(patch) {
    const data = get();
    const p = patch || {};
    if (p.music != null) data.settings.music = clamp(num(p.music, data.settings.music), 0, 1);
    if (p.sfx != null) data.settings.sfx = clamp(num(p.sfx, data.settings.sfx), 0, 1);
    if (p.muted != null) data.settings.muted = p.muted === true;
    save(data);
    return deepCopy(data.settings);
  }

  function settings() {
    return deepCopy(get().settings);
  }

  function reset() {
    cache = defaults();
    const store = storage();
    if (store) {
      try {
        store.removeItem(keyName());
      } catch (err) {
        /* storage blocked - the in-memory default is still returned */
      }
    }
    return deepCopy(cache);
  }

  globalThis.PB_Save = {
    load: load,
    save: save,
    recordRun: recordRun,
    unlockFeat: unlockFeat,
    featsCount: featsCount,
    feats: feats,
    lastRuns: lastRuns,
    settings: settings,
    setSettings: setSettings,
    reset: reset,
    storageAvailable: function () { return storage() !== null; },
  };
})();
