// Screenshot and test staging for the tools (?shot= and ?test=1); it only drives the real sim, save and main paths.
(function () {
  if (globalThis.PB_Test && typeof globalThis.PB_Test.install === 'function') return;

  const SHOT_SEED = 90001;
  const MAX_STEPS = 90000;

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function params() {
    if (typeof globalThis.location === 'undefined' || !globalThis.location) return {};
    const out = {};
    const search = String(globalThis.location.search || '').replace(/^\?/, '');
    if (!search) return out;
    const parts = search.split('&');
    for (let i = 0; i < parts.length; i += 1) {
      if (!parts[i]) continue;
      const eq = parts[i].indexOf('=');
      const k = decodeURIComponent(eq >= 0 ? parts[i].slice(0, eq) : parts[i]);
      const v = eq >= 0 ? decodeURIComponent(parts[i].slice(eq + 1).replace(/\+/g, ' ')) : '';
      out[k] = v;
    }
    return out;
  }

  function main() {
    return globalThis.PB_Main || null;
  }

  function bot() {
    return globalThis.PB_Bot || null;
  }

  function simApi() {
    return globalThis.PB_Sim || null;
  }

  function waitFrames(count) {
    const m = main();
    if (!m || typeof m.tickFrames !== 'function') return;
    m.tickFrames(Math.max(1, Math.round(num(count, 1))));
  }

  function currentSim() {
    const m = main();
    return m && m.currentSim ? m.currentSim : null;
  }

  function liveBalls(sim) {
    return sim && Array.isArray(sim.balls) ? sim.balls.length : 0;
  }

  function activeFloaters(sim) {
    if (!sim || !Array.isArray(sim.fx)) return 0;
    let n = 0;
    for (let i = 0; i < sim.fx.length; i += 1) if (sim.fx[i] && sim.fx[i].type === 'floater') n += 1;
    return n;
  }

  function qaBot(opts) {
    const b = bot();
    if (!b || typeof b.create !== 'function') return null;
    const o = opts || {};
    return b.create({
      minLive: num(o.minLive, 10),
      maxLive: num(o.maxLive, 16),
      sweepTicks: num(o.sweepTicks, 360),
      sweepSpan: num(o.sweepSpan, 0.7),
      gateEvery: num(o.gateEvery, 150),
      draftPick: num(o.draftPick, 0),
      endless: o.endless === true,
      maxTicks: num(o.maxTicks, 240000),
    });
  }

  // In shower n with the first drops already in: the banner, the trays and the readout all name shower n.
  function inShower(sim, n) {
    return !!sim && sim.phase === 'play' && sim.shower === n && num(sim.stats && sim.stats.ballsDropped, 0) > 0;
  }

  // In the draft whose footer names shower n - the draft that opens once shower n-1 has closed.
  function inDraftFor(sim, n) {
    if (!sim || sim.phase !== 'draft') return false;
    const target = num(sim.draft && sim.draft.target, sim.shower + 1);
    return target === n;
  }

  // Drive one tick of the bot policy. A closed shower ('end') rolls the run on into the next draft, so the
  // bookkeeping for the screen is refreshed after it; a won/lost run is a dead end for staging.
  function drive(sim, policy) {
    const b = bot();
    const m = main();
    if (!sim || !b || typeof b.step !== 'function') return false;
    if (sim.over && (sim.over.result === 'won' || sim.over.result === 'lost')) return false;
    b.step(sim, policy);
    if (sim.over && (sim.over.result === 'won' || sim.over.result === 'lost')) return false;
    if (m && typeof m.endScreen === 'function') m.endScreen();
    return true;
  }

  // Balls and floating score text on the frozen board, counted the same way the stager measures them.
  function readBoard(sim) {
    return { tick: num(sim && sim.tick, 0), balls: liveBalls(sim), floaters: activeFloaters(sim) };
  }

  // Pass 1 of the play shot: same seed and same policy, replay the run and find the liveliest tick of shower 5.
  // First tick with >= 10 balls and >= 2 floaters wins; failing that, the tick with the most balls (earliest tie).
  function findDenseTick(seed, policy) {
    const api = simApi();
    if (!api || typeof api.createSim !== 'function') return null;
    const sim = api.createSim(seed, 'Normal');
    let best = null;
    let guard = 0;
    while (guard < MAX_STEPS && !sim.over) {
      if (sim.shower === 5) {
        const now = readBoard(sim);
        if (now.balls >= 10 && now.floaters >= 2) return { tick: now.tick, balls: now.balls, floaters: now.floaters };
        if (!best || now.balls > best.balls) best = { tick: now.tick, balls: now.balls, floaters: now.floaters };
      }
      if (sim.shower > 5) break;
      if (!drive(sim, policy)) break;
      guard += 1;
    }
    return best;
  }

  // Pass 2 of the play shot: fresh run, same seed and policy, stop ON the recorded tick and hand it over frozen.
  function freezeAtTick(seed, policy, target) {
    const m = main();
    if (!m || typeof m.startRun !== 'function') return null;
    m.startRun('Normal', seed);
    const sim = currentSim();
    if (!sim) return null;
    let guard = 0;
    while (guard < MAX_STEPS && !sim.over && !inShower(sim, 5)) {
      if (!drive(sim, policy)) break;
      guard += 1;
    }
    let now = readBoard(sim);
    while (guard < MAX_STEPS && inShower(sim, 5) && now.tick < target) {
      if (!drive(sim, policy)) break;
      guard += 1;
      now = readBoard(sim);
    }
    return sim;
  }

  // The play shot: a bot drives showers 1-4 (pick 0, endBuild straight away), then shower 5 freezes mid-cascade.
  function stagePlay(seed) {
    const m = main();
    if (!m || typeof m.startRun !== 'function') return null;
    const policy = qaBot({});
    // Pass 1 is a scratch run on the shared sim API: it only measures, the run main shows is rebuilt in pass 2.
    const dense = findDenseTick(seed, policy);
    const target = dense ? dense.tick : 0;
    const sim = freezeAtTick(seed, policy, target);
    m.setScreen('play');
    m.stage(true);
    m.freeze(true);
    if (sim) sim.paused = true;
    m.render();
    return sim;
  }

  function stageTitle(seed) {
    const m = main();
    if (!m || typeof m.setScreen !== 'function') return null;
    m.setScreen('title');
    if (typeof m.createDemo === 'function') m.createDemo(seed);
    const demo = m.demoSim;
    const policy = m.demoPolicy ? m.demoPolicy() : null;
    if (demo && policy) {
      const b = bot();
      if (b && typeof b.step === 'function') {
        for (let i = 0; i < 1400 && !demo.over; i += 1) b.step(demo, policy);
        // Let the demo run on for a few seconds so the live cascade is mid-flow behind the wordmark.
        if (typeof globalThis.PB_Fx === 'object' && globalThis.PB_Fx && typeof globalThis.PB_Fx.consume === 'function') globalThis.PB_Fx.consume(demo);
      }
    }
    if (typeof m.tickFrames === 'function') m.tickFrames(1);
    m.stage(true);
    m.freeze(true);
    m.render();
    return demo;
  }

  // The draft shot: stop in the draft that follows shower 4, whose footer reads "SHOWER 5 OF 9".
  function stageDraft(seed) {
    const m = main();
    if (!m || typeof m.startRun !== 'function') return null;
    m.startRun('Normal', seed);
    const sim = currentSim();
    if (!sim) return null;
    const policy = qaBot({});
    let guard = 0;
    while (guard < MAX_STEPS && !inDraftFor(sim, 5)) {
      if (!drive(sim, policy)) break;
      guard += 1;
    }
    m.setScreen('draft');
    m.stage(true);
    m.freeze(true);
    sim.paused = true;
    m.render();
    return sim;
  }

  // Seed the save with two really-played rows: a bot win (endless, so it survives the boss) and a weak bot loss.
  function seedHistory(seed) {
    const s = globalThis.PB_Save;
    const api = simApi();
    const b = bot();
    if (!s || !api || !b) return [];
    const rows = [];
    const win = api.createSim(String(seed) + ':win', 'Scorched');
    win.eventsSound = null;
    b.runToEnd(win, { endless: true, draftPick: 2, minLive: 12, maxLive: 18, buildCap: 11, maxTicks: 300000 });
    s.recordRun(win);
    rows.push({ score: win.score, won: !!(win.over && win.over.result === 'won') });
    const loss = api.createSim(String(seed) + ':loss', 'Normal');
    loss.eventsSound = null;
    b.runToEnd(loss, { weak: true, minLive: 4, maxLive: 7, draftPick: 0, buildCap: 1, maxTicks: 240000 });
    if (!(loss.over && loss.over.result === 'lost')) {
      loss.over = { result: 'lost', reason: 'sunwell', shower: loss.shower };
    }
    s.recordRun(loss);
    rows.push({ score: loss.score, won: false });
    return rows;
  }

  function stageResults(seed) {
    const m = main();
    if (!m || typeof m.startRun !== 'function') return null;
    seedHistory(seed);
    m.startRun('Scorched', seed);
    const sim = currentSim();
    const b = bot();
    if (!sim || !b) return sim;
    for (let i = 0; i < MAX_STEPS && !sim.over; i += 1) {
      b.step(sim, qaBot({ minLive: 13, maxLive: 18, draftPick: 2, buildCap: 11 }));
      if (sim.over && sim.over.result === 'won') break;
    }
    if (!sim.over) {
      // An honest unfinished run still closes through the sim's own loss path.
      sim.over = { result: 'lost', reason: 'sunwell', shower: sim.shower };
      sim.phase = 'lost';
      sim.runEndTick = sim.tick;
    }
    m.endRun(sim);
    m.setScreen('results');
    m.stage(true);
    m.freeze(true);
    m.render();
    return sim;
  }

  function stage(name, seed) {
    const n = String(name || '').toLowerCase();
    if (n === 'play') return stagePlay(seed);
    if (n === 'title') return stageTitle(seed);
    if (n === 'draft') return stageDraft(seed);
    if (n === 'results') return stageResults(seed);
    return null;
  }

  // Deterministic staged states for the tools: same seed, same screenshot.
  function state() {
    const m = main();
    const sim = currentSim();
    const app = m && typeof m.state === 'function' ? m.state() : null;
    return {
      screen: m && app ? app.screen : null,
      paused: !!(app && app.paused),
      frozen: !!(app && app.frozen),
      staged: !!(app && app.staged),
      tick: app ? app.tick : 0,
      seed: sim ? sim.seed : null,
      difficulty: sim ? sim.difficulty : app ? app.difficulty : null,
      shower: sim ? sim.shower : null,
      phase: sim ? sim.phase : null,
      score: sim ? sim.score : 0,
      balls: liveBalls(sim),
      floaters: activeFloaters(sim),
      pests: sim && Array.isArray(sim.pests) ? sim.pests.length : 0,
      sunwell: sim ? sim.sunwell : null,
      history: globalThis.PB_Save && typeof globalThis.PB_Save.lastRuns === 'function' ? globalThis.PB_Save.lastRuns() : [],
      demo: !!(m && m.demoSim),
    };
  }

  function install() {
    const p = params();
    const m = main();
    if (!m || typeof m.boot !== 'function') return;
    m.boot();
    if (p.test === '1') {
      globalThis.PB_TEST = {
        PB_Sim: globalThis.PB_Sim,
        PB_Save: globalThis.PB_Save,
        createSim: globalThis.PB_Sim ? globalThis.PB_Sim.createSim : null,
        stepSim: globalThis.PB_Sim ? globalThis.PB_Sim.stepSim : null,
        setScreen: function (name, opts) { return m.setScreen(name, opts); },
        state: state,
        freeze: m.freeze,
        render: m.render,
      };
    }
    if (p.shot) {
      const raw = String(p.seed == null || p.seed === '' ? SHOT_SEED : p.seed);
      const seed = /^[0-9]+$/.test(raw) ? Number(raw) : raw;
      try {
        stage(p.shot, seed);
      } catch (err) {
        if (m.toast) m.toast('STAGE FAILED: ' + String(err && err.message || err), 'warn', 6000);
        m.render();
      }
    }
  }

  globalThis.PB_Test = {
    install: install,
    stage: stage,
    state: state,
    seedHistory: seedHistory,
    params: params,
  };

  if (typeof globalThis.document !== 'undefined' && globalThis.document && typeof globalThis.document.readyState === 'string') {
    if (globalThis.document.readyState === 'loading') globalThis.document.addEventListener('DOMContentLoaded', install);
    else install();
  } else {
    install();
  }
})();
