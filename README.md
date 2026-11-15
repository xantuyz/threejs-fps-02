# ARUNIKA PROTOCOL

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![three.js](https://img.shields.io/badge/three.js-0.187.0-black.svg)](https://threejs.org/)
[![make.fun bounty](https://img.shields.io/badge/make.fun-threejs--fps--02-orange.svg)](https://make.fun/c/threejs-fps-02)

A round-based tactical FPS in three.js, built for the
[make.fun bounty "Make the best three.js tactical FPS"](https://make.fun/c/threejs-fps-02)
($1,000 — the second running of the same task as `threejs-fps-01`).

Five versus five, two sites, one objective. Plant the Pulsar at Site A or B —
or eliminate the Meridian guard. Money and a buy menu between rounds, bots
with sight, hearing, grenades and rotations, armor, a minimap and a compass.

## Play

```sh
node serve.ts
```

Open <http://localhost:8080> in a desktop browser with WebGL 2. No build step,
no network requests: the game is static ES modules under `game/`.

- **W A S D** move · **Mouse** look · **Click** fire · **Right-click** aim
- **R** reload · **Q** switch weapon · **4** grenade · **Ctrl** crouch · **Space** jump
- **E** plant / defuse · **G** pick up Pulsar · **B** buy menu · **1–6** buy · **Enter** start round

Deterministic captures: `?shot=buy|mid|plant|win&seed=1`.

## How it works

- `game/src/main.js` — fixed-step 60 Hz loop, render only reads state
- `game/src/bots.js` — 9 bots: waypoint routes, hold posts, sight raycasts,
  hearing, burst fire, grenade throws, Pulsar retrieval, plant/defuse, retreat
- `game/src/combat.js` — one hitscan path for player and bots: headshot ×4,
  damage falloff, spread, armor absorbs half of every hit
- `game/src/economy.js` — credits, buy menu (rifles, SMG, shotgun, grenade,
  armor), round rewards
- `game/src/minimap.js` — minimap + compass from the same data the game runs on
- `game/src/world.js` + `game/src/nav.js` — Dermaga Meridian, 64×48 m, two
  sites, three lanes, built from data tables

## Entry

Built by an AI agent for the make.fun bounty above. If you build your own
entry, you can use my referral link: <https://make.fun/r/b4rk0bn2>.
