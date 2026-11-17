// The four garden pests (CLINGMOTH, DRAINGRUB, PETALBAT, HUSKLING): spawning, crawling/flying movement, ball-hit damage and clearing.
(function () {
  if (typeof globalThis.PB_Pests === 'object' && globalThis.PB_Pests !== null) return;

  const TRAIT = {
    clingmoth: { r: 15, hp: 1, speed: 230, points: 120 },
    huskling: { r: 18, hp: 2, speed: 190, points: 220 },
    draingrub: { r: 14, hp: 1, speed: 74, points: 150 },
    petalbat: { r: 17, hp: 2, speed: 150, points: 260 },
  };

  const KIND_ORDER = ['clingmoth', 'draingrub', 'petalbat', 'huskling'];
  const BAT_SPEED = 320;
  const BAT_BOB = 22;
  const BAT_LEG_TICKS = 900;
  const BAT_LEGS = 2;
  const BAT_GAP_TICKS = 70;
  const MIN_SEED_INTERVAL = 1;

  function config() {
    const c = globalThis.PB_CONFIG;
    if (!c || !c.board) throw new Error('PB_Pests: PB_CONFIG missing (load config.js first)');
    return c;
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function field() {
    return config().board.field;
  }

  function names() {
    return (globalThis.PB_NAMES && globalThis.PB_NAMES.pests) || [];
  }

  function info(kind) {
    return TRAIT[kind] || TRAIT.clingmoth;
  }

  function nameOf(kind) {
    const list = names();
    for (let i = 0; i < list.length; i += 1) if (list[i].key === kind) return list[i].name;
    return String(kind || 'PEST').toUpperCase();
  }

  function traitOf(kind) {
    const list = names();
    for (let i = 0; i < list.length; i += 1) if (list[i].key === kind) return list[i].trait;
    return info(kind) ? 'clings' : '';
  }

  function rand(sim, d) {
    return sim.rng && typeof sim.rng.next === 'function' ? sim.rng.next() : d;
  }

  function fx(sim, event) {
    if (sim.fx && typeof sim.fx.push === 'function') sim.fx.push(event);
  }

  function log(sim, text, kind) {
    if (globalThis.PB_Cascade && typeof globalThis.PB_Cascade.log === 'function') {
      globalThis.PB_Cascade.log(sim, text, kind || 'pest');
      return;
    }
    if (!Array.isArray(sim.log)) sim.log = [];
    sim.log.push({ text: text, kind: kind || 'pest', shower: sim.shower });
    if (sim.log.length > 6) sim.log.splice(0, sim.log.length - 6);
  }

  function aliveCount(sim, kind) {
    let n = 0;
    const list = sim.pests || [];
    for (let i = 0; i < list.length; i += 1) {
      const p = list[i];
      if (p.alive !== false && (kind == null || p.kind === kind)) n += 1;
    }
    return n;
  }

  // Pegs that are lit and not dead are where a clingmoth can take hold.
  function litCapablePegs(sim) {
    const out = [];
    const pegs = sim.pegs || [];
    for (let i = 0; i < pegs.length; i += 1) {
      const p = pegs[i];
      if (p && !p.dead) out.push(p);
    }
    return out;
  }

  function nearestLitPeg(sim) {
    const pegs = litCapablePegs(sim);
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < pegs.length; i += 1) {
      const p = pegs[i];
      const d = Math.abs(num(p.x, 0) - field().x - field().w * 0.5) + Math.abs(num(p.y, 0) - field().y - field().h * 0.5) * 0.6;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  // The base of the Sunwell spout: just outside the field's right wall, on the cup row.
  function spout() {
    const f = field();
    const cupY = Math.min(config().board.cupY, f.y + f.h - config().board.cupHeight);
    return { x: f.x + f.w + 6, y: num(cupY, f.y + f.h) + 30 };
  }

  function rowHeight(sim, kind) {
    const f = field();
    const lo = f.y + 120;
    const hi = f.y + 250;
    let y = lo + rand(sim, 0.5) * Math.max(1, hi - lo);
    if (kind === 'clingmoth') y = Math.min(y, lo + (hi - lo) * 0.3);
    return y;
  }

  // Spawn one pest of the given kind. Positions, HP and state live on the pest body that physics collides with.
  function spawnPest(sim, kind) {
    if (!sim || !info(kind)) return null;
    const meta = info(kind);
    const f = field();
    const p = {
      id: (sim.pestSerial = num(sim.pestSerial, 0) + 1),
      kind: kind,
      name: nameOf(kind),
      trait: traitOf(kind),
      x: f.x + f.w * 0.5,
      y: f.y + 120,
      r: meta.r,
      hp: meta.hp,
      maxHp: meta.hp,
      points: meta.points,
      state: 'enter',
      stateTicks: 0,
      age: 0,
      alive: true,
      active: true,
      peg: null,
      ownerHits: null,
      dir: 0,
      baseY: 0,
      leg: 0,
      legs: 0,
      speed: meta.speed,
    };

    if (kind === 'clingmoth' || kind === 'huskling') {
      let peg = null;
      const pegs = litCapablePegs(sim);
      if (pegs.length) {
        const idx = Math.min(pegs.length - 1, Math.floor(rand(sim, 0.5) * pegs.length));
        peg = pegs[idx];
        if (kind === 'clingmoth') {
          // Prefer upper pegs so clingmoths sit where they bother the cascade most.
          const upper = pegs.filter(function (q) { return q.y < f.y + f.h * 0.55; });
          if (upper.length) peg = upper[Math.min(upper.length - 1, Math.floor(rand(sim, 0.5) * upper.length))];
        }
      }
      if (!peg) peg = nearestLitPeg(sim);
      const enterSide = rand(sim, 0.5) < 0.5 ? -1 : 1;
      p.x = enterSide < 0 ? f.x - 20 : f.x + f.w + 20;
      p.y = rowHeight(sim, kind);
      if (peg) {
        p.targetX = peg.x;
        p.targetY = peg.y;
        p.peg = peg;
        p.state = 'enter';
      } else {
        p.state = 'enter';
      }
      p.dir = enterSide;
    } else if (kind === 'draingrub') {
      const y = f.y + f.h - 10;
      p.x = f.x + 20 + rand(sim, 0.5) * (f.w - 40);
      p.y = y;
      p.baseY = y;
      p.speed = meta.speed * (0.85 + rand(sim, 0.5) * 0.3);
      p.dir = 1;
      p.state = 'crawl';
    } else if (kind === 'petalbat') {
      p.dir = rand(sim, 0.5) < 0.5 ? -1 : 1;
      p.baseY = rowHeight(sim, kind) + 30;
      p.y = p.baseY;
      p.x = p.dir > 0 ? f.x + 24 : f.x + f.w - 24;
      p.speed = BAT_SPEED;
      p.state = 'fly';
      p.leg = 0;
      p.legs = 0;
      p.phase = rand(sim, 0.5) * Math.PI * 2;
    } else {
      return null;
    }

    sim.pests.push(p);
    return p;
  }

  function destick(p) {
    if (p.ownerHits) p.ownerHits.kind = 0;
    p.ownerHits = null;
    p.peg = null;
  }

  // CLINGMOTH takes hold: the peg loses its glow and its score. HUSKLING also deadens its two visual neighbours.
  function stick(sim, p) {
    const peg = p.peg;
    p.x = peg.x;
    p.y = peg.y;
    p.state = 'cling';
    p.stateTicks = 0;
    if (p.kind === 'huskling') {
      const owner = { kind: 'huskling', pest: p, peg: peg };
      p.ownerHits = owner;
      peg.dead = 1;
      peg.pestOwner = owner;
      const grid = sim.pegGrid;
      const rows = grid && grid.rows ? grid.rows : [];
      const row = peg.row;
      const near = [];
      for (let r = Math.max(0, row - 1); r <= Math.min(rows.length - 1, row + 1); r += 1) {
        const bucket = rows[r] || [];
        for (let i = 0; i < bucket.length; i += 1) near.push(bucket[i]);
      }
      near.sort(function (a, b) {
        const da = Math.abs(a.col - peg.col);
        const db = Math.abs(b.col - peg.col);
        if (da !== db) return da - db;
        return a.index - b.index;
      });
      let marked = 0;
      for (let i = 0; i < near.length && marked < 2; i += 1) {
        const q = near[i];
        if (q === peg || !q || q.dead) continue;
        q.husklingNear = 1;
        marked += 1;
      }
      p.huskNear = marked;
    } else {
      peg.dead = 1;
      peg.pest = p;
    }
    const mark = p.kind === 'huskling' ? 'CLINGS - PEG DEADENED' : 'CLINGS - PEG GLOW LOST';
    fx(sim, { type: 'floater', x: peg.x, y: peg.y - 26, text: p.name + ' ' + mark, colour: 'coral' });
    log(sim, p.name + ' ' + mark, 'pest');
  }

  // Release the huskling's deadened neighbours (its own peg is released by destick via ownerHits).
  function releaseHuskling(sim, p) {
    const pegs = sim.pegs || [];
    for (let i = 0; i < pegs.length; i += 1) if (pegs[i] && pegs[i].husklingNear) pegs[i].husklingNear = 0;
    const owner = p.ownerHits;
    if (owner && owner.peg) {
      if (owner.peg.pestOwner === owner) owner.peg.pestOwner = null;
      owner.peg.dead = 0;
    }
    p.ownerHits = null;
    p.peg = null;
  }

  function hitPoints(sim, points) {
    if (globalThis.PB_Cascade && typeof globalThis.PB_Cascade.awardScore === 'function') {
      globalThis.PB_Cascade.awardScore(sim, points);
    } else {
      sim.score = num(sim.score, 0) + Math.round(points);
    }
  }

  function addSeeds(sim, n) {
    sim.seeds = Math.max(0, num(sim.seeds, 0) + n);
  }

  function shake(sim, amount) {
    if (!sim.fx) sim.fx = [];
    fx(sim, { type: 'shake', amount: amount });
  }

  function awardSeed(sim) {
    const adders = sim.adders || {};
    if (num(adders.pestSeedEvery, 0) > 0) {
      addSeeds(sim, 1);
      return true;
    }
    if (sim.endless) {
      addSeeds(sim, 1);
      return true;
    }
    const last = sim.lastPestSeedKill;
    const kill = num(sim.pestKillSerial, 0);
    if (last != null && kill - last < MIN_SEED_INTERVAL) return false;
    addSeeds(sim, 1);
    sim.lastPestSeedKill = kill;
    return true;
  }

  function removePest(sim, p) {
    p.alive = false;
    p.active = false;
    destick(p);
    if (p.kind === 'huskling') releaseHuskling(sim, p);
    const list = sim.pests || [];
    for (let i = list.length - 1; i >= 0; i -= 1) if (list[i] === p) list.splice(i, 1);
    sim.pestKills = num(sim.pestKills, 0) + 1;
    if (sim.stats) {
      sim.stats.pestClears = num(sim.stats.pestClears, 0) + 1;
      sim.stats.pestsClearedShower = num(sim.stats.pestsClearedShower, 0) + 1;
    }
  }

  // Clear a pest: detach it, score it, maybe copy a seed, say so on the board and in the log.
  function clearPest(sim, p) {
    if (!p || p.alive === false) return false;
    const c = config();
    const bonus = num(c.score.pestClear, 120);
    const label = p.kind === 'huskling' ? 'HUSK CRACKED' : p.kind === 'draingrub' ? 'GRUB SQUASHED' : p.kind === 'petalbat' ? 'BAT SWATTED' : 'MOTH DOWN';
    let points = bonus;
    const adders = sim.adders || {};
    if (num(adders.thornBonus, 0) > 0) points += num(adders.thornBonus, 0);
    hitPoints(sim, points);
    removePest(sim, p);
    fx(sim, { type: 'floater', x: p.x, y: p.y - 18, text: '+' + Math.round(points) + ' ' + label, colour: 'mint' });
    if (p.kind === 'petalbat' || p.kind === 'huskling') shake(sim, 2.4);
    if (awardSeed(sim)) fx(sim, { type: 'floater', x: p.x + 8, y: p.y - 40, text: '+1 SEED', colour: 'gold' });
    log(sim, p.name + ' CLEARED +' + Math.round(points), 'pest');
    if (sim.stats && num(sim.stats.pestsClearedShower, 0) === 10 && sim.feats) sim.feats.mothHunt = true;
    if (typeof sim.eventsSound === 'function') sim.eventsSound('pestClear', p);
    return true;
  }

  function knockPetalbat(sim, p, ball) {
    const x = num(ball && ball.x, p.x);
    const y = num(ball && ball.y, p.y);
    const toBat = normalize(p.x - x, p.y - y);
    const toLeft = p.x < field().x + field().w * 0.5;
    // The bat is shoved toward the nearer wall and bounced upward; it reverses if it was about to leave.
    const towardWall = toLeft ? -1 : 1;
    const away = toBat.x * towardWall > -0.25 ? towardWall : -towardWall;
    p.dir = away;
    p.knockTicks = 36;
    p.knockPop = 1;
    p.baseY = Math.max(field().y + 90, p.baseY - 26);
    if (p.state === 'leave' || p.state === 'reenter') p.state = 'fly';
    p.x = Math.max(field().x + p.r, Math.min(field().x + field().w - p.r, p.x + away * 10));
    if (ball) {
      ball.vx = -away * Math.max(180, Math.abs(num(ball.vx, 120)) * 0.7);
      ball.vy = -Math.abs(num(ball.vy, 100)) * 0.5 - 60;
    }
    const pts = num(config().score.pestHit, 40);
    hitPoints(sim, pts);
    fx(sim, { type: 'floater', x: p.x, y: p.y - 14, text: '+' + pts + ' BAT KNOCKED', colour: 'sky' });
    if (sim.stats) sim.stats.pestHits = num(sim.stats.pestHits, 0) + 1;
    if (typeof sim.eventsSound === 'function') sim.eventsSound('pestHit', p);
  }

  // Damage from a ball. One ball can only hit a given pest once (physics emits the event).
  function damage(sim, p, ball) {
    if (p.kind === 'petalbat') {
      p.hp -= 1;
      if (p.hp <= 0) clearPest(sim, p);
      else knockPetalbat(sim, p, ball);
      return;
    }
    p.hp -= 1;
    p.hitFlash = 1;
    if (p.hp <= 0) {
      clearPest(sim, p);
      return;
    }
    const pts = num(config().score.pestHit, 40);
    hitPoints(sim, pts);
    const adders = sim.adders || {};
    if (num(adders.thornBonus, 0) > 0) p.hp -= 1;
    if (p.hp <= 0) {
      clearPest(sim, p);
      return;
    }
    fx(sim, { type: 'floater', x: p.x, y: p.y - 14, text: '+' + pts + ' CRACK ' + p.hp + '/' + p.maxHp, colour: 'gold' });
    shake(sim, 1.2);
    if (sim.stats) sim.stats.pestHits = num(sim.stats.pestHits, 0) + 1;
    if (typeof sim.eventsSound === 'function') sim.eventsSound('pestHit', p);
  }

  // Physics reported a ball-vs-pest collision. A ball damages each pest at most once.
  function onPestHit(sim, pest, ball) {
    if (!sim || !pest || pest.alive === false) return false;
    if (ball) {
      if (!ball._pestHits) ball._pestHits = [];
      if (ball._pestHits.indexOf(pest) >= 0) return false;
      ball._pestHits.push(pest);
    }
    damage(sim, pest, ball);
    return true;
  }

  function normalize(dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  function stepClinger(sim, p, dt) {
    const f = field();
    if (p.state === 'cling') {
      if (p.peg) {
        p.x = p.peg.x;
        p.y = p.peg.y;
      }
      p.stateTicks += 1;
      return;
    }
    const tx = num(p.targetX, p.x);
    const ty = num(p.targetY, p.y);
    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);
    const step = p.speed * dt;
    if (!p.peg) {
      // No lit peg left: just drift in and wait at the edge.
      p.x += p.dir * step;
      p.state = 'enter';
      return;
    }
    if (dist <= step || dist < 1) {
      stick(sim, p);
      return;
    }
    p.x += (dx / dist) * step;
    p.y += (dy / dist) * step;
    p.wing = num(p.wing, 0) + dt * 14;
    if (p.x < f.x - 30 || p.x > f.x + f.w + 30) p.dir = -p.dir;
  }

  function stepGrub(sim, p, dt) {
    const f = field();
    const t = spout();
    p.stateTicks += 1;
    const wiggle = Math.sin((p.stateTicks + (p.id || 0) * 7) * 0.12) * 4;
    p.dir = t.x >= p.x ? 1 : -1;
    p.x += p.dir * p.speed * dt;
    p.y = p.baseY + wiggle;
    if (p.x > f.x + f.w - p.r) p.x = f.x + f.w - p.r;
    if (p.x < f.x + p.r) p.x = f.x + p.r;
    if (p.dir > 0 && p.x >= f.x + f.w - p.r) {
      // Reached the Sunwell spout before any ball stopped it.
      sim.sunwell = Math.max(0, num(sim.sunwell, 0) - 1);
      fx(sim, { type: 'floater', x: t.x, y: t.y - 30, text: 'DRAINGRUB +1 SWALLOWED - SUNWELL ' + sim.sunwell, colour: 'coral' });
      log(sim, 'DRAINGRUB REACHED THE SPOUT - SUNWELL ' + sim.sunwell, 'drain');
      shake(sim, 2.5);
      if (typeof sim.eventsSound === 'function') sim.eventsSound('drain');
      p.alive = false;
      p.active = false;
      p.state = 'gone';
      if (sim.stats) sim.stats.drainsByPest = num(sim.stats.drainsByPest, 0) + 1;
      const list = sim.pests || [];
      for (let i = list.length - 1; i >= 0; i -= 1) if (list[i] === p) list.splice(i, 1);
      if (sim.sunwell <= 0 && !sim.over) {
        sim.over = { result: 'lost', reason: 'sunwell', shower: sim.shower };
        log(sim, 'SUNWELL DRY - RUN LOST', 'lose');
      }
    }
  }

  function stepBat(sim, p, dt) {
    const f = field();
    p.stateTicks += 1;
    if (num(p.knockTicks, 0) > 0) p.knockTicks -= 1;
    if (num(p.knockPop, 0) > 0) p.knockPop = Math.max(0, p.knockPop - dt * 3);
    const bob = Math.sin((p.stateTicks + num(p.phase, 0) * 60) * 0.055) * BAT_BOB;
    p.y = p.baseY + bob;

    if (p.state === 'fly' || p.state === 'leave') {
      p.x += p.dir * p.speed * dt;
      const left = f.x - p.r - 4;
      const right = f.x + f.w + p.r + 4;
      if (p.x < left || p.x > right) {
        if (p.state === 'leave' || p.legs >= BAT_LEGS) {
          p.state = 'gone';
          p.alive = false;
          p.active = false;
          const list = sim.pests || [];
          for (let i = list.length - 1; i >= 0; i -= 1) if (list[i] === p) list.splice(i, 1);
          return;
        }
        p.leg = 1;
        p.legs += 1;
        p.state = 'reenter';
        p.stateTicks = 0;
        p.dir = -p.dir;
        p.x = Math.max(f.x + p.r, Math.min(f.x + f.w - p.r, p.x));
        const lo = f.y + 120;
        const hi = f.y + 300;
        p.baseY = lo + rand(sim, 0.5) * Math.max(1, hi - lo);
        p.phase = rand(sim, 0.5) * Math.PI * 2;
      } else if (p.state === 'leave' && p.legTicks == null) {
        p.legTicks = BAT_LEG_TICKS;
      }
      if (p.state === 'leave') {
        p.legTicks = num(p.legTicks, BAT_LEG_TICKS) - 1;
        if (p.legTicks <= 0) p.state = 'fly';
      }
    } else if (p.state === 'reenter') {
      // Wait for the wingbeat gap off-screen, then fly the next leg in the opposite direction.
      if (p.stateTicks > BAT_GAP_TICKS) p.state = 'fly';
    }
    p.x = Math.max(f.x + p.r, Math.min(f.x + f.w - p.r, p.x));
  }

  // Per-tick movement and arrivals for every live pest.
  function stepPests(sim) {
    if (!sim) return 0;
    const list = sim.pests || [];
    const dt = 1 / num(sim.stepHz, config().canvas.STEP_HZ || 60);
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const p = list[i];
      if (!p || p.alive === false) continue;
      p.age = num(p.age, 0) + dt;
      if (num(p.hitFlash, 0) > 0) p.hitFlash = Math.max(0, p.hitFlash - dt * 4);
      if (p.kind === 'clingmoth' || p.kind === 'huskling') stepClinger(sim, p, dt);
      else if (p.kind === 'draingrub') stepGrub(sim, p, dt);
      else if (p.kind === 'petalbat') stepBat(sim, p, dt);
    }
    return list.length;
  }

  // Clear every pest on the board (next shower, or the end of the run).
  function clearAll(sim) {
    if (!sim) return 0;
    const list = sim.pests || [];
    let n = 0;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const p = list[i];
      if (!p) continue;
      p.alive = false;
      p.active = false;
      destick(p);
      if (p.kind === 'huskling') releaseHuskling(sim, p);
      list.splice(i, 1);
      n += 1;
    }
    const pegs = sim.pegs || [];
    for (let i = 0; i < pegs.length; i += 1) {
      if (pegs[i]) {
        if (pegs[i].pest) pegs[i].pest = null;
        if (pegs[i].pestOwner) pegs[i].pestOwner = null;
      }
    }
    return n;
  }

  globalThis.PB_Pests = {
    KINDS: KIND_ORDER,
    TRAIT: TRAIT,
    info: info,
    nameOf: nameOf,
    traitOf: traitOf,
    spawnPest: spawnPest,
    stepPests: stepPests,
    onPestHit: onPestHit,
    clearPest: clearPest,
    clearAll: clearAll,
    releaseHuskling: releaseHuskling,
    aliveCount: aliveCount,
    spout: spout,
  };
})();
