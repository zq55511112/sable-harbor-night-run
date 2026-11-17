// Sable Harbor: Night Run — tuning constants. Every number the simulation and the
// renderer share lives here so the world stays deterministic for a given seed.

export const WORLD = {
  width: 3584,
  height: 2560,
  cell: 512, // one city block pitch: road band + sidewalk + building lots
  road: 148, // width of the road band at the top/left edge of each cell
  walk: 26, // sidewalk width inside the block edge
};

export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 148,
  runSpeed: 252,
  health: 100,
  punchRange: 36,
  punchDamage: 34,
  punchCooldown: 0.34,
};

export const CAR = {
  length: 46,
  width: 24,
  accel: 340,
  brake: 560,
  drag: 0.6,
  maxReverse: 130,
  turnRate: 2.7,
  health: 220,
};

export const TRAFFIC = { count: 24, speed: 118, parkedCount: 30 };
export const PEDS = { count: 42 };

export const POLICE = {
  carSpeed: 470,
  footSpeed: 240,
  spawnGap: 360,
  sightRange: 460,
  loseSightAfter: 6,
  shootRange: 310,
  shootDamage: 6,
};

export const WEAPONS = {
  fist: { name: 'Fists', damage: 34, range: 36, cooldown: 0.34, ammo: Infinity },
  pistol: { name: 'Pistol', damage: 46, range: 470, cooldown: 0.24, ammo: 60 },
};

export const SHOP_NAMES = [
  'NOODLE NINE', 'HOTEL LUMEN', 'PAWN & CO', 'VELVET TAP', 'MOTO WORKS',
  'SABLE MART', 'INK PARLOR', 'DINER 88', 'KITE RECORDS', 'FOGGY BREW',
  'PALM COURT', 'GYRO HOUSE', 'NIGHT OWL', 'TIDE BANK', 'ORBIT ARCADE',
  'MARLIN CLUB', 'COPY CAT', 'JUNIPER', 'DOCK PHARMACY', 'ECHO BAR',
];
