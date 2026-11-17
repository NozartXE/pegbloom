// Draws the four garden pests (CLINGMOTH, DRAINGRUB, PETALBAT, HUSKLING) and the giant Duskfather boss with his HP bar.
(function () {
  if (typeof globalThis.PB_Sprites === 'object' && globalThis.PB_Sprites !== null) return;

  const WING_SPAN = 76;

  function palette() {
    return globalThis.PB_PALETTE || {
      cream: '#FFF6E9', paper: '#FFFDF6', coral: '#FF7A59', gold: '#FFC53D', sky: '#57B8FF',
      mint: '#4FD8A5', pink: '#FF9FB2', leaf: '#58B368', ink: '#2B2118',
    };
  }

  function config() {
    return globalThis.PB_CONFIG || { board: { field: { x: 368, y: 150, w: 544, h: 520 } }, score: { bossHP: 24 } };
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

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

  function roundRect(ctx, x, y, w, h, r, fill) {
    const f = helper('roundRect');
    if (f) return f(ctx, x, y, w, h, r, fill);
    ctx.fillRect(x, y, w, h);
    return ctx;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const f = helper('roundRectPath');
    if (f) return f(ctx, x, y, w, h, r);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
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

  function textFit(ctx, str, x, y, maxW, size, spec) {
    const f = helper('textFit');
    if (f) return f(ctx, str, x, y, maxW, size, spec);
    return text(ctx, str, x, y, size, spec);
  }

  // The sim's wing/flap counters are already in radians-ish; the renderer only adds a sine.
  function flap(tick, speed, phase) {
    return Math.sin(num(tick, 0) * num(speed, 0.15) + num(phase, 0));
  }

  function isCling(p) {
    return p && (p.state === 'cling' || (p.peg && p.state !== 'enter' && p.state !== 'crawl' && p.state !== 'fly' && p.state !== 'leave' && p.state !== 'reenter'));
  }

  // ---------- CLINGMOTH / HUSKLING ----------

  // A round moth body with four soft wings, ink spots and feather antennae. When it is clinging the
  // wings fold up over the peg, so a deadened peg reads as occupied at thumbnail size.
  function moth(ctx, p, kind) {
    const pal = palette();
    const husk = kind === 'huskling';
    const x = num(p.x, 0);
    const y = num(p.y, 0);
    const r = num(p.r, husk ? 18 : 15);
    const stuck = isCling(p);
    const tick = num(p.stateTicks, 0) + num(p.age, 0);
    const beat = stuck ? 0.12 + flap(tick, 0.2, 1.7) * 0.06 : 0.62 + flap(tick, 0.42, p.id || 0) * 0.3;
    const s = r / 15;
    const flash = clamp(num(p.hitFlash, 0), 0, 1);
    const wingPetal = husk ? mix(pal.cream, pal.gold, 0.16) : pal.pink;
    const wingEdge = husk ? pal.coral : pal.coral;
    ctx.save();
    ctx.translate(x, y);
    // little contact shadow so it sits on the garden, not floating
    ctx.beginPath();
    ctx.ellipse(0, r * 0.95, r * 0.95, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(pal.ink, 0.1);
    ctx.fill();
    const wings = [
      { dx: -1.05, dy: -0.45, rx: 0.95, ry: 0.62, rot: -0.55, col: mix(wingPetal, pal.paper, 0.15) },
      { dx: 1.05, dy: -0.45, rx: 0.95, ry: 0.62, rot: 0.55, col: mix(wingPetal, pal.paper, 0.15) },
      { dx: -0.86, dy: 0.32, rx: 0.76, ry: 0.5, rot: -0.2, col: wingPetal },
      { dx: 0.86, dy: 0.32, rx: 0.76, ry: 0.5, rot: 0.2, col: wingPetal },
    ];
    for (let i = 0; i < wings.length; i += 1) {
      const w = wings[i];
      const side = w.dx < 0 ? -1 : 1;
      const lift = stuck ? 0.35 : 0;
      ctx.save();
      ctx.translate(w.dx * r * (stuck ? 0.6 : 0.9), w.dy * r + lift * r * 0.4);
      ctx.rotate(w.rot + side * beat * (stuck ? 0.12 : 0.38) * (i < 2 ? 1 : 0.7));
      ctx.beginPath();
      ctx.ellipse(side * r * 0.35, 0, w.rx * r, w.ry * r, side * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = w.col;
      ctx.fill();
      ctx.lineWidth = 2 * s;
      ctx.strokeStyle = pal.ink;
      ctx.stroke();
      // ink spots on the upper wings
      if (i < 2) {
        ctx.beginPath();
        ctx.arc(side * r * 0.55, -r * 0.05, r * 0.16, 0, Math.PI * 2);
        ctx.arc(side * r * 0.9, r * 0.02, r * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = pal.ink;
        ctx.fill();
        // warm margin stripe, keeps the wings from reading grey
        ctx.beginPath();
        ctx.ellipse(side * r * 0.4, r * 0.24, w.rx * r * 0.7, r * 0.1, side * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = rgba(wingEdge, 0.35);
        ctx.fill();
      }
      ctx.restore();
    }
    // body: fuzzy cream barrel with coral bands; huskling wears a coral shell arc
    ctx.beginPath();
    ctx.ellipse(0, r * 0.08, r * 0.42, r * 0.66, 0, 0, Math.PI * 2);
    ctx.fillStyle = husk ? mix(pal.cream, pal.coral, 0.12) : pal.cream;
    ctx.fill();
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.ellipse(0, r * 0.08 + i * r * 0.24, r * 0.3, r * 0.08, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(pal.coral, 0.8);
      ctx.fill();
    }
    if (husk) {
      // the huskling's stubborn shell: a thick coral arc over the back
      ctx.beginPath();
      ctx.arc(0, r * 0.02, r * 0.62, Math.PI * 0.12, Math.PI * 0.88, true);
      ctx.lineWidth = r * 0.3;
      ctx.strokeStyle = pal.coral;
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.ink;
      ctx.beginPath();
      ctx.arc(0, r * 0.02, r * 0.77, Math.PI * 0.15, Math.PI * 0.85, true);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, r * 0.02, r * 0.47, Math.PI * 0.18, Math.PI * 0.82, true);
      ctx.stroke();
      // shell ridge ticks
      for (let i = 0; i < 3; i += 1) {
        const a = Math.PI * (0.28 + i * 0.22);
        ctx.beginPath();
        ctx.moveTo(-Math.cos(a) * r * 0.78, r * 0.02 - Math.sin(a) * r * 0.78);
        ctx.lineTo(-Math.cos(a) * r * 0.46, r * 0.02 - Math.sin(a) * r * 0.46);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = pal.ink;
        ctx.stroke();
      }
    }
    // head
    ctx.beginPath();
    ctx.arc(0, -r * 0.62, r * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = husk ? pal.gold : pal.cream;
    ctx.fill();
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    // eyes: two ink dots with paper glints
    ctx.beginPath();
    ctx.arc(-r * 0.14, -r * 0.64, r * 0.075, 0, Math.PI * 2);
    ctx.arc(r * 0.14, -r * 0.64, r * 0.075, 0, Math.PI * 2);
    ctx.fillStyle = pal.ink;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-r * 0.16, -r * 0.67, r * 0.025, 0, Math.PI * 2);
    ctx.arc(r * 0.12, -r * 0.67, r * 0.025, 0, Math.PI * 2);
    ctx.fillStyle = pal.paper;
    ctx.fill();
    // feather antennae
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, -r * 0.92);
    ctx.quadraticCurveTo(-r * 0.4, -r * 1.35, -r * 0.7, -r * 1.28);
    ctx.moveTo(r * 0.12, -r * 0.92);
    ctx.quadraticCurveTo(r * 0.4, -r * 1.35, r * 0.7, -r * 1.28);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-r * 0.72, -r * 1.28, r * 0.08, 0, Math.PI * 2);
    ctx.arc(r * 0.72, -r * 1.28, r * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = pal.gold;
    ctx.fill();
    if (flash > 0.05) {
      ctx.beginPath();
      ctx.arc(0, 0, r * (1.5 + (1 - flash) * 0.6), 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(pal.paper, flash);
      ctx.stroke();
    }
    ctx.restore();
    if (husk && p.hp != null) hpPips(ctx, x, y - r * 1.9, r * 2.2, num(p.hp, 2), num(p.maxHp, 2));
  }

  // Two small coral/paper pips above a two-hit pest.
  function hpPips(ctx, x, y, w, hp, maxHp) {
    const pal = palette();
    const n = clamp(Math.round(maxHp), 1, 4);
    const gap = 4;
    const pipW = (w - gap * (n - 1)) / n;
    for (let i = 0; i < n; i += 1) {
      roundRect(ctx, x - w * 0.5 + i * (pipW + gap), y - 3, pipW, 6, 3, i < hp ? pal.coral : pal.paper);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = pal.ink;
      roundRectPath(ctx, x - w * 0.5 + i * (pipW + gap), y - 3, pipW, 6, 3);
      ctx.stroke();
    }
  }

  // ---------- DRAINGRUB ----------

  // A segmented mint grub crawling the bottom rim: four bubble segments, ink rings, tiny gold bristles.
  function grub(ctx, p) {
    const pal = palette();
    const x = num(p.x, 0);
    const y = num(p.y, 0);
    const r = num(p.r, 14);
    const dir = num(p.dir, 1) >= 0 ? 1 : -1;
    const wig = flap(num(p.stateTicks, 0), 0.12, p.id || 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.ellipse(0, r * 0.62, r * 1.7, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(pal.ink, 0.12);
    ctx.fill();
    // tail to head: the head faces the direction of travel
    const segs = [
      { dx: -1.5, r: 0.6 },
      { dx: -0.82, r: 0.78 },
      { dx: -0.12, r: 0.9 },
      { dx: 0.62, r: 1.0 },
    ];
    for (let i = 0; i < segs.length; i += 1) {
      const seg = segs[i];
      const sx = seg.dx * r * dir;
      const sy = Math.sin((p.stateTicks || 0) * 0.14 + i * 1.1) * r * 0.16 - (i === 3 ? r * 0.12 : 0);
      ctx.beginPath();
      ctx.arc(sx, sy - r * 0.12, r * seg.r, 0, Math.PI * 2);
      ctx.fillStyle = i === 3 ? mix(pal.mint, pal.gold, 0.12) : i % 2 === 0 ? pal.mint : mix(pal.mint, pal.paper, 0.18);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.ink;
      ctx.stroke();
      // belly line highlight
      ctx.beginPath();
      ctx.arc(sx - r * 0.18, sy - r * 0.28, r * seg.r * 0.42, Math.PI * 0.9, Math.PI * 1.6);
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(pal.paper, 0.75);
      ctx.stroke();
      if (i > 0 && i < 3) {
        // little gold bristles
        ctx.beginPath();
        ctx.moveTo(sx, sy - r * seg.r * 0.9);
        ctx.lineTo(sx - r * 0.16, sy - r * seg.r * 1.35);
        ctx.moveTo(sx + r * 0.2, sy - r * seg.r * 0.8);
        ctx.lineTo(sx + r * 0.34, sy - r * seg.r * 1.3);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = pal.gold;
        ctx.stroke();
      }
    }
    // face on the head segment
    const hx = 0.62 * r * dir;
    const hy = -r * 0.22;
    ctx.beginPath();
    ctx.arc(hx + r * 0.18 * dir, hy - r * 0.02, r * 0.11, 0, Math.PI * 2);
    ctx.fillStyle = pal.ink;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx + r * 0.5 * dir, hy + r * 0.18, r * 0.18, Math.PI * 1.1, Math.PI * 1.9);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    // two feelers sweeping forward
    ctx.beginPath();
    ctx.moveTo(hx + r * 0.55 * dir, hy - r * 0.6);
    ctx.quadraticCurveTo(hx + r * 0.95 * dir, hy - r * 1.15 + wig * 2, hx + r * 1.25 * dir, hy - r * 0.95);
    ctx.moveTo(hx + r * 0.35 * dir, hy - r * 0.72);
    ctx.quadraticCurveTo(hx + r * 0.7 * dir, hy - r * 1.3 - wig * 2, hx + r * 1.05 * dir, hy - r * 1.2);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    ctx.restore();
  }

  // ---------- PETALBAT ----------

  // A pink bat with wide petal-shaped wings that flap on a sine of the tick; petal rib veins sell the garden theme.
  function bat(ctx, p, tick) {
    const pal = palette();
    const x = num(p.x, 0);
    const y = num(p.y, 0);
    const r = num(p.r, 17);
    const t = num(tick, 0);
    const fl = Math.sin(t * 0.3 + num(p.phase, 0)) * 0.6 + 0.4;
    const dir = num(p.dir, 1) >= 0 ? 1 : -1;
    const flash = clamp(num(p.hitFlash, num(p.knockPop, 0)), 0, 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    // wide petal wings: each is a rounded petal leaning up when the flap is high
    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.translate(side * r * 0.5, -r * 0.1);
      ctx.rotate(side * (-0.75 - fl * 0.45));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * r * 1.25, -r * 1.05 - fl * r * 0.25, side * r * 2.15, -r * 0.28);
      ctx.quadraticCurveTo(side * r * 1.75, r * 0.62, side * r * 0.55, r * 0.5);
      ctx.quadraticCurveTo(side * r * 0.2, r * 0.2, 0, 0);
      ctx.closePath();
      ctx.fillStyle = side < 0 ? pal.pink : mix(pal.pink, pal.paper, 0.18);
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = pal.ink;
      ctx.stroke();
      // petal ribs
      for (let k = 1; k <= 3; k += 1) {
        const kk = k / 4;
        ctx.beginPath();
        ctx.moveTo(side * r * 0.15, 0);
        ctx.quadraticCurveTo(side * r * 1.1 * kk, r * 0.35, side * r * 1.9 * kk, -r * 0.26 * kk);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = rgba(pal.coral, 0.55);
        ctx.stroke();
      }
      // gold dewdrop bead at the wing tip
      ctx.beginPath();
      ctx.arc(side * r * 1.95, -r * 0.24, r * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = pal.gold;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = pal.ink;
      ctx.stroke();
      ctx.restore();
    }
    // body: fuzzy coral-pink teardrop
    ctx.beginPath();
    ctx.ellipse(0, r * 0.06, r * 0.46, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fillStyle = mix(pal.coral, pal.pink, 0.5);
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    // head + ears
    ctx.beginPath();
    ctx.moveTo(-r * 0.36, -r * 0.42);
    ctx.lineTo(-r * 0.28, -r * 1.05);
    ctx.lineTo(-r * 0.02, -r * 0.62);
    ctx.moveTo(r * 0.36, -r * 0.42);
    ctx.lineTo(r * 0.28, -r * 1.05);
    ctx.lineTo(r * 0.02, -r * 0.62);
    ctx.fillStyle = pal.pink;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -r * 0.4, r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = pal.cream;
    ctx.fill();
    ctx.stroke();
    // eyes with a bright ink pupil, plus a tiny smile
    ctx.beginPath();
    ctx.arc(-r * 0.15, -r * 0.44, r * 0.075, 0, Math.PI * 2);
    ctx.arc(r * 0.15, -r * 0.44, r * 0.075, 0, Math.PI * 2);
    ctx.fillStyle = pal.ink;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -r * 0.26, r * 0.16, Math.PI * 0.15, Math.PI * 0.85);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    if (flash > 0.05) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(pal.paper, flash);
      ctx.stroke();
    }
    ctx.restore();
    if (p.hp != null) hpPips(ctx, x, y - r * 1.75, r * 2.2, num(p.hp, 2), num(p.maxHp, 2));
  }

  // ---------- THE DUSKFATHER ----------

  // The boss: layered cream/coral/gold wings, a fuzzy ink-and-cream body and two huge gold eyespots.
  // Slow heavy flap. drawBoss guards a missing boss and draws the HP plate above him.
  function boss(ctx, b, sim) {
    if (!b) return;
    const pal = palette();
    const x = num(b.x, W / 2);
    const y = num(b.y, 300);
    const r = num(b.r, 54);
    const alive = b.alive !== false && b.defeated !== true;
    const flash = clamp(num(b.flash, 0), 0, 1);
    const wing = num(b.wing, 0);
    const heavy = Math.sin(wing * 0.55) * 0.24;
    const entering = b.entering === true;
    const scale = alive ? 1 : 0.85;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alive ? 1 : 0.55;
    // hover shadow
    ctx.beginPath();
    ctx.ellipse(0, r * 1.15, r * 2.3, r * 0.36, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(pal.ink, 0.12);
    ctx.fill();
    // wing span in sprite terms: numberBall wings sit at +/- WING_SPAN; draw wider so it reads as a giant
    const span = (WING_SPAN / 54) * r;
    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      // upper forewing
      ctx.save();
      ctx.translate(side * r * 0.45, -r * 0.35);
      ctx.rotate(side * (-0.32 + heavy));
      ctx.beginPath();
      ctx.moveTo(0, r * 0.1);
      ctx.quadraticCurveTo(side * span * 0.75, -r * 1.5 - heavy * r * 1.2, side * span * 1.12, -r * 0.72);
      ctx.quadraticCurveTo(side * span * 1.18, r * 0.05, side * span * 0.62, r * 0.62);
      ctx.quadraticCurveTo(side * r * 0.25, r * 0.85, 0, r * 0.1);
      ctx.closePath();
      ctx.fillStyle = side < 0 ? mix(pal.cream, pal.coral, 0.1) : mix(pal.cream, pal.gold, 0.12);
      ctx.fill();
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = pal.ink;
      ctx.stroke();
      // coral banding along the wing edge
      ctx.beginPath();
      ctx.quadraticCurveTo(side * span * 0.95, -r * 1.2, side * span * 1.12, -r * 0.72);
      ctx.quadraticCurveTo(side * span * 1.06, -r * 0.2, side * span * 0.62, r * 0.62);
      ctx.lineWidth = r * 0.2;
      ctx.strokeStyle = rgba(pal.coral, 0.6);
      ctx.stroke();
      // THE eyespot: gold and coral rings with an ink pupil
      const ex = side * span * 0.7;
      const ey = -r * 0.62;
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = pal.gold;
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = pal.ink;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = pal.coral;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = pal.ink;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex - r * 0.05, ey - r * 0.05, r * 0.04, 0, Math.PI * 2);
      ctx.fillStyle = pal.paper;
      ctx.fill();
      // vein lines
      for (let k = 1; k <= 3; k += 1) {
        const f = k / 4;
        ctx.beginPath();
        ctx.moveTo(side * r * 0.2, r * 0.15);
        ctx.quadraticCurveTo(side * span * 0.6 * f, -r * 0.7, side * span * 0.95 * f, -r * 0.62 + r * 0.5 * f);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = rgba(pal.ink, 0.28);
        ctx.stroke();
      }
      ctx.restore();
      // lower hindwing
      ctx.save();
      ctx.translate(side * r * 0.4, r * 0.35);
      ctx.rotate(side * (0.22 - heavy * 0.7));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * span * 0.7, r * 0.3, side * span * 0.78, r * 1.05);
      ctx.quadraticCurveTo(side * r * 0.7, r * 1.42, side * r * 0.1, r * 0.65);
      ctx.closePath();
      ctx.fillStyle = side < 0 ? mix(pal.coral, pal.cream, 0.45) : mix(pal.coral, pal.cream, 0.3);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = pal.ink;
      ctx.stroke();
      // small gold crescent mark on the hindwing
      ctx.beginPath();
      ctx.arc(side * span * 0.42, r * 0.72, r * 0.18, Math.PI * 0.1, Math.PI * 1.1);
      ctx.lineWidth = r * 0.1;
      ctx.strokeStyle = pal.gold;
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }
    // body: big fuzzy barrel, ink stripes and a gold thorax
    ctx.beginPath();
    ctx.ellipse(0, r * 0.25, r * 0.72, r * 1.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = mix(pal.cream, pal.pink, 0.15);
    ctx.fill();
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    for (let i = -1; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.ellipse(0, r * 0.25 + i * r * 0.34, r * 0.56, r * 0.1, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(pal.ink, 0.75);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, -r * 0.42, r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = pal.gold;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    // head with two glowing gold eyes and feather antennae
    ctx.beginPath();
    ctx.arc(0, -r * 0.95, r * 0.46, 0, Math.PI * 2);
    ctx.fillStyle = pal.cream;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.arc(side * r * 0.18, -r * 0.98, r * 0.14, 0, Math.PI * 2);
      ctx.fillStyle = pal.gold;
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = pal.ink;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(side * r * 0.18, -r * 0.98, r * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = pal.ink;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(side * r * 0.12, -r * 1.32);
      ctx.quadraticCurveTo(side * r * 0.55, -r * 1.95, side * r * 0.95, -r * 1.8 + heavy * 6);
      ctx.lineWidth = 3;
      ctx.strokeStyle = pal.ink;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(side * r * 0.98, -r * 1.8 + heavy * 6, r * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = pal.coral;
      ctx.fill();
    }
    // busy little legs under the body
    ctx.beginPath();
    for (let i = 0; i < 3; i += 1) {
      const ly = r * 0.55 + i * r * 0.3;
      ctx.moveTo(-r * 0.4, ly);
      ctx.lineTo(-r * 0.95, ly + r * 0.32);
      ctx.moveTo(r * 0.4, ly);
      ctx.lineTo(r * 0.95, ly + r * 0.32);
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    if (flash > 0.05) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
      ctx.lineWidth = 6;
      ctx.strokeStyle = rgba(pal.paper, flash);
      ctx.stroke();
    }
    ctx.restore();
    if (sim !== null) drawBossPlate(ctx, b, x, y, r, entering);
  }

  // HP plate above the boss: gold-on-cream bar, "DUSKFATHER 17/24", and the NO GLOW? hint when hurt.
  function drawBossPlate(ctx, b, x, y, r, entering) {
    const pal = palette();
    const hp = clamp(num(b.hp, 0), 0, 999);
    const maxHp = Math.max(1, num(b.maxHp, num(config().score && config().score.bossHP, 24)));
    const width = Math.max(300, r * 6.2);
    const height = 52;
    const top = y - r * (entering ? 2.0 : 2.25) - height;
    const left = x - width * 0.5;
    ctx.save();
    roundRect(ctx, left, top, width, height, 12, pal.paper);
    ctx.lineWidth = 3;
    ctx.strokeStyle = pal.ink;
    roundRectPath(ctx, left, top, width, height, 12);
    ctx.stroke();
    // bar track and gold fill
    const bx = left + 14;
    const by = top + height - 20;
    const bw = width - 28;
    roundRect(ctx, bx, by, bw, 14, 7, mix(pal.cream, pal.gold, 0.14));
    ctx.lineWidth = 2;
    ctx.strokeStyle = pal.ink;
    roundRectPath(ctx, bx, by, bw, 14, 7);
    ctx.stroke();
    const share = clamp(hp / maxHp, 0, 1);
    if (share > 0) {
      roundRect(ctx, bx + 1.5, by + 1.5, Math.max(3, (bw - 3) * share), 11, 5.5, pal.gold);
      for (let i = 1; i < maxHp; i += 1) {
        const tx = bx + (bw * i) / maxHp;
        if (tx > bx + (bw - 3) * share + bx) break;
        ctx.beginPath();
        ctx.moveTo(tx, by + 2.5);
        ctx.lineTo(tx, by + 11.5);
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(pal.coral, 0.6);
        ctx.stroke();
      }
    }
    const label = (b.name ? String(b.name) : 'DUSKFATHER') + '  ' + hp + '/' + maxHp;
    textFit(ctx, label, x, top + 18, width - 24, 21, { align: 'center', fill: pal.ink, minSize: 13 });
    // moth-skull wing mark at the left of the plate
    ctx.beginPath();
    ctx.ellipse(left + 20, top + 19, 9, 6, -0.4, 0, Math.PI * 2);
    ctx.ellipse(left + 30, top + 19, 9, 6, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = pal.coral;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(left + 24, top + 17);
    ctx.lineTo(left + 22, top + 12);
    ctx.moveTo(left + 26, top + 17);
    ctx.lineTo(left + 28, top + 12);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    ctx.restore();
  }

  // ---------- roster ----------

  // One pest icon for panels; kind picks the sprite and state is forced to a readable pose.
  function icon(ctx, kind, x, y, r) {
    const k = String(kind || 'clingmoth');
    const p = {
      x: num(x, 0),
      y: num(y, 0),
      r: num(r, 15),
      id: 3,
      dir: 1,
      state: 'fly',
      stateTicks: 24,
      hp: 2,
      maxHp: 2,
      hitFlash: 0,
    };
    if (k === 'huskling') p.state = 'fly';
    if (k === 'draingrub') {
      grub(ctx, p);
      return;
    }
    if (k === 'petalbat') {
      bat(ctx, p, 24);
      return;
    }
    p.hp = k === 'huskling' ? 2 : 1;
    p.maxHp = 2;
    moth(ctx, p, k === 'huskling' ? 'huskling' : 'clingmoth');
  }

  function pests(ctx, sim) {
    const list = (sim && sim.pests) || [];
    const tick = num(sim && sim.tick, 0);
    for (let i = 0; i < list.length; i += 1) {
      const p = list[i];
      if (!p || p.alive === false || p.active === false || p.state === 'gone') continue;
      if (p.kind === 'clingmoth' || p.kind === 'huskling') moth(ctx, p, p.kind);
      else if (p.kind === 'draingrub') grub(ctx, p);
      else if (p.kind === 'petalbat') bat(ctx, p, tick);
    }
  }

  // Boss sleeved moth skull drawn on the shower track pips; shared with the results/title screens.
  function mothSkull(ctx, x, y, size) {
    const pal = palette();
    const s = num(size, 18) / 18;
    ctx.save();
    ctx.translate(num(x, 0), num(y, 0));
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(-17, -2);
    ctx.quadraticCurveTo(-15, -13, -4, -10);
    ctx.lineTo(0, -7);
    ctx.lineTo(4, -10);
    ctx.quadraticCurveTo(15, -13, 17, -2);
    ctx.quadraticCurveTo(14, 10, 0, 13);
    ctx.quadraticCurveTo(-14, 10, -17, -2);
    ctx.closePath();
    ctx.fillStyle = pal.cream;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, -9);
    ctx.quadraticCurveTo(-13, -16, -16, -15);
    ctx.moveTo(6, -9);
    ctx.quadraticCurveTo(13, -16, 16, -15);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
    // eye sockets and a coral crown dot
    ctx.beginPath();
    ctx.ellipse(-6, 0, 3.6, 4.4, -0.2, 0, Math.PI * 2);
    ctx.ellipse(6, 0, 3.6, 4.4, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = pal.ink;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 7.6, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = pal.coral;
    ctx.fill();
    ctx.restore();
  }

  // ---------- main ----------

  // Draws boss first (behind the cascade), pests over the pegs, then the boss plate stays above pests.
  function draw(ctx, sim) {
    if (!ctx) return;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const boss = sim && sim.boss ? sim.boss : null;
    if (boss) boss(ctx, boss, sim);
    pests(ctx, sim);
    ctx.restore();
  }

  globalThis.PB_Sprites = {
    draw: draw,
    boss: boss,
    drawBossPlate: drawBossPlate,
    pests: pests,
    icon: icon,
    moth: moth,
    grub: grub,
    bat: bat,
    mothSkull: mothSkull,
  };
})();
