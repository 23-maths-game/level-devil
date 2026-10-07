# 😈 TRAP DEVIL: RAGE EDITION

> *"You don't lose because you're bad. You lose because the level hates you."*

![GitHub license](https://img.shields.io/badge/License-MIT-blue.svg)
![Three.js](https://img.shields.io/badge/Engine-Three.js-black.svg)
![Rage Level](https://img.shields.io/badge/Rage%20Level-Maximum-red.svg)

## 🎮 About The Game
**TRAP DEVIL** is a 3D troll-platformer designed to induce rage, destroy friendships, and test the limits of your patience. Built with Three.js and custom collision physics, every level is a devious puzzle disguised as an impossible jump.

But there is one golden rule: **The game is ALWAYS fair.** 
Every trap is technically discoverable and beatable. If you die, it's because you fell for the troll, not because the game randomly killed you. There is always a subtle visual hint—you just have to be observant enough to see it.

---

## 🔥 The 120-Level Descent into Madness

The game dynamically generates its gauntlet using a procedural tier system. The higher you go, the more the level hates you.

| Tiers | Levels | Difficulty | What to expect |
| :--- | :--- | :--- | :--- |
| **Tier 1** | 1 – 20 | 😐 *Easy hai* | Simple jumps, basic platforms. Lulling you into a false sense of security. |
| **Tier 2** | 21 – 40 | 😤 *Ye trap kahan se aaya?* | Invisible walls, Fake finish lines. The betrayal begins. |
| **Tier 3** | 41 – 60 | 😡 *Bhai ye unfair hai!* | Reversed controls, Falling blocks. Trust issues intensify. |
| **Tier 4** | 61 – 80 | 🤬 *MAIN GAME DELETE KAR RAHA HOON* | Camera flips, Fake pause menus. Pure psychological warfare. |
| **Tier 5** | 81 – 100| 💀 *Bas ek aur try…* | 2-Player grief levers, Crushing ceilings. Friendships end here. |
| **Tier 6** | 101–120+| ☠️ *Welcome to Hell* | All traps combined at max probability. Only bots survive. |

---

## 😈 Core Troll Mechanics

- **The False Finish:** The door looks real, but step near it and the floor vanishes. *(Hint: Real doors don't glow that brightly).*
- **Invisible Walls:** Running into nothing. *(Hint: Look at the shadows on the ground).*
- **Reverse Controls:** Step on a trigger and WASD becomes inverted. *(Hint: The platform is a different color).*
- **The Fake Pause:** Press ESC to pause? Nope. The menu appears, but your character keeps falling to their death.
- **The Grief Lever (2-Player):** Player 1 pulls a lever, Player 2 dies if they aren't standing in the exact safe zone. Both restart.
- **The Ceiling Crush:** Jump to celebrate, and the roof comes down to smash you. *(Hint: Ceiling has cracks).*

---

## 🛠️ Tech Stack & Architecture

This project uses a modular ES6 architecture to keep the 120+ level logic scalable and clean.

- **Rendering:** [Three.js](https://threejs.org/) (WebGL 3D Engine)
- **Physics:** Custom AABB (Axis-Aligned Bounding Box) Collision Detection
- **Structure:** Vanilla JavaScript (ES6 Modules)

### 📂 Project Structure
```text
TRAP-DEVIL-RAGE-EDITION/
│
├── index.html          # Main Entry Point & UI Overlays
├── style.css           # Brutal Dark Theme & HUD Styling
├── README.md           # You are here.
│
└── js/                 # Game Engine (Modular Architecture)
    ├── main.js         # Three.js init, Game Loop, Camera
    ├── player.js       # Player class, Movement, Physics
    ├── levelManager.js # Level progression, Procedural generation
    ├── traps.js        # All troll mechanic functions
    └── utils.js        # Collision math, Helper functions
