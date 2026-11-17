// The screenshot scenes behind ?shot=start|play|drive|chase. Each stages the real
// simulation — never a mock-up — by stepping the world with scripted controls, so
// what the screenshot shows is what a player actually sees, and the same seed
// always stages the same frame.

import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE = { moveX: 0, moveY: 0, run: false, attack: false, interact: false };

function steps(world, seconds, ctrl) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i += 1) world.step(STEP, typeof ctrl === 'function' ? ctrl(i) : ctrl);
}

function nearestParked(world) {
  const p = world.state.player;
  let best = null;
  let bestD = Infinity;
  for (const car of world.cars) {
    if (car.kind !== 'parked') continue;
    const d = (car.x - p.x) ** 2 + (car.y - p.y) ** 2;
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function putPlayerInCar(world) {
  const p = world.state.player;
  const car = nearestParked(world);
  if (!car) return null;
  p.x = car.x;
  p.y = car.y;
  world.step(STEP, { ...IDLE, interact: true });
  return car;
}

/**
 * Stage the named scene on a fresh world and return the screen to draw.
 * start: the title over a living city. play: on foot downtown at night, first job
 * active. drive: behind the wheel on the harbor avenue. chase: four stars, the
 * harbor watch closing in.
 */
export function stageShot(name, world) {
  const p = world.state.player;
  if (name === 'play') {
    p.x = 760;
    p.y = 900;
    steps(world, 2.5, { ...IDLE, moveX: 1, moveY: 0.2 });
    return { screen: SCREEN_PLAY };
  }
  if (name === 'drive') {
    p.x = 700;
    p.y = 760;
    putPlayerInCar(world);
    steps(world, 3.2, { ...IDLE, moveY: -1 });
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    p.x = 1500;
    p.y = 1250;
    putPlayerInCar(world);
    world.addWantedForTest(4);
    steps(world, 4.5, { ...IDLE, moveY: -1, moveX: 0.15 });
    return { screen: SCREEN_PLAY };
  }
  // start (and any unknown name): a slow ambient city behind the title.
  p.x = 1500;
  p.y = 1250;
  steps(world, 3, IDLE);
  return { screen: SCREEN_TITLE };
}
