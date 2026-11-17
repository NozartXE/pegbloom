// Keyboard and pointer input for PEGBLOOM: held keys and per-frame presses, canvas-space mouse/touch, no game logic.
(function () {
  if (typeof globalThis.PB_Input === 'object' && globalThis.PB_Input !== null) return;

  const TRACKED = {};
  [
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'Escape', 'Tab',
    'KeyA', 'KeyB', 'KeyD', 'KeyE', 'KeyF', 'KeyH', 'KeyM', 'KeyO', 'KeyP', 'KeyQ', 'KeyR', 'KeyS', 'KeyT', 'KeyW', 'KeyX',
    'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
    'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5',
  ].forEach(function (code) { TRACKED[code] = true; });

  const held = {};
  const pressed = {};
  const mouse = { x: -1, y: -1, down: false, clicked: false };
  let canvas = null;
  let attached = false;
  let hasMouse = false;
  let consumedKeys = 0;

  function win() {
    return typeof globalThis.window !== 'undefined' ? globalThis.window : null;
  }

  function releaseAll() {
    for (const code in held) if (Object.prototype.hasOwnProperty.call(held, code)) held[code] = false;
    mouse.down = false;
  }

  function markPressed(code) {
    if (!TRACKED[code]) return;
    pressed[code] = true;
  }

  function onKeyDown(event) {
    if (!event || !TRACKED[event.code]) return;
    markPressed(event.code);
    held[event.code] = true;
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }

  function onKeyUp(event) {
    if (!event || !TRACKED[event.code]) return;
    held[event.code] = false;
  }

  // Canvas coordinates: the canvas is letterboxed by CSS, so map client space through its bounding box.
  function toCanvas(clientX, clientY) {
    if (!canvas) return { x: -1, y: -1 };
    const x0 = Number(clientX);
    const y0 = Number(clientY);
    if (!isFinite(x0) || !isFinite(y0)) return { x: -1, y: -1 };
    let rect = null;
    try {
      if (typeof canvas.getBoundingClientRect === 'function') rect = canvas.getBoundingClientRect();
    } catch (err) {
      rect = null;
    }
    const cw = Number(canvas.width) || 1280;
    const ch = Number(canvas.height) || 800;
    if (!rect || !rect.width || !rect.height) return { x: x0, y: y0 };
    return {
      x: ((x0 - rect.left) / rect.width) * cw,
      y: ((y0 - rect.top) / rect.height) * ch,
    };
  }

  function onPointerDown(event) {
    if (event && typeof event.preventDefault === 'function' && event.pointerType === 'touch') event.preventDefault();
    if (event && event.button != null && event.button > 0) return;
    const pt = toCanvas(event && event.clientX, event && event.clientY);
    mouse.x = pt.x;
    mouse.y = pt.y;
    hasMouse = true;
    mouse.down = true;
    mouse.clicked = true;
  }

  function onPointerMove(event) {
    const pt = toCanvas(event && event.clientX, event && event.clientY);
    mouse.x = pt.x;
    mouse.y = pt.y;
    hasMouse = true;
  }

  function onPointerUp() {
    mouse.down = false;
  }

  // Listeners go on window when present (keys arrive even with the page focus elsewhere), the canvas for pointers.
  function attach(target) {
    if (attached) return;
    canvas = target || null;
    const w = win() || globalThis;
    if (typeof w.addEventListener === 'function') {
      w.addEventListener('keydown', onKeyDown);
      w.addEventListener('keyup', onKeyUp);
      w.addEventListener('blur', releaseAll);
    }
    const node = canvas && typeof canvas.addEventListener === 'function' ? canvas : null;
    if (node) {
      node.addEventListener('pointerdown', onPointerDown);
      node.addEventListener('pointermove', onPointerMove);
      node.addEventListener('pointerup', onPointerUp);
      node.addEventListener('pointercancel', onPointerUp);
      node.addEventListener('pointerleave', function () { hasMouse = false; releaseAll(); });
    }
    attached = true;
  }

  // Called once at the end of every frame: one-shot presses and clicks last exactly one frame.
  function poll() {
    for (const code in pressed) if (Object.prototype.hasOwnProperty.call(pressed, code)) delete pressed[code];
    mouse.clicked = false;
    consumedKeys = 0;
  }

  function pressedKey(code) {
    return pressed[code] === true;
  }

  // First code in the list pressed this frame.
  function pressedAny(codes) {
    const list = codes || [];
    for (let i = 0; i < list.length; i += 1) if (pressed[list[i]] === true) return list[i];
    return null;
  }

  function isDown(code) {
    return held[code] === true;
  }

  function blur() {
    releaseAll();
    for (const code in pressed) if (Object.prototype.hasOwnProperty.call(pressed, code)) delete pressed[code];
    mouse.clicked = false;
    hasMouse = false;
  }

  // -1 left, 1 right, 0 both or neither; A/D as the alternate pair.
  function axis() {
    const left = held.ArrowLeft || held.KeyA;
    const right = held.ArrowRight || held.KeyD;
    return (right ? 1 : 0) - (left ? 1 : 0);
  }

  // The pressed code consumed by a UI action (Tab focus), so the browser default can be cancelled.
  function consumeKey(code) {
    if (!pressed[code]) return false;
    consumedKeys += 1;
    return true;
  }

  function point() {
    return { x: mouse.x, y: mouse.y };
  }

  function inRect(rect) {
    if (!rect) return false;
    const x = mouse.x;
    const y = mouse.y;
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  // Did this frame's click land inside rect?
  function clickedIn(rect) {
    return mouse.clicked && inRect(rect);
  }

  globalThis.PB_Input = {
    attach: attach,
    poll: poll,
    pressed: pressedKey,
    pressedAny: pressedAny,
    isDown: isDown,
    axis: axis,
    mouse: mouse,
    point: point,
    hasMouse: function () { return hasMouse; },
    inRect: inRect,
    clickedIn: clickedIn,
    consumeKey: consumeKey,
    consumed: function () { return consumedKeys; },
    blur: blur,
    toCanvas: toCanvas,
    tracking: Object.keys(TRACKED),
  };
})();
