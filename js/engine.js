/* ============================================================
   TRAP DEVIL: RAGE EDITION — engine.js
   Pure game logic: physics, tiles, traps, entities, camera, particles.
   NO DOM access — runs in the browser AND in Node (for tests).

   THE ONE RULE: no random impossible death. Every trap is
   discoverable and beatable — the engine only ever punishes you
   for things the level visibly warned you about.
   ============================================================ */
(function (global) {
'use strict';

const TILE = 40;
const GRAV = 2300;
const JUMP_V = 840;
const MOVE_MAX = 330;
const ACC_G = 2800;
const ACC_A = 1900;
const FRICT_G = 2600;
const MAX_FALL = 1600;
const COYOTE = 0.1;
const JUMP_BUFFER = 0.12;
const PLAYER_W = 26;
const PLAYER_H = 34;

/* ---------- map parsing ---------- */
function parseLevel(def, index) {
  const rows = def.map;
  const h = rows.length;
  const w = rows[0].length;
  const solids = new Uint8Array(w * h);
  const hazards = new Uint8Array(w * h);
  const oneway = new Uint8Array(w * h);
  const zones = [];
  const entities = [];
  const crumble = new Map();  // idx -> {state, t}
  const coward = new Map();   // idx -> {state, t}
  const fakePlats = new Set();
  const invis = new Map();    // idx -> {t}
  const lasers = new Set();        // idx — laser tiles (hazard only while ON)
  const conveyors = new Map();     // idx -> +1 (right) / -1 (left)
  const ice = new Set();           // idx — slippery floor tiles
  const onewayDoors = new Set();   // idx — solid, passable left→right only
  let spawn = null, spawn2 = null, goal = null;

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const c = row[x];
      const i = y * w + x;
      switch (c) {
        case '#': case '=': solids[i] = 1; break;
        case '^': oneway[i] = 1; break;
        case 'H': case 'V': hazards[i] = 1; break;
        case 'D': solids[i] = 1; crumble.set(i, { state: 'solid', t: 0 }); break;
        case 'A': solids[i] = 1; coward.set(i, { state: 'solid', t: 0 }); break;
        case 'f': fakePlats.add(i); break;
        case 'I': solids[i] = 1; invis.set(i, { t: 0 }); break;
        case 'R': zones.push({ kind: 'reverse', x, y, w: 1, h: 1 }); break;
        case 'Z': zones.push({ kind: 'camera', x, y, w: 1, h: 1 }); break;
        case 'w': zones.push({ kind: 'shift', x, y, w: 1, h: 1 }); break;
        case 'T': entities.push({ type: 'teleport', x, y }); break;
        case 'C': entities.push({ type: 'checkpoint', x, y, active: false }); break;
        case 'F': entities.push({ type: 'fakecheckpoint', x, y }); break;
        case 'G': goal = { x, y }; entities.push({ type: 'goal', x, y }); break;
        case 'Y': entities.push({ type: 'fakefinish', x, y }); break;
        case 'L': entities.push({ type: 'lever', x, y, used: false }); break;
        case 'K': entities.push({ type: 'wronglever', x, y }); break;
        case 'O': entities.push({ type: 'door', x, y, open: false, openT: 0 }); solids[i] = 1; break;
        case 'X': entities.push({ type: 'killerdoor', x, y }); break;
        case 'S': entities.push({ type: 'spawner', x, y, timer: 2, warn: 0, floorY: 0 }); break;
        case 'B': lasers.add(i); break;                       // laser beam (toggles)
        case '>': case '<': solids[i] = 1; conveyors.set(i, c === '>' ? 1 : -1); break;
        case '~': solids[i] = 1; ice.add(i); break;           // ice floor (slippery)
        case '@': solids[i] = 1; onewayDoors.add(i); break;   // one-way door →
        case '&': zones.push({ kind: 'wind', x, y, w: 1, h: 1 }); break; // updraft
        case 'E': case 'M': break; // linked via def.traps below
        case 'P': spawn = { x, y }; break;
        case 'Q': spawn2 = { x, y }; break;
        default: break;
      }
    }
  }

  let shift = null;
  for (const t of (def.traps || [])) {
    if (t.type === 'crusher') {
      entities.push({ type: 'crusher', x: t.x, y: t.y, drop: t.drop || 200, state: 'idle', t: 0, py: t.y * TILE });
    } else if (t.type === 'mover') {
      entities.push({
        type: 'mover', x: t.x, y: t.y, x2: t.x2, y2: t.y2,
        w: 1, h: 0.35, speed: t.speed || 110, t: 0, dir: 1,
        px: t.x * TILE, py: t.y * TILE, vx: 0
      });
    } else if (t.type === 'shift') {
      shift = { add: t.add || [], remove: t.remove || [], spike: t.spike || [] };
    }
  }

  if (!spawn) throw new Error('Level ' + (index + 1) + ' has no spawn (P)');
  if (!goal) throw new Error('Level ' + (index + 1) + ' has no goal (G)');

  return {
    index, name: def.name, hint: def.hint,
    w, h, solids, hazards, oneway, zones, entities,
    crumble, coward, fakePlats, invis,
    lasers, conveyors, ice, onewayDoors,
    spawn, spawn2, goal, shift, shiftDone: false, def,
    solidAt(x, y) { return x >= 0 && y >= 0 && x < w && y < h && solids[y * w + x] === 1; },
    hazardAt(x, y) { return x >= 0 && y >= 0 && x < w && y < h && hazards[y * w + x] === 1; },
    onewayAt(x, y) { return x >= 0 && y >= 0 && x < w && y < h && oneway[y * w + x] === 1; }
  };
}

/* ---------- helpers ---------- */
function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function entitySolid(e) {
  return e.type === 'mover'; // doors are grid solids; movers are entity solids
}

function entityRect(e) {
  if (e.type === 'mover') {
    return { l: e.px, t: e.py, r: e.px + e.w * TILE, b: e.py + e.h * TILE };
  }
  if (e.type === 'crusher') {
    return { l: e.x * TILE, t: e.py, r: e.x * TILE + TILE, b: e.py + TILE };
  }
  return { l: e.x * TILE, t: e.y * TILE, r: e.x * TILE + TILE, b: e.y * TILE + TILE };
}

function burst(st, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (Math.random() * 0.7 + 0.3) * (speed || 220);
    st.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60,
      life: 0.5 + Math.random() * 0.5, color, size: 2 + Math.random() * 3
    });
  }
}

/* ---------- player ---------- */
class Player {
  constructor(x, y, color, label) {
    this.x = x; this.y = y; // center-x, bottom-y in px
    this.w = PLAYER_W; this.h = PLAYER_H;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.coyote = 0; this.jumpBuffer = 0;
    this.alive = true;
    this.inverted = false;
    this.invuln = 0;
    this.standTile = null;
    this.onMover = null;
    this.color = color; this.label = label;
  }
  get left() { return this.x - this.w / 2; }
  get right() { return this.x + this.w / 2; }
  get top() { return this.y - this.h; }
}

/* ---------- state ---------- */
function createState(def, index, mode, opts) {
  opts = opts || {};
  const level = parseLevel(def, index);
  const st = {
    level, mode, index,
    players: [],
    events: [],
    particles: [],
    rocks: [],
    time: 0,
    deaths: 0,
    complete: false,
    respawnIn: 0,
    cameraFlip: 0,
    shake: 0,
    goalFlash: 0,
    vw: 960, vh: 540,
    camera: { x: 0, y: 0, zoom: 1 },
    checkpoint: null,
    checkpointTile: null,
    firstDeathDone: false,
    _goalWarned: -10,
    // RAGE EDITION 2.0
    rageMul: opts.rageMul || 1,     // <1 = traps get FASTER (rage mode)
    hardcore: !!opts.hardcore,     // 1 life — first death ends the run
    runOver: false,
    timeUp: false,
    laserOn: false,
    laserT: 0,
    laserPeriod: def.laserPeriod || 1.6,
    timeLeft: def.timeLimit || Infinity,
    dark: !!def.dark,
    boss: null
  };
  if (level.lasers.size) st.laserT = st.laserPeriod / 2; // grace period, starts OFF
  if (def.boss) {
    const bw = 3 * TILE, bh = 2 * TILE;
    const floorRow = level.h - 2; // arena floor (bedrock is the last row)
    st.boss = {
      x: level.w * TILE - bw - 2 * TILE, y: floorRow * TILE - bh,
      w: bw, h: bh, vx: 150, dir: -1, pause: 0, t: 0
    };
  }
  const p1 = new Player(level.spawn.x * TILE + TILE / 2, (level.spawn.y + 1) * TILE, '#4dd0e1', 'P1');
  st.players.push(p1);
  if (mode === 2) {
    const s2 = level.spawn2 || { x: Math.max(0, level.spawn.x - 1), y: level.spawn.y };
    st.players.push(new Player(s2.x * TILE + TILE / 2, (s2.y + 1) * TILE, '#ffb74d', 'P2'));
  }
  st.checkpoint = { x: p1.x, y: p1.y };
  st.spawnPos = { x: p1.x, y: p1.y };
  for (const e of level.entities) {
    if (e.type === 'spawner') {
      let fy = e.y + 1;
      while (fy < level.h && !level.solidAt(e.x, fy)) fy++;
      e.floorY = fy * TILE;
      e.timer = 1.2 + Math.random() * 1.5;
    }
  }
  st.camera.x = p1.x;
  st.camera.y = p1.y - 100;
  return st;
}

/* ---------- main update ---------- */
function update(st, dt, inputs) {
  const ended = st.complete || st.runOver || st.timeUp;
  if (!ended) st.time += dt;
  if (st.cameraFlip > 0) st.cameraFlip -= dt;
  if (st.shake > 0) st.shake = Math.max(0, st.shake - dt * 3);
  if (st.goalFlash > 0) st.goalFlash -= dt;

  updateEntities(st, dt);
  if (st.boss) updateBoss(st, dt);

  // laser toggle (level-wide phase; rage mode shortens the cycle)
  if (st.level.lasers.size && !ended) {
    st.laserT -= dt;
    if (st.laserT <= 0) {
      st.laserOn = !st.laserOn;
      st.laserT = (st.laserPeriod / 2) * (st.rageMul || 1);
      st.events.push({ type: 'laser', on: st.laserOn });
    }
  }

  // level timer (the TELL is the HUD countdown + ticking)
  if (st.timeLeft !== Infinity && !ended && st.respawnIn <= 0) {
    const prev = st.timeLeft;
    st.timeLeft = Math.max(0, st.timeLeft - dt);
    if (st.timeLeft <= 5 && Math.floor(prev * 2) !== Math.floor(st.timeLeft * 2)) {
      st.events.push({ type: 'ticktock' });
    }
    if (st.timeLeft <= 0) {
      st.timeUp = true;
      for (const p of st.players) if (p.alive) killPlayer(st, p, 'time');
      st.events.push({ type: 'timeup' });
    }
  }

  if (st.respawnIn > 0) {
    st.respawnIn -= dt;
    if (st.respawnIn <= 0 && !st.runOver && !st.timeUp) respawnAll(st);
  }
  const playing = st.respawnIn <= 0 && !st.runOver && !st.timeUp;
  for (let i = 0; i < st.players.length; i++) {
    const p = st.players[i];
    const inp = (inputs && inputs[i]) || {};
    if (p.alive && playing) stepPlayer(st, p, inp, dt);
    if (p.invuln > 0) p.invuln -= dt;
  }

  updateCrumble(st, dt);
  updateCamera(st, dt);
  updateParticles(st, dt);
  if (!ended) checkLevelBounds(st);
}

/* ---------- player physics ---------- */
function stepPlayer(st, p, inp, dt) {
  const level = st.level;
  p.inverted = false;
  let inWind = false;
  for (const z of level.zones) {
    if (rectOverlap(p.left, p.top, p.w, p.h, z.x * TILE, z.y * TILE, z.w * TILE, z.h * TILE)) {
      if (z.kind === 'reverse') p.inverted = true;
      if (z.kind === 'wind') inWind = true;
    }
  }

  let dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (p.inverted) dir = -dir;
  if (inp.jumpPressed) p.jumpBuffer = JUMP_BUFFER; else p.jumpBuffer -= dt;

  const acc = p.onGround ? ACC_G : ACC_A;
  if (dir !== 0) {
    p.vx += dir * acc * dt;
    if (p.vx > MOVE_MAX) p.vx = MOVE_MAX;
    if (p.vx < -MOVE_MAX) p.vx = -MOVE_MAX;
  } else {
    // ice = very low friction (the TELL is the frost look)
    let fr = FRICT_G;
    if (p.onGround && p.standTile && level.def.map[p.standTile.y][p.standTile.x] === '~') fr = FRICT_G * 0.12;
    const f = fr * dt;
    if (Math.abs(p.vx) <= f) p.vx = 0;
    else p.vx -= (p.vx > 0 ? 1 : -1) * f;
  }

  // carry by moving platform from last frame
  if (p.onMover) p.x += p.onMover.vx * dt;

  // updraft wind = floaty gravity
  p.vy += GRAV * (inWind ? 0.3 : 1) * dt;
  if (p.vy > MAX_FALL) p.vy = MAX_FALL;
  if (p.onGround) p.coyote = COYOTE; else p.coyote -= dt;
  if (p.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = -JUMP_V; p.onGround = false; p.coyote = 0; p.jumpBuffer = 0;
    st.events.push({ type: 'jump', p });
  }

  moveX(st, p, dt);
  moveY(st, p, dt);

  // conveyor belt: carries you whether you like it or not (the TELL is the arrows)
  if (p.onGround && p.standTile) {
    const ch = level.def.map[p.standTile.y][p.standTile.x];
    if (ch === '>') { if (p.vx < 260) p.vx = 260; }
    else if (ch === '<') { if (p.vx > -260) p.vx = -260; }
  }

  checkHazards(st, p);

  // zones (camera flip / layout shift)
  for (const z of level.zones) {
    const zl = z.x * TILE, zt = z.y * TILE, zw = z.w * TILE, zh = z.h * TILE;
    if (rectOverlap(p.left - 2, p.top - 2, p.w + 4, p.h + 4, zl, zt, zw, zh)) {
      if (z.kind === 'camera' && st.cameraFlip < 0.5) {
        st.cameraFlip = 4;
        st.events.push({ type: 'camera', p });
      }
      if (z.kind === 'shift' && !level.shiftDone) triggerShift(st);
    }
  }

  checkTriggers(st, p);
}

function moveX(st, p, dt) {
  const level = st.level;
  p.x += p.vx * dt;
  const l = p.left, r = p.right, t = p.top, b = p.y - 1;
  const x0 = Math.floor(l / TILE), x1 = Math.floor((r - 0.01) / TILE);
  const y0 = Math.floor(t / TILE), y1 = Math.floor((b - 0.01) / TILE);
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      if (level.solidAt(xx, yy)) {
        // one-way door: pass through left → right, blocked the other way
        if (level.onewayDoors.has(yy * level.w + xx) && p.vx > 0) continue;
        if (p.vx > 0) p.x = xx * TILE - p.w / 2;
        else if (p.vx < 0) p.x = (xx + 1) * TILE + p.w / 2;
        p.vx = 0;
        flashInvisible(level, xx, yy);
      }
    }
  }
  for (const e of level.entities) {
    if (!entitySolid(e)) continue;
    const er = entityRect(e);
    if (rectOverlap(p.left, p.top, p.w, p.h, er.l, er.t, er.r - er.l, er.b - er.t)) {
      if (p.vx > 0) p.x = er.l - p.w / 2;
      else if (p.vx < 0) p.x = er.r + p.w / 2;
      else p.x = er.l - p.w / 2;
      p.vx = 0;
    }
  }
}

function moveY(st, p, dt) {
  const level = st.level;
  const prevBottom = p.y;
  p.y += p.vy * dt;
  p.onGround = false;
  p.standTile = null;
  const l = p.left + 1, r = p.right - 1, t = p.top, b = p.y;
  const x0 = Math.floor(l / TILE), x1 = Math.floor((r - 0.01) / TILE);
  const y0 = Math.floor(t / TILE), y1 = Math.floor((b - 0.01) / TILE);
  let landed = false;
  const fallSpeed = p.vy;
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      if (level.solidAt(xx, yy)) {
        if (p.vy > 0) {
          p.y = yy * TILE; p.onGround = true; p.vy = 0;
          p.standTile = { x: xx, y: yy };
          landed = true;
        } else if (p.vy < 0) {
          p.y = (yy + 1) * TILE + p.h; p.vy = 0;
        }
        flashInvisible(level, xx, yy);
      } else if (level.onewayAt(xx, yy) && p.vy > 0 && prevBottom <= yy * TILE + 2) {
        p.y = yy * TILE; p.onGround = true; p.vy = 0;
        p.standTile = { x: xx, y: yy };
        landed = true;
      }
    }
  }
  for (const e of level.entities) {
    if (!entitySolid(e)) continue;
    const er = entityRect(e);
    if (rectOverlap(p.left + 1, p.top + 1, p.w - 2, p.h - 2, er.l, er.t, er.r - er.l, er.b - er.t)) {
      if (p.vy > 0 && prevBottom <= er.t + 4) {
        p.y = er.t; p.onGround = true; p.vy = 0;
        p.standTile = { x: Math.floor((er.l + er.r) / 2 / TILE), y: Math.floor(er.t / TILE) };
        landed = true;
        if (e.type === 'mover') p.onMover = e;
      } else if (p.vy < 0) {
        p.y = er.b + p.h; p.vy = 0;
      }
    }
  }
  if (!p.onGround) p.onMover = null;
  if (landed && fallSpeed > 250) st.events.push({ type: 'land', p });
}

function flashInvisible(level, x, y) {
  const f = level.invis.get(y * level.w + x);
  if (f && f.t <= 0) f.t = 0.6;
}

/* ---------- hazards & triggers ---------- */
function checkHazards(st, p) {
  if (!p.alive || p.invuln > 0) return;
  const level = st.level;
  const l = p.left + 4, r = p.right - 4, t = p.top + 4, b = p.y - 2;
  const x0 = Math.floor(l / TILE), x1 = Math.floor((r - 0.01) / TILE);
  const y0 = Math.floor(t / TILE), y1 = Math.floor((b - 0.01) / TILE);
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      if (level.hazardAt(xx, yy)) { killPlayer(st, p, 'spikes'); return; }
    }
  }
  if (st.laserOn && level.lasers.size) {
    for (const i of level.lasers) {
      const lx = (i % level.w) * TILE, ly = ((i / level.w) | 0) * TILE;
      if (rectOverlap(p.left + 4, p.top + 4, p.w - 8, p.h - 8, lx, ly, TILE, TILE)) {
        killPlayer(st, p, 'laser'); return;
      }
    }
  }
  if (st.boss &&
      rectOverlap(p.left + 2, p.top + 2, p.w - 4, p.h - 4, st.boss.x, st.boss.y, st.boss.w, st.boss.h)) {
    killPlayer(st, p, 'boss'); return;
  }
  for (const e of level.entities) {
    if (e.type === 'killerdoor') {
      const er = entityRect(e);
      if (rectOverlap(p.left + 2, p.top + 2, p.w - 4, p.h - 4, er.l, er.t, er.r - er.l, er.b - er.t)) {
        killPlayer(st, p, 'killerdoor'); return;
      }
    }
    if (e.type === 'crusher' && (e.state === 'drop' || e.state === 'wait' || e.state === 'rise')) {
      const er = entityRect(e);
      if (rectOverlap(p.left + 2, p.top + 2, p.w - 4, p.h - 4, er.l, er.t, er.r - er.l, er.b - er.t)) {
        killPlayer(st, p, 'crusher'); return;
      }
    }
  }
  for (const rock of st.rocks) {
    if (rectOverlap(p.left + 2, p.top + 2, p.w - 4, p.h - 4, rock.x - rock.w / 2, rock.y - rock.h / 2, rock.w, rock.h)) {
      killPlayer(st, p, 'rock');
      breakRock(st, rock);
      return;
    }
  }
}

function checkTriggers(st, p) {
  if (!p.alive) return;
  const level = st.level;
  const bl = p.left - 2, bt = p.top - 2, br = p.right + 2, bb = p.y + 2;
  for (const e of level.entities) {
    const er = entityRect(e);
    if (!rectOverlap(bl, bt, br - bl, bb - bt, er.l, er.t, er.r - er.l, er.b - er.t)) continue;
    switch (e.type) {
      case 'teleport':
        if (p.invuln > 0) break;
        teleportPlayer(st, p);
        st.events.push({ type: 'teleport', p });
        break;
      case 'checkpoint':
        if (st.checkpointTile !== e.x + ',' + e.y) {
          st.checkpointTile = e.x + ',' + e.y;
          st.checkpoint = { x: p.x, y: p.y };
          for (const o of level.entities) if (o.type === 'checkpoint') o.active = (o === e);
          st.events.push({ type: 'checkpoint', p });
          burst(st, p.x, p.y - 20, '#69f0ae', 14);
        }
        break;
      case 'fakecheckpoint':
        st.events.push({ type: 'fakecheckpoint', p });
        st.shake = Math.max(st.shake, 0.3);
        break;
      case 'fakefinish':
        if (p.invuln > 0) break;
        teleportPlayer(st, p);
        st.events.push({ type: 'fakefinish', p });
        break;
      case 'lever':
        if (!e.used) {
          e.used = true;
          for (const d of level.entities) {
            if (d.type === 'door') { d.open = true; level.solids[d.y * level.w + d.x] = 0; }
          }
          st.events.push({ type: 'dooropen', p });
          burst(st, e.x * TILE + 20, e.y * TILE + 20, '#69f0ae', 12);
        }
        break;
      case 'wronglever':
        killPlayer(st, p, 'wronglever');
        st.events.push({ type: 'wronglever', p });
        break;
      case 'goal':
        if (st.mode === 1) {
          winLevel(st);
        } else {
          const both = st.players.every(q => q.alive &&
            rectOverlap(q.left - 6, q.top - 6, q.w + 12, q.h + 12, er.l - 12, er.t - 12, 64, 64));
          if (both) winLevel(st);
          else if (st.time - st._goalWarned > 2) {
            st._goalWarned = st.time;
            st.events.push({ type: 'waiting', p });
          }
        }
        break;
      default: break;
    }
  }
}

function teleportPlayer(st, p) {
  p.x = st.spawnPos.x; p.y = st.spawnPos.y;
  p.vx = 0; p.vy = 0;
}

function killPlayer(st, p, cause) {
  if (!p.alive || p.invuln > 0) return;
  p.alive = false;
  p.vx = 0; p.vy = 0;
  burst(st, p.x, p.y - 18, '#ff5252', 22);
  st.shake = Math.max(st.shake, 0.45);
  st.deaths++;
  st.events.push({ type: 'death', p, cause });
  if (!st.firstDeathDone) { st.firstDeathDone = true; st.events.push({ type: 'firstdeath', p }); }
  if (st.mode === 2) {
    // SHARED FATE: one player's mistake kills BOTH 😈
    for (const q of st.players) {
      if (q !== p && q.alive) {
        q.alive = false; q.vx = 0; q.vy = 0;
        burst(st, q.x, q.y - 18, '#ff5252', 22);
      }
    }
    st.events.push({ type: 'bothdie', p });
  }
  st.respawnIn = 0.7;
  if (st.hardcore) {
    // 💀 HARDCORE: one life. The run ends NOW.
    st.runOver = true;
    st.events.push({ type: 'runover', p, cause });
  }
}

function respawnAll(st) {
  st.respawnIn = 0;
  for (const p of st.players) {
    p.alive = true;
    p.x = st.checkpoint.x; p.y = st.checkpoint.y;
    p.vx = 0; p.vy = 0;
    p.invuln = 1.0;
    p.onMover = null;
  }
  st.events.push({ type: 'respawn' });
}

function winLevel(st) {
  if (st.complete) return;
  st.complete = true;
  st.goalFlash = 1.2;
  st.events.push({ type: 'win' });
  burst(st, st.players[0].x, st.players[0].y - 30, '#ffe082', 40);
}

function triggerShift(st) {
  const level = st.level;
  if (level.shiftDone || !level.shift) return;
  level.shiftDone = true;
  const s = level.shift;
  for (const t of s.add) {
    level.solids[t.y * level.w + t.x] = 1;
    burst(st, t.x * TILE + 20, t.y * TILE + 20, '#ffb74d', 10);
  }
  for (const t of s.remove) {
    level.solids[t.y * level.w + t.x] = 0;
    burst(st, t.x * TILE + 20, t.y * TILE + 20, '#8d6e63', 10);
  }
  for (const t of s.spike) level.hazards[t.y * level.w + t.x] = 1;
  st.shake = Math.max(st.shake, 0.8);
  st.events.push({ type: 'shift' });
}

/* ---------- crumble / coward floors ---------- */
function updateCrumble(st, dt) {
  const level = st.level;
  const mul = st.rageMul || 1; // 😈 rage mode: traps get faster
  for (const entry of level.crumble) {
    const i = entry[0], c = entry[1];
    const x = i % level.w, y = (i / level.w) | 0;
    const standing = st.players.some(p => p.alive && p.onGround && p.standTile &&
      p.standTile.x === x && p.standTile.y === y);
    if (c.state === 'solid') {
      if (standing) { c.state = 'warn'; c.t = 0; }
    } else if (c.state === 'warn') {
      if (standing) {
        c.t += dt;
        if (c.t > 0.6 * mul) {
          c.state = 'gone';
          level.solids[i] = 0;
          burst(st, x * TILE + 20, y * TILE, '#8d6e63', 12);
          st.events.push({ type: 'crumble', x, y });
        }
      } else { c.state = 'solid'; c.t = 0; }
    }
  }
  for (const entry of level.coward) {
    const i = entry[0], c = entry[1];
    const x = i % level.w, y = (i / level.w) | 0;
    const standing = st.players.some(p => p.alive && p.onGround && p.standTile &&
      p.standTile.x === x && p.standTile.y === y);
    if (c.state === 'solid') {
      if (standing) c.state = 'warn';
    } else if (c.state === 'warn') {
      if (!standing) {
        c.t += dt;
        if (c.t > 0.25 * mul) {
          c.state = 'gone';
          level.solids[i] = 0;
          burst(st, x * TILE + 20, y * TILE, '#8d6e63', 12);
        }
      } else c.t = 0;
    }
  }
  for (const entry of level.invis) {
    if (entry[1].t > 0) entry[1].t = Math.max(0, entry[1].t - dt);
  }
}

/* ---------- entities ---------- */
function updateEntities(st, dt) {
  const level = st.level;
  for (const e of level.entities) {
    if (e.type === 'mover') {
      const ax = e.x * TILE, ay = e.y * TILE, bx = e.x2 * TILE, by = e.y2 * TILE;
      const len = Math.hypot(bx - ax, by - ay) || 1;
      e.t += e.dir * e.speed * dt / len;
      if (e.t >= 1) { e.t = 1; e.dir = -1; }
      else if (e.t <= 0) { e.t = 0; e.dir = 1; }
      const k = e.t * e.t * (3 - 2 * e.t); // smoothstep
      const tx = ax + (bx - ax) * k, ty = ay + (by - ay) * k;
      e.vx = (tx - e.px) / dt;
      e.px = tx; e.py = ty;
    } else if (e.type === 'crusher') {
      const top = e.y * TILE;
      const bottomLimit = top + TILE + e.drop;
      if (e.state === 'idle') {
        const zl = (e.x - 1) * TILE, zr = (e.x + 2) * TILE;
        const zt = top + TILE, zb = bottomLimit + TILE;
        const trig = st.players.some(p => p.alive &&
          rectOverlap(p.left, p.top, p.w, p.h, zl, zt, zr - zl, zb - zt));
        if (trig) { e.state = 'warn'; e.t = 0; }
      } else if (e.state === 'warn') {
        e.t += dt;
        if (e.t > 0.12) e.state = 'drop';
      } else if (e.state === 'drop') {
        e.py += 2200 * dt;
        if (e.py + TILE >= bottomLimit) {
          e.py = bottomLimit - TILE;
          e.state = 'wait'; e.t = 0;
          st.shake = Math.max(st.shake, 0.35);
        }
      } else if (e.state === 'wait') {
        e.t += dt;
        if (e.t > 0.35) e.state = 'rise';
      } else if (e.state === 'rise') {
        e.py -= 500 * dt;
        if (e.py <= top) { e.py = top; e.state = 'idle'; }
      }
    } else if (e.type === 'spawner') {
      if (e.warn > 0) {
        e.warn -= dt;
        if (e.warn <= 0 && st.rocks.length < 8) {
          st.rocks.push({ x: e.x * TILE + TILE / 2, y: (e.y + 1) * TILE + 10, w: 30, h: 30, vy: 0, life: 6 });
        }
      } else {
        e.timer -= dt;
        if (e.timer <= 0) e.warn = 0.5;
      }
    } else if (e.type === 'door' && e.open && e.openT < 1) {
      e.openT = Math.min(1, e.openT + dt * 3);
    }
  }
  // rocks
  for (let i = st.rocks.length - 1; i >= 0; i--) {
    const r = st.rocks[i];
    r.vy = Math.min(r.vy + GRAV * dt, MAX_FALL);
    r.y += r.vy * dt;
    r.life -= dt;
    const cx = Math.floor(r.x / TILE), cy = Math.floor(r.y / TILE);
    if (r.life <= 0 || level.solidAt(cx, cy) || r.y > level.h * TILE + 100) {
      breakRock(st, r);
      st.rocks.splice(i, 1);
    }
  }
}

function breakRock(st, rock) {
  burst(st, rock.x, rock.y, '#8d6e63', 10, 120);
  st.shake = Math.max(st.shake, 0.15);
  st.events.push({ type: 'rockbreak' });
}

/* ---------- 👹 THE DEVIL (boss) — rolls along the arena floor ----------
   The TELL: he is huge, he is right there, and he ROARS + shakes
   before every direction change. Hide on platforms or jump over him. */
function updateBoss(st, dt) {
  const b = st.boss;
  b.t += dt;
  if (b.pause > 0) {
    b.pause -= dt;
  } else {
    b.x += b.vx * b.dir * dt;
    const maxX = st.level.w * TILE - b.w;
    if (b.x <= 0) {
      b.x = 0; b.dir = 1; b.pause = 0.6;
      st.shake = Math.max(st.shake, 0.5);
      st.events.push({ type: 'bossroar' });
    } else if (b.x >= maxX) {
      b.x = maxX; b.dir = -1; b.pause = 0.6;
      st.shake = Math.max(st.shake, 0.5);
      st.events.push({ type: 'bossroar' });
    }
  }
}

/* ---------- camera / particles / bounds ---------- */
function updateCamera(st, dt) {
  const alive = st.players.filter(p => p.alive);
  const targets = alive.length ? alive : st.players;
  let tx = 0, ty = 0;
  for (const p of targets) { tx += p.x; ty += p.y; }
  tx /= targets.length; ty /= targets.length;
  let zoom = 1;
  if (st.mode === 2 && st.players.length === 2) {
    const a = st.players[0], b = st.players[1];
    const spanX = Math.abs(a.x - b.x) + 260;
    const spanY = Math.abs(a.y - b.y) + 200;
    zoom = Math.max(0.4, Math.min(1, st.vw / spanX, st.vh / spanY));
  }
  const k = Math.min(1, dt * 6);
  st.camera.zoom += (zoom - st.camera.zoom) * k;
  st.camera.x += (tx - st.camera.x) * k;
  st.camera.y += (ty - 100 - st.camera.y) * k;
  const level = st.level;
  const viewW = st.vw / st.camera.zoom, viewH = st.vh / st.camera.zoom;
  const lvlW = level.w * TILE, lvlH = level.h * TILE;
  if (viewW >= lvlW) st.camera.x = lvlW / 2;
  else st.camera.x = Math.min(Math.max(st.camera.x, viewW / 2), lvlW - viewW / 2);
  if (viewH >= lvlH) st.camera.y = lvlH / 2;
  else st.camera.y = Math.min(Math.max(st.camera.y, viewH / 2), lvlH - viewH / 2);
}

function updateParticles(st, dt) {
  for (let i = st.particles.length - 1; i >= 0; i--) {
    const pt = st.particles[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 500 * dt;
    pt.life -= dt;
    if (pt.life <= 0) st.particles.splice(i, 1);
  }
}

function checkLevelBounds(st) {
  for (const p of st.players) {
    if (p.alive && p.y > st.level.h * TILE + 240) killPlayer(st, p, 'fall');
  }
}

/* ---------- exports ---------- */
const TD = {
  TILE, GRAV, JUMP_V, MOVE_MAX, PLAYER_W, PLAYER_H,
  parseLevel, createState, update, Player, burst, rectOverlap
};
global.TD = TD;
if (typeof module !== 'undefined' && module.exports) module.exports = TD;
})(typeof window !== 'undefined' ? window : globalThis);
