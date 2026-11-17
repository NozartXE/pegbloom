// Three player-rotated petal gates plus the shower wind, in fixed 15-degree steps that ease into place.
(function () {
  if (typeof globalThis.PB_Gates === 'object' && globalThis.PB_Gates !== null) return;

  const GATE_MIN = -Math.PI / 3;
  const GATE_MAX = Math.PI / 3;
  const GATE_STEP = Math.PI / 12;
  const GATE_LEN = 128;
  const EASE_RATE = 0.16;

  function config() {
    const c = globalThis.PB_CONFIG;
    if (!c || !c.board) throw new Error('PB_Gates: PB_CONFIG missing (load config.js first)');
    return c;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function snap(angle) {
    return clamp(Math.round(angle / GATE_STEP) * GATE_STEP, GATE_MIN, GATE_MAX);
  }

  // Gate anchors spread across the field just under the drop rail; each petal is flat until aimed.
  function gatePositions(c) {
    const f = c.board.field;
    const y = c.board.gateTopY + (c.board.gateBottomY - c.board.gateTopY) * 0.25;
    return [
      { x: f.x + f.w * 0.2, y: y, side: 'left' },
      { x: f.x + f.w * 0.5, y: y, side: 'mid' },
      { x: f.x + f.w * 0.8, y: y, side: 'right' },
    ];
  }

  function makeGates(c) {
    const positions = gatePositions(c || config());
    return positions.map(function (p) {
      return { x: p.x, y: p.y, angle: 0, target: 0, len: GATE_LEN, side: p.side, on: true };
    });
  }

  // dir > 0 tilts the petal clockwise; one press equals one 15-degree notch, clamped to +/-60.
  function rotateGate(sim, i, dir) {
    const gate = sim && sim.gates ? sim.gates[i] : null;
    if (!gate || !dir) return false;
    const next = snap(gate.target + (dir > 0 ? GATE_STEP : -GATE_STEP));
    if (next === gate.target) return false;
    gate.target = next;
    return true;
  }

  // Ease every gate's drawn angle toward its target so the petal visibly swings into place.
  function stepGates(sim) {
    const gates = sim && sim.gates;
    if (!gates) return;
    for (let i = 0; i < gates.length; i += 1) {
      const g = gates[i];
      const delta = g.target - g.angle;
      if (Math.abs(delta) < 0.0005) {
        g.angle = g.target;
        continue;
      }
      g.angle += delta * EASE_RATE;
    }
  }

  // Wind force for a shower config row (or key); zero when the row has no wind.
  function windFor(showerCfg) {
    const c = config();
    const key = typeof showerCfg === 'string' ? showerCfg : showerCfg && showerCfg.wind;
    const w = (c.winds && c.winds[key]) || c.winds.still;
    return {
      key: key in c.winds ? key : 'still',
      name: w.name,
      label: w.label,
      force: w.force || 0,
    };
  }

  globalThis.PB_Gates = {
    makeGates: makeGates,
    gatePositions: gatePositions,
    rotateGate: rotateGate,
    stepGates: stepGates,
    windFor: windFor,
    GATE_STEP: GATE_STEP,
    GATE_MIN: GATE_MIN,
    GATE_MAX: GATE_MAX,
    GATE_LEN: GATE_LEN,
  };
})();
