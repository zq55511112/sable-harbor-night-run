// Sable Harbor: Night Run — boot and the one game loop. Input is read every frame,
// the world advances in fixed 1/60 s steps, and the renderer paints the result.
// Screens: title, play, pause, and the wasted/busted overlay the world raises.
//
// ?seed=N fixes the city. ?shot=start|play|drive|chase (with &seed=N) stages that
// scene from the real simulation for screenshots and stops there.

import { STEP } from './config.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, cameraFor, render } from './render.js';
import { stageShot } from './shots.js';
import { EV, HOSPITAL, STATION, createWorld } from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1) || 1;

let world = createWorld(seed);
let screen = SCREEN_TITLE;
const input = createInput(canvas);
const audio = createAudio();
let muted = false;
let lastAnnouncement = '';

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function announce(text) {
  if (text && text !== lastAnnouncement) {
    lastAnnouncement = text;
    status.textContent = text;
  }
}

function playEvents(events) {
  if (muted) return;
  if (events & EV.SHOT) audio.shot();
  if (events & EV.PUNCH) audio.punch();
  if (events & EV.CRASH) audio.crash();
  if (events & EV.PICKUP) audio.pickup();
  if (events & EV.CASH) audio.cash();
  if (events & EV.DOOR) audio.door();
  if (events & EV.MISSION) audio.missionDone();
  if (events & EV.BUSTED) audio.busted();
  if (events & EV.WASTED) audio.hurt();
  if (events & EV.HURT) audio.hurt();
}

function buildCtrl() {
  const axes = input.axes();
  const cam = cameraFor(world, canvas.width, canvas.height);
  const p = world.state.player;
  return {
    moveX: axes.x,
    moveY: axes.y,
    run: input.down('ShiftLeft', 'ShiftRight'),
    attack: input.mouse.down && screen === SCREEN_PLAY,
    aimX: cam.x + input.mouse.x,
    aimY: cam.y + input.mouse.y,
    interact: input.tap('KeyE'),
    _p: p,
  };
}

function handleMetaKeys() {
  if (input.tap('KeyM')) {
    muted = !muted;
    if (muted) { audio.siren(0); audio.engine(null); }
  }
  if (screen === SCREEN_TITLE) {
    if (input.tap('KeyN')) {
      world = createWorld(seed);
      world.startMission(0);
      screen = SCREEN_PLAY;
      audio.ui();
    } else if (input.tap('Enter') || input.clicked()) {
      if (world.hasSave()) world.loadSave();
      else world.startMission(0);
      screen = SCREEN_PLAY;
      audio.ui();
    }
    return;
  }
  if (screen === SCREEN_OVER) {
    if (world.state.overTime > 0.8 && (input.tap('Enter') || input.clicked())) {
      world.respawn(world.state.over === 'wasted' ? HOSPITAL : STATION);
      screen = SCREEN_PLAY;
    }
    return;
  }
  if (input.tap('Escape', 'KeyP')) {
    screen = screen === SCREEN_PAUSE ? SCREEN_PLAY : SCREEN_PAUSE;
    audio.ui();
    return;
  }
  if (screen === SCREEN_PLAY) {
    if (input.tap('F5')) {
      world.save();
      world.say('Game saved.', 2);
    }
    if (input.tap('Digit1')) world.state.player.weapon = 'fist';
    if (input.tap('Digit2') && world.state.player.ammo > 0) world.state.player.weapon = 'pistol';
    const wheel = input.wheelDelta();
    if (wheel !== 0) {
      const p = world.state.player;
      p.weapon = p.weapon === 'fist' && p.ammo > 0 ? 'pistol' : 'fist';
    }
  }
}

// Screenshot mode: stage once, paint the frozen scene, and flag readiness.
const shot = params.get('shot');
if (shot) {
  const staged = stageShot(shot, world);
  screen = staged.screen;
  render(ctx, world, screen === SCREEN_TITLE ? SCREEN_TITLE : SCREEN_PLAY, canvas.width, canvas.height);
  document.title = `Sable Harbor shot: ${shot}`;
  window.__shotReady = true;
} else {
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    audio.unlock();
    handleMetaKeys();
    if (screen === SCREEN_PLAY || screen === SCREEN_OVER) {
      acc += dt;
      let events = 0;
      while (acc >= STEP) {
        acc -= STEP;
        events |= world.step(STEP, buildCtrl());
      }
      playEvents(events);
      if (world.state.over && screen === SCREEN_PLAY) screen = SCREEN_OVER;
      // ambience loops
      if (!muted) {
        const p = world.state.player;
        let sirenLevel = 0;
        if (world.state.wanted > 0) {
          let nearest = Infinity;
          for (const car of world.policeCars) nearest = Math.min(nearest, Math.hypot(car.x - p.x, car.y - p.y));
          for (const ped of world.policePeds) nearest = Math.min(nearest, Math.hypot(ped.x - p.x, ped.y - p.y));
          sirenLevel = nearest === Infinity ? 0.25 : Math.max(0.15, 1 - nearest / 700);
        }
        audio.siren(sirenLevel);
        audio.engine(p.car ? Math.abs(p.car.speed) / 430 : null);
      }
      announce(world.state.objectiveText);
    }
    render(ctx, world, screen, canvas.width, canvas.height);
  }
  requestAnimationFrame(frame);
}
