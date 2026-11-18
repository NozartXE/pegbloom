// Draws the pegboard cabinet: awning, frame, gutters, pegs, bloom cups, sockets, Sunwell spout and the shared PB_Board helpers.
(function () {
  if (typeof globalThis.PB_Board === 'object' && globalThis.PB_Board !== null) return;

  const W = 1280;
  const H = 800;
  const FONT = '"Arial Narrow", "Roboto Condensed", Impact, "Arial", sans-serif';

  function palette() {
    return globalThis.PB_PALETTE || {
      cream: '#FFF6E9', paper: '#FFFDF6', coral: '#FF7A59', gold: '#FFC53D', sky: '#57B8FF',
      mint: '#4FD8A5', pink: '#FF9FB2', leaf: '#58B368', ink: '#2B2118',
    };
  }

  function config() {
    return globalThis.PB_CONFIG || { board: { field: { x: 368, y: 150, w: 544, h: 520 }, cupY: 678, socketYs: [] } };
  }

  function board() {
    return (config().board) || {};
  }

  function field() {
    const b = board();
    return b.field || { x: 368, y: 150, w: 544, h: 520 };
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // Smooth sin in [-1, 1], tick-safe trig for deterministic flutter and sway.
  function wave(tick, speed, phase) {
    return Math.sin(num(tick, 0) * num(speed, 0.05) + num(phase, 0));
  }

  // Integer hash to [0, 1): the renderer's own deterministic texture source, never Math.random.
  function hash(a, b) {
    let h = (Math.imul((a | 0) + 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 1, 0xc2b2ae35)) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0x27d4eb2f) >>> 0;
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // '#RRGGBB' mixed toward white (amount < 0 darkens only as far as the ink tone; keep it subtle).
  const MIX_CACHE = {};
  function mixHex(hex, target, amount) {
    const m = clamp(num(amount, 0), 0, 1);
    const key = String(hex) + '|' + String(target) + '|' + m.toFixed(3);
    if (MIX_CACHE[key]) return MIX_CACHE[key];
    function parse(s) {
      const t = String(s || '').replace('#', '');
      const full = t.length === 3 ? t[0] + t[0] + t[1] + t[1] + t[2] + t[2] : t;
      const v = parseInt(full || 'FFFFFF', 16);
      if (!isFinite(v)) return [255, 255, 255];
      return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    }
    const a = parse(hex);
    const b = parse(target);
    const out = '#' + a.map(function (v, i) {
      const n = Math.round(v + (b[i] - v) * m);
      return (n < 16 ? '0' : '') + n.toString(16);
    }).join('');
    MIX_CACHE[key] = out;
    return out;
  }

  function rgba(hex, alpha) {
    const t = String(hex || '#000000').replace('#', '');
    const full = t.length === 3 ? t[0] + t[0] + t[1] + t[1] + t[2] + t[2] : t;
    const v = parseInt(full || '000000', 16);
    const r = (v >> 16) & 255;
    const g = (v >> 8) & 255;
    const bb = v & 255;
    return 'rgba(' + r + ',' + g + ',' + bb + ',' + clamp(num(alpha, 1), 0, 1).toFixed(3) + ')';
  }

  function colour(nameOrHex, fallback) {
    const p = palette();
    if (!nameOrHex) return fallback || p.ink;
    return p[nameOrHex] || nameOrHex;
  }

  function font(size, weight) {
    return (weight || 'bold') + ' ' + Math.max(6, Math.round(size)) + 'px ' + FONT;
  }

  // ---------- shared drawing helpers (used by every render file via PB_Board.*) ----------

  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(num(r, 0), Math.abs(w) * 0.5, Math.abs(h) * 0.5));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }

  function roundRect(ctx, x, y, w, h, r, fill) {
    roundRectPath(ctx, x, y, w, h, r);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    return ctx;
  }

  // A cream paper panel with an ink border, a soft drop shadow and an optional coral title tab.
  // spec: { x, y, w, h, r, tab, tabFill, fill, border, title, titleSize, alive, badge }
  function panel(ctx, x, y, w, h, spec) {
    const p = palette();
    const s = spec || {};
    const r = num(s.r, 14);
    ctx.save();
    ctx.fillStyle = rgba(p.ink, 0.1);
    roundRect(ctx, x + 2, y + 5, w, h, r, rgba(p.ink, 0.1));
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = s.fill || p.paper;
    ctx.fill();
    ctx.lineWidth = num(s.borderWidth, 3);
    ctx.strokeStyle = s.border || p.ink;
    ctx.stroke();
    const tabText = s.tab || s.title;
    if (tabText) {
      const size = num(s.tabSize, num(s.titleSize, 19));
      ctx.font = font(size, 'bold');
      const tw = ctx.measureText(String(tabText).toUpperCase()).width;
      const th = size + 12;
      const tabW = Math.max(70, tw + 26);
      const tabFill = s.tabFill || p.coral;
      roundRect(ctx, x + 10, y - th * 0.42, tabW, th, 8, tabFill);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = p.ink;
      roundRectPath(ctx, x + 10, y - th * 0.42, tabW, th, 8);
      ctx.stroke();
      ctx.fillStyle = s.tabInk || (tabFill === p.gold || tabFill === p.mint || tabFill === p.pink || tabFill === p.cream || tabFill === p.paper || tabFill === p.sky ? p.ink : p.paper);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(tabText).toUpperCase(), x + 10 + tabW * 0.5, y - th * 0.42 + th * 0.52);
    }
    if (s.badge != null) {
      ctx.font = font(17, 'bold');
      const bw = Math.max(34, ctx.measureText(String(s.badge)).width + 18);
      roundRect(ctx, x + w - bw - 12, y - 12, bw, 24, 12, s.badgeFill || p.gold);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = p.ink;
      roundRectPath(ctx, x + w - bw - 12, y - 12, bw, 24, 12);
      ctx.stroke();
      ctx.fillStyle = p.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(s.badge), x + w - bw * 0.5 - 12, y + 1);
    }
    ctx.restore();
    return ctx;
  }

  // Fit text to maxW: draws at size when it fits, shrinks a step at a time, then letterfits with
  // letter spacing so a condensed heading can fill its frame width without ever clipping.
  function measure(ctx, text, size, weight) {
    ctx.font = font(size, weight || 'bold');
    return ctx.measureText(String(text)).width;
  }

  function fitText(ctx, text, maxW, size, minSize, weight) {
    const str = String(text == null ? '' : text);
    let s = Math.max(6, num(size, 24));
    const floor = Math.max(5, num(minSize, 8));
    while (s > floor && measure(ctx, str, s, weight) > maxW) s -= 1;
    return s;
  }

  // Draws text sized to fit maxW.
  // opts: { align, baseline, fill, stroke, strokeW, maxW, minSize, weight, spacing, glow, glowColour }
  function textFit(ctx, text, x, y, maxW, size, opts) {
    const o = opts || {};
    const str = String(text == null ? '' : text);
    const p = palette();
    const target = Math.max(6, num(size, 24));
    const fit = fitText(ctx, str, num(maxW, 9999), target, o.minSize, o.weight);
    ctx.save();
    ctx.font = font(fit, o.weight || 'bold');
    ctx.textBaseline = o.baseline || 'middle';
    ctx.textAlign = o.align || 'left';
    const widest = ctx.measureText(str).width;
    const tx = x;
    if (o.glow) {
      ctx.shadowColor = rgba(o.glowColour || p.gold, 0.75);
      ctx.shadowBlur = num(o.glow, 10);
    }
    if (o.stroke) {
      ctx.lineWidth = num(o.strokeW, 6);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = o.stroke;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = o.fill || p.ink;
    ctx.fillText(str, x, y);
    ctx.restore();
    return { size: fit, width: widest, x: tx, y: y };
  }

  // Plain text in the condensed stack, no fitting. Keeps HUD and render files on one font.
  function text(ctx, str, x, y, size, spec) {
    const s = spec || {};
    const p = palette();
    ctx.save();
    if (s.align) ctx.textAlign = s.align;
    if (s.baseline) ctx.textBaseline = s.baseline;
    ctx.font = font(size, s.weight || 'bold');
    ctx.fillStyle = s.fill || p.ink;
    if (s.stroke) {
      ctx.lineWidth = num(s.strokeW, 4);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = s.stroke;
      ctx.strokeText(String(str), x, y);
    }
    ctx.fillText(String(str), x, y);
    ctx.restore();
  }

  // ---------- deterministic paper grain ----------

  const GRAIN_PAD = 20;
  let GRAIN = null;
  function grainPoints() {
    if (GRAIN) return GRAIN;
    const out = [];
    for (let i = 0; i < 1500; i += 1) {
      const u = hash(i, 11);
      const v = hash(i, 29);
      const t = hash(i, 47);
      out.push({ x: GRAIN_PAD + u * (W - GRAIN_PAD * 2), y: GRAIN_PAD + v * (H - GRAIN_PAD * 2), r: 0.6 + t * 1.1, warm: t > 0.55 });
    }
    return (GRAIN = out);
  }

  // ---------- scenery ----------

  function backdrop(ctx, sim) {
    const p = palette();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, mixHex(p.cream, p.sky, 0.16));
    g.addColorStop(0.42, p.cream);
    g.addColorStop(1, mixHex(p.cream, p.gold, 0.24));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // sun haze arcs behind the cabinet
    ctx.save();
    for (let i = 0; i < 4; i += 1) {
      ctx.strokeStyle = rgba(p.gold, 0.16 - i * 0.03);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(W * 0.5, 300, 430 + i * 46, Math.PI * 0.96, Math.PI * 1.6);
      ctx.stroke();
    }
    const pts = grainPoints();
    for (let i = 0; i < pts.length; i += 1) {
      const d = pts[i];
      ctx.fillStyle = d.warm ? rgba(p.coral, 0.1) : rgba(p.leaf, 0.08);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function dayName(sim) {
    const c = config();
    const table = (globalThis.PB_NAMES && globalThis.PB_NAMES.days) || c.days || [];
    const day = num(sim && sim.day, 1);
    for (let i = 0; i < table.length; i += 1) if (num(table[i].day, i + 1) === day) return String(table[i].name || '').toUpperCase();
    return table[clamp(day - 1, 0, table.length - 1)] ? String(table[clamp(day - 1, 0, table.length - 1)].name).toUpperCase() : 'DEWRISE';
  }

  // Scalloped awning with day name and shower count; hangs over the top rail of the cabinet.
  function awning(ctx, sim) {
    const p = palette();
    const f = field();
    const x0 = f.x - 84;
    const x1 = f.x + f.w + 84;
    const top = 44;
    const bottom = 118;
    ctx.save();
    ctx.fillStyle = p.coral;
    roundRect(ctx, x0 - 6, top, x1 - x0 + 12, bottom - top - 6, 12, p.coral);
    ctx.fillStyle = p.paper;
    const stripes = 8;
    const sw = (x1 - x0) / stripes;
    for (let i = 0; i < stripes; i += 1) if (i % 2 === 0) ctx.fillRect(x0 + i * sw, top + 4, sw, bottom - top - 18);
    ctx.fillStyle = p.coral;
    for (let i = 0; i < stripes; i += 1) if (i % 2 === 1) ctx.fillRect(x0 + i * sw, top + 4, sw, bottom - top - 18);
    const bumps = stripes * 2;
    const bw = (x1 - x0) / bumps;
    for (let i = 0; i < bumps; i += 1) {
      ctx.fillStyle = i % 4 < 2 ? p.coral : p.paper;
      ctx.beginPath();
      ctx.arc(x0 + bw * (i + 0.5), bottom - 8, bw * 0.5 - 0.5, 0, Math.PI);
      ctx.fill();
    }
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 3;
    roundRectPath(ctx, x0 - 6, top, x1 - x0 + 12, bottom - top - 6, 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0 - 6, bottom - 8);
    for (let i = 0; i < bumps; i += 1) ctx.arc(x0 + bw * (i + 0.5), bottom - 8, bw * 0.5 - 0.5, Math.PI, 0, i === 0);
    ctx.lineTo(x1 + 6, bottom - 8);
    ctx.stroke();
    ctx.restore();

    // ink plaque: DAY d - NAME, with shower pips read at the right
    const pw = 360;
    ctx.save();
    roundRect(ctx, f.x + f.w * 0.5 - pw * 0.5, top + 10, pw, 34, 17, p.ink);
    ctx.fillStyle = p.ink;
    ctx.restore();
    const day = num(sim && sim.day, 1);
    const nm = dayName(sim);
    text(ctx, 'DAY ' + day + ' - ' + nm, f.x + f.w * 0.5, top + 28, 24, { align: 'center', fill: p.paper });
    // little sun + dew motif at the awning corners
    ctx.save();
    for (let s = 0; s < 2; s += 1) {
      const cx = s === 0 ? x0 + 54 : x1 - 54;
      const cy = top + 50;
      ctx.fillStyle = p.gold;
      for (let i = 0; i < 8; i += 1) {
        const a = i * Math.PI * 0.25;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16);
        ctx.lineTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30);
        ctx.lineWidth = 6;
        ctx.strokeStyle = p.gold;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.fillStyle = s === 0 ? p.gold : p.sky;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
      if (s === 1) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - 22);
        ctx.quadraticCurveTo(cx + 12, cy - 6, cx, cy + 8);
        ctx.quadraticCurveTo(cx - 12, cy - 6, cx, cy - 22);
        ctx.fillStyle = p.sky;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function flowerOutlined(ctx, x, y, r, petal, core) {
    const p = palette();
    ctx.save();
    ctx.fillStyle = petal;
    for (let i = 0; i < 5; i += 1) {
      const a = i * Math.PI * 0.4 - Math.PI * 0.5;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.58, r * 0.38, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = rgba(p.ink, 0.35);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, r * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = core || p.gold;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(p.ink, 0.4);
    ctx.stroke();
    ctx.restore();
  }

  // Painted vines and flowers climbing the side gutters.
  function gutterArt(ctx, side) {
    const p = palette();
    const f = field();
    const inner = side === 'left' ? f.x - 50 : f.x + f.w + 50;
    const outer = side === 'left' ? f.x - 78 : f.x + f.w + 78;
    const top = f.y + 8;
    const bottom = f.y + f.h + 24;
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba(p.leaf, 0.85);
    let px = inner;
    let py = bottom;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let i = 1; i <= 16; i += 1) {
      const t = i / 16;
      const y = bottom - (bottom - top) * t;
      const sway = (side === 'left' ? 1 : -1) * Math.sin(t * Math.PI * 2.6) * 12;
      const nx = (inner + outer) * 0.5 + sway;
      const cx = px + (nx - px) * 0.5 + (side === 'left' ? 8 : -8);
      ctx.quadraticCurveTo(cx, (py + y) * 0.5, nx, y);
      if (i % 2 === 0) {
        flowerOutlined(ctx, nx + (side === 'left' ? 12 : -12), y, 9, i % 4 === 0 ? p.pink : p.paper, p.gold);
      } else {
        ctx.save();
        ctx.translate(nx + (side === 'left' ? 9 : -9), y);
        ctx.rotate(side === 'left' ? 0.6 : -0.6);
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = p.leaf;
        ctx.fill();
        ctx.restore();
      }
      px = nx;
      py = y;
    }
    ctx.stroke();
    for (let i = 0; i < 4; i += 1) {
      flowerOutlined(ctx, (inner + outer) * 0.5 + (side === 'left' ? -2 : 2), top + 60 + i * 118, 11, i % 2 ? p.coral : p.pink, p.gold);
    }
    ctx.restore();
  }

  // Rolling mint hills with simple flowers beyond the bottom rail, outside the field.
  function garden(ctx, sim) {
    const p = palette();
    const f = field();
    const baseY = f.y + f.h + 40;
    ctx.save();
    const layers = [
      { y: baseY + 26, colour: mixHex(p.mint, p.paper, 0.45), amp: 16 },
      { y: baseY + 48, colour: mixHex(p.mint, p.paper, 0.18), amp: 22 },
      { y: baseY + 76, colour: p.mint, amp: 14 },
    ];
    for (let l = 0; l < layers.length; l += 1) {
      const L = layers[l];
      ctx.beginPath();
      ctx.moveTo(-10, H + 10);
      for (let x = -10; x <= W + 10; x += 16) {
        const y = L.y + Math.sin(x * 0.011 + l * 1.7) * L.amp + Math.sin(x * 0.031 + l) * L.amp * 0.35;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W + 10, H + 10);
      ctx.closePath();
      ctx.fillStyle = L.colour;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(p.leaf, 0.5);
      ctx.stroke();
    }
    for (let i = 0; i < 18; i += 1) {
      const x = 24 + i * 70 + hash(i, 7) * 26;
      const y = baseY + 34 + hash(i, 13) * 58;
      const r = 6 + hash(i, 19) * 5;
      const cols = [p.pink, p.coral, p.gold, p.paper, p.sky];
      ctx.strokeStyle = p.leaf;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.sin(i) * 3, y + 26);
      ctx.stroke();
      flowerOutlined(ctx, x, y, r, cols[i % cols.length], p.gold);
    }
    ctx.restore();
  }

  // ---------- cabinet ----------

  function cabinet(ctx, sim) {
    const p = palette();
    const f = field();
    const x0 = f.x - 82;
    const y0 = 126;
    const w = f.w + 164;
    const h = f.h + 94;
    ctx.save();
    // hard shadow
    roundRect(ctx, x0 + 6, y0 + 12, w, h, 26, rgba(p.ink, 0.14));
    // coral outer frame
    roundRectPath(ctx, x0, y0, w, h, 26);
    ctx.fillStyle = p.coral;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    // gold bead stripe on the frame
    ctx.lineWidth = 6;
    ctx.strokeStyle = p.gold;
    roundRectPath(ctx, x0 + 10, y0 + 10, w - 20, h - 20, 20);
    ctx.stroke();
    // inner cream lip then paper field
    roundRect(ctx, f.x - 58, f.y - 22, f.w + 116, f.h + 52, 18, p.paper);
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.ink;
    roundRectPath(ctx, f.x - 58, f.y - 22, f.w + 116, f.h + 52, 18);
    ctx.stroke();
    // side gutters
    const gx0 = f.x - 54;
    const gx1 = f.x + f.w + 54;
    roundRect(ctx, gx0, f.y - 18, 46, f.h + 44, 14, mixHex(p.pink, p.paper, 0.38));
    roundRect(ctx, gx1 - 46, f.y - 18, 46, f.h + 44, 14, mixHex(p.pink, p.paper, 0.38));
    // peg field: a planted mint bed, not blank paper - the board must read as a
    // living garden at thumbnail size, so the bed carries a real tint.
    roundRect(ctx, f.x, f.y, f.w, f.h, 12, mixHex(p.mint, p.paper, 0.58));
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.ink;
    roundRectPath(ctx, f.x, f.y, f.w, f.h, 12);
    ctx.stroke();
    // faint grid paper in the field
    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, f.x + 2, f.y + 2, f.w - 4, f.h - 4, 10);
    ctx.clip();
    ctx.strokeStyle = rgba(p.leaf, 0.13);
    ctx.lineWidth = 1;
    for (let x = f.x + 30; x < f.x + f.w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, f.y);
      ctx.lineTo(x, f.y + f.h);
      ctx.stroke();
    }
    for (let y = f.y + 30; y < f.y + f.h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(f.x, y);
      ctx.lineTo(f.x + f.w, y);
      ctx.stroke();
    }
    // Garden texture in the gaps between pegs: deterministic flecks, buds and
    // grass blades from the same hash as the backdrop grain. Purely decorative;
    // the sim neither knows nor cares that the bed is planted. Fix round 2:
    // thinned 130 -> 52 and softened - at contact-sheet size the full planting
    // turned to grain that fought the pegs and pills for the eye.
    for (let i = 0; i < 52; i += 1) {
      const dx = f.x + 12 + hash(i, 31) * (f.w - 24);
      const dy = f.y + 12 + hash(i, 57) * (f.h - 24);
      const kind = i % 3;
      if (kind === 0) {
        ctx.beginPath();
        ctx.arc(dx, dy, 2.2 + hash(i, 71) * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = rgba(i % 2 ? p.gold : p.pink, 0.38);
        ctx.fill();
      } else if (kind === 1) {
        ctx.strokeStyle = rgba(p.leaf, 0.34);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(dx - 3, dy + 3);
        ctx.quadraticCurveTo(dx - 1, dy - 2, dx - 3.4, dy - 4.6);
        ctx.moveTo(dx + 3, dy + 3);
        ctx.quadraticCurveTo(dx + 1, dy - 2, dx + 3.4, dy - 4.6);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = rgba(p.leaf, 0.32);
        ctx.fill();
      }
    }
    ctx.restore();
    // gutter art over the pink
    gutterArt(ctx, 'left');
    gutterArt(ctx, 'right');
    // dropper rail
    const rail = board().dropperRail || { x: f.x, y: f.y - 46, w: f.w };
    const railY = Math.min(num(rail.y, f.y - 46), f.y - 16);
    roundRect(ctx, f.x + 8, railY - 9, f.w - 16, 18, 9, p.gold);
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.ink;
    roundRectPath(ctx, f.x + 8, railY - 9, f.w - 16, 18, 9);
    ctx.stroke();
    for (let i = 0; i < 9; i += 1) {
      const x = f.x + 8 + (f.w - 16) * (i / 8);
      ctx.beginPath();
      ctx.arc(x, railY, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.ink, 0.55);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- pegs ----------

  function drawPeg(ctx, peg, sim) {
    if (!peg || num(peg.r, 0) <= 0) return;
    const p = palette();
    const x = num(peg.x, 0);
    const y = num(peg.y, 0);
    const r = num(peg.r, 8);
    // Drawn radius is presentation-only: pegs paint ~2px proud of their collision
    // radius so the board reads dense and jewel-like at thumbnail size. The sim
    // never sees this; physics keeps using peg.r.
    const vr = r + 2.2;
    if (peg.rim) {
      ctx.beginPath();
      ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = p.coral;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(p.ink, 0.75);
      ctx.stroke();
      return;
    }
    const lit = num(peg.lit, 0) > 0;
    const dead = num(peg.dead, 0) > 0 || peg.pestOwner;
    const golden = peg.golden === true;
    const flash = num(peg.hitFlash, 0);
    let hi = mixHex(p.sky, p.paper, 0.04);
    let lo = mixHex(p.sky, p.ink, 0.15);
    if (dead) {
      hi = mixHex(p.gold, p.paper, 0.3);
      lo = mixHex(p.gold, p.ink, 0.08);
    } else if (lit) {
      hi = mixHex(p.gold, p.paper, 0.08);
      lo = mixHex(p.gold, p.coral, 0.3);
    }
    ctx.save();
    if (golden || (lit && !dead)) {
      ctx.shadowColor = rgba(p.gold, lit ? 0.85 : 0.6);
      ctx.shadowBlur = lit ? 16 + flash * 12 : 10;
    }
    if (lit && !dead) {
      ctx.beginPath();
      ctx.arc(x, y, vr * (2.5 + flash * 1.2), 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.gold, 0.22 + flash * 0.12);
      ctx.fill();
    }
    const halo = ctx.createRadialGradient(x - vr * 0.35, y - vr * 0.4, vr * 0.15, x, y, vr);
    halo.addColorStop(0, mixHex(hi, p.paper, 0.55));
    halo.addColorStop(0.45, hi);
    halo.addColorStop(1, lo);
    ctx.beginPath();
    ctx.arc(x, y, vr, 0, Math.PI * 2);
    ctx.fillStyle = halo;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = rgba(p.ink, 0.8);
    ctx.stroke();
    if (dead) {
      // moth-grey cap: soft blossom-grey, bright, with two tiny antennae so it reads "clung"
      ctx.beginPath();
      ctx.arc(x, y - vr * 0.15, vr * 0.62, Math.PI, 0);
      ctx.quadraticCurveTo(x, y + vr * 0.5, x - vr * 0.62, y - vr * 0.15);
      ctx.fillStyle = mixHex(p.gold, p.paper, 0.62);
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = rgba(p.ink, 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 2, y - vr * 0.6);
      ctx.quadraticCurveTo(x - 7, y - vr * 1.3, x - 10, y - vr * 1.2);
      ctx.moveTo(x + 2, y - vr * 0.6);
      ctx.quadraticCurveTo(x + 7, y - vr * 1.3, x + 10, y - vr * 1.2);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = rgba(p.ink, 0.7);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x - vr * 0.32, y - vr * 0.36, vr * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.paper, 0.95);
      ctx.fill();
    }
    if (golden) {
      ctx.beginPath();
      ctx.arc(x, y, vr + 3.4, 0, Math.PI * 2);
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = p.gold;
      ctx.stroke();
      for (let i = 0; i < 4; i += 1) {
        const a = Math.PI * 0.25 + i * Math.PI * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, vr + 5.6, a - 0.18, a + 0.18);
        ctx.lineWidth = 2;
        ctx.strokeStyle = rgba(p.gold, 0.9);
        ctx.stroke();
      }
    }
    if (peg.husklingNear > 0) {
      ctx.beginPath();
      ctx.arc(x, y, vr + 4, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = p.coral;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (flash > 0.02) {
      ctx.beginPath();
      ctx.arc(x, y, vr * (1.4 + (1 - flash) * 1.6), 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(p.paper, flash * 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function pegs(ctx, sim) {
    const list = (sim && sim.pegs) || [];
    for (let i = 0; i < list.length; i += 1) drawPeg(ctx, list[i], sim);
    const rims = (sim && sim.rimPegs) || [];
    for (let i = 0; i < rims.length; i += 1) drawPeg(ctx, rims[i], sim);
  }

  // ---------- cups ----------

  function cupColour(cup) {
    const p = palette();
    return colour(cup && cup.colourName, cup && cup.colour) || p.pink;
  }

  // One bloom cup: a petal bud that opens as cup.open rises, value number big beneath.
  function drawCup(ctx, cup, sim) {
    if (!cup) return;
    const p = palette();
    const x = num(cup.x, 0);
    const y = num(cup.y, 0);
    const w = num(cup.w, 50);
    const h = num(cup.h, 58);
    const open = clamp(num(cup.open, 0), 0, 1);
    const half = w * 0.5;
    const petal = cupColour(cup);
    const spread = open * (Math.PI * 0.52);
    const flash = open > 0.85;
    ctx.save();
    // stem shadow on the cup rail
    ctx.beginPath();
    ctx.ellipse(x, y + h - 2, half * 1.02, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(p.ink, 0.12);
    ctx.fill();
    if (flash) {
      ctx.beginPath();
      ctx.arc(x, y + 16, half * (1.1 + (1 - open) * 1.5), 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.gold, 0.22);
      ctx.fill();
    }
    // back petals fan out with the open value
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI * 0.5 + (i - 2) * 0.42 * (0.5 + open * 0.9);
      const len = h * (0.42 + open * 0.34);
      ctx.save();
      ctx.translate(x, y + 12);
      ctx.rotate(a + Math.PI * 0.5);
      ctx.beginPath();
      ctx.ellipse(0, -len * 0.5, half * (0.3 + open * 0.14), len * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? petal : mixHex(petal, p.paper, 0.16);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(p.ink, 0.45);
      ctx.stroke();
      ctx.restore();
    }
    if (open > 0.02) {
      // gold pollen centre peeking out as the bud opens
      ctx.beginPath();
      ctx.arc(x, y + 12, 5 + open * 5, 0, Math.PI * 2);
      ctx.fillStyle = p.gold;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = rgba(p.ink, 0.5);
      ctx.stroke();
    }
    // cup bowl
    ctx.beginPath();
    ctx.moveTo(x - half, y + 14);
    ctx.quadraticCurveTo(x - half * 0.92, y + h, x, y + h);
    ctx.quadraticCurveTo(x + half * 0.92, y + h, x + half, y + 14);
    ctx.closePath();
    const body = ctx.createLinearGradient(x - half, y, x + half, y + h);
    body.addColorStop(0, mixHex(petal, p.paper, 0.24));
    body.addColorStop(1, petal);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    // ink line and bloom count in the bowl
    ctx.beginPath();
    ctx.moveTo(x - half * 0.72, y + 26);
    ctx.lineTo(x + half * 0.72, y + 26);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(p.ink, 0.25);
    ctx.stroke();
    const blooms = num(cup.blooms, 0);
    text(ctx, blooms > 0 ? String(blooms) : '-', x, y + h * 0.68, 20, { align: 'center', fill: blooms > 0 ? p.ink : rgba(p.ink, 0.35) });
    if (blooms > 0) {
      ctx.beginPath();
      ctx.arc(x, y + h * 0.68, 12, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(p.ink, 0.35);
      ctx.stroke();
    }
    // front bud petals: closed at rest, fold outward as the cup opens
    for (let i = 0; i < 3; i += 1) {
      const a = (i - 1) * (0.3 + spread);
      ctx.save();
      ctx.translate(x, y + 14);
      ctx.rotate(a);
      const len = h * 0.46 * (1 - open * 0.45);
      ctx.beginPath();
      ctx.ellipse(0, -len * 0.42, half * 0.34, len * 0.52, 0, 0, Math.PI * 2);
      ctx.fillStyle = i === 1 ? mixHex(petal, p.paper, 0.18) : petal;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(p.ink, 0.45);
      ctx.stroke();
      ctx.restore();
    }
    // cup mouth rim with the sunwell-level notch
    ctx.beginPath();
    ctx.ellipse(x, y + 15, half * 0.96, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = mixHex(petal, p.paper, 0.4);
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    // value number inside the cup body, big, dark ink
    textFit(ctx, String(num(cup.value, 10)), x, y + 44, w - 10, 22, { align: 'center', fill: p.ink, minSize: 10 });
    ctx.restore();
  }

  // The two drain gaps beside the cup row: coral grates feeding the Sunwell pipe.
  function drains(ctx, sim) {
    const p = palette();
    const cups = (sim && sim.cups) || [];
    const f = field();
    const list = cups.drains && cups.drains.length ? cups.drains : [
      { x: f.x, w: Math.max(0, (cups.startX || f.x) - f.x), y: num(cups.startY, board().cupY), h: f.h, side: 'left' },
      { x: cups.endX || f.x + f.w, w: Math.max(0, f.x + f.w - (cups.endX || f.x + f.w)), y: num(cups.startY, board().cupY), h: f.h, side: 'right' },
    ];
    for (let i = 0; i < list.length; i += 1) {
      const d = list[i];
      if (!(num(d.w, 0) > 4)) continue;
      const gy = num(cups.startY, board().cupY) - 4;
      const gh = f.y + f.h - gy;
      ctx.save();
      roundRect(ctx, d.x + 1, gy, d.w - 2, gh, 6, mixHex(p.coral, p.paper, 0.55));
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = p.ink;
      roundRectPath(ctx, d.x + 1, gy, d.w - 2, gh, 6);
      ctx.stroke();
      ctx.save();
      roundRectPath(ctx, d.x + 1, gy, d.w - 2, gh, 6);
      ctx.clip();
      ctx.lineWidth = 3;
      ctx.strokeStyle = p.coral;
      for (let k = -gh; k < d.w + gh; k += 9) {
        ctx.beginPath();
        ctx.moveTo(d.x + k, gy + gh);
        ctx.lineTo(d.x + k + gh, gy);
        ctx.stroke();
      }
      ctx.restore();
      // pipe mouth toward the Sunwell
      const px = d.side === 'left' ? d.x + d.w - 4 : d.x + 4;
      ctx.beginPath();
      ctx.arc(px, gy + 14, 7, 0, Math.PI * 2);
      ctx.fillStyle = p.gold;
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
      const label = d.side === 'left' ? 'DRAIN' : 'TO SUNWELL';
      textFit(ctx, label, d.x + d.w * 0.5, gy + gh - 16, d.w - 6, 15, { align: 'center', fill: p.paper, stroke: rgba(p.ink, 0.9), strokeW: 5, minSize: 9 });
      ctx.restore();
    }
    // drain posts the balls bounce off, already in rimPegs, drawn as little coral knobs here
    const rim = (sim && sim.rimPegs) || [];
    for (let i = 0; i < rim.length; i += 1) {
      const r = rim[i];
      ctx.beginPath();
      ctx.arc(r.x, r.y, num(r.r, 2) + 2.4, 0, Math.PI * 2);
      ctx.fillStyle = p.coral;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
    }
  }

  // ---------- sockets and contraption icons ----------

  const ICON_KINDS = ['bloomBumper', 'splitterTulip', 'magnetTulip', 'fanLeaf', 'springPad'];

  // Icon in a 1-unit space scaled to r; r ~ 20. kind may be a socket kind or a draft-style key.
  function contraptionIcon(ctx, kind, x, y, r, spec) {
    const p = palette();
    const s = spec || {};
    const scale = num(r, 20);
    const lw = Math.max(1.6, scale * 0.13);
    let k = kind;
    if (k === 'lanternLily') k = 'bloomBumper';
    else if (k === 'reedSlide' || k === 'coneFern') k = 'splitterTulip';
    else if (k === 'honeyCatch' || k === 'dewBell' || k === 'rainChime') k = 'magnetTulip';
    else if (k === 'gemTrellis' || k === 'seedSachet' || k === 'thornBramble') k = 'fanLeaf';
    else if (k === 'mossCushion' || k === 'lunarMirror' || k === 'duskLens') k = 'springPad';
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = p.ink;
    if (k === 'bloomBumper') {
      ctx.beginPath();
      ctx.arc(0, 0, scale * 0.62, 0, Math.PI * 2);
      ctx.fillStyle = p.coral;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, scale * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = p.gold;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-scale * 0.22, -scale * 0.24, scale * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = p.paper;
      ctx.fill();
    } else if (k === 'splitterTulip') {
      ctx.beginPath();
      ctx.moveTo(-scale * 0.32, scale * 0.55);
      ctx.quadraticCurveTo(-scale * 0.3, -scale * 0.05, -scale * 0.5, -scale * 0.35);
      ctx.quadraticCurveTo(-scale * 0.2, -scale * 0.6, 0, -scale * 0.3);
      ctx.quadraticCurveTo(scale * 0.2, -scale * 0.6, scale * 0.5, -scale * 0.35);
      ctx.quadraticCurveTo(scale * 0.3, -scale * 0.05, scale * 0.32, scale * 0.55);
      ctx.closePath();
      ctx.fillStyle = p.pink;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -scale * 0.18, scale * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = p.gold;
      ctx.fill();
      ctx.stroke();
    } else if (k === 'magnetTulip') {
      ctx.beginPath();
      ctx.arc(0, -scale * 0.08, scale * 0.46, Math.PI, 0);
      ctx.quadraticCurveTo(0, scale * 0.3, -scale * 0.46, -scale * 0.08);
      ctx.closePath();
      ctx.fillStyle = p.leaf;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-scale * 0.2, -scale * 0.07);
      ctx.lineTo(-scale * 0.2, scale * 0.2);
      ctx.moveTo(scale * 0.2, -scale * 0.07);
      ctx.lineTo(scale * 0.2, scale * 0.2);
      ctx.strokeStyle = p.gold;
      ctx.lineWidth = lw * 1.8;
      ctx.stroke();
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(0, -scale * 0.82, scale * 0.22, 0.15, Math.PI - 0.15);
      ctx.stroke();
    } else if (k === 'fanLeaf') {
      ctx.beginPath();
      ctx.moveTo(-scale * 0.08, scale * 0.62);
      ctx.quadraticCurveTo(-scale * 0.9, -scale * 0.1, -scale * 0.55, -scale * 0.62);
      ctx.quadraticCurveTo(scale * 0.1, -scale * 0.5, -scale * 0.08, scale * 0.62);
      ctx.fillStyle = p.mint;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-scale * 0.1, scale * 0.5);
      ctx.quadraticCurveTo(-scale * 0.4, -scale * 0.1, -scale * 0.5, -scale * 0.48);
      ctx.strokeStyle = p.leaf;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(scale * 0.42, -scale * 0.42, scale * 0.17, 0, Math.PI * 2);
      ctx.fillStyle = p.sky;
      ctx.fill();
      ctx.strokeStyle = p.ink;
      ctx.stroke();
    } else {
      // spring pad coil
      ctx.beginPath();
      for (let i = 0; i <= 20; i += 1) {
        const t = i / 20;
        const yy = scale * 0.52 - t * scale * 0.72;
        const xx = Math.sin(t * Math.PI * 4) * scale * 0.34;
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      ctx.beginPath();
      roundRectPath(ctx, -scale * 0.58, -scale * 0.48, scale * 1.16, scale * 0.26, scale * 0.12);
      ctx.fillStyle = p.gold;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      roundRectPath(ctx, -scale * 0.58, scale * 0.42, scale * 1.16, scale * 0.22, scale * 0.1);
      ctx.fillStyle = p.coral;
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function socket(ctx, sock, sim) {
    if (!sock) return;
    const p = palette();
    const x = num(sock.x, 0);
    const y = num(sock.y, 0);
    const r = 19;
    ctx.save();
    if (!sock.kind) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.paper, 0.85);
      ctx.fill();
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = p.gold;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = p.ink;
      ctx.beginPath();
      ctx.moveTo(x - 7, y);
      ctx.lineTo(x + 7, y);
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x, y + 7);
      ctx.stroke();
    } else {
      const lv = clamp(num(sock.level, 1), 1, 3);
      const flash = num(sock.flash, 0);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = mixHex(p.gold, p.paper, 0.45);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
      if (flash > 0.02) {
        ctx.beginPath();
        ctx.arc(x, y, r + 6 + (1 - flash) * 10, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = rgba(p.coral, flash);
        ctx.stroke();
      }
      if (typeof globalThis.PB_Balls === 'object' && globalThis.PB_Balls && typeof globalThis.PB_Balls.contraption === 'function') {
        globalThis.PB_Balls.contraption(ctx, sock, sim);
      } else {
        contraptionIcon(ctx, sock.kind, x, y, 20);
      }
      for (let i = 0; i < lv; i += 1) {
        const a = -Math.PI * 0.5 - 0.5 + i * 0.5;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4), 3.2, 0, Math.PI * 2);
        ctx.fillStyle = p.coral;
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = p.ink;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function sockets(ctx, sim) {
    const list = (sim && sim.sockets) || [];
    for (let i = 0; i < list.length; i += 1) socket(ctx, list[i], sim);
  }

  // ---------- Sunwell spout ----------

  function sunwell(ctx, sim) {
    const p = palette();
    const c = config();
    const f = field();
    const max = num(c.sunwell && c.sunwell.max, 10);
    const level = clamp(num(sim && sim.sunwell, max), 0, max);
    const x = f.x + f.w + 46;
    const y = num(board().cupY, 678) + 22;
    ctx.save();
    // stand
    roundRect(ctx, x - 20, y - 44, 40, 98, 12, mixHex(p.sky, p.paper, 0.55));
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.ink;
    roundRectPath(ctx, x - 20, y - 44, 40, 98, 12);
    ctx.stroke();
    // water level in the glass
    const innerH = 74;
    const fill = (level / Math.max(1, max)) * innerH;
    ctx.beginPath();
    roundRectPath(ctx, x - 13, y - 36 + (innerH - fill), 26, Math.max(2, fill), 6);
    ctx.fillStyle = rgba(p.sky, 0.85);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 4, y - 30 + (innerH - fill) + 3, 2, 0, Math.PI * 2);
    ctx.fillStyle = p.paper;
    ctx.fill();
    for (let i = 1; i < 5; i += 1) {
      const ly = y - 36 + (innerH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x + 3, ly);
      ctx.lineTo(x + 12, ly);
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(p.ink, 0.45);
      ctx.stroke();
    }
    // glass highlight
    ctx.beginPath();
    roundRectPath(ctx, x - 9, y - 32, 4, innerH - 8, 2);
    ctx.fillStyle = rgba(p.paper, 0.75);
    ctx.fill();
    // droplet + count
    ctx.beginPath();
    ctx.moveTo(x, y - 66);
    ctx.quadraticCurveTo(x + 13, y - 54, x, y - 41);
    ctx.quadraticCurveTo(x - 13, y - 54, x, y - 66);
    ctx.fillStyle = level <= 2 ? p.coral : p.sky;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    roundRect(ctx, x - 20, y + 58, 40, 20, 10, level <= 2 ? p.coral : p.gold);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = p.ink;
    roundRectPath(ctx, x - 20, y + 58, 40, 20, 10);
    ctx.stroke();
    text(ctx, level + '/' + max, x, y + 69, 16, { align: 'center', fill: level <= 2 ? p.paper : p.ink });
    textFit(ctx, 'SUNWELL', x, y + 92, 64, 14, { align: 'center', fill: p.ink, minSize: 9 });
    ctx.restore();
  }

  // ---------- main ----------

  function draw(ctx, sim, view) {
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    backdrop(ctx, sim);
    garden(ctx, sim);
    cabinet(ctx, sim);
    drains(ctx, sim);
    sockets(ctx, sim);
    pegs(ctx, sim);
    const cups = (sim && sim.cups) || [];
    for (let i = 0; i < cups.length; i += 1) drawCup(ctx, cups[i], sim);
    sunwell(ctx, sim);
    awning(ctx, sim);
    ctx.restore();
  }

  globalThis.PB_Board = {
    draw: draw,
    roundRect: roundRect,
    roundRectPath: roundRectPath,
    panel: panel,
    textFit: textFit,
    fitText: fitText,
    text: text,
    font: font,
    measure: measure,
    mixHex: mixHex,
    rgba: rgba,
    colour: colour,
    hash: hash,
    wave: wave,
    num: num,
    clamp: clamp,
    icon: contraptionIcon,
    ICON_KINDS: ICON_KINDS,
    drawPeg: drawPeg,
    drawCup: drawCup,
    awning: awning,
  };
})();
