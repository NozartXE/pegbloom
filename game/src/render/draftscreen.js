// The between-shower draft screen: a wordmark-scale wind heading, the 1-of-3 roundels, the owned strip, an honest forecast on a mini board and the seed-costed reroll.
(function () {
  if (typeof globalThis.PB_DraftScreen === 'object' && globalThis.PB_DraftScreen !== null) return;

  const W = 1280;
  const H = 800;
  const HEAD = { x: 40, y: 40, w: 1200 };
  const SUB_Y = 96;
  const CARDS = { x: 24, top: 126, w: 402, h: 340, gap: 21 };
  const OWNED = { x: 24, y: 484, w: 1260, h: 116 };
  const FOOT = { x: 24, y: 610, h: 148 };
  const PICK_SIZE = 62;
  const ROUNDEL_R = 44;
  const REROLL = { x: 942, y: 670, w: 330, h: 76 };
  const DONE = { x: 942, y: 582, w: 330, h: 62 };
  const REROLL_KEY = 'X - REROLL';
  const WINDS = { east: 'EAST', west: 'WEST', gust: 'GUST', still: 'CALM' };
  const WIND_FLOW = { east: -1, west: 1, gust: 1, still: 0 };

  const LAYOUT = { head: HEAD, cards: CARDS, owned: OWNED, foot: FOOT, reroll: REROLL, done: DONE, pickSize: PICK_SIZE, roundelR: ROUNDEL_R };

  // ---------- shared helpers (board first, then howto, then CSS-stack fallbacks) ----------

  function palette() {
    return globalThis.PB_PALETTE || {
      cream: '#FFF6E9', paper: '#FFFDF6', coral: '#FF7A59', gold: '#FFC53D', sky: '#57B8FF',
      mint: '#4FD8A5', pink: '#FF9FB2', leaf: '#58B368', ink: '#2B2118',
    };
  }

  function config() {
    return globalThis.PB_CONFIG || { difficultyOrder: ['Gentle', 'Normal', 'Scorched'], draft: { rerollCost: 3, options: 3 }, showers: [], days: [] };
  }

  function names() {
    return globalThis.PB_NAMES || { days: [], pests: [], bossInfo: {} };
  }

  function howto() {
    return globalThis.PB_Howto || {};
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function rgba(hex, a) {
    const boards = globalThis.PB_Board;
    if (boards && typeof boards.rgba === 'function') return boards.rgba(hex, a);
    if (typeof howto().rgba === 'function') return howto().rgba(hex, a);
    const t = String(hex || '#000000').replace('#', '');
    const v = parseInt(t, 16);
    return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + clamp(num(a, 1), 0, 1) + ')';
  }

  function mix(hex, toward, amount) {
    const boards = globalThis.PB_Board;
    if (boards && typeof boards.mixHex === 'function') return boards.mixHex(hex, toward, amount);
    if (typeof howto().mix === 'function') return howto().mix(hex, toward, amount);
    return hex;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const boards = globalThis.PB_Board;
    if (boards && typeof boards.roundRectPath === 'function') return boards.roundRectPath(ctx, x, y, w, h, r);
    if (typeof howto().roundRectPath === 'function') return howto().roundRectPath(ctx, x, y, w, h, r);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    return ctx;
  }

  function roundRect(ctx, x, y, w, h, r, fill) {
    roundRectPath(ctx, x, y, w, h, r);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    return ctx;
  }

  function text(ctx, str, x, y, size, spec) {
    const boards = globalThis.PB_Board;
    if (boards && typeof boards.text === 'function') return boards.text(ctx, str, x, y, size, spec);
    if (typeof howto().text === 'function') return howto().text(ctx, str, x, y, size, spec);
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
    const boards = globalThis.PB_Board;
    if (boards && typeof boards.textFit === 'function') return boards.textFit(ctx, str, x, y, maxW, size, spec);
    if (typeof howto().textFit === 'function') return howto().textFit(ctx, str, x, y, maxW, size, spec);
    return text(ctx, str, x, y, size, spec);
  }

  function panel(ctx, x, y, w, h, spec) {
    const boards = globalThis.PB_Board;
    if (boards && typeof boards.panel === 'function') return boards.panel(ctx, x, y, w, h, spec || {});
    return roundRect(ctx, x, y, w, h, num(spec && spec.r, 14), palette().paper);
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

  function chip(ctx, label, cx, cy, w, h, fill) {
    const p = palette();
    roundRect(ctx, cx - w * 0.5, cy - h * 0.5, w, h, h * 0.5, fill);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = p.ink;
    roundRectPath(ctx, cx - w * 0.5, cy - h * 0.5, w, h, h * 0.5);
    ctx.stroke();
    textFit(ctx, label, cx, cy + 1, w - 12, h * 0.62, { align: 'center', fill: p.ink, minSize: 9 });
  }

  function formatScore(n) {
    if (globalThis.PB_Hud && typeof globalThis.PB_Hud.formatScore === 'function') return globalThis.PB_Hud.formatScore(n);
    return String(Math.max(0, Math.round(num(n, 0)))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function winds() {
    return config().winds || {
      still: { name: 'STILL AIR', force: 0, label: 'STILL' },
      east: { name: 'EAST WIND', force: -360, label: 'EAST WIND' },
      west: { name: 'WEST WIND', force: 360, label: 'WEST WIND' },
      gust: { name: 'GUSTING', force: 520, label: 'GUSTING' },
    };
  }

  // ---------- real data from sim / config / save ----------

  function showerRow(n) {
    if (globalThis.PB_Sim && typeof globalThis.PB_Sim.showerRow === 'function') return globalThis.PB_Sim.showerRow(n);
    const list = config().showers || [];
    if (n <= list.length) return list[n - 1];
    const k = Math.max(1, n - list.length);
    return { shower: n, balls: 56 + 2 * k, quota: 40 * k, wind: k % 2 === 1 ? 'east' : 'gust', pestBudget: 10 + k * 2, boss: false, endless: true };
  }

  function widget(api, name) {
    const handler = api && typeof api[name] === 'function' ? api[name] : typeof api === 'function' ? api : null;
    if (!handler) return null;
    try {
      return handler();
    } catch (e) {
      return null;
    }
  }

  function readSim(view) {
    return (view && (view.sim || view.state)) || widget(globalThis.PB_Game, 'currentSim') || widget(globalThis.PB_Main, 'currentSim') || null;
  }

  function readDemo(view) {
    const direct = view && (view.demo || view.demoSim);
    if (direct) return { sim: direct, discrete: false };
    const wrapped = widget(globalThis.PB_Main, 'demoSim') || widget(globalThis.PB_Title, 'demoSim');
    if (!wrapped) return null;
    if (wrapped.sim || wrapped.state) return { sim: wrapped.sim || wrapped.state, discrete: true };
    return { sim: wrapped, discrete: false };
  }

  function readSave() {
    const s = globalThis.PB_Save;
    if (!s) return { best: 0, feats: 0 };
    let data = null;
    if (typeof s.get === 'function') data = s.get();
    else if (typeof s.load === 'function') data = s.load();
    let feats = 0;
    if (typeof s.featsCount === 'function') feats = num(s.featsCount(), 0);
    else if (data && data.feats) for (const k in data.feats) if (data.feats[k]) feats += 1;
    return { best: Math.max(0, Math.round(num(data && data.best, 0))), feats: feats };
  }

  function featTotal() {
    const list = names().feats || [];
    return list.length || num(config().featCount, 6);
  }

  function showersTotal() {
    if (globalThis.PB_Sim && typeof globalThis.PB_Sim.showersTotal === 'function') return globalThis.PB_Sim.showersTotal();
    return (config().showers || []).length || 9;
  }

  function dayName(dayNum) {
    const list = names().days || config().days || [];
    for (let i = 0; i < list.length; i += 1) if (num(list[i].day, 0) === dayNum) return list[i].name;
    return 'DAY ' + dayNum;
  }

  function targetFor(sim) {
    return num(sim && sim.draft && sim.draft.target, num(sim && sim.shower, 1) + 1);
  }

  // A fully populated draft state for a run that has none yet (a hand-built or early sim).
  function draftSim(sim) {
    const base = sim || {};
    if (base.draft && Array.isArray(base.draft.offers) && base.draft.offers.length) return base;
    const s = {};
    for (const k in base) s[k] = base[k];
    const api = globalThis.PB_Draft;
    const target = targetFor(s);
    const offers = api && typeof api.makeOffers === 'function' ? api.makeOffers(s, target) : [];
    s.draft = { offers: offers || [], rerolls: 0, target: target, pending: null };
    return s;
  }

  // A title-style demo behind the cards is not the run's draft: never let its forecast or offers show.
  function demoBehind(run, demo) {
    return !!(demo && demo.sim && (demo.sim === run || (!run && demo.discrete)));
  }

  function buildSim(sim, demo) {
    const run = readSim({ sim: sim });
    if (run) return draftSim(run);
    const fallback = globalThis.PB_Sim && typeof globalThis.PB_Sim.createSim === 'function'
      ? globalThis.PB_Sim.createSim('pegbloom-draft-preview', 'Normal')
      : null;
    if (!fallback) return null;
    return demoBehind(fallback, demo) ? draftSim(fallback) : draftSim(fallback);
  }

  function roadRow(sim, target) {
    const row = showerRow(target);
    if (!row) return { key: 'still', label: 'CALM', name: 'STILL AIR' };
    const w = winds()[row.wind] || winds().still;
    return { key: row.wind || 'still', label: WINDS[row.wind] || String(w.label || 'CALM'), name: w.name, force: num(w.force, 0) };
  }

  // ---------- obstacle check for "GATES BLOCK IT" ----------

  function socketHitsPath(obstacle, path) {
    const half = num(obstacle.half, 12) + 9;
    for (let i = 0; i < path.length; i += 1) {
      const pt = path[i];
      if (pt.y < obstacle.y - half || pt.y > obstacle.y + half) continue;
      if (Math.abs(pt.x - obstacle.x) <= half) return true;
    }
    return false;
  }

  function blockingSocket(sim, forecast) {
    const path = forecast && Array.isArray(forecast.path) ? forecast.path : [];
    const sockets = (sim && sim.sockets) || [];
    if (!path.length || !sockets.length) return null;
    for (const k in sockets) {
      const s = sockets[k];
      if (s && s.kind && socketHitsPath(s, path)) return s;
    }
    return null;
  }

  // ---------- forecast (exactly the PB_Draft numbers) ----------

  function forecastFor(sim) {
    const api = globalThis.PB_Draft;
    if (!api || typeof api.forecast !== 'function') return null;
    try {
      let f = api.forecast(sim) || null;
      // Only trust a forecast for this draft's shower; a stale one from another target would lie.
      if (f && num(f.shower, -1) !== targetFor(sim)) f = api.forecast(sim) || f;
      if (f) sim.forecast = f;
      return f;
    } catch (e) {
      return null;
    }
  }

  function forecastLabel(f) {
    if (!f) return 'FORECAST PENDING';
    if (num(f.landed, 0) <= 0) return String(f.label || 'MISS - ALL DRAIN');
    // Label exactly as computed ("LANDS 6 CUPS"), then the same numbers as a breakdown.
    return String(f.label || 'LANDS ' + num(f.landed, 0) + ' CUPS') + ' - ' + num(f.drops && f.drops.length, num(f.landed, 0)) + ' MOTES';
  }

  function forecastThin(f) {
    if (!f) return true;
    const landed = num(f.landed, 0);
    const balls = Math.max(1, num(f.balls, 1));
    return landed < balls * 0.5;
  }

  function forecastThinLabel(f) {
    if (!f) return 'FORECAST: THIN - 0 CUP';
    const landed = num(f.landed, 0);
    if (landed <= 0) return 'FORECAST: ' + String(f.label || 'MISS - ALL DRAIN');
    return 'FORECAST: THIN - ' + (landed === 1 ? '1 CUP' : landed + ' CUPS');
  }

  // ---------- header ----------

  function headingLine(sim) {
    const target = targetFor(sim);
    const w = roadRow(sim, target);
    return 'WIND TURNS ' + w.label + ' - PICK 1';
  }

  function header(ctx, sim) {
    const p = palette();
    const target = targetFor(sim);
    const road = roadRow(sim, target);
    const heading = headingLine(sim);
    const h = howto();
    if (typeof h.fitHeading === 'function') {
      h.fitHeading(ctx, heading, HEAD.x, HEAD.y + 52, HEAD.w, {
        align: 'left', fill: p.coral, stroke: p.ink, strokeW: 11, spacing: 2, baseline: 'alphabetic', hi: 84, lo: 34,
      });
    } else {
      textFit(ctx, heading, HEAD.x + 4, HEAD.y + 30, HEAD.w - 8, 64, { align: 'left', fill: p.coral, minSize: 28 });
    }
    // slim mint underline, as on the title wordmark
    roundRect(ctx, HEAD.x + 6, HEAD.y + 60, HEAD.w - 12, 7, 3.5, p.mint);
    ctx.beginPath();
    ctx.moveTo(HEAD.x + 6, HEAD.y + 63.5);
    ctx.lineTo(HEAD.x + HEAD.w - 6, HEAD.y + 63.5);
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    // subline: "Shower N of 9 - <Day>", the next goal and the run wallet
    textFit(ctx, 'SHOWER ' + target + ' OF ' + showersTotal() + ' - ' + dayName(showerDay(target)), SUB_Y, 460, 24, { align: 'left', fill: p.ink, minSize: 12 });
    const row = showerRow(target);
    const goal = row.boss ? 'GOAL: DRIVE OFF THE DUSKFATHER' : 'GOAL: BLOOM ' + num(row.quota, 0) + ' CUPS';
    textFit(ctx, goal, HEAD.x + 4, SUB_Y, 440, 24, { align: 'left', fill: p.ink, minSize: 12 });
    const x = HEAD.x + HEAD.w - 4;
    textFit(ctx, 'SEEDS ' + Math.round(num(sim.seeds, 0)), x, SUB_Y, 120, 26, { align: 'right', fill: p.leaf, minSize: 12 });
    textFit(ctx, 'SCORE ' + formatScore(num(sim.score, 0)), x - 140, SUB_Y, 140, 22, { align: 'right', fill: p.ink, minSize: 12 });
    textFit(ctx, String(sim.diffName || (globalThis.PB_Sim && sim.diff && '') || 'NORMAL').toUpperCase(), x - 300, SUB_Y, 150, 20, { align: 'right', fill: rgba(p.ink, 0.75), minSize: 10 });
  }

  function showerDay(n) {
    const list = config().showers || [];
    const direct = list[n - 1];
    if (direct && direct.day != null) return num(direct.day, 3);
    if (globalThis.PB_Sim && typeof globalThis.PB_Sim.daysFor === 'function') {
      const d = globalThis.PB_Sim.daysFor(n);
      if (d) return d.day;
    }
    const days = config().days || names().days || [];
    for (let i = 0; i < days.length; i += 1) {
      const first = days[i].day * 3 - 2;
      if (n >= first && n <= first + 2) return days[i].day;
    }
    return 3;
  }

  // ---------- owned strip ----------

  function contraptionName(key) {
    const list = names().contraptions || [];
    const map = {
      bloomBumper: 'BLOOM BUMPER', splitterTulip: 'SPLITTER TULIP', magnetTulip: 'MAGNET TULIP', fanLeaf: 'FAN LEAF', springPad: 'SPRING PAD',
      goldenPeg: 'GOLDEN PEG', cascadeBell: 'CASCADE BELL', seedFan: 'SEED FAN', mothNet: 'MOTH NET', wideCups: 'WIDE CUPS',
      glowTrails: 'GLOW TRAILS', secondDropper: 'SECOND DROPPER',
    };
    for (let i = 0; i < list.length; i += 1) if (list[i].key === key) return list[i].name;
    const draftApi = globalThis.PB_Draft;
    if (draftApi && typeof draftApi.byKey === 'function') {
      const d = draftApi.byKey(key);
      if (d) return d.name;
    }
    return map[key] || String(key || '').toUpperCase();
  }

  function socketLevels(sim) {
    const out = {};
    const sockets = (sim && sim.sockets) || [];
    for (let i = 0; i < sockets.length; i += 1) {
      const s = sockets[i];
      if (!s || !s.kind) continue;
      out[s.kind] = Math.max(num(out[s.kind], 0), num(s.level, 1));
    }
    return out;
  }

  function ownedEntries(sim) {
    const out = [];
    const seen = {};
    const owned = (sim && sim.owned) || {};
    const levels = socketLevels(sim);
    const tokens = Array.isArray(sim && sim.tokens) ? sim.tokens : [];
    const tokenCount = {};
    for (let i = 0; i < tokens.length; i += 1) tokenCount[tokens[i]] = num(tokenCount[tokens[i]], 0) + 1;
    const push = function (key, have) {
      if (seen[key] || num(have, 0) <= 0) return;
      seen[key] = true;
      const lv = Math.max(num(levels[key], 1), Math.min(3, num(have, 0)));
      out.push({ key: key, name: contraptionName(key), have: num(have, 0), level: lv, built: !!levels[key], tokens: num(tokenCount[key], 0) });
    };
    // Built sockets first (they are in play), then the rack of tokens.
    for (const k in levels) push(k, num(owned[k], 0) + num(tokenCount[k], 0) + 1);
    for (const k in owned) push(k, owned[k]);
    const log = Array.isArray(sim && sim.draftLog) ? sim.draftLog : [];
    const logCount = {};
    for (let i = 0; i < log.length; i += 1) logCount[log[i].key] = num(logCount[log[i].key], 0) + 1;
    for (const k in logCount) push(k, logCount[k] + num(tokenCount[k], 0));
    return out;
  }

  function ownedStrip(ctx, sim) {
    const p = palette();
    panel(ctx, OWNED.x, OWNED.y, OWNED.w, OWNED.h, { r: 14, fill: p.cream, border: p.ink, tab: 'YOUR CONTRAPTIONS', tabSize: 17, tabFill: p.mint });
    const list = ownedEntries(sim);
    const top = OWNED.y + 22;
    const rowH = 40;
    if (!list.length) {
      textFit(ctx, 'NOTHING BUILT YET - EVERY PICK IS YOUR FIRST CHARM', OWNED.x + 20, OWNED.y + OWNED.h * 0.62, OWNED.w - 40, 26, { align: 'left', fill: p.ink, minSize: 12 });
      textFit(ctx, 'BUILDABLES GO ON SOCKETS AFTER THE PICK; CHARMS WORK AT ONCE', OWNED.x + 20, OWNED.y + OWNED.h * 0.88, OWNED.w - 40, 16, { align: 'left', fill: rgba(p.ink, 0.75), minSize: 9 });
      return list;
    }
    const icon = globalThis.PB_Board && typeof globalThis.PB_Board.icon === 'function' ? globalThis.PB_Board.icon : null;
    const perRow = Math.ceil(list.length / 2);
    const cw = (OWNED.w - 28) / Math.max(1, perRow);
    for (let i = 0; i < list.length && i < 12; i += 1) {
      const e = list[i];
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const cx = OWNED.x + 14 + cw * col;
      const cy = top + row * (rowH + 6);
      roundRect(ctx, cx + 3, cy, cw - 6, rowH, 10, mix(p.paper, colorsFor(e.key)[0], 0.16));
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = p.ink;
      roundRectPath(ctx, cx + 3, cy, cw - 6, rowH, 10);
      ctx.stroke();
      if (icon) icon(ctx, e.key, cx + 28, cy + rowH * 0.5, 15);
      const nameW = cw - 74;
      textFit(ctx, e.name, cx + 50, cy + rowH * 0.36, nameW, 17, { align: 'left', fill: p.ink, minSize: 10 });
      const status = e.tokens > 0 ? 'TOKEN x' + e.tokens : e.built ? 'BUILT LV' + e.level : 'CHARM';
      textFit(ctx, status, cx + 50, cy + rowH * 0.75, nameW, 13, { align: 'left', fill: e.tokens > 0 ? p.coral : rgba(p.ink, 0.75), minSize: 9 });
      const pips = e.built ? Math.min(3, e.level) : Math.min(3, e.have + (e.tokens > 0 ? 0 : 1));
      for (let d = 0; d < 3; d += 1) circle(ctx, cx + cw - 28 + d * 9, cy + rowH * 0.5, 3.6, d < pips ? p.coral : rgba(p.ink, 0.16), p.ink, 1.2);
    }
    return list;
  }

  // One accent per draft kind, so a roundel never looks like its neighbour.
  function colorsFor(key) {
    const p = palette();
    const map = {
      lanternLily: [p.coral, p.gold], reedSlide: [p.sky, p.mint], mossCushion: [p.leaf, p.mint], gemTrellis: [p.gold, p.pink], dewBell: [p.pink, p.sky],
      honeyCatch: [p.gold, p.coral], coneFern: [p.mint, p.leaf], rainChime: [p.sky, p.gold], thornBramble: [p.coral, p.leaf], lunarMirror: [p.sky, p.pink],
      seedSachet: [p.leaf, p.gold], duskLens: [p.pink, p.coral],
    };
    return map[key] || [p.gold, p.mint];
  }

  // ---------- draft icons: one simple mark per draft id ----------

  function decorate(ctx, key, x, y, r) {
    const p = palette();
    const lw = Math.max(2, r * 0.075);
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = lw;
    ctx.strokeStyle = p.ink;
    const col = colorsFor(key);
    if (key === 'lanternLily') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.58, r * 0.24);
      ctx.lineTo(r * 0.58, r * 0.24);
      ctx.moveTo(0, -r * 0.66);
      ctx.lineTo(0, -r * 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.44, r * 0.22);
      ctx.quadraticCurveTo(0, r * 0.78, r * 0.44, r * 0.22);
      ctx.fillStyle = p.gold;
      ctx.fill();
      ctx.stroke();
      circle(ctx, 0, r * 0.02, r * 0.16, p.coral, p.ink, lw * 0.7);
    } else if (key === 'reedSlide') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.55);
      ctx.quadraticCurveTo(r * 0.5, -r * 0.2, r * 0.1, r * 0.62);
      ctx.lineWidth = lw * 2.6;
      ctx.strokeStyle = col[1];
      ctx.stroke();
      ctx.lineWidth = lw;
      ctx.strokeStyle = p.ink;
      circle(ctx, -r * 0.5, -r * 0.42, r * 0.13, p.sky, p.ink, lw * 0.7);
    } else if (key === 'mossCushion') {
      ctx.beginPath();
      ctx.ellipse(0, r * 0.16, r * 0.62, r * 0.26, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.leaf;
      ctx.fill();
      ctx.stroke();
      for (let i = -2; i <= 2; i += 1) {
        circle(ctx, i * r * 0.2, -r * 0.05 - Math.abs(i) * 0.02 * r, r * 0.1, mix(p.mint, p.paper, 0.2), p.ink, lw * 0.6);
      }
    } else if (key === 'gemTrellis') {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.62);
      ctx.lineTo(r * 0.52, 0);
      ctx.lineTo(0, r * 0.62);
      ctx.lineTo(-r * 0.52, 0);
      ctx.closePath();
      ctx.fillStyle = p.sky;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.62);
      ctx.lineTo(0, r * 0.62);
      ctx.moveTo(-r * 0.52, 0);
      ctx.lineTo(r * 0.52, 0);
      ctx.lineWidth = lw * 0.7;
      ctx.strokeStyle = rgba(p.paper, 0.85);
      ctx.stroke();
    } else if (key === 'dewBell') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, r * 0.3);
      ctx.quadraticCurveTo(-r * 0.44, -r * 0.55, 0, -r * 0.58);
      ctx.quadraticCurveTo(r * 0.44, -r * 0.55, r * 0.5, r * 0.3);
      ctx.closePath();
      ctx.fillStyle = p.gold;
      ctx.fill();
      ctx.stroke();
      circle(ctx, 0, r * 0.44, r * 0.12, p.coral, p.ink, lw * 0.7);
    } else if (key === 'honeyCatch') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.46, -r * 0.18);
      ctx.lineTo(r * 0.2, -r * 0.18);
      ctx.lineTo(r * 0.02, r * 0.58);
      ctx.lineTo(-r * 0.28, r * 0.58);
      ctx.closePath();
      ctx.fillStyle = p.gold;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.3, -r * 0.3, r * 0.17, 0, Math.PI * 2);
      ctx.fillStyle = p.coral;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.18);
      ctx.quadraticCurveTo(-r * 0.62, -r * 0.36, -r * 0.5, -r * 0.66);
      ctx.lineWidth = lw * 0.8;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
    } else if (key === 'coneFern') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.5);
      ctx.quadraticCurveTo(0, r * 0.04, -r * 0.42, r * 0.6);
      ctx.quadraticCurveTo(r * 0.1, r * 0.2, r * 0.6, r * 0.5);
      ctx.lineWidth = lw * 2.4;
      ctx.strokeStyle = p.leaf;
      ctx.stroke();
      ctx.lineWidth = lw;
      ctx.strokeStyle = p.ink;
      circle(ctx, -r * 0.5, -r * 0.28, r * 0.12, p.gold, p.ink, lw * 0.6);
      circle(ctx, r * 0.46, r * 0.28, r * 0.12, p.gold, p.ink, lw * 0.6);
    } else if (key === 'rainChime') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.62);
      ctx.lineTo(r * 0.5, -r * 0.62);
      ctx.lineWidth = lw * 1.6;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
      for (let i = 0; i < 3; i += 1) {
        const bx = (i - 1) * r * 0.36;
        const by = -r * 0.3 + i * r * 0.06;
        ctx.beginPath();
        ctx.moveTo(bx, -r * 0.6);
        ctx.lineTo(bx, by - r * 0.14);
        ctx.lineWidth = lw * 0.7;
        ctx.stroke();
        circle(ctx, bx, by, r * 0.17, i === 1 ? p.gold : p.sky, p.ink, lw * 0.7);
      }
    } else if (key === 'thornBramble') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, r * 0.3);
      ctx.quadraticCurveTo(-r * 0.1, -r * 0.66, r * 0.6, -r * 0.2);
      ctx.lineWidth = lw * 2;
      ctx.strokeStyle = p.leaf;
      ctx.stroke();
      for (let i = -1; i <= 1; i += 1) {
        const tx = i * r * 0.26;
        const ty = i === 0 ? -r * 0.4 : i < 0 ? r * 0.02 : -r * 0.12;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + r * 0.1, ty - r * 0.22);
        ctx.lineTo(tx + r * 0.16, ty + r * 0.04);
        ctx.closePath();
        ctx.fillStyle = p.coral;
        ctx.fill();
        ctx.lineWidth = lw * 0.7;
        ctx.strokeStyle = p.ink;
        ctx.stroke();
      }
    } else if (key === 'lunarMirror') {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.34, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.sky;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.16, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = mix(p.paper, p.sky, 0.25);
      ctx.fill();
      ctx.lineWidth = lw * 0.7;
      ctx.stroke();
    } else if (key === 'seedSachet') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, -r * 0.12);
      ctx.quadraticCurveTo(-r * 0.6, r * 0.55, 0, r * 0.6);
      ctx.quadraticCurveTo(r * 0.6, r * 0.55, r * 0.42, -r * 0.12);
      ctx.closePath();
      ctx.fillStyle = mix(p.gold, p.paper, 0.25);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.12);
      ctx.lineTo(r * 0.3, -r * 0.12);
      ctx.moveTo(-r * 0.16, -r * 0.14);
      ctx.lineTo(-r * 0.26, -r * 0.56);
      ctx.moveTo(r * 0.16, -r * 0.14);
      ctx.lineTo(r * 0.26, -r * 0.56);
      ctx.lineWidth = lw * 0.8;
      ctx.strokeStyle = p.leaf;
      ctx.stroke();
      circle(ctx, -r * 0.12, r * 0.22, r * 0.08, p.leaf);
      circle(ctx, r * 0.14, r * 0.3, r * 0.08, p.leaf);
    } else {
      // duskLens
      circle(ctx, 0, 0, r * 0.52, rgba(p.pink, 0.9), p.ink, lw);
      circle(ctx, 0, 0, r * 0.24, p.paper, p.ink, lw * 0.7);
      circle(ctx, r * 0.1, -r * 0.12, r * 0.09, p.ink);
      for (let i = 0; i < 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.28 + i * r * 0.5, r * 0.12);
        ctx.lineTo(-r * 0.36 + i * r * 0.5, r * 0.2);
        ctx.moveTo(-r * 0.28 + i * r * 0.5, r * 0.12);
        ctx.lineTo(-r * 0.3 + i * r * 0.5, r * 0.24);
        ctx.lineWidth = lw * 0.6;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---------- the three roundels ----------

  function cards(ctx, sim, view, buttons) {
    const p = palette();
    const offers = (sim.draft && sim.draft.offers) || [];
    const api = globalThis.PB_Draft;
    let forecast = forecastFor(sim);
    const block = blockingSocket(sim, forecast);
    const list = [];
    const economy = 'SEEDS ' + Math.round(num(sim.seeds, 0)) + ' - BUY ONE';
    for (let i = 0; i < 3; i += 1) {
      const offer = offers[i] || null;
      const x = CARDS.x + i * (CARDS.w + CARDS.gap);
      const y = CARDS.top;
      const fill = offer ? mix(p.paper, colorsFor(offer.key)[0], 0.12) : mix(p.paper, p.ink, 0.06);
      panel(ctx, x, y, CARDS.w, CARDS.h, { r: 18, fill: fill, border: p.ink, borderWidth: 3.4 });
      // key hint chip, top-left
      chip(ctx, String(i + 1), x + 40, y + 30, 52, 38, p.gold);
      // roundel
      const rx = x + CARDS.w * 0.5;
      const ry = y + 82;
      circle(ctx, rx, ry, ROUNDEL_R + 7, rgba(p.ink, 0.1));
      circle(ctx, rx, ry, ROUNDEL_R, offer ? p.paper : mix(p.paper, p.ink, 0.08), p.ink, 3.2);
      if (offer) {
        decorate(ctx, offer.key, rx, ry, ROUNDEL_R - 4);
        drawKindIcon(ctx, offer.key, x + CARDS.w - 44, y + 30, 14);
      } else {
        textFit(ctx, 'SOLD OUT', rx, ry, ROUNDEL_R * 1.6, 16, { align: 'center', fill: rgba(p.ink, 0.5), minSize: 9 });
      }
      // name at wordmark scale for a card
      textFit(ctx, offer ? offer.name : 'NO OFFER', rx, y + 154, CARDS.w - 32, 34, { align: 'center', fill: p.ink, minSize: 14 });
      if (offer) {
        const kind = offer.token ? 'BUILDABLE - PLACE ON A SOCKET' : offer.oneShot ? 'ONE-SHOT CHARM' : 'REPEATABLE CHARM';
        chip(ctx, kind, rx, y + 186, 240, 24, offer.token ? p.sky : p.pink);
        textFit(ctx, offer.effect, x + 18, y + 218, CARDS.w - 36, 19, { align: 'left', fill: p.ink, minSize: 11 });
        textFit(ctx, offer.synergy, x + 18, y + 254, CARDS.w - 36, 17, { align: 'left', fill: p.leaf, minSize: 10 });
        const matches = block && api && typeof api.byKey === 'function' && block.kind === (api.byKey(offer.key) || {}).key;
        textFit(ctx, matches ? economy : economy, x + 18, y + 286, CARDS.w - 36, 17, { align: 'left', fill: matches ? p.coral : p.ink, minSize: 10 });
      } else {
        textFit(ctx, 'REROLL TO SEE THREE AGAIN', x + 18, y + 226, CARDS.w - 36, 19, { align: 'left', fill: p.ink, minSize: 11 });
      }
      // pick button
      const hit = { x: x + 14, y: y + CARDS.h - 56, w: CARDS.w - 28, h: 44, index: i, key: offer ? offer.key : null };
      const afford = !offer || offer.cost == null || num(sim.seeds, 0) >= num(offer.cost, 0);
      roundRect(ctx, hit.x, hit.y, hit.w, hit.h, 12, afford ? p.mint : mix(p.coral, p.paper, 0.45));
      ctx.lineWidth = 3;
      ctx.strokeStyle = p.ink;
      roundRectPath(ctx, hit.x, hit.y, hit.w, hit.h, 12);
      ctx.stroke();
      textFit(ctx, offer ? 'PICK ' + (i + 1) : 'KEY ' + (i + 1) + ' - EMPTY', hit.x + hit.w * 0.5, hit.y + hit.h * 0.5 + 1, hit.w - 24, 24, { align: 'center', fill: p.ink, minSize: 12 });
      buttons['pick' + i] = hit;
      list.push(hit);
    }
    return { list: list, forecast: forecast, block: block, offers: offers };
  }

  // A tiny ink-and-colour badge by the roundel corner for fast scan at thumbnail size.
  function drawKindIcon(ctx, key, x, y, r) {
    const p = palette();
    const col = colorsFor(key);
    circle(ctx, x, y, r + 3, col[0], p.ink, 2);
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.ink;
    ctx.fillStyle = p.paper;
    if (key === 'gemTrellis' || key === 'lunarMirror' || key === 'duskLens') {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.8);
      ctx.lineTo(r * 0.7, 0);
      ctx.lineTo(0, r * 0.8);
      ctx.lineTo(-r * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (key === 'seedSachet' || key === 'thornBramble') {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = p.paper;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = p.leaf;
      ctx.fill();
    } else if (key === 'rainChime' || key === 'dewBell') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, r * 0.4);
      ctx.quadraticCurveTo(-r * 0.5, -r * 0.7, 0, -r * 0.7);
      ctx.quadraticCurveTo(r * 0.5, -r * 0.7, r * 0.6, r * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, 0);
      ctx.lineTo(r * 0.3, 0);
      ctx.stroke();
    }
    ctx.restore();
  }


  // ---------- forecast panel: ghost cascade over a mini board, drawn honestly ----------

  function miniLayout(sim) {
    const c = config();
    const f = (c.board && c.board.field) || { x: 368, y: 150, w: 544, h: 520 };
    const row = showerRow(targetFor(sim));
    const cups = (sim && sim.cups && sim.cups.length) ? sim.cups : (globalThis.PB_Pegboard && typeof globalThis.PB_Pegboard.buildCups === 'function' ? globalThis.PB_Pegboard.buildCups(c) : []);
    const rows = Array.isArray(sim && sim.pegs) && sim.pegs.length ? sim.pegs : (globalThis.PB_Pegboard && typeof globalThis.PB_Pegboard.buildPegs === 'function' ? globalThis.PB_Pegboard.buildPegs(c) : []);
    const left = cups.length ? num(cups.startX, f.x) : f.x;
    const right = cups.length ? num(cups.endX, f.x + f.w) : f.x + f.w;
    const top = f.y - 6;
    const bottom = num((c.board && c.board.cupY) || f.y + f.h, f.y + f.h) + 34;
    const w = Math.max(120, right - left);
    const h = Math.max(120, bottom - top);
    return { f: f, cups: cups, rows: rows, row: row, left: left, right: right, top: top, bottom: bottom, w: w, h: h, field: f };
  }

  function drawMiniBoard(ctx, sim, box, data) {
    const p = palette();
    const c = config();
    const lay = miniLayout(sim);
    const scale = Math.min(box.w / lay.w, box.h / lay.h);
    const ox = box.x + (box.w - lay.w * scale) * 0.5;
    const oy = box.y + box.h - lay.h * scale;
    const mapX = function (x) { return ox + (num(x, lay.f.x) - lay.left) * scale; };
    const mapY = function (y) { return oy + (num(y, lay.top) - lay.top) * scale; };
    // board paper
    roundRect(ctx, ox - 4, oy - 4, lay.w * scale + 8, lay.h * scale + 8, 8, mix(p.cream, p.sky, 0.1));
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(p.ink, 0.5);
    roundRectPath(ctx, ox - 4, oy - 4, lay.w * scale + 8, lay.h * scale + 8, 8);
    ctx.stroke();
    // deadened pegs from this shower, lit pegs gold, plain pegs faint
    for (let i = 0; i < lay.rows.length; i += 1) {
      const peg = lay.rows[i];
      if (!peg) continue;
      const r = clamp(num(peg.r, 8) * scale, 1.2, 4);
      const dead = num(peg.dead, 0) > 0;
      ctx.beginPath();
      ctx.arc(mapX(peg.x), mapY(peg.y), r, 0, Math.PI * 2);
      ctx.fillStyle = dead ? rgba(p.ink, 0.18) : peg.golden || num(peg.lit, 0) > 0.5 ? p.gold : mix(p.coral, p.paper, 0.55);
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = rgba(p.ink, dead ? 0.25 : 0.6);
      ctx.stroke();
    }
    // placed contraptions show as small gold sockets so the forecast reads as "with your build"
    const sockets = (sim && sim.sockets) || [];
    for (let i = 0; i < sockets.length; i += 1) {
      const s = sockets[i];
      if (!s || !s.kind) continue;
      circle(ctx, mapX(s.x), mapY(s.y), 4.5, p.gold, p.ink, 1.2);
    }
    // the cup row, coloured as the real cups and numbered with their value
    for (let i = 0; i < lay.cups.length; i += 1) {
      const cup = lay.cups[i];
      const cw = num(cup.w, c.board.cupWidth) * scale;
      const ch = num(cup.h, c.board.cupHeight) * scale;
      roundRect(ctx, mapX(cup.x) - cw * 0.5, mapY(cup.y) + 2, cw, ch - 2, 3, p[cup.colourName] || p.gold);
      ctx.lineWidth = 1;
      ctx.strokeStyle = p.ink;
      roundRectPath(ctx, mapX(cup.x) - cw * 0.5, mapY(cup.y) + 2, cw, ch - 2, 3);
      ctx.stroke();
      text(ctx, String(num(i + 1, 0)), mapX(cup.x), mapY(cup.y) + ch * 0.55, 9, { align: 'center', fill: p.ink });
    }
    // drains catch the misses
    for (const k in lay.cups.drains || {}) {
      const d = lay.cups.drains[k];
      if (!(num(d.w, 0) > 2)) continue;
      roundRect(ctx, mapX(d.x) + 1, mapY(num(d.y, 0)) + 2, Math.max(2, num(d.w, 0) * scale - 2), 8, 2, rgba(p.coral, 0.55));
    }
    // ghost cascade: one faint dot per path point, the mote's final landing ringed in its colour
    const path = (data.forecast && Array.isArray(data.forecast.path)) ? data.forecast.path : [];
    for (let i = 0; i < path.length; i += 1) {
      const pt = path[i];
      ctx.beginPath();
      ctx.arc(mapX(pt.x), mapY(pt.y), 1.8, 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.ink, 0.5);
      ctx.fill();
    }
    // ring every mote's landing point, and draw a small X over real misses
    const drops = (data.forecast && Array.isArray(data.forecast.drops)) ? data.forecast.drops : [];
    let shown = 0;
    for (let i = 0; i < drops.length && shown < 12; i += 1) {
      const d = drops[i];
      const x = mapX(d.x);
      const y = mapY(num((c.board && c.board.cupY), 678) + 8);
      if (d.kind === 'drain' || num(d.cup, -1) < 0) {
        ctx.beginPath();
        ctx.moveTo(x - 4, y - 4);
        ctx.lineTo(x + 4, y + 4);
        ctx.moveTo(x + 4, y - 4);
        ctx.lineTo(x - 4, y + 4);
        ctx.lineWidth = 2;
        ctx.strokeStyle = p.coral;
        ctx.stroke();
      } else {
        circle(ctx, x, y, 3.4, rgba(p[String(d.colour || 'gold')] || p.gold, 0.95), p.ink, 1);
      }
      shown += 1;
    }
    // the blocking gate/socket mark, only if the path really crosses it
    if (data.block) {
      circle(ctx, mapX(data.block.x), mapY(data.block.y), 6, p.coral, p.ink, 1.6);
    }
    // next-shower draught arrows down the board
    const flow = WIND_FLOW[lay.row.wind] || 0;
    if (flow !== 0) {
      for (let i = 0; i < 4; i += 1) {
        const x = ox + (lay.w * scale) * (0.2 + i * 0.2);
        const y = oy + (lay.h * scale) * (0.22 + (i % 2) * 0.12);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + flow * 16, y + 10, x + flow * 30, y + 18);
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = rgba(p.sky, 0.85);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + flow * 30, y + 18);
        ctx.lineTo(x + flow * 22, y + 8);
        ctx.moveTo(x + flow * 30, y + 18);
        ctx.lineTo(x + flow * 18, y + 20);
        ctx.stroke();
      }
    }
    return { scale: scale, ox: ox, oy: oy, mapX: mapX, mapY: mapY };
  }

  // Honest label, coloured by the real numbers: mint when most of the motes land, coral when thin.
  function forecastVerdict(ctx, sim, data, x, y, maxW) {
    const p = palette();
    const f = data.forecast;
    const thin = forecastThin(f);
    const main = thin ? forecastThinLabel(f) : forecastLabel(f);
    textFit(ctx, main, x, y, maxW, 34, { align: 'left', fill: thin ? p.coral : p.mint, stroke: p.ink, strokeW: 5, minSize: 14 });
    return { thin: thin };
  }

  function forecastPanel(ctx, sim, data, buttons) {
    const p = palette();
    const y = FOOT.y;
    const h = FOOT.h;
    panel(ctx, FOOT.x, y, 900, h, { r: 14, fill: p.paper, border: p.ink, tab: 'FORECAST', tabSize: 18, tabFill: p.sky });
    const boardBox = { x: FOOT.x + 12, y: y + 22, w: 236, h: h - 32 };
    const mini = drawMiniBoard(ctx, sim, boardBox, data);
    const tx = boardBox.x + boardBox.w + 16;
    const tw = 900 - (tx - FOOT.x) - 16;
    const row = data.row || showerRow(targetFor(sim));
    const winfo = { key: row.wind || 'still', ...(winds()[row.wind] || winds().still) };
    const f = data.forecast;
    const windName = String(winfo.name || 'STILL AIR').toUpperCase();
    textFit(ctx, 'SHOWER ' + targetFor(sim) + ': ' + windName + ' - ' + (row.boss ? 'DUSKFATHER' : 'BLOOM ' + num(row.quota, 0) + ' CUPS'), tx, y + 38, tw, 24, { align: 'left', fill: p.ink, minSize: 12 });
    textFit(ctx, 'WITH YOUR BOARD AS BUILT - ' + (f ? num(f.balls, 12) + ' MOTES DROPPED' : 'MEASURING'), tx, y + 64, tw, 16, { align: 'left', fill: rgba(p.ink, 0.8), minSize: 9 });
    forecastVerdict(ctx, sim, data, tx, y + 100, tw);
    const landed = f ? num(f.landed, 0) : 0;
    const misses = f ? num(f.misses, 0) : 0;
    const cups = f && Array.isArray(f.cups) ? f.cups : [];
    let label = landed + ' LAND - ' + misses + ' DRAIN';
    if (misses > 0) label += ' (' + misses + ' SUNWELL PUT AT RISK)';
    textFit(ctx, label, tx, y + 126, tw, 17, { align: 'left', fill: p.ink, minSize: 10 });
    if (cups.length) {
      textFit(ctx, 'CUPS HIT: ' + cups.map(function (v, i) { return (i + 1) + ':' + num(v, 0); }).join('  '), tx, y + 150 - 2, tw, 15, { align: 'left', fill: rgba(p.ink, 0.8), minSize: 8 });
    }
    // The two seed-costed options, side by side under the verdict.
    const api = globalThis.PB_Draft;
    const cost = api && typeof api.rerollCost === 'function' ? num(api.rerollCost(sim), num(config().draft.rerollCost, 3)) : num(config().draft.rerollCost, 3);
    const afford = num(sim.seeds, 0) >= cost;
    const rx = REROLL.x;
    const ry = REROLL.y;
    roundRect(ctx, rx, ry, REROLL.w, REROLL.h, 14, afford ? p.paper : mix(p.paper, p.ink, 0.08));
    ctx.lineWidth = 3;
    ctx.strokeStyle = afford ? p.ink : rgba(p.ink, 0.4);
    roundRectPath(ctx, rx, ry, REROLL.w, REROLL.h, 14);
    ctx.stroke();
    const keyChip = { x: rx + 10, y: ry + 12, w: 46, h: 40 };
    roundRect(ctx, keyChip.x, keyChip.y, keyChip.w, 40, 8, afford ? p.gold : mix(p.paper, p.ink, 0.1));
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = afford ? p.ink : rgba(p.ink, 0.4);
    roundRectPath(ctx, keyChip.x, keyChip.y, keyChip.w, 40, 8);
    ctx.stroke();
    textFit(ctx, 'X', keyChip.x + keyChip.w * 0.5, keyChip.y + 21, 30, 26, { align: 'center', fill: afford ? p.ink : rgba(p.ink, 0.45), minSize: 12 });
    textFit(ctx, REROLL_KEY, rx + 66, ry + 23, REROLL.w - 170, 22, { align: 'left', fill: afford ? p.ink : rgba(p.ink, 0.45), minSize: 11 });
    // seed cost chip with the visible price
    const seedW = 118;
    const sx = rx + REROLL.w - seedW - 12;
    roundRect(ctx, sx, ry + 9, seedW, 30, 15, afford ? p.sky : mix(p.coral, p.paper, 0.45));
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = p.ink;
    roundRectPath(ctx, sx, ry + 9, seedW, 30, 15);
    ctx.stroke();
    circle(ctx, sx + 16, ry + 24, 6, p.gold, p.ink, 1.4);
    textFit(ctx, cost + ' SEEDS', sx + 28, ry + 24, seedW - 34, 17, { align: 'left', fill: p.ink, minSize: 9 });
    textFit(ctx, afford ? 'YOUR SEEDS ' + Math.round(num(sim.seeds, 0)) : 'NOT ENOUGH - NEED ' + cost + ', HAVE ' + Math.round(num(sim.seeds, 0)), rx + 14, ry + 63, REROLL.w - 28, 15, { align: 'left', fill: afford ? rgba(p.ink, 0.8) : p.coral, minSize: 9 });
    buttons.reroll = { x: rx, y: ry, w: REROLL.w, h: REROLL.h, afford: afford, cost: cost };
    // DONE, the second seed-free exit above the reroll
    roundRect(ctx, DONE.x, DONE.y, DONE.w, DONE.h, 14, p.mint);
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.ink;
    roundRectPath(ctx, DONE.x, DONE.y, DONE.w, DONE.h, 14);
    ctx.stroke();
    chip(ctx, 'ENTER', DONE.x + 34, DONE.y + DONE.h * 0.5, 52, 34, p.paper);
    textFit(ctx, 'PICK THE FIRST - GO', DONE.x + 68, DONE.y + DONE.h * 0.5 + 1, DONE.w - 80, 24, { align: 'left', fill: p.ink, minSize: 12 });
    buttons.done = { x: DONE.x, y: DONE.y, w: DONE.w, h: DONE.h };
    if (data.block) {
      textFit(ctx, 'GATES BLOCK IT: YOUR ' + (data.block.name || contraptionName(data.block.kind)) + ' SITS UNDER THE PATH', tx, y + 150 - 2, tw, 15, { align: 'left', fill: p.coral, minSize: 8 });
    }
    return mini;
  }

  // ---------- footer strip + backdrop ----------

  function backdrop(ctx) {
    const p = palette();
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, mix(p.cream, p.sky, 0.16));
    g.addColorStop(0.45, p.cream);
    g.addColorStop(1, mix(p.cream, p.gold, 0.22));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // pale garden pegs and flowers; deterministic, no random
    if (globalThis.PB_Board && typeof globalThis.PB_Board.hash === 'function') {
      for (let i = 0; i < 90; i += 1) {
        const x = 20 + globalThis.PB_Board.hash(i, 3) * (W - 40);
        const y = 130 + globalThis.PB_Board.hash(i, 7) * (H - 200);
        circle(ctx, x, y, 3 + globalThis.PB_Board.hash(i, 11) * 4, rgba(p.pink, 0.22), rgba(p.ink, 0.12), 1);
      }
    }
    const h = howto();
    if (typeof h.flower === 'function') {
      for (let i = 0; i < 7; i += 1) h.flower(ctx, 60 + i * 200, 776, 12 + (i % 3) * 4, i % 2 ? p.pink : p.gold, p.mint);
    }
  }

  function controlsStrip(ctx, sim) {
    const p = palette();
    const y = 766;
    const line = '1 2 3 pick a contraption - X reroll for seeds - ENTER take the first - REROLL CHANGES THE OFFERS FOR THIS SHOWER ONLY';
    roundRect(ctx, 24, y, 1232, 28, 8, rgba(p.paper, 0.92));
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = rgba(p.ink, 0.45);
    roundRectPath(ctx, 24, y, 1232, 28, 8);
    ctx.stroke();
    textFit(ctx, line, 38, y + 15, 980, 16, { align: 'left', fill: p.ink, minSize: 9 });
    textFit(ctx, 'DRAFT - SHOWER ' + targetFor(sim) + ' OF ' + showersTotal(), 1242, y + 15, 300, 16, { align: 'right', fill: p.ink, minSize: 9 });
  }

  // ---------- public draw ----------

  // `view` is optional: { sim, demo|demoSim, buttons, difficulty }. The HUD is intentionally not drawn here.
  function draw(ctx, sim, view) {
    if (!ctx) return;
    const v = view || {};
    const run = buildSim(sim || readSim(v), readDemo(v));
    if (!run) return; // nothing real to draft from: leave the canvas to the caller
    const buttons = v.buttons && typeof v.buttons === 'object' ? v.buttons : (v.buttons = {});
    const p = palette();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    backdrop(ctx);
    header(ctx, run);
    const data = cards(ctx, run, v, buttons);
    data.row = showerRow(targetFor(run));
    ownedStrip(ctx, run);
    forecastPanel(ctx, run, data, buttons);
    controlsStrip(ctx, run);
    // top-left identity tag, so the thumbnail still says which game this is
    roundRect(ctx, HEAD.x, HEAD.y - 26, 150, 22, 11, p.ink);
    textFit(ctx, 'PEGBLOOM', HEAD.x + 75, HEAD.y - 15, 128, 15, { align: 'center', fill: p.paper, minSize: 9 });
    ctx.restore();
    return data;
  }

  globalThis.PB_DraftScreen = {
    draw: draw,
    layout: LAYOUT,
    headingLine: headingLine,
    forecastLabel: forecastLabel,
    forecastThinLabel: forecastThinLabel,
    forecastThin: forecastThin,
    ownedEntries: ownedEntries,
    draftSim: draftSim,
    readDemo: readDemo,
  };
})();
