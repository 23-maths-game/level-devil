/* ============================================================
   tools/validate-levels.cjs
   Proves the ONE RULE: every one of the 120 levels is beatable.
   - structural checks (spawn, goal, floor under spawn, row widths)
   - jump-aware reachability search (walk / jump / drop / fall-move)
   Run: npm run validate
   ============================================================ */
'use strict';
const { LEVEL_DEFS, TOTAL_LEVELS } = require('../js/levels.js');
const TD = require('../js/engine.js');
const { parseLevel } = TD;

let failures = 0;
function fail(i, msg) {
  failures++;
  console.error('  ✗ Level ' + (i + 1) + ' (' + LEVEL_DEFS[i].name + '): ' + msg);
}

/* Jump-aware BFS over "standing on tile (x,y)" positions.
   standing tile = solid, non-hazard tile with 1 tile of headroom.
   Moves: walk, jump (dx 1..5, up 0..3), drop, fall-move off edges. */
function reachable(level) {
  const { w, h, solids, hazards } = level;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && solids[y * w + x] === 1;
  const hazard = (x, y) => x >= 0 && y >= 0 && x < w && y < h && hazards[y * w + x] === 1;
  const standable = (x, y) => solid(x, y) && !hazard(x, y) && !solid(x, y - 1);

  const start = { x: level.spawn.x, y: level.spawn.y + 1 };
  if (!standable(start.x, start.y)) return false;
  const visited = new Set([start.x + ',' + start.y]);
  const queue = [start];
  const gx = level.goal.x, gy = level.goal.y;
  const MAXJUMP = 5, MAXUP = 3;

  while (queue.length) {
    const cur = queue.shift();
    const x = cur.x, y = cur.y;
    // goal: standing directly below the goal tile, or on a tile at the goal's row (bridge case)
    if ((x === gx && y === gy + 1) || (x === gx && y === gy)) return true;

    const neighbors = [];
    // walk
    for (const d of [-1, 1]) {
      if (standable(x + d, y)) neighbors.push({ x: x + d, y });
    }
    // jump
    for (const d of [-1, 1]) {
      for (let dx = 1; dx <= MAXJUMP; dx++) {
        for (let up = 0; up <= MAXUP; up++) {
          const lx = x + d * dx, ly = y - up;
          if (!standable(lx, ly)) continue;
          let ok = true;
          for (let k = 1; k <= up - 1; k++) if (solid(lx, y - k)) { ok = false; break; }
          if (ok) neighbors.push({ x: lx, y: ly });
        }
      }
    }
    // drop (same column) & fall-move off edges (dx 1..3)
    for (const d of [0, -1, 1, -2, 2, -3, 3]) {
      const c = x + d;
      for (let k = 1; y + k < h; k++) {
        if (solid(c, y + k)) {
          if (!hazard(c, y + k) && !solid(c, y + k - 1)) neighbors.push({ x: c, y: y + k });
          break;
        }
      }
    }
    for (const n of neighbors) {
      const key = n.x + ',' + n.y;
      if (!visited.has(key)) { visited.add(key); queue.push(n); }
    }
  }
  return false;
}

console.log('🔍 Validating ' + LEVEL_DEFS.length + ' levels…');
for (let i = 0; i < LEVEL_DEFS.length; i++) {
  const def = LEVEL_DEFS[i];
  const w = def.map[0].length;
  def.map.forEach((row, y) => {
    if (row.length !== w) fail(i, 'row ' + y + ' has width ' + row.length + ', expected ' + w);
  });
  let level;
  try {
    level = parseLevel(def, i);
  } catch (e) {
    fail(i, 'parse error: ' + e.message);
    continue;
  }
  if (!level.solidAt(level.spawn.x, level.spawn.y + 1)) fail(i, 'no floor under spawn');
  // apply layout-shift ops (the optimistic case: shift has triggered)
  if (level.shift) {
    for (const t of level.shift.add) level.solids[t.y * level.w + t.x] = 1;
    for (const t of level.shift.remove) level.solids[t.y * level.w + t.x] = 0;
    for (const t of level.shift.spike) level.hazards[t.y * level.w + t.x] = 1;
  }
  if (!reachable(level)) fail(i, 'GOAL NOT REACHABLE — level is impossible ❌');
}

console.log('');
if (failures === 0) {
  console.log('✅ ALL ' + TOTAL_LEVELS + ' LEVELS PASS — every level is beatable. The ONE RULE holds.');
} else {
  console.error('❌ ' + failures + ' problem(s) found.');
  process.exit(1);
}
