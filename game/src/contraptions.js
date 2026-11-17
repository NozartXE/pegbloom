// The five buildables: their data, seed-costed placement and upgrades on sockets, and the per-tick effects physics does not own.
(function () {
  if (typeof globalThis.PB_Contraptions === 'object' && globalThis.PB_Contraptions !== null) return;

  // Numbers per kind per level (index 0 = Lv1). Kept here instead of config so config.js stays untouched.
  const KINDS = {
    bloomBumper: {
      name: 'BLOOM BUMPER',
      effect: 'Placed bumper: balls bounce off with a boost and +5 score.',
      synergy: 'Feeds CASCADE streaks',
      levelCost: [3, 5, 7],
      bumperR: [13, 16, 19],
      bumpBoost: [1.3, 1.42, 1.55],
      score: [5, 8, 12],
    },
    splitterTulip: {
      name: 'SPLITTER TULIP',
      effect: 'Catches one ball: it re-enters as 2 half-value ghost balls.',
      synergy: 'Blooms are 1 each - quota loves it',
      levelCost: [4, 6, 8],
      tulipW: [34, 42, 50],
      tulipH: [18, 22, 26],
      reentries: [2, 3, 4],
      ghostValue: 0.5,
    },
    magnetTulip: {
      name: 'MAGNET TULIP',
      effect: 'Gently pulls passing balls toward it.',
      synergy: 'Steers toward the cup row',
      levelCost: [3, 5, 7],
      radius: [110, 145, 180],
      pull: [520, 760, 1020],
    },
    fanLeaf: {
      name: 'FAN LEAF',
      effect: 'Cancels the shower wind across its column band.',
      synergy: 'Undoes GUSTING showers',
      levelCost: [2, 3, 5],
      halfWidth: [78, 104, 132],
    },
    springPad: {
      name: 'SPRING PAD',
      effect: 'First drained ball this shower relaunches from the pad.',
      synergy: 'Saves one Sunwell a shower',
      levelCost: [3, 4, 6],
      score: [0, 40, 80],
    },
  };

  const SLOT_KEYS = ['bloomBumper', 'splitterTulip', 'magnetTulip', 'fanLeaf', 'springPad'];

  // Fields other names (lantern lily, dew bell, golden peg, cascade bell) reuse. Kept clear of the
  // buildables' fields so contraptions never write another session's numbers.
  const KEEP_FIELDS = {
    bloomBumper: { score: 1 },
    splitterTulip: { w: 1, h: 1 },
    magnetTulip: { pull: 1 },
    fanLeaf: { half: 1 },
    springPad: { score: 1 },
  };

  function config() {
    const c = globalThis.PB_CONFIG;
    if (!c || !c.board) throw new Error('PB_Contraptions: PB_CONFIG missing (load config.js first)');
    return c;
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function log(sim, text, kind) {
    if (globalThis.PB_Cascade && typeof globalThis.PB_Cascade.log === 'function') {
      globalThis.PB_Cascade.log(sim, text, kind || 'build');
      return;
    }
    if (!Array.isArray(sim.log)) sim.log = [];
    sim.log.push({ text: text, kind: kind || 'build', shower: sim.shower });
    if (sim.log.length > 6) sim.log.splice(0, sim.log.length - 6);
  }

  function fx(sim, event) {
    if (sim && sim.fx && typeof sim.fx.push === 'function') sim.fx.push(event);
  }

  function kindOf(kind) {
    const k = KINDS[kind] ? kind : SLOT_KEYS.indexOf(kind) >= 0 ? kind : null;
    return k;
  }

  function level(key, lv) {
    return clamp(Math.round(num(lv, 1)), 1, 3);
  }

  function at(list, lv) {
    return list[Math.max(0, Math.min(list.length - 1, lv - 1))];
  }

  // Data for one buildable, resolved to concrete numbers for a level: {key, name, cost, effect, lv, ...}.
  function info(kind, lv) {
    const key = kindOf(kind);
    if (!key) return null;
    const def = KINDS[key];
    const l = level(key, lv);
    const out = { key: key, name: def.name, effect: def.effect, synergy: def.synergy, lv: l, cost: at(def.levelCost, l) };
    if (key === 'bloomBumper') {
      out.bumperR = at(def.bumperR, l);
      out.bumpBoost = at(def.bumpBoost, l);
      out.score = at(def.score, l);
    } else if (key === 'splitterTulip') {
      out.tulipW = at(def.tulipW, l);
      out.tulipH = at(def.tulipH, l);
      out.reentries = at(def.reentries, l);
      out.ghostValue = def.ghostValue;
    } else if (key === 'magnetTulip') {
      out.radius = at(def.radius, l);
      out.pull = at(def.pull, l);
    } else if (key === 'fanLeaf') {
      out.halfWidth = at(def.halfWidth, l);
    } else if (key === 'springPad') {
      out.score = at(def.score, l);
    }
    return out;
  }

  function borrowable(socket, key) {
    if (!socket) return false;
    if (!socket.kind) return true;
    if (socket.kind !== key) return false;
    const keep = KEEP_FIELDS[key] || {};
    for (const f in keep) if (num(socket[f], 0) !== 0) return false;
    return true;
  }

  // Writes a socket's physical fields from the buildable's level numbers; sim.applyContraption's
  // generic bounce fields are overwritten for non-bumper kinds so only a bumper deflects.
  function setSocket(socket, key, l) {
    const d = info(key, l);
    socket.kind = key;
    socket.level = l;
    socket.name = d.name;
    socket.cost = d.cost;
    socket.bumperR = 0;
    socket.bumpBoost = 1;
    socket.score = 0;
    socket.w = 0;
    socket.h = 0;
    socket.pull = 0;
    socket.half = 0;
    socket.flash = 0;
    if (key === 'bloomBumper') {
      socket.bumperR = d.bumperR;
      socket.bumpBoost = d.bumpBoost;
      socket.score = d.score;
    } else if (key === 'splitterTulip') {
      socket.w = d.tulipW;
      socket.h = d.tulipH;
    } else if (key === 'magnetTulip') {
      socket.pull = d.pull;
    } else if (key === 'fanLeaf') {
      socket.half = d.halfWidth;
    }
    return socket;
  }

  // Which socket a placement goes to: the asked slot if it is free (or already this kind), else the
  // first free socket, so a token bought in the draft is never lost to a forgotten slot index.
  function resolveSocket(sim, socketIdx, key) {
    const sockets = (sim && sim.sockets) || [];
    const asked = sockets[socketIdx];
    if (borrowable(asked, key)) return asked;
    for (let i = 0; i < sockets.length; i += 1) if (borrowable(sockets[i], key)) return sockets[i];
    return null;
  }

  function firstFree(sim) {
    const sockets = (sim && sim.sockets) || [];
    for (let i = 0; i < sockets.length; i += 1) if (!sockets[i].kind) return i;
    return -1;
  }

  // Place (or level up) a buildable. sim.reserveContraption spends the seeds and owns phase checks.
  function place(sim, socketIdx, kind) {
    const api = sim && sim.reserveContraption;
    if (typeof api !== 'function') return false;
    return api(sim, socketIdx, kind) === true;
  }

  function upgrade(sim, socketIdx) {
    const api = sim && sim.reserveUpgrade;
    if (typeof api !== 'function') return false;
    return api(sim, socketIdx) === true;
  }

  function ownedList(sim) {
    const out = [];
    const sockets = (sim && sim.sockets) || [];
    for (let i = 0; i < sockets.length; i += 1) {
      const s = sockets[i];
      if (s && s.kind) out.push({ socket: i, kind: s.kind, level: s.level, name: s.name });
    }
    return out;
  }

  // Spring pads: the first drained ball of each shower relaunches from the best (highest) pad.
  function springPadFor(sim) {
    const sockets = sim.sockets || [];
    let best = null;
    for (let i = 0; i < sockets.length; i += 1) {
      const s = sockets[i];
      if (!s || s.kind !== 'springPad') continue;
      if (!best || num(s.level, 0) > num(best.level, 0)) best = s;
    }
    return best;
  }

  function armSpring(sim) {
    const pad = springPadFor(sim);
    sim.springPads = pad && num(pad.level, 0) > 0 ? [{ x: pad.x, y: pad.y, r: 14, socket: pad, armed: true }] : [];
    sim.springUsed = false;
  }

  function springSave(sim, ev) {
    const pads = sim.springPads;
    if (!pads || !pads.length) return false;
    const pad = pads[0];
    if (!pad.armed || !sim.stats) return false;
    const d = info('springPad', pad.socket ? pad.socket.level : 1);
    const rng = sim.rng;
    const side = rng && typeof rng.next === 'function' ? (rng.next() < 0.5 ? -1 : 1) : 1;
    const ball = globalThis.PB_Physics.makeBall(pad.x, pad.y - 6, side * 30, -300);
    ball.valueMul = 1;
    ball.springSaved = true;
    pad.armed = false;
    sim.springUsed = true;
    ball.trail = [{ x: ball.x, y: ball.y }];
    sim.balls.push(ball);
    sim.stats.drains = Math.max(0, sim.stats.drains - 1);
    sim.stats.springSaves = num(sim.stats.springSaves, 0) + 1;
    if (d.score > 0 && globalThis.PB_Cascade && typeof globalThis.PB_Cascade.awardScore === 'function') {
      globalThis.PB_Cascade.awardScore(sim, d.score);
    }
    fx(sim, { type: 'floater', x: pad.x, y: pad.y - 28, text: d.score > 0 ? 'SPRING PAD +' + d.score : 'SPRING PAD SAVED A DROP', colour: 'mint' });
    log(sim, 'SPRING PAD RELAUNCHED A DRAINED BALL', 'build');
    return true;
  }

  // Per-tick effects: magnet pull on live balls, fan bands published once, the spring re-arming
  // each shower. Called from sim.stepSim before physics moves the balls.
  function stepEffects(sim) {
    if (!sim) return;
    const sockets = sim.sockets || [];
    const f = config().board.field;
    const dt = 1 / num(sim.stepHz, 60);
    for (let i = 0; i < sockets.length; i += 1) {
      const s = sockets[i];
      if (s && s.flash > 0) s.flash = Math.max(0, s.flash - 0.08);
    }
    if (!sim.springPads || sim.springPads.length === 0 || !springPadFor(sim)) armSpring(sim);
    const wind = sim.wind || {};
    const bands = sim.fanBands || (sim.fanBands = []);
    bands.length = 0;
    const balls = sim.balls || [];
    for (let i = 0; i < sockets.length; i += 1) {
      const s = sockets[i];
      if (!s || !s.kind) continue;
      if (s.kind === 'fanLeaf') {
        const half = num(s.half, 78);
        bands.push({ x: s.x, half: half, force: num(wind.force, 0) });
        continue;
      }
      if (s.kind !== 'magnetTulip') continue;
      const radius = at(KINDS.magnetTulip.radius, level('magnetTulip', s.level));
      const pull = num(s.pull, 520);
      for (let b = 0; b < balls.length; b += 1) {
        const ball = balls[b];
        if (!ball || !ball.alive) continue;
        const dx = s.x - ball.x;
        const dy = s.y - ball.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1 || d > radius) continue;
        const fall = 1 - d / radius;
        ball.vx += (dx / d) * pull * fall * dt;
        ball.vy += (dy / d) * pull * fall * 0.35 * dt;
        s.magnetGlow = 1;
      }
    }
    if (sim.wind && (wind.force || 0) !== 0 && bands.length > 0) {
      for (let i = 0; i < bands.length; i += 1) {
        const band = bands[i];
        if (band.x < f.x || band.x > f.x + f.w) band.force = 0;
      }
    }
  }

  function resetForShower(sim) {
    if (!sim) return;
    armSpring(sim);
    sim.fanBands = [];
  }

  // Where a build bar / ALMANAC preview likes to put each buildable: left side first, low slots first.
  function defaultSlot(kind) {
    const order = ['springPad', 'fanLeaf', 'magnetTulip', 'splitterTulip', 'bloomBumper'];
    const rows = [8, 6, 4, 2, 0];
    const slot = order.indexOf(kind);
    const side = kind === 'splitterTulip' || kind === 'springPad' ? 1 : 0;
    return side === 1 ? (slot >= 0 ? rows[slot] + 1 : 0) : rows[Math.max(0, slot)];
  }

  globalThis.PB_Contraptions = {
    KINDS: KINDS,
    SLOT_KEYS: SLOT_KEYS,
    info: info,
    place: place,
    upgrade: upgrade,
    stepEffects: stepEffects,
    resetForShower: resetForShower,
    springSave: springSave,
    armSpring: armSpring,
    springPadFor: springPadFor,
    firstFree: firstFree,
    resolveSocket: resolveSocket,
    setSocket: setSocket,
    ownedList: ownedList,
    defaultSlot: defaultSlot,
    canUpgrade: function (sim, socketIdx) { return !!sim && !!sim.sockets && !!sim.sockets[socketIdx] && !!sim.sockets[socketIdx].kind && num(sim.sockets[socketIdx].level, 0) < 3; },
    upgradeCost: function (sim, socketIdx) {
      const s = sim && sim.sockets ? sim.sockets[socketIdx] : null;
      if (!s || !s.kind) return 0;
      const d = info(s.kind, num(s.level, 1) + 1);
      return d ? d.cost - (info(s.kind, num(s.level, 1)) || d).cost : 0;
    },
  };
})();
