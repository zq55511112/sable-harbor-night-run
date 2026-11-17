// Sable Harbor: Night Run — the whole simulation: city, traffic, pedestrians,
// police, combat, wanted level, missions and saving. No drawing and no DOM here:
// step(dt, ctrl) advances the world and returns event flags the caller turns into
// sound and screen changes, and render.js reads the state to paint it.

import { CAR, PEDS, PLAYER, POLICE, SHOP_NAMES, TRAFFIC, WEAPONS, WORLD } from './config.js';
import { createRandom, pick, range } from './random.js';

export const EV = {
  SHOT: 1, PUNCH: 2, CRASH: 4, PICKUP: 8, CASH: 16, DOOR: 32,
  MISSION: 64, BUSTED: 128, WASTED: 256, HURT: 512, SIREN_ON: 1024,
};

const SAVE_KEY = 'sable-harbor-save-v1';
export const HOSPITAL = { x: 620, y: 620 };
export const STATION = { x: 2660, y: 620 };
export const GARAGE = { x: 3150, y: 1830 };
export const FERRY = { x: 3320, y: 2400 };

const WATER = { x: 2560, y: 2048, w: 1024, h: 512 };
const PARK = { cx: 3, cy: 2 };

export function isRoad(x, y) {
  return (x % WORLD.cell) < WORLD.road || (y % WORLD.cell) < WORLD.road;
}
export function inWater(x, y) {
  return x >= WATER.x && x < WATER.x + WATER.w && y >= WATER.y && y < WATER.y + WATER.h;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist2(ax, ay, bx, by) { const dx = ax - bx; const dy = ay - by; return dx * dx + dy * dy; }
function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

const CAR_COLORS = ['#c0392b', '#2471a3', '#7d3c98', '#b7950b', '#229954', '#aab7b8', '#5d6d7e', '#ca6f1e', '#117a65', '#884ea0'];
const PED_COLORS = ['#e67e22', '#ecf0f1', '#f1948a', '#82e0aa', '#85c1e9', '#f7dc6f', '#d2b4de', '#a3e4d7'];
const BUILDING_COLORS = ['#2e3440', '#3b4252', '#434c5e', '#4c566a', '#353b48', '#2f3644', '#3d4457'];

export const MISSIONS = [
  {
    title: 'First Wheels',
    intro: 'Mara needs a car at the dock garage. Take one. Any one.',
    reward: 250,
    stages: [
      { type: 'steal', text: 'Steal a car (walk up to one, press E)' },
      { type: 'goto', x: GARAGE.x, y: GARAGE.y, r: 90, inCar: true, text: 'Drive to the dock garage' },
    ],
  },
  {
    title: 'Package Run',
    intro: 'A package waits in the south-west alley. Pick it up, drop it at the north-east motel.',
    reward: 400,
    stages: [
      { type: 'goto', x: 640, y: 2130, r: 60, text: 'Pick up the package in the alley' },
      { type: 'goto', x: 3080, y: 430, r: 80, text: 'Deliver it to the motel', heatOnReach: 0, heatOnStart: 2 },
    ],
  },
  {
    title: 'Heat Check',
    intro: 'The drop was watched. The whole force is looking for you. Disappear.',
    reward: 350,
    stages: [
      { type: 'loseheat', text: 'Lose the police (break line of sight and stay hidden)' },
    ],
    heatOnStart: 3,
  },
  {
    title: 'Cash Trail',
    intro: 'Three dead drops around the harbor. Collect them all before someone else does.',
    reward: 600,
    stages: [
      {
        type: 'collect', text: 'Collect the dead drops',
        points: [
          { x: 1150, y: 1150 }, { x: 2130, y: 1620 }, { x: 1080, y: 420 },
        ],
      },
    ],
  },
  {
    title: 'Last Ferry',
    intro: 'The ferry leaves in 75 seconds and Mara is done with this town. Be on it.',
    reward: 1000,
    stages: [
      { type: 'timed_goto', x: FERRY.x, y: FERRY.y, r: 90, seconds: 75, text: 'Reach the ferry pier before it leaves' },
    ],
    heatOnStart: 3,
  },
];

export function createWorld(seed = 1) {
  const rng = createRandom(seed * 7919 + 13);
  const buildings = [];
  const lamps = [];
  const trees = [];
  const crates = [];

  // ---- city generation -------------------------------------------------
  for (let cx = 0; cx < WORLD.width / WORLD.cell; cx += 1) {
    for (let cy = 0; cy < WORLD.height / WORLD.cell; cy += 1) {
      const bx = cx * WORLD.cell + WORLD.road + WORLD.walk + 6;
      const by = cy * WORLD.cell + WORLD.road + WORLD.walk + 6;
      const bw = WORLD.cell - WORLD.road - WORLD.walk * 2 - 12;
      const isPark = cx === PARK.cx && cy === PARK.cy;
      const blockInWater = inWater(cx * WORLD.cell + 256, cy * WORLD.cell + 256);
      if (isPark) {
        for (let i = 0; i < 14; i += 1) {
          trees.push({ x: bx + rng() * bw, y: by + rng() * bw, r: range(rng, 12, 22) });
        }
        continue;
      }
      if (blockInWater) {
        for (let i = 0; i < 8; i += 1) {
          crates.push({ x: bx + rng() * bw, y: by + rng() * (WORLD.cell - WORLD.road) * 0.4, w: 30, h: 30 });
        }
        continue;
      }
      // Split each block into 2x2 lots; most lots get a building with a shop sign.
      const lotW = bw / 2;
      const lotH = (WORLD.cell - WORLD.road - WORLD.walk * 2 - 12) / 2;
      for (let lx = 0; lx < 2; lx += 1) {
        for (let ly = 0; ly < 2; ly += 1) {
          if (rng() < 0.14) continue; // empty lot / parking
          const pad = range(rng, 4, 14);
          buildings.push({
            x: bx + lx * lotW + pad,
            y: by + ly * lotH + pad,
            w: lotW - pad * 2,
            h: lotH - pad * 2,
            color: pick(rng, BUILDING_COLORS),
            roof: pick(rng, ['#596273', '#6b5468', '#54686b', '#686054']),
            shop: rng() < 0.55 ? pick(rng, SHOP_NAMES) : null,
            neon: pick(rng, ['#ff5da2', '#4dd0e1', '#ffd23f', '#9dff57', '#ff7847', '#b388ff']),
          });
        }
      }
    }
  }
  for (let x = 74; x < WORLD.width; x += 256) {
    for (let y = 74; y < WORLD.height; y += 256) {
      if (!inWater(x, y)) lamps.push({ x: x + ((y / 256) % 2) * 60, y });
    }
  }

  function collideBuildings(px, py, r) {
    let x = px;
    let y = py;
    for (const b of buildings) {
      const nx = clamp(x, b.x, b.x + b.w);
      const ny = clamp(y, b.y, b.y + b.h);
      const d2 = dist2(x, y, nx, ny);
      if (d2 < r * r) {
        if (d2 === 0) {
          // Centre inside the building: leave by the nearest face.
          const left = x - b.x;
          const right = b.x + b.w - x;
          const top = y - b.y;
          const bottom = b.y + b.h - y;
          const min = Math.min(left, right, top, bottom);
          if (min === left) x = b.x - r;
          else if (min === right) x = b.x + b.w + r;
          else if (min === top) y = b.y - r;
          else y = b.y + b.h + r;
          continue;
        }
        const d = Math.sqrt(d2);
        x = nx + ((x - nx) / d) * r;
        y = ny + ((y - ny) / d) * r;
      }
    }
    return { x: clamp(x, r, WORLD.width - r), y: clamp(y, r, WORLD.height - r) };
  }

  function laneCoord(dir, bandStart) {
    // Right-hand traffic lanes inside a road band.
    if (dir === 0) return bandStart + 111; // north: x fixed
    if (dir === 1) return bandStart + 111; // east: y fixed
    if (dir === 2) return bandStart + 37; // south
    return bandStart + 37; // west
  }
  const DIRS = [
    { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
  ];

  function makeCar(x, y, dir, kind) {
    return {
      x, y, dir, angle: Math.atan2(DIRS[dir].y, DIRS[dir].x),
      speed: 0, color: pick(rng, CAR_COLORS), kind, // traffic | parked | player | police
      health: CAR.health, driver: kind === 'traffic', turnCool: 0,
      vx: 0, vy: 0, honk: 0,
    };
  }

  const cars = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const vertical = rng() < 0.5;
    const bandX = Math.floor(rng() * 7) * WORLD.cell;
    const bandY = Math.floor(rng() * 5) * WORLD.cell;
    const dir = vertical ? (rng() < 0.5 ? 2 : 0) : (rng() < 0.5 ? 1 : 3);
    const x = vertical ? laneCoord(dir, bandX) : range(rng, 60, WORLD.width - 60);
    const y = vertical ? range(rng, 60, WORLD.height - 60) : laneCoord(dir, bandY);
    if (inWater(x, y)) continue;
    const car = makeCar(x, y, dir, 'traffic');
    car.speed = TRAFFIC.speed * range(rng, 0.8, 1.15);
    cars.push(car);
  }
  for (let i = 0; i < TRAFFIC.parkedCount; i += 1) {
    // Parked along the curb of a random road band.
    const vertical = rng() < 0.5;
    const band = Math.floor(rng() * 7) * WORLD.cell;
    const along = range(rng, 80, (vertical ? WORLD.height : WORLD.width) - 80);
    const x = vertical ? band + 16 : along;
    const y = vertical ? along : Math.floor(rng() * 5) * WORLD.cell + 16;
    if (inWater(x, y) || isRoad(x + 40, y + 40) === false) { /* curb spots only */ }
    const car = makeCar(x, y, vertical ? 2 : 1, 'parked');
    car.angle = vertical ? Math.PI / 2 : 0;
    cars.push(car);
  }

  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    const bx = Math.floor(rng() * 7) * WORLD.cell + WORLD.road + 13;
    const by = Math.floor(rng() * 5) * WORLD.cell + WORLD.road + 13;
    const x = bx + rng() * (WORLD.cell - WORLD.road - 26);
    const y = by + rng() * (WORLD.cell - WORLD.road - 26);
    if (inWater(x, y)) continue;
    peds.push({
      x, y, tx: x, ty: y, speed: range(rng, 42, 74), color: pick(rng, PED_COLORS),
      health: 100, flee: 0, dead: 0, angle: 0, cop: false, shootCool: 0, grabTime: 0,
    });
  }

  const state = {
    time: 0,
    player: {
      x: 760, y: 900, angle: 0, health: PLAYER.health, car: null,
      weapon: 'fist', ammo: WEAPONS.pistol.ammo, attackCool: 0, hurtFlash: 0,
    },
    money: 120,
    wanted: 0,
    hideTime: 0,
    crimeCool: 0,
    missionIndex: 0,
    stageIndex: 0,
    stageData: {},
    storyDone: false,
    message: '',
    messageTime: 0,
    objectiveText: '',
    marker: null,
    timer: 0,
    over: null, // 'wasted' | 'busted'
    overTime: 0,
    stats: { stolen: 0, earned: 0, shots: 0 },
  };

  const bullets = [];
  const particles = [];
  const policeCars = [];
  const policePeds = [];

  function currentStage() {
    if (state.storyDone || state.missionIndex >= MISSIONS.length) return null;
    return MISSIONS[state.missionIndex].stages[state.stageIndex] || null;
  }

  function refreshObjective() {
    const stage = currentStage();
    if (!stage) {
      state.objectiveText = state.storyDone ? 'Free roam — the harbor is yours. (F5 saves)' : '';
      state.marker = null;
      state.timer = 0;
      return;
    }
    state.objectiveText = `${MISSIONS[state.missionIndex].title}: ${stage.text}`;
    if (stage.type === 'goto' || stage.type === 'timed_goto') {
      state.marker = { x: stage.x, y: stage.y };
    } else if (stage.type === 'collect') {
      const left = stage.points.filter((p, i) => !state.stageData['got' + i]);
      state.marker = left.length ? left[0] : null;
    } else {
      state.marker = null;
    }
    state.timer = stage.type === 'timed_goto' ? (state.stageData.timeLeft ?? stage.seconds) : 0;
  }

  function startMission(index) {
    state.missionIndex = index;
    state.stageIndex = 0;
    state.stageData = {};
    const mission = MISSIONS[index];
    if (!mission) { state.storyDone = true; refreshObjective(); return; }
    if (mission.heatOnStart) addWanted(mission.heatOnStart, true);
    const first = mission.stages[0];
    if (first && first.heatOnStart) addWanted(first.heatOnStart, true);
    if (first && first.type === 'timed_goto') state.stageData.timeLeft = first.seconds;
    say(`${mission.title} — ${mission.intro}`, 6);
    refreshObjective();
  }

  function say(text, seconds = 4) {
    state.message = text;
    state.messageTime = seconds;
  }

  function addWanted(points, force = false) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + points, 0, 5);
    if (state.wanted > before) state.hideTime = 0;
    return state.wanted > before && !force ? EV.SIREN_ON : 0;
  }

  function crime(points) {
    if (state.crimeCool > 0 && points < 2) return 0;
    state.crimeCool = 1.2;
    return addWanted(points);
  }

  function completeStage(events) {
    const mission = MISSIONS[state.missionIndex];
    state.stageIndex += 1;
    state.stageData = {};
    if (state.stageIndex >= mission.stages.length) {
      state.money += mission.reward;
      state.stats.earned += mission.reward;
      say(`Mission complete: ${mission.title} (+$${mission.reward})`, 5);
      events |= EV.MISSION | EV.CASH;
      autosave();
      startMission(state.missionIndex + 1);
    } else {
      const stage = mission.stages[state.stageIndex];
      if (stage.heatOnStart) addWanted(stage.heatOnStart, true);
      if (stage.type === 'timed_goto') state.stageData.timeLeft = stage.seconds;
      say('Objective updated.', 2.5);
      refreshObjective();
    }
    return events;
  }

  function autosave() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: state.money, missionIndex: state.missionIndex,
        storyDone: state.storyDone, ammo: state.player.ammo,
        x: state.player.x, y: state.player.y, stats: state.stats,
      }));
    } catch { /* storage unavailable: play on without saving */ }
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      state.money = data.money ?? state.money;
      state.player.ammo = data.ammo ?? state.player.ammo;
      state.player.x = data.x ?? state.player.x;
      state.player.y = data.y ?? state.player.y;
      state.stats = data.stats ?? state.stats;
      if (data.storyDone) {
        state.storyDone = true;
        state.missionIndex = MISSIONS.length;
        refreshObjective();
      } else {
        startMission(clamp(data.missionIndex ?? 0, 0, MISSIONS.length - 1));
      }
      return true;
    } catch {
      return false;
    }
  }

  function hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  }

  function respawn(where) {
    state.player.health = PLAYER.health;
    state.player.car = null;
    state.player.x = where.x;
    state.player.y = where.y;
    state.wanted = 0;
    state.hideTime = 0;
    policeCars.length = 0;
    policePeds.length = 0;
    state.over = null;
  }

  // ---- per-step helpers --------------------------------------------------
  /** A spawn point on the ring around the player that is not inside a building
   * or the harbor; null when every tried angle is blocked (retry next step). */
  function ringPoint(radius) {
    for (let tries = 0; tries < 8; tries += 1) {
      const a = rng() * Math.PI * 2;
      const x = clamp(state.player.x + Math.cos(a) * radius, 50, WORLD.width - 50);
      const y = clamp(state.player.y + Math.sin(a) * radius, 50, WORLD.height - 50);
      if (inWater(x, y)) continue;
      const fixed = collideBuildings(x, y, 24);
      if (fixed.x === x && fixed.y === y) return { x, y };
    }
    return null;
  }

  function spawnPolice(events) {
    const wantCars = state.wanted >= 2 ? Math.ceil(state.wanted / 2) : 0;
    const wantPeds = state.wanted >= 1 ? Math.min(4, state.wanted) : 0;
    if (policeCars.length < wantCars) {
      const spot = ringPoint(POLICE.spawnGap);
      if (spot) {
        const car = makeCar(spot.x, spot.y, 1, 'police');
        car.color = '#e8ecf4';
        car.speed = 0;
        policeCars.push(car);
        events |= EV.SIREN_ON;
      }
    }
    if (policePeds.length < wantPeds) {
      const spot = ringPoint(POLICE.spawnGap * 0.8);
      if (spot) {
        policePeds.push({
          x: spot.x, y: spot.y, tx: spot.x, ty: spot.y, speed: POLICE.footSpeed, color: '#2b5cff',
          health: 100, flee: 0, dead: 0, angle: 0, cop: true, shootCool: range(rng, 0.4, 1.2), grabTime: 0,
        });
        events |= EV.SIREN_ON;
      }
    }
    return events;
  }

  function burst(x, y, color, n, speed = 130) {
    for (let i = 0; i < n; i += 1) {
      const a = rng() * Math.PI * 2;
      const s = rng() * speed;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: range(rng, 0.2, 0.55), color, size: range(rng, 1.5, 3.5) });
    }
  }

  /** True when no building blocks the straight line between two points. */
  function lineOfSight(x1, y1, x2, y2) {
    for (let i = 1; i < 8; i += 1) {
      const t = i / 8;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      for (const b of buildings) {
        if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return false;
      }
    }
    return true;
  }

  /** Anti-stuck: a police unit that only creeps along a wall while far from the
   * player is repositioned outside sight range, as if it had taken another
   * street and come at the player from a fresh direction. */
  function unstuck(unit, dt, creep) {
    unit.stuckT = (unit.stuckT ?? 0) + dt;
    if (unit.stuckT < 1.5) return;
    const moved = Math.hypot(unit.x - (unit.lastX ?? unit.x), unit.y - (unit.lastY ?? unit.y));
    unit.lastX = unit.x;
    unit.lastY = unit.y;
    unit.stuckT = 0;
    const d = Math.hypot(state.player.x - unit.x, state.player.y - unit.y);
    if (moved < creep && d > 90) {
      for (let tries = 0; tries < 6; tries += 1) {
        const a = rng() * Math.PI * 2;
        const x = clamp(state.player.x + Math.cos(a) * 500, 60, WORLD.width - 60);
        const y = clamp(state.player.y + Math.sin(a) * 500, 60, WORLD.height - 60);
        if (inWater(x, y)) continue;
        const fixed = collideBuildings(x, y, 24);
        unit.x = fixed.x;
        unit.y = fixed.y;
        unit.speed = 0;
        break;
      }
    }
  }

  function nearestCar(x, y, maxD) {
    let best = null;
    let bestD = maxD * maxD;
    for (const list of [cars, policeCars]) {
      for (const car of list) {
        const d = dist2(x, y, car.x, car.y);
        if (d < bestD) { bestD = d; best = car; }
      }
    }
    return best;
  }

  function damagePlayer(amount, events) {
    state.player.health -= amount;
    state.player.hurtFlash = 0.25;
    events |= EV.HURT;
    if (state.player.health <= 0 && !state.over) {
      state.over = 'wasted';
      state.overTime = 0;
      state.money = Math.max(0, state.money - Math.floor(state.money * 0.15) - 50);
      events |= EV.WASTED;
    }
    return events;
  }

  // ---- main step ----------------------------------------------------------
  function step(dt, ctrl) {
    let events = 0;
    state.time += dt;
    if (state.messageTime > 0) state.messageTime -= dt;
    if (state.crimeCool > 0) state.crimeCool -= dt;
    if (state.player.attackCool > 0) state.player.attackCool -= dt;
    if (state.player.hurtFlash > 0) state.player.hurtFlash -= dt;

    if (state.over) {
      state.overTime += dt;
      return events;
    }

    const p = state.player;
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;

    // ----- player: driving -----
    if (p.car) {
      const car = p.car;
      p.speedNow = Math.abs(car.speed);
      const fwd = ctrl.moveY < 0 ? 1 : ctrl.moveY > 0 ? -1 : 0;
      if (fwd > 0) car.speed += CAR.accel * dt;
      else if (fwd < 0) {
        if (car.speed > 10) car.speed -= CAR.brake * dt;
        else car.speed = Math.max(-CAR.maxReverse, car.speed - CAR.accel * 0.6 * dt);
      }
      car.speed -= car.speed * CAR.drag * dt;
      const maxF = car.kind === 'police' ? POLICE.carSpeed : 430;
      car.speed = clamp(car.speed, -CAR.maxReverse, maxF);
      if (ctrl.moveX !== 0 && (Math.abs(car.speed) > 4 || fwd !== 0)) {
        // Arcade steering: the wheel still bites at crawl speed while the
        // throttle is down, so a car nosed into a wall can turn itself free.
        const bite = Math.max(0.35, Math.min(1, Math.abs(car.speed) / 160));
        const dirSign = car.speed < -4 ? -1 : 1;
        car.angle += ctrl.moveX * CAR.turnRate * dt * dirSign * bite;
      }
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const fixed = collideBuildings(car.x, car.y, 22);
      if (fixed.x !== car.x || fixed.y !== car.y) {
        if (Math.abs(car.speed) > 120) { events |= EV.CRASH; car.health -= 14; burst(car.x, car.y, '#ffb347', 8); }
        // Scrape along the wall instead of bouncing off it: momentum dies but
        // the push-out above slides the car along the face, so steering out of
        // a head-on nudge stays possible.
        car.speed *= 0.3;
      }
      car.x = fixed.x; car.y = fixed.y;
      if (inWater(car.x, car.y)) { car.speed *= 0.9; }
      // run over peds / hit cars
      for (const list of [peds, policePeds]) {
        for (const ped of list) {
          if (!ped.dead && Math.abs(car.speed) > 60 && dist2(car.x, car.y, ped.x, ped.y) < 30 * 30) {
            ped.dead = 1; ped.health = 0;
            burst(ped.x, ped.y, '#e74c3c', 12);
            events |= crime(ped.cop ? 3 : 2) | EV.CRASH;
            if (ped.cop) events = damagePlayer(2, events);
          }
        }
      }
      for (const other of [...cars, ...policeCars]) {
        if (other === car) continue;
        if (dist2(car.x, car.y, other.x, other.y) < 40 * 40) {
          const push = 14;
          other.x += (other.x - car.x) > 0 ? push : -push;
          if (Math.abs(car.speed) > 230) { events |= EV.CRASH | crime(1); other.health -= 10; burst(other.x, other.y, '#ffb347', 6); }
          car.speed *= 0.82;
        }
      }
      p.x = car.x; p.y = car.y;
      if (ctrl.interact) {
        car.driver = false;
        if (car.kind === 'player') car.kind = 'parked';
        p.car = null;
        const side = car.angle + Math.PI / 2;
        const spot = collideBuildings(car.x + Math.cos(side) * 30, car.y + Math.sin(side) * 30, PLAYER.radius);
        p.x = spot.x; p.y = spot.y;
        events |= EV.DOOR;
      }
    } else {
      // ----- player: on foot -----
      const speed = ctrl.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      p.speedNow = (ctrl.moveX || ctrl.moveY) ? speed : 0;
      let mx = ctrl.moveX;
      let my = ctrl.moveY;
      const len = Math.hypot(mx, my) || 1;
      if (mx || my) {
        p.angle = Math.atan2(my, mx);
        const moved = collideBuildings(p.x + (mx / len) * speed * dt, p.y + (my / len) * speed * dt, PLAYER.radius);
        if (!inWater(moved.x, moved.y) || inWater(p.x, p.y)) { p.x = moved.x; p.y = moved.y; }
      }
      if (ctrl.aimX !== undefined) p.angle = Math.atan2(ctrl.aimY - p.y, ctrl.aimX - p.x);
      if (ctrl.interact) {
        const car = nearestCar(p.x, p.y, 52);
        if (car) {
          if (car.kind === 'parked' || car.kind === 'traffic') {
            if (car.kind === 'parked') { events |= crime(1); state.stats.stolen += 1; }
            car.kind = 'player';
          }
          car.driver = true;
          p.car = car;
          p.x = car.x; p.y = car.y;
          events |= EV.DOOR;
        }
      }
      // combat
      if (ctrl.attack && p.attackCool <= 0) {
        const weapon = WEAPONS[p.weapon];
        if (p.weapon === 'pistol' && p.ammo <= 0) {
          p.weapon = 'fist';
        } else {
          p.attackCool = weapon.cooldown;
          if (p.weapon === 'pistol') {
            p.ammo -= 1;
            state.stats.shots += 1;
            events |= EV.SHOT;
            bullets.push({
              x: p.x + Math.cos(p.angle) * 18, y: p.y + Math.sin(p.angle) * 18,
              vx: Math.cos(p.angle) * 900, vy: Math.sin(p.angle) * 900,
              life: weapon.range / 900, from: 'player',
            });
            burst(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, '#ffd23f', 3, 60);
            events |= crime(1);
            for (const ped of [...peds, ...policePeds]) if (!ped.dead) ped.flee = Math.max(ped.flee, 2);
          } else {
            events |= EV.PUNCH;
            const tx = p.x + Math.cos(p.angle) * PLAYER.punchRange;
            const ty = p.y + Math.sin(p.angle) * PLAYER.punchRange;
            for (const ped of [...peds, ...policePeds]) {
              if (!ped.dead && dist2(tx, ty, ped.x, ped.y) < 30 * 30) {
                ped.health -= PLAYER.punchDamage;
                ped.flee = 3;
                burst(ped.x, ped.y, '#ffffff', 5, 80);
                if (ped.health <= 0) { ped.dead = 1; events |= crime(ped.cop ? 3 : 2); }
                else events |= crime(1);
              }
            }
            for (const car of cars) {
              if (dist2(tx, ty, car.x, car.y) < 44 * 44) { car.health -= 6; burst(car.x, car.y, '#ffb347', 4, 70); }
            }
          }
        }
      }
    }

    // ----- traffic -----
    for (const car of cars) {
      if (car.kind !== 'traffic') continue;
      car.turnCool -= dt;
      const d = DIRS[car.dir];
      car.x += d.x * car.speed * dt;
      car.y += d.y * car.speed * dt;
      car.angle = angleLerp(car.angle, Math.atan2(d.y, d.x), Math.min(1, dt * 5));
      // slow for a car ahead
      for (const other of cars) {
        if (other !== car && other.kind === 'traffic' && other.dir === car.dir
          && Math.abs(other.x - car.x) < 30 && Math.abs(other.y - car.y) < 30) {
          car.speed = Math.min(car.speed, TRAFFIC.speed * 0.6);
        }
      }
      if (car.speed < TRAFFIC.speed) car.speed = Math.min(TRAFFIC.speed, car.speed + 40 * dt);
      const inXBand = (car.x % WORLD.cell) < WORLD.road;
      const inYBand = (car.y % WORLD.cell) < WORLD.road;
      if (inXBand && inYBand && car.turnCool <= 0) {
        car.turnCool = 0.8;
        if (rng() < 0.38) {
          const turn = rng() < 0.5 ? 1 : 3;
          car.dir = (car.dir + turn) % 4;
          const nd = DIRS[car.dir];
          const bandX = Math.floor(car.x / WORLD.cell) * WORLD.cell;
          const bandY = Math.floor(car.y / WORLD.cell) * WORLD.cell;
          if (nd.x !== 0) car.y = laneCoord(car.dir, bandY);
          if (nd.y !== 0) car.x = laneCoord(car.dir, bandX);
        }
      }
      if (car.x < 30 || car.x > WORLD.width - 30 || car.y < 30 || car.y > WORLD.height - 30) {
        car.dir = (car.dir + 2) % 4;
        car.x = clamp(car.x, 40, WORLD.width - 40);
        car.y = clamp(car.y, 40, WORLD.height - 40);
        const bandX = Math.floor(car.x / WORLD.cell) * WORLD.cell;
        const bandY = Math.floor(car.y / WORLD.cell) * WORLD.cell;
        if (DIRS[car.dir].x !== 0) car.y = laneCoord(car.dir, bandY);
        if (DIRS[car.dir].y !== 0) car.x = laneCoord(car.dir, bandX);
      }
      if (inWater(car.x, car.y)) { car.dir = (car.dir + 2) % 4; car.y = WATER.y - 30; }
    }

    // ----- pedestrians -----
    for (const list of [peds, policePeds]) {
      for (const ped of list) {
        if (ped.dead) { ped.dead += dt; continue; }
        if (ped.cop) continue; // police peds handled below
        if (ped.flee > 0) {
          ped.flee -= dt;
          const away = Math.atan2(ped.y - py, ped.x - px);
          ped.x += Math.cos(away) * 170 * dt;
          ped.y += Math.sin(away) * 170 * dt;
          ped.angle = away;
          continue;
        }
        const d2 = dist2(ped.x, ped.y, ped.tx, ped.ty);
        if (d2 < 12 * 12) {
          const bx = Math.floor(ped.x / WORLD.cell) * WORLD.cell + WORLD.road + 13;
          const by = Math.floor(ped.y / WORLD.cell) * WORLD.cell + WORLD.road + 13;
          ped.tx = bx + rng() * (WORLD.cell - WORLD.road - 26);
          ped.ty = by + rng() * (WORLD.cell - WORLD.road - 26);
        } else {
          const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
          const stepX = ped.x + Math.cos(a) * ped.speed * dt;
          const stepY = ped.y + Math.sin(a) * ped.speed * dt;
          const fixed = collideBuildings(stepX, stepY, 10);
          ped.x = fixed.x; ped.y = fixed.y;
          ped.angle = a;
        }
      }
    }

    // ----- police -----
    events = spawnPolice(events);
    let anySees = false;
    for (const car of policeCars) {
      const d = Math.hypot(px - car.x, py - car.y);
      if (d < POLICE.sightRange && lineOfSight(car.x, car.y, px, py)) anySees = true;
      unstuck(car, dt, 16);
      const targetAngle = Math.atan2(py - car.y, px - car.x);
      car.angle = angleLerp(car.angle, targetAngle, Math.min(1, dt * 2.2));
      const want = d > 60 ? POLICE.carSpeed : POLICE.carSpeed * 0.4;
      car.speed += clamp(want - car.speed, -300 * dt, 200 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const fixed = collideBuildings(car.x, car.y, 22);
      if (fixed.x !== car.x || fixed.y !== car.y) car.speed *= 0.4;
      car.x = fixed.x; car.y = fixed.y;
      if (p.car && d < 38 && Math.abs(car.speed) > 100) {
        p.car.health -= 30 * dt;
        events |= EV.CRASH;
        if (p.car.health <= 0) { p.car.kind = 'parked'; p.car.speed = 0; p.car = null; events = damagePlayer(18, events); say('Your ride is wrecked!', 3); }
      } else if (!p.car && d < 30 && Math.abs(car.speed) > 140) {
        events = damagePlayer(14, events);
        car.speed *= 0.3;
      }
    }
    for (const ped of policePeds) {
      if (ped.dead) { ped.dead += dt; continue; }
      const d = Math.hypot(px - ped.x, py - ped.y);
      if (d < POLICE.sightRange && lineOfSight(ped.x, ped.y, px, py)) anySees = true;
      unstuck(ped, dt, 10);
      const a = Math.atan2(py - ped.y, px - ped.x);
      ped.angle = a;
      if (d > 20) {
        const fixed = collideBuildings(ped.x + Math.cos(a) * POLICE.footSpeed * dt, ped.y + Math.sin(a) * POLICE.footSpeed * dt, 11);
        ped.x = fixed.x; ped.y = fixed.y;
        ped.grabTime = 0;
      } else if (!p.car) {
        if (state.wanted <= 2) {
          // A bust needs the player cornered, not merely touched at full
          // sprint: the grab only builds while the player walks or stands.
          if ((p.speedNow ?? 0) < 200) {
            ped.grabTime += dt;
            if (ped.grabTime > 1.1 && !state.over) {
              state.over = 'busted';
              state.overTime = 0;
              state.money = Math.max(0, state.money - Math.floor(state.money * 0.1) - 25);
              events |= EV.BUSTED;
            }
          }
        } else {
          events = damagePlayer(10 * dt, events);
        }
      }
      if (state.wanted >= 3 && d < POLICE.shootRange && d > 40 && lineOfSight(ped.x, ped.y, px, py)) {
        ped.shootCool -= dt;
        if (ped.shootCool <= 0) {
          ped.shootCool = range(rng, 0.7, 1.3);
          bullets.push({ x: ped.x, y: ped.y, vx: Math.cos(a) * 820, vy: Math.sin(a) * 820, life: 0.4, from: 'police' });
          events |= EV.SHOT;
        }
      }
    }
    // wanted decay
    if (state.wanted > 0) {
      if (anySees) state.hideTime = 0;
      else {
        state.hideTime += dt;
        if (state.hideTime >= POLICE.loseSightAfter) {
          state.hideTime = 0;
          state.wanted -= 1;
          if (state.wanted === 0) {
            policeCars.length = 0;
            policePeds.length = 0;
            say('You lost them.', 2.5);
          }
        }
      }
    }

    // ----- bullets & particles -----
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let hit = b.life <= 0;
      for (const bd of buildings) {
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) { hit = true; break; }
      }
      if (!hit && b.from === 'player') {
        for (const ped of [...peds, ...policePeds]) {
          if (!ped.dead && dist2(b.x, b.y, ped.x, ped.y) < 15 * 15) {
            ped.health -= WEAPONS.pistol.damage;
            ped.flee = 3;
            burst(ped.x, ped.y, '#e74c3c', 6, 90);
            if (ped.health <= 0) { ped.dead = 1; events |= crime(ped.cop ? 3 : 2); }
            hit = true; break;
          }
        }
        if (!hit) {
          for (const car of [...cars, ...policeCars]) {
            if (dist2(b.x, b.y, car.x, car.y) < 26 * 26) {
              car.health -= WEAPONS.pistol.damage;
              burst(car.x, car.y, '#ffb347', 5, 90);
              if (car.health <= 0 && car.kind === 'traffic') { car.kind = 'parked'; car.speed = 0; car.driver = false; }
              hit = true; break;
            }
          }
        }
      }
      if (!hit && b.from === 'police' && !p.car && dist2(b.x, b.y, p.x, p.y) < 14 * 14) {
        events = damagePlayer(POLICE.shootDamage, events);
        hit = true;
      }
      if (hit) bullets.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const pt = particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) particles.splice(i, 1);
    }

    // ----- mission stage checks -----
    const stage = currentStage();
    if (stage && !state.over) {
      if (stage.type === 'steal' && p.car) events = completeStage(events);
      else if (stage.type === 'goto') {
        const inZone = dist2(px, py, stage.x, stage.y) < stage.r * stage.r;
        if (inZone && (!stage.inCar || p.car)) events = completeStage(events);
      } else if (stage.type === 'timed_goto') {
        state.stageData.timeLeft = (state.stageData.timeLeft ?? stage.seconds) - dt;
        state.timer = Math.max(0, state.stageData.timeLeft);
        if (dist2(px, py, stage.x, stage.y) < stage.r * stage.r) events = completeStage(events);
        else if (state.stageData.timeLeft <= 0) {
          say('The ferry left without you. Try again.', 4);
          state.stageData.timeLeft = stage.seconds;
          addWanted(0, true);
        }
      } else if (stage.type === 'loseheat') {
        if (state.wanted === 0) events = completeStage(events);
      } else if (stage.type === 'collect') {
        stage.points.forEach((point, i) => {
          if (!state.stageData['got' + i] && dist2(px, py, point.x, point.y) < 55 * 55) {
            state.stageData['got' + i] = true;
            state.money += 40;
            events |= EV.CASH;
            say(`Dead drop collected (+$40)`, 2);
            burst(point.x, point.y, '#9dff57', 10, 90);
            refreshObjective();
          }
        });
        if (stage.points.every((_, i) => state.stageData['got' + i])) events = completeStage(events);
      }
    }

    return events;
  }

  refreshObjective();
  if (!hasSave()) startMission(0);

  return {
    state, buildings, lamps, trees, crates, cars, peds, policeCars, policePeds,
    bullets, particles, water: WATER, step, startMission, loadSave, hasSave,
    save: autosave, respawn, say, currentStage,
    addWantedForTest(n) { addWanted(n, true); },
  };
}
