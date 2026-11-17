// Sable Harbor: Night Run — drawing only. Reads the world state and paints the
// night city, the HUD with its minimap, and the title / pause / game-over screens.
// The camera follows the player; everything off-screen is skipped.

import { WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';

const FONT = '"Segoe UI", system-ui, sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function cameraFor(world, w, h) {
  const p = world.state.player;
  const cx = p.car ? p.car.x : p.x;
  const cy = p.car ? p.car.y : p.y;
  return {
    x: Math.max(0, Math.min(WORLD.width - w, cx - w / 2)),
    y: Math.max(0, Math.min(WORLD.height - h, cy - h / 2)),
  };
}

function drawGround(ctx, world, cam, w, h) {
  ctx.fillStyle = '#20242c';
  ctx.fillRect(0, 0, w, h);
  const cell = WORLD.cell;
  const road = WORLD.road;
  // road bands
  ctx.fillStyle = '#262a33';
  for (let x = -cam.x % cell - cell; x < w; x += cell) ctx.fillRect(x, 0, road, h);
  for (let y = -cam.y % cell - cell; y < h; y += cell) ctx.fillRect(0, y, w, road);
  // lane dashes
  ctx.fillStyle = 'rgba(200,178,90,0.5)';
  for (let bx = 0; bx <= WORLD.width / cell; bx += 1) {
    const sx = bx * cell + road / 2 - cam.x;
    if (sx < -4 || sx > w + 4) continue;
    for (let y = 10; y < WORLD.height; y += 46) {
      const sy = y - cam.y;
      if (sy > -20 && sy < h + 20) ctx.fillRect(sx - 2, sy, 4, 22);
    }
  }
  for (let by = 0; by <= WORLD.height / cell; by += 1) {
    const sy = by * cell + road / 2 - cam.y;
    if (sy < -4 || sy > h + 4) continue;
    for (let x = 10; x < WORLD.width; x += 46) {
      const sx = x - cam.x;
      if (sx > -20 && sx < w + 20) ctx.fillRect(sx, sy - 2, 22, 4);
    }
  }
  // sidewalks
  ctx.fillStyle = '#33363f';
  for (let cx = 0; cx < WORLD.width / cell; cx += 1) {
    for (let cy = 0; cy < WORLD.height / cell; cy += 1) {
      const sx = cx * cell + road - cam.x;
      const sy = cy * cell + road - cam.y;
      const size = cell - road;
      if (sx > -size && sx < w && sy > -size && sy < h) ctx.fillRect(sx, sy, size, size);
    }
  }
  // park grass
  ctx.fillStyle = '#1d2b22';
  const parkX = 3 * cell + road - cam.x;
  const parkY = 2 * cell + road - cam.y;
  ctx.fillRect(parkX, parkY, cell - road, cell - road);
  // water
  const wt = world.water;
  ctx.fillStyle = '#0d2233';
  ctx.fillRect(wt.x - cam.x, wt.y - cam.y, wt.w, wt.h);
  ctx.fillStyle = 'rgba(120,200,255,0.13)';
  for (let i = 0; i < 12; i += 1) {
    const wy = wt.y + 30 + i * 42 - cam.y;
    ctx.fillRect(wt.x + 40 + (i % 4) * 180 - cam.x, wy, 90, 3);
  }
  // dock crates
  for (const c of world.crates) {
    const sx = c.x - cam.x;
    const sy = c.y - cam.y;
    if (sx < -40 || sy < -40 || sx > w + 40 || sy > h + 40) continue;
    ctx.fillStyle = '#7a5c2e';
    ctx.fillRect(sx, sy, c.w, c.h);
    ctx.strokeStyle = '#5d451f';
    ctx.strokeRect(sx + 2, sy + 2, c.w - 4, c.h - 4);
  }
  // lamp glow
  for (const lamp of world.lamps) {
    const sx = lamp.x - cam.x;
    const sy = lamp.y - cam.y;
    if (sx < -70 || sy < -70 || sx > w + 70 || sy > h + 70) continue;
    const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, 62);
    glow.addColorStop(0, 'rgba(255,214,120,0.20)');
    glow.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 62, sy - 62, 124, 124);
    ctx.fillStyle = '#ffe9b0';
    ctx.fillRect(sx - 2, sy - 2, 4, 4);
  }
  // trees
  for (const t of world.trees) {
    const sx = t.x - cam.x;
    const sy = t.y - cam.y;
    if (sx < -30 || sy < -30 || sx > w + 30 || sy > h + 30) continue;
    ctx.fillStyle = '#274d33';
    ctx.beginPath();
    ctx.arc(sx, sy, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#356b45';
    ctx.beginPath();
    ctx.arc(sx - 3, sy - 3, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBuildings(ctx, world, cam, w, h) {
  for (const b of world.buildings) {
    const sx = b.x - cam.x;
    const sy = b.y - cam.y;
    if (sx > w + 10 || sy > h + 10 || sx + b.w < -10 || sy + b.h < -10) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(sx + 7, sy + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(sx, sy, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(sx + 7, sy + 7, b.w - 14, b.h - 14);
    // window grid
    ctx.fillStyle = 'rgba(255,220,130,0.20)';
    const cols = Math.floor(b.w / 26);
    const rows = Math.floor(b.h / 26);
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        if ((i * 7 + j * 13 + Math.floor(b.x)) % 5 === 0) {
          ctx.fillRect(sx + 12 + i * 26, sy + 12 + j * 26, 9, 12);
        }
      }
    }
    if (b.shop && b.w > 92) {
      ctx.font = `bold 12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.shadowColor = b.neon;
      ctx.shadowBlur = 9;
      ctx.fillStyle = b.neon;
      ctx.fillText(b.shop, sx + b.w / 2, sy + 20);
      ctx.shadowBlur = 0;
    }
  }
}

function drawCar(ctx, car, cam, time) {
  const sx = car.x - cam.x;
  const sy = car.y - cam.y;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(car.angle);
  // headlight cone
  ctx.fillStyle = 'rgba(255,240,180,0.10)';
  ctx.beginPath();
  ctx.moveTo(22, -8);
  ctx.lineTo(120, -34);
  ctx.lineTo(120, 34);
  ctx.lineTo(22, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -21, -10, 46, 24, 6);
  ctx.fill();
  ctx.fillStyle = car.kind === 'police' ? '#e8ecf4' : car.color;
  roundRect(ctx, -23, -12, 46, 24, 6);
  ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = '#2b5cff';
    ctx.fillRect(-4, -12, 10, 24);
    const flash = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff4040' : '#4060ff';
    ctx.fillRect(-3, -6, 6, 12);
  }
  ctx.fillStyle = '#18222e';
  roundRect(ctx, -8, -9, 16, 18, 3);
  ctx.fill();
  ctx.fillStyle = '#ffd9a0';
  ctx.fillRect(21, -9, 3, 5);
  ctx.fillRect(21, 4, 3, 5);
  ctx.fillStyle = '#ff5040';
  ctx.fillRect(-24, -9, 3, 5);
  ctx.fillRect(-24, 4, 3, 5);
  ctx.restore();
  if (car.health < 110) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(sx - 20, sy - 26, 40, 5);
    ctx.fillStyle = car.health > 50 ? '#9dff57' : '#ff5040';
    ctx.fillRect(sx - 20, sy - 26, 40 * Math.max(0, car.health / 220), 5);
  }
}

function drawPed(ctx, ped, cam, isPlayer, angle) {
  const sx = ped.x - cam.x;
  const sy = ped.y - cam.y;
  if (ped.dead) {
    ctx.fillStyle = 'rgba(120,30,30,0.55)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 15, 8, angle || 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(sx + 2, sy + 3, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isPlayer ? '#ffd23f' : ped.color;
  ctx.beginPath();
  ctx.arc(sx, sy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
  ctx.fill();
  if (isPlayer) {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 14, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (ped.cop) {
    ctx.fillStyle = '#2b5cff';
    ctx.fillRect(sx - 6, sy - 13, 12, 5);
  }
}

function drawMarker(ctx, world, cam, time) {
  const m = world.state.marker;
  if (!m) return;
  const sx = m.x - cam.x;
  const sy = m.y - cam.y;
  const pulse = 26 + Math.sin(time * 5) * 6;
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(sx, sy, pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,63,0.16)';
  ctx.beginPath();
  ctx.arc(sx, sy, pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(sx, sy - 44 - Math.sin(time * 5) * 4);
  ctx.lineTo(sx - 9, sy - 60 - Math.sin(time * 5) * 4);
  ctx.lineTo(sx + 9, sy - 60 - Math.sin(time * 5) * 4);
  ctx.closePath();
  ctx.fill();
  // dead-drop crates for the collect stage
  const stage = world.currentStage();
  if (stage && stage.type === 'collect') {
    ctx.fillStyle = '#9dff57';
    for (let i = 0; i < stage.points.length; i += 1) {
      if (world.state.stageData['got' + i]) continue;
      const pt = stage.points[i];
      ctx.fillRect(pt.x - cam.x - 8, pt.y - cam.y - 8, 16, 16);
    }
  }
}

function drawMinimap(ctx, world, w, h) {
  const mw = 196;
  const mh = 144;
  const mx = w - mw - 14;
  const my = h - mh - 14;
  const sx = mw / WORLD.width;
  const sy = mh / WORLD.height;
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  roundRect(ctx, mx, my, mw, mh, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, mx, my, mw, mh, 8);
  ctx.clip();
  ctx.fillStyle = '#272c36';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#49536a';
  for (let i = 0; i <= WORLD.width / WORLD.cell; i += 1) ctx.fillRect(mx + i * WORLD.cell * sx - 5, my, 10, mh);
  for (let j = 0; j <= WORLD.height / WORLD.cell; j += 1) ctx.fillRect(mx, my + j * WORLD.cell * sy - 5, mw, 10);
  ctx.fillStyle = '#0d2233';
  const wt = world.water;
  ctx.fillRect(mx + wt.x * sx, my + wt.y * sy, wt.w * sx, wt.h * sy);
  const st = world.state;
  if (st.marker) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(mx + st.marker.x * sx, my + st.marker.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#4060ff';
  for (const car of world.policeCars) ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
  for (const ped of world.policePeds) if (!ped.dead) ctx.fillRect(mx + ped.x * sx - 2, my + ped.y * sy - 2, 4, 4);
  const p = st.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHUD(ctx, world, w, h) {
  const st = world.state;
  const p = st.player;
  ctx.textAlign = 'left';
  // health + money panel
  ctx.fillStyle = 'rgba(10,14,20,0.66)';
  roundRect(ctx, 14, 14, 232, 84, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillText(`$${st.money}`, 26, 42);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(26, 52, 180, 13);
  ctx.fillStyle = p.health > 30 ? '#57d977' : '#ff5040';
  ctx.fillRect(26, 52, 180 * Math.max(0, p.health / 100), 13);
  ctx.fillStyle = '#cfd8e3';
  ctx.font = `13px ${FONT}`;
  const weapon = p.weapon === 'pistol' ? `Pistol — ${p.ammo} rounds` : 'Fists';
  ctx.fillText(p.car ? `Driving — ${Math.max(0, Math.round(p.car.health))} HP car` : weapon, 26, 86);
  // wanted stars
  ctx.textAlign = 'right';
  ctx.font = `26px ${FONT}`;
  for (let i = 0; i < 5; i += 1) {
    const lit = i < st.wanted;
    const fading = !lit && st.wanted > 0 && i === st.wanted && st.hideTime > 1;
    ctx.fillStyle = lit ? '#ffd23f' : fading ? 'rgba(255,210,63,0.45)' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', w - 20 - (4 - i) * 30, 44);
  }
  if (st.wanted > 0) {
    ctx.fillStyle = '#cfd8e3';
    ctx.font = `12px ${FONT}`;
    ctx.fillText(st.hideTime > 1 ? 'BREAKING LINE OF SIGHT…' : 'WANTED', w - 20, 64);
  }
  // objective
  ctx.textAlign = 'left';
  if (st.objectiveText) {
    ctx.fillStyle = 'rgba(10,14,20,0.66)';
    const text = st.timer > 0 ? `${st.objectiveText}  —  ${Math.ceil(st.timer)}s` : st.objectiveText;
    ctx.font = `14px ${FONT}`;
    const tw = ctx.measureText(text).width;
    roundRect(ctx, 14, h - 40, tw + 24, 28, 6);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(text, 26, h - 21);
  }
  // centre message
  if (st.messageTime > 0 && st.message) {
    ctx.textAlign = 'center';
    ctx.font = `bold 19px ${FONT}`;
    const tw = ctx.measureText(st.message).width;
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, w / 2 - tw / 2 - 18, 84, tw + 36, 38, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(st.message, w / 2, 109);
  }
  // hurt flash
  if (p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,40,40,${p.hurtFlash * 0.55})`;
    ctx.fillRect(0, 0, w, h);
  }
  // off-screen marker arrow
  if (st.marker) {
    const cam = cameraFor(world, w, h);
    const sx = st.marker.x - cam.x;
    const sy = st.marker.y - cam.y;
    if (sx < 0 || sy < 0 || sx > w || sy > h) {
      const cx = w / 2;
      const cy = h / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      const ex = cx + Math.cos(a) * (Math.min(w, h) / 2 - 46);
      const ey = cy + Math.sin(a) * (Math.min(w, h) / 2 - 46);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  drawMinimap(ctx, world, w, h);
}

export function render(ctx, world, screen, w, h, opts = {}) {
  const time = world.state.time;
  const cam = opts.cam || cameraFor(world, w, h);
  drawGround(ctx, world, cam, w, h);
  drawBuildings(ctx, world, cam, w, h);
  drawMarker(ctx, world, cam, time);
  for (const car of world.cars) {
    const sx = car.x - cam.x;
    const sy = car.y - cam.y;
    if (sx > -80 && sy > -80 && sx < w + 80 && sy < h + 80) drawCar(ctx, car, cam, time);
  }
  for (const ped of world.peds) drawPed(ctx, ped, cam, false, ped.angle);
  for (const car of world.policeCars) drawCar(ctx, car, cam, time);
  for (const ped of world.policePeds) drawPed(ctx, ped, cam, false, ped.angle);
  const p = world.state.player;
  if (!p.car) {
    drawPed(ctx, p, cam, true, p.angle);
    if (p.weapon === 'pistol') {
      ctx.strokeStyle = '#dfe6ee';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x - cam.x + Math.cos(p.angle) * 10, p.y - cam.y + Math.sin(p.angle) * 10);
      ctx.lineTo(p.x - cam.x + Math.cos(p.angle) * 20, p.y - cam.y + Math.sin(p.angle) * 20);
      ctx.stroke();
    }
  }
  // bullets & particles
  ctx.fillStyle = '#ffe9a0';
  for (const b of world.bullets) ctx.fillRect(b.x - cam.x - 2, b.y - cam.y - 2, 4, 4);
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life * 2);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - cam.x - pt.size / 2, pt.y - cam.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  // night vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(4,6,14,0)');
  vg.addColorStop(1, 'rgba(4,6,14,0.42)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  if (screen === SCREEN_PLAY) drawHUD(ctx, world, w, h);
  if (screen === SCREEN_PAUSE) {
    drawHUD(ctx, world, w, h);
    panel(ctx, w, h, 'PAUSED', [
      'Esc / P — resume',
      'F5 — save game',
      'M — mute siren & engine',
      'Your progress also saves itself after every mission.',
    ]);
  }
  if (screen === SCREEN_OVER) {
    const wasted = world.state.over === 'wasted';
    ctx.fillStyle = wasted ? 'rgba(60,0,0,0.45)' : 'rgba(0,10,60,0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = wasted ? '#ff5040' : '#7fa8ff';
    ctx.font = `bold 74px ${FONT}`;
    ctx.fillText(wasted ? 'WASTED' : 'BUSTED', w / 2, h / 2 - 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = `19px ${FONT}`;
    ctx.fillText(wasted ? 'The harbor medics patch you up — for a fee.' : 'The harbor watch takes its cut and lets you walk.', w / 2, h / 2 + 24);
    ctx.fillText('Press Enter to carry on', w / 2, h / 2 + 58);
  }
  if (screen === SCREEN_TITLE) {
    ctx.fillStyle = 'rgba(5,8,16,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff5da2';
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#ffd23f';
    ctx.font = `bold 84px ${FONT}`;
    ctx.fillText('SABLE HARBOR', w / 2, h * 0.3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#4dd0e1';
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillText('— NIGHT RUN —', w / 2, h * 0.3 + 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = `20px ${FONT}`;
    const has = world.hasSave();
    ctx.fillText(has ? 'Enter — continue    N — new game' : 'Enter — start your first night', w / 2, h * 0.52);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = '#cfd8e3';
    const lines = [
      'An original open-world crime caper: explore the harbor on foot and by car,',
      'run Mara’s five jobs, dodge the harbor watch, and catch the last ferry.',
      '',
      'WASD / arrows — move & drive      E — enter / exit car      Shift — run',
      'Mouse — aim      Click — punch / shoot      1 / 2 — fists / pistol',
      'Esc — pause      F5 — save      Stealing, crashing and fighting raise your wanted stars.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.62 + i * 22));
  }
}

function panel(ctx, w, h, title, lines) {
  ctx.fillStyle = 'rgba(5,8,16,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(12,16,24,0.92)';
  roundRect(ctx, w / 2 - 250, h / 2 - 110, 500, 220, 12);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText(title, w / 2, h / 2 - 58);
  ctx.fillStyle = '#dfe6ee';
  ctx.font = `16px ${FONT}`;
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 - 14 + i * 26));
}
