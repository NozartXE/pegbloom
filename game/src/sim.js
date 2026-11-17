// The DOM-free orchestrator: createSim builds the whole run state from config and stepSim/advanceSim drive it one tick at a time.
(function () {
  if (typeof globalThis.PB_Sim === 'object' && globalThis.PB_Sim !== null) return;

  const STEP_HZ = 60;

  function config() {
    const c = globalThis.PB_CONFIG;
    if (!c || !c.board) throw new Error('PB_Sim: PB_CONFIG missing (load config.js first)');
    return c;
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function daysFor(shower) {
    const all = config().days || [];
    for (let i = 0; i < all.length; i += 1) {
      const first = all[i].day * 3 - 2;
      if (shower >= first && shower <= first + 2) return all[i];
    }
    return null;
  }

    function showersTotal() {
    return (config().showers || []).length || 9;
  }

  // Showers in a run: the 9 config rows, then OVERBLOOM rows until the run ends.
  function showerRow(n) {
    const c = config();
    const list = c.showers || [];
    if (n <= list.length) return list[n - 1];
    const k = n - list.length;
    const ob = c.overbloom || { quotaStep: 40, ballStep: 2 };
    return {
      shower: n,
      day: 3,
      balls: list.length ? list[list.length - 1].balls + (ob.ballStep || 0) * k : 30,
      quota: list.length ? list[list.length - 1].quota + (ob.quotaStep || 0) * k : 1000,
      wind: k % 2 === 1 ? 'east' : 'gust',
      pestBudget: 10 + k * 2,
      boss: false,
      endless: true,
    };
  }

  // A shallow copy keeps the config tables frozen: every shower row the sim edits is its own object.
  function rowCopy(row) {
    const out = {};
    for (const k in row) if (Object.prototype.hasOwnProperty.call(row, k)) out[k] = row[k];
    return out;
  }

  // Difficulty keys are the config spellings (Gentle / Normal / Scorched); anything else plays Normal.
  function resolveDifficulty(key) {
    const c = config();
    const order = c.difficultyOrder || [];
    for (let i = 0; i < order.length; i += 1) if (order[i] === key) return key;
    return 'Normal';
  }

  function difficultyDef(key) {
    const c = config();
    return (c.difficulties && c.difficulties[key]) || c.difficulties.Normal;
  }

  function startCups() {
    return globalThis.PB_Pegboard.buildCups(config());
  }

  function startContraptions() {
    const owned = {};
    const pool = (globalThis.PB_NAMES && globalThis.PB_NAMES.contraptions) || [];
    for (let i = 0; i < pool.length; i += 1) owned[pool[i].key] = 0;
    return owned;
  }

  function featsState() {
    const list = (globalThis.PB_NAMES && globalThis.PB_NAMES.feats) || [];
    const out = {};
    for (let i = 0; i < list.length; i += 1) out[list[i].key] = false;
    return out;
  }

  function statsFor(row, diff) {
    return {
      ballsLeft: Math.max(1, Math.round(row.balls * diff.ballMul)),
      quota: row.boss ? 0 : Math.max(1, Math.round(row.quota * diff.quotaMul)),
      quotaGot: 0,
      blooms: 0,
      drains: 0,
      petals: 0,
      ballsDropped: 0,
      pestHits: 0,
      pestClears: 0,
      pestsClearedShower: 0,
      bestCascade: 1,
      bossHits: 0,
      shake: 0,
    };
  }

  // The banner for the shower about to open says its wind and whether the gates need re-aiming.
  function bannerFor(n, row) {
    const wind = globalThis.PB_Gates.windFor(row.wind);
    const boss = row.boss ? ' - ' + globalThis.PB_NAMES.bossInfo.name + ' ARRIVES' : '';
    return {
      text: 'SHOWER ' + n + ': ' + wind.name + (wind.force ? ' - REAIM GATES' : ' - AIM YOUR GATES') + boss,
      kind: 'shower',
      shower: n,
      wind: wind.key,
      force: wind.force,
    };
  }

  function applyWind(sim, row) {
    sim.wind = globalThis.PB_Gates.windFor(row.wind);
  }

  // Reset the board for shower n: fresh cups, refreshed pegs, empty ball tray, quota/balls from the row.
  function openShower(sim, n) {
    const c = config();
    const row = rowCopy(showerRow(n));
    sim.shower = n;
    sim.rows = row;
    sim.day = row.day;
    sim.phase = 'play';
    sim.building = false;
    sim.cups = startCups();
    sim.rimPegs = globalThis.PB_Pegboard.buildRimPegs(c, sim.cups);
    for (let i = 0; i < sim.pegs.length; i += 1) {
      const peg = sim.pegs[i];
      peg.lit = 0;
      peg.dead = 0;
      peg.hitFlash = 0;
      peg.golden = false;
    }
    sim.balls.length = 0;
    sim.events.length = 0;
    sim.tulips = [];
    // Pest bodies are circles physics collides with; they never survive into a new shower.
    if (globalThis.PB_Pests && typeof globalThis.PB_Pests.clearAll === 'function') globalThis.PB_Pests.clearAll(sim);
    else sim.pests = [];
    sim.stats = statsFor(row, sim.diff);
    sim.stats.shower = n;
    sim.scoreAtShower = sim.score;
    sim.over = null;
    sim.showerResolved = false;
    sim.dropper = { x: c.board.field.x + c.board.field.w * 0.5, cooldown: 0 };
    sim.cascade = { streak: 0, mult: 1, lastCatchTick: 0 };
    applyWind(sim, row);
    sim.banner = bannerFor(n, row);
    const goal = row.boss ? 'DUSKFATHER - DRIVE HIM OFF' : 'BLOOM ' + sim.stats.quota + ' CUPS';
    sim.log = [
      { text: 'SHOWER ' + n + ': ' + globalThis.PB_Gates.windFor(row.wind).name + ' - ' + goal, kind: 'shower', shower: n },
      { text: 'SUNWELL ' + sim.sunwell + ' / ' + c.sunwell.max + ' - ' + (row.pestBudget > 0 ? row.pestBudget + ' PESTS INBOUND' : 'CLEAR SKY'), kind: 'info', shower: n },
    ];
    buildRoster(sim);
    return sim;
  }

  function buildRoster(sim) {
    const names = (globalThis.PB_NAMES && globalThis.PB_NAMES.pests) || [];
    const row = sim.rows || {};
    const kinds = [];
    const budget = Math.max(0, Math.round(num(row.pestBudget, 0) * (sim.diff.pestMul || 1)));
    const unlocked = Math.min(names.length, 1 + (sim.shower - 1));
    for (let i = 0; i < budget && names.length; i += 1) {
      const src = names[i % unlocked];
      let hit = null;
      for (let k = 0; k < kinds.length; k += 1) if (kinds[k].key === src.key) hit = kinds[k];
      if (hit) hit.count += 1;
      else kinds.push({ key: src.key, name: src.name, trait: src.trait, count: 1 });
    }
    sim.roster = {
      kinds: kinds,
      boss: row.boss === true,
      next: sim.shower < showersTotal() ? names[Math.min(names.length - 1, sim.shower)] || null : null,
    };
    return sim.roster;
  }

  function createSim(seed, difficultyKey) {
    const c = config();
    const key = resolveDifficulty(difficultyKey);
    const diff = difficultyDef(key);
    const pegs = globalThis.PB_Pegboard.buildPegs(c);
    const sockets = globalThis.PB_Pegboard.buildSockets(c);
    const f = c.board.field;
    const runSeed = seed == null ? 'pegbloom' : String(seed);
    const cups = globalThis.PB_Pegboard.buildCups(c);

    const sim = {
      seed: runSeed,
      difficulty: key,
      diff: diff,
      rng: globalThis.PB_RNG.create(runSeed),
      tick: 0,
      time: 0,
      stepHz: STEP_HZ,

      pegs: pegs,
      pegGrid: globalThis.PB_Pegboard.buildRows(c, pegs),
      sockets: sockets,
      cups: cups,
      rimPegs: globalThis.PB_Pegboard.buildRimPegs(c, cups),
      gates: globalThis.PB_Gates.makeGates(c),
      tulips: [],
      wind: globalThis.PB_Gates.windFor('still'),

      balls: [],
      pests: [],
      boss: null,
      bossDown: false,
      pestKills: 0,
      pestSerial: 0,
      spawnPlan: null,
      events: [],
      fx: [],
      log: [],
      banner: null,

      score: 0,
      seeds: c.draft.startingSeeds,
      sunwell: diff.sunwell,
      cascade: { streak: 0, mult: 1, lastCatchTick: 0 },
      adders: {},
      over: null,
      showerResolved: false,

      shower: 1,
      day: 1,
      rows: null,
      stats: null,
      history: [],
      phase: 'play',
      building: false,
      owned: startContraptions(),
      draft: null,
      builds: [],
      feats: featsState(),
      endless: false,
      paused: false,
      autoDrop: false,
      runStartTick: 0,
      runEndTick: 0,
    };

    openShower(sim, 1);
    alignDropPoint(sim);
    return sim;
  }

  // Contraptions sit on the fixed sockets; a duplicate kind levels the same slot up instead of stacking bumps.
  function applyContraption(sim, socketIdx, kind) {
    const info = (globalThis.PB_Contraptions && globalThis.PB_Contraptions.info && globalThis.PB_Contraptions.info(kind)) || null;
    const names = (globalThis.PB_NAMES && globalThis.PB_NAMES.contraptions) || [];
    let meta = info;
    if (!meta) for (let i = 0; i < names.length; i += 1) if (names[i].key === kind) meta = names[i];
    if (!meta) return false;
    const sockets = sim.sockets || [];
    let socket = sockets[socketIdx] || null;
    for (let i = 0; i < sockets.length && (!socket || socket.kind); i += 1) if (sockets[i].kind === kind) socket = sockets[i];
    if (!socket) return false;
    socket.kind = kind;
    socket.level = num(socket.level, 0) + 1;
    socket.cost = num(meta.cost, 2);
    socket.name = meta.name || kind;
    socket.bumperR = socket.level > 1 ? 15 : 12;
    socket.bumpBoost = 1.25 + 0.15 * (socket.level - 1) + (socket.side === 'mid' ? 0.1 : 0);
    socket.flash = 0;
    if (typeof sim.onContraption === 'function') sim.onContraption(sim, kind, socket);
    return true;
  }

  function autoDrop(sim) {
    if (!sim.autoDrop) return;
    const d = sim.dropper;
    if (!d) return;
    const rail = config().board.dropperRail;
    const want = sim.autoXPct == null ? 0.5 : clamp(sim.autoXPct, 0, 1);
    const target = rail.x + rail.w * want;
    d.x += (target - d.x) * 0.06;
    if (sim.balls.length < (sim.autoDropMax || 8) && sim.stats.ballsLeft > 0 && num(d.cooldown, 0) <= 0) drop(sim);
  }

  // A shower only closes once the boss of that shower is driven off.
  function bossDown(sim) {
    return !sim.rows || sim.rows.boss !== true || (sim.boss != null && sim.boss.alive === false);
  }

  // The one place the Sunwell can empty: over means the run is lost and the phase is 'lost'.
  function lose(sim, reason, text) {
    if (!sim || sim.over) return sim;
    sim.over = { result: 'lost', reason: reason, shower: sim.shower };
    sim.phase = 'lost';
    sim.runEndTick = sim.tick;
    if (sim.boss) {
      // The run is over; stop the moth shedding into a closed board.
      if (typeof sim.boss.spawnTicks === 'number') sim.boss.spawnTicks = -Infinity;
    }
    if (globalThis.PB_Cascade && typeof globalThis.PB_Cascade.log === 'function') {
      globalThis.PB_Cascade.log(sim, text, 'lose');
    }
    return sim;
  }

  function win(sim, reason) {
    if (!sim || sim.over) return sim;
    sim.over = { result: 'won', reason: reason, shower: sim.shower };
    sim.phase = 'won';
    sim.runEndTick = sim.tick;
    if (globalThis.PB_Cascade && typeof globalThis.PB_Cascade.log === 'function') {
      globalThis.PB_Cascade.log(sim, 'THE DUSKFATHER RETREATS - RUN WON', 'win');
    }
    return sim;
  }

  // Close the shower once the budget is spent and no ball is live.
  // Shower 9 is a boss goal: boss down = won; budget spent with a live boss = lost.
  // Elsewhere: quota met = +1 Sunwell, quota missed = -2 Sunwell, and the run goes on while the Sunwell holds.
  function resolveShower(sim) {
    const s = sim.stats;
    const maxSunwell = num(config().sunwell && config().sunwell.max, 10);
    if (sim.over) {
      sim.phase = sim.over.result === 'won' ? 'won' : 'lost';
      return sim;
    }
    if (sim.rows && sim.rows.boss) {
      if (bossDown(sim)) {
        win(sim, 'boss');
        return sim;
      }
      lose(sim, 'boss', 'BALLS SPENT - THE DUSKFATHER STILL HOVERS - RUN LOST');
      return sim;
    }
    const quota = num(s.quota, 0);
    const met = s.quotaGot >= quota;
    if (met) {
      const before = num(sim.sunwell, 0);
      sim.sunwell = Math.min(maxSunwell, before + 1);
      if (sim.sunwell > before && globalThis.PB_Cascade && typeof globalThis.PB_Cascade.log === 'function') {
        globalThis.PB_Cascade.log(sim, 'QUOTA MET ' + s.quotaGot + '/' + quota + ' - SUNWELL +1 (' + sim.sunwell + '/' + maxSunwell + ')', 'win');
      }
    } else {
      sim.sunwell = Math.max(0, num(sim.sunwell, 0) - 2);
      if (globalThis.PB_Cascade && typeof globalThis.PB_Cascade.log === 'function') {
        globalThis.PB_Cascade.log(sim, 'QUOTA MISSED ' + s.quotaGot + '/' + quota + ' - SUNWELL -2 (' + sim.sunwell + '/' + maxSunwell + ')', 'drain');
      }
    }
    sim.showerResolved = true;
    if (sim.sunwell <= 0) {
      lose(sim, 'sunwell', 'SUNWELL DRY - RUN LOST');
      return sim;
    }
    sim.phase = 'showerEnd';
    sim.over = { result: 'end', reason: met ? 'quota' : 'quotaMiss', shower: sim.shower };
    return sim;
  }

  // One fixed tick: gates ease, spawns arrive, physics moves the balls, cascade scores the events, then shower-end checks.
  function stepSim(sim) {
    if (!sim || sim.paused) return sim;
    if (sim.phase !== 'play' && sim.phase !== 'build') return sim;
    alignDropPoint(sim);
    sim.tick += 1;
    sim.time = sim.tick / sim.stepHz;

    globalThis.PB_Gates.stepGates(sim);
    autoDrop(sim);
    if (globalThis.PB_Waves && typeof globalThis.PB_Waves.stepSpawns === 'function') globalThis.PB_Waves.stepSpawns(sim);
    if (globalThis.PB_Pests && typeof globalThis.PB_Pests.stepPests === 'function') globalThis.PB_Pests.stepPests(sim);
    globalThis.PB_Physics.stepBalls(sim, 1 / sim.stepHz);
    if (sim.boss && globalThis.PB_Duskfather && typeof globalThis.PB_Duskfather.syncParts === 'function') globalThis.PB_Duskfather.syncParts(sim.boss);
    globalThis.PB_Cascade.consumeEvents(sim);
    if (globalThis.PB_Duskfather && typeof globalThis.PB_Duskfather.step === 'function') globalThis.PB_Duskfather.step(sim);
    globalThis.PB_Cascade.stepDecay(sim);
    globalThis.PB_Cascade.stepCups(sim);

    if (sim.over) {
      sim.phase = sim.over.result === 'won' ? 'won' : 'lost';
      return sim;
    }
    if (num(sim.sunwell, 0) <= 0) {
      lose(sim, 'sunwell', 'SUNWELL DRY - RUN LOST');
      return sim;
    }
    const s = sim.stats;
    if (s.ballsLeft <= 0 && sim.balls.length === 0) resolveShower(sim);
    return sim;
  }

  function advanceSim(sim) {
    if (!sim) return sim;
    if (sim.phase === 'won' || sim.phase === 'lost') return sim;
    if (sim.phase !== 'showerEnd') return sim;
    const s = sim.stats;
    const c = config();
    const maxSunwell = num(c.sunwell && c.sunwell.max, 10);
    sim.runEndTick = sim.tick;
    if (sim.endless && sim.shower >= showersTotal() + 1 && sim.feats) sim.feats.overbloom = true;
    const bossShower = !!(sim.rows && sim.rows.boss);
    const cleared = bossShower ? bossDown(sim) : s.quotaGot >= s.quota;
    sim.history.push({
      shower: sim.shower,
      day: sim.day,
      quotaGot: s.quotaGot,
      quota: s.quota,
      blooms: s.blooms,
      drains: s.drains,
      bestCascade: s.bestCascade,
      score: Math.max(0, Math.round(sim.score - num(sim.scoreAtShower, 0))),
      sunwell: sim.sunwell,
      cleared: cleared,
      boss: bossShower,
      ballsUsed: s.ballsDropped,
    });
    sim.scoreAtShower = sim.score;
    const next = sim.shower + 1;
    if (cleared) {
      const dayDone = sim.shower % 3 === 0 && sim.shower <= showersTotal();
      sim.score += c.score.showerClear + (dayDone ? c.score.dayClear : 0);
      if (globalThis.PB_Cascade.log) {
        const day = daysFor(sim.shower);
        globalThis.PB_Cascade.log(sim, bossShower ? 'DUSKFATHER DRIVEN OFF +' + c.score.showerClear : 'SHOWER ' + sim.shower + ' CLEARED +' + c.score.showerClear, 'win');
        if (dayDone && day) globalThis.PB_Cascade.log(sim, (day.name || 'DAY ' + day.day).toUpperCase() + ' DONE +' + c.score.dayClear, 'win');
      }
    }
    // The Sunwell bonus for a met shower is applied once, in resolveShower; here it is only capped.
    sim.sunwell = Math.min(maxSunwell, num(sim.sunwell, 0));
    if (sim.sunwell >= maxSunwell && sim.feats) sim.feats.fullSunwell = next === showersTotal();

    if (next > showersTotal()) sim.endless = true;

    const draftApi = globalThis.PB_Draft;
    if (draftApi && typeof draftApi.makeOffers === 'function') {
      sim.phase = 'draft';
      sim.draft = {
        offers: draftApi.makeOffers(sim, next),
        rerolls: 0,
        target: next,
        pending: null,
      };
    } else {
      startShower(sim, next);
      sim.building = true;
      sim.phase = 'build';
    }
    return sim;
  }

  // Reopen the board for shower n and announce its wind in the banner; boss showers leave a boss hook to duskfather.js.
  function startShower(sim, n) {
    if (!sim) return sim;
    const row = showerRow(n);
    sim.rows = rowCopy(row);
    openShower(sim, n);
    if (sim.rows.boss && globalThis.PB_Duskfather && typeof globalThis.PB_Duskfather.spawn === 'function') {
      sim.boss = globalThis.PB_Duskfather.spawn(sim);
    } else if (sim.rows.boss) {
      sim.boss = {
        name: globalThis.PB_NAMES.bossInfo.name,
        kind: 'boss',
        isBoss: true,
        x: config().board.field.x + config().board.field.w * 0.5,
        y: config().board.field.y + config().board.field.h * 0.38,
        r: 44,
        hp: config().score.bossHP,
        maxHp: config().score.bossHP,
        alive: true,
        defeated: false,
      };
    } else {
      sim.boss = null;
    }
    return sim;
  }

  // ---- player API (input/main and headless bots) ----

  // Keep cascade.js's rail point inside the field: a ball born above the top wall loses its entry
  // velocity to the wall clamp on its first tick. Called before every drop and at sim creation.
  function safeDropPoint(sim) {
    const c = config();
    const base = globalThis.PB_Cascade.dropPoint;
    const pt = base(sim);
    const pad = c.board.ballRadius + 2;
    return { x: pt.x, y: Math.max(num(pt.y, 0), c.board.field.y + pad) };
  }

  function alignDropPoint(sim) {
    if (globalThis.PB_Cascade && typeof globalThis.PB_Cascade.dropPoint === 'function') {
      globalThis.PB_Cascade.dropPoint = safeDropPoint;
    }
  }

  function drop(sim) {
    if (!sim) return false;
    alignDropPoint(sim);
    return globalThis.PB_Cascade.dropBall(sim);
  }

  function moveDropper(sim, x) {
    if (!sim || !sim.dropper) return false;
    const c = config();
    const rail = c.board.dropperRail;
    const f = c.board.field;
    const lo = Math.max(rail.x, f.x + 16);
    const hi = Math.min(rail.x + rail.w, f.x + f.w - 16);
    const next = clamp(num(x, sim.dropper.x), lo, hi);
    if (next === sim.dropper.x) return false;
    sim.dropper.x = next;
    return true;
  }

  function rotateGate(sim, i, dir) {
    return globalThis.PB_Gates.rotateGate(sim, i, dir);
  }

  function chooseDraft(sim, i) {
    if (!sim || !sim.draft || !sim.draft.offers) return false;
    const offer = sim.draft.offers[i];
    if (!offer) return false;
    const key = offer.key;
    const owned = sim.owned || (sim.owned = {});
    owned[key] = num(owned[key], 0) + 1;
    if (offer.buildable !== false) sim.draft.pending = { key: key, buildable: true };
    sim.draft.chosen = i;
    const next = sim.draft.target || sim.shower + 1;
    startShower(sim, next);
    return key;
  }

  function rerollDraft(sim) {
    if (!sim || !sim.draft || !globalThis.PB_Draft || typeof globalThis.PB_Draft.makeOffers !== 'function') return false;
    const cost = config().draft.rerollCost;
    if (sim.seeds < cost) return false;
    sim.seeds -= cost;
    sim.draft.offers = globalThis.PB_Draft.makeOffers(sim, sim.draft.target || sim.shower + 1);
    sim.draft.rerolls = num(sim.draft.rerolls, 0) + 1;
    return true;
  }

  function placeContraption(sim, socketIdx, kind) {
    if (!sim) return false;
    if (sim.phase !== 'build' || sim.building !== true) return false;
    const key = kind || (sim.draft && sim.draft.pending && sim.draft.pending.key);
    if (!key) return false;
    const meta = (globalThis.PB_NAMES.contraptions || []).find(function (c) { return c.key === key; }) || null;
    if (!meta) return false;
    if (num(sim.owned[key], 0) <= 0) return false;
    const cost = num(meta.cost, 2);
    if (sim.seeds < cost) return false;
    if (!applyContraption(sim, socketIdx, key)) return false;
    sim.seeds -= cost;
    sim.owned[key] = Math.max(0, sim.owned[key] - 1);
    sim.builds.push({ shower: sim.shower, socket: socketIdx, kind: key, cost: cost });
    if (sim.draft) sim.draft.pending = null;
    return true;
  }

  function startBuild(sim) {
    if (!sim || sim.phase === 'lost' || sim.phase === 'won') return false;
    sim.building = true;
    sim.phase = 'build';
    return true;
  }

  function endBuild(sim) {
    if (!sim || (sim.phase !== 'build' && sim.phase !== 'draft')) return false;
    sim.building = false;
    sim.phase = 'play';
    return true;
  }

  // OVERBLOOM: after shower 9 the endless rows carry on until the Sunwell dries.
  function beginOverbloom(sim) {
    if (!sim) return false;
    sim.endless = true;
    if (sim.over) sim.over = null;
    startShower(sim, showersTotal() + 1);
    return true;
  }

  globalThis.PB_Sim = {
    createSim: createSim,
    stepSim: stepSim,
    advanceSim: advanceSim,
    startShower: startShower,
    drop: drop,
    moveDropper: moveDropper,
    rotateGate: rotateGate,
    chooseDraft: chooseDraft,
    rerollDraft: rerollDraft,
    placeContraption: placeContraption,
    applyContraption: applyContraption,
    startBuild: startBuild,
    endBuild: endBuild,
    beginOverbloom: beginOverbloom,
    showerRow: showerRow,
    daysFor: daysFor,
    showersTotal: showersTotal,
  };
})();
