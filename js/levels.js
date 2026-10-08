/* ============================================================
   TRAP DEVIL: RAGE EDITION — levels.js
   120 levels: 24 handcrafted + 96 deterministically generated.
   Every level is GUARANTEED beatable — tools/validate-levels.cjs
   proves it with a jump-aware reachability search.

   MAP LEGEND (1 char = 1 tile, 40px):
     #  solid stone          =  solid metal
     ^  one-way platform     H  spikes up     V  spikes down
     D  crumbling floor (vanishes 0.6s after you STAND on it)
     A  coward floor   (vanishes 0.25s after you LEAVE it)
     f  FAKE platform  (looks solid, you fall through)
     I  invisible wall (flashes when you bump it)
     R  reverse-controls zone     Z  camera-flip zone
     w  layout-shift zone (the level CHANGES when you enter)
     T  teleport pad (back to spawn)   C  checkpoint (real)
     F  FAKE checkpoint (troll)        G  goal (glowing portal)
     Y  FAKE finish (troll)            L  lever (opens O doors)
     K  WRONG lever (kills)            O  door (solid until opened)
     X  killer door (looks safe, kills on touch)
     S  rock spawner (shadow warns you first)
     E  crusher anchor (params in traps[])  M  moving platform anchor
     P  player 1 spawn      Q  player 2 spawn
   ============================================================ */
(function (global) {
'use strict';

/* ---------- deterministic RNG (same seed = same level, every run) ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- trap names (used for hints + the Trollpedia) ---------- */
const TRAP_CHARS = {
  D: 'Crumbling Floor', A: 'Coward Floor', f: 'Fake Platform', I: 'Invisible Wall',
  H: 'Spikes', V: 'Spikes', R: 'Reverse Zone', Z: 'Camera Flip', w: 'Layout Shift',
  T: 'Teleport Pad', C: 'Checkpoint', F: 'Fake Checkpoint', Y: 'Fake Finish',
  L: 'Lever', K: 'Wrong Lever', O: 'Door', X: 'Killer Door',
  S: 'Rock Spawner', E: 'Crusher', M: 'Moving Platform'
};

function inferTrapList(def) {
  const out = [];
  const seen = new Set();
  for (const row of def.map) {
    for (const ch of row) {
      if (TRAP_CHARS[ch] && !seen.has(ch)) { seen.add(ch); out.push(TRAP_CHARS[ch]); }
    }
  }
  if (def.traps) {
    for (const t of def.traps) {
      const name = t.type === 'crusher' ? 'Crusher'
        : t.type === 'mover' ? 'Moving Platform'
        : t.type === 'shift' ? 'Layout Shift' : null;
      if (name && out.indexOf(name) === -1) out.push(name);
    }
  }
  return out;
}

/* ---------- 24 handcrafted levels (the story mode) ---------- */
const HANDCRAFTED = [
  {
    name: 'Tutorial: Walking Simulator',
    hint: 'Move: A/D. Jump: W. The floor is lava. (It is not. Yet.)',
    map: [
      '......................',
      '......................',
      '......................',
      '......................',
      '......................',
      '......................',
      '..P..............G....',
      '######################'
    ]
  },
  {
    name: 'First Blood',
    hint: 'Spikes hurt. Shocking, we know. Jump over them.',
    map: [
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '..P.....HHHH.........G..',
      '########################'
    ]
  },
  {
    name: "The Floor Is Lava (It's Not)",
    hint: 'That floor tile looked sus. It was. The REAL bridge is above — look for the solid one.',
    map: [
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........===.............',
      '..........................',
      '..P.......fff...........G.',
      '########D#HHH#############',
      '##########################'
    ]
  },
  {
    name: 'Trust Issues',
    hint: 'Green flag = checkpoint. Purple flag = LIE. 😈',
    map: [
      '......................',
      '......................',
      '......................',
      '......................',
      '......................',
      '......................',
      '..P.....F..........G..',
      '######################'
    ]
  },
  {
    name: 'Crumbling Confidence',
    hint: 'Some floors crumble when you stand on them. Keep moving — or do not.',
    map: [
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..P.....................G.',
      '######D#####D#####D#######',
      '##########################'
    ]
  },
  {
    name: 'Door to Nowhere',
    hint: 'That door looks safe. It is not. Jump over it.',
    map: [
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '...........XX...........',
      '..P........XX.......G...',
      '########################'
    ]
  },
  {
    name: 'Spike Dating',
    hint: 'Spike corridor. Timing is everything. (So is not panicking.)',
    map: [
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..P...HH..HHH....HH..HHHG.',
      '##########################'
    ]
  },
  {
    name: 'The Long Jump of Faith',
    hint: 'There is a platform in the middle of the gap. It is... optimistic.',
    map: [
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..P..........ff............G..',
      '############....##############',
      '############HHHH##############'
    ]
  },
  {
    name: 'Invisible Problems',
    hint: 'Bump into invisible walls to reveal them. Then jump over them.',
    map: [
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '...........I............',
      '..P........I.........G..',
      '########################'
    ]
  },
  {
    name: 'Reverse Psychology',
    hint: 'Purple zone = your A/D keys lie to you for a few seconds.',
    map: [
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '.......RRRR.............',
      '..P.....RRRR....HH....G.',
      '########################'
    ]
  },
  {
    name: 'Falling for It',
    hint: 'Look up. No, REALLY look up. Rocks fall. Shadows warn you first.',
    map: [
      '..........................',
      '........S.....S.....S.....',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..P.....................G.',
      '##########################'
    ]
  },
  {
    name: 'The Crusher Room',
    hint: 'The ceiling has opinions. Wait for the gap, then run.',
    map: [
      '..........................',
      '..........................',
      '........E.......E.........',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..P.....................G.',
      '##########################'
    ],
    traps: [
      { type: 'crusher', x: 8, y: 2, drop: 200 },
      { type: 'crusher', x: 16, y: 2, drop: 200 }
    ]
  },
  {
    name: 'Checkpoint? Check-mate.',
    hint: 'Green flag saved you. Purple flag did not. The spikes will remind you.',
    map: [
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '..P...C..F...HH.......G.',
      '########################'
    ]
  },
  {
    name: 'Teleport Simulator 3000',
    hint: 'The glowing pad is a "shortcut". It goes backwards.',
    map: [
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '..P.......T..........G..',
      '########################'
    ]
  },
  {
    name: 'Camera Shy',
    hint: 'Cyan zone = the camera has trust issues. Spikes ahead. Good luck.',
    map: [
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '.......ZZZ..............',
      '..P.....ZZZ...HHH....G..',
      '########################'
    ]
  },
  {
    name: 'Fake News 2: Electric Boogaloo',
    hint: 'Two flags. One is a lie. (The gray one. Always the gray one.)',
    map: [
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..P.........Y..........G..',
      '##########################'
    ]
  },
  {
    name: 'Leveraged',
    hint: 'Pull the lever. Open the door. Revolutionary concept.',
    map: [
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '............OO............',
      '..P...L.....OO.........G..',
      '##########################'
    ]
  },
  {
    name: 'Wrong Lever, Wrong Day',
    hint: 'Two levers. One opens the door. The other kills you. Choose wisely.',
    map: [
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............OO..............',
      '..P.....K...OO...L.......G..',
      '============================'
    ]
  },
  {
    name: 'The Great Shift',
    hint: 'Standing still is a lifestyle. The level disagrees.',
    map: [
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '.................ww.......',
      '..P..............ww.....G.',
      '##########################',
      '###################HHH####'
    ],
    traps: [
      {
        type: 'shift',
        add: [{ x: 19, y: 6 }, { x: 20, y: 6 }, { x: 21, y: 6 }],
        remove: [{ x: 19, y: 8 }, { x: 20, y: 8 }, { x: 21, y: 8 }],
        spike: [{ x: 19, y: 9 }, { x: 20, y: 9 }, { x: 21, y: 9 }]
      }
    ]
  },
  {
    name: 'Two Floors, One Lie',
    hint: 'Some floors leave when you do. Some leave while you are on them. Plan accordingly.',
    map: [
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..P.....................G.',
      '########AA####D###########',
      '##########################'
    ]
  },
  {
    name: 'Rage Room',
    hint: 'Everything you have learned. All at once. 😈',
    map: [
      '..............................',
      '........S.........S...........',
      '..............E...............',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..P........................G..',
      '##########D#########D#########',
      '##############################'
    ],
    traps: [{ type: 'crusher', x: 14, y: 2, drop: 200 }]
  },
  {
    name: 'Trust Fall',
    hint: 'A bridge, a lie, a teleporter, spikes and a fake checkpoint. Welcome home.',
    map: [
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '..........===...............',
      '............................',
      '..P.......fff...T..HH.F..G..',
      '##########...###############',
      '##########HHH###############',
      '############################'
    ]
  },
  {
    name: 'The Penultimate Troll',
    hint: 'Invisible wall. Lying controls. Falling rocks. A floor that quits on you. And the finish is a rumor.',
    map: [
      '..............................',
      '..........S.........S.........',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '............I.....RR..ww..G...',
      '..P.........I.....RR..ww......',
      '##############################',
      '##########################HH##'
    ],
    traps: [
      {
        type: 'shift',
        add: [{ x: 26, y: 7 }, { x: 27, y: 7 }],
        remove: [{ x: 26, y: 8 }, { x: 27, y: 8 }],
        spike: [{ x: 26, y: 9 }, { x: 27, y: 9 }]
      }
    ]
  },
  {
    name: 'Final Exam (of Patience)',
    hint: 'Everything. All of it. At once. If you beat this, the rest is just paperwork.',
    map: [
      '..................................',
      '........S...............S.........',
      '..................................',
      '..................................',
      '..................................',
      '..................................',
      '............XX....................',
      '..P....F....XX..T..HH..Y....G.....',
      '##########DD######################',
      '##########HH######################'
    ]
  }
];

/* ---------- name generator for levels 25-120 ---------- */
const NAME_ADJ = ['Soggy', 'Cursed', 'Invisible', 'Crumbling', 'Sarcastic', 'Menacing', 'Judgmental',
  'Haunted', 'Passive-Aggressive', 'Gaslighting', 'Unhinged', 'Suspicious', 'Backstabbing', 'Two-Faced',
  'Glitchy', 'Broken', 'Smug', 'Overconfident', 'Dramatic', 'Petty', 'Vindictive', 'Sleep-Deprived', 'Caffeinated'];
const NAME_NOUN = ['Corridor', 'Bridge', 'Staircase', 'Chamber', 'Hallway', 'Dungeon', 'Trap', 'Regret',
  'Nightmare', 'Lecture', 'Meeting', 'Interview', 'Funeral', 'Wedding', 'Courtroom', 'Kitchen', 'Bathroom',
  'Elevator', 'Waiting Room'];
const NAME_PLACE = ['of Doom', 'of Regret', 'of Lies', 'of Eternal Suffering', 'That You Deserve',
  'You Paid For', 'From Hell', 'of False Hope', 'of Minor Inconvenience', 'of Ultimate Trolling',
  'of Questionable Decisions', 'You Were Warned About'];

/* ---------- deterministic level generator (levels 25..120) ----------
   Builds a linear path of floor segments separated by spiked pits,
   then sprinkles troll traps on the middle segments. Reachability is
   guaranteed by construction AND verified by tools/validate-levels.cjs */
function generateLevelDef(n) {
  const rng = mulberry32(n * 7919 + 104729);
  const H = 12, fy = H - 2, py = fy - 1; // floor row 10, player row 9, bedrock row 11
  // gap of 4 tiles max: a 5-tile pit would exceed the player's max jump distance
  const gapMax = Math.min(4, 2 + Math.floor((n - 25) / 12));
  const segCount = 4 + Math.floor(rng() * 4);
  const segments = [{ x0: 2, x1: 5 }];
  let cursor = 7;
  for (let s = 1; s < segCount; s++) {
    const len = 3 + Math.floor(rng() * 4);
    const x0 = cursor, x1 = x0 + len - 1;
    if (x1 > 60) break;
    segments.push({ x0, x1 });
    cursor = x1 + 1 + 1 + Math.floor(rng() * gapMax);
  }
  const W = Math.max(30, segments[segments.length - 1].x1 + 4);
  const grid = [];
  for (let y = 0; y < H; y++) grid.push(new Array(W).fill('.'));
  for (let x = 0; x < W; x++) grid[H - 1][x] = '#';
  for (const seg of segments) {
    for (let x = seg.x0; x <= seg.x1; x++) grid[fy][x] = rng() < 0.18 ? '=' : '#';
  }
  const isSeg = new Array(W).fill(false);
  for (const seg of segments) for (let x = seg.x0; x <= seg.x1; x++) isSeg[x] = true;
  for (let x = 0; x < W; x++) if (!isSeg[x]) grid[H - 1][x] = 'H'; // spiked pits
  grid[py][2] = 'P';
  const lastSeg = segments[segments.length - 1];
  const gx = lastSeg.x1;
  grid[py][gx] = 'G';
  const midSeg = segments[Math.floor(segments.length / 2)];
  grid[py][Math.floor((midSeg.x0 + midSeg.x1) / 2)] = 'C';

  const traps = [];
  const used = new Set();
  const pool = ['D', 'H', 'f', 'D', 'H'];
  if (n >= 35) pool.push('S', 'R', 'T', 'I', 'A', 'S', 'R');
  if (n >= 50) pool.push('E', 'Z', 'F', 'Y', 'K', 'T');
  if (n >= 70) pool.push('X', 'L', 'E', 'Z');
  if (n >= 90) pool.push('M', 'X', 'Z', 'Y');
  const budget = Math.min(8, 2 + Math.floor((n - 25) / 15));
  const segIdxs = [];
  for (let s = 1; s < segments.length - 1; s++) segIdxs.push(s);
  for (let i = segIdxs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = segIdxs[i]; segIdxs[i] = segIdxs[j]; segIdxs[j] = tmp;
  }
  const placed = { Y: false };
  let count = 0, guard = 0, si = 0;
  while (count < budget && guard++ < 300 && segIdxs.length) {
    const type = pool[Math.floor(rng() * pool.length)];
    if (type === 'Y' && placed.Y) continue;
    const s = segIdxs[si++ % segIdxs.length];
    const seg = segments[s];
    const span = Math.max(1, seg.x1 - seg.x0 - 1);
    const tx = seg.x0 + 1 + Math.floor(rng() * span);
    const key = s + ':' + tx;
    if (used.has(key)) continue;
    if (placeTrap(type, tx, s)) { used.add(key); count++; if (type === 'Y') placed.Y = true; }
  }
  // Layout shift near the goal for late levels
  if (n >= 70) {
    const zx = Math.max(lastSeg.x0 + 1, gx - 3);
    if (grid[py][zx] === '.' && grid[py - 1][zx] === '.') {
      grid[py][zx] = 'w'; grid[py - 1][zx] = 'w';
      traps.push({
        type: 'shift',
        add: [{ x: gx - 1, y: py }, { x: gx, y: py }],
        remove: [{ x: gx - 1, y: fy }, { x: gx, y: fy }],
        spike: [{ x: gx - 1, y: H - 1 }, { x: gx, y: H - 1 }]
      });
    }
  }

  function cellsFor(type, tx) {
    switch (type) {
      case 'D': case 'A': case 'f': return [[tx, fy, 'floor']];
      case 'H': case 'I': case 'T': case 'F': case 'K': case 'Y': return [[tx, py, 'air']];
      case 'R': case 'Z': case 'X': return [[tx, py, 'air'], [tx, py - 1, 'air']];
      case 'S': return [[tx, 1, 'air']];
      case 'E': return [[tx, 2, 'air']];
      default: return null;
    }
  }
  function canPlace(cells) {
    if (!cells) return false;
    for (const c of cells) {
      const x = c[0], y = c[1], kind = c[2];
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      const ch = grid[y][x];
      if (kind === 'floor') { if (ch !== '#' && ch !== '=') return false; }
      else if (ch !== '.') return false;
    }
    return true;
  }
  function placeTrap(type, tx, s) {
    const seg = segments[s];
    if (tx < seg.x0 + 1 || tx > seg.x1 - 1) return false;
    if (type === 'L') {
      if (seg.x1 - seg.x0 < 7) return false;
      const dx = seg.x0 + 2 + Math.floor(rng() * (seg.x1 - seg.x0 - 6));
      const cells = [[dx, py, 'air'], [dx + 4, py, 'air'], [dx + 4, py - 1, 'air']];
      if (!canPlace(cells)) return false;
      grid[py][dx] = 'L';
      grid[py][dx + 4] = 'O'; grid[py - 1][dx + 4] = 'O';
      return true;
    }
    if (type === 'M') {
      if (s + 1 >= segments.length) return false;
      const pit0 = segments[s].x1 + 1, pit1 = segments[s + 1].x0 - 1;
      const width = pit1 - pit0 + 1;
      if (width < 1 || width > 3) return false;
      if (grid[fy][pit0] !== '.') return false;
      traps.push({ type: 'mover', x: pit0, y: fy, x2: pit1, y2: fy, speed: 100 + (n % 3) * 35 });
      grid[fy][pit0] = 'M';
      return true;
    }
    const cells = cellsFor(type, tx);
    if (!canPlace(cells)) return false;
    switch (type) {
      case 'D': grid[fy][tx] = 'D'; return true;
      case 'A': grid[fy][tx] = 'A'; return true;
      case 'H': grid[py][tx] = 'H'; return true;
      case 'f': grid[fy][tx] = 'f'; return true;
      case 'I': grid[py][tx] = 'I'; return true;
      case 'T': grid[py][tx] = 'T'; return true;
      case 'R': grid[py][tx] = 'R'; grid[py - 1][tx] = 'R'; return true;
      case 'Z': grid[py][tx] = 'Z'; grid[py - 1][tx] = 'Z'; return true;
      case 'F': grid[py][tx] = 'F'; return true;
      case 'K': grid[py][tx] = 'K'; return true;
      case 'Y': grid[py][tx] = 'Y'; return true;
      case 'S': grid[1][tx] = 'S'; return true;
      case 'E':
        grid[2][tx] = 'E';
        traps.push({ type: 'crusher', x: tx, y: 2, drop: (fy - 3) * 40 });
        return true;
      case 'X': grid[py][tx] = 'X'; grid[py - 1][tx] = 'X'; return true;
      default: return false;
    }
  }

  const def = {
    name: 'The ' + pick(NAME_ADJ) + ' ' + pick(NAME_NOUN) + ' ' + pick(NAME_PLACE),
    map: grid.map(r => r.join('')),
    traps
  };
  const list = inferTrapList(def);
  def.hint = list.length
    ? 'This level contains: ' + list.join(', ') + '. Every trap has a tell — find it before it finds you.'
    : 'A warm-up stroll. Enjoy it. It gets worse.';
  return def;

  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
}

/* ---------- assemble all 120 levels ---------- */
const LEVEL_DEFS = HANDCRAFTED.slice();
for (let n = 25; n <= 120; n++) LEVEL_DEFS.push(generateLevelDef(n));

const TOTAL_LEVELS = LEVEL_DEFS.length; // 120

global.LEVEL_DEFS = LEVEL_DEFS;
global.mulberry32 = mulberry32;
global.inferTrapList = inferTrapList;
global.TOTAL_LEVELS = TOTAL_LEVELS;

const api = { LEVEL_DEFS, HANDCRAFTED, generateLevelDef, mulberry32, inferTrapList, TRAP_CHARS, TOTAL_LEVELS };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
