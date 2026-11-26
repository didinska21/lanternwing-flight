import { STEP } from './config.js';
import { createFlight, autopilot, stepFlight } from './missions.js';

export const SHOT_NAMES = Object.freeze(['cover', 'rings', 'landing', 'storm']);

export function shotRequest(search) {
  const query = new URLSearchParams(search);
  const name = query.get('shot');
  return SHOT_NAMES.includes(name) ? name : null;
}

export function playShot(name, seed) {
  const storm = name === 'cover' || name === 'storm';
  const flight = createFlight(seed, storm ? 4 : 0);
  let ready = false;
  let reason = 'frame budget';
  // No teleports, health edits, staged entities, or alternate render paths.
  // Each frame is the normal fixed-step game with feedback steering.
  for (let tick = 0; tick < 15000; tick++) {
    const controls = autopilot(flight, { holdFire: storm });
    stepFlight(flight, controls, STEP);
    flight.events.length = 0;
    const { plane, world } = flight;
    if (name === 'rings') {
      const ring = world.rings[0];
      if (plane.z >= ring.z - 6 && plane.z <= ring.z + 12) { ready = true; reason = 'ring transit'; }
    } else if (name === 'landing') {
      if (plane.rolling && flight.time - plane.touchdown.at > 0.12) { ready = true; reason = 'touchdown rollout'; }
    } else {
      const boss = world.bosses.find(b => !b.defeated);
      const distance = boss ? boss.z - plane.z : 0;
      const lightning = boss?.strike && flight.time - boss.strike.start > 1 && flight.time - boss.strike.start < 1.4;
      if (name === 'cover' && distance < 420 && distance > 170 && flight.projectiles.length > 0) { ready = true; reason = 'lantern pulse approach'; }
      if (name === 'storm' && distance < 900 && distance > 170 && lightning) { ready = true; reason = 'active lightning'; }
    }
    if (ready || flight.status !== 'flying') break;
  }
  flight.shot = { name, ready, reason, seed, tick: flight.ticks };
  return flight;
}
