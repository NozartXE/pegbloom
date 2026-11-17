// The title screen: a live demo cascade washed in cream behind the PEGBLOOM wordmark, scope strip, six-row rules digest, PINA and Duskfather spot art and every menu button.
(function () {
  if (typeof globalThis.PB_Title === 'object' && globalThis.PB_Title !== null) return;

  const W = 1280;
  const H = 800;
  const LOGO = { x: 540, y: 26, r: 44 };
  const WORD_Y = 112;
  // wordmark cap: the heading fits both the width and a 150 px-tall band inside y 30..195
  const WORD_MARK = { x: 30, y: 30, w: 1220, h: 150 };
  const WORD_HI = Math.round(WORD_MARK.h * 0.85);
  const TAG_Y = 168;
  const PLAY = { x: 640, y: 236, w: 300, h: 52 };
  const DIFF = { x: 640, y: 298, w: 300, h: 40 };
  const BEST = { x: 640, y: 346, w: 300, h: 32 };
  const RULES = { x: 68, y: 196, w: 470, rowH: 46 };
  const OVER = { x: 798, y: 382, w: 470, h: 56 };
  const MENU = { x: 798, y: 448, w: 470, h: 38 };
  const SCOPE = { x: 68, y: 584, w: 1200 };
  const NEWBEST = { x: 68, y: 632, w: 470, h: 66 };
  const SCOPE_LABEL = 'SCOPE: 5 contraptions - 4 pests + the Duskfather - 9 showers - 12 drafts - 3 difficulties';
  const CONTROLS = 'SPACE / ENTER start - <- -> choose difficulty - 1 2 3 difficulty - H how to - O options - A almanac - M mute - T title';
  const BEST_HINT = 'BEST - NO RUNS YET - BE THE FIRST';

  function palette() {
    return globalThis.PB_PALETTE || {
      cream: '#FFF6E9', paper: '#FFFDF6', coral: '#FF7A59', gold: '#FFC53D', sky: '#57B8FF',
      mint: '#4FD8A5', pink: '#FF9FB2', leaf: '#58B368', ink: '#2B2118',
    };
  }

  function names() {
    return globalThis.PB_NAMES || { days: [], feats: [], difficultyOrder: [] };
  }

  function config() {
    return globalThis.PB_CONFIG || { difficultyOrder: ['Gentle', 'Normal', 'Scorched'], draft: { rerollCost: 3 } };
  }

  function howto() {
    return globalThis.PB_Howto || {};
  }

  function board() {
    return globalThis.PB_Board || {};
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function p() {
    return palette();
  }

  function rgba(hex, a) {
    return howto().rgba ? howto().rgba(hex, a) : hex;
  }

  function mix(hex, toward, amount) {
    return howto().mix ? howto().mix(hex, toward, amount) : hex;
  }

  function roundRect(ctx, x, y, w, h, r, fill) {
    if (howto().roundRect) return howto().roundRect(ctx, x, y, w, h, r, fill);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    return ctx;
  }

  function text(ctx, str, x, y, size, spec) {
    if (howto().text) return howto().text(ctx, str, x, y, size, spec);
    ctx.fillStyle = (spec && spec.fill) || p().ink;
    ctx.fillText(String(str), x, y);
  }

  function textFit(ctx, str, x, y, maxW, size, spec) {
    const s = spec || {};
    const label = String(str == null ? '' : str);
    let fit = Math.max(6, num(size, 24));
    const floor = Math.max(5, num(s.minSize, 8));
    ctx.save();
    ctx.font = 'bold ' + Math.round(fit) + 'px "Arial Narrow", Arial, sans-serif';
    while (fit > floor && ctx.measureText(label).width > maxW) {
      fit -= 1;
      ctx.font = 'bold ' + Math.round(fit) + 'px "Arial Narrow", Arial, sans-serif';
    }
    if (s.align) ctx.textAlign = s.align;
    if (s.baseline) ctx.textBaseline = s.baseline;
    if (s.stroke) {
      ctx.lineWidth = num(s.strokeW, 4);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = s.stroke;
      ctx.strokeText(label, x, y);
    }
    ctx.fillStyle = s.fill || p().ink;
    ctx.fillText(label, x, y);
    const width = ctx.measureText(label).width;
    ctx.restore();
    return { size: fit, width: width, x: x, y: y };
  }

  function circle(ctx, x, y, r, fill, stroke, lw) {
    if (howto().circle) return howto().circle(ctx, x, y, r, fill, stroke, lw);
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

  function fitHeading(ctx, str, x, y, maxW, opts) {
    if (howto().fitHeading) return howto().fitHeading(ctx, str, x, y, maxW, opts);
    text(ctx, str, x, y, 64, opts);
    return { size: 64, width: maxW, x: x, y: y };
  }

  // ---------- save state (never invented: read PB_Save, fall back to zeros) ----------

  function saveData() {
    const s = globalThis.PB_Save;
    if (!s) return { best: 0, feats: {}, runs: 0, cleared: false };
    let data = null;
    if (typeof s.get === 'function') data = s.get();
    else if (typeof s.load === 'function') data = s.load();
    data = data || {};
    const best = Math.max(0, Math.round(num(data.best, 0)));
    let featCount = 0;
    if (typeof s.featsCount === 'function') featCount = num(s.featsCount(), 0);
    else if (data.feats) for (const k in data.feats) if (data.feats[k]) featCount += 1;
    const history = Array.isArray(data.history) ? data.history : [];
    let cleared = false;
    for (let i = 0; i < history.length; i += 1) if (history[i] && history[i].won) cleared = true;
    return { best: best, feats: featCount, runs: history.length, cleared: cleared };
  }

  // OVERBLOOM unlocks once any run has driven off the Duskfather (or endless was reached).
  function overbloomUnlocked(sim, save) {
    if (save && save.cleared) return true;
    if (sim && (sim.endless === true || sim.bossDown === true)) return true;
    return false;
  }

  function featTotal() {
    const list = names().feats || [];
    if (list.length) return list.length;
    return num(config().featCount, 6);
  }

  function formatScore(n) {
    if (globalThis.PB_Hud && typeof globalThis.PB_Hud.formatScore === 'function') return globalThis.PB_Hud.formatScore(n);
    return String(Math.max(0, Math.round(num(n, 0)))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function selectedDifficulty(view) {
    const order = config().difficultyOrder || ['Gentle', 'Normal', 'Scorched'];
    const key = String((view && (view.difficulty || view.selectedDifficulty)) || 'Normal');
    for (let i = 0; i < order.length; i += 1) if (order[i] === key) return key;
    return 'Normal';
  }

  function diffCaption(key) {
    const def = (config().difficulties || {})[key] || {};
    const sun = num(def.sunwell, 10);
    const quota = Math.round(num(def.quotaMul, 1) * 100);
    const balls = Math.round(num(def.ballMul, 1) * 100);
    const pest = Math.round(num(def.pestMul, 1) * 100);
    return 'SUNWELL ' + sun + ' - QUOTA ' + quota + '% - BALLS ' + balls + '% - PESTS ' + pest + '%';
  }

  // ---------- backdrop: live demo cascade washed in cream ----------

  function drawDemo(ctx, view) {
    const sim = view && (view.demo || view.sim || view.demoSim);
    if (!sim) return false;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (board().draw) board().draw(ctx, sim, view);
    if (globalThis.PB_Sprites && globalThis.PB_Sprites.draw) globalThis.PB_Sprites.draw(ctx, sim);
    if (globalThis.PB_Balls && globalThis.PB_Balls.draw) globalThis.PB_Balls.draw(ctx, sim);
    if (globalThis.PB_Fx && globalThis.PB_Fx.draw) globalThis.PB_Fx.draw(ctx, sim);
    ctx.restore();
    return true;
  }

  function wash(ctx, alpha) {
    const h = howto();
    if (typeof h.wash === 'function') return h.wash(ctx, alpha);
    ctx.fillStyle = rgba(p().cream, alpha);
    ctx.fillRect(0, 0, W, H);
  }

  // Without a demo sim the backdrop is a soft garden of pegs and petals, still bright.
  function drawnBackdrop(ctx, tick) {
    const q = p();
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, mix(q.cream, q.sky, 0.16));
    g.addColorStop(0.5, q.cream);
    g.addColorStop(1, mix(q.cream, q.gold, 0.22));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 16; col += 1) {
        const x = 40 + col * 80 + (row % 2) * 40;
        const y = 120 + row * 72;
        const lit = Math.sin(num(tick, 0) * 0.03 + row * 0.9 + col * 0.6) > 0.55;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fillStyle = lit ? q.gold : mix(q.paper, q.coral, 0.25);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = rgba(q.ink, 0.25);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 7; i += 1) {
      const h = howto();
      if (h.flower) h.flower(ctx, 90 + i * 190, 690 + Math.sin(i * 1.7) * 34, 26 + (i % 3) * 7, i % 2 ? q.pink : q.mint, q.gold);
    }
  }

  // ---------- markup ----------

  function logoMark(ctx, x, y, r) {
    const q = p();
    // petal-and-peg: gold peg in a ring of petals, with two dew drops on the sides
    ctx.save();
    ctx.translate(x, y);
    for (let i = 0; i < 8; i += 1) {
      const a = (i * Math.PI) / 4 + 0.18;
      const col = i % 2 === 0 ? q.pink : q.gold;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.62, r * 0.28, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = q.ink;
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = q.coral;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = q.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = q.gold;
    ctx.fill();
    ctx.restore();
  }

  function wordmark(ctx) {
    const q = p();
    const h = howto();
    const size = h.fitHeading ? h.fitHeading(ctx, 'PEGBLOOM', W * 0.5, WORD_Y, WORD_MARK.w, {
      align: 'center', fill: q.coral, stroke: q.ink, strokeW: 12, spacing: 4, baseline: 'alphabetic', hi: WORD_HI,
    }) : null;
    // a slim mint underline keeps the word grounded on the cream
    const drawn = size ? Math.min(size.size, WORD_HI) : WORD_HI;
    const penY = WORD_Y + (size ? Math.max(0, (WORD_HI - drawn) * 0.5) : 0);
    const w = size ? size.width : W - 80;
    const x0 = W * 0.5 - w * 0.5;
    roundRect(ctx, x0 + w * 0.18, penY + 8, w * 0.64, 8, 4, q.mint);
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.18, penY + 12);
    ctx.lineTo(x0 + w * 0.82, penY + 12);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = q.ink;
    ctx.stroke();
    textFit(ctx, 'DROP THE DAWN. BLOOM THE BOARD.', W * 0.5, TAG_Y, W - 120, 22, { align: 'center', fill: q.ink, minSize: 10 });
  }

  function bestLine(ctx, save, y) {
    const q = p();
    roundRect(ctx, BEST.x, BEST.y, BEST.w, BEST.h, BEST.h * 0.5, q.paper);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = rgba(q.ink, 0.4);
    howto().roundRectPath(ctx, BEST.x, BEST.y, BEST.w, BEST.h, BEST.h * 0.5);
    ctx.stroke();
    const best = save.best > 0 ? 'BEST ' + formatScore(save.best) : BEST_HINT;
    textFit(ctx, best, BEST.x + BEST.w * 0.5 - 50, y, BEST.w - 180, 16, { align: 'center', fill: q.ink, minSize: 9 });
    const feat = 'FEATS ' + Math.round(save.feats) + '/' + featTotal();
    textFit(ctx, feat, BEST.x + BEST.w - 16, y, 120, 16, { align: 'right', fill: save.feats > 0 ? q.leaf : q.ink, minSize: 9 });
  }

  function difficultyButtons(ctx, view, save, buttons) {
    const q = p();
    const order = config().difficultyOrder || ['Gentle', 'Normal', 'Scorched'];
    const key = selectedDifficulty(view);
    const gap = 8;
    const bw = (PLAY.w - gap * (order.length - 1)) / order.length;
    for (let i = 0; i < order.length; i += 1) {
      const name = order[i];
      const x = DIFF.x + PLAY.w * 0.5 - (PLAY.w + gap * (order.length - 1)) * 0.5 + i * (bw + gap);
      const sel = name === key;
      const hit = howto().button(ctx, x, DIFF.y, bw, DIFF.h, String(name).toUpperCase(), {
        fill: sel ? q.gold : mix(q.paper, q.sky, 0.1),
        ring: sel ? q.coral : null,
        size: 19,
        r: 8,
        borderWidth: 2.6,
      });
      // key hint column above each difficulty button
      textFit(ctx, String(i + 1), x + bw * 0.5, DIFF.y - 8, 20, 13, { align: 'center', fill: rgba(q.ink, 0.6), minSize: 9 });
      hit.difficulty = name;
      hit.selected = sel;
      buttons['diff' + i] = hit;
      if (name === key) buttons.difficulty = hit;
      buttons['difficulty_' + name] = hit;
    }
    textFit(ctx, diffCaption(key), W * 0.5, DIFF.y + DIFF.h + 18, W * 0.5, 15, { align: 'center', fill: q.ink, minSize: 9 });
  }

  function rulesPanel(ctx) {
    const q = p();
    if (typeof howto().rulesDigest !== 'function') return;
    textFit(ctx, 'HOW IT PLAYS', RULES.x, RULES.y - 16, RULES.w, 24, { align: 'left', fill: q.coral, minSize: 12 });
    roundRect(ctx, RULES.x - 12, RULES.y - 34, RULES.w + 24, RULES.rowH * 6 + 44, 16, rgba(q.paper, 0.96));
    ctx.lineWidth = 3;
    ctx.strokeStyle = q.ink;
    howto().roundRectPath(ctx, RULES.x - 12, RULES.y - 34, RULES.w + 24, RULES.rowH * 6 + 44, 16);
    ctx.stroke();
    textFit(ctx, 'HOW IT PLAYS', RULES.x, RULES.y - 16, RULES.w, 24, { align: 'left', fill: q.coral, minSize: 12 });
    howto().rulesDigest(ctx, RULES.x, RULES.y, RULES.w, { rowH: RULES.rowH, size: 20 });
  }

  // PINA, keeper of the Bloom Engine: mint apron, gold hair bun, sky watering can.
  function pina(ctx, x, y, s) {
    const q = p();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // ground shadow stays pale
    ctx.beginPath();
    ctx.ellipse(0, 82, 62, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(q.ink, 0.1);
    ctx.fill();
    // dress
    ctx.beginPath();
    ctx.moveTo(-30, 8);
    ctx.quadraticCurveTo(-52, 48, -54, 80);
    ctx.lineTo(54, 80);
    ctx.quadraticCurveTo(52, 48, 30, 8);
    ctx.closePath();
    ctx.fillStyle = q.mint;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = q.ink;
    ctx.stroke();
    // apron + pockets
    roundRect(ctx, -22, 22, 44, 48, 8, q.paper);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = q.ink;
    howto().roundRectPath(ctx, -22, 22, 44, 48, 8);
    ctx.stroke();
    circle(ctx, -10, 50, 4, q.gold, q.ink, 1.6);
    // arms
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.strokeStyle = q.ink;
    ctx.beginPath();
    ctx.moveTo(-28, 22);
    ctx.lineTo(-40, 54);
    ctx.moveTo(28, 22);
    ctx.lineTo(48, 44);
    ctx.stroke();
    ctx.strokeStyle = q.pink;
    ctx.lineWidth = 8;
    ctx.stroke();
    // head
    circle(ctx, 0, -22, 30, mix(q.gold, q.paper, 0.55), q.ink, 3);
    // hair bun
    circle(ctx, 0, -50, 14, q.gold, q.ink, 2.6);
    ctx.beginPath();
    ctx.arc(0, -22, 30, Math.PI * 0.95, Math.PI * 2.05);
    ctx.closePath();
    ctx.fillStyle = q.gold;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = q.ink;
    ctx.stroke();
    // face: ink dot eyes, blush
    circle(ctx, -9, -20, 2.8, q.ink);
    circle(ctx, 9, -20, 2.8, q.ink);
    circle(ctx, -17, -12, 4, rgba(q.coral, 0.55));
    circle(ctx, 17, -12, 4, rgba(q.coral, 0.55));
    ctx.beginPath();
    ctx.arc(0, -14, 7, 0.25, Math.PI - 0.25);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = q.ink;
    ctx.stroke();
    // flower in the bun
    if (howto().flower) howto().flower(ctx, 20, -58, 10, q.pink, q.gold);
    // watering can in the right hand
    ctx.save();
    ctx.translate(58, 50);
    ctx.rotate(-0.25);
    roundRect(ctx, -16, -16, 34, 30, 6, q.sky);
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = q.ink;
    howto().roundRectPath(ctx, -16, -16, 34, 30, 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(18, -8);
    ctx.lineTo(36, -22);
    ctx.lineWidth = 7;
    ctx.strokeStyle = q.sky;
    ctx.stroke();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = q.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-2, -16, 9, Math.PI, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = q.ink;
    ctx.stroke();
    for (let i = 0; i < 3; i += 1) {
      circle(ctx, 37 + i * 8, -20 + i * 7, 3.4, q.sky, q.ink, 1.4);
    }
    ctx.restore();
    ctx.restore();
  }

  // THE DUSKFATHER: a giant moth in cream and coral, bright and grand rather than scary.
  function duskfather(ctx, x, y, s) {
    const q = p();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.ellipse(0, 96, 96, 16, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(q.ink, 0.1);
    ctx.fill();
    for (let side = -1; side <= 1; side += 2) {
      // upper wing
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.quadraticCurveTo(side * 70, -86, side * 104, -52);
      ctx.quadraticCurveTo(side * 118, -12, side * 52, 8);
      ctx.closePath();
      ctx.fillStyle = q.cream;
      ctx.fill();
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = q.ink;
      ctx.stroke();
      // coral margin + eye spot
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.quadraticCurveTo(side * 70, -86, side * 104, -52);
      ctx.quadraticCurveTo(side * 104, -36, side * 78, -30);
      ctx.quadraticCurveTo(side * 46, -30, 0, -10);
      ctx.closePath();
      ctx.fillStyle = q.coral;
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = q.ink;
      ctx.stroke();
      circle(ctx, side * 66, -34, 9, q.gold, q.ink, 2.4);
      circle(ctx, side * 66, -34, 4, q.ink);
      // lower wing
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.quadraticCurveTo(side * 74, 16, side * 74, 60);
      ctx.quadraticCurveTo(side * 50, 92, 0, 66);
      ctx.closePath();
      ctx.fillStyle = mix(q.pink, q.paper, 0.35);
      ctx.fill();
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = q.ink;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(side * 44, 54, 14, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = q.coral;
      ctx.stroke();
    }
    // body
    ctx.beginPath();
    ctx.ellipse(0, 24, 20, 58, 0, 0, Math.PI * 2);
    ctx.fillStyle = q.cream;
    ctx.fill();
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = q.ink;
    ctx.stroke();
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-15, -4 + i * 20);
      ctx.quadraticCurveTo(0, 4 + i * 20, 15, -4 + i * 20);
      ctx.lineWidth = 3;
      ctx.strokeStyle = q.coral;
      ctx.stroke();
    }
    // head + feathered antennae
    circle(ctx, 0, -40, 17, q.cream, q.ink, 3.2);
    circle(ctx, -6, -42, 3, q.ink);
    circle(ctx, 6, -42, 3, q.ink);
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(side * 6, -54);
      ctx.quadraticCurveTo(side * 26, -84, side * 44, -78);
      ctx.lineWidth = 3;
      ctx.strokeStyle = q.ink;
      ctx.stroke();
      for (let k = 1; k <= 4; k += 1) {
        const t = k / 5;
        const ax = side * (6 + 38 * t);
        const ay = -54 - 30 * Math.sin(t * Math.PI * 0.9) * (0.8 + t * 0.2);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + side * 7, ay + 9);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = q.coral;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function characterPlates(ctx) {
    const q = p();
    // PINA plate sits under the rules panel; the Duskfather plate beside it.
    const pinaBox = { x: NEWBEST.x, y: NEWBEST.y + NEWBEST.h + 14, w: 250, h: 126 };
    const bossBox = { x: pinaBox.x + pinaBox.w + 14, y: pinaBox.y, w: NEWBEST.w - pinaBox.w - 14, h: pinaBox.h };
    roundRect(ctx, pinaBox.x, pinaBox.y, pinaBox.w, pinaBox.h, 14, mix(q.paper, q.mint, 0.18));
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = q.ink;
    howto().roundRectPath(ctx, pinaBox.x, pinaBox.y, pinaBox.w, pinaBox.h, 14);
    ctx.stroke();
    pina(ctx, pinaBox.x + 52, pinaBox.y + 58, 0.5);
    textFit(ctx, 'PINA', pinaBox.x + 104, pinaBox.y + 38, pinaBox.w - 112, 24, { align: 'left', fill: q.ink, minSize: 11 });
    textFit(ctx, 'KEEPER OF THE BLOOM ENGINE', pinaBox.x + 104, pinaBox.y + 62, pinaBox.w - 112, 14, { align: 'left', fill: q.ink, minSize: 8 });
    textFit(ctx, 'STEERS THE CAN, TURNS THE GATES', pinaBox.x + 104, pinaBox.y + 84, pinaBox.w - 112, 13, { align: 'left', fill: rgba(q.ink, 0.72), minSize: 8 });
    textFit(ctx, 'DOWN THE CASCADE', pinaBox.x + 104, pinaBox.y + 102, pinaBox.w - 112, 13, { align: 'left', fill: rgba(q.ink, 0.72), minSize: 8 });
    roundRect(ctx, bossBox.x, bossBox.y, bossBox.w, bossBox.h, 14, mix(q.paper, q.coral, 0.16));
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = q.ink;
    howto().roundRectPath(ctx, bossBox.x, bossBox.y, bossBox.w, bossBox.h, 14);
    ctx.stroke();
    duskfather(ctx, bossBox.x + 52, bossBox.y + 56, 0.4);
    textFit(ctx, 'THE DUSKFATHER', bossBox.x + 108, bossBox.y + 34, bossBox.w - 116, 21, { align: 'left', fill: q.ink, minSize: 10 });
    textFit(ctx, 'GIANT MOTH - 24 HP - SHOWER 9', bossBox.x + 108, bossBox.y + 58, bossBox.w - 116, 13, { align: 'left', fill: q.ink, minSize: 8 });
    textFit(ctx, 'STEALS THE PEBBOARD - TRAP HIM', bossBox.x + 108, bossBox.y + 80, bossBox.w - 116, 13, { align: 'left', fill: rgba(q.ink, 0.72), minSize: 8 });
    textFit(ctx, 'TO WIN: GET HIM TO 0 HP', bossBox.x + 108, bossBox.y + 100, bossBox.w - 116, 13, { align: 'left', fill: rgba(q.ink, 0.72), minSize: 8 });
  }

  function clipRect(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  }

  // ---------- draw ----------

  function draw(ctx, view) {
    if (!ctx) return;
    const v = view || {};
    const q = p();
    const save = saveData();
    const tick = num(v.tick, num(v.demo && v.demo.tick, 0));
    const buttons = v.buttons || (v.buttons = {});
    for (const k in buttons) if (Object.prototype.hasOwnProperty.call(buttons, k)) delete buttons[k];
    v.difficulty = selectedDifficulty(v);
    v.difficulties = (config().difficultyOrder || []).slice();
    v.feats = save.feats;
    v.featsTotal = featTotal();
    v.best = save.best;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (!drawDemo(ctx, v)) {
      drawnBackdrop(ctx, tick);
      wash(ctx, 0.25);
    } else {
      wash(ctx, 0.62);
    }
    // bright halo behind the wordmark so type stays high-contrast over moving balls
    const halo = ctx.createLinearGradient(0, 0, 0, 200);
    halo.addColorStop(0, rgba(q.paper, 0.94));
    halo.addColorStop(0.65, rgba(q.paper, 0.7));
    halo.addColorStop(1, rgba(q.paper, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, 200);

    logoMark(ctx, LOGO.x, LOGO.y, LOGO.r);
    wordmark(ctx);

    // main column
    const playX = PLAY.x + PLAY.w * 0.5 - PLAY.w * 0.5;
    const playBut = howto().button(ctx, playX, PLAY.y, PLAY.w, PLAY.h, 'PLAY', {
      fill: q.coral, size: 40, r: 14, ink: q.paper, borderWidth: 4,
    });
    playBut.id = 'play';
    buttons.play = playBut;
    textFit(ctx, 'SPACE', PLAY.x + PLAY.w + 16, PLAY.y + PLAY.h * 0.5, 80, 22, { align: 'left', fill: q.ink, minSize: 10 });
    roundRect(ctx, PLAY.x + PLAY.w + 10, PLAY.y + 6, 78, PLAY.h - 12, 10, q.paper);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = q.ink;
    howto().roundRectPath(ctx, PLAY.x + PLAY.w + 10, PLAY.y + 6, 78, PLAY.h - 12, 10);
    ctx.stroke();
    textFit(ctx, 'SPACE', PLAY.x + PLAY.w + 49, PLAY.y + PLAY.h * 0.5 + 1, 62, 19, { align: 'center', fill: q.ink, minSize: 9 });
    buttons.space = { x: PLAY.x + PLAY.w + 10, y: PLAY.y + 6, w: 78, h: PLAY.h - 12, label: 'SPACE' };

    textFit(ctx, 'DIFFICULTY', DIFF.x + DIFF.w * 0.5 - (PLAY.w + 24) * 0.5, DIFF.y - 8, 130, 13, { align: 'left', fill: rgba(q.ink, 0.6), minSize: 9 });
    difficultyButtons(ctx, v, save, buttons);
    bestLine(ctx, save, BEST.y + BEST.h * 0.5);

    rulesPanel(ctx);

    // OVERBLOOM endless line
    const unlocked = overbloomUnlocked(v.demo || v.sim, save);
    roundRect(ctx, OVER.x, OVER.y, OVER.w, OVER.h, 12, unlocked ? q.mint : mix(q.paper, q.gold, 0.4));
    ctx.lineWidth = 3;
    ctx.strokeStyle = unlocked ? q.leaf : q.ink;
    howto().roundRectPath(ctx, OVER.x, OVER.y, OVER.w, OVER.h, 12);
    ctx.stroke();
    textFit(ctx, unlocked ? 'OVERBLOOM: ENDLESS SHOWERS - UNLOCKED' : 'OVERBLOOM LOCKS UNTIL YOU CLEAR ALL 9 SHOWERS', OVER.x + OVER.w * 0.5, OVER.y + OVER.h * 0.5 + 1, OVER.w - 28, 22, { align: 'center', fill: q.ink, minSize: 10 });
    buttons.overbloom = { x: OVER.x, y: OVER.y, w: OVER.w, h: OVER.h, label: unlocked ? 'OVERBLOOM' : 'LOCKED', unlocked: unlocked };

    // HOW TO PLAY / OPTIONS / ALMANAC
    const menuLabels = ['HOW TO PLAY', 'OPTIONS', 'ALMANAC'];
    const menuKeys = ['H', 'O', 'A'];
    const ids = ['howto', 'options', 'almanac'];
    const gapM = 8;
    const mw = (MENU.w - gapM * 2) / 3;
    for (let i = 0; i < 3; i += 1) {
      const mx = MENU.x + i * (mw + gapM);
      const hit = howto().button(ctx, mx, MENU.y, mw, MENU.h, menuLabels[i], {
        fill: [q.sky, q.gold, q.leaf][i], chip: menuKeys[i], family: 'key', size: 18, r: 9, borderWidth: 2.6, fontScale: 0.48,
      });
      hit.id = ids[i];
      buttons[ids[i]] = hit;
      textFit(ctx, menuKeys[i], MENU.x - 22, MENU.y + MENU.h * 0.5 + 1, 24, 14, { align: 'left', fill: rgba(q.ink, 0.6), minSize: 9 });
    }

    // scope strip
    if (typeof howto().scopeStrip === 'function') howto().scopeStrip(ctx, SCOPE.x, SCOPE.y, SCOPE.w);

    characterPlates(ctx);

    // controls footer
    roundRect(ctx, 16, 752, 1248, 40, 10, q.cream);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = rgba(q.ink, 0.55);
    howto().roundRectPath(ctx, 16, 752, 1248, 40, 10);
    ctx.stroke();
    textFit(ctx, CONTROLS, 28, 772, 1180, 17, { align: 'left', fill: q.ink, minSize: 9 });

    ctx.restore();
    return buttons;
  }

  globalThis.PB_Title = {
    draw: draw,
    selectedDifficulty: selectedDifficulty,
    overbloomUnlocked: overbloomUnlocked,
    scopeLabel: SCOPE_LABEL,
    controls: CONTROLS,
    bestHint: BEST_HINT,
    layout: { play: PLAY, diff: DIFF, best: BEST, rules: RULES, over: OVER, menu: MENU, scope: SCOPE },
    pina: pina,
    duskfather: duskfather,
  };
})();
