// Draws the dew-spheres and their glow trails, Pina's watering-can dropper, the three petal gates and the contraption overlays on the board.
(function () {
  if (typeof globalThis.PB_Balls === 'object' && globalThis.PB_Balls !== null) return;

  function palette() {
    return globalThis.PB_PALETTE || {
      cream: '#FFF6E9', paper: '#FFFDF6', coral: '#FF7A59', gold: '#FFC53D', sky: '#57B8FF',
      mint: '#4FD8A5', pink: '#FF9FB2', leaf: '#58B368', ink: '#2B2118',
    };
  }

  function config() {
    return globalThis.PB_CONFIG || { board: { field: { x: 368, y: 150, w: 544, h: 520 }, gateLength: 120, cupY: 678 } };
  }

  function board() {
    return config().board || {};
  }

  function field() {
    return board().field || { x: 368, y: 150, w: 544, h: 520 };
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // Shared helpers from board.js, with no-op fallbacks so this file can never throw on load order.
  function helper(name) {
    const b = globalThis.PB_Board;
    return b && typeof b[name] === 'function' ? b[name] : null;
  }

  function mix(hex, toward, amount) {
    const f = helper('mixHex');
    if (f) return f(hex, toward, amount);
    return hex;
  }

  function rgba(hex, a) {
    const f = helper('rgba');
    if (f) return f(hex, a);
    return hex;
  }

  function wave(tick, speed, phase) {
    return Math.sin(num(tick, 0) * num(speed, 0.05) + num(phase, 0));
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const f = helper('roundRectPath');
    if (f) return f(ctx, x, y, w, h, r);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
  }

  function textFit(ctx, str, x, y, maxW, size, opts) {
    const o = opts || {};
    const label = String(str == null ? '' : str);
    let fit = Math.max(6, num(size, 24));
    const floor = Math.max(5, num(o.minSize, 8));
    ctx.save();
    ctx.font = 'bold ' + Math.round(fit) + 'px "Arial Narrow", Impact, sans-serif';
    while (fit > floor && ctx.measureText(label).width > maxW) {
      fit -= 1;
      ctx.font = 'bold ' + Math.round(fit) + 'px "Arial Narrow", Impact, sans-serif';
    }
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'middle';
    if (o.stroke) {
      ctx.lineWidth = num(o.strokeW, 4);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = o.stroke;
      ctx.strokeText(label, x, y);
    }
    ctx.fillStyle = o.fill || '#2B2118';
    ctx.fillText(label, x, y);
    const width = ctx.measureText(label).width;
    ctx.restore();
    return { size: fit, width: width, x: x, y: y };
  }

  function text(ctx, str, x, y, size, opts) {
    const f = helper('text');
    if (f) return f(ctx, str, x, y, size, opts);
    ctx.save();
    ctx.font = 'bold ' + Math.round(size) + 'px "Arial Narrow", Impact, sans-serif';
    ctx.fillStyle = (opts && opts.fill) || '#2B2118';
    if (opts && opts.align) ctx.textAlign = opts.align;
    if (opts && opts.baseline) ctx.textBaseline = opts.baseline;
    ctx.fillText(String(str), x, y);
    ctx.restore();
  }

  function active(sim) {
    return !!(sim && sim.phase !== 'won' && sim.phase !== 'lost' && !sim.over);
  }

  // ---------- trails ----------

  // Each ball's trail as a tapered ribbon: gold for a glowing sphere, pale sky for a spent one,
  // half-alpha for a ghost (splitter) sphere.
  function trail(ctx, ball, sim) {
    const t = ball && ball.trail;
    if (!t || t.length < 2) return;
    const p = palette();
    const ghost = ball.ghost === true;
    const glow = clamp(num(ball.glow, 1), 0, 1);
    const hot = mix(p.gold, p.coral, 0.25);
    const cool = mix(p.sky, p.paper, 0.55);
    const r = num(ball.r, 8);
    ctx.save();
    ctx.globalAlpha = ghost ? 0.42 : 0.9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < t.length; i += 1) {
      const a = t[i - 1];
      const b = t[i];
      if (!a || !b) continue;
      const k = i / t.length;
      const col = glow > 0.5 ? hot : cool;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = Math.max(0.8, r * 1.35 * k);
      ctx.strokeStyle = rgba(col, 0.1 + 0.42 * k);
      ctx.stroke();
      if (glow > 0.5) {
        ctx.lineWidth = Math.max(0.5, r * 0.45 * k);
        ctx.strokeStyle = rgba(p.paper, 0.35 * k);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function trails(ctx, sim) {
    const balls = (sim && sim.balls) || [];
    for (let i = 0; i < balls.length; i += 1) trail(ctx, balls[i], sim);
  }

  // ---------- dew-spheres ----------

  function ball(ctx, b, sim) {
    if (!b) return;
    const p = palette();
    const x = num(b.x, 0);
    const y = num(b.y, 0);
    const r = num(b.r, 8);
    const ghost = b.ghost === true;
    const glow = clamp(num(b.glow, 1), 0, 1);
    const tick = num(sim && sim.tick, 0);
    const rim = glow > 0.5 ? mix(p.sky, p.mint, 0.4) : (ghost ? p.pink : mix(p.sky, p.paper, 0.25));
    const core = p.paper;
    ctx.save();
    ctx.globalAlpha = ghost ? 0.62 : 1;
    // glow halo
    const halo = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 3.1);
    halo.addColorStop(0, rgba(glow > 0.5 ? p.gold : p.sky, 0.36 * (0.55 + glow * 0.45)));
    halo.addColorStop(1, rgba(glow > 0.5 ? p.gold : p.sky, 0));
    ctx.beginPath();
    ctx.arc(x, y, r * 3.1, 0, Math.PI * 2);
    ctx.fillStyle = halo;
    ctx.fill();
    // sphere
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
    g.addColorStop(0, core);
    g.addColorStop(0.62, mix(rim, p.paper, 0.4));
    g.addColorStop(1, rim);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = glow > 0.5 ? p.gold : rgba(p.ink, 0.35);
    ctx.stroke();
    // white core
    ctx.beginPath();
    ctx.arc(x - r * 0.12, y - r * 0.12, r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = rgba(p.paper, 0.95);
    ctx.fill();
    // sparkle: a four-point star that turns with the tick
    const spin = tick * 0.03 + num(b.dropperX, 0) * 0.02 + num(x, 0) * 0.01;
    const spark = 1 + 0.25 * wave(tick, 0.11, num(x, 0) * 0.05);
    ctx.strokeStyle = glow > 0.5 ? p.gold : p.sky;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i += 1) {
      const a = spin + i * Math.PI * 0.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
      ctx.lineTo(x + Math.cos(a) * r * 1.45 * spark, y + Math.sin(a) * r * 1.45 * spark);
      ctx.stroke();
    }
    if (b.captured) {
      ctx.beginPath();
      ctx.arc(x, y, r + 3, 0, Math.PI * 2);
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = rgba(p.mint, 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function balls(ctx, sim) {
    const list = (sim && sim.balls) || [];
    trails(ctx, sim);
    for (let i = 0; i < list.length; i += 1) ball(ctx, list[i], sim);
  }

  // ---------- dropper ----------

  function aimLine(ctx, sim, x, topY) {
    const p = palette();
    const f = field();
    const tick = num(sim.tick, 0);
    ctx.save();
    ctx.lineWidth = 2.4;
    ctx.setLineDash([3, 9]);
    ctx.lineDashOffset = -((tick * 0.9) % 12);
    ctx.strokeStyle = rgba(p.coral, 0.55);
    ctx.beginPath();
    ctx.moveTo(x, topY + 12);
    ctx.lineTo(x, Math.min(f.y + f.h - 8, topY + 270));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function nextPreview(ctx, sim, x, y) {
    const p = palette();
    const stats = sim && sim.stats;
    const left = num(stats && stats.ballsLeft, 0);
    const r = num(board().ballRadius, 8);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = mix(p.paper, p.sky, 0.25);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.sky;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = p.paper;
    ctx.fill();
    ctx.restore();
    textFit(ctx, left > 0 ? 'NEXT' : 'EMPTY', x, y + r + 12, 60, 15, { align: 'center', fill: p.ink, minSize: 9 });
  }

  // Pina's watering-can spout riding the top rail at sim.dropper.x, with dotted aim and preview.
  function dropper(ctx, sim) {
    const p = palette();
    const rail = board().dropperRail || { x: field().x, y: field().y - 46, w: field().w };
    const x = clamp(num(sim && sim.dropper && sim.dropper.x, num(rail.x, 0) + num(rail.w, 0) * 0.5), num(rail.x, 0) - 40, num(rail.x, 0) + num(rail.w, 0) + 40);
    const railY = Math.min(num(rail.y, field().y - 46), field().y - 16);
    const tick = num(sim && sim.tick, 0);
    const cool = sim && sim.dropper && num(sim.dropper.cooldown, 0) > 0;
    ctx.save();
    aimLine(ctx, sim, x, railY);
    // carriage
    roundRectPath(ctx, x - 34, railY - 30, 68, 20, 10);
    ctx.fillStyle = mix(p.mint, p.paper, 0.35);
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - 20, railY - 6, 5, 0, Math.PI * 2);
    ctx.arc(x + 20, railY - 6, 5, 0, Math.PI * 2);
    ctx.fillStyle = p.gold;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    // can body hanging under the carriage
    ctx.beginPath();
    ctx.moveTo(x - 24, railY - 26);
    ctx.lineTo(x - 26, railY + 6);
    ctx.quadraticCurveTo(x, railY + 18, x + 26, railY + 6);
    ctx.lineTo(x + 24, railY - 26);
    ctx.closePath();
    ctx.fillStyle = mix(p.coral, p.paper, 0.2);
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    // handle arc
    ctx.beginPath();
    ctx.arc(x, railY - 28, 13, Math.PI * 1.05, Math.PI * 1.95);
    ctx.lineWidth = 5;
    ctx.strokeStyle = p.leaf;
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    // spout: an angled neck ending in a rose just above the field
    ctx.beginPath();
    ctx.moveTo(x + 20, railY + 2);
    ctx.quadraticCurveTo(x + 32, railY + 16, x + 9, railY + 26);
    ctx.lineWidth = 9;
    ctx.strokeStyle = mix(p.gold, p.paper, 0.25);
    ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    ctx.beginPath();
    roundRectPath(ctx, x + 2, railY + 24, 16, 7, 3);
    ctx.fillStyle = p.gold;
    ctx.fill();
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    // glass water level in the can
    ctx.beginPath();
    roundRectPath(ctx, x - 16, railY - 2, 32, 8, 4);
    ctx.fillStyle = rgba(p.sky, 0.8);
    ctx.fill();
    // ready droplet under the rose, bobbing when the dropper can fire
    const bob = cool ? 0 : wave(tick, 0.14, 0) * 2;
    const dy = railY + 44 + bob;
    ctx.beginPath();
    ctx.moveTo(x + 10, dy - 9);
    ctx.quadraticCurveTo(x + 19, dy - 1, x + 10, dy + 5);
    ctx.quadraticCurveTo(x + 1, dy - 1, x + 10, dy - 9);
    ctx.fillStyle = cool ? rgba(p.sky, 0.45) : p.sky;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 7, dy - 1, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = p.paper;
    ctx.fill();
    nextPreview(ctx, sim, x - 14, railY + 46);
    ctx.restore();
  }

  // ---------- petal gates ----------

  function gun(ctx, n, x, y, w, h, colour) {
    const p = palette();
    roundRectPath(ctx, x - w * 0.5, y - h * 0.5, w, h, h * 0.45);
    ctx.fillStyle = colour || p.gold;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
  }

  function gate(ctx, g, i, sim) {
    if (!g || g.on === false) return;
    const p = palette();
    const len = num(g.len, num(board().gateLength, 120));
    const half = len * 0.5;
    const angle = num(g.angle, Math.PI * 0.5);
    const hinge = num(g.hinge, 1);
    const tick = num(sim && sim.tick, 0);
    const target = num(g.target, angle);
    const moving = Math.abs(target - angle) > 0.004;
    ctx.save();
    ctx.translate(num(g.x, 0), num(g.y, 0));
    ctx.rotate(angle);
    // draw the petal on its hinge side: [0, half] when hinge > 0, [-half, 0] mirrored
    const x0 = hinge > 0 ? 0 : -half;
    const x1 = hinge > 0 ? half : 0;
    // soft highlight arc above the paddle so it reads as catching dew
    ctx.beginPath();
    ctx.moveTo(x0 + 8, -6);
    ctx.lineTo(x1, -6);
    ctx.lineWidth = 7;
    ctx.strokeStyle = rgba(p.paper, 0.7);
    ctx.stroke();
    // body: a long leaf petal with a round far tip
    ctx.beginPath();
    ctx.moveTo(x0, 7);
    ctx.quadraticCurveTo((x0 + x1) * 0.5, 14, x1 + (hinge > 0 ? -6 : 6), 4);
    ctx.quadraticCurveTo(x1 + (hinge > 0 ? 12 : -12), 0, x1 + (hinge > 0 ? -6 : 6), -4);
    ctx.quadraticCurveTo((x0 + x1) * 0.5, -14, x0, -7);
    ctx.closePath();
    ctx.fillStyle = p.pink;
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    // gold rib along the petal
    ctx.beginPath();
    ctx.moveTo(x0 + 4, 0);
    ctx.lineTo(x1 - 10, 0);
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.gold;
    ctx.stroke();
    // ribs
    for (let k = 1; k <= 4; k += 1) {
      const rx = x0 + ((x1 - x0) * k) / 5;
      ctx.beginPath();
      ctx.moveTo(rx, -7);
      ctx.lineTo(rx + (hinge > 0 ? 4 : -4), 0);
      ctx.lineTo(rx, 7);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = rgba(p.ink, 0.35);
      ctx.stroke();
    }
    ctx.restore();

    // pivot flower at the centre
    ctx.save();
    ctx.translate(num(g.x, 0), num(g.y, 0));
    if (moving) {
      ctx.beginPath();
      ctx.arc(0, 0, 16 + wave(tick, 0.4, i) * 2, 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.gold, 0.3);
      ctx.fill();
    }
    ctx.fillStyle = p.paper;
    for (let k = 0; k < 6; k += 1) {
      const a = k * Math.PI / 3 + 0.3;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 8, Math.sin(a) * 8, 6, 3.6, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = p.gold;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    ctx.restore();

    // key hint and degree marker at the petal tip
    const tipX = num(g.x, 0) + Math.cos(angle) * half * (hinge > 0 ? 1 : -1);
    const tipY = num(g.y, 0) + Math.sin(angle) * half * (hinge > 0 ? 1 : -1);
    const offX = Math.cos(angle) * 16 * (hinge > 0 ? 1 : -1);
    const offY = 18;
    gun(ctx, 9, tipX + offX - offX * 0.2, tipY + offY, 18, 18, p.mint);
    text(ctx, String(i + 1), tipX + offX - offX * 0.2, tipY + offY + 1, 13, { align: 'center', fill: p.ink });
  }

  function gates(ctx, sim) {
    const list = (sim && sim.gates) || [];
    for (let i = 0; i < list.length; i += 1) gate(ctx, list[i], i, sim);
  }

  // ---------- contraption overlays ----------

  // Draws one placed contraption. Board sockets call this as the filled-socket hook.
  function contraption(ctx, sock, sim) {
    if (!sock || !sock.kind) return;
    const p = palette();
    const x = num(sock.x, 0);
    const y = num(sock.y, 0);
    const tick = num(sim && sim.tick, 0);
    const level = clamp(num(sock.level, 1), 1, 3);
    ctx.save();
    if (sock.kind === 'bloomBumper') {
      const r = num(sock.bumperR, 13);
      const flash = num(sock.flash, 0);
      ctx.beginPath();
      ctx.arc(x, y, r + 5 + wave(tick, 0.07, x) * 2, 0, Math.PI * 2);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = rgba(p.coral, 0.55);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r + 1, 0, Math.PI * 2);
      ctx.fillStyle = mix(p.coral, p.paper, 0.15);
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.48, 0, Math.PI * 2);
      ctx.fillStyle = p.gold;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - r * 0.35, y - r * 0.38, r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = p.paper;
      ctx.fill();
      if (flash > 0.03) {
        ctx.beginPath();
        ctx.arc(x, y, r + 5 + (1 - flash) * 18, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = rgba(p.gold, flash);
        ctx.stroke();
      }
    } else if (sock.kind === 'splitterTulip') {
      const w = num(sock.w, 34);
      const h = num(sock.h, 18);
      ctx.beginPath();
      ctx.ellipse(x, y + h * 0.2, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = mix(p.pink, p.paper, 0.15);
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
      for (let k = -1; k <= 1; k += 1) {
        ctx.beginPath();
        ctx.ellipse(x + k * w * 0.24, y - h * 0.18, w * 0.15, h * 0.42, k * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = k === 0 ? p.coral : p.pink;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y - h * 0.1, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = p.gold;
      ctx.fill();
    } else if (sock.kind === 'magnetTulip' || sock.kind === 'honeyCatch' || sock.kind === 'dewBell') {
      const glow = clamp(num(sock.magnetGlow, 0), 0, 1);
      const radius = 44 + level * 12;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.lineWidth = 2.2;
      ctx.setLineDash([9, 8]);
      ctx.lineDashOffset = -tick * 0.7;
      ctx.strokeStyle = rgba(p.sky, 0.65 + glow * 0.3);
      ctx.stroke();
      ctx.setLineDash([]);
      if (glow > 0.02) {
        ctx.beginPath();
        ctx.arc(x, y, radius * (0.3 + 0.2 * wave(tick, 0.2, 0)), 0, Math.PI * 2);
        ctx.fillStyle = rgba(p.sky, 0.18 * glow + 0.06);
        ctx.fill();
      }
      for (let k = 0; k < 3; k += 1) {
        const a = tick * 0.04 + k * (Math.PI * 2 / 3);
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * radius * 0.7, y + Math.sin(a) * radius * 0.7, 3, 0, Math.PI * 2);
        ctx.fillStyle = p.mint;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, 13, Math.PI, 0);
      ctx.quadraticCurveTo(x, y + 14, x - 13, y);
      ctx.closePath();
      ctx.fillStyle = p.leaf;
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y - 3, 4, 0, Math.PI * 2);
      ctx.fillStyle = p.gold;
      ctx.fill();
    } else if (sock.kind === 'fanLeaf') {
      const half = num(sock.half, 0);
      if (half > 0) {
        const f = field();
        const bandH = f.h - 40;
        ctx.beginPath();
        roundRectPath(ctx, x - half, f.y + 16, half * 2, bandH, 16);
        ctx.fillStyle = rgba(p.mint, 0.13);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.strokeStyle = rgba(p.leaf, 0.55);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (let k = 0; k < 3; k += 1) {
        const a = 0.9 + wave(tick, 0.16, k * 1.4) * 0.35 + k * 0.12;
        ctx.save();
        ctx.translate(x + (k - 1) * 7, y + 6);
        ctx.rotate(a - 0.6);
        ctx.beginPath();
        ctx.ellipse(0, -16, 8, 19, 0, 0, Math.PI * 2);
        ctx.fillStyle = k === 1 ? p.leaf : p.mint;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = p.ink;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 2);
        ctx.lineTo(0, -30);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = rgba(p.ink, 0.4);
        ctx.stroke();
        ctx.restore();
      }
    } else if (sock.kind === 'springPad' || sock.kind === 'mossCushion') {
      const pads = (sim && sim.springPads) || [];
      let armed = true;
      for (let i = 0; i < pads.length; i += 1) if (pads[i] && pads[i].socket === sock) armed = pads[i].armed !== false;
      ctx.beginPath();
      ctx.ellipse(x, y + 9, 18, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.ink, 0.12);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 13, y + 6);
      for (let i = 0; i <= 14; i += 1) {
        const t = i / 14;
        const yy = y + 6 - t * 22;
        const xx = x + Math.sin(t * Math.PI * 4) * 9;
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.lineWidth = 3;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = p.gold;
      ctx.stroke();
      roundRectPath(ctx, x - 18, y - 20, 36, 8, 4);
      ctx.fillStyle = armed ? p.mint : mix(p.coral, p.paper, 0.35);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
    }
    ctx.restore();
  }

  function contraptions(ctx, sim) {
    const list = (sim && sim.sockets) || [];
    for (let i = 0; i < list.length; i += 1) if (list[i] && list[i].kind) contraption(ctx, list[i], sim);
  }

  // ---------- main ----------

  function draw(ctx, sim) {
    if (!ctx) return;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (active(sim)) contraptions(ctx, sim);
    gates(ctx, sim);
    balls(ctx, sim);
    dropper(ctx, sim);
    ctx.restore();
  }

  globalThis.PB_Balls = {
    draw: draw,
    balls: balls,
    trails: trails,
    gates: gates,
    dropper: dropper,
    contraptions: contraptions,
    contraption: contraption,
  };
})();
