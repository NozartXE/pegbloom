// Draws the render-only fireworks of the cascade: floating score text, bloom petal bursts, peg sparkles, pop rings and screen shake.
(function () {
  if (typeof globalThis.PB_Fx === 'object' && globalThis.PB_Fx !== null) return;

  const W = 1280;
  const H = 800;
  const MAX_PARTICLES = 320;
  const FLOATER_LIFE = 68;
  const BLOOM_LIFE = 54;
  const SPARK_LIFE = 26;
  const RING_LIFE = 30;
  const MAX_SEEN = 96;

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

  // Shared helpers from board.js, with safe fallbacks if this file ever loads alone.
  function helper(name) {
    const b = globalThis.PB_Board;
    return b && typeof b[name] === 'function' ? b[name] : null;
  }

  function mix(hex, toward, amount) {
    const f = helper('mixHex');
    return f ? f(hex, toward, amount) : hex;
  }

  function rgba(hex, a) {
    const f = helper('rgba');
    return f ? f(hex, a) : hex;
  }

  function text(ctx, str, x, y, size, spec) {
    const f = helper('text');
    if (f) return f(ctx, str, x, y, size, spec);
    ctx.save();
    ctx.font = 'bold ' + Math.round(size) + 'px "Arial Narrow", Impact, sans-serif';
    ctx.fillStyle = (spec && spec.fill) || '#2B2118';
    if (spec && spec.align) ctx.textAlign = spec.align;
    if (spec && spec.baseline) ctx.textBaseline = spec.baseline;
    ctx.fillText(String(str), x, y);
    ctx.restore();
  }

  // Colour first so the ink outline does not get drawn over the fill.
  function outlined(ctx, str, x, y, size, fill) {
    const f = helper('text');
    const p = palette();
    if (f) return f(ctx, str, x, y, size, { align: 'center', fill: fill, stroke: p.ink, strokeW: Math.max(3, size * 0.26) });
    text(ctx, str, x, y, size, { align: 'center', fill: fill });
  }

  // Board field interior (from PB_CONFIG): floaters are laid out inside it, so
  // score text never runs under the side HUD panels or off the board's edge.
  function fieldRect() {
    const c = globalThis.PB_CONFIG;
    const f = c && c.board && c.board.field;
    return f ? { x: f.x, y: f.y, w: f.w, h: f.h } : { x: 368, y: 150, w: 544, h: 520 };
  }

  // One floater's natural layout: where it wants to sit before separation.
  function floaterLayout(ctx, item, age, t, tick) {
    const p = palette();
    const kind = item.colour || 'gold';
    const fill = p[kind] || (kind === 'ink' ? p.ink : kind);
    const size = item.big ? 36 : 24;
    const si = num(item.seedIndex, 0);
    const rise = 46 * (1 - Math.pow(1 - t, 2)) * (0.85 + (si % 3) * 0.15);
    const bob = Math.sin(tick * 0.09 + age * 0.3) * 1.6;
    const x = num(item.x, W * 0.5) + (((si * 37) % 5) - 2) * 16;
    const y = num(item.y, H * 0.5) + 22 - rise + bob - (si % 3) * (item.big ? 30 : 20);
    const str = String(item.text == null ? '' : item.text);
    const fit = helper('fitText');
    const maxW = item.big ? 560 : 330;
    let s = size;
    if (fit) s = fit(ctx, str, maxW, size, item.big ? 24 : 16);
    const meas = helper('measure');
    const w = meas ? meas(ctx, str, s, 'bold') : str.length * s * 0.55;
    return { x: x, y: y, size: s, w: w, str: str, fill: fill };
  }

  function floaters(ctx, item, age, t, tick) {
    const p = palette();
    const L = floaterLayout(ctx, item, age, t, tick);
    const fade = t < 0.72 ? 1 : 1 - (t - 0.72) / 0.28;
    const pop = t < 0.12 ? 0.6 + (t / 0.12) * 0.4 : 1;
    const x = typeof item._lx === 'number' ? item._lx : L.x;
    const y = typeof item._ly === 'number' ? item._ly : L.y;
    ctx.save();
    ctx.globalAlpha = clamp(fade, 0, 1);
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.rotate(clamp(num(item.tilt, 0), -0.05, 0.05));
    // Backing pill: every floater sits on a paper chip with an ink rim, so its
    // text can never smear into the pegs and petals behind it.
    const rr = helper('roundRect');
    const rrp = helper('roundRectPath');
    const pw = L.w + 24;
    const ph = L.size + 13;
    if (rr) rr(ctx, -pw / 2, -ph / 2 - 1, pw, ph, ph / 2, rgba(p.paper, 0.94));
    if (rrp) {
      rrp(ctx, -pw / 2, -ph / 2 - 1, pw, ph, ph / 2);
      ctx.lineWidth = item.big ? 3 : 2.2;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
    }
    outlined(ctx, L.str, 0, 0, L.size, L.fill);
    // tiny gold underline so score text reads as a confetti tag rather than plain type
    if (item.big) {
      ctx.beginPath();
      ctx.moveTo(-26, L.size * 0.55);
      ctx.lineTo(26, L.size * 0.55);
      ctx.lineWidth = 3;
      ctx.strokeStyle = p.gold;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- the render-side pool (never touches sim) ----------

  const pool = {
    petals: [],
    sparks: [],
    rings: [],
  };

  function push(list, item) {
    if (list.length < MAX_PARTICLES) list.push(item);
    else list[0] = item;
  }

  // A per-event visual RNG: seeded from the event index, so the same sim tick paints the same confetti.
  function eventRng(item, index, particle) {
    const base = globalThis.PB_Board && typeof globalThis.PB_Board.hash === 'function'
      ? Math.floor(globalThis.PB_Board.hash(index, particle) * 4294967295)
      : (Math.imul(index + 1, 2654435761) + Math.imul(particle + 1, 40503)) >>> 0;
    return globalThis.PB_RNG && typeof globalThis.PB_RNG.create === 'function'
      ? globalThis.PB_RNG.create(base)
      : { next: function () { return 0.5; } };
  }

  function colourFor(item) {
    const p = palette();
    if (item.colour) return item.colour;
    return (item.colourKey && p[item.colourKey]) || p.pink;
  }

  function spawnBloom(item, index) {
    const p = palette();
    const base = colourFor(item);
    const amount = clamp(num(item.amount, 10), 4, 44);
    const x = num(item.x, W * 0.5);
    const y = num(item.y, H * 0.6);
    const tints = [base, mix(base, p.paper, 0.4), p.gold, p.pink];
    for (let i = 0; i < amount; i += 1) {
      const rng = eventRng(item, index, i);
      const a = rng.range(-Math.PI, 0);
      const speed = rng.range(70, 260);
      push(pool.petals, {
        x: x + rng.range(-8, 8),
        y: y + rng.range(-6, 4),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 40,
        spin: rng.range(-0.24, 0.24),
        angle: rng.range(0, Math.PI * 2),
        size: rng.range(3.5, 8),
        colour: tints[i % tints.length],
        life: BLOOM_LIFE + Math.floor(rng.range(-10, 12)),
        age: 0,
      });
    }
    push(pool.rings, { x: x, y: y, r: 6, grow: 3.4, width: 5, colour: base, life: RING_LIFE, age: 0 });
  }

  function spawnSpark(x, y, index, strength) {
    const p = palette();
    const n = clamp(Math.round(2 + num(strength, 1) * 3), 2, 10);
    for (let i = 0; i < n; i += 1) {
      const rng = eventRng({}, index, i + 97);
      const a = rng.range(0, Math.PI * 2);
      const speed = rng.range(40, 150);
      push(pool.sparks, {
        x: x,
        y: y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        size: rng.range(1.6, 3.4),
        colour: i % 3 === 0 ? p.paper : p.gold,
        life: SPARK_LIFE,
        age: 0,
      });
    }
  }

  // Constant-acceleration particle billboard: petal-shaped for blooms, dots for sparks.
  function stepList(list, i, dt) {
    const q = list[i];
    q.age += dt * 60;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vx *= 1 - 1.6 * dt;
    if (q.spin !== undefined) {
      q.vy += 210 * dt;
      q.angle += q.spin * dt * 60;
    } else {
      q.vy += 40 * dt;
    }
    const life = q.life || 1;
    if (q.age >= life) {
      const last = list.length - 1;
      list[i] = list[last];
      list.pop();
      return i - 1;
    }
    return i;
  }

  function drawPetals(ctx) {
    const p = palette();
    for (let i = 0; i < pool.petals.length; i += 1) {
      const q = pool.petals[i];
      const t = clamp(q.age / q.life, 0, 1);
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.95;
      ctx.translate(q.x, q.y);
      ctx.rotate(q.angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, q.size, q.size * 0.56, 0, 0, Math.PI * 2);
      ctx.fillStyle = q.colour;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(p.ink, 0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-q.size * 0.6, 0);
      ctx.lineTo(q.size * 0.6, 0);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = rgba(p.paper, 0.8);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSparks(ctx) {
    for (let i = 0; i < pool.sparks.length; i += 1) {
      const q = pool.sparks[i];
      const t = clamp(q.age / q.life, 0, 1);
      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.size * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = q.colour;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawRings(ctx) {
    const p = palette();
    for (let i = 0; i < pool.rings.length; i += 1) {
      const q = pool.rings[i];
      const t = clamp(q.age / q.life, 0, 1);
      const r = q.r + q.grow * q.age;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1, q.width * (1 - t));
      ctx.strokeStyle = rgba(q.colour, 0.85 * (1 - t));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(q.x, q.y, r * 0.72, 0, Math.PI * 2);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = rgba(p.paper, 0.7 * (1 - t));
      ctx.stroke();
    }
  }

  // ---------- shake ----------

  const shakeTrail = [];
  const seenShakes = [];

  function shakeAmount(sim) {
    return clamp(num(sim && sim.shake, 0), 0, 18);
  }

  // Rises instantly to the event strength, then eases down over ~28 ticks. sim.shake is seen by main
  // to offset the canvas; this shim also works if the sim only pushed the events.
  function feedShakes(sim) {
    if (!sim) return 0;
    if (num(sim.shake, 0) < 0) sim.shake = 0;
    const leftover = [];
    const list = Array.isArray(sim.fx) ? sim.fx : [];
    for (let i = 0; i < list.length; i += 1) {
      const ev = list[i];
      if (!ev || ev.type !== 'shake') continue;
      const amt = clamp(num(ev.amount, 0), 0, 18);
      if (amt > 0) {
        seenShakes.push({ amt: amt, tick: num(sim.tick, 0) });
        sim.shake = Math.max(num(sim.shake, 0), amt);
      }
    }
    if (seenShakes.length) seenShakes.length = 0;
    if (sim.shake > 0) sim.shake = Math.max(0, sim.shake * 0.9 - 0.16);
    shakeTrail.push(num(sim.shake, 0));
    if (shakeTrail.length > 40) shakeTrail.shift();
    return sim.shake;
  }

  // Offset for main's ctx.translate: deterministic hash per tick, never a clock read.
  function shakeOffset(sim) {
    const amount = shakeAmount(sim);
    if (amount < 0.05) return { x: 0, y: 0 };
    const tick = num(sim && sim.tick, 0);
    const h = helper('hash');
    const rx = h ? h(tick, 3) * 2 - 1 : 0;
    const ry = h ? h(tick, 7) * 2 - 1 : 0;
    const k = amount / 9;
    return {
      x: clamp(rx * amount, -10, 10),
      y: clamp(ry * amount * 0.8, -8, 8),
      amount: amount,
      k: k,
    };
  }

  // The subtle red edge flash that goes with a strong shake (kept light, never a dark vignette).
  function shakeTint(ctx, sim) {
    const amount = shakeAmount(sim);
    if (amount < 2.5) return;
    const p = palette();
    const k = clamp((amount - 2.5) / 12, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.16 * k;
    ctx.lineWidth = 22;
    ctx.strokeStyle = p.coral;
    ctx.strokeRect(-4, -4, W + 8, H + 8);
    ctx.restore();
  }

  // ---------- queue handling ----------

  // Items pulled from sim.fx are held here only as data copies, with their spawn tick and index,
  // so the sim can clear its queue at any time without cutting a burst short.
  const floatQueue = [];
  const emitted = [];
  const seen = [];
  let spawnSerial = 0;

  function itemKey(ev, tick) {
    return String(ev.type) + '|' + String(ev.text == null ? '' : ev.text) + '|' + Math.round(num(ev.x, 0)) + '|' + Math.round(num(ev.y, 0)) + '|' + tick;
  }

  function emitFrom(ev, tick, index) {
    if (!ev || typeof ev !== 'object') return;
    if (ev.type === 'floater' && ev.text != null) {
      floatQueue.push({
        x: num(ev.x, W * 0.5),
        y: num(ev.y, H * 0.5),
        text: String(ev.text),
        colour: ev.colour,
        big: ev.big === true,
        born: tick,
        seedIndex: spawnSerial++,
        tilt: (index % 2 === 0 ? 1 : -1) * 0.02,
      });
      if (floatQueue.length > MAX_SEEN) floatQueue.shift();
    } else if (ev.type === 'bloom') {
      spawnBloom(ev, spawnSerial++, index);
      emitted.push({ type: 'bloom', tick: tick, x: num(ev.x, W * 0.5), y: num(ev.y, H * 0.6) });
    } else if (ev.type === 'pegHit' || ev.type === 'sparkle') {
      spawnSpark(num(ev.x, W * 0.5), num(ev.y, H * 0.5), spawnSerial++, num(ev.strength, 1));
    }
    if (emitted.length > 48) emitted.shift();
  }

  // Called by main right after stepSim: drains sim.fx so every event is drawn exactly once.
  function consume(sim) {
    if (!sim || !Array.isArray(sim.fx)) return 0;
    const tick = num(sim.tick, 0);
    let n = 0;
    for (let i = 0; i < sim.fx.length; i += 1) {
      const ev = sim.fx[i];
      if (!ev) continue;
      if (ev.type === 'shake') {
        const amt = clamp(num(ev.amount, 0), 0, 18);
        if (amt > 0) sim.shake = Math.max(num(sim.shake, 0), amt);
        n += 1;
        continue;
      }
      const key = itemKey(ev, tick);
      let dup = false;
      for (let k = seen.length - 1; k >= 0; k -= 1) {
        if (seen[k].key === key && tick - seen[k].tick < 4) {
          dup = true;
          break;
        }
      }
      if (dup) continue;
      seen.push({ key: key, tick: tick });
      if (seen.length > 64) seen.shift();
      emitFrom(ev, tick, i);
      n += 1;
    }
    sim.fx.length = 0;
    return n;
  }

  // Advances floaters, particles and shake. Safe to call more or less than once per tick.
  function step(sim) {
    const tick = num(sim && sim.tick, 0);
    for (let i = floatQueue.length - 1; i >= 0; i -= 1) if (tick - floatQueue[i].born > FLOATER_LIFE + 6) floatQueue.splice(i, 1);
    if (pool && pool.petals) {
      for (let i = pool.petals.length - 1; i >= 0; i -= 1) stepList(pool.petals, i, 1 / 60);
      for (let i = pool.sparks.length - 1; i >= 0; i -= 1) stepList(pool.sparks, i, 1 / 60);
      for (let i = pool.rings.length - 1; i >= 0; i -= 1) stepList(pool.rings, i, 1 / 60);
    }
    feedShakes(sim);
  }

  function stepParticlesOnly(dt) {
    for (let i = pool.petals.length - 1; i >= 0; i -= 1) stepList(pool.petals, i, dt);
    for (let i = pool.sparks.length - 1; i >= 0; i -= 1) stepList(pool.sparks, i, dt);
    for (let i = pool.rings.length - 1; i >= 0; i -= 1) stepList(pool.rings, i, dt);
  }

  // ---------- event triggers the physics does not push itself ----------

  // A brass tick when a peg lights: looked up from the tile at the event, never owned by the sim.
  function sparkPegs(sim, tick) {
    const pegs = sim && sim.pegs;
    if (!Array.isArray(pegs) || !pegs.length) return;
    const grid = sim.pegGrid;
    let litNow = 0;
    for (let i = 0; i < pegs.length; i += 1) if (pegs[i] && num(pegs[i].lit, 0) > 0) litNow += 1;
    const prev = num(prevLit, -1);
    prevLit = litNow;
    if (prev < 0 || litNow <= prev) return;
    let budget = Math.min(6, litNow - prev);
    for (let i = pegs.length - 1; i >= 0 && budget > 0; i -= 1) {
      const peg = pegs[i];
      if (!peg || num(peg.lit, 0) <= 0) continue;
      const key = 'lit' + i;
      if (litSeen[key]) continue;
      litSeen[key] = tick;
      spawnSpark(num(peg.x, 0), num(peg.y, 0), i + 1000, peg.golden ? 1.8 : 1);
      budget -= 1;
    }
    if (grid && grid.rows) {
      // prune the seen table when the board resets (a shower's fresh pegs all start unlit)
      for (const k in litSeen) if (tick - litSeen[k] > 120) delete litSeen[k];
    }
  }

  let prevLit = -1;
  const litSeen = {};

  function resetPegLights() {
    prevLit = -1;
    for (const k in litSeen) delete litSeen[k];
  }

  // ---------- main draw ----------

  function drawFloaters(ctx, sim) {
    const tick = num(sim && sim.tick, 0);
    const f = fieldRect();
    const placed = [];
    for (let i = 0; i < floatQueue.length; i += 1) {
      const item = floatQueue[i];
      const age = tick - item.born;
      if (age < 0 || age > FLOATER_LIFE) {
        delete item._lx;
        delete item._ly;
        continue;
      }
      const t = age / FLOATER_LIFE;
      const L = floaterLayout(ctx, item, age, t, tick);
      const pillW = L.w + 24;
      const pillH = L.size + 17;
      // Clamp the whole pill inside the board field, clear of the HUD panels.
      let cx = L.x;
      const minX = f.x + 8 + pillW / 2;
      const maxX = f.x + f.w - 8 - pillW / 2;
      cx = minX <= maxX ? clamp(cx, minX, maxX) : f.x + f.w / 2;
      let cy = clamp(L.y, f.y + 26, f.y + f.h - 16);
      // Separation pass: no two pills may share the same air. A colliding
      // floater hops up one line at a time until it finds a free slot - this
      // is what kills the overlapping text wall at the cup line.
      for (let hop = 0; hop < 7; hop += 1) {
        let hit = false;
        for (let k = 0; k < placed.length; k += 1) {
          const q = placed[k];
          if (Math.abs(q.x - cx) < (q.w + pillW) / 2 + 6 && Math.abs(q.y - cy) < (q.h + pillH) / 2 + 3) {
            hit = true;
            break;
          }
        }
        if (!hit) break;
        cy -= pillH + 2;
        if (cy < f.y + 26) {
          cy = f.y + 26;
          break;
        }
      }
      placed.push({ x: cx, y: cy, w: pillW, h: pillH });
      item._lx = cx;
      item._ly = cy;
      floaters(ctx, item, age, t, tick);
    }
  }

  // Draws every live effect over the board. sim.fx, when still queued, is consumed here too,
  // so the file works whether main calls consume() or just hands the sim to draw().
  function draw(ctx, sim) {
    if (!ctx) return;
    if (sim && Array.isArray(sim.fx) && sim.fx.length) consume(sim);
    if (sim) {
      stepParticlesOnly(1 / 60);
      sparkPegs(sim, num(sim.tick, 0));
    }
    ctx.save();
    ctx.lineJoin = 'round';
    drawRings(ctx);
    drawSparks(ctx);
    drawPetals(ctx);
    drawFloaters(ctx, sim);
    ctx.restore();
    if (sim) shakeTint(ctx, sim);
  }

  function clear(sim) {
    floatQueue.length = 0;
    emitted.length = 0;
    seen.length = 0;
    if (pool && pool.petals) {
      pool.petals.length = 0;
      pool.sparks.length = 0;
      pool.rings.length = 0;
    }
    if (sim && typeof sim === 'object') sim.shake = 0;
    resetPegLights();
  }

  function stats() {
    return { floaters: floatQueue.length, petals: pool.petals.length, sparks: pool.sparks.length, rings: pool.rings.length };
  }

  globalThis.PB_Fx = {
    draw: draw,
    consume: consume,
    step: step,
    shakeOffset: shakeOffset,
    shakeAmount: shakeAmount,
    shakeTint: shakeTint,
    clear: clear,
    bloom: spawnBloom,
    spark: spawnSpark,
    stats: stats,
  };
})();
