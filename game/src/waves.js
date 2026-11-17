// The 9-shower schedule: per-shower config merged with difficulty, the pest introduction table, the spawn director and OVERBLOOM scaling.
(function () {
  if (typeof globalThis.PB_Waves === 'object' && globalThis.PB_Waves !== null) return;

  // When each pest kind first appears (shower number), with the INCOMING counts that plan assumes.
  const INTRO = [
    { kind: 'clingmoth', from: 2, base: 3 },
    { kind: 'draingrub', from: 4, base: 2 },
    { kind: 'petalbat', from: 5, base: 2 },
    { kind: 'huskling', from: 7, base: 2 },
  ];

  const FIRST_SPAWN_TICK = 150;
  const SPAWN_GAP = 250;
  const SPAWN_GAP_JITTER = 120;
  const MIX_AT = 3;

  function config() {
    const c = globalThis.PB_CONFIG;
    if (!c || !c.board) throw new Error('PB_Waves: PB_CONFIG missing (load config.js first)');
    return c;
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function rows() {
    return config().showers || [];
  }

  function total() {
    return rows().length || 9;
  }

  function pestNames() {
    return (globalThis.PB_NAMES && globalThis.PB_NAMES.pests) || [];
  }

  function pestName(kind) {
    const list = pestNames();
    for (let i = 0; i < list.length; i += 1) if (list[i].key === kind) return list[i].name;
    return String(kind || '').toUpperCase();
  }

  function pestTrait(kind) {
    const list = pestNames();
    for (let i = 0; i < list.length; i += 1) if (list[i].key === kind) return list[i].trait;
    for (let i = 0; i < INTRO.length; i += 1) if (INTRO[i].kind === kind) return kind;
    return '';
  }

  function difficultyDef(sim) {
    const c = config();
    if (sim && sim.diff) return sim.diff;
    const key = sim && sim.difficulty;
    return (c.difficulties && c.difficulties[key]) || c.difficulties.Normal;
  }

  // The base config row for shower n. Endless rows cycle the 9 config rows after shower 9.
  function baseRow(n) {
    const list = rows();
    const count = list.length || 9;
    if (!list.length) return { shower: n, day: 3, balls: 30, quota: 100, wind: 'east', pestBudget: 10 };
    if (n <= count) return list[n - 1];
    const src = list[(n - 1) % count];
    const cycle = Math.floor((n - 1) / count);
    return {
      shower: n,
      day: 3,
      cycle: cycle,
      source: src.shower,
      balls: Math.round(src.balls * Math.pow(1.1, cycle)),
      quota: Math.round(src.quota * Math.pow(1.15, cycle)),
      wind: src.wind,
      pestBudget: Math.round(src.pestBudget * Math.pow(1.15, cycle)) + cycle,
      boss: false,
      endless: true,
    };
  }

  // Row + difficulty multipliers + the day's wind, as one object the sim can hold.
  function showerConfig(sim, n) {
    const c = config();
    const diff = difficultyDef(sim);
    const src = baseRow(n);
    const row = {};
    for (const k in src) if (Object.prototype.hasOwnProperty.call(src, k)) row[k] = src[k];
    row.shower = n;
    row.endless = n > total();
    row.day = num(src.day, 3);
    row.quota = Math.max(1, Math.round(num(src.quota, 1) * num(diff.quotaMul, 1)));
    row.balls = Math.max(1, Math.round(num(src.balls, 1) * num(diff.ballMul, 1)));
    row.pestBudget = Math.max(0, Math.round(num(src.pestBudget, 0) * num(diff.pestMul, 1)));
    row.boss = src.boss === true && !row.endless;
    const windKey = src.wind || 'still';
    const wind = (c.winds && c.winds[windKey]) || c.winds.still;
    row.wind = windKey;
    row.windName = wind.name;
    row.windForce = num(wind.force, 0);
    return row;
  }

  // How many pests a shower's budget actually buys on this difficulty.
  function pestCount(sim, n) {
    return showerConfig(sim, n).pestBudget;
  }

  // Which kinds are unlocked by shower n, in introduction order.
  function unlockedFor(n) {
    const out = [];
    for (let i = 0; i < INTRO.length; i += 1) if (n >= INTRO[i].from) out.push(INTRO[i].kind);
    return out;
  }

  // The kind introduced at shower n, or null if n brings no new pest.
  function nextNew(n) {
    for (let i = 0; i < INTRO.length; i += 1) if (INTRO[i].from === n) return INTRO[i].kind;
    return null;
  }

  // The INCOMING roster for shower n: [{kind, name, count, trait}] that adds up to the budget.
  function rosterFor(n, sim) {
    const row = sim ? showerConfig(sim, n) : showerConfig(null, n);
    const budget = Math.max(0, row.pestBudget);
    const kinds = unlockedFor(n);
    const out = [];
    if (!kinds.length || budget <= 0) return out;
    const buckets = kinds.map(function (kind) {
      return { kind: kind, count: 0 };
    });
    let left = budget;
    let baseSum = 0;
    for (let i = 0; i < INTRO.length; i += 1) {
      if (kinds.indexOf(INTRO[i].kind) >= 0 && kinds.length <= MIX_AT) baseSum += INTRO[i].base;
    }
    if (kinds.length <= MIX_AT && baseSum > 0) {
      for (let b = 0; b < buckets.length; b += 1) {
        let meta = null;
        for (let i = 0; i < INTRO.length; i += 1) if (INTRO[i].kind === buckets[b].kind) meta = INTRO[i];
        const share = Math.min(left, Math.round((budget * (meta ? meta.base : 1)) / baseSum));
        buckets[b].count = share;
        left -= share;
      }
    }
    if (!baseSum) {
      // Four kinds in play: the newest gets half, the older kinds split the rest evenly.
      const newest = buckets[buckets.length - 1];
      const share = Math.floor(budget * 0.5);
      const older = buckets.slice(0, buckets.length - 1);
      for (let o = 0; o < older.length && left > share; o += 1) {
        const take = Math.min(left - share, Math.max(1, Math.floor((budget - share) / older.length)));
        older[o].count = take;
        left -= take;
      }
      newest.count = left;
      left = 0;
    } else if (left > 0) {
      // Leftover budget goes to the newest unlocked kind.
      buckets[buckets.length - 1].count += left;
    }
    for (let b = 0; b < buckets.length; b += 1) {
      if (buckets[b].count > 0) {
        out.push({
          kind: buckets[b].kind,
          name: pestName(buckets[b].kind),
          count: buckets[b].count,
          trait: pestTrait(buckets[b].kind),
        });
      }
    }
    return out;
  }

  // "NEXT: HUSKLING - stubborn" for the HUD; null after the last new pest (show the boss line instead).
  function nextLine(n) {
    const kind = nextNew(n + 1);
    if (kind) return { kind: kind, text: 'NEXT: ' + pestName(kind) + ' - ' + pestTrait(kind) };
    if (n < total() && (n + 1) === total()) {
      const boss = (globalThis.PB_NAMES && globalThis.PB_NAMES.bossInfo) || { name: 'THE DUSKFATHER' };
      return { kind: 'duskfather', text: 'NEXT: ' + boss.name + ' - boss' };
    }
    return null;
  }

  // The spawn plan for this shower: the roster flattened into a list spent in roster order.
  function makePlan(sim) {
    const row = sim && sim.rows ? sim.rows : showerConfig(sim, 1);
    if (row.boss && !sim.endless) {
      // Shower 9: the Duskfather sheds his own moths; the budget only seeds the first wave.
      return { list: [], index: 0, nextTick: 0, cap: 0 };
    }
    const roster = rosterFor(sim.shower, sim);
    const list = [];
    for (let i = 0; i < roster.length; i += 1) {
      for (let k = 0; k < roster[i].count; k += 1) list.push(roster[i].kind);
    }
    const jitter = sim.rng && typeof sim.rng.next === 'function' ? Math.floor(sim.rng.next() * SPAWN_GAP_JITTER) : 0;
    return {
      list: list,
      index: 0,
      nextTick: num(sim.tick, 0) + FIRST_SPAWN_TICK + jitter,
      cap: 0,
      spawnedShower: sim.shower,
    };
  }

  function ensurePlan(sim) {
    if (!sim.spawnPlan || sim.spawnPlan.spawnedShower !== sim.shower) sim.spawnPlan = makePlan(sim);
    return sim.spawnPlan;
  }

  // Live pests plus the unspent plan make up the "HOLD n MORE" counter for the HUD.
  function holdRemaining(sim) {
    const plan = sim.spawnPlan;
    if (!plan || !plan.list) return 0;
    return Math.max(0, plan.list.length - plan.index);
  }

  // Per-tick spawn director: spends this shower's pest budget on a deterministic schedule.
  function stepSpawns(sim) {
    if (!sim || sim.phase !== 'play') return 0;
    const plan = ensurePlan(sim);
    if (!plan.list.length || plan.index >= plan.list.length) return 0;
    if (num(sim.tick, 0) < plan.nextTick) return 0;
    let made = 0;
    while (plan.index < plan.list.length && num(sim.tick, 0) >= plan.nextTick) {
      const kind = plan.list[plan.index];
      if (globalThis.PB_Pests && typeof globalThis.PB_Pests.spawnPest === 'function') {
        const p = globalThis.PB_Pests.spawnPest(sim, kind);
        if (p) {
          made += 1;
          if (globalThis.PB_Cascade && typeof globalThis.PB_Cascade.log === 'function') {
            globalThis.PB_Cascade.log(sim, p.name + ' INCOMING - ' + p.trait.toUpperCase(), 'pest');
          }
        }
      }
      plan.index += 1;
      if (plan.index >= plan.list.length) break;
      const jitter = sim.rng && typeof sim.rng.next === 'function' ? Math.floor(sim.rng.next() * SPAWN_GAP_JITTER) : 0;
      plan.nextTick = num(sim.tick, 0) + Math.max(60, SPAWN_GAP + jitter);
    }
    return made;
  }

  // Reset the spawn plan when a shower opens (sim.openShower runs before this is first needed).
  function openShower(sim) {
    if (!sim) return null;
    sim.spawnPlan = makePlan(sim);
    return sim.spawnPlan;
  }

  function isEndless(sim) {
    return !!(sim && sim.endless) || !!(sim && sim.shower > total());
  }

  globalThis.PB_Waves = {
    showerConfig: showerConfig,
    baseRow: baseRow,
    stepSpawns: stepSpawns,
    openShower: openShower,
    makePlan: makePlan,
    rosterFor: rosterFor,
    nextNew: nextNew,
    nextLine: nextLine,
    unlockedFor: unlockedFor,
    holdRemaining: holdRemaining,
    pestCount: pestCount,
    isEndless: isEndless,
    total: total,
    INTRO: INTRO,
  };
})();
