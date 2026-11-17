// Every PEGBLOOM tuning number, colour and display name (PB_CONFIG, PB_NAMES, PB_PALETTE).

globalThis.PB_PALETTE = {
  cream: '#FFF6E9',
  paper: '#FFFDF6',
  coral: '#FF7A59',
  gold: '#FFC53D',
  sky: '#57B8FF',
  mint: '#4FD8A5',
  pink: '#FF9FB2',
  leaf: '#58B368',
  ink: '#2B2118',
};

globalThis.PB_CONFIG = {
  version: 'session-1-shell',

  canvas: { W: 1280, H: 800, STEP_HZ: 60 },

  board: {
    field: { x: 196, y: 172, w: 888, h: 548 },
    pegRows: 11,
    pegCols: 13,
    pegSpacingX: 66,
    pegSpacingY: 46,
    pegRadius: 9,
    ballRadius: 7,
    cupCount: 7,
    cupWidth: 112,
    cupHeight: 74,
    cupY: 760,
    dropperRail: { x: 420, y: 60, w: 440 },
    gateTopY: 214,
    gateBottomY: 430,
    socketRows: 2,
    socketsPerRow: 5,
  },

  physics: {
    gravity: 1450,
    restitution: 0.62,
    wallRestitution: 0.5,
    friction: 0.16,
    maxBallSpeed: 1500,
    maxSubSteps: 3,
  },

  cascade: {
    multiplierCap: 8,
    cascadeWindow: 0.9,
    cascadeDecayPerSecond: 0.55,
    ballLife: 14,
    dropCooldown: 0.22,
    maxBallsInFlight: 24,
    cupScore: [10, 25, 50, 125, 250, 500, 1000],
    linePegs: 4,
    lineBonus: 0.25,
  },

  sunwell: { max: 10 },

  showers: [
    { shower: 1, day: 1, balls: 12, quota: 14, wind: 'still', pestBudget: 0 },
    { shower: 2, day: 1, balls: 14, quota: 20, wind: 'east', pestBudget: 2 },
    { shower: 3, day: 1, balls: 16, quota: 28, wind: 'west', pestBudget: 3 },
    { shower: 4, day: 2, balls: 18, quota: 40, wind: 'east', pestBudget: 5 },
    { shower: 5, day: 2, balls: 20, quota: 56, wind: 'gust', pestBudget: 7 },
    { shower: 6, day: 2, balls: 22, quota: 76, wind: 'west', pestBudget: 9 },
    { shower: 7, day: 3, balls: 24, quota: 104, wind: 'east', pestBudget: 12 },
    { shower: 8, day: 3, balls: 26, quota: 140, wind: 'gust', pestBudget: 15 },
    { shower: 9, day: 3, balls: 34, quota: 999, wind: 'still', pestBudget: 12, boss: true },
  ],

  days: [
    { day: 1, name: 'Dewrise', showers: 3 },
    { day: 2, name: 'Petalfall', showers: 3 },
    { day: 3, name: 'Duskwatch', showers: 3 },
  ],

  winds: {
    still: { name: 'STILL AIR', force: 0, label: 'STILL' },
    east: { name: 'EAST WIND', force: -360, label: 'EAST WIND' },
    west: { name: 'WEST WIND', force: 360, label: 'WEST WIND' },
    gust: { name: 'GUSTING', force: 520, label: 'GUSTING' },
  },

  difficulties: {
    Gentle: { name: 'Gentle', sunwell: 10, quotaMul: 0.75, ballMul: 1.35, pestMul: 0.6 },
    Normal: { name: 'Normal', sunwell: 10, quotaMul: 1.0, ballMul: 1.0, pestMul: 1.0 },
    Scorched: { name: 'Scorched', sunwell: 7, quotaMul: 1.3, ballMul: 0.85, pestMul: 1.4 },
  },
  difficultyOrder: ['Gentle', 'Normal', 'Scorched'],

  score: {
    pestHit: 40,
    pestClear: 120,
    bossHP: 24,
    bossHit: 60,
    bossDefeat: 2000,
    showerClear: 250,
    dayClear: 750,
  },

  grades: [
    { grade: 'S', min: 40000 },
    { grade: 'A', min: 28000 },
    { grade: 'B', min: 18000 },
    { grade: 'C', min: 10000 },
    { grade: 'D', min: 0 },
  ],

  draft: { rerollCost: 3, options: 3, startingSeeds: 6 },
  overbloom: { startShower: 10, quotaStep: 40, ballStep: 2 },
  featCount: 6,
  save: { key: 'pegbloom.v1', history: 12, lastRuns: 3 },

  input: {
    gateStep: Math.PI / 12,
    gateKeyRepeat: 0.12,
    fastForward: 3,
  },

  audio: {
    masterVolume: 0.5,
    musicVolume: 0.35,
    sfxVolume: 0.7,
    pentatonic: [0, 2, 4, 7, 9],
    rootHz: 220,
  },
};

globalThis.PB_NAMES = {
  game: 'PEGBLOOM',
  player: 'PINA',
  boss: 'THE DUSKFATHER',
  tagline: 'drop the dawn through the great pegboard',

  pests: [
    { key: 'clingmoth', name: 'CLINGMOTH', trait: 'clings' },
    { key: 'draingrub', name: 'DRAINGRUB', trait: 'drains' },
    { key: 'petalbat', name: 'PETALBAT', trait: 'flits' },
    { key: 'huskling', name: 'HUSKLING', trait: 'stubborn' },
  ],

  bossInfo: {
    key: 'duskfather',
    name: 'THE DUSKFATHER',
    trait: 'blocks',
    hp: 24,
    showers: 9,
    line: 'SHOWER 9: DUSKFATHER boss',
  },

  contraptions: [
    { key: 'lanternLily', name: 'LANTERN LILY', cost: 2, effect: 'Brightens pegs: line chains score x2 for one shower.' },
    { key: 'reedSlide', name: 'REED SLIDE', cost: 3, effect: 'Catches balls in a side lane and nudges them toward the nearest cup.' },
    { key: 'mossCushion', name: 'MOSS CUSHION', cost: 2, effect: 'Soaks one stray fall per ball so pinch cups still bloom.' },
    { key: 'gemTrellis', name: 'GEM TRELLIS', cost: 4, effect: 'Golden peg on every third row: hitting it adds +1 CASCADE.' },
    { key: 'dewBell', name: 'DEW BELL', cost: 3, effect: 'Rings on cup bloom and refills one Sunwell drop every 3 blooms.' },
  ],

  draftPool: [
    { key: 'lanternLily', name: 'LANTERN LILY', effect: 'Line chains score double this shower.', synergy: 'Stack with GEM TRELLIS', buildable: true },
    { key: 'reedSlide', name: 'REED SLIDE', effect: 'Side lanes funnel balls to the middle cups.', synergy: 'Great with EAST WIND', buildable: true },
    { key: 'mossCushion', name: 'MOSS CUSHION', effect: 'One bounce saved per ball.', synergy: 'Pair with narrow quota', buildable: true },
    { key: 'gemTrellis', name: 'GEM TRELLIS', effect: 'Golden pegs add +1 CASCADE.', synergy: 'Feeds LANTERN LILY', buildable: true },
    { key: 'dewBell', name: 'DEW BELL', effect: 'Refills Sunwell every 3 blooms.', synergy: 'Insurance for Scorched', buildable: true },
    { key: 'honeyCatch', name: 'HONEY CATCH', effect: 'Cups hold +1 extra ball before overflow.', synergy: 'Pairs with CONE FERN', buildable: false },
    { key: 'coneFern', name: 'CONE FERN', effect: 'Splits a ball into two half-value dew-spheres.', synergy: 'More blooms, less each', buildable: false },
    { key: 'rainChime', name: 'RAIN CHIME', effect: 'Every 5th ball drops golden.', synergy: 'Score bursts on dense showers', buildable: false },
    { key: 'thornBramble', name: 'THORN BRAMBLE', effect: 'Pests take 1 extra hit near the centre.', synergy: 'Counter HUSKLING', buildable: false },
    { key: 'lunarMirror', name: 'LUNAR MIRROR', effect: 'Every 7th ball mirrors its score to neighbours.', synergy: 'Hot with GEM TRELLIS', buildable: false },
    { key: 'seedSachet', name: 'SEED SACHET', effect: 'Start each shower with +2 seeds.', synergy: 'Bank for rerolls', buildable: false },
    { key: 'duskLens', name: 'DUSK LENS', effect: 'Reveals the next pest wave early.', synergy: 'Prepare, do not react', buildable: false },
  ],

  feats: [
    { key: 'firstBloom', name: 'FIRST BLOOM', condition: 'Bloom 50 cups in one run.' },
    { key: 'eightCascade', name: 'EIGHTFOLD', condition: 'Reach CASCADE x8 once.' },
    { key: 'mothHunt', name: 'MOTH HUNT', condition: 'Clear 10 pests in one shower.' },
    { key: 'duskGone', name: 'DUSK GONE', condition: 'Drive off the Duskfather on Normal or harder.' },
    { key: 'fullSunwell', name: 'FULL SUNDOWN', condition: 'Enter shower 9 with a full Sunwell.' },
    { key: 'overbloom', name: 'OVERBLOOM', condition: 'Clear shower 10 in endless mode.' },
  ],

  days: [
    { day: 1, name: 'Dewrise' },
    { day: 2, name: 'Petalfall' },
    { day: 3, name: 'Duskwatch' },
  ],

  cupColours: ['sky', 'mint', 'gold', 'pink', 'gold', 'coral', 'sky'],

  cups: ['SKY CUP', 'MINT CUP', 'GOLD CUP', 'PINK CUP', 'GOLD CUP', 'CORAL CUP', 'SKY CUP'],

  screens: {
    title: 'PEGBLOOM',
    play: 'PLAY',
    draft: 'DRAFT',
    results: 'RESULTS',
  },
  states: {
    winning: 'WIN: bloom quota in N more showers',
    losing: 'LOSE: sunwell dry',
    dry: 'DRY = RUN LOST',
    hold: 'HOLD n MORE',
  },
  scopeStrip: '5 contraptions - 4 pests + the Duskfather - 9 showers - 12 charms - 3 difficulties',
  win: 'WIN: meet the bloom quota in all 9 showers and drive off the Duskfather.',
  lose: 'LOSE: the Sunwell runs dry.',
};

