/* ============================================================
   tools/smoke-test.cjs
   Headless physics/gameplay tests — no browser needed.
   Run: npm test
   ============================================================ */
'use strict';
const { LEVEL_DEFS, generateLevelDef } = require('../js/levels.js');
const TD = require('../js/engine.js');
const { createState, update } = TD;

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.error('  ❌ ' + name); }
}
const DT = 1 / 120;
const noInput = [{ left: false, right: false, jump: false, jumpPressed: false }];
const holdRight = () => [{ left: false, right: true, jump: false, jumpPressed: false }];

function run(def, idx, mode, inputsFn, seconds) {
  const st = createState(def, idx, mode);
  let t = 0;
  while (t < seconds) {
    update(st, DT, inputsFn(st, t));
    t += DT;
    if (st.complete) break;
  }
  return st;
}

console.log('🧪 Smoke tests (headless engine)\n');

// 1. Level 1: run right → reach goal
{
  const st = run(LEVEL_DEFS[0], 0, 1, holdRight, 5);
  check('L1 "Tutorial": running right completes the level', st.complete);
}

// 2. Level 2: spikes kill
{
  const st = run(LEVEL_DEFS[1], 1, 1, holdRight, 4);
  check('L2 "First Blood": spikes kill the player', st.deaths >= 1);
}

// 3. Level 2: timed jump clears the spikes → complete
{
  const st = createState(LEVEL_DEFS[1], 1, 1);
  let t = 0, prevJ = false;
  while (t < 8 && !st.complete) {
    const p = st.players[0];
    const jump = p.onGround && p.x > 270 && p.x < 310;
    update(st, DT, [{ left: false, right: true, jump, jumpPressed: jump && !prevJ }]);
    prevJ = jump;
    t += DT;
  }
  check('L2 "First Blood": timed jump clears spikes → complete', st.complete);
}

// 4. Level 4: fake checkpoint does NOT move the respawn point
{
  const st = createState(LEVEL_DEFS[3], 3, 1);
  let t = 0;
  while (t < 1.2) { update(st, DT, holdRight()); t += DT; }
  check('L4 "Trust Issues": fake checkpoint fires', st.events.some(e => e.type === 'fakecheckpoint'));
  check('L4 "Trust Issues": respawn point NOT moved by fake checkpoint', Math.abs(st.checkpoint.x - st.spawnPos.x) < 1);
}

// 5. Level 5: fast run survives crumble floors → complete
{
  const st = run(LEVEL_DEFS[4], 4, 1, holdRight, 6);
  check('L5 "Crumbling Confidence": fast run survives + completes', st.complete);
}

// 6. Level 5: standing still on a crumble floor makes it vanish
{
  const st = createState(LEVEL_DEFS[4], 4, 1);
  let t = 0;
  while (t < 3 && st.players[0].x < 255) { update(st, DT, holdRight()); t += DT; } // walk ONTO the D tile (col 6)
  while (t < 4.5) { update(st, DT, noInput); t += DT; }                              // stand still
  check('L5 "Crumbling Confidence": crumble floor vanishes after 0.6s of standing', !st.level.solidAt(6, 7));
}

// 7. Level 14: teleport pad sends the player back to spawn
{
  const st = run(LEVEL_DEFS[13], 13, 1, holdRight, 4);
  const teleports = st.events.filter(e => e.type === 'teleport').length;
  check('L14 "Teleport Simulator": teleport pad fires repeatedly (' + teleports + 'x)', teleports >= 2);
}

// 8. Level 17: lever opens the door → complete
{
  const st = run(LEVEL_DEFS[16], 16, 1, holdRight, 6);
  check('L17 "Leveraged": lever opens door → complete', st.complete);
}

// 9. Level 18: wrong lever kills
{
  const st = run(LEVEL_DEFS[17], 17, 1, holdRight, 3);
  check('L18 "Wrong Lever": wrong lever kills the player', st.deaths >= 1);
}

// 10. Level 12: crusher kills
{
  const st = run(LEVEL_DEFS[11], 11, 1, holdRight, 10);
  check('L12 "Crusher Room": crusher kills the player', st.deaths >= 1);
}

// 11. Level 19: layout shift triggers
{
  const st = run(LEVEL_DEFS[18], 18, 1, holdRight, 6);
  check('L19 "The Great Shift": layout shift triggers', st.events.some(e => e.type === 'shift'));
}

// 12. Jump physics: player actually leaves the ground
{
  const st = createState(LEVEL_DEFS[0], 0, 1);
  let t = 0, minY = 1e9;
  while (t < 1.2) {
    const jump = Math.abs(t - 0.5) < DT / 2;
    update(st, DT, [{ left: false, right: true, jump, jumpPressed: jump }]);
    minY = Math.min(minY, st.players[0].y);
    t += DT;
  }
  check('physics: jump lifts the player off the ground', minY < 7 * 40 - 30);
}

// 13. 2P: both players reach the goal → complete
{
  const st = run(LEVEL_DEFS[0], 0, 2, () => [holdRight()[0], holdRight()[0]], 5);
  check('2P: both players reach goal → complete', st.complete);
}

// 14. 2P shared fate: one death kills both
{
  const st = run(LEVEL_DEFS[1], 1, 2, () => [holdRight()[0], holdRight()[0]], 4);
  check('2P: shared fate — one death kills both players', st.events.some(e => e.type === 'bothdie'));
}

// 15. 2P: both players must be on the goal (waiting event fires when only one is there)
{
  const st = createState(LEVEL_DEFS[0], 0, 2);
  let t = 0;
  while (t < 5 && !st.complete) {
    // P1 runs to the goal, P2 stays home
    update(st, DT, [holdRight()[0], { left: false, right: false, jump: false, jumpPressed: false }]);
    t += DT;
  }
  check('2P: goal requires BOTH players ("waiting" event)', st.events.some(e => e.type === 'waiting') && !st.complete);
}

// ---------- RAGE EDITION 2.0 tests ----------
const idle = () => noInput;
const holdLeft = () => [{ left: true, right: false, jump: false, jumpPressed: false }];

// 16. L121: laser kills only while ON
{
  const st = createState(LEVEL_DEFS[120], 120, 1);
  const p = st.players[0];
  p.x = 9 * 40 + 20; p.y = 360; p.vx = 0; p.vy = 0; // inside laser tile (9,8)
  st.laserOn = true;
  update(st, DT, noInput);
  check('L121 laser: kills the player while ON', st.deaths === 1 && st.events.some(e => e.type === 'death' && e.cause === 'laser'));
}
{
  const st = createState(LEVEL_DEFS[120], 120, 1);
  const p = st.players[0];
  p.x = 9 * 40 + 20; p.y = 360; p.vx = 0; p.vy = 0;
  st.laserOn = false;
  update(st, DT, noInput);
  check('L121 laser: safe while OFF', st.deaths === 0);
}
{
  const st = run(LEVEL_DEFS[120], 120, 1, idle, 3);
  check('L121 laser: toggles on a cycle', st.events.some(e => e.type === 'laser'));
}

// 17. L124: conveyor belt carries the player without input
{
  const st = createState(LEVEL_DEFS[123], 123, 1);
  const p = st.players[0];
  p.x = 7 * 40 + 20; p.y = 360; p.vx = 0; p.vy = 0; // standing on conveyor (7,9)
  let t = 0;
  while (t < 0.3) { update(st, DT, idle()); t += DT; }
  check('L124 conveyor: belt carries the player without input', p.x > 340);
}

// 18. L126: ice floor = low friction, player keeps sliding
{
  const st = createState(LEVEL_DEFS[125], 125, 1);
  const p = st.players[0];
  p.x = 8 * 40 + 20; p.y = 360; p.vx = 300; p.vy = 0; // on ice (8,9)
  let t = 0;
  while (t < 0.3) { update(st, DT, idle()); t += DT; }
  check('L126 ice: player keeps sliding (low friction)', p.vx > 150);
}

// 19. L130: one-way door — pass left→right, blocked right→left
{
  const st = createState(LEVEL_DEFS[129], 129, 1);
  const p = st.players[0];
  p.x = 4 * 40 + 20; p.y = 360; p.vx = 0; p.vy = 0; // left of the door (5,8)
  let t = 0;
  while (t < 0.5) { update(st, DT, holdRight()); t += DT; }
  check('L130 one-way door: passable left → right', p.x > 260);
}
{
  const st = createState(LEVEL_DEFS[129], 129, 1);
  const p = st.players[0];
  p.x = 7 * 40 + 20; p.y = 360; p.vx = 0; p.vy = 0; // right of the door
  let t = 0;
  while (t < 0.5) { update(st, DT, holdLeft()); t += DT; }
  check('L130 one-way door: blocked right → left', p.x > 240 && p.x < 270);
}

// 20. L133: level timer runs out → run over
{
  const st = createState(LEVEL_DEFS[132], 132, 1);
  st.timeLeft = 0.5;
  let t = 0;
  while (t < 1.2) { update(st, DT, idle()); t += DT; }
  check('L133 timer: time runs out → timeup + death', st.timeUp && st.events.some(e => e.type === 'timeup') && st.deaths >= 1);
}

// 21. L150: The Devil (boss) moves and kills
{
  const st = createState(LEVEL_DEFS[149], 149, 1);
  const bx0 = st.boss.x;
  let t = 0;
  while (t < 1) { update(st, DT, idle()); t += DT; }
  check('L150 boss: The Devil moves', st.boss && st.boss.x !== bx0);
  const p = st.players[0];
  p.x = st.boss.x + 10; p.y = st.boss.y + 10; p.vx = 0; p.vy = 0;
  update(st, DT, idle());
  check('L150 boss: touching The Devil kills', st.events.some(e => e.type === 'death' && e.cause === 'boss'));
}

// 22. Rage mode: crumble floor vanishes FASTER
{
  const st = createState(LEVEL_DEFS[4], 4, 1);
  st.rageMul = 0.55;
  let t = 0;
  while (t < 3 && st.players[0].x < 255) { update(st, DT, holdRight()); t += DT; } // walk onto the D tile
  while (t < 0.95) { update(st, DT, idle()); t += DT; }                              // stand ~0.5s (< 0.6s, > 0.33s)
  check('Rage mode: crumble floor vanishes FASTER (0.33s, not 0.6s)', !st.level.solidAt(6, 7));
}

// 23. Hardcore: first death ends the run
{
  const st = createState(LEVEL_DEFS[1], 1, 1, { hardcore: true });
  let t = 0;
  while (t < 4) { update(st, DT, holdRight()); t += DT; }
  check('Hardcore: first death ends the run (runOver)', st.runOver && st.events.some(e => e.type === 'runover'));
}

// 24. Endless: generated hell levels parse + spawn
{
  let ok = true;
  try {
    const s1 = createState(generateLevelDef(151), 150, 1);
    const s2 = createState(generateLevelDef(199), 198, 1);
    ok = !!s1.level.spawn && !!s1.level.goal && !!s2.level.spawn && !!s2.level.goal;
  } catch (e) { ok = false; }
  check('Endless: generated hell levels (151, 199) parse + spawn', ok);
}

// 25. HELL tier structure
{
  check('HELL tier: L136 is dark, L150 is the boss level', LEVEL_DEFS[135].dark === true && LEVEL_DEFS[149].boss === true);
}

// ---------- RAGE EDITION 3.0 tests ----------
// 26. 500 levels + boss fights at 200/250/300/350/400/450/500
{
  check('3.0: 500 levels total', LEVEL_DEFS.length === 500);
  const bossOk = [200, 250, 300, 350, 400, 450, 500].every(n => LEVEL_DEFS[n - 1].boss === true);
  check('3.0: boss fights at 200/250/300/350/400/450/500', bossOk);
}

// 27. two bosses at 400+, speed scales
{
  const st400 = createState(LEVEL_DEFS[399], 399, 1);
  const st500 = createState(LEVEL_DEFS[499], 499, 1);
  check('3.0: level 400+ has TWO Devils', st400.bosses.length === 2);
  check('3.0: final boss is faster than circle 4', LEVEL_DEFS[499].bossSpeed > LEVEL_DEFS[199].bossSpeed);
  check('3.0: level 500 is the Devil King', /DEVIL KING/.test(LEVEL_DEFS[499].name));
}

// 28. bounce pad launches (L151)
{
  const st = createState(LEVEL_DEFS[150], 150, 1);
  const p = st.players[0];
  p.x = 6 * 40 + 20; p.y = 360; p.vx = 0; p.vy = 0; // on the J pad
  update(st, DT, noInput);
  check('L151 bounce pad: launches the player', p.vy < -1000 && st.events.some(e => e.type === 'bounce'));
}

// 29. pendulum kills (L152)
{
  const st = createState(LEVEL_DEFS[151], 151, 1);
  const pend = st.level.entities.find(e => e.type === 'pendulum');
  pend.t = 0; // ball at the bottom of its arc
  const p = st.players[0];
  p.x = pend.x * 40 + 20; p.y = 360; p.vx = 0; p.vy = 0;
  update(st, DT, noInput);
  check('L152 pendulum: spiked ball kills', st.events.some(e => e.type === 'death' && e.cause === 'pendulum'));
}

// 30. spike shooter fires (L153)
{
  const st = createState(LEVEL_DEFS[152], 152, 1);
  let t = 0;
  while (t < 3) { update(st, DT, idle()); t += DT; }
  check('L153 spike shooter: fires shots', st.events.some(e => e.type === 'shoot'));
}

// 31. rising spikes toggle (L154)
{
  const st = createState(LEVEL_DEFS[153], 153, 1);
  st.risingT = 0.1;
  let t = 0;
  while (t < 0.3) { update(st, DT, idle()); t += DT; }
  check('L154 rising spikes: pop UP and become hazards', st.risingOn && st.level.hazardAt(6, 9) && st.level.solidAt(6, 9));
}

// 32. vortex pulls (L155)
{
  const st = createState(LEVEL_DEFS[154], 154, 1);
  const p = st.players[0];
  p.x = 774; p.y = 360; p.vx = 0; p.vy = 0; // inside one vortex zone, left of its center, over floor
  let t = 0;
  while (t < 0.2) { update(st, DT, idle()); t += DT; }
  check('L155 vortex: pulls the player toward its center', p.x > 774);
}

// 33. swap pad swaps bodies (L156, 2P)
{
  const st = createState(LEVEL_DEFS[155], 155, 2);
  const a = st.players[0], b = st.players[1];
  a.x = 10 * 40 + 20; a.y = 360; // P1 on the swap pad
  b.x = 20 * 40 + 20; b.y = 360; // P2 on the other pad
  const ax = a.x, bx = b.x;
  update(st, DT, idle());
  check('L156 swap pad: P1 and P2 trade bodies', a.x === bx && b.x === ax && st.events.some(e => e.type === 'swap'));
}

// 34. RACE mode: first to goal wins, individual lives
{
  const st = createState(LEVEL_DEFS[0], 0, 2, { race: true });
  let t = 0;
  while (t < 5 && !st.complete) {
    update(st, DT, [holdRight()[0], { left: false, right: false, jump: false, jumpPressed: false }]);
    t += DT;
  }
  check('RACE: first player to the goal wins', st.complete && st.raceWinner === 'P1' && st.events.some(e => e.type === 'racewin'));
}
{
  const st = createState(LEVEL_DEFS[1], 1, 2, { race: true });
  let t = 0;
  while (t < 4) { update(st, DT, [holdRight()[0], holdRight()[0]]); t += DT; }
  check('RACE: deaths are individual (no shared fate)', !st.events.some(e => e.type === 'bothdie') && st.players[1].alive);
}

// 35. daily hell: deterministic per day
{
  const { generateDailyDef } = require('../js/levels.js');
  const d1 = generateDailyDef(new Date(2026, 9, 10));
  const d2 = generateDailyDef(new Date(2026, 9, 10));
  const d3 = generateDailyDef(new Date(2026, 9, 11));
  check('Daily Hell: same day = same level, different day = different', JSON.stringify(d1.map) === JSON.stringify(d2.map) && JSON.stringify(d1.map) !== JSON.stringify(d3.map));
}

// 36. endless beyond 500
{
  const { generateLevelDef } = require('../js/levels.js');
  let ok = true;
  try { const s = createState(generateLevelDef(501), 500, 1); ok = !!s.level.spawn && !!s.level.goal; } catch (e) { ok = false; }
  check('Endless: level 501+ generates and parses', ok);
}

console.log('');
if (fail === 0) {
  console.log('✅ ALL ' + pass + ' SMOKE TESTS PASS');
} else {
  console.error('❌ ' + fail + ' test(s) failed (' + pass + ' passed)');
  process.exit(1);
}
