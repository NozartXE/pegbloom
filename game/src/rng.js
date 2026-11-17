// Seeded random numbers (mulberry32) plus range/int/pick helpers and a string-seed hash, so every run replays.
(function () {
  if (typeof globalThis.PB_RNG === 'object' && globalThis.PB_RNG !== null) return;

  function hashSeed(seed) {
    if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
    const text = String(seed == null ? '' : seed);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function create(seed) {
    let state = hashSeed(seed);

    function next() {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function range(min, max) {
      if (max === undefined) return next() * min;
      return min + next() * (max - min);
    }

    function int(min, max) {
      if (max === undefined) return Math.floor(next() * min);
      return min + Math.floor(next() * (max - min + 1));
    }

    function pick(list) {
      if (!list || !list.length) return undefined;
      return list[Math.floor(next() * list.length)];
    }

    function shuffle(list) {
      const copy = list.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const swap = copy[i];
        copy[i] = copy[j];
        copy[j] = swap;
      }
      return copy;
    }

    function chance(p) {
      return next() < p;
    }

    return { next, range, int, pick, shuffle, chance, seed: hashSeed(seed) };
  }

  globalThis.PB_RNG = { create, hashSeed };
})();
