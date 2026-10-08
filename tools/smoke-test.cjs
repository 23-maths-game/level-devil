/* ============================================================
   tools/smoke-test.cjs
   Headless physics/gameplay tests — no browser needed.
   Run: npm test
   ============================================================ */
'use strict';
const { LEVEL_DEFS } = require('../js/levels.js');
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

console.log('');
if (fail === 0) {
  console.log('✅ ALL ' + pass + ' SMOKE TESTS PASS');
} else {
  console.error('❌ ' + fail + ' test(s) failed (' + pass + ' passed)');
  process.exit(1);
}
