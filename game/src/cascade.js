// The dropper, bloom cups, CASCADE multiplier, Sunwell, seeds and score - it reads physics events and scores them.
(function () {
  if (typeof globalThis.PB_Cascade === 'object' && globalThis.PB_Cascade !== null) return;

  const DROP_TICKS = 13;
  const ENTRY_VY = 70;
  const CHECKPOINTS = [
    { at: 5, text: '5 BLOOMS - CASCADE FERVOR' },
    { at: 10, text: '10 BLOOMS - THE GARDEN STIRS' },
    { at: 20, text: '20 BLOOMS - PETAL GALE' },
    { at: 40, text: '40 BLOOMS - BLOOM ENGINE ROARS' },
    { at: 60, text: '60 BLOOMS - GOLDEN CASCADE' },
    { at: 100, text: '100 BLOOMS - THE SUNWELL SINGS' },
  ];

  function config() {
    const c = globalThis.PB_CONFIG;
    if (!c || !c.board) throw new Error('PB_Cascade: PB_CONFIG missing (load config.js first)');
    return c;
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function adder(sim) {
    return sim && sim.adders ? sim.adders : {};
  }

  function multiplierCap(sim) {
    return num(adder(sim).cascadeCap, config().cascade.multiplierCap);
  }

  function setMult(sim, mult) {
    sim.cascade.mult = clamp(Math.floor(mult), 1, multiplierCap(sim));
  }

  // Floating text and one-shot visuals live in sim.fx for render/fx.js to animate.
  function fx(sim, event) {
    if (sim.fx && typeof sim.fx.push === 'function') sim.fx.push(event);
  }

  function log(sim, text, kind) {
    if (!Array.isArray(sim.log)) sim.log = [];
    sim.log.push({ text: text, kind: kind || 'info', shower: sim.shower });
    if (sim.log.length > 6) sim.log.splice(0, sim.log.length - 6);
  }

  function awardScore(sim, points) {
    const v = Math.round(points);
    if (v <= 0) return 0;
    sim.score += v;
    return v;
  }

  function addSeeds(sim, n) {
    sim.seeds = Math.max(0, num(sim.seeds, 0) + n);
  }

  // Where a new dew-sphere enters: the rail position, just under the cabinet header.
  function dropPoint(sim) {
    const c = config();
    const f = c.board.field;
    const rail = c.board.dropperRail;
    const x = clamp(num(sim.dropper && sim.dropper.x, rail.x), f.x + 16, f.x + f.w - 16);
    return { x: x, y: f.y - 10 };
  }

  function resetDropTimer(sim) {
    if (sim.dropper) sim.dropper.cooldown = DROP_TICKS;
  }

  function spawnBall(sim) {
    const p = dropPoint(sim);
    const ball = globalThis.PB_Physics.makeBall(p.x, p.y, 0, ENTRY_VY);
    ball.valueMul = 1;
    ball.dropperX = p.x;
    if (num(adder(sim).spawnBounceSaves, 0) > 0) ball.bounceSaves = adder(sim).spawnBounceSaves;
    sim.balls.push(ball);
    sim.stats.ballsDropped += 1;
    return ball;
  }

  // Insert an already-made ball (OVERBLOOM attracts, tools); counts against this shower's supply.
  function insertBall(sim, ball) {
    if (!ball) return null;
    if (!ball.trail || !ball.trail.length) ball.trail = [{ x: ball.x, y: ball.y }];
    sim.balls.push(ball);
    sim.stats.ballsDropped += 1;
    if (sim.stats.ballsLeft > 0) sim.stats.ballsLeft -= 1;
    return ball;
  }

  // Public drop call, used by input, bots and the test hooks. Respects the drop cooldown.
  function dropBall(sim) {
    if (!sim || sim.paused || sim.over) return false;
    if (sim.phase !== 'play' && sim.phase !== 'build') return false;
    const c = config();
    if (sim.stats.ballsLeft <= 0) return false;
    if (num(sim.dropper.cooldown, 0) > 0) return false;
    if (sim.balls.length >= c.cascade.maxBallsInFlight) return false;
    spawnBall(sim);
    resetDropTimer(sim);
    return true;
  }

  function onCup(sim, ev) {
    const cup = ev.cup || sim.cups[ev.cupIndex];
    if (!cup) return;
    const mult = clamp(num(sim.cascade.mult, 1), 1, multiplierCap(sim));
    const value = num(cup.value, num(ev.value, 10));
    const lineMul = 1 + num(adder(sim).lineBonus, 0);
    const base = value * num(ev.valueMul, 1);
    const points = awardScore(sim, base * mult * lineMul);

    cup.blooms = num(cup.blooms, 0) + 1;
    cup.open = 1;
    cup.openAge = 0;

    sim.stats.blooms += 1;
    sim.stats.quotaGot += 1;
    sim.stats.petals += mult;

    sim.cascade.streak += 1;
    sim.cascade.lastCatchTick = sim.tick;
    setMult(sim, 1 + Math.floor(sim.cascade.streak / 3));
    if (sim.cascade.mult > sim.stats.bestCascade) sim.stats.bestCascade = sim.cascade.mult;

    let seeds = 1;
    if (sim.stats.quotaGot % 5 === 0) seeds += 2;
    addSeeds(sim, seeds);

    fx(sim, {
      type: 'floater',
      x: num(ev.x, cup.x + cup.w * 0.5),
      y: num(ev.y, cup.y) - 28,
      text: '+' + points + ' CASCADE x' + sim.cascade.mult,
      colour: 'gold',
    });
    fx(sim, {
      type: 'bloom',
      x: cup.x + cup.w * 0.5,
      y: cup.y,
      cup: cup,
      colourKey: cup.colourName || 'pink',
      colour: cup.colour,
      amount: 10 + sim.cascade.mult * 2,
    });
    if (sim.cascade.mult >= multiplierCap(sim)) {
      fx(sim, { type: 'shake', amount: sim.cascade.mult * 0.5 });
    }
    if (sim.stats.quotaGot > 0) {
      for (let i = 0; i < CHECKPOINTS.length; i += 1) {
        if (CHECKPOINTS[i].at === sim.stats.quotaGot) log(sim, CHECKPOINTS[i].text, 'bloom');
      }
    }
    const bells = num(adder(sim).dewBell, 0);
    if (bells > 0 && sim.stats.quotaGot % 3 === 0) {
      if (sim.sunwell < config().sunwell.max) {
        sim.sunwell += 1;
        fx(sim, { type: 'floater', x: cup.x, y: cup.y - 52, text: 'DEW BELL +1 SUNWELL', colour: 'mint' });
      }
    }
    if (typeof sim.eventsSound === 'function') sim.eventsSound('cup');
  }

  function onDrain(sim, ev) {
    sim.stats.drains += 1;
    sim.cascade.streak = 0;
    sim.cascade.mult = 1;
    const saves = num(adder(sim).straySavesPerBall, 0);
    if (saves > 0 && sim.stats.drains % saves === 0) {
      fx(sim, { type: 'floater', x: num(ev.x, 640), y: num(ev.y, 740) - 24, text: 'MOSS CUSHION SAVED A DROP', colour: 'leaf' });
      return;
    }
    sim.sunwell = Math.max(0, num(sim.sunwell, 1) - 1);
    fx(sim, { type: 'floater', x: num(ev.x, 640), y: num(ev.y, 740) - 24, text: 'SUNWELL -1', colour: 'coral' });
    log(sim, 'SUNWELL -1 - ' + sim.sunwell + ' drops left', 'drain');
    if (sim.sunwell <= 0) {
      sim.over = { result: 'lost', reason: 'sunwell', shower: sim.shower };
      log(sim, 'SUNWELL DRY - RUN LOST', 'lose');
    }
  }

  function onPeg(sim, ev) {
    const peg = ev.peg || (sim.pegGrid && g_pegAt(sim, ev));
    if (peg && !peg.dead && !peg.lit) {
      peg.lit = 1;
      awardScore(sim, 1);
    }
  }

  function g_pegAt(sim, ev) {
    const grid = sim.pegGrid;
    if (!grid || !globalThis.PB_Pegboard) return null;
    const idx = globalThis.PB_Pegboard.pegAt(grid, num(ev.x, 0), num(ev.y, 0));
    return idx >= 0 ? sim.pegs[idx] : null;
  }

  function onBumper(sim, ev) {
    if (ev.socket) ev.socket.flash = 1;
  }

  // physics.js reports the collision and half of its scoring hook; the damage, clear and seeds live in pests.js.
  function onPestHit(sim, ev) {
    sim.stats.pestHits += 1;
    if (globalThis.PB_Pests && typeof globalThis.PB_Pests.onPestHit === 'function') {
      globalThis.PB_Pests.onPestHit(sim, ev.pest || ev.pest_, ev.ball);
    }
  }

  // One tick of dropper, cup and event handling. Call after physics.stepBalls.
  function consumeEvents(sim) {
    const events = sim.events;
    const c = config();
    if (sim.dropper && num(sim.dropper.cooldown, 0) > 0) sim.dropper.cooldown -= 1;
    if (!events || !events.length) return 0;

    for (let i = 0; i < events.length; i += 1) {
      const ev = events[i];
      if (!ev) continue;
      switch (ev.type) {
        case 'cup':
          onCup(sim, ev);
          break;
        case 'drain':
          onDrain(sim, ev);
          break;
        case 'peg':
          onPeg(sim, ev);
          break;
        case 'bumper':
          onBumper(sim, ev);
          break;
        case 'pestHit':
          onPestHit(sim, ev);
          break;
        case 'bossHit':
          if (sim.boss && typeof sim.boss.onHit === 'function') sim.boss.onHit(sim, ev);
          break;
        default:
          break;
      }
    }
    events.length = 0;

    if (num(sim.sunwell, 0) <= 0 && !sim.over) {
      sim.over = { result: 'lost', reason: 'sunwell', shower: sim.shower };
    }
    return events.length;
  }

  // Between catches the streak cools: one step per decay interval, multiplied by CASCADE BELL.
  function stepDecay(sim) {
    const cascade = sim.cascade;
    const c = config();
    const last = num(cascade.lastCatchTick, 0);
    if (cascade.streak <= 0 && cascade.mult <= 1) return;
    const windowTicks = Math.max(1, Math.round(c.cascade.cascadeWindow * c.canvas.STEP_HZ));
    if (sim.tick - last < windowTicks) return;
    const rate = Math.max(0.1, num(c.cascade.cascadeDecayPerSecond, 0.55) / num(adder(sim).decaySlow, 1));
    const interval = Math.max(1, Math.round(60 / rate));
    if ((sim.tick - windowTicks - last) % interval !== 0) return;
    cascade.streak = Math.max(0, cascade.streak - 1);
    setMult(sim, 1 + Math.floor(cascade.streak / 3));
  }

  // Cup mouths relax shut and pegs cool their hit flash after every tick.
  function stepCups(sim) {
    const cups = sim.cups || [];
    for (let i = 0; i < cups.length; i += 1) {
      const cup = cups[i];
      if (cup.open > 0) {
        cup.openAge = num(cup.openAge, 0) + 1;
        if (cup.openAge > 24) cup.open = Math.max(0, cup.open - 0.08);
      }
    }
    const pegs = sim.pegs || [];
    for (let i = 0; i < pegs.length; i += 1) {
      if (pegs[i].hitFlash > 0) pegs[i].hitFlash = Math.max(0, pegs[i].hitFlash - 0.06);
    }
  }

  globalThis.PB_Cascade = {
    dropBall: dropBall,
    insertBall: insertBall,
    consumeEvents: consumeEvents,
    stepDecay: stepDecay,
    stepCups: stepCups,
    dropPoint: dropPoint,
    setMult: setMult,
    log: log,
    DROP_TICKS: DROP_TICKS,
  };
})();
