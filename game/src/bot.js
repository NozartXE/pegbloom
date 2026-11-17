// A deterministic autopilot for the title demo and the tools: sweeps the dropper, eases the gates, drafts and builds, and never touches the DOM.
(function () {
  if (typeof globalThis.PB_Bot === 'object' && globalThis.PB_Bot !== null) return;

  const DEFAULTS = {
    minLive: 7,
    maxLive: 12,
    sweepTicks: 240,
    sweepSpan: 0.66,
    gateEvery: 96,
    phase: 'auto',
    weak: false,
    draftPick: 0,
    endless: false,
    maxTicks: 240000,
  };

  function config() {
    return globalThis.PB_CONFIG || { board: { dropperRail: { x: 368, w: 544 }, field: { x: 368, w: 544 } }, draft: { startingSeeds: 6 } };
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function sim() {
    return globalThis.PB_Sim;
  }

  function create(opts) {
    const o = {};
    for (const k in DEFAULTS) if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) o[k] = DEFAULTS[k];
    if (opts && typeof opts === 'object') for (const k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
    const rail = config().board.dropperRail || { x: 368, w: 544 };
    return {
      kind: 'bot',
      minLive: clamp(num(o.minLive, 7), 1, 24),
      maxLive: clamp(num(o.maxLive, 12), 1, 24),
      sweepTicks: Math.max(8, Math.round(num(o.sweepTicks, 240))),
      sweepSpan: clamp(num(o.sweepSpan, 0.66), 0.1, 1),
      gateEvery: Math.max(8, Math.round(num(o.gateEvery, 96))),
      phase: num(o.phase, 0) % 1,
      weak: o.weak === true,
      buildCap: Math.max(0, Math.round(num(o.buildCap, 9))),
      draftPick: clamp(Math.round(num(o.draftPick, 0)), 0, 2),
      endless: o.endless === true,
      maxTicks: Math.max(60, Math.round(num(o.maxTicks, 240000))),
      rail: rail,
      started: false,
      drops: 0,
      drafts: 0,
      builds: 0,
      rerolls: 0,
      gate: 0,
      gateDir: 1,
      lastError: null,
    };
  }

  function fill(o) {
    // Raw option objects (runToEnd's callers pass them) are not bots: they lack rail and the
    // counters play() reads. Normalize anything that is not a create() product into a real bot.
    if (!o || typeof o !== 'object' || !o.rail) return create(o);
    return o;
  }

  // Build cards cover the right column, not the board, so a click at BOARD x/y cannot misplace one.
  function buildOnce(s, b) {
    const api = sim();
    const pending = !!(s.draft && s.draft.pending);
    if (!s.sockets || !s.sockets.length) return false;
    const empty = s.sockets.filter(function (k) { return !k.kind; }).map(function (k) { return k.index; });
    if (!empty.length) return false;
    const namesList = (globalThis.PB_NAMES && globalThis.PB_NAMES.contraptions) || [];
    let key = null;
    let tokenPrice = 0;
    if (pending) {
      // A draft token is ours to place even when it is not a round in the build bar's 5 cards.
      key = s.draft.pending.key;
      const meta = globalThis.PB_Contraptions && globalThis.PB_Contraptions.info ? globalThis.PB_Contraptions.info(key, 1) : null;
      tokenPrice = num(meta && meta.cost, 2);
      if (tokenPrice > num(s.seeds, 0)) return false;
    } else {
      for (let i = 0; i < namesList.length; i += 1) {
        if (num(s.owned && s.owned[namesList[i].key], 0) > 0) {
          key = namesList[i].key;
          break;
        }
      }
    }
    if (!key) return false;
    const socket = empty[0];
    const ok = api.applyContraption(s, socket, key);
    if (!ok) return false;
    if (!Array.isArray(s.builds)) s.builds = [];
    const info = globalThis.PB_Contraptions && globalThis.PB_Contraptions.info ? globalThis.PB_Contraptions.info(key, 1) : null;
    const cost = tokenPrice || num(info && info.cost, 2);
    if (s.seeds < cost) {
      const sock = s.sockets[socket];
      sock.kind = null;
      sock.level = 0;
      return false;
    }
    s.seeds -= cost;
    if (num(s.owned[key], 0) > 0) s.owned[key] = num(s.owned[key], 0) - 1;
    if (Array.isArray(s.tokens)) {
      const t = s.tokens.indexOf(key);
      if (t >= 0) s.tokens.splice(t, 1);
    }
    s.builds.push({ shower: s.shower, socket: socket, kind: key, cost: cost, bot: true });
    if (s.draft && s.draft.pending && s.draft.pending.key === key) s.draft.pending = null;
    b.builds += 1;
    if (globalThis.PB_Cascade && typeof globalThis.PB_Cascade.log === 'function') {
      globalThis.PB_Cascade.log(s, String(info && info.name || key) + ' BUILT -' + cost + ' SEEDS', 'build');
    }
    return true;
  }

  // One fixed tick of play: keep the lane sweeping, drop to a steady stream, creep the gates round.
  function play(s, b) {
    const api = sim();
    const rail = b.rail;
    const t = b.started ? s.tick : b.sweepTicks;
    b.started = true;
    const wave = (t % b.sweepTicks) / b.sweepTicks;
    const tri = wave < 0.5 ? wave * 2 : 1 - (wave - 0.5) * 2;
    const pct = 0.5 + (tri - 0.5) * b.sweepSpan + (b.weak ? (Math.sin(t * 0.021) - 0.5) * 0.18 : 0);
    api.moveDropper(s, rail.x + rail.w * clamp(pct, 0.02, 0.98));
    if (s.tick % b.gateEvery === 0) {
      const g = b.gate % 3;
      if (api.rotateGate(s, g, b.gateDir)) b.gateDir = -b.gateDir;
      else b.gateDir = -b.gateDir;
      b.gate = (b.gate + 1) % 3;
    }
    const live = s.balls ? s.balls.length : 0;
    const wantLive = b.weak ? Math.round(b.minLive * 0.6) : b.minLive;
    const capLive = b.weak ? Math.round(b.maxLive * 0.7) : b.maxLive;
    if (num(s.dropper && s.dropper.cooldown, 0) <= 0 && live < capLive && (live < wantLive || (s.tick + b.drops) % 4 === 0)) {
      if (api.drop(s)) b.drops += 1;
    }
  }

  // One decision in the draft: buildable tokens prefer a slot the board can use; charms are taken as offered.
  function draft(s, b) {
    const api = sim();
    const offers = (s.draft && s.draft.offers) || [];
    if (!offers.length) return;
    let idx = b.draftPick;
    if (idx >= offers.length) idx = offers.length - 1;
    if (b.weak) idx = offers.length - 1;
    const offer = offers[idx];
    // Charms apply their effect through PB_Draft.apply; chooseDraft opens the shower and logs the pick.
    if (offer && !offer.buildable && globalThis.PB_Draft && typeof globalThis.PB_Draft.apply === 'function') {
      globalThis.PB_Draft.apply(s, offer);
    }
    const key = api.chooseDraft(s, idx);
    if (!key) b.chooseFailed = num(b.chooseFailed, 0) + 1;
    if (key) b.drafts += 1;
  }

  // One tick of the policy; returns the action it took so tools can log it.
  function step(s, b) {
    if (!s || !sim()) return 'none';
    const bot = fill(b);
    // A closed shower ('end') still has a draft waiting; only a won/lost run is truly over.
    if (s.over && (s.over.result === 'won' || s.over.result === 'lost')) return 'over';
    if (s.phase === 'draft') {
      draft(s, bot);
      return 'draft';
    }
    // A buildable token waits on the rack: spend it on the first free socket before the first drop.
    if (bot.builds < bot.buildCap && s.draft && s.draft.pending && s.phase === 'play' && num(s.stats && s.stats.ballsDropped, 0) === 0) {
      if (buildOnce(s, bot)) return 'build';
    }
    if (s.phase === 'build') {
      if (bot.builds < bot.buildCap) buildOnce(s, bot);
      sim().endBuild(s);
      return 'build';
    }
    if (s.phase === 'showerEnd') {
      sim().advanceSim(s);
      return 'advance';
    }
    if (s.over) return 'over';
    if (s.phase === 'play') {
      play(s, bot);
      sim().stepSim(s);
      return 'play';
    }
    return 'wait';
  }

  // Runs the policy until the run ends (or maxTicks). Deterministic for a given seed and options.
  function runToEnd(s, opts) {
    const b = fill(opts);
    let guard = 0;
    while (s && !(s.over && (s.over.result === 'won' || s.over.result === 'lost')) && guard < b.maxTicks) {
      step(s, b);
      guard += 1;
      if (s.over && b.endless && s.over.result === 'won') break;
    }
    return s;
  }

  // Frames (one sim step each) until `done(sim, bot)` holds; deterministic, no frame budget exceeded.
  function playUntil(s, done, opts) {
    const b = fill(opts);
    let guard = 0;
    const cap = Math.min(120000, Math.max(60, Math.round(num(opts && opts.cap, 20000))));
    while (s && guard < cap) {
      step(s, b);
      guard += 1;
      if (s.over) break;
      if (done && done(s, b)) return { sim: s, bot: b, ticks: guard, hit: true };
    }
    return { sim: s, bot: b, ticks: guard, hit: false };
  }

  // Safe stepping helper used by main's demo and by the tools.
  function stepSimSafe(s) {
    if (!s) return s;
    try {
      sim().stepSim(s);
    } catch (err) {
      s.__error = String(err && err.message || err);
    }
    return s;
  }

  function zeroRun(seed, difficulty) {
    const s = sim().createSim(seed, difficulty || 'Normal');
    return s;
  }

  function emptyHistory(seed) {
    const s = zeroRun(seed, 'Normal');
    return s.history;
  }

  globalThis.PB_Bot = {
    create: create,
    step: step,
    play: play,
    draft: draft,
    buildOnce: buildOnce,
    runToEnd: runToEnd,
    playUntil: playUntil,
    stepSimSafe: stepSimSafe,
    defaults: DEFAULTS,
  };
})();
