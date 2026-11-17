// Builds the pegboard layout: staggered pegs, contraption sockets and the bloom cups, with fast lookup helpers.
(function () {
  if (typeof globalThis.PB_Pegboard === 'object' && globalThis.PB_Pegboard !== null) return;

  function cfg() {
    const c = globalThis.PB_CONFIG;
    if (!c || !c.board) throw new Error('PG_Pegboard: PB_CONFIG.board missing (load config.js first)');
    return c;
  }

  function palette() {
    return globalThis.PB_PALETTE || { sky: '#57B8FF', mint: '#4FD8A5', gold: '#FFC53D', pink: '#FF9FB2', coral: '#FF7A59' };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  // Which grid row a board y sits on, nearest first; used for O(1)-ish bucket lookups.
  function rowAt(config, y) {
    const b = config.board;
    const rows = b.pegRows;
    const total = (rows - 1) * b.pegSpacingY;
    const row = Math.round((y - (b.field.y + b.pegSpacingY * 0.5)) / b.pegSpacingY);
    if (total < 0) return 0;
    return clamp(row, 0, rows - 2);
  }

  // The staggered grid: rows alternate a half-column offset, pegs sit inside the field rect,
  // away from the side walls, the drop lane above and the cup row below.
  function buildPegs(config) {
    const c = config || cfg();
    const b = c.board;
    const field = b.field;
    const half = b.pegSpacingX * 0.5;
    const wallGap = Math.round((field.w - (b.pegCols - 1) * b.pegSpacingX - half) * 0.5);
    const rowCount = Math.max(1, b.pegRows - 1);
    const pegs = [];
    for (let r = 0; r < rowCount; r += 1) {
      const y = field.y + b.pegSpacingY * 0.5 + r * b.pegSpacingY;
      if (y + b.pegRadius > field.y + field.h - b.cupHeight) break;
      const offset = r % 2 === 0 ? 0 : half;
      for (let k = 0; k < b.pegCols; k += 1) {
        const x = field.x + wallGap + offset + k * b.pegSpacingX;
        if (x + b.pegRadius > field.x + field.w - wallGap) continue;
        pegs.push({ x: x, y: y, r: b.pegRadius, lit: 0, dead: 0, golden: false, hitFlash: 0, row: r, col: k });
      }
    }
    return pegs;
  }

  // Rows of the grid as one jagged bucket list per row, kept in index order for order-stable physics.
  function buildRows(config, pegs) {
    const c = config || cfg();
    const b = c.board;
    const list = pegs || [];
    const rows = [];
    for (let i = 0; i < Math.max(1, b.pegRows - 1); i += 1) rows.push([]);
    for (let i = 0; i < list.length; i += 1) {
      const peg = list[i];
      peg.index = i;
      const r = rowAt(c, peg.y);
      rows[r].push(peg);
    }
    return { rows: rows, config: c };
  }

  const ROW_PAD = 2;

  // Nearest peg index to a point within maxDist (or the nearest peg at all when maxDist is missing).
  function pegAt(grid, x, y, maxDist) {
    if (!grid || !grid.rows || !grid.rows.length) return -1;
    const c = grid.config;
    const r0 = rowAt(c, y);
    let best = -1;
    let bestD2 = maxDist == null ? Infinity : maxDist * maxDist;
    for (let r = Math.max(0, r0 - ROW_PAD); r <= Math.min(grid.rows.length - 1, r0 + ROW_PAD); r += 1) {
      const bucket = grid.rows[r];
      for (let i = 0; i < bucket.length; i += 1) {
        const p = bucket[i];
        const dx = p.x - x;
        const dy = p.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = p.index;
        }
      }
    }
    return best;
  }

  // Pushes every peg whose row contains more than its dead cap or matching a filter, in index order.
  function pegsInRows(grid, y0, y1) {
    if (!grid || !grid.rows || !grid.rows.length) return [];
    const c = grid.config;
    const a = rowAt(c, y0);
    const b = rowAt(c, y1);
    const out = [];
    for (let r = Math.max(0, a); r <= Math.min(grid.rows.length - 1, b); r += 1) {
      const bucket = grid.rows[r];
      for (let i = 0; i < bucket.length; i += 1) out.push(bucket[i]);
    }
    out.sort(function (p, q) { return p.index - q.index; });
    return out;
  }

  // Broadphase: pegs a circle at (x, y) with radius r could touch in this step, in index order.
  // dtAccum is the distance (position + swept speed * dt) the ball moves this tick.
  function nearestPegs(grid, x, y, r, dtAccum, out) {
    if (!grid || !grid.rows || !grid.rows.length) {
      if (out) out.length = 0;
      return out || [];
    }
    const reach = (r || 0) + (dtAccum || 0);
    const c = grid.config;
    const r0 = rowAt(c, y);
    const result = out || [];
    result.length = 0;
    for (let row = Math.max(0, r0 - ROW_PAD); row <= Math.min(grid.rows.length - 1, r0 + ROW_PAD); row += 1) {
      const bucket = grid.rows[row];
      for (let i = 0; i < bucket.length; i += 1) {
        const p = bucket[i];
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy <= (reach + p.r) * (reach + p.r)) result.push(p);
      }
    }
    result.sort(function (p, q) { return p.index - q.index; });
    return result;
  }

  // Fixed placement sockets: five slots down each inner edge of the field, left first then right.
  function buildSockets(config) {
    const c = config || cfg();
    const b = c.board;
    const f = b.field;
    const perSide = Math.max(1, b.socketsPerSide);
    const inset = num(b.socketInsetX, 20);
    const xs = [f.x + inset, f.x + f.w - inset];
    const ys = b.socketYs || [];
    const count = Math.min(perSide, ys.length);

    const sockets = [];
    for (let i = 0; i < count; i += 1) {
      sockets.push({ x: xs[0], y: ys[i], kind: null, level: 0, side: 'left', index: sockets.length });
      sockets.push({ x: xs[1], y: ys[i], kind: null, level: 0, side: 'right', index: sockets.length });
    }
    return sockets;
  }

  // Nine bloom cups centred in the field; the leftover field width on each side is the drain channel.
  function buildCups(config) {
    const c = config || cfg();
    const b = c.board;
    const f = b.field;
    const n = Math.max(1, b.cupCount);
    const table = Array.isArray(b.cupScore) ? b.cupScore : [];
    const cols = globalThis.PB_NAMES && globalThis.PB_NAMES.cupColours ? globalThis.PB_NAMES.cupColours : [];
    const pal = palette();
    const cupW = b.cupWidth;
    const cupH = b.cupHeight;
    const gap = num(b.cupGap, 4);
    const rowW = n * cupW + (n - 1) * gap;
    const left = f.x + (f.w - rowW) * 0.5;
    const right = left + rowW;
    const y = num(b.cupY, f.y + f.h);
    const cups = [];
    for (let i = 0; i < n; i += 1) {
      const x = left + cupW * 0.5 + i * (cupW + gap);
      const colourName = cols[i % cols.length] || 'gold';
      const colour = pal[colourName] || pal.gold;
      const src = table.length ? num(table[Math.min(i, table.length - 1)], 10) : 10;
      cups.push({
        x: x,
        w: cupW,
        y: y,
        h: cupH,
        rimTop: y + 5,
        value: src,
        colour: colour,
        colourName: colourName,
        blooms: 0,
        open: 0,
        index: i,
      });
    }
    cups.rowW = rowW;
    cups.startX = left;
    cups.endX = right;
    cups.startY = y;
    cups.drains = [
      { x: f.x, y: y, w: left - f.x, h: f.h, side: 'left' },
      { x: right, y: y, w: f.x + f.w - right, h: f.h, side: 'right' },
    ];
    return cups;
  }

  // Nearest cup x-range for a given x; used to reroute captured balls to a lane.
  function cupAt(cups, x) {
    if (!cups || !cups.length) return -1;
    for (let i = 0; i < cups.length; i += 1) {
      if (x >= cups[i].x - cups[i].w * 0.5 && x <= cups[i].x + cups[i].w * 0.5) return i;
    }
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < cups.length; i += 1) {
      const d = Math.abs(x - cups[i].x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function cupCentre(cup) {
    return cup ? cup.x + cup.w * 0.5 : 0;
  }

  // Divider posts between the cups: tiny static circles a ball can bounce off at the cup mouth line.
  function buildRimPegs(config, cups) {
    const c = config || cfg();
    const b = c.board;
    const list = cups || buildCups(c);
    const r = Math.max(2, num(b.rimPostR, 2));
    const pegs = [];
    let prev = null;
    for (let i = 0; i < list.length; i += 1) {
      if (prev) {
        const x = prev.x + prev.w * 0.5 + ((list[i].x - list[i].w * 0.5) - (prev.x + prev.w * 0.5)) * 0.5;
        pegs.push({ x: x, y: prev.y + 5, r: r, rim: true, lit: 0, dead: 0, golden: false, hitFlash: 0 });
      }
      prev = list[i];
    }
    return pegs;
  }

  globalThis.PB_Pegboard = {
    buildPegs: buildPegs,
    buildRows: buildRows,
    buildSockets: buildSockets,
    buildCups: buildCups,
    buildRimPegs: buildRimPegs,
    pegAt: pegAt,
    pegsInRows: pegsInRows,
    nearestPegs: nearestPegs,
    cupAt: cupAt,
    cupCentre: cupCentre,
    rowAt: rowAt,
  };
})();
