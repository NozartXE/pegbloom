// Every PEGBLOOM tuning number, colour and display name (PB_CONFIG, PB_NAMES, PB_PALETTE).

globalThis.PB_PALETTE = {
  cream: '#FFEFD2',
  paper: '#FFFDF6',
  coral: '#FF5A2E',
  gold: '#FFAE00',
  sky: '#1E9BFF',
  mint: '#14C98B',
  pink: '#FF7FA5',
  leaf: '#2B7A39',
  ink: '#221709',
};

globalThis.PB_CONFIG = {
  version: 'session-1-shell',

  canvas: { W: 1280, H: 800, STEP_HZ: 60 },

  board: {
    field: { x: 368, y: 150, w: 544, h: 520 },
    pegRows: 13,
    pegCols: 9,
    pegSpacingX: 60,
    pegSpacingY: 40,
    pegRadius: 8,
    ballRadius: 8,
    cupCount: 9,
    cupWidth: 50,
    cupHeight: 58,
    cupY: 678,
    cupGap: 4,
    rimPostR: 2,
    cupScore: [10, 25, 50, 80, 125, 80, 50, 25, 10],
    dropperRail: { x: 368, y: 104, w: 544 },
    gateYs: [250, 390, 530],
    gateLength: 120,
    socketCount: 10,
    socketsPerSide: 5,
    socketInsetX: 20,
    socketYs: [210, 310, 410, 510, 610],
  },

  physics: {
    gravity: 1450,
    restitution: 0.62,
    wallRestitution: 0.82,
    friction: 0.1,
    maxBallSpeed: 1500,
    maxSubSteps: 3,
    entryVy: 70,
    pegPauseSpeed: 90,
    pegBias: 55,
    stallSpeed: 26,
    stallTicks: 90,
    stallNudge: 140,
    rimRestitution: 0.15,
    cupOpenShare: 0.7,
    cupFunnel: 6,
    cupMinY: 652,
    cupRimDepth: 8,
    cupRimRoll: 60,
    cupRimDrop: 420,
    cupFloorSlide: 40,
    maxCupRimRolls: 4,
  },

  cascade: {
    multiplierCap: 8,
    cascadeWindow: 0.9,
    cascadeDecayPerSecond: 0.55,
    ballLife: 12,
    ballLifeTicks: 720,
    dropCooldown: 0.22,
    maxBallsInFlight: 24,
    linePegs: 4,
    lineBonus: 0.25,
  },

  sunwell: { max: 10 },

  // Nine showers over three days. balls = dew-spheres supplied; quota = BLOOMS (cups caught this
  // shower). Shower 9's quota is 0 because the Duskfather himself is the goal there.
  showers: [
    { shower: 1, day: 1, balls: 30, quota: 13, wind: 'still', pestBudget: 0 },
    { shower: 2, day: 1, balls: 32, quota: 15, wind: 'east', pestBudget: 2 },
    { shower: 3, day: 1, balls: 34, quota: 17, wind: 'west', pestBudget: 3 },
    { shower: 4, day: 2, balls: 36, quota: 19, wind: 'east', pestBudget: 5 },
    { shower: 5, day: 2, balls: 38, quota: 21, wind: 'gust', pestBudget: 7 },
    { shower: 6, day: 2, balls: 40, quota: 23, wind: 'west', pestBudget: 9 },
    { shower: 7, day: 3, balls: 42, quota: 25, wind: 'east', pestBudget: 12 },
    { shower: 8, day: 3, balls: 44, quota: 27, wind: 'gust', pestBudget: 15 },
    { shower: 9, day: 3, balls: 56, quota: 0, wind: 'still', pestBudget: 12, boss: true },
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

  cupColours: ['sky', 'mint', 'gold', 'pink', 'coral', 'pink', 'gold', 'mint', 'sky'],

  cups: ['SKY CUP', 'MINT CUP', 'GOLD CUP', 'PINK CUP', 'CORAL CUP', 'PINK CUP', 'GOLD CUP', 'MINT CUP', 'SKY CUP'],

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

