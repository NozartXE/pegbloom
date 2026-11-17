// Draws the sliding event banner under the awning and owns the event-log box (used by the HUD’s right column).
(function () {
  if (typeof globalThis.PB_Banner === 'object' && globalThis.PB_Banner !== null) return;

  // The HUD's event-log box: newest of the last three sim.log lines first, ink on paper.
  const LOG = { x: 28, y: 614, w: 312, h: 126 };
  const LOG_SIZE = 15;
  const LOG_ROWS = 3;

  function palette() {
    return globalThis.PB_PALETTE || {
      cream: '#FFF6E9', paper: '#FFFDF6', coral: '#FF7A59', gold: '#FFC53D', sky: '#57B8FF',
      mint: '#4FD8A5', pink: '#FF9FB2', leaf: '#58B368', ink: '#2B2118',
    };
  }

  function config() {
    return globalThis.PB_CONFIG || { board: { field: {} } };
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

  function panel(ctx, x, y, w, h, spec) {
    const f = helper('panel');
    if (f) return f(ctx, x, y, w, h, spec);
    const p = palette();
    ctx.fillStyle = (spec && spec.fill) || p.paper;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    return ctx;
  }

  function text(ctx, str, x, y, size, spec) {
    const f = helper('text');
    if (f) return f(ctx, str, x, y, size, spec);
    const s = spec || {};
    ctx.save();
    ctx.font = 'bold ' + Math.round(size) + 'px "Arial Narrow", Arial, sans-serif';
    ctx.textAlign = s.align || 'left';
    ctx.textBaseline = s.baseline || 'middle';
    ctx.fillStyle = s.fill || palette().ink;
    ctx.fillText(String(str), x, y);
    ctx.restore();
    return null;
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

  // Kind -> ink for the coloured chip on each log row.
  const KIND_COLOUR = {
    win: 'mint',
    bloom: 'mint',
    build: 'gold',
    draft: 'gold',
    pest: 'coral',
    drain: 'coral',
    lose: 'coral',
    boss: 'pink',
    shower: 'sky',
    info: 'sky',
  };

  // The first line of an event makes the big banner text; the rest becomes the sub line.
  function splitBanner(event) {
    const raw = String(event.text || '');
    const cut = raw.split(' - ');
    const head = cut.shift() || raw;
    return { text: head, sub: cut.join(' - ') };
  }

  // A gold band that slides down from under the awning over ~50 ticks and lifts away at the end.
  function drawEvent(ctx, sim, tick) {
    const ev = sim && sim.banner;
    if (!ev || !ev.text) return;
    const p = palette();
    const total = Math.max(1, num(ev.ticks, 210));
    const life = ev.age == null ? 0 : ev.age;
    const enter = clamp(life / 12, 0, 1);
    const exit = clamp((total - life) / 12, 0, 1);
    const shown = Math.min(enter, exit);
    if (shown <= 0) return;
    // Ease-out so the band settles onto the frame instead of snapping.
    const ease = 1 - (1 - shown) * (1 - shown);
    const w = 690;
    const h = 62;
    const homeY = 94;
    const y = homeY - (1 - ease) * (h + 12);
    const x = (1280 - w) * 0.5;
    ctx.save();
    // shadow
    ctx.fillStyle = rgba(p.ink, 0.16 * ease);
    if (helper('roundRect')) helper('roundRect')(ctx, x + 3, y + 5, w, h, 12, rgba(p.ink, 0.16 * ease));
    panel(ctx, x, y, w, h, { r: 12, fill: p.gold, border: p.ink, borderWidth: 3 });
    // little pennant notches so the band reads as a garden banner
    ctx.fillStyle = p.coral;
    ctx.beginPath();
    ctx.moveTo(x + 16, y - 8);
    ctx.lineTo(x + 40, y - 8);
    ctx.lineTo(x + 28, y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    // the banner string is shown once, verbatim: no prefix, no head/sub split
    textFit(ctx, String(ev.text), x + w * 0.5, y + h * 0.5 + 1, w - 44, 26, { align: 'center', fill: p.ink, minSize: 13 });
    ctx.restore();
  }

  // sim.banner.ticks counts down in some events and up from 0 in others; main keeps `age` on the
  // sim in one place. This only advances a locally owned age when the sim does not carry one.
  function tickBanner(sim) {
    if (!sim || !sim.banner) return;
    if (typeof sim.banner.age !== 'number') sim.banner.age = 0;
    sim.banner.age += 1;
    if (sim.banner.age >= num(sim.banner.ticks, 210)) sim.banner = null;
  }

  // The event log box: newest first, small but legible, ink on paper. (sim, rect, rows) lets the
  // HUD's right-hand WIND panel show the same newest-first lines; default is the left box, 3 rows.
  function drawLog(ctx, sim, rect, rowCount) {
    const p = palette();
    const L = rect || LOG;
    const rowLimit = Math.max(1, Math.round(num(rowCount, LOG_ROWS)));
    const title = rowLimit === LOG_ROWS ? 'EVENT LOG' : 'LATEST EVENTS';
    panel(ctx, L.x, L.y, L.w, L.h, { r: 12, fill: p.paper, border: p.ink, borderWidth: 3, tab: title, tabSize: 15, tabFill: p.sky });
    const lines = (sim && Array.isArray(sim.log) ? sim.log : []).slice(-(rowLimit + 3)).reverse();
    const seen = [];
    const rows = [];
    for (let i = 0; i < lines.length && rows.length < rowLimit; i += 1) {
      const t = String(lines[i].text || '');
      if (!t || seen.indexOf(t) >= 0) continue;
      seen.push(t);
      rows.push(lines[i]);
    }
    ctx.save();
    const top = L.y + 12;
    const rowH = (L.h - 16) / rowLimit;
    for (let i = 0; i < rowLimit; i += 1) {
      const y = top + rowH * i + rowH * 0.5;
      const row = rows[i];
      const col = row ? (KIND_COLOUR[row.kind] || 'sky') : 'sky';
      ctx.fillStyle = row ? p[col] || p.sky : rgba(p.ink, 0.12);
      ctx.beginPath();
      ctx.arc(L.x + 16, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
      if (row) {
        textFit(ctx, String(row.text).toUpperCase(), L.x + 28, y, L.w - 40, LOG_SIZE, { align: 'left', fill: i === 0 ? p.ink : rgba(p.ink, 0.82), minSize: 9 });
      } else {
        text(ctx, '-', L.x + 28, y, LOG_SIZE, { align: 'left', fill: rgba(p.ink, 0.3) });
      }
      if (i < rowLimit - 1) {
        ctx.strokeStyle = rgba(p.ink, 0.1);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(L.x + 12, L.y + 12 + rowH * (i + 1));
        ctx.lineTo(L.x + L.w - 12, L.y + 12 + rowH * (i + 1));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function draw(ctx, sim, screen) {
    if (!ctx || !sim) return;
    if (screen !== 'play') return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawEvent(ctx, sim, num(sim.tick, 0));
    ctx.restore();
  }

  globalThis.PB_Banner = {
    draw: draw,
    tick: tickBanner,
    drawLog: drawLog,
    logRect: LOG,
    split: splitBanner,
  };
})();
