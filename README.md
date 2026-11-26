# LANTERNWING: fly the lantern courier — 7 valleys, 24 sky-rings, 3 storm bosses, 5 missions, 12 upgrades

The last light takes flight. Pilot a hand-built sky-lantern courier above a winding river at dusk. Thread brass rings, wake dark villages, slip between mountain walls, and send light into the hearts of three storm keepers. Bring the little canvas aircraft back to the runway lights.

An original, dependency-free flight game for the make.fun “Make the best flight game” competition, `best-flight-game-20261126-0057`. Everything in the playable game is drawn with the 2D canvas API. Sound is synthesised locally with WebAudio. There are no external fonts, assets, libraries, downloads, cookies, or network APIs.

[![Make the best flight game competition](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![LANTERNWING competition rank](https://make.fun/badge/best-flight-game-20261126-0057/didinska21/lanternwing-flight/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![LANTERNWING competition reward](https://make.fun/badge/best-flight-game-20261126-0057/didinska21/lanternwing-flight/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

## Play

Serve `game/` with any offline static-file server and open `index.html` in a desktop browser. The game uses local ES modules; browsers that block modules on `file://` need a local server. No install or build step is needed. The canvas has a fixed 1280 × 720 drawing surface and scales to the window.

Choose TAKE A FLIGHT, pick one of the five open routes, and follow the amber guidance. Complete the objective, then land at the final valley’s runway to bank the full route bonus. The target indicator shows lateral alignment and remaining distance. Ring collection adds lanterns to the cradles. Village deliveries and storm victories earn currency for the hangar. Earnings and upgrades save in local storage when the browser allows it; they remain available for the current session otherwise.

## Controls

| Control | Action |
| --- | --- |
| W / Up | Pitch up and gently open the throttle |
| S / Down | Pitch down and gently ease the throttle |
| A D / Left Right | Bank and turn |
| E / Shift | Increase throttle independently |
| Q / Ctrl | Decrease throttle independently |
| Space | Ring boost near a ring; lantern pulse near a storm keeper; otherwise release a delivery lantern |
| Hold left mouse and move | Optional steering and pitch |
| Escape / P | Pause or resume |
| M | Mute or unmute synthesised sound |
| R | Retry from pause or results |

Pitch and steering retain authority at low speed. Gentle throttle conserves fuel. Hard turns above 88 m/s bleed lift. The aircraft can glide after the tank empties. For a landing, line up with the runway lights, reduce speed to about 42–68 m/s, level the wings, and descend gently. A hard landing bounces, raises dust, and damages the wing. Excess speed, sink, or misalignment can cause a crash with smoke and fire. Wing repairs cost lantern currency in the hangar.

## The campaign and its actual content

- **7 named valleys:** Alderwake, Copperbend, Glasswater, Emberpine Pass, Moonmere, Cinderstep, and Thunder Crown. The world contains **24 distinct sky-rings**, distributed 4 / 4 / 4 / 3 / 3 / 3 / 3 across those valleys, plus 21 villages, seven runways, forests, ridges, clouds, and two mountain gates.
- **5 missions:** Ring Run (four rings and a landing); River Rescue (four deliveries across two valleys); Mountain Pass (both narrow gates); Night Lantern (three village lights); Storm Boss (all three keepers, then land).
- **3 storm bosses:** The Hollow Gale, The Copper Maw, and The Last Tempest. They have separate health, charging lightning lanes, and lantern-pulse combat.
- **12 buyable upgrades:** Brass engine, Long-range tank, Canvas braces, Courier cradles, Sunheart wicks, Feather propeller, Silk lift trim, Copper storm rod, Willow landing skids, Thrift valve, Beacon lens, and Ring resonator. Every upgrade changes a flight, landing, delivery, combat, fuel, or reward parameter.
- **Screens:** title, hangar, mission dispatch, flight, pause, complete, unfinished landing, and crash results. The lit cockpit HUD shows altitude, airspeed, compass heading, fuel, throttle, damage, carried lanterns, earnings, objective, and valley.

## Deterministic flight recordings

These query strings run a feedback autopilot through the real fixed-step simulation and freeze at the selected action moment. Local saves and audio do not affect the recordings. The scene seed controls procedural content. A read-only `window.lanternwing.getState()` exposes the seed, tick, scene readiness, flight values, and content counts for verification.

- `?shot=cover&seed=7` — storm approach with a lantern pulse, rings, terrain, aircraft, target guidance, and instruments.
- `?shot=rings&seed=7` — transit through the first glowing ring.
- `?shot=landing&seed=7` — touchdown rollout on a lit runway after the ring route.
- `?shot=storm&seed=7` — a storm keeper releasing lightning.

`document.documentElement.dataset.ready` becomes `"true"` after the frame is drawn. `data-shot-ready` confirms that the recording reached its intended action, and `data-shot-tick` identifies the exact simulation tick. Shot modes remain frozen regardless of browser frame rate. The four screenshots in `screenshots/` were captured from these exact recordings (seed 7) in a real headless Chromium render.

## Packaging

Use Node 22 with native TypeScript support (Node 22.18 or later supports `node main.ts` directly). From the repository root, run `node main.ts`. Set `MAKEFUN_OUTPUT_DIR` to choose a destination; otherwise the output directory is `out/`. Earlier Node 22 versions may require `--experimental-strip-types`.

The entrypoint copies `game/` and `screenshots/`, then uses the unchanged `vendor/makefun-game.ts` helper to write the canonical `dossier.json` with the competition caps. It uses only Node’s standard library and performs no network operations. The helper requires actual screenshot images, so packaging intentionally reports an error while `screenshots/` is empty. The four screenshots are captured and present in this repo, so packaging succeeds.

## Source map

`config.js` defines the content and tuning; `random.js` provides seed mixing; `world.js` generates the valley; `physics.js` moves and lands the aircraft; `missions.js` runs objectives and combat; `render.js` draws scenery and airframe; `hud.js` draws instruments; `audio.js` synthesises sound; `input.js` reads controls; `shots.js` plays seeded recordings; `main.js` coordinates the loop, menus, and save state. All game code is original to this build session. The permitted packaging helper is the sole reused source file.
