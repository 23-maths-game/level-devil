# 😈 TRAP DEVIL: RAGE EDITION

![banner](assets/banner.svg)

> **"You don't lose because you're bad. You lose because the level hates you."**

A rage-inducing, troll-filled, **but always fair** 2D platformer.
**120 levels. 1–2 players. Zero dependencies. Zero assets. 100% spite.**

Built with vanilla JavaScript, HTML5 Canvas and WebAudio. Everything — physics,
levels, traps, rendering, sound effects, even the music — is generated in code.

[![Vanilla JS](https://img.shields.io/badge/vanilla-JS-f7df1e?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![120 Levels](https://img.shields.io/badge/levels-120-b71c1c?style=for-the-badge)](https://github.com)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-00c853?style=for-the-badge)](https://github.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-1976d2?style=for-the-badge)](LICENSE)

---

## 😤 The Rage Curve

| Levels | Mood |
|--------|------|
| 1–20 | 😐 "Easy hai." |
| 21–40 | 😤 "Ye trap kahan se aaya?" |
| 41–60 | 😡 "Bhai ye unfair hai!" |
| 61–80 | 🤬 "MAIN GAME DELETE KAR RAHA HOON." |
| 81–100 | 💀 "Bas ek aur try…" |
| 101–120+ | ☠️ "Welcome to Hell." |

## 😈 Troll Mechanics

- 🫥 **Crumbling floor** — vanishes 0.6s after you *stand* on it
- 🐄 **Coward floor** — vanishes 0.25s after you *leave* it (the previous level's trick, inverted)
- 🎭 **Fake platform** — looks solid, you fall through (dashed outline = the tell)
- 🧱 **Invisible walls** — solid, invisible; flash when you bump them
- 🔁 **Reverse zone** — your A/D keys lie to you for a few seconds
- 📷 **Camera flip** — the whole screen rotates 180° for 4 seconds
- 🌍 **Layout shift** — the level *changes* the moment you enter a zone
- 🌀 **Teleport pad** — a "shortcut" that goes backwards
- 💾 **Fake checkpoint** — purple flag, saves nothing
- 🚩 **Fake finish** — gray flag, sends you back to spawn
- ⚔️ **Killer door** — looks safe, kills on touch
- 🪨 **Rock spawner** — drops rocks on your head (shadow warns you first)
- 🏗️ **Crusher** — ceiling slams down when you're underneath
- ⇄ **Moving platforms** — ride them across spiked pits
- 🎚️ **Lever + door** — and a **wrong lever** that kills you (both of you)
- 👥 **2-player shared fate** — one player dies → **BOTH PLAYERS RESTART**

## ⚖️ The One Rule (The Fairness Promise)

> **No random impossible death. Every trap is technically discoverable and beatable.**

Every trap has a **TELL** — a visual or audio warning before it strikes:

| Trap | The Tell |
|------|----------|
| Crumbling floor | shakes + cracks before it vanishes |
| Coward floor | cracks appear while you stand on it |
| Fake platform | dashed outline, slightly transparent |
| Invisible wall | flashes when you bump it |
| Reverse zone | purple zone + ⇄ status icon |
| Camera flip | cyan zone + warning toast |
| Layout shift | orange zone + audible RUMBLE + screen shake |
| Teleport pad | swirl animation |
| Fake checkpoint | purple, flickering (real checkpoint = green, steady) |
| Fake finish | gray flag, no glow (real goal = glowing portal) |
| Wrong lever | red handle (real lever = green) |
| Killer door | red pulsing outline |
| Rock spawner | shadow on the ground **before** the rock drops |
| Crusher | shadow + warning shake before it drops |
| Moving platform | ⇄ arrows on it |

Die to a trap once and the game shows you a **hint** (press **H** anytime).
You die, you learn: *"अरे! मुझे समझ आ गया… मेरी галती थी."* — and that's what makes it addictive.

## 🎮 How to Play

| Action | P1 | P2 |
|--------|----|----|
| Move | A / D | ← / → |
| Jump | W or Space | ↑ |
| Hint | H | H |
| Restart level | R | R |
| Mute | M | M |
| **Fake pause 😈** | tap ESC | tap ESC |
| **Real pause** | **HOLD ESC** (0.8s) or ` | **HOLD ESC** or ` |

**2-Player rules:** shared screen, shared fate — if one player dies, **both restart**.
And the goal only opens when **both players** stand on it together.

## 🚀 Run it

```bash
# zero install needed — it's pure static files
npm start          # serves at http://localhost:8000
# or: python3 -m http.server 8000
# or just open index.html in a browser
```

## 🧪 Tests (yes, a troll game has tests)

```bash
npm run validate   # proves ALL 120 levels are beatable (jump-aware reachability search)
npm test           # 15 headless physics/gameplay smoke tests (no browser needed)
```

`tools/validate-levels.cjs` runs a BFS over every level with platformer movement
(walk / jump up to 5 tiles / drop / fall off edges) and **fails the build** if any
goal is unreachable. The ONE RULE is enforced by CI-able code, not by vibes.

## 📁 Project Structure

```
trap-devil-rage-edition/
├── index.html               # entry point
├── css/style.css            # rage-red glitch theme
├── js/
│   ├── audio.js             # WebAudio SFX + tense music loop (all synthesized)
│   ├── levels.js            # 24 handcrafted + 96 generated = 120 levels (deterministic)
│   ├── engine.js            # physics, traps, entities, camera — pure logic, no DOM
│   └── game.js              # rendering, menus, HUD, save system, game loop
├── tools/
│   ├── validate-levels.cjs  # "is every level beatable?" — run in CI
│   ├── smoke-test.cjs       # headless gameplay tests
│   └── serve.cjs            # zero-dependency static server (npm start)
├── assets/banner.svg        # README banner
├── package.json             # start / validate / test scripts
├── LICENSE                  # MIT
└── README.md
```

## 🗺️ Roadmap

- [ ] **3D mode** (Three.js) — "realistic 3D" as promised in the design doc
- [ ] Online 2-player (WebRTC / WebSockets)
- [ ] Daily "Hell level" (seeded, shared worldwide)
- [ ] Speedrun leaderboards (localStorage → server)
- [ ] Mobile touch controls
- [ ] Level editor

## 🤝 Contributing

PRs welcome. If you add a trap, it **must** have a tell — that's the one rule.
Run `npm run validate && npm test` before opening a PR.

## 📜 License

[MIT](LICENSE) — do whatever you want, just don't blame us when you rage-quit.

---

*Made with vanilla JS + pure spite. No assets were harmed in the making of this game.*
