// The draft between showers: a pool of 12 charms, 1-of-3 offers from the seeded RNG, seed-costed rerolls, real effects and an honest landing forecast.
(function () {
  if (typeof globalThis.PB_Draft === 'object' && globalThis.PB_Draft !== null) return;

  // The six charms that are not buildables. Buildable picks are free placement tokens.
  const CHARMS = [
    {
      key: 'goldenPeg', name: 'GOLDEN PEG', repeat: true,
      effect: 'Marks 3 random pegs golden: x3 score and a brighter bounce.',
      synergy: 'Pairs with GEM TRELLIS',
      apply: applyGoldenPeg,
    },
    {
      key: 'cascadeBell', name: 'CASCADE BELL', repeat: true,
      effect: 'CASCADE cools half as fast; a bell rings on every x8.',
      synergy: 'Holds x8 through gaps',
      apply: function (sim) {
        sim.adders.decaySlow = Math.max(num(sim.adders.decaySlow, 1), 2);
        sim.adders.bell = 1;
      },
    },
    {
      key: 'seedFan', name: 'SEED FAN', repeat: true,
      effect: '+1 bonus seed every 3 blooms.',
      synergy: 'Banks seeds for rerolls',
      apply: function (sim) {
        sim.adders.seedFan = num(sim.adders.seedFan, 0) + 1;
      },
    },
    {
      key: 'mothNet', name: 'MOTH NET', repeat: true,
      effect: 'Every pest clear pays 1 extra seed.',
      synergy: 'Counter clingmoth swarms',
      apply: function (sim) {
        sim.adders.pestSeedEvery = num(sim.adders.pestSeedEvery, 0) + 1;
      },
    },
    {
      key: 'wideCups', name: 'WIDE CUPS', oneShot: true,
      effect: 'Cup mouths catch 6px wider on each side.',
      synergy: 'Quota showers 7-8',
      apply: function (sim) {
        sim.drafts.wideCups = true;
        sim.cups.catchPad = num(sim.cups.catchPad, 0) + 6;
        sim.adders.cupPad = num(sim.adders.cupPad, 0) + 6;
      },
    },
    {
      key: 'glowTrails', name: 'GLOW TRAILS', oneShot: true,
      effect: 'Balls keep their glow after pegs die down.',
      synergy: 'Reads dark showers',
      apply: function (sim) {
        sim.drafts.glowTrails = true;
      },
    },
    {
      key: 'secondDropper', name: 'SECOND DROPPER', oneShot: true,
      effect: 'Drop cooldown halved: two clocks, twice the dew.',
      synergy: 'Dense cascades by shower 6',
      apply: function (sim) {
        sim.drafts.secondDropper = true;
        sim.adders.dropCooldownMul = 0.5;
      },
    },
  ];

  function config() {
    const c = globalThis.PB_CONFIG;
    if (!c || !c.board) throw new Error('PB_Draft: PB_CONFIG missing (load config.js first)');
    return c;
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function names() {
    return globalThis.PB_NAMES || {};
  }

  function log(sim, text, kind) {
    if (globalThis.PB_Cascade && typeof globalThis.PB_Cascade.log === 'function') globalThis.PB_Cascade.log(sim, text, kind || 'draft');
  }

  function fx(sim, event) {
    if (sim && sim.fx && typeof sim.fx.push === 'function') sim.fx.push(event);
  }

  function draftState(sim) {
    if (!Array.isArray(sim.tokens)) sim.tokens = [];
    if (!sim.drafts) sim.drafts = { wideCups: false, glowTrails: false, secondDropper: false };
    if (!sim.adders) sim.adders = {};
    return sim.drafts;
  }

  function contraptionMeta(kind) {
    if (globalThis.PB_Contraptions && typeof globalThis.PB_Contraptions.info === 'function') {
      const info = globalThis.PB_Contraptions.info(kind, 1);
      if (info) return info;
    }
    return null;
  }

  // The full pool: five buildables (free placement tokens) followed by the seven charms, twelve in all.
  function pool() {
    const out = [];
    const keys = (globalThis.PB_Contraptions && globalThis.PB_Contraptions.SLOT_KEYS) || [];
    for (let i = 0; i < keys.length; i += 1) {
      const d = contraptionMeta(keys[i]);
      if (!d) continue;
      out.push({
        key: d.key,
        name: d.name,
        effect: d.effect,
        synergy: d.synergy,
        buildable: true,
        token: true,
        oneShot: false,
        repeat: true,
      });
    }
    for (let i = 0; i < CHARMS.length; i += 1) {
      const c = CHARMS[i];
      out.push({
        key: c.key,
        name: c.name,
        effect: c.effect,
        synergy: c.synergy,
        buildable: false,
        token: false,
        oneShot: c.oneShot === true,
        repeat: c.repeat === true,
        apply: c.apply,
      });
    }
    return out;
  }

  function byKey(key) {
    const list = pool();
    for (let i = 0; i < list.length; i += 1) if (list[i].key === key) return list[i];
    return null;
  }

  function ownedCount(sim, key) {
    return num(sim.owned && sim.owned[key], 0);
  }

  function hasOneShot(sim, entry) {
    if (!entry.oneShot) return false;
    if (sim.drafts && sim.drafts[entry.key]) return true;
    if (entry.key === 'wideCups') return num(sim.adders && sim.adders.cupPad, 0) > 0;
    if (entry.key === 'glowTrails') return !!(sim.drafts && sim.drafts.glowTrails);
    if (entry.key === 'secondDropper') return num(sim.adders && sim.adders.dropCooldownMul, 1) < 1;
    return ownedCount(sim, entry.key) > 0;
  }

  function eligible(sim) {
    const all = pool();
    const out = [];
    for (let i = 0; i < all.length; i += 1) if (!hasOneShot(sim, all[i])) out.push(all[i]);
    return out;
  }

  function rngFor(sim) {
    return sim && sim.rng && typeof sim.rng.next === 'function' ? sim.rng : globalThis.PB_RNG.create('draft');
  }

  // Draws n distinct offers from the legal pool using sim.rng only, so a rerun always replays.
  function draw(sim, n) {
    const list = eligible(sim);
    const rng = rngFor(sim);
    const count = Math.min(num(n, config().draft.options) || 3, list.length);
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.next() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
    const offers = [];
    for (let i = 0; i < count; i += 1) {
      const entry = list[i];
      const offer = {
        key: entry.key,
        name: entry.name,
        effect: entry.effect,
        synergy: entry.synergy,
        buildable: entry.buildable,
        token: entry.token,
        oneShot: entry.oneShot,
      };
      if (entry.buildable) {
        const meta = contraptionMeta(entry.key);
        offer.cost = meta ? meta.cost : 0;
      }
      offers.push(offer);
    }
    return offers;
  }

  // 1 of 3 for the draft that follows the current shower.
  function offers(sim) {
    const list = draw(sim, config().draft.options || 3);
    if (sim) {
      if (!sim.draft) sim.draft = {};
      sim.draft.offers = list;
      sim.draft.rerolls = num(sim.draft.rerolls, 0);
    }
    return list;
  }

  function makeOffers(sim) {
    return offers(sim);
  }

  function redraw(sim) {
    if (!sim || !sim.draft) return false;
    const target = num(sim.draft.target, sim.shower + 1);
    sim.draft.offers = draw(sim, config().draft.options || 3);
    sim.draft.rerolls = num(sim.draft.rerolls, 0) + 1;
    sim.draft.target = target;
    return true;
  }

  // Seed-costed reroll. sim.rerollDraft charges the seeds and calls redraw; this is the public entry.
  function reroll(sim) {
    if (!sim || !sim.draft || !sim.draft.offers) return false;
    const api = sim.rerollDraft;
    if (typeof api === 'function') return api(sim) === true;
    const cost = num(config().draft.rerollCost, 3);
    if (num(sim.seeds, 0) < cost) return false;
    sim.seeds -= cost;
    return redraw(sim);
  }

  // Visible reroll price: the config cost, +1 once two rerolls have already been spent this draft.
  function rerollCost(sim) {
    const base = num(config().draft.rerollCost, 3);
    const used = sim && sim.draft ? num(sim.draft.rerolls, 0) : 0;
    return Math.max(1, base + (used >= 2 ? 1 : 0));
  }

  function appliedCount(sim, key) {
    if (!sim || !sim.draftLog) return 0;
    let n = 0;
    for (let i = 0; i < sim.draftLog.length; i += 1) if (sim.draftLog[i].key === key) n += 1;
    return n;
  }

  // Applies one pick: tokens go on the rack, charms call apply(sim), everything lands in sim.draftLog.
  function apply(sim, entry) {
    if (!sim || !entry) return false;
    const drafts = draftState(sim);
    if (!sim.owned) sim.owned = {};
    if (entry.buildable) {
      if (typeof sim.addToken === 'function') sim.addToken(entry.key);
      else {
        sim.owned[entry.key] = ownedCount(sim, entry.key) + 1;
        if (Array.isArray(sim.tokens)) sim.tokens.push(entry.key);
      }
      log(sim, entry.name + ' ADDED - free build after this draft', 'draft');
      return true;
    }
    if (hasOneShot(sim, entry)) return false;
    drafts.bell = num(drafts.bell, 0);
    if (typeof entry.apply === 'function') entry.apply(sim);
    if (Array.isArray(sim.draftLog)) sim.draftLog.push({ key: entry.key, shower: sim.shower, target: sim.draft ? sim.draft.target : sim.shower + 1 });
    if (entry.key === 'cascadeBell') drafts.bell = num(drafts.bell, 0) + 1;
    log(sim, entry.name + ' DRAFTED - ' + entry.effect, 'draft');
    fx(sim, { type: 'draft', key: entry.key, name: entry.name });
    return true;
  }

  // The draft screen's X key / reroll button.
  function choose(sim, i) {
    const api = sim && sim.chooseDraft;
    if (typeof api !== 'function') return false;
    return api.call(sim, i);
  }

  // Three random lit pegs become golden; they stay gold until a shower reset re-deals them.
  function applyGoldenPeg(sim) {
    const pegs = (sim && sim.pegs) || [];
    const rng = rngFor(sim);
    const candidates = [];
    for (let i = 0; i < pegs.length; i += 1) {
      const p = pegs[i];
      if (!p || p.golden || p.runGolden) continue;
      if (p.row < 2 || p.row > 9) continue;
      candidates.push(p);
    }
    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.next() * (i + 1));
      const swap = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = swap;
    }
    let made = 0;
    for (let i = 0; i < candidates.length && made < 3; i += 1) {
      candidates[i].golden = true;
      candidates[i].runGolden = true;
      made += 1;
    }
    if (sim) sim.goldenPegs = num(sim.goldenPegs, 0) + made;
    return made;
  }

  function reapply(sim) {
    const pegs = (sim && sim.pegs) || [];
    for (let i = 0; i < pegs.length; i += 1) if (pegs[i] && pegs[i].runGolden) pegs[i].golden = true;
  }

  // ---- forecast: a real stepped mini-sim on the next shower's board ----

  const FORECAST_DROPS = 12;
  // A forecast-only spread and launch offset; read per call so tools can sweep them.
  const FORECAST_ROW_GAP = 9;
  const defaultSpread = function () { return num(globalThis.PB_CONFIG && globalThis.PB_CONFIG.draft && globalThis.PB_CONFIG.draft.forecastSpread, 56); };

  function forecastRow(sim) {
    const target = num(sim && sim.draft && sim.draft.target, (sim ? sim.shower : 1) + 1);
    if (globalThis.PB_Sim && typeof globalThis.PB_Sim.showerRow === 'function') return globalThis.PB_Sim.showerRow(target);
    const list = config().showers || [];
    return list[Math.min(list.length - 1, target - 1)] || list[0] || { wind: 'still' };
  }

  // The wind the next shower will actually push with: a placed FAN LEAF that spans the centre
  // column cancels it, exactly as it will during play.
  function centreWind(sim, row) {
    let force = 0;
    if (globalThis.PB_Gates && typeof globalThis.PB_Gates.windFor === 'function') {
      const w = globalThis.PB_Gates.windFor(row);
      force = num(w && w.force, 0);
    } else {
      const c = config();
      const w = c.winds && c.winds[row && row.wind];
      force = num(w && w.force, 0);
    }
    if (force === 0) return 0;
    const field = config().board.field;
    const cx = field.x + field.w * 0.5;
    const sockets = (sim && sim.sockets) || [];
    for (let i = 0; i < sockets.length; i += 1) {
      const s = sockets[i];
      if (s && s.kind === 'fanLeaf' && Math.abs(cx - s.x) <= num(s.half, 0)) return 0;
    }
    return force;
  }

  // A cheap probe: fresh cups, copied pegs that never die, copied sockets and gates. It still uses
  // the real gates, bumpers, tulips, rim posts, wind and cup-mouth math.
  function probeFor(sim, row) {
    const c = config();
    const cups = globalThis.PB_Pegboard.buildCups(c);
    const pegs = [];
    const src = sim.pegs || [];
    for (let i = 0; i < src.length; i += 1) {
      const p = src[i];
      pegs.push({ x: p.x, y: p.y, r: p.r, lit: 0, dead: 0, golden: p.golden === true, hitFlash: 0, row: p.row, col: p.col, index: p.index });
    }
    const sockets = [];
    const srcSockets = sim.sockets || [];
    for (let i = 0; i < srcSockets.length; i += 1) sockets.push(JSON.parse(JSON.stringify(srcSockets[i])));
    const gates = [];
    const srcGates = sim.gates || [];
    for (let i = 0; i < srcGates.length; i += 1) {
      const g = srcGates[i];
      gates.push({ x: g.x, y: g.y, angle: g.angle, target: g.target, len: g.len, side: g.side, hinge: g.hinge, on: g.on });
    }
    return {
      phase: 'play',
      stepHz: 60,
      tick: 0,
      seed: String(sim.seed || 'forecast') + ':forecast:' + num(row.shower, 1),
      rng: globalThis.PB_RNG.create(String(sim.seed || 'forecast') + ':forecast:' + num(row.shower, 1)),
      pegs: pegs,
      pegGrid: globalThis.PB_Pegboard.buildRows(c, pegs),
      sockets: sockets,
      cups: cups,
      rimPegs: globalThis.PB_Pegboard.buildRimPegs(c, cups),
      tulips: [],
      gates: gates,
      wind: { key: row.wind || 'still', label: row.wind || 'STILL', name: row.wind || 'STILL', force: centreWind(sim, row) },
      fanBands: [],
      balls: [],
      pests: [],
      boss: null,
      events: [],
      fx: [],
      log: [],
      stats: { ballsLeft: 999, blooms: 0, drains: 0 },
      cascade: { streak: 0, mult: 1, lastCatchTick: 0 },
      adders: { cupPad: num(sim.adders && sim.adders.cupPad, 0) },
      drafts: sim.drafts || {},
      dropper: { x: c.board.field.x + c.board.field.w * 0.5, cooldown: 0 },
    };
  }

  // Twelve balls scripted every nine ticks from a jittered fan around the dropper centre; the honest
  // answer is how many of them reach a cup, and which cup the first bloom landed in.
  // The ghost cascade drawn on the draft screen: the same seeded motes from the dropper down through
  // each petal gate to the cup they would land in, stepped on the same probe board.
  function ghostPath(sim, probe, script) {
    const c = config();
    const field = c.board.field;
    const gates = (probe.gates || []).slice().sort(function (a, b) { return a.y - b.y; });
    const pts = [];
    for (let i = 0; i < script.length; i += 1) {
      const ghost = probeFor(sim, forecastRow(sim));
      ghost.gates = [];
      const ball = globalThis.PB_Physics.makeBall(script[i].x, field.y + c.board.ballRadius + 2, 0, num(c.physics.entryVy, 70));
      ghost.balls.push(ball);
      let gate = 0;
      let landX = ball.x;
      for (let tick = 0; tick < 900 && ghost.balls.length && gate <= gates.length; tick += 1) {
        ghost.tick = tick;
        globalThis.PB_Physics.stepBalls(ghost, 1 / 60);
        if (ghost.balls.length === 0) break;
        const b = ghost.balls[0];
        if (gate < gates.length && b.y >= gates[gate].y) {
          pts.push({ mote: i, gate: gate, x: Math.round(b.x), y: Math.round(b.y) });
          landX = b.x;
          gate += 1;
        }
        const evs = ghost.events;
        for (let e = 0; e < evs.length; e += 1) if (evs[e] && evs[e].type === 'cup') landX = num(evs[e].x, landX);
        evs.length = 0;
      }
      if (gate < gates.length) {
        for (; gate < gates.length; gate += 1) pts.push({ mote: i, gate: gate, x: Math.round(landX), y: Math.round(gates[gate].y) });
      }
      pts.push({ mote: i, gate: gates.length, x: Math.round(landX), y: Math.round(c.board.cupY) });
    }
    return pts;
  }

  function forecast(sim) {
    if (!sim) return null;
    const c = config();
    const field = c.board.field;
    const row = forecastRow(sim);
    const probe = probeFor(sim, row);
    const centre = field.x + field.w * 0.5;
    // The scripted motes fan out around the centre with seeded jitter, so a wider cup mouth or a
    // nudged gate changes which motes land. Same seed and board, same forecast, every time.
    const rng = globalThis.PB_RNG.create(String(sim.seed || 'forecast') + ':script:' + num(row.shower, 1));
    const script = [];
    for (let i = 0; i < FORECAST_DROPS; i += 1) {
      const offset = (rng.next() * 2 - 1) * defaultSpread();
      script.push({ x: centre + offset, at: i * FORECAST_ROW_GAP, dropped: false });
    }
    const cups = [];
    for (let i = 0; i < probe.cups.length; i += 1) cups.push(0);
    const drops = [];
    let next = 0;
    let landed = 0;
    let misses = 0;
    let firstCup = -1;
    let lastTick = 0;
    const limit = 900;
    for (let tick = 0; tick < limit; tick += 1) {
      probe.tick = tick;
      while (next < script.length && script[next].at <= tick) {
        const s = script[next];
        s.dropped = true;
        probe.balls.push(globalThis.PB_Physics.makeBall(s.x, field.y + c.board.ballRadius + 2, 0, num(c.physics.entryVy, 70)));
        next += 1;
      }
      globalThis.PB_Physics.stepBalls(probe, 1 / 60);
      const evs = probe.events;
      for (let e = 0; e < evs.length; e += 1) {
        const ev = evs[e];
        if (!ev) continue;
        if (ev.type === 'cup') {
          const idx = num(ev.cupIndex, -1);
          landed += 1;
          if (idx >= 0 && idx < cups.length) cups[idx] += 1;
          if (firstCup < 0) firstCup = idx;
          if (drops.length < FORECAST_DROPS) drops.push({ cup: idx, x: num(ev.x, centre), colour: probe.cups[idx] ? probe.cups[idx].colourName : 'gold', kind: 'bloom' });
        } else if (ev.type === 'drain') {
          misses += 1;
          if (drops.length < FORECAST_DROPS) drops.push({ cup: -1, x: num(ev.x, centre), colour: 'coral', kind: 'drain' });
        }
      }
      evs.length = 0;
      lastTick = tick;
      if (next >= script.length && probe.balls.length === 0) break;
    }
    const path = ghostPath(sim, probe, script);
    const out = {
      shower: num(row.shower, sim.shower + 1),
      wind: row.wind || 'still',
      windForce: num(probe.wind.force, 0),
      balls: FORECAST_DROPS,
      landed: landed,
      misses: misses,
      cups: cups,
      cupCount: firstCup,
      cupIndex: firstCup,
      path: path,
      drops: drops,
      ticks: lastTick,
      label: landed > 0 ? 'LANDS ' + Math.min(9, landed) + ' CUPS' : 'MISS - ALL DRAIN',
    };
    sim.forecast = out;
    return out;
  }

  globalThis.PB_Draft = {
    pool: pool,
    byKey: byKey,
    offers: offers,
    makeOffers: makeOffers,
    reroll: reroll,
    redraw: redraw,
    rerollCost: rerollCost,
    choose: choose,
    apply: apply,
    applyGoldenPeg: applyGoldenPeg,
    reapply: reapply,
    forecast: forecast,
    eligible: eligible,
    hasOneShot: hasOneShot,
    appliedCount: appliedCount,
    FORECAST_DROPS: FORECAST_DROPS,
  };
})();
