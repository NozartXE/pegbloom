// Boot and screen state machine: owns the canvas loop, routes input, drives the seeded run lifecycle and the title demo.
(function () {
  if (globalThis.PB_Main && typeof globalThis.PB_Main.boot === 'function') return;

  const W = 1280;
  const H = 800;
  const STEP = 1 / 60;
  const DEMO_SEED = 'pegbloom-demo';

  const app = {
    mounted: false,
    canvas: null,
    ctx: null,
    screen: 'title',
    previous: 'title',
    view: {},
    buttons: {},
    hover: null,
    staged: false,
    frozen: false,
    paused: false,
    fast: false,
    difficulty: 'Normal',
    sim: null,
    demo: null,
    run: null,
    record: null,
    summary: null,
    demoPolicy: null,
    demoGap: 0,
    demoDelay: 0,
    selectedGate: 0,
    selectedSocket: -1,
    selectedCard: -1,
    status: '',
    booted: false,
    accumulator: 0,
    tick: 0,
    toast: null,
    audioReady: false,
    timeSource: 'raf',
  };

  // ---------- small helpers ----------

  function config() {
    return globalThis.PB_CONFIG || { difficultyOrder: ['Gentle', 'Normal', 'Scorched'], sunwell: { max: 10 }, board: { field: { x: 368, y: 150, w: 544, h: 520 } } };
  }

  function palette() {
    return globalThis.PB_PALETTE || {
      cream: '#FFF6E9', paper: '#FFFDF6', coral: '#FF7A59', gold: '#FFC53D', sky: '#57B8FF',
      mint: '#4FD8A5', pink: '#FF9FB2', leaf: '#58B368', ink: '#2B2118',
    };
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function board() {
    return globalThis.PB_Board || {};
  }

  function simApi() {
    return globalThis.PB_Sim || {};
  }

  function saveApi() {
    return globalThis.PB_Save || null;
  }

  function inputApi() {
    return globalThis.PB_Input || null;
  }

  function menusApi() {
    return globalThis.PB_Menus || null;
  }

  function audioApi() {
    return globalThis.PB_Audio || null;
  }

  function botApi() {
    return globalThis.PB_Bot || null;
  }

  function difficultyOrder() {
    const order = config().difficultyOrder || [];
    return order.length ? order : ['Gentle', 'Normal', 'Scorched'];
  }

  function resolveDifficulty(key) {
    const order = difficultyOrder();
    for (let i = 0; i < order.length; i += 1) if (order[i] === key) return key;
    return 'Normal';
  }

  function names() {
    return globalThis.PB_NAMES || { pests: [], contraptions: [], feats: [], days: [] };
  }

  function featList() {
    return names().feats || [];
  }

  function rand01() {
    return 0.5 + 0.5 * Math.sin(app.tick * 0.37 + 1.7);
  }

  function currentSim() {
    return app.sim;
  }

  function demoSim() {
    return app.demo;
  }

  function buttonOf(id) {
    return app.buttons[id] || null;
  }

  function inRect(rect, x, y) {
    return !!rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function pressed(code) {
    const input = inputApi();
    return !!(input && typeof input.pressed === 'function' && input.pressed(code));
  }

  function pressedAny(list) {
    const input = inputApi();
    if (!input || typeof input.pressedAny !== 'function') return null;
    return input.pressedAny(list);
  }

  function saveData() {
    const s = saveApi();
    if (!s) return { best: 0, feats: {}, history: [] };
    if (typeof s.get === 'function') {
      const data = s.get();
      if (data) return data;
    }
    return s.load ? s.load() : { best: 0, feats: {}, history: [] };
  }

  function formatScore(n) {
    if (globalThis.PB_Hud && typeof globalThis.PB_Hud.formatScore === 'function') return globalThis.PB_Hud.formatScore(n);
    return String(Math.max(0, Math.round(num(n, 0)))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatTicks(ticks) {
    if (globalThis.PB_Results && typeof globalThis.PB_Results.formatTicks === 'function') return globalThis.PB_Results.formatTicks(ticks);
    const t = Math.max(0, Math.round(num(ticks, 0)));
    return Math.floor(t / 3600) + ':' + ('0' + Math.floor((t % 3600) / 60)).slice(-2);
  }

  function isTypingTarget() {
    if (typeof globalThis.document === 'undefined' || !globalThis.document || typeof globalThis.document.activeElement !== 'object') return false;
    const el = globalThis.document.activeElement;
    if (!el || typeof el.tagName !== 'string') return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
  }

  function say(text) {
    app.status = String(text || '');
    if (typeof globalThis.document === 'undefined' || !globalThis.document || typeof globalThis.document.getElementById !== 'function') return;
    const node = globalThis.document.getElementById('status');
    if (node) node.textContent = app.status;
  }

  // ---------- toast (the transparent-feel status bubble over a play field) ----------

  function setToast(text, kind, ticks) {
    app.toast = { text: String(text || ''), kind: kind || 'info', born: app.tick, life: num(ticks, 150) };
  }

  // ---------- audio ----------

  function syncAudioFromSave() {
    const a = audioApi();
    const s = saveApi();
    if (!a || !s) return;
    try {
      const st = s.settings ? s.settings() : null;
      if (st && typeof a.setVolumes === 'function') a.setVolumes(num(st.music, 0.35), num(st.sfx, 0.7));
      if (st && typeof a.setMuted === 'function') a.setMuted(st.muted === true);
    } catch (err) {
      /* audio settings are optional */
    }
  }

  function initAudio() {
    const a = audioApi();
    if (!a || typeof a.init !== 'function') return;
    if (!app.audioReady) {
      syncAudioFromSave();
      try {
        a.init({ silent: true });
      } catch (err) {
        /* no audio device */
      }
      app.audioReady = true;
    }
    const data = saveData();
    if (typeof a.setSeed === 'function') a.setSeed(String(Math.round(num(data && data.best, 0))));
  }

  function wireSound(sim, withSfx) {
    if (!sim || typeof sim !== 'object') return sim;
    const a = audioApi();
    if (withSfx && a && typeof a.sfx === 'function') {
      sim.eventsSound = function (name, data) {
        return a.sfx(name, data, sim);
      };
    } else {
      sim.eventsSound = null;
    }
    return sim;
  }

  function toggleMute() {
    initAudio();
    const a = audioApi();
    let muted = false;
    if (a && typeof a.toggleMute === 'function') {
      try {
        muted = a.toggleMute() === true;
      } catch (err) {
        muted = !muted;
      }
    }
    const s = saveApi();
    if (s && typeof s.setSettings === 'function') s.setSettings({ muted: muted });
    setToast(muted ? 'SOUND MUTED' : 'SOUND ON', muted ? 'info' : 'win', 90);
    squeak(muted ? 'lose' : 'ui');
    return muted;
  }

  function squeak(name) {
    const a = audioApi();
    if (!a || typeof a.sfx !== 'function') return;
    try {
      a.sfx(name, {}, app.sim);
    } catch (err) {
      /* the sound bus never blocks play */
    }
  }

  // ---------- feats, seeds, summary ----------

  function featKey(name) {
    const list = featList();
    for (let i = 0; i < list.length; i += 1) if (list[i].key === name) return list[i].key;
    return name;
  }

  // Every feat the run earned, mapped onto the six NAMES.feats keys the save and results screens read.
  function computeFeats(sim, saveEntry) {
    const f = sim.feats || {};
    const h = sim.history || [];
    const s = sim.stats || {};
    const out = {};
    let blooms = 0;
    let pestShower = num(s.pestClears, 0);
    let dry = false;
    for (let i = 0; i < h.length; i += 1) {
      const row = h[i] || {};
      blooms += num(row.blooms, 0);
      pestShower = Math.max(pestShower, num(row.pestClears, 0), num(row.pestHits, 0));
      // DRY SPELL: a shower that bloomed cups and never let one drain.
      if (num(row.ballsUsed, 0) > 0 && num(row.drains, 0) === 0 && num(row.blooms, 0) > 0) dry = true;
    }
    if (blooms >= 50 || f.firstBloom) out[featKey('firstBloom')] = true;
    if (num(sim.stats && sim.stats.bestCascade, 1) >= 8 || f.eightCascade) out[featKey('eightCascade')] = true;
    if (pestShower >= 10 || f.mothHunt) out[featKey('mothHunt')] = true;
    if (f.duskGone || f.duskfatherDown) out[featKey('duskGone')] = true;
    if (f.fullSunwell || dry) out[featKey('fullSunwell')] = true;
    if (f.overbloom) out[featKey('overbloom')] = true;
    return out;
  }

  function featName(key) {
    const list = featList();
    for (let i = 0; i < list.length; i += 1) if (list[i].key === key) return list[i].name;
    return String(key || '').toUpperCase();
  }

  // The feats sim.feats gained this tick (only when a sim path flipped one the save had not yet seen).
  function noteSimFeats(sim) {
    const s = saveApi();
    if (!s || !sim || !sim.feats || !app.run) return;
    const seen = app.run.feats || (app.run.feats = {});
    const keys = ['firstBloom', 'eightCascade', 'mothHunt', 'duskGone', 'fullSunwell', 'overbloom'];
    for (let i = 0; i < keys.length; i += 1) {
      if (sim.feats[keys[i]] === true && seen[keys[i]] !== true) {
        seen[keys[i]] = true;
        if (typeof s.unlockFeat === 'function' && s.unlockFeat(keys[i])) setToast('FEAT: ' + featName(keys[i]), 'gold', 240);
      }
    }
  }

  // Seeds come from a persisted counter, so every run has its own reproducible seed.
  function nextSeed() {
    const s = saveApi();
    if (!s) return 1;
    const data = typeof s.get === 'function' ? s.get() : null;
    if (data && typeof data === 'object') {
      const n = Math.max(0, Math.round(num(data.seedCounter, 0)));
      data.seedCounter = n + 1;
      if (typeof s.save === 'function') s.save(data);
      return n + 1;
    }
    return 1;
  }

  function lastRuns() {
    const s = saveApi();
    if (!s || typeof s.lastRuns !== 'function') return [];
    try {
      return s.lastRuns() || [];
    } catch (err) {
      return [];
    }
  }

  function buildSummary(sim) {
    const rows = Array.isArray(sim.builds) ? sim.builds : [];
    const placed = [];
    const seen = {};
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i] || {};
      const k = seen[r.socket] != null ? seen[r.socket] : (seen[r.socket] = placed.length);
      if (placed[k] && placed[k].key === r.kind) placed[k].level = Math.max(placed[k].level, num(r.level, 1));
      else placed.push({ key: r.kind, socket: r.socket, level: Math.max(1, num(r.level, 1)) });
    }
    return {
      contraptions: placed,
      drafts: Array.isArray(sim.draftLog) ? sim.draftLog.slice() : [],
      owned: sim.owned || {},
    };
  }

  function buildSummaryObject(sim, entry) {
    const s = saveData();
    const previousBest = num(app.run && app.run.previousBest, num(app.record && app.record.previousBest, num(s.best, 0)));
    const history = lastRuns();
    const grade = globalThis.PB_Results && typeof globalThis.PB_Results.gradeFor === 'function' ? globalThis.PB_Results.gradeFor(sim.score) : { grade: 'D', min: 0 };
    const thresholds = [];
    const grades = (config().grades || []).slice();
    for (let i = 0; i < grades.length; i += 1) thresholds.push({ grade: grades[i].grade, min: num(grades[i].min, 0) });
    const unlocked = app.run && Array.isArray(app.run.unlocked) ? app.run.unlocked.slice() : [];
    const stats = sim.stats || {};
    return {
      score: Math.round(num(sim.score, 0)),
      won: !!(sim.over && sim.over.result === 'won'),
      difficulty: sim.difficulty || 'Normal',
      seed: String(sim.seed == null ? '' : sim.seed),
      ticks: num(sim.runEndTick, sim.tick),
      time: formatTicks(num(sim.runEndTick, sim.tick)),
      showersClosed: (sim.history || []).length,
      shower: num(sim.shower, 1),
      endless: sim.endless === true,
      reason: sim.over ? sim.over.result : 'end',
      stats: {
        showers: sim.history || [],
        blooms: num(stats.blooms, 0),
        drains: num(stats.drains, 0),
        bestCascade: num(stats.bestCascade, 1),
        pests: num(stats.pestClears, 0),
      },
      showerStats: sim.history || [],
      build: buildSummary(sim),
      drafts: buildSummary(sim).drafts,
      taken: buildSummary(sim).drafts.length,
      feats: unlocked,
      featsThisRun: computeFeats(sim, entry),
      best: Math.max(num(s.best, 0), Math.round(num(sim.score, 0))),
      previousBest: previousBest,
      newBest: !!(app.record && app.record.newBest),
      delta: Math.round(num(sim.score, 0)) - previousBest,
      history: history,
      grade: grade,
      grades: thresholds,
      nextGoal: '',
    };
  }

  // ---------- run lifecycle ----------

  function startRun(difficulty, seed) {
    const api = simApi();
    if (typeof api.createSim !== 'function') {
      say('SIM MISSING: cannot start a run');
      return null;
    }
    initAudio();
    const key = resolveDifficulty(difficulty || app.difficulty);
    const runSeed = seed == null ? nextSeed() : seed;
    const sim = api.createSim(runSeed, key);
    const before = saveData();
    app.sim = sim;
    app.run = {
      seed: runSeed,
      previousBest: num(before.best, 0),
      unlocked: [],
      recorded: false,
      endlessOffered: false,
    };
    app.record = null;
    app.summary = null;
    app.difficulty = key;
    app.paused = false;
    app.fast = false;
    app.selectedGate = 0;
    app.selectedSocket = -1;
    app.selectedCard = -1;
    wireSound(sim, true);
    globalThis.PB_Main.currentSim = sim;
    globalThis.PB_Main.run = app.run;
    setToast('SHOWER 1 - ' + (sim.banner ? sim.banner.text : 'READY'), 'shower', 120);
    setScreen('build');
    return sim;
  }

  function recordRun(sim) {
    const s = saveApi();
    if (!s || !sim) return null;
    const feats = computeFeats(sim, null);
    sim.feats = sim.feats || {};
    for (const k in feats) if (feats[k]) sim.feats[k] = true;
    const rec = typeof s.recordRun === 'function' ? s.recordRun(sim) : null;
    const unlocked = [];
    for (const k in feats) {
      if (feats[k] && typeof s.unlockFeat === 'function' && s.unlockFeat(k)) unlocked.push(k);
    }
    app.run = app.run || {};
    app.run.unlocked = unlocked;
    app.record = rec || { best: num(saveData().best, 0), newBest: false, previousBest: app.run.previousBest };
    return rec;
  }

  function endRun(sim) {
    if (!sim || !sim.over) return false;
    if (app.run && app.run.recorded) return true;
    if (app.run) app.run.recorded = true;
    const rec = recordRun(sim);
    const summary = buildSummaryObject(sim, rec);
    app.summary = summary;
    globalThis.PB_Main.summary = summary;
    squeak(summary.won ? 'win' : 'lose');
    for (let i = 0; i < (app.run && app.run.unlocked ? app.run.unlocked.length : 0); i += 1) {
      setToast('FEAT UNLOCKED: ' + featName(app.run.unlocked[i]), 'gold', 300);
    }
    setScreen('results');
    return true;
  }

  function retryRun() {
    const seed = app.run ? app.run.seed : null;
    const diff = app.sim ? app.sim.difficulty : app.difficulty;
    return startRun(diff, seed);
  }

  function continueOverbloom() {
    const sim = app.sim;
    const api = simApi();
    if (!sim || !api || typeof api.beginOverbloom !== 'function') return false;
    if (!sim.over || sim.over.result !== 'won') return false;
    if (app.run) app.run.recorded = false;
    app.summary = null;
    app.record = null;
    if (api.beginOverbloom(sim)) {
      sim.phase = 'build';
      sim.building = true;
      sim.endless = true;
      setToast('OVERBLOOM - SHOWER ' + sim.shower + ' - ENDLESS', 'gold', 180);
      squeak('draft');
      setScreen('build');
      return true;
    }
    return false;
  }

  // ---------- screens ----------

  const VALID = { title: true, play: true, build: true, draft: true, results: true };

  function setScreen(name, opts) {
    const next = VALID[name] ? name : 'title';
    const o = opts || {};
    if (app.screen !== next) app.previous = app.screen;
    app.screen = next;
    app.buttons = {};
    app.view.buttons = app.buttons;
    app.staged = false;
    app.frozen = false;
    if (!app.view) app.view = {};
    if (!app.buttons) app.buttons = {};
    app.view.buttons = app.buttons;
    for (const k in app.buttons) if (Object.prototype.hasOwnProperty.call(app.buttons, k)) delete app.buttons[k];
    app.selectedSocket = -1;
    app.selectedCard = -1;
    if (next === 'play' || next === 'build') {
      app.paused = o.paused === true || app.paused;
      if (app.sim) {
        app.sim.paused = app.paused;
        wireSound(app.sim, true);
      }
    } else if (next === 'draft' || next === 'results' || next === 'title') {
      app.paused = false;
      app.fast = false;
      if (app.sim) app.sim.paused = false;
    }
    if (next === 'title') ensureDemo(o);
    if (next === 'results' && app.sim && !app.summary) app.summary = buildSummaryObject(app.sim, app.record);
    if (next === 'draft') {
      app.selectedCard = -1;
      squeak('draft');
    }
    return next;
  }

  function phaseScreen(sim) {
    if (!sim) return 'title';
    if (sim.over && (sim.over.result === 'won' || sim.over.result === 'lost')) return 'results';
    if (sim.phase === 'draft') return 'draft';
    if (sim.phase === 'build' || sim.phase === 'showerEnd' || sim.building) return 'build';
    return 'play';
  }

  // Called after the sim moves: the screen follows the sim's own phase until an end is recorded.
  function syncScreen(sim) {
    if (!sim || app.screen === 'title') return;
    if (app.frozen && !app.staged) return;
    if (sim.over && (sim.over.result === 'won' || sim.over.result === 'lost')) {
      if (app.screen !== 'results') endRun(sim);
      return;
    }
    if (app.screen === 'results') return;
    if (sim.phase === 'draft' && app.screen !== 'draft') {
      setScreen('draft');
      return;
    }
    if (sim.phase === 'build' && app.screen !== 'build') {
      setScreen('build');
      return;
    }
    if (sim.phase === 'play' && !sim.building && app.screen === 'build' && !sim.over) {
      setScreen('play');
    }
  }

  function togglePause() {
    if (app.screen !== 'play' && app.screen !== 'build') return app.paused;
    app.paused = !app.paused;
    if (app.sim) app.sim.paused = app.paused;
    const a = audioApi();
    if (a && typeof a.suspend === 'function' && app.paused) a.suspend();
    say(app.paused ? 'PAUSED - P TO RESUME' : 'PLAYING');
    return app.paused;
  }

  function toggleFast() {
    if (app.screen !== 'play' && app.screen !== 'build') return app.fast;
    app.fast = !app.fast;
    say(app.fast ? 'FAST FORWARD 2X' : 'NORMAL SPEED');
    return app.fast;
  }

  function toTitle() {
    initAudio();
    setScreen('title');
    say('TITLE');
  }

  // ---------- the title demo: a real, unrecorded bot run behind the wordmark ----------

  function demoOptions() {
    return { minLive: 9, maxLive: 13, sweepTicks: 300, gateEvery: 132, endless: true, maxTicks: 600000, buildCap: 9 };
  }

  function makeDemo(seed) {
    const api = simApi();
    const bot = botApi();
    if (typeof api.createSim !== 'function') return null;
    const demo = api.createSim(seed == null ? DEMO_SEED : seed, 'Normal');
    wireSound(demo, false);
    const sim = typeof bot !== 'undefined' && bot && typeof bot.create === 'function' ? bot.create(demoOptions()) : null;
    app.demo = demo;
    app.demoPolicy = sim;
    return demo;
  }

  function ensureDemo(opts) {
    const o = opts || {};
    if (app.demo && !o.reset) return app.demo;
    if (o.reset) {
      app.demoGap = 0;
      app.demoDelay = 0;
    }
    return makeDemo(o.seed);
  }

  function stepDemo(demo, policy) {
    const bot = botApi();
    if (!demo || !bot || typeof bot.step !== 'function') return null;
    const action = bot.step(demo, policy);
    if (typeof globalThis.PB_Fx === 'object' && globalThis.PB_Fx && typeof globalThis.PB_Fx.consume === 'function') globalThis.PB_Fx.consume(demo);
    if (demo.over) {
      // The title demo never ends the loop: a finished demo starts a fresh one.
      app.demoGap += 1;
      if (app.demoGap > 60) {
        app.demoGap = 0;
        makeDemo(DEMO_SEED + ':' + num(app.tick, 0));
        policy = app.demoPolicy;
      }
    }
    return action;
  }

  // Advance the demo a little each rendered frame so the cascade stays lively without burning CPU.
  function updateDemo() {
    const demo = app.demo;
    if (!demo || !app.demoPolicy) return;
    app.demoDelay += 1;
    const every = 2;
    for (let i = 0; i < 2 && app.demoDelay % every === 0; i += 1) stepDemo(demo, app.demoPolicy);
  }

  // ---------- fx wiring ----------

  function clearFx() {
    if (globalThis.PB_Fx && typeof globalThis.PB_Fx.clear === 'function') globalThis.PB_Fx.clear(app.sim);
  }

  // Runs one fixed sim step: steps, drains fx and sounds it produced, then follows the phase.
  function stepOnce(sim) {
    const api = simApi();
    if (!sim || !api || typeof api.stepSim !== 'function') return null;
    api.stepSim(sim);
    if (globalThis.PB_Fx && typeof globalThis.PB_Fx.consume === 'function') globalThis.PB_Fx.consume(sim);
    if (globalThis.PB_Banner && typeof globalThis.PB_Banner.tick === 'function') globalThis.PB_Banner.tick(sim);
    noteSimFeats(sim);
    const a = audioApi();
    if (a && typeof a.step === 'function' && sim.phase === 'play') a.step(STEP, num(sim.cascade && sim.cascade.mult, 1));
    app.tick += 1;
    return sim;
  }

  function runSteps(sim, count) {
    for (let i = 0; i < count; i += 1) {
      if (!sim || sim.over || app.frozen) break;
      stepOnce(sim);
      if (sim.phase !== 'play' && sim.phase !== 'build') break;
    }
    syncScreen(sim);
    return sim;
  }

  // ---------- play / build input ----------

  function locked() {
    // Staged shots stay frozen to the sim, but still take the keys the live build phase would.
    return app.paused || app.screen === 'results';
  }

  function railRange() {
    const c = config();
    const rail = (c.board && c.board.dropperRail) || { x: 368, w: 544 };
    const f = (c.board && c.board.field) || { x: 368, w: 544 };
    return { lo: Math.max(num(rail.x, 368), num(f.x, 368) + 16), hi: Math.min(num(rail.x, 368) + num(rail.w, 544), num(f.x, 368) + num(f.w, 544) - 16) };
  }

  function steerDropper(sim) {
    if (!sim || !sim.dropper) return;
    const input = inputApi();
    const api = simApi();
    if (!input || !api) return;
    let ax = typeof input.axis === 'function' ? input.axis() : 0;
    if (pressed('ArrowUp')) sim.autoXPct = clamp(num(sim.autoXPct, 0.5) + 0.1, 0, 1);
    if (pressed('ArrowDown')) sim.autoXPct = clamp(num(sim.autoXPct, 0.5) - 0.1, 0, 1);
    const m = input.mouse;
    if (m && m.x >= 0 && input.hasMouse && input.hasMouse() && !m.down) {
      const field = (config().board && config().board.field) || { y: 150 };
      if (m.y < num(field.y, 150) + 40) {
        api.moveDropper(sim, m.x);
        ax = 0;
      }
    }
    if (ax) {
      const r = railRange();
      const next = clamp(num(sim.dropper.x, r.lo) + ax * 9, r.lo, r.hi);
      api.moveDropper(sim, next);
    }
  }

  function dropBall(sim) {
    const api = simApi();
    if (!api || !sim || typeof api.drop !== 'function') return false;
    const ok = api.drop(sim);
    if (ok) squeak('drop');
    return ok;
  }

  function gateScreenPos(g, scale) {
    const s = num(scale, 1);
    return { x: num(g.x, 640), y: num(g.y, 400), r: 54 * s };
  }

  function nearestGate(point) {
    const sim = app.sim;
    if (!sim || !Array.isArray(sim.gates)) return -1;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < sim.gates.length; i += 1) {
      const p = gateScreenPos(sim.gates[i], 1);
      const d = Math.sqrt((point.x - p.x) * (point.x - p.x) + (point.y - p.y) * (point.y - p.y));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return bestD <= 80 ? best : -1;
  }

  function rotateGate(dir) {
    const sim = app.sim;
    if (!sim || locked()) return false;
    const api = simApi();
    const i = clamp(Math.round(num(app.selectedGate, 0)), 0, Math.max(0, (sim.gates ? sim.gates.length : 1) - 1));
    const ok = api.rotateGate ? api.rotateGate(sim, i, dir) : false;
    if (ok) {
      squeak('gate');
      const g = sim.gates[i] || {};
      const px = num(g.x, 640);
      sim.fx.push({ type: 'floater', x: px, y: num(g.y, 400) - 16, text: 'GATE ' + (i + 1) + (dir > 0 ? ' CW' : ' CCW'), colour: 'pink' });
    }
    return ok;
  }

  function pickGate(point) {
    const i = nearestGate(point);
    if (i < 0) return false;
    app.selectedGate = i;
    setToast('GATE ' + (i + 1) + ' SELECTED - Q / E TURN IT', 'gate', 90);
    return true;
  }

  function selectSocket(idx) {
    const sim = app.sim;
    if (!sim) return false;
    const socket = sim.sockets && sim.sockets[idx];
    if (!socket) return false;
    app.selectedSocket = idx;
    if (socket.kind) {
      setToast(socket.name + ' LV' + num(socket.level, 1) + ' - CLICK A CARD TO UPGRADE', 'build', 120);
      return true;
    }
    setToast('SOCKET ' + (idx + 1) + ' PICKED - CHOOSE A CARD OR KEY 1-5', 'build', 120);
    return true;
  }

  function nearestSocket(point) {
    const sim = app.sim;
    if (!sim || !Array.isArray(sim.sockets)) return -1;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < sim.sockets.length; i += 1) {
      const s = sim.sockets[i];
      const d = Math.sqrt((point.x - num(s.x, -999)) * (point.x - num(s.x, -999)) + (point.y - num(s.y, -999)) * (point.y - num(s.y, -999)));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return bestD <= 44 ? best : -1;
  }

  function buildWith(kind, socketIdx) {
    const sim = app.sim;
    if (!sim || locked() || !kind) return false;
    const api = simApi();
    const idx = socketIdx != null ? socketIdx : app.selectedSocket;
    if (idx == null || idx < 0) {
      setToast('CLICK A SOCKET FIRST, THEN PICK A CARD', 'warn', 120);
      return false;
    }
    let ok = false;
    if (api.reserveContraption) ok = api.reserveContraption(sim, idx, kind) === true;
    if (!ok && api.placeContraption) ok = api.placeContraption(sim, idx, kind) === true;
    if (!ok && api.reserveUpgrade) {
      const socket = sim.sockets && sim.sockets[idx];
      if (socket && socket.kind === kind) ok = api.reserveUpgrade(sim, idx) === true;
    }
    if (!ok) {
      const meta = (names().contraptions || []).filter(function (c) { return c.key === kind; })[0];
      const socket = sim.sockets && sim.sockets[idx];
      if (socket && socket.kind && socket.kind !== kind) setToast('SOCKET TAKEN - PICK AN EMPTY ONE', 'warn', 120);
      else setToast('NEED ' + num(meta && meta.cost, 2) + ' SEEDS AND AN OWNED ' + String(meta && meta.name || kind), 'warn', 120);
      squeak('lose');
      return false;
    }
    squeak('seed');
    app.selectedSocket = -1;
    app.selectedCard = -1;
    return true;
  }

  function finishBuild() {
    const api = simApi();
    const sim = app.sim;
    if (!sim || !api || typeof api.endBuild !== 'function') return false;
    const ok = api.endBuild(sim) === true;
    if (ok) {
      setScreen('play');
      setToast(sim.banner ? sim.banner.text : 'SHOWER ' + sim.shower, 'shower', 150);
    } else if (sim.draft && sim.draft.pending) {
      setToast('SPEND THE DRAFT TOKEN IN A SOCKET FIRST', 'warn', 120);
    }
    return ok;
  }

  function advanceShower() {
    const api = simApi();
    const sim = app.sim;
    if (!sim || !api) return false;
    if (api.advanceSim && !app.frozen && !app.staged) {
      const before = sim.phase;
      api.advanceSim(sim);
      app.tick += 1;
      syncScreen(sim);
      return sim.phase !== before;
    }
    return false;
  }

  // One frame of play/build input. Order: global keys, renderer buttons, field clicks, play keys.
  function handlePlayInput() {
    const sim = app.sim;
    const api = simApi();
    const input = inputApi();
    if (!sim || !api || !input) return;
    const P = pressed;
    // Global keys first: menus, pause, speed, sound, title.
    if (P('KeyH') || P('KeyO') || P('KeyA')) return openMenu(P('KeyH') ? 'howto' : P('KeyO') ? 'options' : 'almanac');
    if (P('KeyP') || P('Escape')) togglePause();
    if (P('KeyF')) toggleFast();
    if (P('KeyM')) return toggleMute();
    if (P('KeyT')) return toTitle();
    // A shower already closed: the only way on is the sim's own advance into the draft.
    if (app.screen === 'build' && sim.phase === 'showerEnd') {
      if (handleButtons()) return;
      if (P('Space') || P('Enter') || P('KeyB')) {
        advanceShower();
        return;
      }
      clickedFieldSocket();
      return;
    }
    if (handleButtons()) return;
    if (app.screen === 'build' && handleBuildClicks()) return;
    if (!locked()) {
      if (app.screen === 'play') steerDropper(sim);
      if (P('Tab')) {
        app.selectedGate = (clamp(num(app.selectedGate, 0), 0, 2) + 1) % 3;
        setToast('GATE ' + (app.selectedGate + 1) + ' SELECTED - Q / E TURN IT', 'gate', 80);
      }
      if (P('KeyQ')) rotateGate(-1);
      if (P('KeyE')) rotateGate(1);
      if (P('Space')) dropBall(sim);
    }
    if (app.screen === 'build' && P('KeyB')) return finishBuild();
    if (app.screen === 'build') buildKeys();
    if (app.screen === 'play') clickedGate();
  }

  function clickedGate() {
    const input = inputApi();
    if (!input || !input.mouse || !input.mouse.clicked) return;
    const m = input.point();
    if (pickGate(m)) return;
    const sim = app.sim;
    if (!locked() && m.x >= 0) dropBall(sim);
  }

  function clickedFieldSocket() {
    const input = inputApi();
    if (!input || !input.mouse || !input.mouse.clicked) return;
    const m = input.point();
    const idx = nearestSocket(m);
    if (idx >= 0) selectSocket(idx);
  }

  function buildKeys() {
    const sim = app.sim;
    if (!sim || sim.phase !== 'build') return;
    const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5'];
    const numKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
    for (let k = 0; k < numKeys.length; k += 1) {
      const code = keys[k];
      if (pressed(code)) {
        const meta = (names().contraptions || [])[k];
        if (!meta) return;
        app.selectedCard = k;
        buildWith(meta.key);
        return;
      }
    }
  }

  function handleBuildClicks() {
    const sim = app.sim;
    const input = inputApi();
    if (!sim || !input || !input.mouse || !input.mouse.clicked) return false;
    const m = input.point();
    const button = buttonOf('done');
    if (button && inRect(button, m.x, m.y)) {
      finishBuild();
      return true;
    }
    const cards = buttonOf('buildCards') || [];
    for (let i = 0; i < cards.length; i += 1) {
      if (inRect(cards[i], m.x, m.y)) {
        buildWith(cards[i].kind);
        return true;
      }
    }
    const idx = nearestSocket(m);
    if (idx >= 0) {
      selectSocket(idx);
      return true;
    }
    return false;
  }

  // ---------- renderer button routing --------------------------

  function handleButtons() {
    const input = inputApi();
    if (!input || !input.mouse || !input.mouse.clicked) return false;
    const m = input.point();
    const list = [app.buttons].concat(app.view.buttons && app.view.buttons !== app.buttons ? [app.view.buttons] : []);
    const ids = ['pause', 'ff', 'mute', 'done', 'reroll', 'runAgain', 'toTitle', 'title', 'overbloom', 'play', 'space', 'howto', 'options', 'almanac', 'pick0', 'pick1', 'pick2', 'diff0', 'diff1', 'diff2', 'buildCards'];
    for (let l = 0; l < list.length; l += 1) {
      const box = list[l];
      if (!box) continue;
      for (let i = 0; i < ids.length; i += 1) {
        const b = box[ids[i]];
        if (!b) continue;
        const rects = Array.isArray(b) ? b : [b];
        for (let r = 0; r < rects.length; r += 1) {
          const hit = rects[r];
          if (!hit || !inRect(hit, m.x, m.y)) continue;
          if (routeButton(ids[i], hit)) return true;
        }
      }
    }
    return false;
  }

  function routeButton(id, hit) {
    if (id === 'pause') return togglePause() !== null;
    if (id === 'ff') return toggleFast();
    if (id === 'mute') return toggleMute() !== null;
    if (id === 'done') return app.screen === 'build' ? finishBuild() : false;
    if (id === 'reroll') return doReroll(hit);
    if (id === 'buildCards') return false;
    if (id === 'runAgain') return retryRun() !== null;
    if (id === 'toTitle' || id === 'title') {
      toTitle();
      return true;
    }
    if (id === 'overbloom') return doOverbloom();
    if (id === 'play' || id === 'space') {
      startRun(app.difficulty);
      return true;
    }
    if (id === 'howto' || id === 'options' || id === 'almanac') return openMenu(id);
    if (id.indexOf('pick') === 0) return pickCard(num(id.slice(4), 0));
    if (id.indexOf('diff') === 0) return chooseDifficulty(num(id.slice(4), 0));
    return false;
  }

  function openMenu(name) {
    const menus = menusApi();
    if (!menus || typeof menus.open !== 'function') return false;
    initAudio();
    closeOwnOverlay();
    menus.open(name);
    app.paused = true;
    if (app.sim) app.sim.paused = true;
    return true;
  }

  function closeMenus() {
    const menus = menusApi();
    if (!menus || typeof menus.isOpen !== 'function' || !menus.isOpen()) return false;
    if (typeof menus.close === 'function') menus.close();
    return true;
  }

  function chooseDifficulty(i) {
    app.difficulty = difficultyOrder()[clamp(Math.round(num(i, 1)), 0, difficultyOrder().length - 1)] || 'Normal';
    setToast('DIFFICULTY: ' + app.difficulty.toUpperCase(), 'info', 90);
    squeak('ui');
    return true;
  }

  function pickCard(i) {
    const sim = app.sim;
    const api = simApi();
    if (!sim || app.screen !== 'draft' || !sim.draft || !api) return false;
    const offers = sim.draft.offers || [];
    if (!offers[i]) return false;
    const offer = offers[i];
    if (offer && offer.buildable === true && typeof globalThis.PB_Draft === 'object' && globalThis.PB_Draft && typeof globalThis.PB_Draft.apply === 'function') {
      try {
        globalThis.PB_Draft.apply(sim, offer);
      } catch (err) {
        /* apply is best effort; chooseDraft is still the real path */
      }
    }
    const key = api.chooseDraft(sim, i);
    if (!key) return false;
    setToast('PICKED ' + String(offer.name || key), 'draft', 120);
    squeak('draft');
    syncScreen(sim);
    return true;
  }

  function doReroll(hit) {
    const sim = app.sim;
    const api = simApi();
    if (!sim || app.screen !== 'draft' || !api) return false;
    if (hit && hit.afford === false) {
      setToast('NOT ENOUGH SEEDS TO REROLL', 'warn', 120);
      return false;
    }
    if (!api.rerollDraft || !api.rerollDraft(sim)) {
      setToast('NOT ENOUGH SEEDS TO REROLL', 'warn', 120);
      return false;
    }
    squeak('seed');
    return true;
  }

  function doOverbloom() {
    const title = globalThis.PB_Title;
    const data = saveData();
    const unlocked = !!(title && typeof title.overbloomUnlocked === 'function' ? title.overbloomUnlocked(app.demo, data) : (data && data.history && data.history.length));
    if (app.screen === 'title') {
      if (!unlocked) {
        setToast('OVERBLOOM LOCKS UNTIL YOU CLEAR ALL 9 SHOWERS', 'warn', 150);
        return false;
      }
      startRun(app.difficulty);
      continueOverbloomAfterStart();
      return true;
    }
    if (app.screen === 'results') {
      return continueOverbloom();
    }
    return false;
  }

  function continueOverbloomAfterStart() {
    const sim = app.sim;
    const api = simApi();
    if (!sim || !api) return false;
    sim.endless = true;
    if (api.startShower) api.startShower(sim, (api.showersTotal ? api.showersTotal() : 9) + 1);
    sim.phase = 'build';
    sim.building = true;
    setToast('OVERBLOOM - ENDLESS SHOWERS', 'gold', 180);
    setScreen('build');
    return true;
  }

  // ---------- title / draft / results input ----------

  function handleTitleInput() {
    if (handleButtons()) return;
    if (pressedAny(['Space', 'Enter'])) {
      startRun(app.difficulty);
      return;
    }
    if (pressedAny(['Digit1', 'Digit2', 'Digit3'])) {
      const code = pressedAny(['Digit1', 'Digit2', 'Digit3']);
      chooseDifficulty(num(code.slice(5), 1) - 1);
      return;
    }
    const arrow = pressedAny(['ArrowLeft', 'ArrowRight']);
    if (arrow) {
      const order = difficultyOrder();
      const cur = Math.max(0, order.indexOf(resolveDifficulty(app.difficulty)));
      chooseDifficulty((cur + (arrow === 'ArrowRight' ? 1 : order.length - 1)) % order.length);
    }
    if (pressed('KeyH')) openMenu('howto');
    else if (pressed('KeyO')) openMenu('options');
    else if (pressed('KeyA')) openMenu('almanac');
    else if (pressed('KeyM')) toggleMute();
  }

  function handleDraftInput() {
    if (handleButtons()) return;
    const sim = app.sim;
    const api = simApi();
    if (!sim || !api) return;
    const code = pressedAny(['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3']);
    if (code) pickCard(num(code.slice(code.length - 1), 1) - 1);
    else if (pressed('KeyX')) doReroll(null);
    else if (pressedAny(['Enter', 'Space'])) pickCard(0);
    else if (pressed('KeyM')) toggleMute();
    else if (pressed('KeyT')) toTitle();
  }

  function handleResultsInput() {
    if (handleButtons()) return;
    if (pressedAny(['KeyR', 'Enter'])) {
      retryRun();
      return;
    }
    if (pressed('KeyT')) toTitle();
    else if (pressed('KeyM')) toggleMute();
    else if (pressed('KeyH')) openMenu('howto');
    else if (pressed('KeyA')) openMenu('almanac');
    else if (pressed('KeyO')) openMenu('options');
  }

  function routeFrameInput() {
    const menus = menusApi();
    if (menus && typeof menus.capturesKeys === 'function' && menus.capturesKeys()) return;
    if (isTypingTarget()) return;
    initAudio();
    const input = inputApi();
    if (!input) return;
    if (app.screen === 'title') return handleTitleInput();
    if (app.screen === 'draft') return handleDraftInput();
    if (app.screen === 'results') return handleResultsInput();
    if (app.screen === 'build') {
      if (app.sim && app.sim.phase === 'showerEnd') {
        if (handleButtons()) return;
        if (pressedAny(['Space', 'Enter', 'KeyB'])) advanceShower();
        if (pressed('KeyM')) return toggleMute();
        if (pressed('KeyT')) return toTitle();
        if (pressed('KeyP') || pressed('Escape')) togglePause();
        clickedFieldSocket();
        return;
      }
      if (pressed('KeyM')) return toggleMute();
      if (handleBuildClicks()) return;
      if (pressed('KeyP') || pressed('Escape')) return togglePause();
      if (pressed('KeyF')) return toggleFast();
      if (pressed('KeyT')) return toTitle();
      buildKeys();
      return;
    }
    if (app.screen === 'play') return handlePlayInput();
  }

  // Pointer hover is read straight from the last pointer position so the board can light the target.
  function updateHover() {
    const input = inputApi();
    if (!input || !input.hasMouse || !input.hasMouse()) {
      app.hover = null;
      return;
    }
    const m = input.point();
    const gate = nearestGate(m);
    const socket = nearestSocket(m);
    app.hover = gate >= 0 ? { kind: 'gate', index: gate } : socket >= 0 ? { kind: 'socket', index: socket } : null;
    if (app.sim) app.sim.hover = app.hover;
  }

  // ---------- rendering ----------

  function clearButtons() {
    const b = app.buttons;
    for (const k in b) if (Object.prototype.hasOwnProperty.call(b, k)) delete b[k];
    app.view.buttons = b;
  }

  function drawToast(ctx) {
    const t = app.toast;
    if (!t) return;
    const age = num(app.tick, 0) - num(t.born, 0);
    if (age > num(t.life, 120)) {
      app.toast = null;
      return;
    }
    const p = palette();
    const fade = age > t.life - 20 ? Math.max(0, (t.life - age) / 20) : 1;
    const keyed = { warn: p.coral, lose: p.coral, gold: p.gold, win: p.mint, shower: p.sky, build: p.gold, draft: p.gold, gate: p.pink };
    const fill = keyed[t.kind] || p.paper;
    const w = Math.min(760, Math.max(320, String(t.text).length * 11 + 60));
    const x = W * 0.5 - w * 0.5;
    const y = 70;
    const h = 42;
    ctx.save();
    ctx.globalAlpha = fade;
    const r = board();
    if (r.roundRect) r.roundRect(ctx, x, y, w, h, 12, fill);
    else {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.ink;
    if (r.roundRectPath) r.roundRectPath(ctx, x, y, w, h, 12);
    else ctx.strokeRect(x, y, w, h);
    ctx.stroke();
    if (r.textFit) r.textFit(ctx, String(t.text), x + w * 0.5, y + h * 0.5 + 1, w - 24, 22, { align: 'center', fill: p.ink, minSize: 11 });
    else {
      ctx.fillStyle = p.ink;
      ctx.font = 'bold 22px "Arial Narrow", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(t.text), x + w * 0.5, y + h * 0.5);
    }
    ctx.restore();
  }

  function translateShake(ctx, sim) {
    const fx = globalThis.PB_Fx;
    if (!fx || typeof fx.shakeOffset !== 'function' || !sim) return;
    const s = fx.shakeOffset(sim);
    if (s && (s.x || s.y)) ctx.translate(s.x, s.y);
  }

  function drawSimFrame(ctx, sim, wantHud) {
    const b = board();
    if (b.draw) b.draw(ctx, sim, app.view);
    if (globalThis.PB_Sprites && typeof globalThis.PB_Sprites.draw === 'function') globalThis.PB_Sprites.draw(ctx, sim);
    if (globalThis.PB_Balls && typeof globalThis.PB_Balls.draw === 'function') globalThis.PB_Balls.draw(ctx, sim);
    if (globalThis.PB_Fx && typeof globalThis.PB_Fx.draw === 'function') globalThis.PB_Fx.draw(ctx, sim);
    if (wantHud && globalThis.PB_Hud && typeof globalThis.PB_Hud.draw === 'function') globalThis.PB_Hud.draw(ctx, sim, app.view);
    if (globalThis.PB_Banner && typeof globalThis.PB_Banner.draw === 'function') globalThis.PB_Banner.draw(ctx, sim);
  }

  function fillBackground(ctx) {
    const p = palette();
    ctx.fillStyle = p.cream;
    ctx.fillRect(0, 0, W, H);
  }

  function drawTile(ctx, x, y, w, h, fill, r) {
    const b = board();
    if (b.roundRect) b.roundRect(ctx, x, y, w, h, num(r, 12), fill);
    else {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = palette().ink;
    if (b.roundRectPath) b.roundRectPath(ctx, x, y, w, h, num(r, 12));
    else ctx.strokeRect(x, y, w, h);
    ctx.stroke();
  }

  function panelText(ctx, str, x, y, maxW, size, opts) {
    const b = board();
    const spec = opts || { align: 'left', fill: palette().ink };
    if (b.textFit) return b.textFit(ctx, str, x, y, maxW, size, spec);
    ctx.save();
    ctx.fillStyle = spec.fill || palette().ink;
    ctx.font = 'bold ' + Math.round(size * 0.82) + 'px "Arial Narrow", Impact, sans-serif';
    ctx.textAlign = spec.align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(str), x, y);
    ctx.restore();
    return { size: size };
  }

  // The build phase keeps the board under the planning bar; this strip names the shower being planned.
  function drawBuildBoard(ctx, sim) {
    const api = simApi();
    if (api && typeof api.startBuild === 'function' && sim.phase === 'play' && sim.building !== true) api.startBuild(sim);
    fillBackground(ctx);
    ctx.save();
    translateShake(ctx, sim);
    drawSimFrame(ctx, sim, true);
    ctx.restore();
    if (sim.phase === 'showerEnd') drawShowerEndPrompt(ctx, sim);
  }

  function drawShowerEndPrompt(ctx, sim) {
    const p = palette();
    const met = !!(sim.over && sim.over.reason === 'quota');
    const title = met ? 'QUOTA MET - SHOWER ' + sim.shower + ' CLOSED' : 'QUOTA MISSED - SUNWELL ' + Math.max(0, Math.round(num(sim.sunwell, 0))) + '/10';
    const sub = 'SPACE / ENTER - NEXT SHOWER AND DRAFT';
    const x = 360;
    const y = 300;
    const w = 560;
    const h = 132;
    drawTile(ctx, x, y, w, h, met ? p.mint : p.coral, 18);
    panelText(ctx, title, x + w * 0.5, y + 44, w - 40, 30, { align: 'center', fill: p.ink });
    panelText(ctx, sub, x + w * 0.5, y + 92, w - 40, 22, { align: 'center', fill: p.ink });
    const hit = { x: x, y: y, w: w, h: h, id: 'advance' };
    app.buttons.advance = hit;
    app.view.buttons = app.buttons;
  }

  function drawPlay(ctx, sim) {
    fillBackground(ctx);
    ctx.save();
    translateShake(ctx, sim);
    drawSimFrame(ctx, sim, true);
    drawSelectionReach(ctx, sim);
    ctx.restore();
    drawToast(ctx);
    if (app.paused) drawPaused(ctx);
  }

  function drawSelectionReach(ctx, sim) {
    if (app.screen !== 'play' || locked()) return;
    const p = palette();
    const gates = sim && sim.gates;
    if (!gates || !gates.length) return;
    const i = clamp(Math.round(num(app.selectedGate, 0)), 0, gates.length - 1);
    const g = gates[i];
    const r = board();
    ctx.save();
    ctx.beginPath();
    ctx.arc(num(g.x, 640), num(g.y, 400), 56, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 6]);
    ctx.strokeStyle = p.pink;
    ctx.stroke();
    ctx.setLineDash([]);
    const hint = 'Q / E - GATE ' + (i + 1);
    ctx.globalAlpha = 0.92;
    const tw = 170;
    const bx = num(g.x, 640) - tw * 0.5;
    const by = num(g.y, 400) + 60;
    if (r.roundRect) r.roundRect(ctx, bx, by, tw, 26, 9, p.paper);
    else {
      ctx.fillStyle = p.paper;
      ctx.fillRect(bx, by, tw, 26);
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.ink;
    if (r.roundRectPath) r.roundRectPath(ctx, bx, by, tw, 26, 9);
    else ctx.strokeRect(bx, by, tw, 26);
    ctx.stroke();
    if (r.textFit) r.textFit(ctx, hint, num(g.x, 640), by + 14, tw - 10, 16, { align: 'center', fill: p.ink, minSize: 9 });
    ctx.restore();
  }

  function drawPaused(ctx) {
    const p = palette();
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = p.cream;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    drawTile(ctx, 420, 300, 440, 190, p.paper, 20);
    panelText(ctx, 'PAUSED', 640, 348, 360, 54, { align: 'center', fill: p.coral });
    panelText(ctx, 'P / ESC - RESUME', 640, 402, 380, 24, { align: 'center', fill: p.ink });
    panelText(ctx, 'T - TITLE   M - MUTE', 640, 446, 380, 20, { align: 'center', fill: p.ink });
  }

  function drawTitleScreen(ctx) {
    const t = globalThis.PB_Title;
    app.view.tick = num(app.tick, 0);
    app.view.demo = app.demo;
    app.view.difficulty = app.difficulty;
    if (t && typeof t.draw === 'function') t.draw(ctx, app.view);
    else {
      fillBackground(ctx);
      panelText(ctx, 'PEGBLOOM', 640, 360, 1000, 120, { align: 'center', fill: palette().coral });
    }
    if (app.toast) drawToast(ctx);
  }

  function draftSeedView(sim) {
    const offers = (sim && sim.draft && sim.draft.offers) || [];
    const out = [];
    for (let i = 0; i < offers.length; i += 1) {
      const o = offers[i] || {};
      out.push({ key: o.key, name: o.name, effect: o.effect, synergy: o.synergy, buildable: o.buildable === true, token: o.token === true, cost: o.cost });
    }
    return out;
  }

  function drawDraftScreen(ctx, sim) {
    const d = globalThis.PB_DraftScreen;
    app.view.sim = sim;
    const before = draftSeedView(sim);
    if (d && typeof d.draw === 'function') {
      d.draw(ctx, sim, app.view);
    } else {
      fillBackground(ctx);
      panelText(ctx, 'WIND TURNS - PICK 1', 640, 120, 1100, 64, { align: 'center', fill: palette().coral });
    }
    if (draftSeedView(sim).length !== before.length) syncScreen(sim);
    if (app.toast) drawToast(ctx);
  }

  function drawResultsScreen(ctx) {
    const r = globalThis.PB_Results;
    const sim = app.sim;
    const summary = app.summary || buildSummaryObject(sim, app.record);
    app.view.sim = sim;
    app.view.summary = summary;
    app.view.run = summary;
    if (r && typeof r.draw === 'function') r.draw(ctx, app.view);
    else {
      fillBackground(ctx);
      panelText(ctx, 'RESULTS - ' + formatScore(summary.score), 640, 360, 1000, 60, { align: 'center', fill: palette().ink });
    }
    const canEndless = summary.won && sim && !sim.endless;
    if (canEndless && !app.view.buttons.overbloom) {
      const hit = { x: 640 - 200, y: 236, w: 400, h: 44, id: 'overbloom' };
      drawTile(ctx, hit.x, hit.y, hit.w, hit.h, palette().gold, 12);
      panelText(ctx, 'CONTINUE IN OVERBLOOM', hit.x + hit.w * 0.5, hit.y + hit.h * 0.5 + 1, hit.w - 20, 22, { align: 'center', fill: palette().ink });
      app.buttons.overbloom = hit;
      app.view.buttons = app.buttons;
    }
    if (app.toast) drawToast(ctx);
  }

  // The screen currently being drawn, so the render run right after a screen change does not clear its buttons.
  function render() {
    const ctx = app.ctx;
    if (!ctx) return 0;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.textBaseline = 'alphabetic';
    clearButtons();
    if (app.screen === 'title') drawTitleScreen(ctx);
    else if (app.screen === 'draft' && app.sim) drawDraftScreen(ctx, app.sim);
    else if (app.screen === 'results') drawResultsScreen(ctx);
    else if (app.screen === 'build' && app.sim) drawBuildBoard(ctx, app.sim);
    else if (app.screen === 'play' && app.sim) drawPlay(ctx, app.sim);
    else {
      fillBackground(ctx);
      drawTitleScreen(ctx);
    }
    ctx.restore();
    return 1;
  }

  // ---------- main frame ----------

  // Fixed-step accumulator: a wall dt is split into whole 1/60 steps, the remainder carried over.
  function advanceFrame(dt) {
    app.accumulator += clamp(num(dt, STEP), 0, 0.25);
    const steps = app.fast ? 2 : 1;
    if (app.screen === 'play' && !app.paused && !app.staged && !app.frozen) {
      let n = 0;
      while (app.accumulator >= STEP && n < steps) {
        app.accumulator -= STEP;
        n += 1;
        stepOnce(app.sim);
        if (!app.sim || app.sim.phase !== 'play' || app.sim.over) break;
      }
      if (app.accumulator > STEP * 4) app.accumulator = 0;
      syncScreen(app.sim);
    } else {
      app.accumulator = 0;
    }
  }

  function frame(dt) {
    if (app.frozen) {
      render();
      if (inputApi() && typeof inputApi().poll === 'function') inputApi().poll();
      return;
    }
    routeFrameInput();
    updateHover();
    if (app.screen === 'title') updateDemo();
    advanceFrame(dt);
    if (globalThis.PB_Fx && typeof globalThis.PB_Fx.step === 'function' && app.sim) globalThis.PB_Fx.step(app.sim);
    render();
    if (inputApi() && typeof inputApi().poll === 'function') inputApi().poll();
    app.tick += 1;
    if (app.toast && app.tick - app.toast.born > app.toast.life) app.toast = null;
  }

  // ---------- boot ----------

  function boot() {
    if (app.booted) return app;
    const canvas = typeof globalThis.document !== 'undefined' && globalThis.document ? globalThis.document.getElementById('game') : null;
    if (!canvas || typeof canvas.getContext !== 'function') {
      say('CANVAS MISSING');
      return app;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      say('2D CONTEXT MISSING');
      return app;
    }
    app.canvas = canvas;
    app.ctx = ctx;
    app.mounted = true;
    canvas.width = W;
    canvas.height = H;
    if (inputApi() && typeof inputApi().attach === 'function') inputApi().attach(canvas);
    initAudio();
    app.difficulty = resolveDifficulty(app.difficulty);
    app.view = { buttons: app.buttons, tick: 0, demo: null, difficulty: app.difficulty };
    ensureDemo(null);
    const menus = menusApi();
    if (menus && typeof menus.setShake === 'function' && saveApi() && typeof saveApi().settings === 'function') {
      try {
        menus.setShake(1);
      } catch (err) {
        /* shake is cosmetic */
      }
    }
    clearFx();
    app.booted = true;
    setScreen('title');
    startLoop();
    say('TITLE READY');
    return app;
  }

  function startLoop() {
    const raf = typeof globalThis.requestAnimationFrame === 'function' ? globalThis.requestAnimationFrame : null;
    let last = 0;
    if (!raf) {
      app.timeSource = 'manual';
      return;
    }
    const tickFn = function (ts) {
      const t = num(ts, 0) / 1000;
      const dt = last ? t - last : STEP;
      last = t;
      frame(dt);
      raf(tickFn);
    };
    raf(tickFn);
  }

  // The test hook steps frames by hand (no rAF); this is the single entry point it calls.
  function stepFrame(dt) {
    frame(dt == null ? STEP : dt);
    return app;
  }

  function tickFrames(count) {
    const n = Math.max(0, Math.round(num(count, 1)));
    for (let i = 0; i < n; i += 1) stepFrame(STEP);
    return app;
  }

  globalThis.PB_Main = {
    __main: true,
    boot: boot,
    frame: stepFrame,
    tickFrames: tickFrames,
    render: render,
    setScreen: setScreen,
    screen: function () { return app.screen; },
    startRun: startRun,
    retryRun: retryRun,
    continueOverbloom: continueOverbloom,
    endRun: endRun,
    createDemo: makeDemo,
    ensureDemo: ensureDemo,
    startDemo: ensureDemo,
    stepDemo: stepDemo,
    demoPolicy: function () { return app.demoPolicy; },
    chooseDifficulty: chooseDifficulty,
    pickCard: pickCard,
    reroll: doReroll,
    finishBuild: finishBuild,
    advanceShower: advanceShower,
    buildWith: buildWith,
    chooseSocket: selectSocket,
    rotateGate: rotateGate,
    dropBall: dropBall,
    pause: function (flag) { app.paused = flag === true; if (app.sim) app.sim.paused = app.paused; return app.paused; },
    fast: function (flag) { app.fast = flag == null ? !app.fast : flag === true; return app.fast; },
    freeze: function (flag) { app.frozen = flag !== false; return app.frozen; },
    stage: function (flag) { app.staged = flag === true; return app.staged; },
    endScreen: function () { if (app.sim) return syncScreen(app.sim); return app.screen; },
    currentSim: null,
    demoSim: null,
    run: null,
    summary: null,
    state: function () { return app; },
    buttons: function () { return app.buttons; },
    menuOpened: function () { app.paused = true; if (app.sim) app.sim.paused = true; },
    setGap: function (n) { app.demoGap = num(n, 0); },
    toast: setToast,
    audioReady: function () { return app.audioReady; },
  };

  globalThis.PB_Game = globalThis.PB_Main;

  // currentSim / demoSim read through getters so every renderer's readSim finds the live state.
  Object.defineProperty(globalThis.PB_Main, 'currentSim', {
    configurable: true,
    get: function () { return app.sim; },
  });
  Object.defineProperty(globalThis.PB_Main, 'demoSim', {
    configurable: true,
    get: function () { return app.demo; },
  });
  Object.defineProperty(globalThis.PB_Game, 'currentSim', {
    configurable: true,
    get: function () { return app.sim; },
  });
  Object.defineProperty(globalThis.PB_Game, 'demoSim', {
    configurable: true,
    get: function () { return app.demo; },
  });

  if (typeof globalThis.document !== 'undefined' && globalThis.document && typeof globalThis.document.readyState === 'string') {
    if (globalThis.document.readyState === 'loading') globalThis.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})();
