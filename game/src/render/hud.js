// Draws every play-screen HUD panel (objective, Sunwell, incoming pests, score/CASCADE, bloom quota, seeds, shower track, buttons, controls) and the build bar; the right column owns the EVENT LOG panel, drawn by PB_Banner.
(function () {
  if (typeof globalThis.PB_Hud === 'object' && globalThis.PB_Hud !== null) return;

  const LEFT = { x: 16, y: 96, w: 336, h: 688 };
  const RIGHT = { x: 928, y: 96, w: 336, h: 688 };
  const STRIP_Y = 752;
  const STRIP_H = 40;
  
  const CONTROLS = '<- -> move can - SPACE drop - Q/E turn gates - 1/2/3 pick - B build - P pause - M mute';
  const PUPPET = 'PINA: <- -> steer the can - SPACE drop dew, aim the cascade.';

  function palette() {
    return globalThis.PB_PALETTE || {
      cream: '#FFF6E9', paper: '#FFFDF6', coral: '#FF7A59', gold: '#FFC53D', sky: '#57B8FF',
      mint: '#4FD8A5', pink: '#FF9FB2', leaf: '#58B368', ink: '#2B2118',
    };
  }

  function config() {
    return globalThis.PB_CONFIG || { board: { field: {} }, sunwell: { max: 10 }, cups: [] };
  }

  function names() {
    return globalThis.PB_NAMES || { pests: [], contraptions: [], days: [], bossInfo: { name: 'THE DUSKFATHER' } };
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

  function rgba(hex, a) {
    const f = helper('rgba');
    return f ? f(hex, a) : hex;
  }

  function mix(hex, toward, amount) {
    const f = helper('mixHex');
    return f ? f(hex, toward, amount) : hex;
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

  function panel(ctx, x, y, w, h, spec) {
    const f = helper('panel');
    if (f) return f(ctx, x, y, w, h, spec);
    const s = spec || {};
    const p = palette();
    roundRectPath(ctx, x, y, w, h, num(s.r, 12));
    ctx.fillStyle = s.fill || p.paper;
    ctx.fill();
    ctx.lineWidth = num(s.borderWidth, 3);
    ctx.strokeStyle = s.border || p.ink;
    ctx.stroke();
    if (s.tab) text(ctx, s.tab, x + 12, y + num(s.tabSize, 16) * 0.55, num(s.tabSize, 16), { fill: p.ink });
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
    ctx.font = 'bold ' + Math.round(size) + 'px "Arial Narrow", Arial, sans-serif';
    ctx.textAlign = s.align || 'left';
    ctx.textBaseline = s.baseline || 'middle';
    ctx.fillStyle = s.fill || palette().ink;
    ctx.fillText(String(str), x, y);
    ctx.restore();
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
    ctx.textAlign = s.align || 'left';
    ctx.textBaseline = s.baseline || 'middle';
    if (s.stroke) {
      ctx.lineWidth = num(s.strokeW, 4);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = s.stroke;
      ctx.strokeText(label, x, y);
    }
    ctx.fillStyle = s.fill || palette().ink;
    ctx.fillText(label, x, y);
    const width = ctx.measureText(label).width;
    ctx.restore();
    return { size: fit, width: width, x: x, y: y };
  }

  function chip(ctx, label, x, y, w, h, fill) {
    const p = palette();
    roundRect(ctx, x, y, w, h, h * 0.5, fill);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = p.ink;
    roundRectPath(ctx, x, y, w, h, h * 0.5);
    ctx.stroke();
    textFit(ctx, label, x + w * 0.5, y + h * 0.5 + 1, w - 12, h * 0.64, { align: 'center', fill: p.ink, minSize: 9 });
  }

  // Circle helper used by droplets, ball dots and progress ticks.
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

  // A dew droplet: a rounded square pivoted into a teardrop, filled sky when held or hollow when spent.
  function droplet(ctx, x, y, r, filled) {
    const p = palette();
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.25);
    ctx.quadraticCurveTo(r * 1.05, -r * 0.1, r * 0.78, r * 0.35);
    ctx.arc(0, r * 0.28, r * 0.78, 0, Math.PI);
    ctx.quadraticCurveTo(-r * 1.05, -r * 0.1, 0, -r * 1.25);
    ctx.closePath();
    ctx.fillStyle = filled ? p.sky : rgba('#FFFFFF', 0.9);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = filled ? p.ink : rgba(p.ink, 0.45);
    ctx.stroke();
    if (filled) {
      circle(ctx, -r * 0.26, -r * 0.05, r * 0.2, rgba('#FFFFFF', 0.85));
    }
    ctx.restore();
  }

  // A dew-sphere in flight: a small lit ball with a rim, used for the BALLS readout.
  function ballIcon(ctx, x, y, r, lit) {
    const p = palette();
    circle(ctx, x, y, r, lit ? p.gold : rgba(p.ink, 0.12), p.ink, 1.8);
    if (lit) circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.28, rgba('#FFFFFF', 0.9));
  }

  // ---------- phase / view helpers ----------

  function isBuild(sim) {
    return !!(sim && sim.phase === 'build');
  }

  function viewBest(view) {
    const v = view || {};
    if (typeof v.best === 'number' && isFinite(v.best)) return v.best;
    if (typeof v.bestScore === 'number' && isFinite(v.bestScore)) return v.bestScore;
    const save = globalThis.PB_Save;
    if (save && typeof save.get === 'function') {
      const data = save.get();
      if (data && typeof data.best === 'number') return data.best;
      if (data && typeof data.bestScore === 'number') return data.bestScore;
    }
    return 0;
  }

  function formatScore(n) {
    const v = Math.max(0, Math.round(num(n, 0)));
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function pestName(kind) {
    const list = names().pests || [];
    for (let i = 0; i < list.length; i += 1) if (list[i].key === kind) return list[i].name;
    return String(kind || '').toUpperCase();
  }

  function pestTrait(kind) {
    const list = names().pests || [];
    for (let i = 0; i < list.length; i += 1) if (list[i].key === kind) return list[i].trait;
    return '';
  }

  function pestColour(kind) {
    if (kind === 'clingmoth') return 'pink';
    if (kind === 'draingrub') return 'leaf';
    if (kind === 'petalbat') return 'sky';
    if (kind === 'huskling') return 'gold';
    return 'coral';
  }

  function totalShowers() {
    const w = globalThis.PB_Waves;
    if (w && typeof w.total === 'function') return w.total();
    return (config().showers || []).length || 9;
  }

  // Pest roster for the shower actually being played (PB_Waves is the single source of truth).
  function roster(sim) {
    if (sim && sim.roster && Array.isArray(sim.roster.kinds) && sim.roster.kinds.length) return sim.roster.kinds;
    const w = globalThis.PB_Waves;
    const n = num(sim && sim.shower, 1);
    if (w && typeof w.rosterFor === 'function') return w.rosterFor(n, sim) || [];
    return [];
  }

  function nextLineFor(sim) {
    const w = globalThis.PB_Waves;
    const n = num(sim && sim.shower, 1);
    if (w && typeof w.nextLine === 'function') return w.nextLine(n);
    if (typeof w.nextNew === 'function') {
      const kind = w.nextNew(n + 1);
      if (kind) return { kind: kind, text: 'NEXT: ' + pestName(kind) };
    }
    return null;
  }

  function days() {
    const list = (names().days || []).slice();
    if (list.length) return list;
    return config().days || [];
  }

  function eliminations(sim, kind) {
    const list = sim && sim.eliminated;
    if (Array.isArray(list)) {
      const hit = list.find(function (e) { return e.kind === kind; });
      if (hit) return num(hit.n, 0);
    }
    return 0;
  }

  // ---------- left panel ----------

  function objectivePanel(ctx, sim, x, y, w, h) {
    const p = palette();
    const total = totalShowers();
    const n = num(sim.shower, 1);
    const more = Math.max(0, total - n + 1);
    panel(ctx, x, y, w, h, { r: 12, tab: 'OBJECTIVE', tabSize: 16, tabFill: p.mint });
    textFit(ctx, 'WIN: BLOOM QUOTA IN ' + more + ' MORE SHOWERS', x + 12, y + 30, w - 24, 17, { align: 'left', fill: p.ink, minSize: 10 });
    textFit(ctx, 'LOSE: SUNWELL DRY', x + 12, y + 56, w - 24, 17, { align: 'left', fill: p.ink, minSize: 10 });
  }

  function sunwellPanel(ctx, sim, x, y, w, h) {
    const p = palette();
    const max = num(config().sunwell && config().sunwell.max, 10);
    const held = clamp(Math.round(num(sim.sunwell, 0)), 0, max);
    const low = held <= 3;
    const pulse = 0.5 + 0.5 * Math.sin(num(sim.tick, 0) * 0.18);
    const countCol = low ? mix(p.coral, p.ink, pulse * 0.25) : p.ink;
    panel(ctx, x, y, w, h, { r: 12, tab: 'SUNWELL', tabSize: 16, tabFill: p.sky });
    text(ctx, held + ' / ' + max, x + w - 12, y + 15, 18, { align: 'right', fill: countCol });
    const cols = 5;
    const gapX = 30;
    const rowY = [y + 40, y + 72];
    for (let i = 0; i < max; i += 1) {
      const r = i % cols;
      const row = Math.floor(i / cols);
      const dx = x + w * 0.5 + (r - (cols - 1) * 0.5) * gapX;
      droplet(ctx, dx, rowY[row] || rowY[1], 9, i < held);
    }
    const dry = String((names().states || {}).dry || 'DRY = RUN LOST');
    chip(ctx, dry, x + 12, y + h - 26, w - 24, 22, low ? mix(p.coral, p.paper, 0.35 + pulse * 0.25) : p.cream);
  }

  function incomingPanel(ctx, sim, x, y, w, h) {
    const p = palette();
    const n = num(sim.shower, 1);
    const total = totalShowers();
    const bossInfo = names().bossInfo || { name: 'THE DUSKFATHER', showers: 9 };
    panel(ctx, x, y, w, h, { r: 12, tab: 'INCOMING', tabSize: 16, tabFill: p.coral });
    const list = roster(sim);
    const rowH = 17;
    const cy = y + 44;
    const rowLimit = 2;
    if (!list.length) text(ctx, 'CLEAR SKY - NO PESTS', x + 12, cy + 7, 16, { fill: p.leaf });
    for (let i = 0; i < list.length && i < rowLimit; i += 1) {
      const kind = list[i].kind;
      const left = Math.max(0, num(list[i].count, 0) - eliminations(sim, kind));
      circle(ctx, x + 18, cy + i * rowH + 7, 6, p[pestColour(kind)] || p.coral, p.ink, 1.6);
      textFit(ctx, pestName(kind), x + 30, cy + i * rowH + 7, 112, 15, { align: 'left', fill: p.ink, minSize: 9 });
      text(ctx, 'x' + left, x + 150, cy + i * rowH + 7, 16, { align: 'left', fill: left > 0 ? p.ink : rgba(p.ink, 0.4) });
      textFit(ctx, pestTrait(kind), x + w - 10, cy + i * rowH + 7, 76, 14, { align: 'right', fill: rgba(p.ink, 0.62), minSize: 9 });
    }
    const bossShower = num(bossInfo.showers, total);
    const bossHere = n === bossShower;
    const bossRowY = y + (list.length ? 44 + rowLimit * rowH : 40);
    const nextRowY = y + h - 14;
    const bossText = 'SHOWER ' + bossShower + ': ' + String(bossInfo.name || 'THE DUSKFATHER') + ' BOSS';
    if (bossHere) {
      textFit(ctx, bossText, x + 12, bossRowY + 9, w - 24, 19, { align: 'left', fill: p.ink, minSize: 12 });
      const hp = Math.max(0, Math.round(num(sim.boss && sim.boss.hp, 0)));
      const maxHp = Math.round(num(sim.boss && sim.boss.maxHp, num(bossInfo.hp, 24)));
      textFit(ctx, 'HP ' + hp + ' / ' + maxHp + ' - BLOCKS DROPS', x + 12, bossRowY + 28, w - 24, 14, { align: 'left', fill: p.coral, minSize: 9 });
    } else {
      textFit(ctx, bossText, x + 12, bossRowY + 9, w - 24, 15, { align: 'left', fill: p.ink, minSize: 10 });
    }
    const next = nextLineFor(sim);
    let label = 'ALL PESTS SEEN';
    if (next && next.kind && next.kind !== 'duskfather') {
      const wv = globalThis.PB_Waves;
      const arr = wv && wv.INTRO ? wv.INTRO : [];
      let from = 0;
      for (let i = 0; i < arr.length; i += 1) if (arr[i].kind === next.kind) from = num(arr[i].from, 0);
      label = 'NEXT: ' + pestName(next.kind) + ' joins shower ' + (from || '?');
    }
    textFit(ctx, label, x + 12, nextRowY, w - 24, 15, { align: 'left', fill: next && next.kind ? p.ink : p.leaf, minSize: 9 });
  }

  function drawLeft(ctx, sim) {
    objectivePanel(ctx, sim, LEFT.x, 100, LEFT.w, 68);
    sunwellPanel(ctx, sim, LEFT.x, 176, LEFT.w, 110);
    incomingPanel(ctx, sim, LEFT.x, 294, LEFT.w, 132);
  }

  // ---------- right panel ----------

  function scorePanel(ctx, sim, view, x, y, w, h) {
    const p = palette();
    const tick = num(sim.tick, 0);
    const mult = clamp(Math.round(num(sim.cascade && sim.cascade.mult, 1)), 1, 8);
    const streak = num(sim.cascade && sim.cascade.streak, 0);
    const best = viewBest(view);
    panel(ctx, x, y, w, h, { r: 12, tab: 'SCORE', tabSize: 16, tabFill: p.gold });
    textFit(ctx, formatScore(sim.score), x + 12, y + 48, w - 24, 32, { align: 'left', fill: p.ink, minSize: 18 });
    textFit(ctx, 'BEST ' + formatScore(best), x + 12, y + 74, w - 24, 16, { align: 'left', fill: rgba(p.ink, 0.72), minSize: 10 });
    // CASCADE: big plate that heats from gold to coral as the chain climbs.
    const plate = { x: x + 10, y: y + 88, w: w - 20, h: 62 };
    const heat = (mult - 1) / 7;
    const plateFill = mix(p.gold, p.coral, heat * 0.85);
    const bump = mult >= 5 ? Math.round(2 + 2 * Math.sin(tick * 0.3) ) : 0;
    roundRect(ctx, plate.x, plate.y, plate.w, plate.h, 10, plateFill);
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.ink;
    roundRectPath(ctx, plate.x, plate.y, plate.w, plate.h, 10);
    ctx.stroke();
    textFit(ctx, 'CASCADE x' + mult, plate.x + plate.w * 0.5, plate.y + plate.h * 0.5 + 1, plate.w - 18 + bump, 38, { align: 'center', fill: p.ink, minSize: 20, weight: 'bold' });
    // streak pips: one per CASCADE step earned this chain
    const pips = 8;
    const span = 22;
    const px0 = x + w * 0.5 - (pips - 1) * span * 0.5;
    const lit = clamp(Math.floor(streak / 2), 0, pips);
    for (let i = 0; i < pips; i += 1) {
      circle(ctx, px0 + i * span, y + h - 10, 6, i < lit ? (i < mult - 1 ? p.coral : p.gold) : rgba(p.ink, 0.12), p.ink, 1.6);
    }
    text(ctx, 'STREAK', x + 12, y + h - 10, 12, { fill: rgba(p.ink, 0.55) });
  }

  function bloomPanel(ctx, sim, x, y, w, h) {
    const p = palette();
    const s = sim.stats || {};
    const got = Math.round(num(s.quotaGot, 0));
    const quota = Math.round(num(s.quota, 0));
    const boss = !!(sim.rows && sim.rows.boss);
    const met = boss ? !!(sim.boss && sim.boss.alive === false) : got >= quota;
    const frac = boss ? (sim.boss ? 1 - num(sim.boss.hp, 0) / Math.max(1, num(sim.boss.maxHp, 1)) : 0) : quota > 0 ? got / quota : 0;
    panel(ctx, x, y, w, h, { r: 12, tab: 'BLOOM', tabSize: 16, tabFill: p.mint });
    const label = boss ? 'DUSKFATHER  HP ' + Math.max(0, Math.round(num(sim.boss && sim.boss.hp, 0))) : 'BLOOM ' + got + ' / ' + quota;
    textFit(ctx, label, x + 12, y + 24, w - 24, 22, { align: 'left', fill: met ? p.ink : p.ink, minSize: 13 });
    if (met) chip(ctx, 'QUOTA MET', x + w - 106, y + 13, 94, 22, p.mint);
    const bar = { x: x + 12, y: y + 38, w: w - 24, h: 18 };
    roundRect(ctx, bar.x, bar.y, bar.w, bar.h, 9, mix(p.paper, p.ink, 0.08));
    const fillW = Math.round(bar.w * clamp(frac, 0, 1));
    if (fillW > 2) roundRect(ctx, bar.x, bar.y, fillW, bar.h, 9, met ? p.gold : p.mint);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = p.ink;
    roundRectPath(ctx, bar.x, bar.y, bar.w, bar.h, 9);
    ctx.stroke();
    const balls = Math.max(0, Math.round(num(s.ballsLeft, 0)));
    text(ctx, 'BALLS ' + balls, x + 12, y + 74, 19, { fill: balls <= 3 ? p.coral : p.ink });
    const dots = Math.min(10, balls);
    for (let i = 0; i < dots; i += 1) ballIcon(ctx, x + w - 16 - i * 15, y + 73, 5.5, true);
  }

  function seedsPanel(ctx, sim, x, y, w, h) {
    const p = palette();
    panel(ctx, x, y, w, h, { r: 12, tab: 'SEEDS', tabSize: 16, tabFill: p.leaf });
    text(ctx, String(Math.round(num(sim.seeds, 0))), x + 12, y + 38, 24, { fill: p.ink });
    const owned = [];
    const sockets = sim.sockets || [];
    for (let i = 0; i < sockets.length; i += 1) if (sockets[i] && sockets[i].kind) owned.push(sockets[i]);
    if (!owned.length) {
      textFit(ctx, 'NO CONTRAPTIONS YET', x + 12, y + 70, w - 24, 15, { align: 'left', fill: rgba(p.ink, 0.7), minSize: 10 });
      textFit(ctx, 'draft after this shower', x + 12, y + 86, w - 24, 14, { align: 'left', fill: p.leaf, minSize: 9 });
      return;
    }
    const icon = globalThis.PB_Board && globalThis.PB_Board.icon;
    for (let i = 0; i < owned.length && i < 8; i += 1) {
      const sx = x + 14 + (i % 8) * 38;
      const sy = y + 74;
      roundRect(ctx, sx - 15, sy - 15, 30, 30, 8, mix(p.paper, p.gold, 0.25));
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = rgba(p.ink, 0.55);
      roundRectPath(ctx, sx - 15, sy - 15, 30, 30, 8);
      ctx.stroke();
      if (icon) icon(ctx, owned[i].kind, sx, sy, 11);
      const lvl = num(owned[i].level, 1);
      roundRect(ctx, sx + 5, sy + 6, 18, 14, 7, lvl > 1 ? p.coral : p.gold);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = p.ink;
      roundRectPath(ctx, sx + 5, sy + 6, 18, 14, 7);
      ctx.stroke();
      text(ctx, 'L' + lvl, sx + 14, sy + 13.5, 11, { align: 'center', fill: lvl > 1 ? p.paper : p.ink });
    }
  }

  function showerTrack(ctx, sim, x, y, w, h) {
    const p = palette();
    const total = totalShowers();
    const cur = num(sim.shower, 1);
    const dayList = days();
    panel(ctx, x, y, w, h, { r: 12, tab: 'SHOWER TRACK', tabSize: 16, tabFill: p.sky });
    const perDay = total / Math.max(1, dayList.length);
    const inner = w - 28;
    const span = inner / Math.max(1, total - 1);
    const pipY = y + 40;
    for (let i = 0; i < total; i += 1) {
      const n = i + 1;
      const px = x + 14 + span * i;
      const boss = n === total;
      const done = n < cur;
      const ring = n === cur;
      if (ring) {
        circle(ctx, px, pipY, 15, rgba(p.gold, 0.5), p.ink, 3);
      }
      if (boss) {
        const skull = globalThis.PB_Sprites && globalThis.PB_Sprites.mothSkull;
        circle(ctx, px, pipY, 12, p.coral, p.ink, 2.2);
        if (skull) skull(ctx, px, pipY, 17);
        else text(ctx, 'X', px, pipY + 1, 14, { align: 'center', fill: p.ink });
      } else {
        circle(ctx, px, pipY, 10, done ? p.mint : n === cur ? p.gold : rgba(p.ink, 0.12), p.ink, 2);
        text(ctx, String(n), px, pipY + 1, 12, { align: 'center', fill: p.ink });
      }
      // day tick under the first pip of each day
      if ((n - 1) % perDay === 0) {
        const d = dayList[Math.floor((n - 1) / perDay)];
        if (d) textFit(ctx, String(d.name || 'DAY ' + d.day).toUpperCase(), px + span * 0.5 * (perDay - 1), y + 64, span * (perDay - 1) + 14, 11, { align: 'center', fill: rgba(p.ink, 0.6), minSize: 8 });
      }
    }
    ctx.strokeStyle = rgba(p.ink, 0.25);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 14, pipY);
    ctx.lineTo(x + w - 14, pipY);
    ctx.stroke();
    const left = Math.max(0, total - cur);
    const label = left > 0 ? (names().states && names().states.hold ? String(names().states.hold).replace('n', String(left)) : 'HOLD ' + left + ' MORE') : (sim.endless ? 'OVERBLOOM - ENDLESS' : 'FINAL SHOWER');
    textFit(ctx, label, x + 12, y + h - 16, w - 24, 17, { align: 'left', fill: left > 0 ? p.ink : p.coral, minSize: 11 });
  }

  // Drawn buttons. Every button writes its hitbox into view.buttons so input routing can read them.
  function buttons(ctx, sim, view, x, y, w, h) {
    const p = palette();
    const v = view || {};
    const box = v.buttons || (v.buttons = {});
    const defs = [
      { id: 'pause', label: sim.paused ? 'PLAY' : 'PAUSE', key: 'P', on: !!sim.paused, fill: p.gold },
      { id: 'ff', label: 'FF', key: 'F', on: !!v.fast, fill: p.sky },
      { id: 'mute', label: v.muted ? 'MUTED' : 'MUTE', key: 'M', on: !!v.muted, fill: p.mint },
    ];
    const bw = (w - 16) / 3;
    for (let i = 0; i < defs.length; i += 1) {
      const d = defs[i];
      const bx = x + i * (bw + 8);
      const rect = { x: bx, y: y, w: bw, h: h };
      roundRect(ctx, bx, y, bw, h, 10, d.on ? mix(d.fill, p.paper, 0.45) : d.fill);
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = p.ink;
      roundRectPath(ctx, bx, y, bw, h, 10);
      ctx.stroke();
      textFit(ctx, d.label, bx + bw * 0.5, y + h * 0.5 + 1, bw - 22, 20, { align: 'center', fill: p.ink, minSize: 11 });
      textFit(ctx, d.key, bx + bw - 10, y + h * 0.5 + 1, 14, 12, { align: 'right', fill: rgba(p.ink, 0.55), minSize: 9 });
      box[d.id] = rect;
    }
  }

  function drawRight(ctx, sim, view) {
    const p = palette();
    scorePanel(ctx, sim, view, RIGHT.x, 100, RIGHT.w, 150);
    bloomPanel(ctx, sim, RIGHT.x, 258, RIGHT.w, 92);
    seedsPanel(ctx, sim, RIGHT.x, 358, RIGHT.w, 88);
    showerTrack(ctx, sim, RIGHT.x, 454, RIGHT.w, 100);
    buttons(ctx, sim, view, RIGHT.x, 566, RIGHT.w, 40);
    const wind = sim.wind || {};
    const wv = globalThis.PB_Waves;
    const nextShower = num(sim.shower, 1) + 1;
    const nextRow = wv && typeof wv.showerConfig === 'function' ? wv.showerConfig(sim, nextShower) : null;
    const nextName = nextRow ? String(nextRow.windName || '').toUpperCase() : '';
    const force = nextRow ? num(nextRow.windForce, 0) : 0;
    const line = nextRow ? 'NEXT SHOWER: ' + nextName + (force ? ' - REAIM GATES' : ' - AIM YOUR GATES') : 'ENDLESS - ' + String(wind.name || 'STILL AIR');
    const wy = 616;
    panel(ctx, RIGHT.x, wy, RIGHT.w, 66, { r: 12, fill: mix(p.paper, p.sky, 0.12), border: p.ink, tab: 'WIND', tabSize: 15, tabFill: p.sky });
    textFit(ctx, line, RIGHT.x + 12, wy + 24, RIGHT.w - 24, 16, { align: 'left', fill: p.ink, minSize: 10 });
    textFit(ctx, 'NOW: ' + String(wind.name || 'STILL AIR'), RIGHT.x + 12, wy + 48, RIGHT.w - 24, 14, { align: 'left', fill: rgba(p.ink, 0.7), minSize: 9 });
    const banner = globalThis.PB_Banner;
    if (banner && typeof banner.drawLog === 'function') banner.drawLog(ctx, sim, { x: RIGHT.x, y: 690, w: RIGHT.w, h: 84 }, 3);
  }

  // ---------- build phase ----------

  // The 5 buildable contraptions with names, costs, one-line effects and OWNED counts (tab titles shorten the long effects).
  function buildCards(ctx, sim, view) {
    const p = palette();
    const namesList = names().contraptions || [];
    const v = view || {};
    const box = v.buttons || (v.buttons = {});
    const x = RIGHT.x;
    const y = 100;
    const w = RIGHT.w;
    const h = 640;
    const total = totalShowers();
    panel(ctx, x, y, w, h, { r: 12, fill: p.cream, border: p.ink, tab: 'BUILD', tabSize: 18, tabFill: p.gold });
    textFit(ctx, 'SEEDS ' + Math.round(num(sim.seeds, 0)), x + 12, y + 27, 130, 20, { align: 'left', fill: p.leaf, minSize: 12 });
    textFit(ctx, 'SHOWER ' + (num(sim.shower, 1) + 1) + ' / ' + total, x + w - 12, y + 27, 170, 16, { align: 'right', fill: rgba(p.ink, 0.7), minSize: 10 });
    textFit(ctx, 'CLICK A SOCKET, THEN A CARD', x + 12, y + 49, w - 24, 16, { align: 'left', fill: p.ink, minSize: 10 });
    const list = [];
    const top = y + 62;
    const cardH = 88;
    for (let i = 0; i < 5; i += 1) {
      const meta = namesList[i];
      if (!meta) break;
      const cy = top + i * (cardH + 6);
      const owned = num(sim.owned && sim.owned[meta.key], 0);
      const cost = num(meta.cost, 2);
      const afford = num(sim.seeds, 0) >= cost;
      const fill = afford ? mix(p.paper, p.gold, 0.16) : mix(p.paper, p.ink, 0.06);
      roundRect(ctx, x + 10, cy, w - 20, cardH, 10, fill);
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = afford ? p.ink : rgba(p.ink, 0.4);
      roundRectPath(ctx, x + 10, cy, w - 20, cardH, 10);
      ctx.stroke();
      const icon = globalThis.PB_Board && globalThis.PB_Board.icon;
      if (icon) icon(ctx, meta.key, x + 36, cy + 32, 17);
      textFit(ctx, meta.name, x + 60, cy + 16, w - 160, 19, { align: 'left', fill: p.ink, minSize: 12 });
      textFit(ctx, meta.effect, x + 60, cy + 38, w - 80, 14, { align: 'left', fill: rgba(p.ink, 0.72), minSize: 9 });
      const ownedLabel = owned > 0 ? 'OWNED ' + owned : 'OWNED 0';
      chip(ctx, ownedLabel, x + 14, cy + 52, 96, 22, owned > 0 ? p.mint : mix(p.paper, p.ink, 0.1));
      chip(ctx, cost + ' SEED' + (cost === 1 ? '' : 'S'), x + 118, cy + 52, 92, 22, afford ? p.gold : mix(p.coral, p.paper, 0.4));
      textFit(ctx, 'KEY ' + (i + 1), x + w - 14, cy + 63, 70, 14, { align: 'right', fill: rgba(p.ink, 0.6), minSize: 9 });
      list.push({ x: x + 10, y: cy, w: w - 20, h: cardH, index: i, kind: meta.key });
    }
    const doneRect = { x: x + 10, y: y + h - 62, w: w - 20, h: 46 };
    roundRect(ctx, doneRect.x, doneRect.y, doneRect.w, doneRect.h, 10, p.mint);
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.ink;
    roundRectPath(ctx, doneRect.x, doneRect.y, doneRect.w, doneRect.h, 10);
    ctx.stroke();
    text(ctx, 'DONE - START SHOWER', doneRect.x + doneRect.w * 0.5, doneRect.y + 24, 22, { align: 'center', fill: p.ink });
    box.done = doneRect;
    box.buildCards = list;
    v.buildCards = list;
    return list;
  }

  function controls(ctx, phase) {
    const p = palette();
    roundRect(ctx, 16, STRIP_Y, 1248, STRIP_H, 10, p.cream);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = rgba(p.ink, 0.55);
    roundRectPath(ctx, 16, STRIP_Y, 1248, STRIP_H, 10);
    ctx.stroke();
    textFit(ctx, CONTROLS, 28, STRIP_Y + STRIP_H * 0.5 + 1, 1000, 17, { align: 'left', fill: p.ink, minSize: 10 });
    textFit(ctx, 'MAP', 1252, STRIP_Y + STRIP_H * 0.5 + 1, 0, 15, { align: 'right', fill: p.ink, minSize: 9 });
    void phase;
  }

  function draw(ctx, sim, view) {
    if (!ctx || !sim) return;
    const v = view || {};
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawLeft(ctx, sim);
    if (isBuild(sim)) buildCards(ctx, sim, v);
    else drawRight(ctx, sim, v);
    controls(ctx, sim.phase);
    ctx.restore();
  }

  globalThis.PB_Hud = {
    draw: draw,
    controls: CONTROLS,
    puppet: PUPPET,
    layout: { left: LEFT, right: RIGHT, strip: { x: 16, y: STRIP_Y, w: 1248, h: STRIP_H } },
    formatScore: formatScore,
    buildCards: buildCards,
  };
})();
