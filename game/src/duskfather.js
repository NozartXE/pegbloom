// The Duskfather boss: a giant moth that hovers mid-board as an obstacle, sheds clinging moths and is driven off by glowing dew-spheres.
(function () {
  if (typeof globalThis.PB_Duskfather === 'object' && globalThis.PB_Duskfather !== null) return;

  const ENTER_TICKS = 100;
  const SPAWN_TICKS = 160;
  const SPAWN_CAP = 4;
  const MIN_SWING = 110;
  const WING_SPAN = 76;
  const BODY_R = 40;
  const TOUGH_TICKS = 36;

  function config() {
    const c = globalThis.PB_CONFIG;
    if (!c || !c.board) throw new Error('PB_Duskfather: PB_CONFIG missing (load config.js first)');
    return c;
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function info() {
    return (globalThis.PB_NAMES && globalThis.PB_NAMES.bossInfo) || { name: 'THE DUSKFATHER', hp: 24 };
  }

  function fx(sim, event) {
    if (!sim.fx) sim.fx = [];
    sim.fx.push(event);
  }

  function log(sim, text, kind) {
    if (globalThis.PB_Cascade && typeof globalThis.PB_Cascade.log === 'function') globalThis.PB_Cascade.log(sim, text, kind || 'boss');
  }

  // The boss body plus its two wings are the physics obstacles; only the body deals/takes hits.
  function makeParts(boss) {
    const body = { x: boss.x, y: boss.y, r: boss.r, source: boss, isBoss: true, kind: 'boss', hp: boss.hp, part: 'body' };
    const left = { x: boss.x - WING_SPAN, y: boss.y + 6, r: 26, source: boss, isBoss: true, kind: 'boss', hp: boss.hp, part: 'wingL' };
    const right = { x: boss.x + WING_SPAN, y: boss.y + 6, r: 26, source: boss, isBoss: true, kind: 'boss', hp: boss.hp, part: 'wingR' };
    boss.bodyPart = body;
    boss.parts = [left, body, right];
    return boss.parts;
  }

  function syncParts(boss) {
    const parts = boss.parts;
    if (!parts) return;
    for (let i = 0; i < parts.length; i += 1) {
      const p = parts[i];
      if (!p) continue;
      p.hp = boss.hp;
      p.dead = boss.defeated === true;
      if (p.part === 'body') {
        p.x = boss.x;
        p.y = boss.y;
      } else if (p.part === 'wingL') {
        p.x = boss.x - WING_SPAN;
        p.y = boss.y + 6;
      } else if (p.part === 'wingR') {
        p.x = boss.x + WING_SPAN;
        p.y = boss.y + 6;
      }
    }
  }

  // Shower 9: the giant moth drops in from above and settles on a deterministic sine hover.
  function spawnBoss(sim) {
    if (!sim) return null;
    const c = config();
    const f = c.board.field;
    const maxHp = num(c.score && c.score.bossHP, 24);
    const boss = {
      name: info().name,
      kind: 'boss',
      isBoss: true,
      x: f.x + f.w * 0.5,
      y: f.y + f.h * 0.34,
      homeX: f.x + f.w * 0.5,
      homeY: f.y + f.h * 0.34,
      swing: Math.max(MIN_SWING, f.w * 0.5 - 150),
      r: 54,
      bodyR: BODY_R,
      refR: 54,
      hp: maxHp,
      maxHp: maxHp,
      alive: true,
      defeated: false,
      entering: true,
      enterTicks: ENTER_TICKS,
      phase: num(sim.tick, 0) * 0.021,
      speed: 0.021,
      spawnTicks: 0,
      spawnEvery: SPAWN_TICKS,
      flash: 0,
      wing: 0,
      hitTough: 0,
      parts: null,
      onHit: null,
    };
    boss.y = f.y - 40;
    makeParts(boss);
    boss.onHit = function (s, ev) {
      return onBossHit(s, ev && ev.ball);
    };
    sim.boss = boss;
    sim.bossDown = false;
    log(sim, info().name + ' DESCENDS - ' + maxHp + ' HP', 'boss');
    if (globalThis.PB_Cascade && typeof globalThis.PB_Cascade.log === 'function') {
      globalThis.PB_Cascade.log(sim, 'DRIVE IT OFF WITH GLOWING DROPS', 'info');
    }
    return boss;
  }

  function shedMoth(sim, boss) {
    if (!globalThis.PB_Pests) return null;
    const list = sim.pests || [];
    let clings = 0;
    for (let i = 0; i < list.length; i += 1) if (list[i] && list[i].alive !== false && list[i].kind === 'clingmoth') clings += 1;
    if (clings >= SPAWN_CAP) return null;
    const p = globalThis.PB_Pests.spawnPest(sim, 'clingmoth');
    if (p) {
      p.x = boss.x + (num(p.dir, 1) * (WING_SPAN + 10));
      p.y = boss.y + 24;
      p.fromBoss = true;
      fx(sim, { type: 'floater', x: boss.x, y: boss.y + 40, text: 'DUSKFATHER SHEDS A MOTH', colour: 'coral' });
    }
    return p;
  }

  // Hover movement, shed timer and the entry drop. Safe to call every tick, even outside shower 9.
  function step(sim) {
    const boss = sim && sim.boss;
    if (!boss || boss.alive === false || boss.defeated === true) return;
    const f = config().board.field;
    boss.wing = num(boss.wing, 0) + 0.32;
    if (num(boss.flash, 0) > 0) boss.flash = Math.max(0, boss.flash - 0.05);
    if (num(boss.hitTough, 0) > 0) boss.hitTough -= 1;

    if (boss.entering) {
      boss.enterTicks = num(boss.enterTicks, ENTER_TICKS) - 1;
      const k = Math.max(0, boss.enterTicks) / ENTER_TICKS;
      boss.y = boss.homeY - (boss.homeY - (f.y - 40)) * k;
      boss.x = boss.homeX;
      if (boss.enterTicks <= 0) {
        boss.entering = false;
        boss.y = boss.homeY;
      }
      syncParts(boss);
      return;
    }

    boss.phase = num(boss.phase, 0) + num(boss.speed, 0.021);
    boss.x = boss.homeX + Math.sin(boss.phase) * boss.swing;
    boss.y = boss.homeY + Math.sin(boss.phase * 2 + 0.9) * 34;
    syncParts(boss);

    boss.spawnTicks = num(boss.spawnTicks, 0) + 1;
    if (boss.spawnTicks >= num(boss.spawnEvery, SPAWN_TICKS)) {
      boss.spawnTicks = 0;
      shedMoth(sim, boss);
    }
  }

  // Defeat: bonus score, flag, banner and log; sim.js then closes the shower.
  function defeat(sim, boss) {
    if (boss.defeated) return;
    boss.defeated = true;
    boss.alive = false;
    boss.hp = 0;
    boss.spawnTicks = -100000;
    if (boss.parts) {
      for (let i = 0; i < boss.parts.length; i += 1) if (boss.parts[i]) boss.parts[i].dead = true;
    }
    const c = config();
    const bonus = num(c.score && c.score.bossDefeat, 2000);
    if (globalThis.PB_Cascade && typeof globalThis.PB_Cascade.awardScore === 'function') globalThis.PB_Cascade.awardScore(sim, bonus);
    else sim.score = num(sim.score, 0) + bonus;
    sim.bossDown = true;
    sim.bossDefeatTick = sim.tick;
    if (sim.feats) sim.feats.duskGone = sim.difficulty !== 'Gentle';
    const f = c.board.field;
    fx(sim, { type: 'floater', x: boss.x, y: boss.y - 20, text: '+' + bonus + ' DUSKFATHER DRIVEN OFF', colour: 'gold', big: true });
    fx(sim, { type: 'bloom', x: boss.x, y: boss.y, colourKey: 'pink', amount: 40 });
    fx(sim, { type: 'shake', amount: 9 });
    log(sim, info().name + ' RETREATS +' + bonus, 'win');
    sim.banner = { text: info().name + ' DRIVEN OFF - THE GARDEN BREATHES', kind: 'boss', ticks: 180 };
    if (globalThis.PB_Pests) clearBossMinions(sim);
    if (typeof sim.eventsSound === 'function') sim.eventsSound('bossDown');
  }

  // Moths shed by the boss leave with it.
  function clearBossMinions(sim) {
    const list = sim.pests || [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const p = list[i];
      if (p && p.fromBoss) {
        p.alive = false;
        p.active = false;
        if (p.kind === 'huskling' && typeof globalThis.PB_Pests.releaseHuskling === 'function') {
          globalThis.PB_Pests.releaseHuskling(sim, p);
        } else if (p.peg) {
          if (p.peg.pest === p) p.peg.pest = null;
          p.peg.dead = 0;
          p.peg = null;
        }
        list.splice(i, 1);
        fx(sim, { type: 'floater', x: p.x, y: p.y, text: 'MOTH SCATTERS', colour: 'mint' });
      }
    }
  }

  // Physics reported a ball-vs-boss hit. Only glowing balls count, once per ball per tick.
  function onBossHit(sim, ball) {
    const boss = sim && sim.boss;
    if (!boss || boss.alive === false || boss.defeated === true) return false;
    if (boss.entering) return false;
    if (!ball || num(ball.glow, 0) <= 0) {
      fx(sim, { type: 'floater', x: boss.x, y: boss.y - boss.r - 8, text: 'NEED GLOW', colour: 'ink' });
      return false;
    }
    if (ball._bossTick === sim.tick) return false;
    ball._bossTick = sim.tick;
    boss.hp = Math.max(0, num(boss.hp, boss.maxHp) - 1);
    boss.flash = 1;
    boss.hitTough = TOUGH_TICKS;
    ball.glow = Math.max(0, num(ball.glow, 1) - 0.25);
    if (sim.stats) sim.stats.bossHits = num(sim.stats.bossHits, 0) + 1;
    const pts = num(config().score && config().score.bossHit, 60);
    if (globalThis.PB_Cascade && typeof globalThis.PB_Cascade.awardScore === 'function') globalThis.PB_Cascade.awardScore(sim, pts);
    else sim.score = num(sim.score, 0) + pts;
    fx(sim, { type: 'floater', x: boss.x, y: boss.y - boss.r - 6, text: '-' + boss.hp + ' DUSKFATHER ' + boss.hp + '/' + boss.maxHp, colour: 'gold' });
    fx(sim, { type: 'shake', amount: 3.2 });
    syncParts(boss);
    if (boss.hp <= 0) defeat(sim, boss);
    if (typeof sim.eventsSound === 'function') sim.eventsSound('bossHit');
    return true;
  }

  globalThis.PB_Duskfather = {
    spawnBoss: spawnBoss,
    spawn: spawnBoss,
    step: step,
    onBossHit: onBossHit,
    syncParts: syncParts,
    defeat: defeat,
    SPAWN_TICKS: SPAWN_TICKS,
    SPAWN_CAP: SPAWN_CAP,
  };
})();
