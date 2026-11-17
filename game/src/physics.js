// Ball physics: gravity, wind, pegs, gates, walls, contraption bumpers, tulips, pests and cup/drain resolution.
(function () {
  if (typeof globalThis.PB_Physics === 'object' && globalThis.PB_Physics !== null) return;

  const TRAIL_MAX = 10;
  const PEG_SUB_CAP = 3;
  const TANGENT_JITTER = 0.18;
  const GATE_THICKNESS = 6;
  const GATE_MAX_BOUNCE = 1.15;
  const REST_CLIMB = 0.6;

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
    return (rand(sim) * 2 - 1) * amount;
  }

  // Circles the ball can hit as obstacles: pests and the boss, flattened into a stable list.
  function gatherObstacles(sim, out) {
    const list = out || [];
    list.length = 0;
    const pests = sim.pests;
    if (pests && pests.length) {
      for (let i = 0; i < pests.length; i += 1) {
        const p = pests[i];
        if (p && p.alive !== false && p.active !== false && fin(p.r) > 0) list.push(p);
      }
    }
    const boss = sim.boss;
    if (boss && boss.alive !== false && boss.defeated !== true) {
      const parts = boss.parts || boss.hitCircles;
      if (parts && parts.length) {
        for (let i = 0; i < parts.length; i += 1) list.push(parts[i]);
      } else if (fin(boss.r) > 0) {
        list.push(boss);
      }
    }
    return list;
  }

  // Contraption bumpers: circles with a bounce boost, keyed by the socket's kind.
  function gatherBumpers(sim, out) {
    const list = out || [];
    list.length = 0;
    const sockets = sim.sockets || [];
    for (let i = 0; i < sockets.length; i += 1) {
      const s = sockets[i];
      if (!s || !s.kind) continue;
      const r = fin(s.bumperR) || 12;
      list.push({ x: s.x, y: s.y, r: r, boost: fin(s.bumpBoost) || 1.25, source: s });
    }
    return list;
  }

  function collideCircle(ball, cx, cy, cr, restitution, jitterAmount, sim) {
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
      ny = 1;
      d = 0.0001;
    } else {
      nx = dx / d;
      ny = dy / d;
    }
    ball.x = cx + nx * rr;
    ball.y = cy + ny * rr;
    const vn = ball.vx * nx + ball.vy * ny;
    const at = d < rr ? 1 - d / rr : 0;
    const spin = jitter(sim, TANGENT_JITTER * at);
    const tx = -ny;
    const ty = nx;
    if (vn < 0) {
      ball.vx -= (1 + restitution) * vn * nx;
      ball.vy -= (1 + restitution) * vn * ny;
      ball.vx += tx * spin;
      ball.vy += ty * spin;
      return { nx: nx, ny: ny, impact: -vn, vn: vn };
    }
    if (spin !== 0) {
      ball.vx += tx * spin;
      ball.vy += ty * spin;
      return { nx: nx, ny: ny, impact: 0, vn: vn };
    }
    return { nx: nx, ny: ny, impact: 0, vn: vn };
  }

  // Moves the ball forward (swept, axis-separated) and resolves whatever it touches.
  function collideWorld(sim, ball, dt, pegs, bumpers, obstacles) {
    const phys = config().physics;
    const f = board().field;
    const speed = Math.hypot(ball.vx, ball.vy);
    const substeps = Math.min(phys.maxSubSteps, Math.max(1, Math.ceil((speed * dt) / Math.max(1, ball.r))));
    const h = dt / substeps;
    const cx0 = Math.max(f.x - 26, 0);

    for (let s = 0; s < substeps; s += 1) {
      const speedNow = Math.hypot(ball.vx, ball.vy);
        ball.x += ball.vx * h;
      ball.y += Math.max(ball.vy * h, -REST_CLIMB);

      if (ball.x - ball.r < f.x) {
        ball.x = f.x + ball.r;
        if (ball.vx < 0) ball.vx = -ball.vx * phys.wallRestitution;
        emit(sim, { type: 'wall', side: 'left', ball: ball });
      } else if (ball.x + ball.r > f.x + f.w) {
        ball.x = f.x + f.w - ball.r;
        if (ball.vx > 0) ball.vx = -ball.vx * phys.wallRestitution;
        emit(sim, { type: 'wall', side: 'right', ball: ball });
      }
      if (ball.x > cx0 - 20 && ball.y - ball.r < f.y) {
        ball.y = f.y + ball.r;
        if (ball.vy < 0) ball.vy = -ball.vy * phys.wallRestitution;
        emit(sim, { type: 'wall', side: 'top', ball: ball });
      }

      const reach = ball.r * 2 + speedNow * h;
      const nearPegs = globalThis.PB_Pegboard.nearestPegs(sim.pegGrid, ball.x, ball.y, ball.r, reach);
      for (let i = 0; i < nearPegs.length; i += 1) {
        const peg = nearPegs[i];
        if (peg.dead) continue;
        const res = collideCircle(ball, peg.x, peg.y, peg.r, phys.restitution, TANGENT_JITTER * 0.5, sim);
        if (res && res.impact > 0) {
          peg.hitFlash = Math.min(1, fin(peg.hitFlash) + 0.6);
          emit(sim, { type: 'peg', peg: peg, x: peg.x, y: peg.y, impact: res.impact, vn: res.vn, ball: ball });
        }
      }

      for (let i = 0; i < bumpers.length; i += 1) {
        const bump = bumpers[i];
        const res = collideCircle(ball, bump.x, bump.y, bump.r, phys.restitution, TANGENT_JITTER * 0.5, sim);
        if (res && res.impact > 0) {
          const k = bump.boost;
          ball.vx += res.nx * res.impact * (k - 1);
          ball.vy += res.ny * res.impact * (k - 1);
          emit(sim, { type: 'bumper', socket: bump.source, x: bump.x, y: bump.y, impact: res.impact, ball: ball });
        }
      }

      for (let i = 0; i < obstacles.length; i += 1) {
        const ob = obstacles[i];
        const res = collideCircle(ball, ob.x, ob.y, ob.r, 0.45, TANGENT_JITTER, sim);
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

    }

    collideGates(sim, ball);
  }

  // Petal gates are rotating line-segment deflectors; reflect the ball off whichever face it crossed.
  function collideGates(sim, ball) {
    const gates = sim.gates;
    if (!gates || !gates.length) return;
    const phys = config().physics;
    for (let i = 0; i < gates.length; i += 1) {
      const g = gates[i];
      if (!g || g.on === false) continue;
      const len = fin(g.len) || 96;
      const half = len * 0.5;
      const cos = Math.cos(fin(g.angle));
      const sin = Math.sin(fin(g.angle));
      const dx = ball.x - g.x;
      const dy = ball.y - g.y;
      const along = dx * cos + dy * sin;
      if (along < -half || along > half) continue;
      const perp = -dx * sin + dy * cos;
      const limit = ball.r + GATE_THICKNESS * 0.5;
      if (perp > limit || perp < -limit) continue;
      const sign = perp > 0 ? 1 : -1;
      let nx = -sin * sign;
      let ny = cos * sign;
      ball.x = g.x + cos * along + nx * limit;
      ball.y = g.y + sin * along + ny * limit;
      const vn = ball.vx * nx + ball.vy * ny;
      const spin = jitter(sim, TANGENT_JITTER * 0.3);
      if (vn < 0) {
        const e = Math.min(GATE_MAX_BOUNCE, phys.restitution + 0.2);
        ball.vx -= (1 + e) * vn * nx;
        ball.vy -= (1 + e) * vn * ny;
        ball.vx += -ny * spin;
        ball.vy += nx * spin;
        emit(sim, { type: 'gate', gate: g, index: i, normal: { x: nx, y: ny }, impact: -vn, ball: ball });
      } else if (spin !== 0) {
        ball.vx += -ny * spin;
        ball.vy += nx * spin;
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
      if (typeof t.cup === 'number') {
        ball.laneCup = t.cup;
      } else {
        ball.laneCup = sim.cups && sim.cups.length ? globalThis.PB_Pegboard.cupAt(sim.cups, t.x) : -1;
      }
      emit(sim, { type: 'tulip', tulip: t, index: i, cup: ball.laneCup, x: t.x, y: t.y, ball: ball });
      return true;
    }
    return false;
  }

  // Cup row crossing: pick the cup whose mouth is under the ball, else it drains between cups.
  function resolveCupRow(sim, ball, prevY) {
    const f = board().field;
    const cups = sim.cups || [];
    let cupIndex = -1;
    if (ball.captured && typeof ball.laneCup === 'number') {
      cupIndex = ball.laneCup;
    }
    if (cupIndex < 0 || !cups[cupIndex]) {
      cupIndex = -1;
      // The ball crosses a cup mouth between prevY and y: use the swept x at the mouth height, shallowest first.
      let bestY = -Infinity;
      const pend = ball.y + ball.r;
      const y0 = prevY + ball.r;
      const denom = pend - y0;
      for (let i = 0; i < cups.length; i += 1) {
        const c = cups[i];
        const mouth = c.y + 5;
        if (mouth < y0 || mouth > pend) continue;
        const hitX = ball.x - ball.vx * ((pend - mouth) / (denom > 0.001 ? denom : 0.001));
        if (hitX >= c.x - c.w * 0.5 && hitX <= c.x + c.w * 0.5 && mouth > bestY) {
          bestY = mouth;
          cupIndex = i;
        }
      }
    }
    ball.alive = false;
    if (cupIndex >= 0) {
      emit(sim, {
        type: 'cup',
        cup: cups[cupIndex],
        cupIndex: cupIndex,
        value: cups[cupIndex].value,
        valueMul: fin(ball.valueMul) || 1,
        x: ball.x,
        y: f.y + f.h,
        ball: ball,
      });
    } else {
      emit(sim, { type: 'drain', x: ball.x, y: f.y + f.h, ball: ball });
    }
  }

  // One fixed step (1/60 s) over every live ball. Returns the count of balls still in flight.
  function stepBalls(sim, dt) {
    const balls = sim.balls;
    if (!balls || !balls.length) return 0;
    const phys = config().physics;
    const f = board().field;
    const cupRowY = Math.min(board().cupY, f.y + f.h - board().cupHeight);
    const wind = sim.wind || {};
    const windForce = fin(wind.force);
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
      const prevY = ball.y;

      ball.vy += phys.gravity * dt;
      ball.vx += windForce * dt;
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

      // Ball dripped below the cup row without registering: count as a drain.
      if (ball.alive) {
        const crossed = prevY + ball.r * 0.5 < cupRowY && ball.y + ball.r * 0.5 >= cupRowY;
        if (crossed || ball.y - ball.r > f.y + f.h) resolveCupRow(sim, ball, prevY);
      }

      if (ball.alive) {
        ball.age = fin(ball.age) + dt;
        if (ball.age > config().cascade.ballLife) {
          ball.alive = false;
          emit(sim, { type: 'expire', x: ball.x, y: ball.y, ball: ball });
        } else {
          alive += 1;
        }
      }
      pushTrail(ball);
    }

    return alive;
  }

  globalThis.PB_Physics = {
    makeBall: makeBall,
    stepBalls: stepBalls,
    collideGates: collideGates,
    resolveCupRow: resolveCupRow,
  };
})();
