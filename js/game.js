/* ============================================================
   TRAP DEVIL: RAGE EDITION — game.js
   Rendering (Canvas), DOM menus, HUD, toasts, save system, loop.
   Browser only. Logic lives in engine.js, levels in levels.js.
   ============================================================ */
(() => {
'use strict';

const { TILE, createState, update, burst, rectOverlap } = window.TD;
const LEVELS = window.LEVEL_DEFS;
const AudioFX = window.AudioFX;
const mulberry32 = window.mulberry32;
const TOTAL = LEVELS.length; // 120

/* ---------- the rage curve (from the design doc) ---------- */
const RAGE_CURVE = [
  { upto: 20, emoji: '😐', label: 'Easy hai' },
  { upto: 40, emoji: '😤', label: 'Ye trap kahan se aaya?' },
  { upto: 60, emoji: '😡', label: 'Bhai ye unfair hai!' },
  { upto: 80, emoji: '🤬', label: 'MAIN GAME DELETE KAR RAHA HOON' },
  { upto: 100, emoji: '💀', label: 'Bas ek aur try…' },
  { upto: Infinity, emoji: '☠️', label: 'Welcome to Hell' }
];
function rageTag(i) { // i is 0-based
  const n = i + 1;
  for (const r of RAGE_CURVE) if (n <= r.upto) return r.emoji + ' ' + r.label;
  return '☠️ Welcome to Hell';
}

const DEATH_MSGS = [
  '💀 Bhai, mar gaya tu. Phir se try kar.',
  '😈 The level hates you. Personally.',
  '💀 Skill issue? Trap issue? Yes.',
  '😤 "Ye unfair hai!" — bro, that is the USP.',
  '💀 git gud. (Hint bhi hai, press H.)',
  '😈 Trap Devil says hi.',
  '🤬 "MAIN GAME DELETE KAR RAHA HOON" — noted. Recorded. Mocked.',
  '💀 Another one for the rage counter.',
  '😂 You just walked into a door. A DOOR.',
  '💀 The floor was lava. The floor was ALWAYS lava.'
];

/* ---------- DOM ---------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const hudLevel = document.getElementById('hud-level');
const hudDeaths = document.getElementById('hud-deaths');
const hudTime = document.getElementById('hud-time');
const hudMode = document.getElementById('hud-mode');
const hudStatus = document.getElementById('hud-status');
const hudHint = document.getElementById('hud-hint');
const rageFill = document.getElementById('rage-fill');
const rageLabel = document.getElementById('rage-label');
const elToast = document.getElementById('toast');
const screens = {};
for (const id of ['menu', 'select', 'pause', 'fakepause', 'complete', 'win', 'howto']) {
  screens[id] = document.getElementById('screen-' + id);
}
const levelGrid = document.getElementById('level-grid');
const soundBtns = document.querySelectorAll('.sound-toggle');

/* ---------- persistent save ---------- */
const SAVE_KEY = 'trapdevil_rage_v1';
function freshSave() {
  return { unlocked: 1, deaths: {}, best: {}, completed: {}, totalDeaths: 0, totalTime: 0, levelsCompleted: 0, muted: false, traps: [] };
}
let save = freshSave();
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) save = Object.assign(freshSave(), JSON.parse(raw));
} catch (e) { /* corrupt save = fresh start, like the game intends */ }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } }
AudioFX.enabled = !save.muted;

/* ---------- runtime state ---------- */
let st = null;
let mode = 1;
let currentLevel = 0;
let screen = 'menu';
let keys = {};
let prevJump = [false, false];
let escHeld = false;
let escHoldStart = 0;
let toastQueue = [];
let toastDirty = false;
let menuParts = [];
let starCache = null;
let lastTime = performance.now();
let acc = 0;
const STEP = 1 / 120;
let dpr = 1;

/* ---------- sizing ---------- */
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
}
window.addEventListener('resize', resize);
resize();

/* ---------- input ---------- */
const P1_KEYS = { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW', 'Space'] };
const P2_KEYS = { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'] };

function buildInputs() {
  const out = [];
  const maps = [P1_KEYS, P2_KEYS];
  const count = st && st.mode === 2 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const m = maps[i];
    const jumpDown = m.jump.some(k => keys[k]);
    out.push({
      left: m.left.some(k => keys[k]),
      right: m.right.some(k => keys[k]),
      jump: jumpDown,
      jumpPressed: jumpDown && !prevJump[i]
    });
    prevJump[i] = jumpDown;
  }
  return out;
}

window.addEventListener('keydown', e => {
  if (!keys[e.code]) {
    keys[e.code] = true;
    AudioFX.init();
    onKeyPress(e.code);
  }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) !== -1) e.preventDefault();
});
window.addEventListener('keyup', e => {
  if (keys[e.code]) { keys[e.code] = false; onKeyRelease(e.code); }
});

function onKeyPress(code) {
  if (code === 'Escape') {
    if (screen === 'play') { escHeld = true; escHoldStart = performance.now(); }
    else if (screen === 'pause') resumeGame();
    else if (screen === 'fakepause') closeFakePause(false);
    else if (screen === 'select' || screen === 'howto') showScreen('menu');
  } else if (code === 'Backquote') {
    if (screen === 'play') openPause();
    else if (screen === 'pause') resumeGame();
  } else if (screen === 'play') {
    if (code === 'KeyH') showHint();
    else if (code === 'KeyR') startLevel(currentLevel, mode);
    else if (code === 'KeyM') toggleSound();
  }
}
function onKeyRelease(code) {
  if (code === 'Escape' && screen === 'play' && escHeld) {
    const held = performance.now() - escHoldStart;
    escHeld = false;
    if (held < 450) openFakePause(); // 😈 tap = fake pause
  }
}

/* ---------- screens ---------- */
function showScreen(name) {
  for (const k in screens) screens[k].classList.toggle('hidden', k !== name);
  screen = name;
  hud.classList.toggle('hidden', name !== 'play' && name !== 'pause' && name !== 'fakepause' && name !== 'complete');
}
function hideAllScreens() { for (const k in screens) screens[k].classList.add('hidden'); }

function startLevel(i, m) {
  mode = m || 1;
  currentLevel = i;
  st = createState(LEVELS[i], i, mode);
  st.vw = canvas.clientWidth; st.vh = canvas.clientHeight;
  hudHint.classList.remove('show');
  starCache = null;
  AudioFX.init();
  AudioFX.startMusic();
  hideAllScreens();
  showScreen('play');
}
function quitToMenu() {
  st = null;
  hideAllScreens();
  showScreen('menu');
}
function openPause() {
  if (screen !== 'play') return;
  buildTrapedia();
  showScreen('pause');
}
function resumeGame() { if (screen === 'pause') showScreen('play'); }
function openFakePause() {
  if (screen !== 'play') return;
  AudioFX.trollLaugh();
  showScreen('fakepause');
  toast('😈 Nice try. There is no pause. (HOLD ESC for the real one.)', 'troll');
  persist();
}
function closeFakePause(resumed) {
  if (screen !== 'fakepause') return;
  showScreen('play');
  if (resumed) toast('😈 Told you. No pause for you.', 'troll');
}

/* ---------- level select ---------- */
function buildLevelGrid() {
  levelGrid.innerHTML = '';
  for (let i = 0; i < TOTAL; i++) {
    const b = document.createElement('button');
    b.className = 'lvl-btn';
    b.textContent = (i + 1);
    b.title = LEVELS[i].name + '\n' + rageTag(i);
    if (i >= save.unlocked) {
      b.classList.add('locked');
      b.textContent = '🔒';
      b.disabled = true;
    } else if (save.completed[i] !== undefined) {
      b.classList.add('done');
      b.textContent = '😈';
      const d = save.deaths[i] || 0;
      if (d > 0) { const s = document.createElement('span'); s.className = 'lvl-deaths'; s.textContent = d; b.appendChild(s); }
      b.onclick = () => startLevel(i, mode);
    } else {
      b.onclick = () => startLevel(i, mode);
    }
    levelGrid.appendChild(b);
  }
}
buildLevelGrid();
document.querySelectorAll('.mode-pick').forEach(b => {
  b.onclick = () => {
    mode = parseInt(b.dataset.mode, 10);
    document.querySelectorAll('.mode-pick').forEach(x => x.classList.toggle('active', x === b));
  };
});

/* ---------- toasts ---------- */
function toast(text, kind) {
  toastQueue.push({ text, kind: kind || 'info', t: 3.4 });
  if (toastQueue.length > 3) toastQueue.shift();
  toastDirty = true;
}
function renderToasts() {
  elToast.innerHTML = toastQueue.map(t => '<div class="toast ' + t.kind + '">' + t.text + '</div>').join('');
}

/* ---------- hints & trollpedia ---------- */
function showHint() {
  if (!st || screen !== 'play') return;
  hudHint.textContent = '💡 HINT: ' + st.level.hint;
  hudHint.classList.add('show');
  const traps = window.inferTrapList(LEVELS[currentLevel]);
  for (const t of traps) if (save.traps.indexOf(t) === -1) save.traps.push(t);
  persist();
}
function buildTrapedia() {
  const el = document.getElementById('trollpedia');
  const known = save.traps;
  const all = ['Spikes', 'Crumbling Floor', 'Coward Floor', 'Fake Platform', 'Invisible Wall', 'Reverse Zone',
    'Camera Flip', 'Layout Shift', 'Teleport Pad', 'Checkpoint', 'Fake Checkpoint', 'Fake Finish',
    'Lever', 'Wrong Lever', 'Door', 'Killer Door', 'Rock Spawner', 'Crusher', 'Moving Platform'];
  el.innerHTML = all.map(t => {
    const knownTrap = known.indexOf(t) !== -1;
    return '<div class="trapedia-row ' + (knownTrap ? 'known' : 'unknown') + '">' +
      '<span>' + (knownTrap ? '😈' : '❓') + '</span><span>' + t + (knownTrap ? '' : ' — not yet discovered') + '</span></div>';
  }).join('');
}

/* ---------- sound ---------- */
function toggleSound() {
  const on = AudioFX.toggleMute();
  save.muted = !on;
  persist();
  updateSoundBtns();
  toast(on ? '🔊 Sound ON' : '🔇 Sound OFF', 'info');
}
function updateSoundBtns() {
  soundBtns.forEach(b => { b.textContent = AudioFX.enabled ? '🔊 SOUND: ON' : '🔇 SOUND: OFF'; });
}
updateSoundBtns();

/* ---------- main loop ---------- */
function frame(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  dt = Math.min(dt, 0.05);
  acc += dt;
  while (acc >= STEP) { tick(STEP); acc -= STEP; }
  render();
  requestAnimationFrame(frame);
}

function tick(dt) {
  if (screen === 'play' && st) {
    if (escHeld && performance.now() - escHoldStart > 800) {
      escHeld = false; keys['Escape'] = false;
      openPause();
      return;
    }
    st.vw = canvas.clientWidth; st.vh = canvas.clientHeight;
    update(st, dt, buildInputs());
    drainEvents();
    updateHUD();
    if (st.complete) onLevelComplete();
  }
  // toasts
  for (const t of toastQueue) t.t -= dt;
  while (toastQueue.length && toastQueue[0].t <= 0) { toastQueue.shift(); toastDirty = true; }
  if (toastDirty) { renderToasts(); toastDirty = false; }
}

function drainEvents() {
  for (const ev of st.events) {
    switch (ev.type) {
      case 'death': {
        AudioFX.death();
        save.totalDeaths++;
        save.deaths[currentLevel] = (save.deaths[currentLevel] || 0) + 1;
        persist();
        toast(DEATH_MSGS[save.totalDeaths % DEATH_MSGS.length], 'death');
        break;
      }
      case 'bothdie':
        toast('💀 PLAYER DIED → BOTH PLAYERS RESTART. Shared fate. 😈', 'death');
        break;
      case 'firstdeath':
        showHint();
        break;
      case 'checkpoint':
        AudioFX.checkpoint();
        toast('💾 Checkpoint saved… probably.', 'ok');
        break;
      case 'fakecheckpoint':
        AudioFX.fakeCheckpoint();
        toast('😈 FAKE CHECKPOINT. No save. No mercy.', 'troll');
        break;
      case 'teleport':
        AudioFX.trollLaugh();
        toast('😈 Teleported! …backwards.', 'troll');
        break;
      case 'fakefinish':
        AudioFX.trollLaugh();
        toast('😈 Fake finish. Nice try, champ.', 'troll');
        break;
      case 'dooropen':
        AudioFX.checkpoint();
        toast('🔓 Door opened. You are welcome.', 'ok');
        break;
      case 'wronglever':
        AudioFX.death();
        AudioFX.trollLaugh();
        toast('💀 WRONG LEVER. Rest in pieces.', 'death');
        break;
      case 'shift':
        AudioFX.noise(0.3, 0.2, 400);
        toast('🌍 The level just changed. You are welcome.', 'troll');
        break;
      case 'camera':
        AudioFX.click();
        toast('📷 Camera flipped. Your brain will adapt. (It will not.)', 'troll');
        break;
      case 'waiting':
        toast('👥 Both players on the flag. BOTH. Of. You.', 'info');
        break;
      case 'win': AudioFX.win(); break;
      case 'jump': AudioFX.jump(); break;
      case 'land': AudioFX.land(); break;
      case 'crumble': AudioFX.noise(0.15, 0.1, 800); break;
      case 'rockbreak': AudioFX.noise(0.12, 0.08, 700); break;
      default: break;
    }
  }
  st.events.length = 0;
}

/* ---------- HUD ---------- */
function fmtTime(s) {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return m + ':' + (ss < 10 ? '0' : '') + ss;
}
function updateHUD() {
  hudLevel.textContent = rageTag(currentLevel) + '  ·  Lvl ' + (currentLevel + 1) + '/' + TOTAL + ' — ' + st.level.name;
  hudDeaths.textContent = '💀 ' + st.deaths;
  hudTime.textContent = '⏱ ' + fmtTime(st.time);
  hudMode.textContent = st.mode === 2 ? '👥 2P · SHARED FATE' : '😤 1P';
  const rage = Math.min(1, st.deaths / 8);
  rageFill.style.width = (rage * 100) + '%';
  rageLabel.textContent = rage >= 1 ? 'RAGE MODE 😤' : (rage > 0.5 ? 'tilting…' : '');
  let status = '';
  if (st.cameraFlip > 0) status += '📷 ';
  if (st.players.some(p => p.inverted)) status += '⇄ ';
  hudStatus.textContent = status;
}

/* ---------- level complete / win ---------- */
function onLevelComplete() {
  if (screen !== 'play') return;
  const t = st.time;
  const deaths = st.deaths;
  const prevBest = save.best[currentLevel];
  const isBest = prevBest === undefined || t < prevBest;
  if (isBest) save.best[currentLevel] = t;
  save.completed[currentLevel] = t;
  save.levelsCompleted = (save.levelsCompleted || 0) + 1;
  save.totalTime = (save.totalTime || 0) + t;
  if (currentLevel + 2 > save.unlocked && currentLevel + 1 < TOTAL) save.unlocked = currentLevel + 2;
  persist();
  if (currentLevel === TOTAL - 1) {
    showWinScreen();
    return;
  }
  document.getElementById('complete-title').textContent = 'LEVEL COMPLETE 😈';
  document.getElementById('complete-stats').innerHTML =
    '<b>' + st.level.name + '</b><br>' +
    'Deaths this level: 💀 ' + deaths + '<br>' +
    'Time: ⏱ ' + fmtTime(t) + (isBest ? '  (new best! 🏆)' : '  (best: ' + fmtTime(prevBest) + ')');
  showScreen('complete');
}
function showWinScreen() {
  document.getElementById('win-stats').innerHTML =
    'Levels survived: 😈 ' + TOTAL + '<br>' +
    'Total deaths: 💀 ' + save.totalDeaths + '<br>' +
    'Total time: ⏱ ' + fmtTime(save.totalTime) + '<br>' +
    'You are now legally allowed to uninstall. 😈';
  showScreen('win');
}

/* ---------- menu wiring ---------- */
document.getElementById('btn-1p').onclick = () => { AudioFX.init(); startLevel(Math.min(save.unlocked - 1, TOTAL - 1), 1); };
document.getElementById('btn-2p').onclick = () => { AudioFX.init(); startLevel(Math.min(save.unlocked - 1, TOTAL - 1), 2); };
document.getElementById('btn-select').onclick = () => { buildLevelGrid(); showScreen('select'); };
document.getElementById('btn-howto').onclick = () => showScreen('howto');
document.getElementById('btn-menu-from-select').onclick = () => showScreen('menu');
document.getElementById('btn-menu-from-howto').onclick = () => showScreen('menu');
document.getElementById('btn-resume').onclick = () => resumeGame();
document.getElementById('btn-restart').onclick = () => startLevel(currentLevel, mode);
document.getElementById('btn-quit').onclick = () => quitToMenu();
document.getElementById('btn-fake-resume').onclick = () => closeFakePause(true);
document.getElementById('btn-fake-quit').onclick = () => { quitToMenu(); toast('😂 Quitter. (It worked, though.)', 'troll'); };
document.getElementById('btn-next').onclick = () => startLevel(currentLevel + 1, mode);
document.getElementById('btn-retry').onclick = () => startLevel(currentLevel, mode);
document.getElementById('btn-complete-menu').onclick = () => quitToMenu();
document.getElementById('btn-play-again').onclick = () => startLevel(0, mode);
document.getElementById('btn-win-menu').onclick = () => quitToMenu();
soundBtns.forEach(b => { b.onclick = toggleSound; });

/* ============================================================
   RENDERING
   ============================================================ */
function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const vw = canvas.clientWidth, vh = canvas.clientHeight;
  const grad = ctx.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, '#16060f');
  grad.addColorStop(1, '#33101d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);

  if (st) {
    const cam = st.camera;
    const shakeX = (Math.random() - 0.5) * st.shake * 24;
    const shakeY = (Math.random() - 0.5) * st.shake * 24;
    ctx.save();
    ctx.translate(vw / 2 + shakeX, vh / 2 + shakeY);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    if (st.cameraFlip > 0) ctx.rotate(Math.PI);
    drawWorld();
    ctx.restore();
    drawVignette(vw, vh);
  } else {
    drawMenuBackdrop(vw, vh);
  }
}

function getStars() {
  if (!starCache || starCache.i !== currentLevel) {
    const rng = mulberry32(currentLevel * 31 + 7);
    const arr = [];
    const w = st ? st.level.w * TILE : 2000;
    for (let k = 0; k < 90; k++) {
      arr.push({ x: rng() * w, y: rng() * 240, s: 1 + rng() * 2, p: rng() * 6.28 });
    }
    starCache = { i: currentLevel, arr };
  }
  return starCache.arr;
}

function drawWorld() {
  const level = st.level;
  const cam = st.camera;
  const vw = canvas.clientWidth / cam.zoom, vh = canvas.clientHeight / cam.zoom;
  const x0 = Math.floor((cam.x - vw / 2) / TILE) - 1, x1 = Math.ceil((cam.x + vw / 2) / TILE) + 1;
  const y0 = Math.floor((cam.y - vh / 2) / TILE) - 1, y1 = Math.ceil((cam.y + vh / 2) / TILE) + 1;

  // stars (world space, behind everything)
  ctx.fillStyle = '#ff8a80';
  for (const s of getStars()) {
    ctx.globalAlpha = 0.35 + 0.55 * Math.abs(Math.sin(st.time * 2 + s.p));
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) drawTile(level, x, y);
  }
  for (const z of level.zones) drawZone(z);
  for (const e of level.entities) drawEntity(e);
  for (const r of st.rocks) drawRock(r);
  for (const p of st.players) if (p.alive) drawPlayer(p);
  for (const pt of st.particles) drawParticle(pt);
}

function drawVignette(vw, vh) {
  const rage = st ? Math.min(1, st.deaths / 8) : 0;
  const g = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.35, vw / 2, vh / 2, vh * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(60,0,10,' + (0.25 + rage * 0.35).toFixed(3) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
}

function drawMenuBackdrop(vw, vh) {
  if (menuParts.length < 40) {
    menuParts.push({ x: Math.random() * vw, y: Math.random() * vh, vy: 10 + Math.random() * 22, s: 1 + Math.random() * 2 });
  }
  ctx.fillStyle = 'rgba(255,80,80,0.22)';
  for (const p of menuParts) {
    p.y += p.vy * 0.016;
    if (p.y > vh) { p.y = -5; p.x = Math.random() * vw; }
    ctx.fillRect(p.x, p.y, p.s, p.s);
  }
}

/* ---------- tiles ---------- */
function drawTile(level, x, y) {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return;
  const ch = level.def.map[y][x];
  if (ch === '.') return;
  const px = x * TILE, py = y * TILE;
  const i = y * level.w + x;
  ctx.save();
  const c = level.crumble.get(i);
  if (c && c.state === 'warn') ctx.translate(Math.sin(st.time * 40) * 1.5, Math.sin(st.time * 37) * 1.2);
  const cw = level.coward.get(i);
  if (cw && cw.state === 'warn') ctx.translate(Math.sin(st.time * 30) * 1, 0);
  switch (ch) {
    case '#': drawStone(px, py, false); break;
    case '=': drawStone(px, py, true); break;
    case '^': drawOneWay(px, py); break;
    case 'H': drawSpikes(px, py, 'up'); break;
    case 'V': drawSpikes(px, py, 'down'); break;
    case 'D':
      drawStone(px, py, false);
      drawCracks(px, py, c && c.state === 'warn' ? 1 : 0.4);
      break;
    case 'A':
      drawStone(px, py, false);
      drawCracks(px, py, cw && cw.state === 'warn' ? 0.9 : 0.25);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '13px monospace';
      ctx.fillText('?', px + 27, py + 15);
      break;
    case 'f':
      ctx.globalAlpha = 0.5;
      drawStone(px, py, false);
      ctx.globalAlpha = 1;
      dashedRect(px + 2, py + 2, TILE - 4, TILE - 4, '#ffecb3');
      break;
    case 'I': {
      const f = level.invis.get(i);
      if (f && f.t > 0) {
        ctx.fillStyle = 'rgba(200,220,255,' + (0.25 + f.t * 0.4).toFixed(3) + ')';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(200,220,255,0.55)';
        ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
      }
      break;
    }
    default: break; // zones & entities drawn separately
  }
  ctx.restore();
}

function drawStone(px, py, metal) {
  ctx.fillStyle = metal ? '#4a5568' : '#33383f';
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = metal ? '#5a6a80' : '#454c58';
  ctx.fillRect(px, py, TILE, 6);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
  if (metal) {
    ctx.fillStyle = '#2f3947';
    [[6, 6], [34, 6], [6, 34], [34, 34]].forEach(o => {
      ctx.beginPath(); ctx.arc(px + o[0], py + o[1], 2, 0, 7); ctx.fill();
    });
  }
}

function drawSpikes(px, py, dir) {
  ctx.fillStyle = '#1c1f26';
  ctx.fillRect(px, py, TILE, TILE);
  const n = 4, w = TILE / n;
  for (let k = 0; k < n; k++) {
    const x0 = px + k * w;
    ctx.fillStyle = '#c62828';
    ctx.beginPath();
    if (dir === 'up') { ctx.moveTo(x0, py + TILE); ctx.lineTo(x0 + w / 2, py + 6); ctx.lineTo(x0 + w, py + TILE); }
    else { ctx.moveTo(x0, py); ctx.lineTo(x0 + w / 2, py + TILE - 6); ctx.lineTo(x0 + w, py); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ef5350';
    ctx.beginPath();
    if (dir === 'up') { ctx.moveTo(x0 + 2, py + TILE - 2); ctx.lineTo(x0 + w / 2, py + 11); ctx.lineTo(x0 + w - 2, py + TILE - 2); }
    else { ctx.moveTo(x0 + 2, py + 2); ctx.lineTo(x0 + w / 2, py + TILE - 11); ctx.lineTo(x0 + w - 2, py + 2); }
    ctx.closePath(); ctx.fill();
  }
}

function drawOneWay(px, py) {
  ctx.fillStyle = '#3d5a45';
  ctx.fillRect(px + 2, py + 6, TILE - 4, 9);
  ctx.fillStyle = '#69f0ae';
  ctx.beginPath(); ctx.moveTo(px + 9, py + 4); ctx.lineTo(px + 15, py + 4); ctx.lineTo(px + 12, py - 2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(px + 25, py + 4); ctx.lineTo(px + 31, py + 4); ctx.lineTo(px + 28, py - 2); ctx.closePath(); ctx.fill();
}

function drawCracks(px, py, intensity) {
  ctx.strokeStyle = 'rgba(0,0,0,' + (0.35 + intensity * 0.5).toFixed(3) + ')';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px + 6, py + 8); ctx.lineTo(px + 16, py + 18); ctx.lineTo(px + 12, py + 30);
  ctx.moveTo(px + 30, py + 6); ctx.lineTo(px + 24, py + 20); ctx.lineTo(px + 33, py + 32);
  ctx.stroke();
}

function dashedRect(x, y, w, h, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}

/* ---------- zones ---------- */
function drawZone(z) {
  const px = z.x * TILE, py = z.y * TILE, s = TILE * z.w, t = TILE * z.h;
  const pulse = 0.5 + Math.sin(st.time * 4 + z.x * 2) * 0.2;
  if (z.kind === 'reverse') {
    ctx.fillStyle = 'rgba(156,39,176,' + (0.1 + 0.14 * pulse).toFixed(3) + ')';
    ctx.fillRect(px, py, s, t);
    ctx.strokeStyle = 'rgba(206,147,216,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 8, py + s / 2 - 5); ctx.lineTo(px + s - 8, py + s / 2 - 5);
    ctx.moveTo(px + s - 12, py + s / 2 - 8); ctx.lineTo(px + s - 8, py + s / 2 - 5); ctx.lineTo(px + s - 12, py + s / 2 - 2);
    ctx.moveTo(px + s - 8, py + s / 2 + 5); ctx.lineTo(px + 8, py + s / 2 + 5);
    ctx.moveTo(px + 12, py + s / 2 + 2); ctx.lineTo(px + 8, py + s / 2 + 5); ctx.lineTo(px + 12, py + s / 2 + 8);
    ctx.stroke();
  } else if (z.kind === 'camera') {
    ctx.fillStyle = 'rgba(0,229,255,' + (0.1 + 0.14 * pulse).toFixed(3) + ')';
    ctx.fillRect(px, py, s, t);
    ctx.strokeStyle = 'rgba(128,240,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px + s / 2, py + t / 2, s * 0.28, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(px + s / 2, py + t / 2, s * 0.12, 0, 7); ctx.stroke();
  } else if (z.kind === 'shift') {
    ctx.fillStyle = 'rgba(255,183,77,' + (0.1 + 0.14 * pulse).toFixed(3) + ')';
    ctx.fillRect(px, py, s, t);
    ctx.fillStyle = 'rgba(255,213,128,0.9)';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('?', px + s / 2 - 6, py + t / 2 + 7);
  }
}

/* ---------- entities ---------- */
function drawEntity(e) {
  const px = e.x * TILE, py = e.y * TILE;
  ctx.save();
  switch (e.type) {
    case 'teleport': {
      ctx.fillStyle = '#1a0a20';
      ctx.beginPath(); ctx.ellipse(px + 20, py + 30, 16, 6, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#e040fb';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px + 20, py + 20, 11 + Math.sin(st.time * 4) * 2, st.time * 3, st.time * 3 + 2.2);
      ctx.stroke();
      ctx.fillStyle = '#e040fb';
      ctx.beginPath(); ctx.arc(px + 20, py + 20, 3, 0, 7); ctx.fill();
      break;
    }
    case 'checkpoint': case 'fakecheckpoint': {
      const fake = e.type === 'fakecheckpoint';
      const flicker = fake ? 0.55 + Math.abs(Math.sin(st.time * 12)) * 0.45 : 1;
      ctx.globalAlpha = flicker;
      if (e.active) {
        const g = ctx.createRadialGradient(px + 20, py + 18, 2, px + 20, py + 18, 30);
        g.addColorStop(0, 'rgba(105,240,174,0.5)');
        g.addColorStop(1, 'rgba(105,240,174,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - 6, py - 6, TILE + 12, TILE + 12);
      }
      ctx.strokeStyle = '#cfd8dc';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px + 10, py + 36); ctx.lineTo(px + 10, py + 4); ctx.stroke();
      ctx.fillStyle = fake ? '#ab47bc' : '#69f0ae';
      ctx.beginPath(); ctx.moveTo(px + 10, py + 4); ctx.lineTo(px + 32, py + 11); ctx.lineTo(px + 10, py + 18); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'goal': {
      const glow = 30 + Math.sin(st.time * 4) * 5;
      const g = ctx.createRadialGradient(px + 20, py + 20, 2, px + 20, py + 20, glow + 8);
      g.addColorStop(0, 'rgba(105,240,174,0.85)');
      g.addColorStop(1, 'rgba(105,240,174,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px + 20, py + 20, glow + 8, 0, 7); ctx.fill();
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px + 12, py + 36); ctx.lineTo(px + 12, py + 3); ctx.stroke();
      ctx.fillStyle = '#69f0ae';
      ctx.beginPath(); ctx.moveTo(px + 12, py + 3); ctx.lineTo(px + 35, py + 10); ctx.lineTo(px + 12, py + 17); ctx.closePath(); ctx.fill();
      break;
    }
    case 'fakefinish': {
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = '#9e9e9e';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px + 12, py + 36); ctx.lineTo(px + 12, py + 4); ctx.stroke();
      ctx.fillStyle = '#616161';
      ctx.beginPath(); ctx.moveTo(px + 12, py + 4); ctx.lineTo(px + 33, py + 11); ctx.lineTo(px + 12, py + 18); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'lever': case 'wronglever': {
      const bad = e.type === 'wronglever';
      ctx.fillStyle = '#263238';
      ctx.fillRect(px + 8, py + 26, 24, 10);
      ctx.strokeStyle = '#90a4ae';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px + 20, py + 26); ctx.lineTo(px + 20, py + 8); ctx.stroke();
      const ang = e.used ? 0.7 : -0.5;
      ctx.strokeStyle = bad ? '#ef5350' : '#69f0ae';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(px + 20, py + 8);
      ctx.lineTo(px + 20 + Math.cos(ang) * 14, py + 8 + Math.sin(ang) * 14);
      ctx.stroke();
      ctx.fillStyle = bad ? '#ef5350' : '#69f0ae';
      ctx.beginPath(); ctx.arc(px + 20 + Math.cos(ang) * 14, py + 8 + Math.sin(ang) * 14, 4, 0, 7); ctx.fill();
      break;
    }
    case 'door': {
      const off = (e.openT || 0) * 24;
      ctx.fillStyle = 'rgba(105,240,174,' + (0.15 * (e.openT || 0)).toFixed(3) + ')';
      ctx.fillRect(px + 2, py + 2 - off, TILE - 4, TILE - 4);
      ctx.fillStyle = '#3e2723';
      ctx.fillRect(px + 3, py + 2 - off, TILE - 6, TILE - 6);
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(px + 6, py + 5 - off, TILE - 12, TILE - 12);
      ctx.strokeStyle = '#211412';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px + 20, py + 5 - off); ctx.lineTo(px + 20, py + TILE - 5 - off); ctx.stroke();
      break;
    }
    case 'killerdoor': {
      ctx.fillStyle = '#3e2723';
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
      ctx.strokeStyle = 'rgba(239,83,80,' + (0.5 + Math.abs(Math.sin(st.time * 6)) * 0.5).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = '#ef5350';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(px + 2, py + 8 + k * 12);
        ctx.lineTo(px - 3, py + 12 + k * 12);
        ctx.lineTo(px + 2, py + 16 + k * 12);
        ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'spawner': {
      ctx.fillStyle = '#101318';
      ctx.beginPath(); ctx.ellipse(px + 20, py + 8, 14, 7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,87,34,0.7)';
      ctx.beginPath(); ctx.arc(px + 20, py + 12 + Math.abs(Math.sin(st.time * 5)) * 8, 2.5, 0, 7); ctx.fill();
      // shadow warning on the floor below (the TELL)
      if (e.warn > 0 && e.floorY) {
        ctx.fillStyle = 'rgba(255,87,34,' + (0.25 + e.warn * 0.4).toFixed(3) + ')';
        ctx.beginPath(); ctx.ellipse(px + 20, e.floorY - 4, 14 + (0.5 - e.warn) * 10, 4, 0, 0, 7); ctx.fill();
      }
      break;
    }
    case 'crusher': {
      const t2 = e.py;
      ctx.fillStyle = '#455a64';
      ctx.fillRect(px, t2, TILE, TILE);
      ctx.fillStyle = '#37474f';
      ctx.fillRect(px, t2, TILE, 8);
      ctx.fillStyle = '#ef5350';
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(px + 3 + k * 10, t2 + TILE);
        ctx.lineTo(px + 8 + k * 10, t2 + TILE - 9);
        ctx.lineTo(px + 13 + k * 10, t2 + TILE);
        ctx.closePath(); ctx.fill();
      }
      if (e.state !== 'idle') {
        ctx.fillStyle = 'rgba(239,83,80,0.22)';
        ctx.beginPath();
        ctx.ellipse(px + 20, e.py + TILE + e.drop, 20, 5, 0, 0, 7);
        ctx.fill();
      }
      break;
    }
    case 'mover': {
      const l = e.px, t2 = e.py, w = e.w * TILE, h = e.h * TILE;
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(l, t2, w, h);
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(l, t2, w, 5);
      ctx.fillStyle = '#ffcc80';
      ctx.beginPath();
      ctx.moveTo(l + w / 2 - 10, t2 + h / 2); ctx.lineTo(l + w / 2 - 4, t2 + h / 2 - 4); ctx.lineTo(l + w / 2 - 4, t2 + h / 2 + 4);
      ctx.moveTo(l + w / 2 + 10, t2 + h / 2); ctx.lineTo(l + w / 2 + 4, t2 + h / 2 - 4); ctx.lineTo(l + w / 2 + 4, t2 + h / 2 + 4);
      ctx.fill();
      break;
    }
    default: break;
  }
  ctx.restore();
}

function drawRock(r) {
  ctx.save();
  ctx.fillStyle = '#6d4c41';
  ctx.beginPath(); ctx.arc(r.x, r.y, r.w / 2, 0, 7); ctx.fill();
  ctx.strokeStyle = '#3e2723';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = '#3e2723';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(r.x - 6, r.y - 2); ctx.lineTo(r.x, r.y + 4); ctx.lineTo(r.x + 7, r.y - 3); ctx.stroke();
  ctx.restore();
}

/* ---------- players & particles ---------- */
function drawPlayer(p) {
  const rage = Math.min(1, st.deaths / 8);
  if (p.invuln > 0 && Math.floor(st.time * 20) % 2 === 0) return; // respawn flicker
  ctx.save();
  const x = p.left, y = p.top, w = p.w, h = p.h;
  const outline = p.color === '#4dd0e1' ? '#006064' : '#e65100';
  // body
  ctx.fillStyle = p.color;
  roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  roundRect(x, y, w, h, 6);
  ctx.stroke();
  // eyes
  const look = Math.max(-1.5, Math.min(1.5, p.vx / 200));
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(p.x - 6.5, y + 11, 4.5, 0, 7); ctx.arc(p.x + 6.5, y + 11, 4.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(p.x - 6.5 + look, y + 11.5, 2, 0, 7); ctx.arc(p.x + 6.5 + look, y + 11.5, 2, 0, 7); ctx.fill();
  // mouth: smile → grimace when raging → "o" when inverted
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (p.inverted) { ctx.arc(p.x, y + 23, 3, 0, 7); }
  else if (rage > 0.6) { ctx.moveTo(p.x - 6, y + 21); ctx.lineTo(p.x, y + 24); ctx.lineTo(p.x + 6, y + 21); }
  else { ctx.arc(p.x, y + 21, 5, 0.15 * Math.PI, 0.85 * Math.PI); }
  ctx.stroke();
  // angry brows when raging
  if (rage > 0.6 && !p.inverted) {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - 11, y + 4); ctx.lineTo(p.x - 3, y + 7);
    ctx.moveTo(p.x + 11, y + 4); ctx.lineTo(p.x + 3, y + 7);
    ctx.stroke();
  }
  // feet
  if (p.onGround) {
    ctx.fillStyle = outline;
    ctx.fillRect(p.x - 10, p.y - 4, 8, 4);
    ctx.fillRect(p.x + 2, p.y - 4, 8, 4);
  }
  // inverted indicator
  if (p.inverted) {
    ctx.fillStyle = '#ce93d8';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('⇄', p.x - 5, y - 4);
  }
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawParticle(pt) {
  ctx.globalAlpha = Math.max(0, Math.min(1, pt.life));
  ctx.fillStyle = pt.color;
  ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  ctx.globalAlpha = 1;
}

/* ---------- boot ---------- */
showScreen('menu');
requestAnimationFrame(t => { lastTime = t; requestAnimationFrame(frame); });
})();
