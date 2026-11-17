// Domain overlays for PEGBLOOM: HOW TO PLAY, OPTIONS (music/sfx/shake sliders + mute) and the ALMANAC, built from PB_NAMES and PB_CONFIG.
(function () {
  if (typeof globalThis.PB_Menus === 'object' && globalThis.PB_Menus !== null) return;

  const PANEL_ID = 'pb-menu-panel';
  const CONTROLS = [
    ['ARROWS', 'steer PINA\'s dew can left and right'],
    ['SPACE', 'drop a dew-sphere'],
    ['Q / E', 'turn the petal gates'],
    ['1 2 3', 'pick a contraption in the draft'],
    ['B', 'open the build phase'],
    ['P', 'pause'],
    ['F', 'fast-forward'],
    ['M', 'mute'],
    ['T', 'back to title'],
    ['ESC', 'close a menu'],
  ];

  function palette() {
    return globalThis.PB_PALETTE || {
      cream: '#FFF6E9', paper: '#FFFDF6', coral: '#FF7A59', gold: '#FFC53D', sky: '#57B8FF',
      mint: '#4FD8A5', pink: '#FF9FB2', leaf: '#58B368', ink: '#2B2118',
    };
  }

  function config() {
    return globalThis.PB_CONFIG || {
      sunwell: { max: 10 }, cascade: { multiplierCap: 8 }, draft: { options: 3, rerollCost: 3 },
      showers: [], days: [], difficulties: { Gentle: {}, Normal: {}, Scorched: {} }, difficultyOrder: ['Gentle', 'Normal', 'Scorched'], featCount: 6,
    };
  }

  function names() {
    return globalThis.PB_NAMES || {
      pests: [], contraptions: [], draftPool: [], feats: [], days: [], bossInfo: { name: 'THE DUSKFATHER' }, win: '', lose: '', scopeStrip: '',
    };
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function hasDom() {
    return typeof globalThis.document !== 'undefined' && globalThis.document && typeof globalThis.document.getElementById === 'function';
  }

  function overlayRoot() {
    if (!hasDom()) return null;
    return globalThis.document.getElementById('overlay');
  }

  // ---------- DOM builders (every element is created here; the file touches nothing at load) ----------

  let current = null;
  let lastFocus = null;
  let keyHandler = null;

  function el(tag, className, html) {
    const node = globalThis.document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // A labelled value row: big name on the left, trait chip and body text on the right.
  function card(title, chipText, body, accent) {
    const wrap = el('div', 'pb-card');
    if (accent) wrap.style.borderTopColor = accent;
    const head = el('div', 'pb-card-head');
    head.appendChild(el('strong', 'pb-card-title', esc(title)));
    if (chipText) {
      const chip = el('span', 'pb-chip', esc(chipText));
      if (accent) chip.style.background = accent;
      head.appendChild(chip);
    }
    wrap.appendChild(head);
    if (body) wrap.appendChild(el('p', 'pb-card-body', esc(body)));
    return wrap;
  }

  function section(title, note) {
    const wrap = el('section', 'pb-section');
    wrap.appendChild(el('h3', null, esc(title) + (note ? ' <small>' + esc(note) + '</small>' : '')));
    return wrap;
  }

  function grid(items, minW) {
    const g = el('div', 'pb-grid');
    g.style.gridTemplateColumns = 'repeat(auto-fill, minmax(' + num(minW, 250) + 'px, 1fr))';
    for (let i = 0; i < items.length; i += 1) g.appendChild(items[i]);
    return g;
  }

  function pestHowTo(key) {
    const map = {
      clingmoth: 'Clings to lit pegs mid-board. Drop dew on the peg to knock it loose; it dies on the first hit.',
      draingrub: 'Crawls down with the dew. Ball hits squash it; if it slips to the spout the Sunwell loses a drop.',
      petalbat: 'Flits across the top in fast legs, blocking gates for a while. Two hits swat it.',
      huskling: 'A stubborn two-hit husk that holds pegs shut. Hit it twice - the first crack only staggers it.',
      duskfather: 'Hovers as a giant blocker and sheds moths. Every dew-sphere that strikes him costs him HP - drive him to 0.',
    };
    return map[key] || 'Drop dew on it to pop it.';
  }

  function scopeText() {
    const n = names();
    const c = config();
    const builds = (n.contraptions || []).length || 5;
    const pests = (n.pests || []).length || 4;
    const showers = (c.showers || []).length || 9;
    const pool = (n.draftPool || []).length || 12;
    const diffs = (c.difficultyOrder || []).length || 3;
    return builds + ' contraptions - ' + pests + ' pests + the Duskfather - ' + showers + ' showers - ' + pool + ' drafts - ' + diffs + ' difficulties';
  }

  // ---------- HOW TO PLAY ----------

  function buildHowto() {
    const n = names();
    const c = config();
    const root = el('div');
    root.appendChild(el('h2', null, 'HOW TO PLAY'));
    root.appendChild(el('p', 'pb-lead', 'DROP THE DAWN. BLOOM THE BOARD.'));
    const scope = el('p', 'pb-scope', esc(scopeText()));
    root.appendChild(scope);

    const rules = section('THE RULES', 'six lines');
    const rows = [
      ['DROP', 'steer the dew can with the arrow keys and press SPACE to drop a dew-sphere.'],
      ['TURN', 'rotate the three petal gates with Q and E so the cascade lands in bloom cups.'],
      ['BLOOM', 'each bloom cup caught grows the CASCADE multiplier, up to x' + num(c.cascade && c.cascade.multiplierCap, 8) + '.'],
      ['PESTS', 'pests clog the board and drain the Sunwell. Hit them with dew to pop them.'],
      ['WIN', (n.win || 'meet the bloom quota in all 9 showers and drive off the Duskfather.').replace(/^WIN:\s*/i, '')],
      ['LOSE', (n.lose || 'the Sunwell runs dry.').replace(/^LOSE:\s*/i, '')],
    ];
    for (let i = 0; i < rows.length; i += 1) {
      const row = el('div', 'pb-rule' + (rows[i][0] === 'WIN' ? ' pb-win' : rows[i][0] === 'LOSE' ? ' pb-lose' : ''));
      row.appendChild(el('span', 'pb-rule-key', esc(rows[i][0])));
      row.appendChild(el('span', null, esc(rows[i][1])));
      rules.appendChild(row);
    }
    rules.appendChild(el('p', 'pb-note', 'SUNWELL: ' + num(c.sunwell && c.sunwell.max, 10) + ' drops. Meet a quota and the Sunwell gains one. Miss one and it loses two. DRY = RUN LOST.'));
    rules.appendChild(el('p', 'pb-note', 'DRAFT: after every shower, pick 1 of ' + num(c.draft && c.draft.options, 3) + ' from ' + (n.draftPool || []).length + ' charms. Rerolls cost ' + num(c.draft && c.draft.rerollCost, 3) + ' seeds.'));
    rules.appendChild(el('p', 'pb-note', 'DAYS: ' + (n.days || []).map(function (d) { return d.name.toUpperCase(); }).join(' - ') + ' - three showers each. Shower 9 is the Duskfather.'));
    root.appendChild(rules);

    const keys = section('CONTROLS');
    const keyWrap = el('div', 'pb-keys');
    for (let i = 0; i < CONTROLS.length; i += 1) {
      const row = el('div', 'pb-key');
      row.appendChild(el('kbd', null, esc(CONTROLS[i][0])));
      row.appendChild(el('span', null, esc(CONTROLS[i][1])));
      keyWrap.appendChild(row);
    }
    const mute = globalThis.PB_Audio && typeof globalThis.PB_Audio.isMuted === 'function' ? globalThis.PB_Audio.isMuted() : false;
    keyWrap.appendChild(el('div', 'pb-key', '<kbd>M</kbd><span>' + (mute ? 'sound is muted right now - M turns it back on' : 'sound is on - M mutes it') + '</span>'));
    keys.appendChild(keyWrap);
    root.appendChild(keys);
    return root;
  }

  // ---------- OPTIONS ----------

  function audioVolumes() {
    const a = globalThis.PB_Audio;
    if (a && typeof a.volumes === 'function') {
      try {
        const v = a.volumes();
        return { music: num(v.music, 0.35), sfx: num(v.sfx, 0.7), muted: v.muted === true };
      } catch (err) {
        /* fall through to save */
      }
    }
    const s = globalThis.PB_Save;
    if (s && typeof s.settings === 'function') {
      try {
        const st = s.settings();
        return { music: num(st.music, 0.35), sfx: num(st.sfx, 0.7), muted: st.muted === true };
      } catch (err) {
        /* defaults below */
      }
    }
    return { music: num(config().audio && config().audio.musicVolume, 0.35), sfx: num(config().audio && config().audio.sfxVolume, 0.7), muted: false };
  }

  function pushVolumes(music, sfx) {
    const a = globalThis.PB_Audio;
    if (a && typeof a.setVolumes === 'function') a.setVolumes(music, sfx);
    const s = globalThis.PB_Save;
    if (s && typeof s.setSettings === 'function') s.setSettings({ music: music, sfx: sfx });
  }

  // The shake slider scales every screen-shake fx; the loop reads this via shake().
  function setShake(level) {
    if (!globalThis.PB_Settings || typeof globalThis.PB_Settings !== 'object') globalThis.PB_Settings = {};
    globalThis.PB_Settings.shake = clamp(num(level, 1), 0, 1);
  }

  function currentShake() {
    const st = globalThis.PB_Settings;
    return clamp(num(st && st.shake, 1), 0, 1);
  }

  function sliderRow(label, value, onInput) {
    const row = el('div', 'row');
    const id = 'pb-opt-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const lab = el('label');
    lab.setAttribute('for', id);
    lab.textContent = label;
    const input = el('input');
    input.type = 'range';
    input.id = id;
    input.min = '0';
    input.max = '100';
    input.step = '1';
    input.value = String(Math.round(clamp(value, 0, 1) * 100));
    const out = el('output', null, input.value + '%');
    input.addEventListener('input', function () {
      out.textContent = input.value + '%';
      onInput(clamp(num(input.value, 0) / 100, 0, 1));
    });
    row.appendChild(lab);
    row.appendChild(input);
    row.appendChild(out);
    return row;
  }

  function buildOptions() {
    const vol = audioVolumes();
    const root = el('div');
    root.appendChild(el('h2', null, 'OPTIONS'));
    root.appendChild(el('p', 'pb-note', 'Settings save the moment you move a slider. MENU and SOUND WORK OVER THE TITLE AND THE BOARD.'));

    const music = sliderRow('MUSIC', vol.music, function (v) { pushVolumes(v, null); });
    const sfx = sliderRow('SFX', vol.sfx, function (v) { pushVolumes(null, v); });
    const shake = sliderRow('SHAKE', currentShake(), function (v) {
      setShake(v);
      const s = globalThis.PB_Save;
      if (s && typeof s.setSettings === 'function') s.setSettings({ shake: v });
    });
    root.appendChild(music);
    root.appendChild(sfx);
    root.appendChild(shake);

    const muteRow = el('div', 'row pb-mute-row');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.id = 'pb-opt-mute';
    cb.checked = vol.muted;
    const ml = el('label');
    ml.setAttribute('for', 'pb-opt-mute');
    ml.textContent = 'MUTE ALL AUDIO';
    cb.addEventListener('change', function () {
      const a = globalThis.PB_Audio;
      if (a && typeof a.setMuted === 'function') a.setMuted(cb.checked);
      else {
        const s = globalThis.PB_Save;
        if (s && typeof s.setSettings === 'function') s.setSettings({ muted: cb.checked });
      }
    });
    muteRow.appendChild(cb);
    muteRow.appendChild(ml);
    root.appendChild(muteRow);

    const status = el('p', 'pb-note');
    const audioOk = globalThis.PB_Audio && typeof globalThis.PB_Audio.available === 'function' && globalThis.PB_Audio.available();
    status.textContent = audioOk ? 'AUDIO READY: GENERATIVE PENTATONIC PAD + GARDEN SOUNDS - NO FILES, ALL SYNTHESISED.' : 'THIS BROWSER HAS NOT STARTED WEBAUDIO YET - IT STARTS ON YOUR FIRST CLICK.';
    root.appendChild(status);
    return root;
  }

  // ---------- ALMANAC ----------

  function buildAlmanac() {
    const p = palette();
    const n = names();
    const c = config();
    const root = el('div');
    root.appendChild(el('h2', null, 'ALMANAC'));
    root.appendChild(el('p', 'pb-note', 'EVERYTHING THAT GROWS, CRAWLS OR CHARMS IN THE GARDEN - COUNTED FROM THE GAME RULES.'));

    const pests = section('PESTS', (n.pests || []).length + ' KINDS + THE DUSKFATHER');
    const pestCards = [];
    const kinds = n.pests || [];
    for (let i = 0; i < kinds.length; i += 1) {
      const k = kinds[i];
      pestCards.push(card(k.name, k.trait, pestHowTo(k.key), [p.pink, p.leaf, p.sky, p.coral][i % 4]));
    }
    const boss = n.bossInfo || { name: 'THE DUSKFATHER', hp: 24, trait: 'blocks' };
    pestCards.push(card(boss.name + ' (BOSS)', boss.trait + ' - ' + num(boss.hp, 24) + ' HP', pestHowTo('duskfather') + ' He arrives at shower ' + num(boss.showers, 9) + '.', p.coral));
    pests.appendChild(grid(pestCards));
    root.appendChild(pests);

    const builds = section('CONTRAPTIONS', 'THE 5 BUILDABLES - PLACE ON SOCKETS');
    const buildCards = [];
    const bl = n.contraptions || [];
    for (let i = 0; i < bl.length; i += 1) {
      const b = bl[i];
      buildCards.push(card(b.name, num(b.cost, 2) + ' SEED' + (num(b.cost, 2) === 1 ? '' : 'S'), b.effect, [p.gold, p.sky, p.mint, p.pink, p.coral][i % 5]));
    }
    builds.appendChild(grid(buildCards));
    root.appendChild(builds);

    const pool = section('DRAFT POOL', (n.draftPool || []).length + ' CHARMS - PICK 1 OF ' + num(c.draft && c.draft.options, 3));
    const rows = el('ul', 'pb-draft-list');
    const dp = n.draftPool || [];
    for (let i = 0; i < dp.length; i += 1) {
      const d = dp[i];
      const li = el('li');
      const nameEl = el('strong', null, esc(d.name));
      li.appendChild(nameEl);
      li.appendChild(el('span', 'pb-chip', esc(d.buildable ? 'BUILDABLE' : 'CHARM')));
      li.appendChild(el('span', null, ' ' + esc(d.effect)));
      li.appendChild(el('em', null, ' Synergy: ' + esc(d.synergy)));
      rows.appendChild(li);
    }
    pool.appendChild(rows);
    root.appendChild(pool);

    const feats = section('FEATS', num(c.featCount, 6) + ' TO FIND');
    const featCards = [];
    const fl = n.feats || [];
    for (let i = 0; i < fl.length; i += 1) featCards.push(card(fl[i].name, 'FEAT', fl[i].condition, fl[i].key === 'duskGone' ? p.coral : p.gold));
    feats.appendChild(grid(featCards, 220));
    root.appendChild(feats);
    return root;
  }

  // ---------- open / close ----------

  const BUILDERS = { howto: buildHowto, options: buildOptions, almanac: buildAlmanac };
  const ALIASES = { 'how-to': 'howto', howtoplay: 'howto', 'how-to-play': 'howto', play: 'howto', settings: 'options', opt: 'options', almanac: 'almanac' };

  function resolveName(name) {
    const key = String(name || '').toLowerCase();
    if (BUILDERS[key]) return key;
    return ALIASES[key] || null;
  }

  function close() {
    const root = overlayRoot();
    if (root) {
      root.classList.remove('open');
      root.innerHTML = '';
      root.removeAttribute('aria-hidden');
    }
    if (keyHandler && hasDom()) {
      globalThis.document.removeEventListener('keydown', keyHandler, true);
      keyHandler = null;
    }
    const closed = current;
    current = null;
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try {
        lastFocus.focus();
      } catch (err) {
        /* focus is best effort */
      }
    }
    lastFocus = null;
    if (globalThis.PB_Main && typeof globalThis.PB_Main.menuClosed === 'function') globalThis.PB_Main.menuClosed(closed);
    return closed;
  }

  // open('howto' | 'options' | 'almanac'); returns the panel element or null without a DOM.
  function open(name, opts) {
    const root = overlayRoot();
    const key = resolveName(name);
    if (!root || !key) return null;
    if (current) close();
    const o = opts || {};
    const doc = globalThis.document;
    lastFocus = doc.activeElement || null;
    root.innerHTML = '';
    const panel = el('div', 'panel pb-menu pb-panel-' + key);
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', key.toUpperCase());
    const built = BUILDERS[key]();
    while (built.firstChild) panel.appendChild(built.firstChild);
    const actions = el('div', 'actions');
    const back = el('button', 'close', 'BACK');
    back.type = 'button';
    back.addEventListener('click', function () { close(); });
    actions.appendChild(back);
    panel.appendChild(actions);
    root.appendChild(panel);
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    current = { name: key, panel: panel };

    keyHandler = function (event) {
      if (!current) return;
      if (event.key === 'Escape' || event.code === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    doc.addEventListener('keydown', keyHandler, true);
    const first = panel.querySelector('input, button');
    if (first && typeof first.focus === 'function' && o.focus !== false) {
      try {
        first.focus();
      } catch (err) {
        /* focus is best effort */
      }
    }
    if (globalThis.PB_Main && typeof globalThis.PB_Main.menuOpened === 'function') globalThis.PB_Main.menuOpened(key);
    return panel;
  }

  function toggle(name) {
    if (current && current.name === resolveName(name)) {
      close();
      return null;
    }
    return open(name);
  }

  function isOpen(name) {
    if (!current) return false;
    return name == null ? true : current.name === resolveName(name);
  }

  function currentName() {
    return current ? current.name : null;
  }

  // True while typing focus is in the overlay: the game loop should ignore keys this frame.
  function capturesKeys() {
    return current !== null;
  }

  globalThis.PB_Menus = {
    open: open,
    close: close,
    toggle: toggle,
    isOpen: isOpen,
    current: currentName,
    capturesKeys: capturesKeys,
    names: ['howto', 'options', 'almanac'],
    build: { howto: buildHowto, options: buildOptions, almanac: buildAlmanac },
    shake: currentShake,
    setShake: setShake,
    scopeText: scopeText,
    controls: CONTROLS,
  };
})();
