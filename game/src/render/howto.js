// Shared screen drawing helpers: the quantified scope strip, the six-row rules digest, fit-to-width wordmark type and button/icon primitives used by the title, draft and results screens.
(function () {
  if (typeof globalThis.PB_Howto === 'object' && globalThis.PB_Howto !== null) return;

  const W = 1280;
  const FONT = '"Arial Narrow", "Roboto Condensed", Impact, "Arial", sans-serif';

  function palette() {
    return globalThis.PB_PALETTE || {
      cream: '#FFF6E9', paper: '#FFFDF6', coral: '#FF7A59', gold: '#FFC53D', sky: '#57B8FF',
      mint: '#4FD8A5', pink: '#FF9FB2', leaf: '#58B368', ink: '#2B2118',
    };
  }

  function names() {
    return globalThis.PB_NAMES || {};
  }

  function config() {
    return globalThis.PB_CONFIG || {};
  }

  function helper(name) {
    const b = globalThis.PB_Board;
    return b && typeof b[name] === 'function' ? b[name] : null;
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function mix(hex, toward, amount) {
    const f = helper('mixHex');
    return f ? f(hex, toward, amount) : hex;
  }

  function rgba(hex, a) {
    const f = helper('rgba');
    return f ? f(hex, a) : hex;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const f = helper('roundRectPath');
    if (f) return f(ctx, x, y, w, h, r);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    return ctx;
  }

  function roundRect(ctx, x, y, w, h, r, fill) {
    const f = helper('roundRect');
    if (f) return f(ctx, x, y, w, h, r, fill);
    roundRectPath(ctx, x, y, w, h, r);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    return ctx;
  }

  function text(ctx, str, x, y, size, spec) {
    const f = helper('text');
    if (f) {
      f(ctx, str, x, y, size, spec);
      return;
    }
    const s = spec || {};
    ctx.save();
    ctx.font = 'bold ' + Math.round(size) + 'px ' + FONT;
    ctx.textAlign = s.align || 'left';
    ctx.textBaseline = s.baseline || 'middle';
    ctx.fillStyle = s.fill || palette().ink;
    ctx.fillText(String(str), x, y);
    ctx.restore();
  }

  function textFit(ctx, str, x, y, maxW, size, spec) {
    const f = helper('textFit');
    if (f) {
      f(ctx, str, x, y, maxW, size, spec);
      return;
    }
    text(ctx, str, x, y, size, spec);
  }

  function measure(ctx, str, size) {
    const f = helper('measure');
    if (f) return f(ctx, str, size, 'bold');
    ctx.save();
    ctx.font = 'bold ' + Math.round(size) + 'px ' + FONT;
    const w = ctx.measureText(String(str)).width;
    ctx.restore();
    return w;
  }

  function circle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = num(lw, 2);
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  // ---------- wordmark-scale type ----------

  // The largest integer font size (bounded) at which `str` fits maxW; letter spacing is added on top.
  function fitSize(ctx, str, maxW, hi, lo, weight) {
    let size = num(hi, 200);
    const floor = num(lo, 24);
    while (size > floor && measure(ctx, str, size) > Math.max(10, maxW)) size -= 1;
    void weight;
    return size;
  }

  // Draws heading text stretched to exactly fill [x, x + maxW] at the height that fits: the
  // wordmark and every screen title use this so type never clips and never floats small.
  // opts: { fill, stroke, strokeW, spacing, align, baseline, weight, hi, lo, exact }
  function fitHeading(ctx, str, x, y, maxW, opts) {
    const o = opts || {};
    const p = palette();
    const label = String(str == null ? '' : str);
    const size = fitSize(ctx, label, maxW, o.hi, o.lo);
    const spacing = num(o.spacing, size * 0.02);
    {
      const natural = measure(ctx, label, size) + spacing * Math.max(0, label.length - 1);
      const stretch = o.exact === false ? 1 : clamp(maxW / Math.max(1, natural), 0.75, 1.25);
      ctx.save();
      ctx.font = 'bold ' + Math.round(size) + 'px ' + FONT;
      ctx.textBaseline = o.baseline || 'alphabetic';
      ctx.textAlign = 'left';
      ctx.lineJoin = 'round';
      const width = natural * stretch;
      let sx = num(x, 0);
      if ((o.align || 'left') === 'center') sx -= width * 0.5;
      else if (o.align === 'right') sx -= width;
      let tx = sx;
      const draw = function (mode) {
        let cx = tx;
        for (let i = 0; i < label.length; i += 1) {
          const ch = label[i];
          ctx[mode === 'fill' ? 'fillText' : 'strokeText'](ch, cx, y);
          cx += ctx.measureText(ch).width * stretch + spacing * stretch;
        }
      };
      if (o.stroke) {
        ctx.lineWidth = num(o.strokeW, Math.max(5, size * 0.06));
        ctx.strokeStyle = o.stroke;
        draw('stroke');
      }
      ctx.fillStyle = o.fill || p.ink;
      draw('fill');
      ctx.restore();
      return { size: size, width: width, x: sx, y: y };
    }
  }

  // ---------- buttons ----------

  // A chunky paper button: optional key chip inside the left edge, centred label, ink border and
  // a soft sunken shadow. Returns its hitbox so callers can register it in view.buttons.
  // opts: { fill, chip, family: 'key'|'seed'|'none', align, size, fontScale, ring }
  function button(ctx, x, y, w, h, label, opts) {
    const p = palette();
    const o = opts || {};
    const fill = o.fill || p.paper;
    const r = num(o.r, Math.min(14, h * 0.28));
    const hit = { x: x, y: y, w: w, h: h, label: String(label) };
    ctx.save();
    roundRect(ctx, x + 2, y + 5, w, h, r, rgba(p.ink, 0.12));
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (o.ring) {
      ctx.lineWidth = 6;
      ctx.strokeStyle = o.ring;
      roundRectPath(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(2, r - 4));
      ctx.stroke();
    }
    ctx.lineWidth = num(o.borderWidth, 3);
    ctx.strokeStyle = o.border || p.ink;
    roundRectPath(ctx, x, y, w, h, r);
    ctx.stroke();
    // glossy top band
    ctx.beginPath();
    ctx.moveTo(x + r, y + 3);
    ctx.lineTo(x + w - r, y + 3);
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(p.paper, 0.45);
    ctx.stroke();
    let labelX = x + w * 0.5;
    let labelW = w - 24;
    const family = o.family || (o.chip ? 'key' : 'none');
    if (family !== 'none' && o.chip != null) {
      const cw = Math.min(h - 10, o.family === 'seed' ? h * 1.05 : h - 8);
      const ch = h - 8;
      const cx = x + 6;
      roundRect(ctx, cx, y + 4, Math.max(24, cw), ch, Math.min(8, ch * 0.25), family === 'seed' ? p.sky : p.paper);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = p.ink;
      roundRectPath(ctx, cx, y + 4, Math.max(24, cw), ch, Math.min(8, ch * 0.25));
      ctx.stroke();
      const chipLabel = String(o.chip);
      textFit(ctx, chipLabel, cx + Math.max(24, cw) * 0.5, y + h * 0.5 + 1, Math.max(20, cw) - 6, ch * 0.66, { align: 'center', fill: p.ink, minSize: 9 });
      if (family === 'seed') {
        circle(ctx, cx + Math.max(24, cw) - 3, y + 9, 4.5, p.gold, p.ink, 1.6);
      }
      labelX = cx + Math.max(24, cw) + (w - Math.max(24, cw) - 12) * 0.5;
      labelW = w - Math.max(24, cw) - 22;
      if ((o.align || 'center') === 'center') labelX = x + Math.max(24, cw) + 8 + (w - Math.max(24, cw) - 20) * 0.5;
    } else if ((o.align || 'center') === 'left') {
      labelX = x + 16;
      labelW = w - 30;
    }
    const size = num(o.size, Math.min(30, h * 0.48));
    textFit(ctx, label, labelX, y + h * 0.5 + 1, Math.max(12, labelW), num(o.fontScale, 1) * size, { align: 'center', fill: o.ink || p.ink, minSize: 10 });
    ctx.restore();
    return hit;
  }

  // ---------- light shared art ----------

  // A round dewy icon with a sprig: used for the draft roundel corners and the title logo petals.
  function petal(ctx, x, y, r, angle, fill, stroke) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.62, r * 0.36, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.restore();
  }

  // A six-petal flower with a gold core, for logo marks and section bullets.
  function flower(ctx, x, y, r, petalCol, coreCol) {
    const p = palette();
    for (let i = 0; i < 6; i += 1) petal(ctx, x, y, r, (i * Math.PI) / 3, petalCol || p.pink, p.ink);
    circle(ctx, x, y, r * 0.34, coreCol || p.gold, p.ink, 2);
  }

  // A dew-sphere: sky ball, ink rim, paper highlight, optional gold glow.
  function dropletBall(ctx, x, y, r, glow) {
    const p = palette();
    circle(ctx, x, y, r, p.sky, p.ink, Math.max(1.4, r * 0.16));
    circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.3, rgba(p.paper, 0.92));
    if (glow) circle(ctx, x, y - r * 0.1, r * 0.42, rgba(p.gold, 0.65));
  }

  // A small gold seed.
  function seed(ctx, x, y, r) {
    const p = palette();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.66, 0, 0, Math.PI * 2);
    ctx.fillStyle = p.gold;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    ctx.restore();
  }

  // An ink check tick or a coral cross, for changed-vs-now lines.
  function check(ctx, x, y, r, ok) {
    const p = palette();
    circle(ctx, x, y, r, ok ? p.mint : p.coral, p.ink, 2);
    ctx.beginPath();
    ctx.lineWidth = Math.max(2, r * 0.36);
    ctx.strokeStyle = p.ink;
    ctx.lineCap = 'round';
    if (ok) {
      ctx.moveTo(x - r * 0.45, y + r * 0.02);
      ctx.lineTo(x - r * 0.1, y + r * 0.38);
      ctx.lineTo(x + r * 0.48, y - r * 0.34);
    } else {
      ctx.moveTo(x - r * 0.38, y - r * 0.38);
      ctx.lineTo(x + r * 0.38, y + r * 0.38);
      ctx.moveTo(x + r * 0.38, y - r * 0.38);
      ctx.lineTo(x - r * 0.38, y + r * 0.38);
    }
    ctx.stroke();
  }

  // An arrow pointing left/right in a filled chip; the title scope strip and rules use it.
  function arrow(ctx, x, y, r, dir) {
    const p = palette();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(num(dir, 1), 1);
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r * 0.2, -r);
    ctx.lineTo(r * 0.2, -r * 0.42);
    ctx.lineTo(r, -r * 0.42);
    ctx.lineTo(r, r * 0.42);
    ctx.lineTo(r * 0.2, r * 0.42);
    ctx.lineTo(r * 0.2, r);
    ctx.closePath();
    ctx.fillStyle = p.sky;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    ctx.restore();
  }

  // A bloom cup: a trapezoid cup with three petals peeking over the rim.
  function cup(ctx, x, y, w, h, col) {
    const p = palette();
    ctx.save();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = p.ink;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y);
    ctx.lineTo(x - w * 0.36, y + h);
    ctx.lineTo(x + w * 0.36, y + h);
    ctx.lineTo(x + w * 0.5, y);
    ctx.closePath();
    ctx.fillStyle = col || p.sky;
    ctx.fill();
    ctx.stroke();
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.ellipse(x + i * w * 0.22, y - h * 0.08, w * 0.15, h * 0.22, i * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? p.gold : p.pink;
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- quantified scope strip ----------

  // The one-line scope, counted from PB_CONFIG/PB_NAMES so the numbers can never drift.
  function scopeText() {
    const n = names();
    const c = config();
    const builds = (n.contraptions || []).length || 5;
    const pests = (n.pests || []).length || 4;
    const showers = (n.days || c.days || []).length * 3 || 9;
    const drafts = (n.draftPool || []).length || 12;
    const diffs = (c.difficultyOrder || []).length || 3;
    return builds + ' CONTRAPTIONS - ' + pests + ' PESTS + THE DUSKFATHER - ' + showers + ' SHOWERS - ' + drafts + ' DRAFTS - ' + diffs + ' DIFFICULTIES'
      + ' - ENDLESS OVERBLOOM';
  }

  // Draws the scope strip centred on x + w/2 in a cream capsule with a gold edge.
  // Returns the strip rect.
  function scopeStrip(ctx, x, y, w) {
    const p = palette();
    const h = 40;
    const label = scopeText();
    roundRect(ctx, x, y, w, h, h * 0.5, p.paper);
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.gold;
    roundRectPath(ctx, x, y, w, h, h * 0.5);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = rgba(p.ink, 0.35);
    roundRectPath(ctx, x + 4, y + 4, w - 8, h - 8, (h - 8) * 0.5);
    ctx.stroke();
    circle(ctx, x + 22, y + h * 0.5, 6, p.coral, p.ink, 1.8);
    circle(ctx, x + w - 22, y + h * 0.5, 6, p.mint, p.ink, 1.8);
    textFit(ctx, label, x + w * 0.5, y + h * 0.5 + 1, w - 64, 22, { align: 'center', fill: p.ink, minSize: 10 });
    return { x: x, y: y, w: w, h: h };
  }

  // ---------- rules digest ----------

  const RULES = [
    { key: 'drop', lead: 'DROP', tail: 'the dawn', icon: 'drop' },
    { key: 'turn', lead: 'TURN', tail: 'gates to steer', icon: 'turn' },
    { key: 'bloom', lead: 'BLOOM', tail: 'cups to grow the CASCADE', icon: 'cup' },
    { key: 'pests', lead: 'PESTS', tail: 'clog and drain - pop them', icon: 'pests' },
    { key: 'win', lead: 'WIN', tail: 'quota in all 9 showers + Duskfather down', icon: 'win' },
    { key: 'lose', lead: 'LOSE', tail: 'the Sunwell runs dry', icon: 'lose' },
  ];

  function rulesIcon(ctx, kind, x, y, r) {
    const p = palette();
    if (kind === 'drop') {
      dropletBall(ctx, x, y, r * 0.72, true);
      ctx.beginPath();
      ctx.moveTo(x + r * 0.9, y - r * 0.9);
      ctx.lineTo(x + r * 0.9, y + r * 0.2);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = rgba(p.ink, 0.5);
      ctx.setLineDash([2, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (kind === 'turn') {
      ctx.save();
      roundRect(ctx, x - r * 0.18, y - r * 0.18, r * 1.5, r * 0.36, r * 0.18, p.pink);
      ctx.lineWidth = 2;
      ctx.strokeStyle = p.ink;
      roundRectPath(ctx, x - r * 0.18, y - r * 0.18, r * 1.5, r * 0.36, r * 0.18);
      ctx.stroke();
      circle(ctx, x, y, r * 0.32, p.gold, p.ink, 2);
      ctx.restore();
      arrow(ctx, x - r * 0.8, y - r * 0.7, r * 0.3, -1);
      arrow(ctx, x + r * 0.8, y - r * 0.7, r * 0.3, 1);
    } else if (kind === 'cup') {
      cup(ctx, x, y - r * 0.15, r * 1.2, r * 0.78, p.mint);
    } else if (kind === 'pests') {
      const s = globalThis.PB_Sprites;
      if (s && typeof s.icon === 'function') s.icon(ctx, 'clingmoth', x - r * 0.35, y, r * 0.62);
      else circle(ctx, x - r * 0.35, y, r * 0.5, p.pink, p.ink, 2);
      circle(ctx, x + r * 0.5, y + r * 0.1, r * 0.42, p.leaf, p.ink, 2);
      check(ctx, x + r * 0.72, y - r * 0.6, r * 0.3, false);
    } else if (kind === 'win') {
      circle(ctx, x, y, r * 0.9, p.gold, p.ink, 2.2);
      check(ctx, x, y, r * 0.6, true);
    } else if (kind === 'lose') {
      circle(ctx, x, y, r * 0.9, mix(p.cream, p.coral, 0.22), p.ink, 2.2);
      check(ctx, x, y, r * 0.55, false);
    }
  }

  // Six rules rows with simple icons. Heading is bold coral, the rest of the row reads as one
  // sentence at thumbnail size. Returns the bottom y.
  function rulesDigest(ctx, x, y, w, opts) {
    const p = palette();
    const o = opts || {};
    const rowH = num(o.rowH, 46);
    const size = num(o.size, 21);
    for (let i = 0; i < RULES.length; i += 1) {
      const rule = RULES[i];
      const ry = y + i * rowH;
      const win = rule.key === 'win';
      const lose = rule.key === 'lose';
      const fill = win ? mix(p.paper, p.mint, 0.28) : lose ? mix(p.paper, p.coral, 0.2) : i % 2 === 0 ? rgba(p.paper, 0.9) : rgba(p.cream, 0.9);
      roundRect(ctx, x, ry, w, rowH - 6, 10, fill);
      ctx.lineWidth = win || lose ? 2.6 : 1.6;
      ctx.strokeStyle = win ? p.leaf : lose ? p.coral : rgba(p.ink, 0.22);
      roundRectPath(ctx, x, ry, w, rowH - 6, 10);
      ctx.stroke();
      rulesIcon(ctx, rule.icon, x + 26, ry + (rowH - 6) * 0.5, 15);
      // "DROP" (bold) + "the dawn" (regular-ish) read as one line; drawn twice to weight the lead.
      const lead = rule.lead + ' ';
      const leadW = measure(ctx, lead, size);
      const lineY = ry + (rowH - 6) * 0.5 + 1;
      text(ctx, lead, x + 52, lineY, size, { fill: win ? p.leaf : lose ? p.coral : p.ink });
      textFit(ctx, rule.tail, x + 52 + leadW, lineY, w - 70 - leadW, size, { align: 'left', fill: p.ink, minSize: 11 });
    }
    return y + RULES.length * rowH;
  }

  // One digest row on its own, for the menus and the draft forecast footnote.
  function ruleRow(ctx, key, x, y, w, h) {
    const p = palette();
    let rule = RULES[0];
    for (let i = 0; i < RULES.length; i += 1) if (RULES[i].key === key) rule = RULES[i];
    roundRect(ctx, x, y, w, h, 10, p.paper);
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(p.ink, 0.3);
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.stroke();
    rulesIcon(ctx, rule.icon, x + 24, y + h * 0.5, 13);
    text(ctx, rule.lead + ' ' + rule.tail, x + 48, y + h * 0.5 + 1, num(h * 0.5, 20), { fill: p.ink });
  }

  // Translucent cream wash kept bright: dims a demo cascade without turning the scene grey.
  function wash(ctx, alpha) {
    const p = palette();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = rgba(p.cream, num(alpha, 0.55));
    ctx.fillRect(0, 0, W, num(config().canvas && config().canvas.H, 800));
    ctx.restore();
  }

  globalThis.PB_Howto = {
    scopeStrip: scopeStrip,
    scopeText: scopeText,
    rulesDigest: rulesDigest,
    ruleRow: ruleRow,
    rules: RULES,
    fitHeading: fitHeading,
    fitSize: fitSize,
    button: button,
    wash: wash,
    text: text,
    textFit: textFit,
    measure: measure,
    roundRect: roundRect,
    roundRectPath: roundRectPath,
    circle: circle,
    flower: flower,
    petal: petal,
    dropletBall: dropletBall,
    seed: seed,
    check: check,
    arrow: arrow,
    cup: cup,
    mix: mix,
    rgba: rgba,
    num: num,
    clamp: clamp,
  };
})();
