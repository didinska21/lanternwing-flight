import { MISSIONS, VALLEY_LENGTH, TUNING, clamp } from './config.js';
import { createPlane, stepPhysics, crash } from './physics.js';
import { createWorld, nextTarget, routeEnd, valleyAt } from './world.js';

export function createFlight(seed, missionIndex = 0, upgrades = {}, damage = 0) {
  const world = createWorld(seed);
  const mission = MISSIONS[missionIndex];
  return { seed, world, mission, missionIndex, plane: createPlane(world, mission, upgrades, damage),
    time: 0, ticks: 0, progress: 0, objectiveDone: false, score: 0, earned: 0,
    projectiles: [], particles: [], events: [], message: 'Follow the amber route. Bring the light home.',
    messageUntil: 5, status: 'flying', valley: mission.valleys[0], resultTime: 0,
    ringsMissed: 0, deliveries: 0, bossesDefeated: 0, saved: false, boostCount: 0 };
}

export function announce(flight, text, seconds = 3) {
  flight.message = text;
  flight.messageUntil = flight.time + seconds;
}

function emit(flight, type, text = '') {
  flight.events.push({ type, text });
  if (flight.events.length > 12) flight.events.shift();
}

export function actionCue(flight) {
  const { plane, world } = flight;
  const ring = world.rings.find(r => !r.collected && Math.abs(r.z - plane.z) < 190
    && Math.abs(r.x - plane.x) < 125 && Math.abs(r.altitude - plane.altitude) < 85);
  if (ring) return { kind: 'boost', target: ring, text: 'SPACE  /  RING BOOST' };
  const boss = world.bosses.find(b => !b.defeated && b.z - plane.z > -90 && b.z - plane.z < 1100
    && Math.abs(b.x - plane.x) < 380);
  if (boss && flight.mission.id === 'storm') return { kind: 'pulse', target: boss, text: 'SPACE  /  LANTERN PULSE' };
  const village = world.villages.find(v => !v.delivered && v.valley >= flight.mission.valleys[0]
    && v.valley <= flight.mission.valleys[1] && v.z - plane.z > -90 && v.z - plane.z < 260
    && Math.abs(v.x - plane.x) < 170 + (plane.upgrades.lens || 0) * 35);
  if (village) return { kind: 'delivery', target: village, text: 'SPACE  /  RELEASE LANTERN' };
  return { kind: 'drop', target: null, text: 'SPACE  /  DROP LANTERN' };
}

function releaseLantern(flight) {
  const { plane } = flight;
  if (plane.cooldown > 0 || plane.rolling || plane.crashed) return;
  const cue = actionCue(flight);
  if (cue.kind === 'boost') {
    plane.boost = 1.1 + (plane.upgrades.resonator || 0) * 0.45;
    plane.boostFlash = 0.6;
    plane.cooldown = 1.3;
    flight.boostCount++;
    emit(flight, 'boost');
    return;
  }
  if (plane.cargo <= 0) {
    announce(flight, 'Cradles empty. Rings replenish two lanterns.');
    plane.cooldown = 1;
    return;
  }
  plane.cargo--;
  plane.cooldown = 0.85;
  flight.projectiles.push({ x: plane.x, z: plane.z + 12, altitude: plane.altitude - 8,
    age: 0, kind: cue.kind === 'pulse' ? 'pulse' : 'lantern',
    targetId: cue.target?.id ?? -1, guided: cue.kind === 'delivery', trail: [] });
  emit(flight, 'release');
}

function stepLanterns(flight, dt) {
  const { world, plane } = flight;
  for (const light of flight.projectiles) {
    light.age += dt;
    if (flight.ticks % 5 === 0) {
      light.trail.push({ x: light.x, z: light.z, altitude: light.altitude });
      if (light.trail.length > 9) light.trail.shift();
    }
    if (light.kind === 'pulse') {
      const boss = world.bosses[light.targetId];
      if (!boss || boss.defeated) { light.age = 20; continue; }
      const dx = boss.x - light.x, dz = boss.z - light.z, dy = boss.altitude - light.altitude;
      const length = Math.max(1, Math.hypot(dx, dz, dy));
      const travel = Math.min(length, 520 * dt);
      light.x += dx / length * travel;
      light.z += dz / length * travel;
      light.altitude += dy / length * travel;
      if (length < 28) {
        boss.health = Math.max(0, boss.health - 1 - (plane.upgrades.wick || 0));
        boss.hitAt = flight.time;
        light.age = 20;
        emit(flight, 'hit');
        if (!boss.health) {
          boss.defeated = true;
          boss.strike = null;
          flight.bossesDefeated++;
          flight.progress++;
          flight.score += 800;
          flight.earned += 14;
          announce(flight, boss.name + ' is becoming rain.');
          emit(flight, 'boss');
        }
      }
    } else {
      const target = light.guided ? world.villages[light.targetId] : null;
      if (target) {
        light.x += (target.x - light.x) * Math.min(1, dt * 1.7);
        light.z += (target.z - light.z) * Math.min(1, dt * 1.7);
      } else light.z += plane.speed * dt * 0.28;
      light.altitude -= dt * (41 + light.age * 4);
      if (light.altitude <= 8) {
        const radius = 145 + (plane.upgrades.lens || 0) * 35;
        const village = world.villages.find(v => !v.delivered && Math.hypot(v.x - light.x, v.z - light.z) < radius);
        if (village) {
          village.lit = true;
          village.delivered = true;
          flight.deliveries++;
          if (flight.mission.id === 'rescue' || flight.mission.id === 'night') flight.progress++;
          flight.score += 350;
          flight.earned += 9;
          announce(flight, village.name + ': the windows are waking.');
          emit(flight, 'village');
        }
        light.age = 20;
      }
    }
  }
  flight.projectiles = flight.projectiles.filter(light => light.age < 12);
}

function stepBosses(flight, dt) {
  if (flight.mission.id !== 'storm') return;
  const { world, plane, time } = flight;
  for (const boss of world.bosses) {
    if (boss.defeated) continue;
    boss.x = world.riverX(boss.z) + Math.sin(time * 0.43 + boss.phase) * 105;
    boss.altitude = 190 + Math.sin(time * 0.78 + boss.phase) * 24;
    const distance = boss.z - plane.z;
    if (distance > -140 && distance < 1350 && time >= boss.nextStrike && !boss.strike) {
      boss.strike = { x: plane.x, z: plane.z + 95, start: time, resolved: false };
      boss.nextStrike = time + 3.9;
      emit(flight, 'warning');
    }
    if (boss.strike) {
      const age = time - boss.strike.start;
      if (age > 1.5 && !boss.strike.resolved) {
        boss.strike.resolved = true;
        if (Math.abs(plane.x - boss.strike.x) < 53 && Math.abs(plane.z - boss.strike.z) < 180) {
          plane.damage += 13 * (1 - (plane.upgrades.rod || 0) * 0.22);
          plane.verticalSpeed -= 5;
          announce(flight, 'Lightning hit! Turn away from the amber strike lane.');
          emit(flight, 'thunder');
        }
      }
      if (age > 2.05) boss.strike = null;
    }
    if (plane.previousZ < boss.z + 60 && plane.z >= boss.z + 60 && !boss.defeated) {
      crash(plane, boss.name + ' swallowed the route. Send lantern pulses before passing it.');
    }
  }
}

export function stepFlight(flight, controls, dt) {
  if (flight.status !== 'flying') { flight.resultTime += dt; return; }
  flight.time += dt;
  flight.ticks++;
  const { plane, world, mission } = flight;
  stepPhysics(plane, controls, world, flight.time, dt);
  if (controls.action) releaseLantern(flight);
  flight.valley = valleyAt(plane.z);
  for (const ring of world.rings) {
    if (ring.collected || ring.z < plane.previousZ || ring.z > plane.z) continue;
    const error = Math.hypot(ring.x - plane.x, ring.altitude - plane.altitude);
    if (error < ring.radius + (plane.upgrades.trim || 0) * 4) {
      ring.collected = true;
      ring.collectedAt = flight.time;
      flight.score += 200;
      flight.earned += 4 + (plane.upgrades.resonator || 0) * 2;
      plane.cargo += 2;
      if (mission.id === 'rings') flight.progress++;
      announce(flight, 'Sky-ring carried. +2 lanterns in the cradles.', 2);
      emit(flight, 'ring');
    } else if (mission.id === 'rings' && ring.valley === mission.valleys[0]) flight.ringsMissed++;
  }
  if (mission.id === 'pass') {
    for (const pass of world.passes) {
      if (pass.crossed || plane.previousZ > pass.z || plane.z < pass.z) continue;
      pass.crossed = true;
      if (Math.abs(plane.x - pass.x) < pass.halfWidth && plane.altitude > pass.floor && plane.altitude < pass.ceiling) {
        flight.progress++;
        flight.earned += 10;
        flight.score += 500;
        announce(flight, 'Through the stone. Hold a steady wing.');
        emit(flight, 'ring');
      } else {
        plane.damage += 72;
        plane.verticalSpeed -= 14;
        announce(flight, 'Rock strike! The pass is 55–230 m, between the amber markers.');
      }
    }
  }
  stepLanterns(flight, dt);
  stepBosses(flight, dt);
  if (!flight.objectiveDone && flight.progress >= mission.goal) {
    flight.objectiveDone = true;
    announce(flight, 'Route complete. Follow the runway lights. Land below 72 m/s.', 7);
    emit(flight, 'objective');
  }
  const finish = routeEnd(flight);
  if (plane.damage >= 100 && !plane.crashed) crash(plane, 'The wing broke under the strain.');
  if (!plane.rolling && plane.z > finish.end + 250 && !plane.crashed) {
    crash(plane, 'The landing field slipped behind. Try an earlier, slower approach.');
  }
  if (plane.crashed) {
    flight.status = 'crash';
    emit(flight, 'crash');
  } else if (plane.landed) {
    flight.status = flight.objectiveDone ? 'complete' : 'landing';
    if (flight.objectiveDone) {
      flight.earned += mission.reward;
      flight.score += Math.round(plane.fuel * 5 + (100 - plane.damage) * 8);
    }
    emit(flight, 'landing');
  }
}

export function objectiveText(flight) {
  if (flight.objectiveDone) return 'RETURN TO THE LIT RUNWAY  ·  ' + (Math.round(Math.max(0, routeEnd(flight).start - flight.plane.z))) + ' m';
  return flight.mission.short.toUpperCase() + '  ' + Math.min(flight.progress, flight.mission.goal) + ' / ' + flight.mission.goal;
}

// Feedback steering is also used by the title flyover and all four seeded shots.
export function autopilot(flight, options = {}) {
  const { plane, world } = flight;
  let target = nextTarget(flight);
  const distance = target.z - plane.z;
  let targetAltitude = target.altitude || 145;
  let targetSpeed = target.type === 'boss' ? 71 : 79;
  let targetX = target.x;
  let action = false;
  if (target.type === 'village') {
    targetAltitude = 120;
    targetSpeed = 68;
    action = distance < 220 && distance > -70 && Math.abs(plane.x - target.x) < 125;
    const inAir = flight.projectiles.some(p => p.guided && p.targetId === target.id);
    if (inAir) {
      const later = world.villages.find(v => v.z > target.z + 10 && !v.delivered);
      if (later) { targetX = later.x; targetAltitude = 120; }
      action = false;
    }
  }
  if (target.type === 'boss') {
    targetAltitude = 155;
    const strike = world.bosses[target.id]?.strike;
    if (strike && flight.time - strike.start < 1.7) {
      // Pick a side relative to the marked lane, rather than chasing the moving cloud.
      // The warning period is deliberately long enough for a bank to answer at any speed.
      targetX = plane.x + (plane.x >= strike.x ? 720 : -720);
    }
    action = distance < (options.holdFire ? 430 : 1030) && distance > 0;
  }
  if (target.type === 'runway') {
    const runway = routeEnd(flight);
    const lateralError = Math.abs(plane.x - runway.x);
    targetX = runway.x;
    targetSpeed = 42;
    targetAltitude = clamp((runway.end - 170 - plane.z) * 0.18, 0, 145);
    if (lateralError > 65) targetAltitude = Math.max(45, targetAltitude);
    if (plane.z > runway.start && lateralError < 48) targetAltitude = Math.max(0, (runway.end - 180 - plane.z) * 0.16);
  }
  const aimDistance = target.type === 'runway' ? 175 : clamp(Math.abs(distance), 170, 460);
  const desiredHeading = clamp(Math.atan2(targetX - plane.x, aimDistance), -0.8, 0.8);
  const turn = clamp((desiredHeading - plane.heading) * 3.5, -0.78, 0.78);
  const liftCorrection = plane.bank * plane.bank * (4 + Math.max(0, (plane.speed - 88) / 32) * 31);
  const desiredClimb = clamp((targetAltitude - plane.altitude) * 0.65, -11, 15);
  const pitch = clamp((desiredClimb + liftCorrection - (plane.speed - 76) * 0.055) / 25, -0.7, 0.9);
  const desiredThrottle = clamp((targetSpeed - 24 + pitch * 9) / (102 + (plane.upgrades.engine || 0) * 7), 0, 1);
  const throttle = clamp((desiredThrottle - plane.throttle) * 6 - pitch * 0.24, -1, 1);
  return { turn, pitch, throttle, action: action && plane.cooldown <= 0 };
}
