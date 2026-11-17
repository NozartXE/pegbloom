# PEGBLOOM — Design Document

Drop the dawn through the great pegboard — steer the cascade with petal gates, bloom the cups,
and hold back the Duskfather through 9 showers.

## Game Summary

PEGBLOOM is a pachinko garden defense game for the desktop browser. Glowing dew-spheres fall into
a giant pegboard garden. The player steers their cascade with petal gates and placed contraptions
so they land in bloom cups, while pests clog the board and the Duskfather comes at shower 9.

- **Player:** PINA, keeper of the Bloom Engine.
- **Antagonist:** THE DUSKFATHER, a giant moth.
- **WIN:** meet the bloom quota in all 9 showers and drive off the Duskfather.
- **LOSE:** the Sunwell runs dry.

### Scope (exact numbers, used in-game everywhere)

| Thing | Count |
| --- | --- |
| Showers | 9, over 3 days |
| Buildable contraptions | 5 |
| Pests | 4 kinds (CLINGMOTH, DRAINGRUB, PETALBAT, HUSKLING) + the Duskfather boss |
| Draft | 1 of 3 contraptions from a pool of 12 |
| CASCADE multiplier | up to x8 |
| SUNWELL | 10 drops (dry = run lost) |
| Difficulties | 3: Gentle / Normal / Scorched |
| Endless | OVERBLOOM mode |
| Feats | 6 |

### Hard rules

- Plain JavaScript only: no modules, no imports, no network, no external assets. Files load through
  classic `<script>` tags in `game/index.html` in a fixed order.
- Deterministic: the sim steps at a fixed 60 Hz with a seeded RNG (`src/rng.js`). No `Date.now`,
  `Math.random` or `performance.now` anywhere in game logic.
- Every source file opens with a one-line plain-English comment saying its job.
- Files have one clear job each and are named for what they do.
- Canvas is 1280x800. DOM overlays only for menus (`ui/menus.js`).
- BRIGHT PALETTE ONLY: cream ivory `#FFF6E9`, paper `#FFFDF6`, coral `#FF7A59`, gold `#FFC53D`,
  sky `#57B8FF`, mint `#4FD8A5`, petal pink `#FF9FB2`, leaf `#58B368`, ink text `#2B2118`.
  No dark backgrounds, muddy colours or heavy vignette. Scenes average bright
  (mean luminance >= 0.45 is a checked gate).
- Text must be readable at thumbnail size: big condensed headings, high contrast, no tiny grey text
  for anything important.

## Art Direction

Bright paper-garden diorama: ivory page, coral cabinet frame, gold pegs, pastel cups, glowing
dew-spheres in sky and mint. Ink text with heavy condensed headings. Real-world physics on the
board, but every surface stays cream and bright even in shadow.

## Screens

The four dossier screenshots, in this order:

1. **1-play.jpg — cover.** Mid-cascade at the densest tick (Day 2, shower 5–6, ~18 balls in
   flight, floaters up, pests on board, full HUD above).
2. **2-title.jpg — title.** Live demo cascade behind, wordmark fills frame width, scope strip
   `5 contraptions - 4 pests + the Duskfather - 9 showers - 12 charms - 3 difficulties`,
   six-row rules digest including WIN and LOSE rows, PLAY + BEST + FEATS n/6, 3 difficulty buttons,
   "OVERBLOOM unlocked" line, HOW TO PLAY / OPTIONS / ALMANAC buttons, controls footer.
3. **3-draft.jpg — draft.** Huge heading "WIND TURNS EAST - PICK 1", three big roundels
   (key hint, name, effect, synergy), owned contraptions strip, honest next-shower forecast
   (ghost cascade path + "LANDS 3 CUPS" or a miss mark), "X - reroll" with visible seed cost.
   HUD hidden.
4. **4-results.jpg — results.** Grade letter + score + NEW BEST, stat tiles, run metadata
   (difficulty, seed, time, delta vs best), grade thresholds with ticks, LAST 3 RUNS history
   (losses in coral red, wins in mint — really played by bots), YOUR BUILD summary, feats row,
   NEXT GOAL line, per-shower graph, "R - RUN AGAIN" dominant.

## HUD Inventory

Every panel is populated in every play screenshot (an empty panel was a named cause of death for
the previous entry):

- Objective banners: "WIN: bloom quota in N more showers" / "LOSE: sunwell dry".
- SUNWELL droplets (n/10) with "DRY = RUN LOST".
- INCOMING roster: pest kinds in this shower with counts + one-word traits, plus
  "SHOWER 9: DUSKFATHER boss" and "NEXT: <new pest>" lines.
- SCORE + BEST + CASCADE multiplier (big, e.g. "CASCADE x6").
- SEEDS (build currency) and owned contraption icons.
- Balls remaining this shower + quota progress bar "BLOOM 34 / 50".
- Shower track: 9 pips over 3 days with a moth skull on shower 9 + "HOLD n MORE".
- Wind banner: "NEXT SHOWER: EAST WIND - REAIM GATES" + 3-line event log.
- Pause / fast-forward / mute buttons and a full controls line at the bottom.
- Build bar during build phase: 5 contraptions with names, costs, one-line effects.

## Mechanics

- **Dew-spheres** drop from the rail. Each bounce and peg hit feeds the CASCADE multiplier (cap x8);
  it decays when the board goes quiet. Ball value is the cup value times CASCADE.
- **Bloom cups** line the bottom; centre and side cups are worth more in sequence to reward
  steering. Quota counts bloomed cup value.
- **Petal gates** are three player-rotated deflectors; the player re-aims them between showers
  against the shower wind.
- **Sunwell** holds 10 drops; losing a ball without blooming a cup drains one. At zero the run is lost.
- **Pests** spawn from slotted sockets: CLINGMOTH clings to pegs, DRAINGRUB drains cups, PETALBAT
  flits across lanes, HUSKLING is stubborn (takes extra hits). Each has hit points; clearing awards
  score and seeds.
- **The Duskfather** hovers at shower 9 with 24 HP, blocking a board chunk and spawning moths.
  Defeat it (all HP) while meeting quotas to win.

## Progression

- 9 showers over 3 days (Dewrise, Petalfall, Duskwatch).
- Between showers: a 1-of-3 contraption draft from a pool of 12; rerolls cost seeds.
- 5 contraptions are buildable on sockets; the rest are charms with passive effects.
- Difficulties scale Sunwell, quota, balls and pests.
- OVERBLOOM is the endless mode after shower 9.
- 6 feats are tracked across runs and saved locally.

## File Map (`game/`)

| File | Job |
| --- | --- |
| `index.html` | Pitch comment on top, canvas, overlay root, script tags. |
| `style.css` | Page + overlay styling. |
| `src/config.js` | ALL tuning numbers and the NAMES table (pests, contraptions, feats, days). |
| `src/rng.js` | Seeded RNG (mulberry32) + helpers. |
| `src/pegboard.js` | Peg grid layout, peg states (lit, deadened, golden), socket slots. |
| `src/physics.js` | Ball integration, peg/cup/gate collisions, fixed-step. |
| `src/cascade.js` | Dropper, ball lifecycle, bloom cups, CASCADE multiplier, sunwell, score. |
| `src/gates.js` | The 3 petal gates (player-rotated deflectors) and the shower wind. |
| `src/pests.js` | CLINGMOTH, DRAINGRUB, PETALBAT, HUSKLING: spawn, move, hit, clear. |
| `src/duskfather.js` | The boss: hover blocker, HP, moth spawns, defeat. |
| `src/waves.js` | 9 showers x 3 days, quotas, ball counts, pest schedules, difficulty tables. |
| `src/contraptions.js` | The 5 buildables + the draft pool of 12 (data + effects hooks). |
| `src/draft.js` | Draft offers (1 of 3, reroll for seeds), build-phase placement on sockets. |
| `src/save.js` | localStorage best score, run history, feats, settings. |
| `src/audio.js` | WebAudio generative pentatonic music + sound effects, mute. |
| `src/input.js` | Keyboard + mouse state. |
| `src/sim.js` | DOM-free orchestrator: `createSim(seed, difficulty)`, `stepSim(sim)`, the single state object every other sim file reads/writes. Runs headless. |
| `src/render/board.js` | The cabinet diorama: frame, pegs, cups, sockets, garden art. |
| `src/render/balls.js` | Balls, glow trails, gate and contraption drawing. |
| `src/render/fx.js` | Particles, floating score text, bloom bursts, screen shake. |
| `src/render/sprites.js` | Pest and Duskfather drawing. |
| `src/render/hud.js` | Every HUD panel. |
| `src/render/banner.js` | Event banner + 3-line event log. |
| `src/render/title.js` | Title screen with a live demo cascade behind it. |
| `src/render/draftscreen.js` | The 1-of-3 draft screen (one choice fills the frame). |
| `src/render/results.js` | Results: grade, history, build summary, next goal, graph. |
| `src/render/howto.js` | Rules digest rows + scope strip drawing helpers. |
| `src/ui/menus.js` | DOM overlays: HOW TO PLAY, OPTIONS (3 sliders), ALMANAC. |
| `src/testhook.js` | `?shot=` staging + `?test=1` hooks used by the tools. Not gameplay. |
| `src/main.js` | Glue: loop, screen state machine, boot. |

### Script load order in `index.html`

config, rng, pegboard, physics, cascade, gates, pests, duskfather, waves, contraptions, draft,
save, audio, input, sim, render/board, render/balls, render/fx, render/sprites, render/hud,
render/banner, render/title, render/draftscreen, render/results, render/howto, ui/menus, testhook,
main.

## Session 1 — Shell (this session)

Deliverables: `game/index.html`, `game/style.css`, `game/src/config.js`, `game/src/rng.js`,
temporary boot stub `game/src/main.js`, and this document.

- `PB_CONFIG` holds canvas, board geometry, physics, cascade, sunwell, shower table, days,
  difficulties, score values (boss HP 24), grade thresholds and draft numbers.
- `PB_NAMES` holds pest names + traits, the 5 buildables (name, cost, effect), the 12 draft entries
  (name, effect, synergy), the 6 feats, day names and cup colour names.
- `PB_RNG.create(seed)` returns `next()`, `range()`, `int()`, `pick()` (plus `shuffle`, `chance`);
  `PB_RNG.hashSeed()` hashes string seeds. No `Math.random`.
- `index.html` references every file in the fixed order; missing files are created by later sessions.
- `main.js` is a temporary stub that paints the cream page and the PEGBLOOM wordmark.

## Working Rules

- Read existing files before editing; keep APIs stable.
- The sim stays headless: no DOM access outside `render/`, `ui/`, `main.js`, `testhook.js`.
- Sim files (`config` through `sim`) must load in plain Node for the tools.
- Files must pass `node --check`.
- Do not touch `screenshots/`, `main.ts`, `serve.ts`, `vendor/` — the kit owns those.
