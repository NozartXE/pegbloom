// Ball physics: gravity, wind, pegs, gates, walls, contraption bumpers, tulips, pests and cup/drain resolution.
(function () {
  if (typeof globalThis.PB_Physics === 'object' && globalThis.PB_Physics !== null) return;

  const TRAIL_MAX = 10;
  const GATE_THICKNESS = 6;
  const GATE_MAX_BOUNCE = 1.15;
  const PEG_ANGLE_STEPS = 16;
  const PEST_RESTITUTION = 0.45;
  const SUBSTEP_TRACE = [];

  function config() {
    const c = globalThis.PB_CONFIG;
    if (!c || !c.physics) throw new Error('PB_Physics: PB_CONFIG.physics missing (load config.js first)');
    return c;
  }

  function board() {
    return config().board;
  }

  function fin(v) {
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function makeBall(x, y, vx, vy) {
    const b = board();
    const r = b.ballRadius;
    return {
      x: fin(x),
      y: fin(y),
      vx: fin(vx),
      vy: fin(vy),
      r: r,
      glow: 1,
      alive: true,
      ghost: false,
      trail: [{ x: fin(x), y: fin(y) }],
      valueMul: 1,
      captured: false,
      bounceSaves: 0,
      age: 0,
      hits: 0,
      stillTicks: 0,
      px: fin(x),
      py: fin(y),
    };
  }

  function pushTrail(ball) {
    const t = ball.trail;
    if (!t) {
      ball.trail = [{ x: ball.x, y: ball.y }];
      return;
    }
    t.push({ x: ball.x, y: ball.y });
    if (t.length > TRAIL_MAX) t.splice(0, t.length - TRAIL_MAX);
  }

  // Push an event onto sim.events. Sim files read events; physics never scores.
  function emit(sim, event) {
    if (sim.events && typeof sim.events.push === 'function') sim.events.push(event);
  }

  function rand(sim) {
    const rng = sim.rng;
    if (rng && typeof rng.next === 'function') return rng.next();
    return 0.5;
  }

  function jitter(sim, amount) {
    if (!(amount > 0)) return 0;
    return (rand(sim) * 2 - 1) * amount;
  }

  // A deterministic pseudo-random sign from the ball's own identity, so a pinned ball always
  // breaks the same way on the same seed without needing an RNG draw every substep.
  function ballSign(sim, ball, salt) {
    const a = Math.round(fin(ball.dropperX) * 7);
    const b = (fin(ball.age) * 60) | 0;
    const x = (a * 73856093) ^ (b * 19349663) ^ (salt | 0) ^ (sim.tick | 0);
    const v = Math.sin(x * 0.0001 + 1.7) * 43758.5;
    return v - Math.floor(v) < 0.5 ? -1 : 1;
  }

  // Circles the ball can hit as obstacles: pests and the boss, flattened into a stable list.
  function gatherObstacles(sim, out) {
    const list = out || [];
    list.length = 0;
    const pests = sim.pests;
    if (pests && pests.length) {
      for (let i = 0; i < pests.length; i += 1) {
        const p = pests[i];
        if (p && p.alive !== false && p.active !== false && fin(p.r) > 0) {
          if (list.indexOf(p) < 0) list.push(p);
        }
      }
    }
    const boss = sim.boss;
    if (boss && boss.alive !== false && boss.defeated !== true) {
      const parts = boss.parts || boss.hitCircles;
      if (parts && parts.length) {
        for (let i = 0; i < parts.length; i += 1) {
          if (parts[i] && list.indexOf(parts[i]) < 0) list.push(parts[i]);
        }
      } else if (fin(boss.r) > 0) {
        list.push(boss);
      }
    }
    return list;
  }

  // Contraption bumpers: circles with a bounce boost, keyed by the socket's kind. Only sockets that
  // carry a bumper radius (BLOOM BUMPER and its level) deflect; other builds leave the ball free.
  function gatherBumpers(sim, out) {
    const list = out || [];
    list.length = 0;
    const sockets = sim.sockets || [];
    for (let i = 0; i < sockets.length; i += 1) {
      const s = sockets[i];
      if (!s || !s.kind || !(fin(s.bumperR) > 0)) continue;
      const r = fin(s.bumperR) || 12;
      list.push({ x: s.x, y: s.y, r: r, boost: fin(s.bumpBoost) || 1.25, score: fin(s.score), source: s });
    }
    return list;
  }

  // The wind this tick: the shower's force everywhere except inside a FAN LEAF column band, which
  // cancels it (contraptions.js publishes sim.fanBands with the band's half-width).
  function windAt(sim, x) {
    const wind = sim.wind || {};
    let force = fin(wind.force);
    if (!force) return 0;
    const bands = sim.fanBands;
    if (bands && bands.length) {
      for (let i = 0; i < bands.length; i += 1) {
        const b = bands[i];
        if (!b || !(fin(b.force) !== 0)) continue;
        if (Math.abs(x - fin(b.x)) <= num(b.half, 78)) return 0;
      }
    }
    return force;
  }

  // Positional circle collision: push out along the contact normal and cancel only the
  // into-surface velocity (one reflection), so a repeated contact can never add energy.
  function collideCircle(ball, cx, cy, cr, restitution, spinAmount, sim) {
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const rr = ball.r + cr;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return null;
    let d = Math.sqrt(d2);
    let nx;
    let ny;
    if (d < 0.0001) {
      nx = 0;
      ny = -1;
      d = 0.0001;
    } else {
      nx = dx / d;
      ny = dy / d;
    }
    ball.x = cx + nx * rr;
    ball.y = cy + ny * rr;
    const vn = ball.vx * nx + ball.vy * ny;
    const impact = vn < 0 ? -vn : 0;
    if (vn < 0) {
      ball.vx -= (1 + restitution) * vn * nx;
      ball.vy -= (1 + restitution) * vn * ny;
      if (spinAmount) {
        ball.vx += -ny * spinAmount;
        ball.vy += nx * spinAmount;
      }
    }
    return { nx: nx, ny: ny, impact: impact, vn: vn };
  }

  // Top edge of the field: open through the dropper rail, a wall beyond it.
  function topIsOpen(x) {
    const rail = board().dropperRail;
    const pad = board().ballRadius * 2;
    return x > rail.x + pad && x < rail.x + rail.w - pad;
  }

  // Static side and top walls. Balls enter below the rail, so the open lane never clamps them.
  function clampWalls(sim, ball) {
    const phys = config().physics;
    const f = board().field;
    let hit = false;
    if (ball.x - ball.r < f.x) {
      ball.x = f.x + ball.r;
      if (ball.vx < 0) ball.vx = -ball.vx * phys.wallRestitution;
      emit(sim, { type: 'wall', side: 'left', ball: ball });
      hit = true;
    } else if (ball.x + ball.r > f.x + f.w) {
      ball.x = f.x + f.w - ball.r;
      if (ball.vx > 0) ball.vx = -ball.vx * phys.wallRestitution;
      emit(sim, { type: 'wall', side: 'right', ball: ball });
      hit = true;
    }
    if (ball.y - ball.r < f.y && !topIsOpen(ball.x)) {
      ball.y = f.y + ball.r;
      if (ball.vy < 0) ball.vy = -ball.vy * phys.wallRestitution;
      emit(sim, { type: 'wall', side: 'top', ball: ball });
      hit = true;
    }
    return hit;
  }

  // Peg contact test that knows about rest: on a near-zero vertical contact, add the seeded
  // tangential jitter plus a constant downhill bias so no ball balances on a peg top.
  function collidePeg(sim, ball, peg) {
    const phys = config().physics;
    const dx = ball.x - peg.x;
    const dy = ball.y - peg.y;
    const rr = ball.r + peg.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return null;
    let d = Math.sqrt(d2);
    if (d < 0.0001) {
      d = 0.0001;
      ball.x = peg.x;
    }
    const nx = (ball.x - peg.x) / d;
    const ny = (ball.y - peg.y) / d;
    ball.x = peg.x + nx * rr;
    ball.y = peg.y + ny * rr;
    const vn = ball.vx * nx + ball.vy * ny;
    const impact = vn < 0 ? -vn : 0;
    if (vn < 0) {
      ball.vx -= (1 + phys.restitution) * vn * nx;
      ball.vy -= (1 + phys.restitution) * vn * ny;
      emit(sim, { type: 'peg', peg: peg, x: peg.x, y: peg.y, impact: impact, vn: vn, ball: ball });
    }
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed < num(phys.pegPauseSpeed, 90) && ny < 0) {
      const spin = jitter(sim, 0.4);
      const bias = ballSign(sim, ball, peg.index + 13) * num(phys.pegBias, 55);
      ball.vx += -ny * spin + bias;
      ball.vy += nx * spin;
      ball.settleTicks = num(ball.settleTicks, 0) + 1;
    }
    return { nx: nx, ny: ny, impact: impact, vn: vn };
  }

  // Cup domes: a ball moving downward and outward over a cup rim rolls into the cup
  // instead of being catapulted sideways, so near-misses become catches, not drains.
  function collideCupRim(sim, ball) {
    if (fin(ball.vy) < 0) return;
    const cups = sim.cups || [];
    const phys = config().physics;
    for (let i = 0; i < cups.length; i += 1) {
      const c = cups[i];
      const ry = c.y;
      // The rim dome reaches the widest the mouth can catch (cup width + WIDE CUPS pad), so the
      // mouth widening widens the roll-in geometry instead of being swallowed by the dome.
      const rad = c.w * 0.5 + wideCups(sim);
      if (ball.y > ry + 10 || ball.y < ry - rad - ball.r) continue;
      const dx = ball.x - c.x;
      if (Math.abs(dx) > rad + ball.r * 2) continue;
      const dy = ball.y - ry;
      if (dy <= 0) continue;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > rad + ball.r || d < 0.0001) continue;
      const nx = dx / d;
      const ny = dy / d;
      if (ny < -0.25) continue;
      const away = dx >= 0 ? 1 : -1;
      const yClip = ry + Math.min(rad - ball.r * 0.5, rimDepth(phys, c));
      ball.y = Math.min(ball.y, yClip);
      const drift = -away * num(phys.cupRimRoll, 60);
      ball.vx = ball.vx * 0.3 + drift;
      ball.vy = Math.min(ball.vy, num(phys.cupRimDrop, 420));
      ball.rimRolls = num(ball.rimRolls, 0) + 1;
      ball.x = clamp(ball.x, c.x - rad + ball.r * 0.35, c.x + rad - ball.r * 0.35);
      emit(sim, { type: 'cupRim', cup: c, x: ball.x, y: ry, ball: ball });
      if (ball.rimRolls >= num(phys.maxCupRimRolls, 4)) resolveCup(sim, ball, i);
      return;
    }
  }

  function rimDepth(phys, cup) {
    return Math.min(num(phys.cupRimDepth, 8), cup.h * 0.25);
  }

  // Commits the ball to a cup: scoring happens in cascade.js from the emitted event.
  function resolveCup(sim, ball, cupIndex) {
    const cups = sim.cups || [];
    const f = board().field;
    ball.x = cups[cupIndex] ? cups[cupIndex].x : ball.x;
    ball.alive = false;
    emit(sim, {
      type: 'cup',
      cup: cups[cupIndex],
      cupIndex: cupIndex,
      value: cups[cupIndex] ? cups[cupIndex].value : 0,
      valueMul: fin(ball.valueMul) || 1,
      x: ball.x,
      y: f.y + f.h,
      ball: ball,
    });
  }

  // The cup mouth is an open mouth plus a narrowed closing funnel. The mouth's effective
  // half-width is cupWidth * cupOpenShare + funnel, so a swept x anywhere in it catches.
  // The WIDE CUPS pad this shower's board carries (0 for a plain run).
  function wideCups(sim) {
    const cups = (sim && sim.cups) || null;
    return cups && fin(cups.catchPad) > 0 ? fin(cups.catchPad) : 0;
  }

  function mouthHalf(cup) {
    const phys = config().physics;
    const share = clamp(num(phys.cupOpenShare, 0.7), 0.1, 1);
    const pad = Math.max(0, fin(cup.catchPad) || fin(config().cascade && config().cascade.catchPad));
    return Math.max(cup.w * 0.5 * share, Math.min(cup.w * 0.5 + pad, cup.w * 0.5 * share + num(phys.cupFunnel, 6) + pad));
  }

  // Drain channels: the uncovered field width left and right of the centred cup row.
  function drainChannels(sim) {
    const cups = (sim && sim.cups) || [];
    if (cups.drains && cups.drains.length) return cups.drains;
    const f = board().field;
    if (!cups.length) return [{ x: f.x, y: board().cupY, w: f.w, h: f.h, side: 'left' }];
    const first = cups[0];
    const last = cups[cups.length - 1];
    const left = first.x - first.w * 0.5;
    const right = last.x + last.w * 0.5;
    return [
      { x: f.x, y: num(first.y, board().cupY), w: left - f.x, h: f.h, side: 'left' },
      { x: right, y: num(first.y, board().cupY), w: f.x + f.w - right, h: f.h, side: 'right' },
    ];
  }

  // Cup row crossing: outside the cup row the ball falls into a side drain channel; inside it,
  // pick the cup whose mouth is under the ball, else it drains between cups.
  function resolveCupRow(sim, ball, prevY) {
    const f = board().field;
    const cups = sim.cups || [];
    let cupIndex = -1;
    if (ball.captured && typeof ball.laneCup === 'number' && cups[ball.laneCup]) {
      cupIndex = ball.laneCup;
    }
    if (cupIndex < 0) {
      const lanes = drainChannels(sim);
      const laneTop = num(cups.startY, board().cupY);
      for (let i = 0; i < lanes.length; i += 1) {
        const lane = lanes[i];
        if (lane.w <= 0) continue;
        if (fin(ball.x) >= lane.x && fin(ball.x) <= lane.x + lane.w && fin(ball.y) >= laneTop) {
          ball.alive = false;
          ball.drained = true;
          ball.drainSide = lane.side;
          ball.x = clamp(fin(ball.x), f.x, f.x + f.w);
          emit(sim, { type: 'drain', x: ball.x, y: f.y + f.h, side: lane.side, ball: ball });
          return;
        }
      }
    }
    if (cupIndex < 0) {
      const phys = config().physics;
      const y = clamp(fin(ball.y), num(phys.cupMinY, board().cupY - 26), f.y + f.h);
      const x = fin(ball.x);
      for (let i = 0; i < cups.length; i += 1) {
        const c = cups[i];
        if (x >= c.x - mouthHalf(c) - ball.r * 0.5 && x <= c.x + mouthHalf(c) + ball.r * 0.5) {
          cupIndex = i;
          break;
        }
      }
    }
    if (cupIndex >= 0) {
      resolveCup(sim, ball, cupIndex);
      return;
    }
    ball.alive = false;
    ball.drained = true;
    emit(sim, { type: 'drain', x: ball.x, y: f.y + f.h, side: 'gap', ball: ball });
  }

  // A ball past its max life fades on the spot and counts as a drain, so no ball can stay live forever.
  function resolveFaded(sim, ball, prevY) {
    const f = board().field;
    ball.alive = false;
    ball.faded = true;
    ball.fadeTick = num(sim.tick, 0);
    const x = clamp(fin(ball.x), f.x + ball.r, f.x + f.w - ball.r);
    const y = clamp(fin(prevY), f.y + ball.r, f.y + f.h - ball.r);
    emit(sim, { type: 'faded', x: x, y: y, ball: ball });
    emit(sim, { type: 'drain', x: x, y: y, ball: ball, faded: true });
  }

  // Petal gates are rotating segment deflectors with blunt ends; push out and reflect only the
  // into-face velocity. The ball is a circle, so the contact test grows the segment by the ball
  // radius along its length and by ball radius + half thickness across it: a ball falls past an
  // open lane untouched instead of being caught by the petal's edge.
  function collideGates(sim, ball) {
    const gates = sim.gates;
    if (!gates || !gates.length) return;
    const phys = config().physics;
    for (let i = 0; i < gates.length; i += 1) {
      const g = gates[i];
      if (!g || g.on === false) continue;
      const half = (fin(g.len) || 96) * 0.5;
      const hinge = fin(g.hinge) < 0 ? -1 : 1;
      const cos = Math.cos(fin(g.angle));
      const sin = Math.sin(fin(g.angle));
      const dx = ball.x - g.x;
      const dy = ball.y - g.y;
      const along = dx * cos + dy * sin;
      if (along * hinge < -half - ball.r || along * hinge > half + ball.r) continue;
      const perp = -dx * sin + dy * cos;
      const limit = ball.r + GATE_THICKNESS * 0.5;
      if (perp > limit || perp < -limit) continue;
      // One-way petal: a ball already below its drop side slides under the blade instead of
      // rolling along the underside, so a gate never secretly gathers a drained ball inward.
      if (perp * hinge < 0) continue;
      // Keep the push perpendicular: a contact near a blunt end saturates along at the end so the
      // ball leaves from the corner instead of sliding along the whole petal.
      const pinned = clamp(along * hinge, -half, half);
      const alongPush = (pinned - along * hinge) * hinge;
      const nx = -sin * hinge;
      const ny = cos * hinge;
      ball.x = g.x + cos * (along + alongPush) + nx * limit;
      ball.y = g.y + sin * (along + alongPush) + ny * limit;
      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        const e = Math.min(GATE_MAX_BOUNCE, phys.restitution + 0.2);
        ball.vx -= (1 + e) * vn * nx;
        ball.vy -= (1 + e) * vn * ny;
        const spin = jitter(sim, 30);
        ball.vx += -ny * spin;
        ball.vy += nx * spin;
        emit(sim, { type: 'gate', gate: g, index: i, normal: { x: nx, y: ny }, impact: -vn, ball: ball });
      }
    }
  }

  // Tulip catchers: a mouth zone that swallows the ball and reroutes it to a cup lane.
  function checkTulips(sim, ball) {
    const tulips = sim.tulips;
    if (!tulips || !tulips.length) return false;
    for (let i = 0; i < tulips.length; i += 1) {
      const t = tulips[i];
      if (!t || t.closed === true || t.used === true) continue;
      const w = fin(t.w) || 48;
      const h = fin(t.h) || 24;
      if (ball.x < t.x - w * 0.5 || ball.x > t.x + w * 0.5) continue;
      if (ball.y < t.y - h * 0.5 || ball.y > t.y + h * 0.5) continue;
      if (t.oneShot !== false) t.used = true;
      ball.captured = true;
      if (typeof t.cup === 'number') ball.laneCup = t.cup;
      else ball.laneCup = sim.cups && sim.cups.length ? globalThis.PB_Pegboard.cupAt(sim.cups, t.x) : -1;
      emit(sim, { type: 'tulip', tulip: t, index: i, cup: ball.laneCup, x: t.x, y: t.y, ball: ball });
      return true;
    }
    return false;
  }

  // Moves the ball forward (swept, axis-separated) and resolves whatever it touches.
  function collideWorld(sim, ball, dt, pegs, bumpers, obstacles) {
    const phys = config().physics;
    const f = board().field;
    const speed = Math.hypot(ball.vx, ball.vy);
    const substeps = Math.min(phys.maxSubSteps, Math.max(1, Math.ceil((speed * dt) / Math.max(1, ball.r))));
    const h = dt / substeps;

    for (let s = 0; s < substeps; s += 1) {
      ball.x += ball.vx * h;
      ball.y += ball.vy * h;
      clampWalls(sim, ball);

      const reach = ball.r * 2 + speed * h;
      const nearPegs = globalThis.PB_Pegboard.nearestPegs(sim.pegGrid, ball.x, ball.y, ball.r, reach);
      for (let i = 0; i < nearPegs.length; i += 1) {
        const peg = nearPegs[i];
        if (peg.dead) continue;
        const res = collidePeg(sim, ball, peg);
        if (res && res.impact > 0) {
          peg.hitFlash = Math.min(1, fin(peg.hitFlash) + 0.6);
          if (peg.golden) {
            // Golden pegs bounce brighter than the board's usual kiss.
            ball.vx += res.nx * res.impact * 0.22;
            ball.vy += res.ny * res.impact * 0.22;
            if (globalThis.PB_Cascade) {
              emit(sim, { type: 'golden', peg: peg, x: peg.x, y: peg.y, ball: ball });
            }
          }
        }
      }

      // Cup divider posts are blunt: low restitution so they nudge instead of firing balls sideways.
      const rim = sim.rimPegs;
      if (rim && rim.length) {
        for (let i = 0; i < rim.length; i += 1) {
          const post = rim[i];
          const px = post.x - ball.x;
          const py = post.y - ball.y;
          const pr = ball.r + post.r;
          if (px * px + py * py > (pr + reach) * (pr + reach)) continue;
          const res = collideCircle(ball, post.x, post.y, post.r, num(phys.rimRestitution, 0.15), 0, sim);
          if (res && res.impact > 0) emit(sim, { type: 'rim', x: post.x, y: post.y, impact: res.impact, ball: ball });
        }
      }

      for (let i = 0; i < bumpers.length; i += 1) {
        const bump = bumpers[i];
        const res = collideCircle(ball, bump.x, bump.y, bump.r, phys.restitution, jitter(sim, 8), sim);
        if (res && res.impact > 0) {
          const k = bump.boost;
          ball.vx += res.nx * res.impact * (k - 1);
          ball.vy += res.ny * res.impact * (k - 1);
          emit(sim, { type: 'bumper', socket: bump.source, x: bump.x, y: bump.y, impact: res.impact, score: bump.score, ball: ball });
        }
      }

      for (let i = 0; i < obstacles.length; i += 1) {
        const ob = obstacles[i];
        const res = collideCircle(ball, ob.x, ob.y, ob.r, PEST_RESTITUTION, jitter(sim, 8), sim);
        if (res && res.impact > 0) {
          emit(sim, {
            type: ob.isBoss || ob.kind === 'boss' ? 'bossHit' : 'pestHit',
            pest: ob.source || ob,
            hp: ob.hp,
            x: ob.x,
            y: ob.y,
            impact: res.impact,
            ball: ball,
          });
        }
      }

      // A ball stalled under the calm threshold for too long gets one deterministic downward nudge.
      const still = Math.hypot(ball.vx, ball.vy) < num(phys.stallSpeed, 26);
      if (still) {
        ball.stillTicks = num(ball.stillTicks, 0) + 1;
        if (ball.stillTicks >= num(phys.stallTicks, 90)) {
          const side = ballSign(sim, ball, 29);
          ball.vy += num(phys.stallNudge, 140);
          ball.vx += side * num(phys.stallNudge, 140) * 0.35;
          ball.stillTicks = 0;
          emit(sim, { type: 'nudge', x: ball.x, y: ball.y, ball: ball });
        }
      } else {
        ball.stillTicks = 0;
      }
    }

    collideGates(sim, ball);
    if (ball.alive) collideCupRim(sim, ball);
  }

  // Hard ceiling on how long a ball may stay live: config ballLifeTicks (720 = 12 s), with the
  // older seconds value as a fallback. A ball at the ceiling fades and counts as a drain.
  function maxLifeTicks() {
    const cas = config().cascade;
    const ticks = num(cas.ballLifeTicks, NaN);
    if (ticks > 0) return Math.max(1, Math.round(ticks));
    return Math.max(1, Math.round(num(cas.ballLife, 12) * 60));
  }

  // One fixed step (1/60 s) over every live ball. Returns the count of balls still in flight.
  function stepBalls(sim, dt) {
    const balls = sim.balls;
    if (!balls) return 0;
    const phys = config().physics;
    const f = board().field;
    const cupRowY = board().cupY;
    const lifeTicks = maxLifeTicks();
    const cupCross = cupRowY + board().ballRadius * 0.5;
    let alive = 0;

    const bumpers = gatherBumpers(sim, []);
    const obstacles = gatherObstacles(sim, []);

    // Drop dead balls first so nothing else has to filter them.
    let write = 0;
    for (let i = 0; i < balls.length; i += 1) {
      const b = balls[i];
      if (b && b.alive) balls[write++] = b;
    }
    balls.length = write;

    for (let i = 0; i < balls.length; i += 1) {
      const ball = balls[i];
      const prevY = num(ball.py, ball.y);
      ball.px = ball.x;
      ball.py = ball.y;

      ball.vy += phys.gravity * dt;
      ball.vx += windAt(sim, ball.x) * dt;
      ball.vx *= 1 - phys.friction * dt;
      ball.vy *= 1 - phys.friction * dt * 0.25;

      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > phys.maxBallSpeed) {
        const k = phys.maxBallSpeed / speed;
        ball.vx *= k;
        ball.vy *= k;
      }

      collideWorld(sim, ball, dt, null, bumpers, obstacles);
      checkTulips(sim, ball);

      if (ball.alive && num(ball.rimRolls, 0) > 0) {
        const slide = Math.hypot(ball.vx, ball.vy) < 40 ? ballSign(sim, ball, 41) * num(phys.cupFloorSlide, 40) : 0;
        ball.vx += slide;
      }

      if (ball.alive) {
        ball.age = fin(ball.age) + 1;
        const crossed = prevY + ball.r * 0.5 < cupCross && ball.y + ball.r * 0.5 >= cupCross;
        if (ball.age >= lifeTicks) resolveFaded(sim, ball, prevY);
        else if (crossed || ball.y - ball.r > f.y + f.h) resolveCupRow(sim, ball, prevY);
      }

      if (ball.alive) alive += 1;
      pushTrail(ball);
    }

    write = 0;
    for (let i = 0; i < balls.length; i += 1) {
      const b = balls[i];
      if (b && b.alive) balls[write++] = b;
    }
    balls.length = write;
    return alive;
  }

  globalThis.PB_Physics = {
    makeBall: makeBall,
    maxLifeTicks: maxLifeTicks,
    stepBalls: stepBalls,
    collideGates: collideGates,
    resolveCupRow: resolveCupRow,
    drainChannels: drainChannels,
    topIsOpen: topIsOpen,
    substepsFor: function (ball, dt) {
      const phys = config().physics;
      const speed = Math.hypot(fin(ball.vx), fin(ball.vy));
      return Math.min(phys.maxSubSteps, Math.max(1, Math.ceil((speed * dt) / Math.max(1, fin(ball.r) || 8))));
    },
  };
})();
