// The results screen: grade plaque with the Duskfather spot art, stat tiles, grade thresholds, real run history, your build, feats, next goal and the per-shower graph.
(function () {
  if (typeof globalThis.PB_Results === 'object' && globalThis.PB_Results !== null) return;

  const W = 1280;
  const H = 800;
  const TITLE = { x: 24, y: 54, w: 420 };
  const PLAQUE = { x: 24, y: 94, w: 280, h: 296 };
  const SPOT = { x: 344, y: 168, s: 0.84 };
  const BUILD = { x: 572, y: 94, w: 300, h: 296 };
  const META = { x: 906, y: 94, w: 350, h: 296 };
  const META_Y = { x: 910, y: 118, w: 342 };
  const TILES = { x: 24, y: 414, w: 656, h: 76 };
  const THRESH = { x: 24, y: 514, w: 656, h: 212 };
  const FEATS = { x: 704, y: 414, w: 552, h: 100 };
  const GOAL = { x: 704, y: 534, w: 552, h: 64 };
  const HISTORY = { x: 704, y: 620, w: 552, h: 98 };
  const GRAPH = { x: 24, y: 712, w: 1232, h: 0 };
  const RUN_AGAIN = { x: 24, y: 712, w: 720, h: 64 };
  const TO_TITLE = { x: 756, y: 712, w: 500, h: 64 };
  const CONTROLS = 'R / ENTER run again - T title - GRADE AND FEATS ARE SAVED - H how to - A almanac';

  function palette() {
    return globalThis.PB_PALETTE || {
      cream: '#FFF6E9', paper: '#FFFDF6', coral: '#FF7A59', gold: '#FFC53D', sky: '#57B8FF',
      mint: '#4FD8A5', pink: '#FF9FB2', leaf: '#58B368', ink: '#2B2118',
    };
  }

  function config() {
    return globalThis.PB_CONFIG || { grades: [], sunwell: { max: 10 }, draft: { options: 3 }, difficultyOrder: ['Gentle', 'Normal', 'Scorched'] };
  }

  function names() {
    return globalThis.PB_NAMES || { feats: [], contraptions: [], draftPool: [], pests: [], bossInfo: {} };
  }

  // ---------- primitives: board first, then howto, then local fallbacks ----------

  function board(name) {
    const b = globalThis.PB_Board;
    return b && typeof b[name] === 'function' ? b[name] : null;
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function rgba(hex, a) {
    const f = board('rgba');
    if (f) return f(hex, a);
    const t = String(hex || '#000000').replace('#', '');
    const v = parseInt(t.length === 3 ? t[0] + t[0] + t[1] + t[1] + t[2] + t[2] : t, 16);
    return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + clamp(num(a, 1), 0, 1) + ')';
  }

  function mix(hex, toward, amount) {
    const f = board('mixHex');
    return f ? f(hex, toward, amount) : hex;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const f = board('roundRectPath');
    if (f) return f(ctx, x, y, w, h, r);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    return ctx;
  }

  function roundRect(ctx, x, y, w, h, r, fill) {
    const f = board('roundRect');
    if (f) return f(ctx, x, y, w, h, r, fill);
    roundRectPath(ctx, x, y, w, h, r);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    return ctx;
  }

  function text(ctx, str, x, y, size, spec) {
    const f = board('text');
    if (f) return f(ctx, str, x, y, size, spec);
    const s = spec || {};
    ctx.save();
    ctx.font = 'bold ' + Math.round(size) + 'px "Arial Narrow", Arial, sans-serif';
    ctx.textAlign = s.align || 'left';
    ctx.textBaseline = s.baseline || 'middle';
    ctx.fillStyle = s.fill || palette().ink;
    ctx.fillText(String(str), x, y);
    ctx.restore();
  }

  function textFit(ctx, str, x, y, maxW, size, spec) {
    const f = board('textFit');
    if (f) {
      f(ctx, str, x, y, maxW, size, spec);
      return;
    }
    text(ctx, str, x, y, size, spec);
  }

  function panel(ctx, x, y, w, h, spec) {
    const f = board('panel');
    if (f) return f(ctx, x, y, w, h, spec || {});
    return roundRect(ctx, x, y, w, h, num(spec && spec.r, 14), (spec && spec.fill) || palette().paper);
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

  function howto() {
    return globalThis.PB_Howto || {};
  }

  function fitHeading(ctx, str, x, y, maxW, opts) {
    const ht = howto();
    if (typeof ht.fitHeading === 'function') return ht.fitHeading(ctx, str, x, y, maxW, opts);
    text(ctx, str, x, y, 64, opts);
    return { size: 64, width: maxW, x: x, y: y };
  }

  // howto.button draws a chunky paper button; fall back to the same shape when it is absent.
  function button(ctx, x, y, w, h, label, opts) {
    const ht = howto();
    if (typeof ht.button === 'function') return ht.button(ctx, x, y, w, h, label, opts);
    const p = palette();
    const o = opts || {};
    roundRect(ctx, x, y, w, h, 12, o.fill || p.paper);
    ctx.lineWidth = 3;
    ctx.strokeStyle = o.border || p.ink;
    roundRectPath(ctx, x, y, w, h, 12);
    ctx.stroke();
    text(ctx, label, x + w * 0.5, y + h * 0.5 + 1, num(o.size, 24), { align: 'center', fill: o.ink || p.ink });
    return { x: x, y: y, w: w, h: h, label: String(label) };
  }

  // Letter-spaced wordmark-size text, clamped so a narrow font still fills most of its box.
  function trackedText(ctx, str, cx, y, maxW, size, spec) {
    const s = spec || {};
    const label = String(str == null ? '' : str);
    ctx.save();
    ctx.font = 'bold ' + Math.round(size) + 'px "Arial Narrow", "Roboto Condensed", Impact, Arial, sans-serif';
    ctx.textBaseline = s.baseline || 'middle';
    ctx.textAlign = 'left';
    const spacing = num(s.spacing, size * 0.06);
    const chars = label.split('');
    let natural = spacing * Math.max(0, chars.length - 1);
    for (let i = 0; i < chars.length; i += 1) natural += ctx.measureText(chars[i]).width;
    const scale = Math.min(num(s.maxScale, 1.35), Math.max(1, maxW / Math.max(1, natural)));
    let x = cx - (natural * scale) * 0.5;
    ctx.fillStyle = s.fill || palette().ink;
    if (s.stroke) {
      ctx.lineWidth = s.strokeW || 8;
      ctx.strokeStyle = s.stroke;
      ctx.lineJoin = 'round';
      let sx = x;
      for (let i = 0; i < chars.length; i += 1) {
        ctx.save();
        ctx.translate(sx, y);
        ctx.scale(scale, 1);
        ctx.strokeText(chars[i], 0, 0);
        ctx.restore();
        sx += (ctx.measureText(chars[i]).width + spacing) * scale;
      }
    }
    for (let i = 0; i < chars.length; i += 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, 1);
      ctx.fillText(chars[i], 0, 0);
      ctx.restore();
      x += (ctx.measureText(chars[i]).width + spacing) * scale;
    }
    ctx.restore();
    return natural * scale;
  }

  function formatScore(n) {
    if (globalThis.PB_Hud && typeof globalThis.PB_Hud.formatScore === 'function') return globalThis.PB_Hud.formatScore(n);
    return String(Math.max(0, Math.round(num(n, 0)))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatTicks(ticks) {
    const total = Math.max(0, num(ticks, 0)) / 60;
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ---------- the view: one finished run's summary, everything real ----------

  function grades() {
    const list = (config().grades || []).slice();
    list.sort(function (a, b) { return num(b.min, 0) - num(a.min, 0); });
    return list.length ? list : [{ grade: 'D', min: 0 }];
  }

  function gradeFor(score) {
    const list = grades();
    for (let i = 0; i < list.length; i += 1) if (num(score, 0) >= num(list[i].min, 0)) return list[i];
    return list[list.length - 1];
  }

  function nextGrade(score) {
    const list = grades();
    for (let i = list.length - 1; i >= 0; i -= 1) if (num(score, 0) < num(list[i].min, 0)) return list[i];
    return null;
  }

  function saveData() {
    const s = globalThis.PB_Save;
    if (!s) return { best: 0, feats: {}, history: [] };
    let data = null;
    if (typeof s.get === 'function') data = s.get();
    else if (typeof s.load === 'function') data = s.load();
    data = data || {};
    let history = Array.isArray(data.history) ? data.history.slice() : [];
    if (typeof s.lastRuns === 'function') {
      try {
        const last = s.lastRuns();
        if (Array.isArray(last) && last.length) history = last;
      } catch (err) {
        /* fall back to the full history */
      }
    }
    return {
      best: Math.max(0, Math.round(num(data.best, 0))),
      feats: data.feats && typeof data.feats === 'object' ? data.feats : {},
      history: history,
      previousBest: data.lastRun && data.lastRun.previousBest != null ? num(data.lastRun.previousBest, 0) : null,
    };
  }

  function readSim(view) {
    return (view && (view.sim || view.state)) || null;
  }

  function statValue(obj, namesInOrder, d) {
    if (!obj) return d;
    for (let i = 0; i < namesInOrder.length; i += 1) {
      const v = obj[namesInOrder[i]];
      if (typeof v === 'number' && isFinite(v)) return v;
    }
    return d;
  }

  function bossPicture(sim, summary) {
    const boss = sim && sim.boss ? sim.boss : null;
    if (boss) {
      if (boss.defeated === true || boss.alive === false) return { side: 'player', hp: 0, maxHp: num(boss.maxHp, 24) };
      return { side: 'boss', hp: Math.max(0, num(boss.hp, 0)), maxHp: num(boss.maxHp, 24) };
    }
    if (sim && sim.bossDown === true) return { side: 'player', hp: 0, maxHp: 24 };
    if (summary && summary.boss === 'player') return { side: 'player', hp: 0, maxHp: 24 };
    if (summary && summary.boss === 'boss') return { side: 'boss', hp: 0, maxHp: 24 };
    const won = summary && summary.won === true;
    return { side: won ? 'player' : 'boss', hp: 0, maxHp: 24 };
  }

  function buildFromSim(sim) {
    const sockets = (sim && sim.sockets) || [];
    const levelByKind = {};
    const kinds = [];
    for (let i = 0; i < sockets.length; i += 1) {
      const s = sockets[i];
      if (!s || !s.kind) continue;
      levelByKind[s.kind] = Math.max(num(levelByKind[s.kind], 0), num(s.level, 1));
      if (kinds.indexOf(s.kind) < 0) kinds.push(s.kind);
    }
    const shown = sim ? (sim.showcase || {}) : {};
    const owned = sim ? (sim.owned || {}) : {};
    const build = kinds.map(function (k) { return { key: k, level: levelByKind[k] }; });
    return { contraptions: build, drafts: sim ? (sim.draftLog || []).slice() : [], owned: owned, shown: shown };
  }

  // view.summary is the finished run; sim/state (or save.lastRun) fills whatever summary omits.
  function buildView(view) {
    const v = view || {};
    const sim = readSim(v);
    const save = saveData();
    const summary = v.summary || v.run || {};
    const stats = sim ? (sim.stats || {}) : {};
    const last = save.history.length ? save.history[save.history.length - 1] : null;
    const bl = summary.build || {};
    const score = Math.max(0, Math.round(num(statValue(summary, ['score'], num(sim && sim.score, 0)), 0)));
    const best = Math.max(0, Math.round(num(summary.best, save.best)));
    const history = Array.isArray(summary.history) && summary.history.length ? summary.history : save.history;
    const summaryStats = summary.stats || {};
    const perShower = Array.isArray(summaryStats.showers) ? summaryStats.showers
      : Array.isArray(summary.showerStats) ? summary.showerStats
      : sim && Array.isArray(sim.history) && sim.history.length ? sim.history : [];
    const build = {
      contraptions: bl.contraptions || buildFromSim(sim).contraptions,
      drafts: bl.drafts || (sim && Array.isArray(sim.draftLog) ? sim.draftLog : []),
      owned: bl.owned || (sim && sim.owned) || {},
      shown: bl.shown || (sim && sim.showcase) || {},
    };
    const took = num(summary.took, -1) >= 0 ? num(summary.took, 0) : num(summary.picks, build.drafts.length);
    const off = num(summary.offers, -1) >= 0 ? num(summary.offers, 0) : Math.max(took, took * num((config().draft || {}).options, 3));
    const simFeats = sim && sim.feats ? sim.feats : {};
    const feats = {};
    for (const k in save.feats) if (save.feats[k]) feats[k] = true;
    for (const k in simFeats) if (simFeats[k]) feats[k] = true;
    const unlocks = Array.isArray(summary.feats) ? summary.feats : [];
    for (let i = 0; i < unlocks.length; i += 1) {
      const f = unlocks[i];
      if (typeof f === 'string') feats[f] = true;
      else if (f && f.key) feats[f.key] = true;
    }
    const won = summary.won != null ? summary.won === true : !!(sim && sim.over && sim.over.result === 'won') || !!(last && last.won);
    const ticks = num(statValue(summary, ['ticks', 'timeTicks'], sim ? sim.runEndTick || sim.tick : (last ? last.ticks : 0)), 0);
    const blooms = num(summary.blooms, num(sim ? sim.blooms : null, num(stats.blooms, num(last ? last.blooms : 0, 0))));
    const bossesShown = summary.boss ? summary.boss : bossPicture(sim, summary).side;
    const prevBest = num(summary.previousBest, save.previousBest != null && summary.newBest !== false ? save.previousBest : best);
    return {
      sim: sim,
      score: score,
      best: best,
      previousBest: prevBest,
      newBest: score > 0 && (summary.newBest === true || score > prevBest && score >= best),
      won: won,
      difficulty: String(summary.difficulty || (sim && sim.difficulty) || (last && last.difficulty) || 'Normal'),
      seed: String(summary.seed != null ? summary.seed : sim && sim.seed != null ? sim.seed : last && last.seed != null ? last.seed : ''),
      ticks: ticks,
      delta: num(summary.delta, score - prevBest),
      blooms: blooms,
      bestCascade: num(statValue(summary, ['bestCascade'], stats.bestCascade), 1),
      pestKills: Math.round(num(statValue(summary, ['pestsPopped', 'pestKills', 'pestsCleared'], stats.pestClears), 0)),
      drains: Math.round(num(statValue(summary, ['drains'], stats.drains), 0)),
      history: history,
      build: build,
      picks: { took: took, offers: off },
      feats: feats,
      boss: bossesShown,
      perShower: perShower,
      grade: gradeFor(score),
      goal: summary.nextGoal || null,
    };
  }

  // ---------- backdrop ----------

  function backdrop(ctx) {
    const p = palette();
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, mix(p.cream, p.sky, 0.14));
    g.addColorStop(0.5, p.cream);
    g.addColorStop(1, mix(p.cream, p.gold, 0.2));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const hash = board('hash');
    if (hash) {
      for (let i = 0; i < 70; i += 1) {
        const x = 20 + hash(i, 5) * (W - 40);
        const y = 130 + hash(i, 9) * (H - 180);
        circle(ctx, x, y, 3 + hash(i, 13) * 4, rgba(p.pink, 0.2), rgba(p.ink, 0.1), 1);
      }
    }
    if (typeof howto().flower === 'function') {
      for (let i = 0; i < 7; i += 1) howto().flower(ctx, 60 + i * 200, 782, 11 + (i % 3) * 4, i % 2 ? p.pink : p.gold, p.mint);
    }
  }

  function titleBar(ctx, view) {
    const p = palette();
    trackedText(ctx, 'RESULTS', TITLE.x + 150, TITLE.y - 4, 270, 44, { fill: p.coral, maxScale: 1.15 });
    roundRect(ctx, TITLE.x, TITLE.y + 16, 300, 5, 2.5, p.mint);
    const line = (view.won ? 'RUN WON - DUSKFATHER DRIVEN OFF' : 'RUN LOST - SUNWELL DRY') + ' - ' + view.difficulty.toUpperCase();
    textFit(ctx, line, TITLE.x, TITLE.y + 40, 404, 18, { align: 'left', fill: p.ink, minSize: 10 });
  }

  // ---------- grade plaque + Duskfather spot art ----------

  function plaque(ctx, view) {
    const p = palette();
    const sc = view.score;
    const won = view.won;
    panel(ctx, PLAQUE.x, PLAQUE.y, PLAQUE.w, PLAQUE.h, { r: 18, fill: won ? mix(p.paper, p.mint, 0.12) : mix(p.paper, p.coral, 0.06), border: p.ink });
    textFit(ctx, 'GRADE', PLAQUE.x + PLAQUE.w * 0.5, PLAQUE.y + 24, 120, 18, { align: 'center', fill: rgba(p.ink, 0.7), minSize: 10 });
    const letter = String(view.grade.grade || 'D');
    circle(ctx, PLAQUE.x + PLAQUE.w * 0.5, PLAQUE.y + 128, 76, won ? p.gold : mix(p.gold, p.paper, 0.35), p.ink, 4);
    circle(ctx, PLAQUE.x + PLAQUE.w * 0.5, PLAQUE.y + 128, 66, rgba(p.paper, 0.25));
    trackedText(ctx, letter, PLAQUE.x + PLAQUE.w * 0.5, PLAQUE.y + 142, 116, 118, { fill: p.ink });
    trackedText(ctx, formatScore(sc), PLAQUE.x + PLAQUE.w * 0.5, PLAQUE.y + 238, PLAQUE.w - 40, 40, { fill: p.ink, maxScale: 1.1 });
    // anatomy of a ribbon: dove-tail ends so it reads at thumbnail size
    if (view.newBest) {
      const rb = { x: PLAQUE.x + 44, y: PLAQUE.y + 262, w: PLAQUE.w - 88, h: 28 };
      ctx.beginPath();
      ctx.moveTo(rb.x + 10, rb.y);
      ctx.lineTo(rb.x + rb.w - 10, rb.y);
      ctx.lineTo(rb.x + rb.w, rb.y + rb.h * 0.5);
      ctx.lineTo(rb.x + rb.w - 10, rb.y + rb.h);
      ctx.lineTo(rb.x + 10, rb.y + rb.h);
      ctx.lineTo(rb.x, rb.y + rb.h * 0.5);
      ctx.closePath();
      ctx.fillStyle = p.coral;
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
      textFit(ctx, 'NEW BEST', rb.x + rb.w * 0.5, rb.y + rb.h * 0.5 + 1, rb.w - 30, 19, { align: 'center', fill: p.paper, minSize: 10 });
    } else {
      textFit(ctx, 'BEST ' + formatScore(view.best), PLAQUE.x + PLAQUE.w * 0.5, PLAQUE.y + 276, PLAQUE.w - 40, 17, { align: 'center', fill: rgba(p.ink, 0.75), minSize: 10 });
    }
  }

  function duskfatherSpot(ctx, view) {
    const p = palette();
    const story = view.won
      ? 'THE DUSKFATHER RETREATS - WINGS FOLDED'
      : 'HE STILL LOOMS OVER THE BOARD';
    const cx = SPOT.x;
    const cy = SPOT.y + 8;
    const s = SPOT.s;
    ctx.save();
    // halo: warm and bright either way, never a dark vignette
    const halo = ctx.createRadialGradient(cx, cy, 20, cx, cy, 230);
    halo.addColorStop(0, rgba(view.won ? p.gold : p.pink, 0.4));
    halo.addColorStop(1, rgba(p.cream, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(cx - 240, 0, 480, cy + 220);
    ctx.translate(cx, cy - 40);
    ctx.scale(s, s);
    if (view.won) {
      ctx.beginPath();
      ctx.ellipse(0, 70, 92, 15, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.ink, 0.12);
      ctx.fill();
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(side * 34, -40, side * 66, -14);
        ctx.quadraticCurveTo(side * 84, 34, side * 40, 58);
        ctx.closePath();
        ctx.fillStyle = mix(p.pink, p.paper, 0.4);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = p.ink;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(side * 40, 18, 7, 0, Math.PI * 2);
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = p.coral;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(0, 20, 14, 44, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.cream;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
      circle(ctx, 0, -28, 13, p.cream, p.ink, 2.8);
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(-20, -32);
      ctx.moveTo(0, -16);
      ctx.lineTo(21, -30);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
      for (let i = 0; i < 7; i += 1) {
        const a = (i / 7) * Math.PI * 2 + 0.3;
        const r = 86 + (i % 2) * 16;
        star(ctx, cx + Math.cos(a) * r * s, cy - 40 + Math.sin(a) * r * s * 0.8, 7 + (i % 3) * 2, i % 2 ? p.gold : p.mint);
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 70, 116, 18, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.ink, 0.14);
      ctx.fill();
      // Duskfather copied from the title plate: giant warm wings, coral margins, gold eye spots
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.quadraticCurveTo(side * 70, -86, side * 104, -52);
        ctx.quadraticCurveTo(side * 118, -12, side * 52, 8);
        ctx.closePath();
        ctx.fillStyle = p.cream;
        ctx.fill();
        ctx.lineWidth = 3.4;
        ctx.strokeStyle = p.ink;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.quadraticCurveTo(side * 70, -86, side * 104, -52);
        ctx.quadraticCurveTo(side * 104, -36, side * 78, -30);
        ctx.quadraticCurveTo(side * 46, -30, 0, -10);
        ctx.closePath();
        ctx.fillStyle = p.coral;
        ctx.fill();
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = p.ink;
        ctx.stroke();
        circle(ctx, side * 66, -34, 9, p.gold, p.ink, 2.4);
        circle(ctx, side * 66, -34, 4, p.ink);
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.quadraticCurveTo(side * 74, 16, side * 74, 60);
        ctx.quadraticCurveTo(side * 50, 92, 0, 66);
        ctx.closePath();
        ctx.fillStyle = mix(p.pink, p.paper, 0.35);
        ctx.fill();
        ctx.lineWidth = 3.2;
        ctx.strokeStyle = p.ink;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(side * 44, 54, 14, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = p.coral;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(0, 24, 20, 58, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.cream;
      ctx.fill();
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-15, -4 + i * 20);
        ctx.quadraticCurveTo(0, 4 + i * 20, 15, -4 + i * 20);
        ctx.lineWidth = 3;
        ctx.strokeStyle = p.coral;
        ctx.stroke();
      }
      circle(ctx, 0, -40, 17, p.cream, p.ink, 3.2);
      circle(ctx, -6, -42, 3, p.ink);
      circle(ctx, 6, -42, 3, p.ink);
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(side * 6, -54);
        ctx.quadraticCurveTo(side * 26, -84, side * 44, -78);
        ctx.lineWidth = 3;
        ctx.strokeStyle = p.ink;
        ctx.stroke();
      }
    }
    ctx.restore();
    const line = story;
    roundRect(ctx, SPOT.x - 210, SPOT.y + 158, 420, 34, 17, view.won ? mix(p.paper, p.mint, 0.4) : mix(p.paper, p.coral, 0.2));
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = p.ink;
    roundRectPath(ctx, SPOT.x - 210, SPOT.y + 158, 420, 34, 17);
    ctx.stroke();
    textFit(ctx, line, SPOT.x, SPOT.y + 175, 396, 18, { align: 'center', fill: p.ink, minSize: 9 });
  }

  function star(ctx, x, y, r, fill) {
    const p = palette();
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
  }

  // ---------- stat tiles ----------

  function statTiles(ctx, view) {
    const p = palette();
    const tiles = [
      { label: 'BLOOMS', value: String(Math.round(view.blooms)), fill: p.mint },
      { label: 'BEST CASCADE', value: 'x' + Math.max(1, Math.round(view.bestCascade)), fill: p.gold },
      { label: 'PESTS POPPED', value: String(Math.round(view.pestKills)), fill: p.pink },
      { label: 'DRAINS', value: String(Math.round(view.drains)), fill: mix(p.coral, p.paper, 0.25) },
      { label: 'TIME', value: formatTicks(view.ticks), fill: p.sky },
    ];
    const gap = 8;
    const tw = (TILES.w - gap * (tiles.length - 1)) / tiles.length;
    for (let i = 0; i < tiles.length; i += 1) {
      const t = tiles[i];
      const x = TILES.x + i * (tw + gap);
      roundRect(ctx, x, TILES.y, tw, TILES.h, 12, mix(p.paper, t.fill, 0.24));
      ctx.lineWidth = 3;
      ctx.strokeStyle = p.ink;
      roundRectPath(ctx, x, TILES.y, tw, TILES.h, 12);
      ctx.stroke();
      roundRect(ctx, x + 12, TILES.y + 9, tw - 24, 5, 2.5, t.fill);
      textFit(ctx, t.label, x + tw * 0.5, TILES.y + 25, tw - 16, 13, { align: 'center', fill: rgba(p.ink, 0.75), minSize: 8 });
      textFit(ctx, t.value, x + tw * 0.5, TILES.y + 52, tw - 16, 33, { align: 'center', fill: p.ink, minSize: 13 });
    }
  }

  // ---------- grade thresholds ----------

  function thresholds(ctx, view) {
    const p = palette();
    panel(ctx, THRESH.x, THRESH.y, THRESH.w, THRESH.h, { r: 14, fill: p.paper, border: p.ink, tab: 'GRADE THRESHOLDS', tabSize: 16, tabFill: p.gold });
    const list = grades();
    const earnedIdx = list.map(function (g) { return g.grade; }).indexOf(view.grade.grade);
    const top = THRESH.y + 26;
    const rowH = 33;
    for (let i = 0; i < list.length; i += 1) {
      const g = list[i];
      const y = top + i * rowH;
      const reached = num(view.score, 0) >= num(g.min, 0);
      const isEarned = i === earnedIdx;
      if (isEarned) {
        roundRect(ctx, THRESH.x + 8, y - 2, THRESH.w - 16, rowH - 2, 8, mix(p.gold, p.paper, 0.55));
      }
      circle(ctx, THRESH.x + 30, y + 13, 13, reached ? p.gold : rgba(p.ink, 0.1), p.ink, 1.8);
      textFit(ctx, g.grade, THRESH.x + 30, y + 14, 20, 16, { align: 'center', fill: p.ink, minSize: 8 });
      textFit(ctx, formatScore(g.min), THRESH.x + 54, y + 14, 130, 22, { align: 'left', fill: p.ink, minSize: 9 });
      if (isEarned) { roundRect(ctx, THRESH.x + THRESH.w - 92 - 37, y + 14 - 11, 74, 22, 11, p.gold); textFit(ctx, 'EARNED', THRESH.x + THRESH.w - 92, y + 14, 70, 13, { align: 'center', fill: p.ink, minSize: 8 }); }
      else if (reached) textFit(ctx, 'CLEARED', THRESH.x + THRESH.w - 30, y + 14, 80, 13, { align: 'right', fill: p.leaf, minSize: 8 });
      if (reached) {
        const ht = howto();
        if (typeof ht.check === 'function') ht.check(ctx, THRESH.x + THRESH.w - 140, y + 13, 10, true);
        else circle(ctx, THRESH.x + THRESH.w - 140, y + 13, 9, p.mint, p.ink, 2);
      } else {
        circle(ctx, THRESH.x + THRESH.w - 140, y + 13, 9, rgba(p.paper, 1), rgba(p.ink, 0.35), 1.6);
      }
    }
  }

  // ---------- LAST 3 RUNS ----------

  function lastRuns(ctx, view) {
    const p = palette();
    panel(ctx, HISTORY.x, HISTORY.y, HISTORY.w, HISTORY.h, { r: 14, fill: p.paper, border: p.ink, tab: 'LAST 3 RUNS', tabSize: 16, tabFill: p.sky });
    const rows = view.history.slice(-3);
    if (!rows.length) {
      textFit(ctx, 'NO RUNS RECORDED YET - R STARTS YOUR FIRST', HISTORY.x + 14, HISTORY.y + HISTORY.h * 0.58, HISTORY.w - 28, 20, { align: 'left', fill: p.ink, minSize: 10 });
      return;
    }
    const top = HISTORY.y + 28;
    const rowH = 25;
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i] || {};
      const y = top + i * rowH;
      const won = r.won === true;
      roundRect(ctx, HISTORY.x + 8, y, HISTORY.w - 16, rowH - 3, 9, won ? mix(p.paper, p.mint, 0.42) : mix(p.paper, p.coral, 0.18));
      ctx.lineWidth = 2;
      ctx.strokeStyle = won ? p.leaf : p.coral;
      roundRectPath(ctx, HISTORY.x + 8, y, HISTORY.w - 16, rowH - 3, 9);
      ctx.stroke();
      // WON / LOST chip: wins mint, losses coral, never swapped
      roundRect(ctx, HISTORY.x + 14, y + 4, 56, rowH - 11, (rowH - 11) * 0.5, won ? p.mint : p.coral);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = p.ink;
      roundRectPath(ctx, HISTORY.x + 14, y + 4, 56, rowH - 11, (rowH - 11) * 0.5);
      ctx.stroke();
      textFit(ctx, won ? 'WON' : 'LOST', HISTORY.x + 42, y + rowH * 0.5, 50, 13, { align: 'center', fill: won ? p.ink : p.paper, minSize: 8 });
      textFit(ctx, formatScore(r.score), HISTORY.x + 80, y + rowH * 0.5, 104, 18, { align: 'left', fill: p.ink, minSize: 9 });
      textFit(ctx, String(r.difficulty || 'Normal'), HISTORY.x + 190, y + rowH * 0.5, 90, 14, { align: 'left', fill: rgba(p.ink, 0.8), minSize: 8 });
      textFit(ctx, 'SEED ' + String(r.seed == null ? '' : r.seed), HISTORY.x + HISTORY.w - 18, y + rowH * 0.5, 200, 13, { align: 'right', fill: rgba(p.ink, 0.75), minSize: 8 });
    }
  }

  // ---------- YOUR BUILD ----------

  function runLabel(key) {
    const list = (globalThis.PB_Draft && globalThis.PB_Draft.pool) ? globalThis.PB_Draft.pool() : [];
    for (let i = 0; i < list.length; i += 1) if (list[i].key === key) return list[i].name;
    const c = names().contraptions || [];
    for (let i = 0; i < c.length; i += 1) if (c[i].key === key) return c[i].name;
    return String(key || '').toUpperCase();
  }

  function drawRunIcon(ctx, key, x, y, r) {
    const ds = globalThis.PB_DraftScreen;
    if (ds && typeof ds.runIcon === 'function') {
      ds.runIcon(ctx, key, x, y, r);
      return true;
    }
    const ic = board('icon');
    if (ic) {
      ic(ctx, key, x, y, r);
      return true;
    }
    return false;
  }

  function yourBuild(ctx, view) {
    const p = palette();
    panel(ctx, BUILD.x, BUILD.y, BUILD.w, BUILD.h, { r: 14, fill: p.paper, border: p.ink, tab: 'YOUR BUILD', tabSize: 16, tabFill: p.mint });
    const items = [];
    const placed = view.build.contraptions || [];
    for (let i = 0; i < placed.length; i += 1) items.push({ key: placed[i].key, level: num(placed[i].level, 1), placed: true });
    const owned = view.build.owned || {};
    for (const k in owned) {
      let known = false;
      for (let i = 0; i < items.length; i += 1) if (items[i].key === k) known = true;
      if (!known && num(owned[k], 0) > 0) items.push({ key: k, level: Math.min(3, num(owned[k], 1)), placed: false });
    }
    const top = BUILD.y + 28;
    const cellW = (BUILD.w - 20) / 4;
    if (!items.length) {
      textFit(ctx, 'NO CONTRAPTIONS BUILT - PICK AND PLACE NEXT RUN', BUILD.x + 12, BUILD.y + 70, BUILD.w - 24, 16, { align: 'left', fill: p.ink, minSize: 9 });
    }
    for (let i = 0; i < items.length && i < 4; i += 1) {
      const it = items[i];
      const cx = BUILD.x + 10 + cellW * (i + 0.5);
      drawRunIcon(ctx, it.key, cx, top + 24, 17);
      textFit(ctx, runLabel(it.key), cx, top + 50, cellW - 6, 12, { align: 'center', fill: p.ink, minSize: 7 });
      textFit(ctx, 'LV' + it.level + (it.placed ? '' : ' - RACK'), cx, top + 66, cellW - 6, 11, { align: 'center', fill: rgba(p.ink, 0.72), minSize: 7 });
    }
    if (items.length > 4) textFit(ctx, '+' + (items.length - 4) + ' MORE', BUILD.x + BUILD.w - 10, top + 66, 80, 11, { align: 'right', fill: rgba(p.ink, 0.72), minSize: 7 });
    const picks = view.picks;
    textFit(ctx, picks.took + ' PICKED FROM ' + picks.offers + ' OFFERS', BUILD.x + 12, BUILD.y + BUILD.h - 14, BUILD.w - 24, 14, { align: 'left', fill: p.leaf, minSize: 9 });
  }

  // ---------- FEATS row ----------

  function featsRow(ctx, view) {
    const p = palette();
    panel(ctx, FEATS.x, FEATS.y, FEATS.w, FEATS.h, { r: 14, fill: p.paper, border: p.ink, tab: 'FEATS', tabSize: 16, tabFill: p.gold });
    const list = names().feats || [];
    const total = list.length || num(config().featCount, 6);
    let have = 0;
    for (let i = 0; i < list.length; i += 1) if (view.feats[list[i].key]) have += 1;
    textFit(ctx, have + ' / ' + total, FEATS.x + FEATS.w - 14, FEATS.y + 13, 70, 16, { align: 'right', fill: p.leaf, minSize: 9 });
    const gap = 6;
    const cw = (FEATS.w - 20 - gap * (list.length - 1)) / Math.max(1, list.length);
    for (let i = 0; i < list.length; i += 1) {
      const f = list[i];
      const lit = view.feats[f.key] === true;
      const x = FEATS.x + 10 + i * (cw + gap);
      const y = FEATS.y + 24;
      roundRect(ctx, x, y, cw, FEATS.h - 34, 10, lit ? p.gold : mix(p.paper, p.ink, 0.06));
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = lit ? p.ink : rgba(p.ink, 0.3);
      roundRectPath(ctx, x, y, cw, FEATS.h - 34, 10);
      ctx.stroke();
      if (lit) star(ctx, x + cw * 0.5, y + 18, 10, p.paper);
      else circle(ctx, x + cw * 0.5, y + 18, 10, rgba(p.paper, 1), rgba(p.ink, 0.3), 1.6);
      textFit(ctx, f.name, x + cw * 0.5, y + 42, cw - 8, 13, { align: 'center', fill: lit ? p.ink : rgba(p.ink, 0.55), minSize: 7 });
    }
  }

  // ---------- NEXT GOAL ----------

  function nextGoalLine(view) {
    if (view.goal) return String(view.goal).toUpperCase();
    const ng = nextGrade(view.score);
    if (ng) return 'GRADE ' + ng.grade + ' AT ' + formatScore(ng.min);
    const list = names().feats || [];
    for (let i = 0; i < list.length; i += 1) if (!view.feats[list[i].key]) return list[i].name;
    if (view.boss.side !== 'player') return 'POP THE DUSKFATHER';
    return 'ALL FEATS CLEARED - CHASE THE BEST';
  }

  function goalPanel(ctx, view) {
    const p = palette();
    const label = 'NEXT GOAL: ' + nextGoalLine(view);
    panel(ctx, GOAL.x, GOAL.y, GOAL.w, GOAL.h, { r: 14, fill: mix(p.paper, p.mint, 0.16), border: p.ink, tab: 'NEXT GOAL', tabSize: 15, tabFill: p.mint });
    textFit(ctx, label, GOAL.x + GOAL.w * 0.5, GOAL.y + GOAL.h * 0.62, GOAL.w - 28, 22, { align: 'center', fill: p.ink, minSize: 10 });
  }

  // ---------- per-shower graph ----------

  function perShower(ctx, view) {
    const p = palette();
    panel(ctx, GRAPH.x, GRAPH.y, GRAPH.w, GRAPH.h, { r: 14, fill: p.paper, border: p.ink, tab: 'BLOOMS PER SHOWER', tabSize: 14, tabFill: p.sky });
    const rows = view.perShower || [];
    const total = Math.max(9, rows.length);
    const left = GRAPH.x + 14;
    const right = GRAPH.x + GRAPH.w - 14;
    const baseY = GRAPH.y + GRAPH.h - 16;
    const topY = GRAPH.y + 30;
    const bw = (right - left) / total;
    let peak = 1;
    for (let i = 0; i < rows.length; i += 1) {
      peak = Math.max(peak, num(rows[i].blooms, 0), num(rows[i].quota, 0));
    }
    if (!rows.length) {
      textFit(ctx, 'NO SHOWERS CLOSED IN THIS RUN', GRAPH.x + GRAPH.w * 0.5, GRAPH.y + GRAPH.h * 0.6, GRAPH.w - 24, 15, { align: 'center', fill: rgba(p.ink, 0.7), minSize: 9 });
      return;
    }
    for (let i = 0; i < total; i += 1) {
      const x = left + i * bw;
      const r = rows[i];
      const bh = r ? Math.max(2, ((baseY - topY) * num(r.blooms, 0)) / peak) : 0;
      const boss = r && r.boss;
      const colour = !r ? rgba(p.ink, 0.08) : r.cleared ? (boss ? p.gold : p.mint) : p.coral;
      roundRect(ctx, x + 3, baseY - bh, bw - 6, bh, 3, colour);
      if (r) {
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = p.ink;
        roundRectPath(ctx, x + 3, baseY - bh, bw - 6, bh, 3);
        ctx.stroke();
        if (num(r.quota, 0) > 0) {
          const qy = baseY - ((baseY - topY) * num(r.quota, 0)) / peak;
          ctx.beginPath();
          ctx.moveTo(x + 1, qy);
          ctx.lineTo(x + bw - 1, qy);
          ctx.lineWidth = 2.2;
          ctx.strokeStyle = p.ink;
          ctx.stroke();
        }
        textFit(ctx, String(i + 1), x + bw * 0.5, baseY + 7, bw - 4, 10, { align: 'center', fill: rgba(p.ink, 0.75), minSize: 7 });
        if (boss && globalThis.PB_Sprites && typeof globalThis.PB_Sprites.mothSkull === 'function') {
          globalThis.PB_Sprites.mothSkull(ctx, x + bw * 0.5, baseY - bh - 8, 12);
        }
      }
    }
    ctx.beginPath();
    ctx.moveTo(left, baseY);
    ctx.lineTo(right, baseY);
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    textFit(ctx, 'BARS: BLOOMS - LINE: QUOTA', GRAPH.x + GRAPH.w - 14, GRAPH.y + 13, 180, 11, { align: 'right', fill: rgba(p.ink, 0.7), minSize: 7 });
  }

  // ---------- run metadata, buttons, footer ----------

  function metadata(ctx, view) {
    const p = palette();
    const meta = 'DIFFICULTY ' + view.difficulty + ' - SEED ' + (view.seed || '-') + ' - TIME ' + formatTicks(view.ticks);
    textFit(ctx, meta, META_Y.x, META_Y.y, META_Y.w, 16, { align: 'left', fill: p.ink, minSize: 9 });
    const delta = view.score - view.previousBest;
    const dText = view.newBest ? 'NEW BEST +' + formatScore(Math.max(0, delta)) : delta === 0 ? 'MATCHES BEST' : (delta > 0 ? '+' : '') + formatScore(delta) + ' VS BEST';
    textFit(ctx, dText, META_Y.x, META_Y.y + 22, META_Y.w, 17, { align: 'left', fill: delta > 0 ? p.leaf : delta < 0 ? p.coral : rgba(p.ink, 0.72), minSize: 9 });
  }

  function controlsButtons(ctx, buttons) {
    const p = palette();
    const again = button(ctx, RUN_AGAIN.x, RUN_AGAIN.y, RUN_AGAIN.w, RUN_AGAIN.h, '', { fill: p.coral, borderWidth: 4, r: 16 });
    again.id = 'runAgain';
    again.action = 'runAgain';
    roundRect(ctx, RUN_AGAIN.x + 12, RUN_AGAIN.y + 11, 58, RUN_AGAIN.h - 22, 10, p.paper);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = p.ink;
    roundRectPath(ctx, RUN_AGAIN.x + 12, RUN_AGAIN.y + 11, 58, RUN_AGAIN.h - 22, 10);
    ctx.stroke();
    textFit(ctx, 'R', RUN_AGAIN.x + 41, RUN_AGAIN.y + RUN_AGAIN.h * 0.5 + 1, 44, 26, { align: 'center', fill: p.ink, minSize: 12 });
    textFit(ctx, 'RUN AGAIN', RUN_AGAIN.x + 86, RUN_AGAIN.y + RUN_AGAIN.h * 0.5 + 1, RUN_AGAIN.w - 104, 40, { align: 'left', fill: p.ink, minSize: 16 });
    buttons.runAgain = again;

    const title = button(ctx, TO_TITLE.x, TO_TITLE.y, TO_TITLE.w, TO_TITLE.h, 'T - TITLE', { fill: p.paper, size: 26, r: 14, borderWidth: 3 });
    title.id = 'toTitle';
    title.action = 'toTitle';
    buttons.toTitle = title;
    // keep the new button label clear of the default chip
    buttons.title = title;
  }

  function footer(ctx) {
    const p = palette();
    roundRect(ctx, 24, 738, 1232, 40, 10, rgba(p.cream, 0.96));
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = rgba(p.ink, 0.5);
    roundRectPath(ctx, 24, 738, 1232, 40, 10);
    ctx.stroke();
    textFit(ctx, CONTROLS, 40, 758, 960, 17, { align: 'left', fill: p.ink, minSize: 9 });
    textFit(ctx, 'PEGBLOOM - ' + (names().player || 'PINA'), 1240, 758, 260, 16, { align: 'right', fill: p.ink, minSize: 9 });
  }

  // ---------- public draw ----------

  // draw(ctx, view): view may carry {summary|run, sim|state, buttons}. Returns the filled view.
  function draw(ctx, view) {
    if (!ctx) return null;
    const v = view && typeof view === 'object' ? view : {};
    const data = buildView(v);
    v.summaryView = data;
    const buttons = v.buttons && typeof v.buttons === 'object' ? v.buttons : (v.buttons = {});
    for (const k in buttons) if (Object.prototype.hasOwnProperty.call(buttons, k)) delete buttons[k];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    backdrop(ctx);
    titleBar(ctx, data);
    plaque(ctx, data);
    duskfatherSpot(ctx, data);
    statTiles(ctx, data);
    thresholds(ctx, data);
    lastRuns(ctx, data);
    yourBuild(ctx, data);
    featsRow(ctx, data);
    goalPanel(ctx, data);
    perShower(ctx, data);
    metadata(ctx, data);
    controlsButtons(ctx, buttons);
    footer(ctx);
    ctx.restore();
    return data;
  }

  globalThis.PB_Results = {
    draw: draw,
    buildView: buildView,
    gradeFor: gradeFor,
    nextGrade: nextGrade,
    nextGoalLine: nextGoalLine,
    formatTicks: formatTicks,
    formatScore: formatScore,
    controls: CONTROLS,
    layout: {
      title: TITLE, plaque: PLAQUE, spot: SPOT, tiles: TILES, thresholds: THRESH, history: HISTORY,
      build: BUILD, feats: FEATS, goal: GOAL, graph: GRAPH, runAgain: RUN_AGAIN, toTitle: TO_TITLE,
    },
  };
})();
